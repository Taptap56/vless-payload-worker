# VLESS Worker — httpupgrade + payload (TaptapBox)

Worker Cloudflare untuk VLESS lewat **httpupgrade** yang mendukung **custom
payload** TaptapBox. Basisnya script VLESS yonggekkk
(`yonggekkk/Cloudflare-vless-trojan`, file `Vless_workers_pages/_worker明.js`),
dengan tiga perubahan:

1. **Terima PATCH.** Handler WebSocket hanya mengecek header
   `Upgrade: websocket`, bukan method HTTP-nya — jadi request
   `PATCH /vless-upgrade` dari TaptapBox diterima dan dijawab **101**.
2. **Buang awalan payload.** Setelah 101, TaptapBox mengirim baris palsu
   `HTTP/ 200 OK\r\n\r\n` (16 byte, segmen `[split]` dari custom payload)
   sebelum header VLESS. Worker membuang baris itu dulu, baru mem-parsing
   header VLESS. Awalan boleh datang sebagai pesan WebSocket sendiri,
   menempel di header VLESS, atau terbelah di dua pesan — semuanya ditangani.
3. **Non-upgrade jadi 404.** Request biasa (tanpa `Upgrade: websocket`) ke
   path yang tidak dikenal dijawab **404**, bukan 200 — supaya decoy tidak
   pernah dikira upgrade yang berhasil.

Halaman konfigurasi tetap ada: buka `https://<nama>.workers.dev/<uuid>`
untuk melihat link `vless://`.

## Halaman konfigurasi

Buka `https://<nama>.workers.dev/<uuid>` untuk melihat halaman konfigurasi
(bahasa Indonesia, tanpa dependensi eksternal):

- **Link VLESS (httpupgrade)** — port 80 tanpa TLS dan port 443 dengan TLS,
  masing-masing dengan tombol **Salin link**.
- **Pengaturan TaptapBox** — tabel address/port/network/host/path/TLS/Payload
  yang sesuai dengan entry di atas.
- **Subscription** — `https://<nama>.workers.dev/<uuid>/sub` mengembalikan
  kedua link di atas sebagai teks polos (untuk diimpor sebagai subscription).

Halaman ini menggantikan halaman konfigurasi yonggekkk (yang berbahasa
Mandarin dan link-nya masih WS biasa, bukan httpupgrade).

## Deploy (Cloudflare dashboard)

1. Buka [Cloudflare dashboard](https://dash.cloudflare.com/) →
   **Workers & Pages** → **Create** → **Worker** → beri nama (misal
   `vless-payload`) → **Deploy**.
2. Buka Worker itu → **Edit code** → hapus semua isi → tempel seluruh isi
   file `_worker.js` di repo ini → **Deploy**.
3. **Wajib: isi UUID.** Di halaman Worker → **Settings** →
   **Variables** → **Add variable**:
   - Name: `uuid`
   - Value: UUID VLESS kamu (yang sama dengan di entry TaptapBox).
   - **Jangan** menulis UUID asli di dalam kode — biarkan placeholder
     `00000000-0000-0000-0000-000000000000` di `_worker.js` apa adanya.
4. Simpan, lalu **Deploy** ulang (atau Redeploy).

Worker kamu sekarang di `https://<nama>.workers.dev`.

## Entry TaptapBox

Buat entry VLESS baru (atau ubah entry UPGRADE yang sudah ada):

| Field | Isi |
|---|---|
| address | IP Cloudflare, misal `104.17.3.81` (atau `<nama>.workers.dev`) |
| port | `80` |
| network | `httpupgrade` |
| host | `<nama>.workers.dev` |
| path | `/vless-upgrade` |
| TLS | mati |
| id (UUID) | UUID yang sama dengan variabel `uuid` di Worker |
| Payload | **ON**, isi custom payload yang sama seperti entry UPGRADE |

Custom payload (sama seperti entry UPGRADE yang sudah jalan):

```
GET / HTTP/1.1[crlf]Host: edu.ruangguru.com[crlf]Upgrade: websocket[crlf][crlf]PATCH /vless-upgrade HTTP/1.1[crlf]Host: [host][crlf]Upgrade: websocket[crlf][crlf][split]HTTP/ 200 OK[crlf][crlf]
```

Catatan:

- Decoy (`GET /` ke `edu.ruangguru.com`) tidak pernah sampai ke Worker —
  di edge Cloudflare dia di-route ke zone Ruangguru. Yang sampai ke Worker
  hanya PATCH-nya.
- Alternatif: address `<nama>.workers.dev`, port `443`, TLS nyala. Coba ini
  kalau port 80 bermasalah.
- UDP lewat Worker hanya port 53 (DNS). Game/VoIP UDP tidak bisa lewat sini.

## File

- `_worker.js` — Worker (siap tempel ke Cloudflare).
- `_worker-yonggekkk.js` — file asli yonggekkk, disimpan sebagai referensi
  (jangan di-deploy; UUID default-nya shared dan belum dipatch).
- `test-stripper.js` — unit test logika buang-awalan (jalankan `node
  test-stripper.js`; butuh Node.js, hanya untuk verifikasi, bukan deploy).

## Kredit

- Basis: [yonggekkk/Cloudflare-vless-trojan](https://github.com/yonggekkk/Cloudflare-vless-trojan)
- Patch httpupgrade + payload: TaptapBox.
