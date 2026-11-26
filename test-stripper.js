// Test stripPayloadFakePrefix as written in _worker.js.
// Extracts the real function from the Worker file and runs it through the
// cases TaptapBox actually produces.
const fs = require("fs");
const code = fs.readFileSync("_worker.js", "utf8");

// Extract the stripper block: from `let payloadPrefixBuf` to the end of
// stripPayloadFakePrefix (the line `    return toArrayBuffer(bytes.slice(end + 4));\n  }`).
const start = code.indexOf("  let payloadPrefixBuf = new Uint8Array(0);");
const endMarker = "    return toArrayBuffer(bytes.slice(end + 4));\n  }";
const end = code.indexOf(endMarker, start);
if (start === -1 || end === -1) {
  console.error("FAIL: stripper block not found in _worker.js");
  process.exit(1);
}
const block = code.slice(start, end + endMarker.length);
// The block is inside vlessOverWSHandler; eval it in a scope where the
// helper functions exist. `toArrayBuffer` is defined inside the block.
eval(block);

let pass = 0, fail = 0;
function check(name, cond) {
  if (cond) { pass++; console.log("PASS:", name); }
  else { fail++; console.log("FAIL:", name); }
}
function bytes(str) { return new TextEncoder().encode(str); }
function toU8(ab) { return new Uint8Array(ab); }

// Fake VLESS header: version 0x00 + 16-byte UUID + opt 0 + cmd 1 (TCP)
// + port 443 + addr type 2 (domain) + len 11 + "example.com" + payload "HELLO"
const vless = new Uint8Array([
  0x00,
  0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77, 0x88,
  0x99, 0xaa, 0xbb, 0xcc, 0xdd, 0xee, 0xff, 0x00,
  0x00, 0x01, 0x01, 0xbb, 0x02, 0x0b,
  ...bytes("example.com"),
  ...bytes("HELLO"),
]);
const PREFIX = bytes("HTTP/ 200 OK\r\n\r\n"); // 16 bytes
const PREFIX_BUF = PREFIX.buffer.slice(PREFIX.byteOffset, PREFIX.byteOffset + PREFIX.byteLength);
const VLESS_BUF = vless.buffer.slice(vless.byteOffset, vless.byteOffset + vless.byteLength);

// Case A: chunk is exactly the 16-byte prefix -> empty (caller waits).
{
  payloadPrefixBuf = new Uint8Array(0);
  const out = stripPayloadFakePrefix(PREFIX_BUF);
  check("A: standalone prefix -> empty ArrayBuffer", out !== null && out.byteLength === 0);
}

// Case B: prefix glued to the VLESS header in one chunk -> VLESS only.
{
  payloadPrefixBuf = new Uint8Array(0);
  const glued = new Uint8Array(PREFIX.length + vless.length);
  glued.set(PREFIX, 0); glued.set(vless, PREFIX.length);
  const out = stripPayloadFakePrefix(glued.buffer.slice(glued.byteOffset, glued.byteOffset + glued.byteLength));
  check("B: prefix+VLESS glued -> VLESS header returned",
    out !== null && out.byteLength === vless.length && toU8(out)[0] === 0x00 && toU8(out)[1] === 0x11);
}

// Case C: plain VLESS header, no prefix -> unchanged.
{
  payloadPrefixBuf = new Uint8Array(0);
  const out = stripPayloadFakePrefix(VLESS_BUF);
  check("C: no prefix -> chunk unchanged",
    out !== null && out.byteLength === vless.length && toU8(out)[0] === 0x00);
}

// Case D: prefix split across two WebSocket messages.
{
  payloadPrefixBuf = new Uint8Array(0);
  const part1 = bytes("HTTP/ 200 "); // 9 bytes
  const part2 = new Uint8Array([...bytes("OK\r\n\r\n"), ...vless]);
  const out1 = stripPayloadFakePrefix(part1.buffer.slice(part1.byteOffset, part1.byteOffset + part1.byteLength));
  const out2 = stripPayloadFakePrefix(part2.buffer.slice(part2.byteOffset, part2.byteOffset + part2.byteLength));
  check("D1: partial prefix -> null (buffered)", out1 === null);
  check("D2: rest of prefix + VLESS -> VLESS header returned",
    out2 !== null && out2.byteLength === vless.length && toU8(out2)[0] === 0x00);
}

// Case E: a different fake status line ("HTTP/1.1 200 OK") -> also stripped.
{
  payloadPrefixBuf = new Uint8Array(0);
  const other = new Uint8Array([...bytes("HTTP/1.1 200 OK\r\n\r\n"), ...vless]);
  const out = stripPayloadFakePrefix(other.buffer.slice(other.byteOffset, other.byteOffset + other.byteLength));
  check("E: generic HTTP/1.1 fake line -> VLESS header returned",
    out !== null && out.byteLength === vless.length && toU8(out)[0] === 0x00);
}

// Case F: after a strip, a following plain chunk is untouched (state reset).
{
  payloadPrefixBuf = new Uint8Array(0);
  stripPayloadFakePrefix(PREFIX_BUF);
  const out = stripPayloadFakePrefix(VLESS_BUF);
  check("F: next chunk after standalone prefix -> VLESS parsed",
    out !== null && out.byteLength === vless.length);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
