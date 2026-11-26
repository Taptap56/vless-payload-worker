// Test the new config page: extract httpupgradeLinks + getvlessConfig from
// _worker.js, render with a dummy UUID/host, and verify the output.
const fs = require("fs");
const code = fs.readFileSync("_worker.js", "utf8");

// Extract from the httpupgradeLinks comment to the end of getvlessConfig.
const start = code.indexOf("// Link VLESS httpupgrade");
const endMarker = "</html>`;\n}";
const end = code.indexOf(endMarker, start);
if (start === -1 || end === -1) {
  console.error("FAIL: config page block not found");
  process.exit(1);
}
const block = code.slice(start, end + endMarker.length);
eval(block);

const UUID = "11111111-2222-3333-4444-555555555555";
const HOST = "vless-payload.test.workers.dev";

let pass = 0, fail = 0;
function check(name, cond) {
  if (cond) { pass++; console.log("PASS:", name); }
  else { fail++; console.log("FAIL:", name); }
}

// --- httpupgradeLinks ---
const [link80, link443] = httpupgradeLinks(UUID, HOST);
function parseLink(label, link, expectPort, expectTLS) {
  check(`${label}: starts with vless://UUID@HOST:port`, link.startsWith(`vless://${UUID}@${HOST}:${expectPort}?`));
  const u = new URL(link);
  check(`${label}: type=httpupgrade`, u.searchParams.get("type") === "httpupgrade");
  check(`${label}: path=/vless-upgrade`, u.searchParams.get("path") === "/vless-upgrade");
  check(`${label}: host=${HOST}`, u.searchParams.get("host") === HOST);
  check(`${label}: security=${expectTLS}`, u.searchParams.get("security") === expectTLS);
  check(`${label}: encryption=none`, u.searchParams.get("encryption") === "none");
  if (expectTLS === "tls") check(`${label}: sni=${HOST}`, u.searchParams.get("sni") === HOST);
}
parseLink("link80", link80, "80", "none");
parseLink("link443", link443, "443", "tls");

// --- /sub text (same two links, newline separated) ---
const subText = `${link80}\n${link443}`;
check("/sub: two lines, both vless links", subText.split("\n").length === 2 && subText.split("\n").every(l => l.startsWith("vless://")));

// --- getvlessConfig HTML ---
const html = getvlessConfig(UUID, HOST);
check("page: is a full HTML document", html.includes("<!DOCTYPE html>") && html.includes("</html>"));
check("page: lang=id", html.includes('<html lang="id">'));
check("page: title", html.includes("<title>VLESS Worker — TaptapBox</title>"));
check("page: contains link80", html.includes(link80));
check("page: contains link443", html.includes(link443));
check("page: has 2 Salin buttons", (html.match(/>Salin link<\/button>/g) || []).length === 2);
check("page: has subscription URL", html.includes(`https://${HOST}/${UUID}/sub`));
check("page: TB settings table has httpupgrade + /vless-upgrade",
  html.includes("httpupgrade") && html.includes("/vless-upgrade"));
check("page: no yonggekkk/Chinese branding left",
  !html.includes("yonggekkk") && !html.includes("甬哥") && !html.includes("ygkkk"));
check("page: no old WS links (type=ws, ed=2560)",
  !html.includes("type=ws") && !html.includes("ed%3D2560") && !html.includes("ed=2560"));
check("page: has copy-to-clipboard script", html.includes("function salin(") && html.includes("navigator.clipboard"));
check("page: no external CSS/JS dependency (self-contained)",
  !html.includes("cdn.jsdelivr") && !html.includes("bootstrap"));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
