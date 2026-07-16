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
const { MetabaseAPI, askMetabase } = require("./metabase-api");

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
      aiEnabled: true,
      metabaseUrl: "http://172.16.9.210:3000",
      metabaseApiKey: "mb_6et6RIFVy7L6ScJFRakG3ZWG7HvknFZiFXTT+jQ0xLo=",
      llmUrl: "http://172.18.32.172:8080/v1",
      llmApiKey: "sk-placeholder",
      llmModel: "ornith-1.0-35b-Q6_K.gguf",
      registrationCode: "",
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

function normalizeSubjectMatters(list) {
  return list.map((sm) => {
    if (typeof sm === "string") return { number: sm, name: sm };
    return sm;
  });
}

function getConfig() {
  const cfg = loadConfig();
  cfg.subjectMatters = normalizeSubjectMatters(cfg.subjectMatters);
  return cfg;
}

function updateConfig(updates) {
  const current = getConfig();
  const merged = { ...current, ...updates };
  if (merged.subjectMatters) {
    merged.subjectMatters = normalizeSubjectMatters(merged.subjectMatters);
  }
  saveConfig(merged);
  return merged;
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
    (sm) => normalizeNumber(sm.number) === senderNum
  );
}

function getSubjectMatterName(senderJid) {
  const config = getConfig();
  const senderNum = normalizeNumber(extractUser(senderJid));
  const found = config.subjectMatters.find(
    (sm) => normalizeNumber(sm.number) === senderNum
  );
  return found ? found.name : senderNum;
}

// ─── Typing effect helper ────────────────────────────────────────────────────
function calcTypingDuration(text) {
  if (!text || text.length < 10) return 1500;
  // ~100ms per char, min 2s, max 15s, plus random jitter
  const ms = Math.min(Math.max(text.length * 100, 2000), 15000);
  return ms + Math.floor(Math.random() * 2000);
}

async function sendWithTyping(jid, text) {
  if (!sock) return;
  await sock.sendPresenceUpdate("composing", jid);
  const delay = calcTypingDuration(text);
  await new Promise((r) => setTimeout(r, delay));
  await sock.sendMessage(jid, { text });
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
      const trimmedText = text.trim();
      const regCode = config.registrationCode;
      const isCodeMatch = regCode && trimmedText === regCode;
      const isCodeWithName = regCode && trimmedText.startsWith(regCode + "-");

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

      // ── Feature 1: Auto-registration via code (format: kode-nama) ──
      if (isCodeMatch || isCodeWithName) {
        if (!isAllowed) {
          const name = isCodeWithName
            ? trimmedText.slice(regCode.length + 1).trim() || senderNum
            : senderNum;
          const newList = [...config.subjectMatters, { number: senderNum, name }];
          updateConfig({ subjectMatters: newList });
          const reply = `✅ Selamat datang, *${name}*! Anda berhasil terdaftar sebagai Subject Matter. Sekarang Anda bisa bertanya seputar data BP Batam.`;
          await sock.sendMessage(senderJid, { text: reply });
          console.log(`[REG] ${senderNum} registered as "${name}" via code`);
          emitLog({ time: new Date().toISOString(), sender: senderNum, text: `[REGISTRATION as "${name}"]`, allowed: true });
        } else {
          const existing = getSubjectMatterName(senderJid);
          await sock.sendMessage(senderJid, { text: `Nomor Anda (${existing}) sudah terdaftar sebagai Subject Matter.` });
        }
        continue;
      }

      if (!isAllowed) {
        await sock.sendMessage(senderJid, { text: config.rejectMessage });
        continue;
      }

      // ── Subject matter → Metabase + LLM or static welcome ──
      if (config.aiEnabled && config.metabaseUrl && text.trim()) {
        try {
          const mb = new MetabaseAPI(config.metabaseUrl, config.metabaseApiKey);
          const answer = await askMetabase(
            text,
            config.llmUrl,
            config.llmApiKey,
            config.llmModel,
            mb
          );
          await sendWithTyping(senderJid, answer);
        } catch (err) {
          console.error("[Metabase] Error:", err.message);
          await sock.sendMessage(senderJid, {
            text: "Maaf, data belum tersedia.",
          });
        }
      } else {
        await sendWithTyping(senderJid, config.welcomeMessage);
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

  for (const sm of config.subjectMatters) {
    const jid = `${normalizeNumber(sm.number)}@s.whatsapp.net`;
    try {
      await sock.sendMessage(jid, { text: message });
      results.push({ number: sm.number, name: sm.name, status: "sent" });
      // slight delay to avoid rate limiting
      await new Promise((r) => setTimeout(r, 500));
    } catch (err) {
      results.push({ number: sm.number, name: sm.name, status: "failed", error: err.message });
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
  normalizeSubjectMatters,
  BOT_NUMBER,
};
