# Metabase MCP Client Integration Guide

Dokumen ini menjelaskan cara menghubungkan aplikasi, model, agent LLM, coding IDE, atau MCP client baru ke MCP Metabase BP Batam.

## Ringkasan Endpoint

Ada dua MCP server Metabase yang dipakai:

| Nama MCP | Endpoint | Auth | Fungsi Utama |
|---|---|---|---|
| `metabase_api` | `http://172.16.9.221:3967/mcp` | Tidak perlu OAuth | Custom REST API MCP untuk dashboard, card/question, collection, layout, tab, dan operasi dashboard praktis |
| `metabase-official` | `http://172.16.9.221:3977/api/mcp` | OAuth | Official Metabase MCP untuk search table/metric, construct query, execute query, dan akses semantic/query layer |

Upstream Metabase production berada di:

```text
http://172.16.9.210:3000
```

Gunakan endpoint MCP melalui gateway `172.16.9.221`, bukan langsung ke upstream Metabase, kecuali client memang sedang dikembangkan di sisi server.

## Kapan Memakai Masing-Masing MCP

Gunakan urutan ini untuk agent LLM:

1. `metabase_api`
   - Cari dashboard, card/question, collection curated.
   - Baca dashboard dan card yang sudah dibuat user/admin.
   - Cocok untuk pertanyaan seperti "cek dashboard BI Perizinan", "lihat card SDM", "buat/atur dashboard", "atur tab", "override judul card".
2. `metabase-official`
   - Dipakai jika dashboard/card tidak cukup detail.
   - Search table/metric, construct query, execute query.
   - Cocok untuk pertanyaan eksplorasi data atau aggregate query.
3. DB read-only MCP
   - Hanya fallback terakhir jika Metabase tidak bisa memberi grain data yang dibutuhkan.
   - Harus read-only dan sesuai allowlist.

Jangan langsung query DB jika pertanyaan user menyebut dashboard, card, atau Metabase curated content.

## Persyaratan Network

Client harus bisa menjangkau:

```bash
curl -i http://172.16.9.221:3967/mcp
curl -i http://172.16.9.221:3977/api/mcp
```

Respons `405`, `400`, atau `401` dari endpoint MCP bisa normal untuk request `GET`. Untuk MCP streamable HTTP, client harus melakukan `POST` JSON-RPC.

Tes handshake tanpa auth untuk `metabase_api`:

```bash
curl -sS -D /tmp/mcp-headers.txt \
  -X POST http://172.16.9.221:3967/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  --data '{
    "jsonrpc":"2.0",
    "id":1,
    "method":"initialize",
    "params":{
      "protocolVersion":"2025-03-26",
      "capabilities":{},
      "clientInfo":{"name":"mcp-client-check","version":"1.0"}
    }
  }'
```

Untuk `metabase-official`, handshake tanpa token biasanya akan mengembalikan `401 Unauthorized`. Itu normal karena official MCP memakai OAuth.

## Konfigurasi Generic MCP Client

Gunakan transport:

```text
streamable-http
```

Contoh konfigurasi generik:

```json
{
  "mcpServers": {
    "metabase_api": {
      "transport": "streamable-http",
      "url": "http://172.16.9.221:3967/mcp",
      "requestTimeoutMs": 120000
    },
    "metabase-official": {
      "transport": "streamable-http",
      "url": "http://172.16.9.221:3977/api/mcp",
      "auth": {
        "type": "oauth",
        "resource": "http://172.16.9.221:3977/api/mcp"
      },
      "requestTimeoutMs": 120000
    }
  }
}
```

Jika client memakai nama field berbeda, padankan konsepnya:

- `transport`: streamable HTTP
- `url`: endpoint MCP
- `auth.type`: OAuth untuk `metabase-official`
- `resource`: `http://172.16.9.221:3977/api/mcp`
- timeout minimal disarankan 120 detik

## Konfigurasi OpenCode

File konfigurasi umum:

```text
~/.config/opencode/opencode.jsonc
```

Tambahkan ke blok `mcp`:

```jsonc
{
  "mcp": {
    "metabase_api": {
      "enabled": true,
      "type": "remote",
      "url": "http://172.16.9.221:3967/mcp",
      "oauth": false,
      "timeout": 120000
    },
    "metabase-official": {
      "enabled": true,
      "type": "remote",
      "url": "http://172.16.9.221:3977/api/mcp",
      "oauth": {},
      "timeout": 120000
    }
  }
}
```

Validasi:

```bash
opencode debug config
opencode mcp list
```

Login OAuth official:

```bash
opencode mcp auth metabase-official
```

Buka URL authorization yang muncul, login ke Metabase, lalu approve.

## Konfigurasi Codex CLI/Desktop

Gunakan command MCP bawaan Codex agar format config valid:

```bash
codex mcp add metabase_api \
  --url http://172.16.9.221:3967/mcp

codex mcp add metabase-official \
  --url http://172.16.9.221:3977/api/mcp \
  --oauth-resource http://172.16.9.221:3977/api/mcp
```

Login OAuth:

```bash
codex mcp login metabase-official
```

Validasi:

```bash
codex mcp list
codex mcp get metabase_api
codex mcp get metabase-official
```

Jika token expired:

```bash
codex mcp logout metabase-official
codex mcp login metabase-official
```

## Konfigurasi Pi CLI

File konfigurasi umum:

```text
~/.pi/agent/mcp.json
```

Contoh:

```json
{
  "mcpServers": {
    "metabase_api": {
      "transport": "streamable-http",
      "url": "http://172.16.9.221:3967/mcp",
      "lifecycle": "eager",
      "healthCheckIntervalMs": 60000
    },
    "metabase_official": {
      "transport": "streamable-http",
      "url": "http://172.16.9.221:3977/api/mcp",
      "auth": {
        "type": "oauth"
      },
      "lifecycle": "lazy",
      "requestTimeoutMs": 120000
    }
  }
}
```

Gunakan nama tool sesuai prefix Pi yang aktif. Pada beberapa setup, tool akan tampil seperti:

```text
mcp_metabase_api_...
mcp_metabase_official_...
```

## OAuth Metabase Official

`metabase-official` memakai OAuth. Flow normal:

1. MCP client memanggil login/auth.
2. Client menampilkan URL authorization seperti:

   ```text
   http://172.16.9.221:3977/oauth/authorize?...
   ```

3. User membuka URL itu di browser.
4. User login ke Metabase.
5. User approve akses MCP.
6. Browser redirect ke callback lokal client, biasanya `127.0.0.1:<port>`.
7. Client menyimpan token.

Jika browser menampilkan error tidak bisa connect ke `127.0.0.1`, biasanya proses CLI/client yang menunggu callback sudah berhenti atau berjalan di mesin berbeda dari browser. Solusinya:

- Jalankan ulang command auth/login.
- Pastikan browser dibuka di mesin yang sama dengan client yang menjalankan auth.
- Jangan hentikan terminal sebelum proses login selesai.

## Prompt System Untuk Agent LLM

Gunakan instruksi ini untuk model/agent yang akan memakai MCP:

```text
Anda adalah agent analis Metabase BP Batam.

MCP yang tersedia:
- metabase_api: custom REST API MCP untuk dashboard, card/question, collection, tab, layout, dan operasi dashboard.
- metabase-official: official Metabase MCP untuk search table/metric, construct query, dan execute query.

Workflow wajib:
1. Jika user bertanya tentang dashboard, card, report, visual, atau konten curated, mulai dengan metabase_api.
2. Search dashboard/card/collection memakai keyword user.
3. Jika dashboard/card ditemukan, baca metadata dan gunakan hasil curated sebagai sumber utama.
4. Jika curated content tidak cukup detail, lanjut ke metabase-official.
5. Di metabase-official, search table/metric dahulu, lalu construct/execute query setelah table/metric relevan jelas.
6. DB read-only hanya fallback terakhir jika Metabase tidak bisa menjawab grain yang dibutuhkan.

Guardrail:
- Jangan langsung query DB untuk pertanyaan dashboard/card.
- Jangan menyimpulkan dashboard tidak ada hanya dari hasil metabase-official.
- Jangan emit raw XML tool call seperti <tool_call>, <function=...>, atau <parameter=...>.
- Jangan batch banyak tool call dalam satu respons untuk model lokal yang sensitif tool-call.
- Batasi output besar dengan limit, aggregate, atau pagination.
- Jawaban akhir wajib menyebut source_path, dashboard/card/table/metric yang dipakai, filter/periode, dan caveat limit/pagination.
```

## Prompt User Untuk Meminta Agent Mengonfigurasi Otomatis

Jika aplikasi/model belum terkoneksi dan ingin agent yang mengatur config:

```text
Tolong konfigurasi MCP Metabase untuk client/IDE ini secara otomatis.

Endpoint:
- metabase_api: http://172.16.9.221:3967/mcp
- metabase-official: http://172.16.9.221:3977/api/mcp, OAuth required

Tugas:
1. Deteksi jenis client/IDE yang sedang dipakai.
2. Cari file konfigurasi MCP.
3. Backup config sebelum edit.
4. Tambahkan kedua MCP server tanpa menghapus config existing.
5. Jalankan validator/list command client.
6. Jalankan OAuth login untuk metabase-official dan tampilkan URL authorization.
7. Beri ringkasan file yang diedit, backup, status koneksi, dan status auth.

Aturan:
- Jangan simpan password/token baru di chat.
- Jangan overwrite konfigurasi lain.
- Jika schema config tidak jelas, cek help/debug command client dulu.
```

## Troubleshooting

### `401 Unauthorized` di `metabase-official`

Normal jika belum OAuth. Jalankan auth/login client.

### `Session not found`

Biasanya client memakai `Mcp-Session-Id` lama atau membuka koneksi baru tanpa initialize ulang.

Solusi:

- Restart session agent/client.
- Jalankan ulang initialize.
- Pastikan request lanjutan memakai header `Mcp-Session-Id` yang baru.

### Tool call muncul sebagai teks, bukan dieksekusi

Ini biasanya masalah model lokal/tool-call parser.

Solusi prompt:

```text
Gunakan native tool call client, jangan tulis tool call sebagai teks.
Jangan emit <tool_call>, <function=...>, atau <parameter=...>.
Lakukan satu tool call per langkah, tunggu hasil, lalu lanjut.
```

### Context membengkak karena hasil query besar

Solusi:

- Gunakan aggregate query.
- Tambahkan `LIMIT`.
- Pakai pagination.
- Minta tool mengembalikan sample dan metadata, bukan seluruh row.

### Dashboard tidak ditemukan oleh official MCP

Official Metabase MCP pada setup ini lebih kuat untuk table/metric/query. Untuk dashboard/card/collection gunakan `metabase_api`.

## Checklist Integrasi

Sebelum dipakai produksi, pastikan:

- [ ] Client bisa reach `172.16.9.221:3967`.
- [ ] Client bisa reach `172.16.9.221:3977`.
- [ ] `metabase_api` muncul di daftar MCP tools.
- [ ] `metabase-official` muncul di daftar MCP tools.
- [ ] OAuth `metabase-official` sudah login.
- [ ] Agent prompt memakai curated-first workflow.
- [ ] Agent membatasi output besar.
- [ ] Agent mencantumkan source trail di jawaban akhir.

