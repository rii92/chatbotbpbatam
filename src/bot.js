const {
  default: makeWASocket,
  DisconnectReason,
  useMultiFileAuthState,
  makeInMemoryStore,
  fetchLatestBaileysVersion,
  jidNormalizedUser,
} = require("@whiskeysockets/baileys");
const pino = require("pino");
const qrcode = require("qrcode");
const fs = require("fs-extra");
const path = require("path");

// ─── Config ──────────────────────────────────────────────────────────────────
const BOT_NUMBER = "6285168779389";
const AUTH_DIR = path.join(__dirname, "../data/auth");
const CONFIG_PATH = path.join(__dirname, "../data/config.json");

// ─── State ────────────────────────────────────────────────────────────────────
let sock = null;
let connectionStatus = "disconnected"; // disconnected | connecting | connected
let qrCodeData = null;
let io = null; // Socket.IO instance injected from server

// ─── Config helpers ──────────────────────────────────────────────────────────
function loadConfig() {
  if (!fs.existsSync(CONFIG_PATH)) {
    const defaults = {
      subjectMatters: [],
      rejectMessage:
        "Mohon maaf, Anda bukan Subject Matter yang terdaftar. Pesan ini tidak dapat diproses.",
      welcomeMessage:
        "Halo! Selamat datang. Anda terdaftar sebagai Subject Matter. Ada yang bisa kami bantu?",
      spamMessage: "",
      spamEnabled: false,
      botActive: true,
      aiEnabled: false,
      aiApiUrl: "http://localhost:8000",
    };
    fs.ensureFileSync(CONFIG_PATH);
    fs.writeJsonSync(CONFIG_PATH, defaults, { spaces: 2 });
    return defaults;
  }
  return fs.readJsonSync(CONFIG_PATH);
}

function saveConfig(config) {
  fs.ensureFileSync(CONFIG_PATH);
  fs.writeJsonSync(CONFIG_PATH, config, { spaces: 2 });
}

function getConfig() {
  return loadConfig();
}

function updateConfig(updates) {
  const current = loadConfig();
  const updated = { ...current, ...updates };
  saveConfig(updated);
  return updated;
}

// ─── Normalize phone number ───────────────────────────────────────────────────
function normalizeNumber(num) {
  // Strip non-digits, remove leading +
  return num.replace(/\D/g, "");
}

function extractUser(jid) {
  // Properly extract user from JID (handles device/agent suffix like .0, :1, _xyz)
  // e.g. "6289693967005.0@s.whatsapp.net" → "6289693967005"
  const atIdx = jid.indexOf("@");
  if (atIdx === -1) return jid;
  const userPart = jid.slice(0, atIdx);
  // Remove device suffix (e.g. .0) and agent suffix (e.g. _xyz)
  return userPart.split(".")[0].split(":")[0].split("_")[0];
}

function isSubjectMatter(senderJid) {
  const config = getConfig();
  const senderNum = normalizeNumber(extractUser(senderJid));
  return config.subjectMatters.some(
    (n) => normalizeNumber(n) === senderNum
  );
}

// ─── Bot Core ─────────────────────────────────────────────────────────────────
async function startBot(socketIo) {
  io = socketIo;
  fs.ensureDirSync(AUTH_DIR);

  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  const { version } = await fetchLatestBaileysVersion();

  connectionStatus = "connecting";
  emitStatus();

  const logger = pino({ level: "silent" });

  sock = makeWASocket({
    version,
    auth: state,
    logger,
    printQRInTerminal: false,
    browser: ["ChatBot", "Chrome", "1.0.0"],
    defaultQueryTimeoutMs: 60_000,
    connectTimeoutMs: 60_000,
    keepAliveIntervalMs: 25_000,
    retryRequestDelayMs: 2_000,
    maxMsgRetryCount: 5,
  });

  // ── Credentials save ──
  sock.ev.on("creds.update", saveCreds);

  // ── Connection updates ──
  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      qrCodeData = await qrcode.toDataURL(qr);
      connectionStatus = "qr";
      emitStatus();
      emitQR();
      console.log("[BOT] QR Code generated - scan with WhatsApp");
    }

    if (connection === "open") {
      connectionStatus = "connected";
      qrCodeData = null;
      emitStatus();
      console.log(`[BOT] Connected as ${BOT_NUMBER}`);
    }

    if (connection === "close") {
      const shouldReconnect =
        lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;

      console.log(
        "[BOT] Connection closed:",
        lastDisconnect?.error?.message,
        "| Reconnect:",
        shouldReconnect
      );

      connectionStatus = "disconnected";
      emitStatus();

      if (shouldReconnect) {
        console.log("[BOT] Reconnecting in 5s...");
        setTimeout(() => startBot(io), 5000);
      } else {
        // Logged out — clear auth
        fs.removeSync(AUTH_DIR);
        qrCodeData = null;
      }
    }
  });

  // ── Incoming messages ──
  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;

    for (const msg of messages) {
      if (msg.key.fromMe) continue; // skip own messages
      if (!msg.message) continue;

      const senderJid = msg.key.remoteJid;
      if (!senderJid || senderJid.includes("@g.us")) continue; // skip groups

      const config = getConfig();
      if (!config.botActive) continue;

      const text =
        msg.message?.conversation ||
        msg.message?.extendedTextMessage?.text ||
        "";

      const senderNum = extractUser(senderJid);
      const isAllowed = isSubjectMatter(senderJid);

      // Log to UI
      emitLog({
        time: new Date().toISOString(),
        sender: senderNum,
        text: text || "[non-text message]",
        allowed: isAllowed,
      });

      console.log(
        `[MSG] From: ${senderNum} | JID: ${senderJid} | Allowed: ${isAllowed} | SM list: [${config.subjectMatters.join(",")}] | Text: ${text}`
      );

      if (!isAllowed) {
        // Send rejection message
        await sock.sendMessage(senderJid, {
          text: config.rejectMessage,
        });
        continue;
      }

      // Subject matter → AI response or static welcome
      if (config.aiEnabled && config.aiApiUrl && text.trim()) {
        try {
          await sock.sendMessage(senderJid, { text: "⏳ _Memproses pertanyaan Anda..._" });
          const aiAnswer = await askAi(text, config, senderNum);
          await sock.sendMessage(senderJid, { text: aiAnswer });
        } catch (err) {
          console.error("[AI] Error:", err.message);
          await sock.sendMessage(senderJid, {
            text: "Maaf, sistem AI sedang bermasalah. Silakan coba lagi nanti.",
          });
        }
      } else {
        await sock.sendMessage(senderJid, {
          text: config.welcomeMessage,
        });
      }
    }
  });
}

// ─── Spam Broadcast ───────────────────────────────────────────────────────────
async function sendSpam(message) {
  if (!sock || connectionStatus !== "connected") {
    throw new Error("Bot tidak terhubung");
  }
  const config = getConfig();
  const results = [];

  for (const num of config.subjectMatters) {
    const jid = `${normalizeNumber(num)}@s.whatsapp.net`;
    try {
      await sock.sendMessage(jid, { text: message });
      results.push({ number: num, status: "sent" });
      // slight delay to avoid rate limiting
      await new Promise((r) => setTimeout(r, 500));
    } catch (err) {
      results.push({ number: num, status: "failed", error: err.message });
    }
  }

  emitLog({
    time: new Date().toISOString(),
    sender: "BOT (broadcast)",
    text: message,
    allowed: true,
    broadcast: true,
  });

  return results;
}

// ─── Logout ───────────────────────────────────────────────────────────────────
async function logout() {
  if (sock) {
    await sock.logout();
    sock = null;
  }
  fs.removeSync(AUTH_DIR);
  connectionStatus = "disconnected";
  qrCodeData = null;
  emitStatus();
}

// ─── Socket.IO emitters ───────────────────────────────────────────────────────
function emitStatus() {
  if (io) {
    io.emit("status", { status: connectionStatus });
  }
}

function emitQR() {
  if (io && qrCodeData) {
    io.emit("qr", { qr: qrCodeData });
  }
}

function emitLog(entry) {
  if (io) {
    io.emit("log", entry);
  }
}

// ─── AI API (EduQuery AI - Webhook) ──────────────────────────────────────
async function askAi(question, config, senderNum) {
  const baseUrl = config.aiApiUrl.replace(/\/+$/, "");

  const res = await fetch(`${baseUrl}/webhook/whatsapp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sender: senderNum,
      message: question,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`AI API error (${res.status}): ${errText}`);
  }

  const data = await res.json();
  return data.reply || JSON.stringify(data);
}

// ─── Refresh / Re-initiate Connection ───────────────────────────────────────
async function refreshConnection() {
  if (sock) {
    sock.end(undefined);
    sock = null;
  }
  fs.removeSync(AUTH_DIR);
  qrCodeData = null;
  connectionStatus = "disconnected";
  emitStatus();
  // small delay to let cleanup finish
  await new Promise((r) => setTimeout(r, 500));
  await startBot(io);
}

// ─── Exports ─────────────────────────────────────────────────────────────────
module.exports = {
  startBot,
  sendSpam,
  logout,
  refreshConnection,
  getStatus: () => ({ status: connectionStatus, qr: qrCodeData }),
  getConfig,
  updateConfig,
  BOT_NUMBER,
};
