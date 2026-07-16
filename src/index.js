const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const bodyParser = require("body-parser");
const path = require("path");
const bot = require("./bot");

const PORT = 3002;

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
});

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "../public")));

// ─── API Routes ───────────────────────────────────────────────────────────────

// Status
app.get("/api/status", (req, res) => {
  res.json(bot.getStatus());
});

// Config
app.get("/api/config", (req, res) => {
  res.json(bot.getConfig());
});

app.put("/api/config", (req, res) => {
  try {
    const updated = bot.updateConfig(req.body);
    res.json({ success: true, config: updated });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Subject Matters
app.get("/api/subject-matters", (req, res) => {
  const config = bot.getConfig();
  res.json({ subjectMatters: config.subjectMatters });
});

app.post("/api/subject-matters", (req, res) => {
  const { number, name } = req.body;
  if (!number) return res.status(400).json({ error: "Nomor wajib diisi" });

  const config = bot.getConfig();
  const clean = number.replace(/\D/g, "");
  if (config.subjectMatters.some((sm) => sm.number.replace(/\D/g, "") === clean)) {
    return res.status(409).json({ error: "Nomor sudah terdaftar" });
  }
  config.subjectMatters.push({ number: clean, name: name || clean });
  bot.updateConfig({ subjectMatters: config.subjectMatters });
  res.json({ success: true, subjectMatters: config.subjectMatters });
});

app.delete("/api/subject-matters/:number", (req, res) => {
  const num = req.params.number.replace(/\D/g, "");
  const config = bot.getConfig();
  config.subjectMatters = config.subjectMatters.filter(
    (sm) => sm.number.replace(/\D/g, "") !== num
  );
  bot.updateConfig({ subjectMatters: config.subjectMatters });
  res.json({ success: true, subjectMatters: config.subjectMatters });
});

// Broadcast / Spam
app.post("/api/broadcast", async (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: "Pesan wajib diisi" });

  try {
    const results = await bot.sendSpam(message);
    res.json({ success: true, results });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Refresh QR (force regenerate QR when disconnected)
app.post("/api/refresh", async (req, res) => {
  try {
    await bot.refreshConnection();
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Logout
app.post("/api/logout", async (req, res) => {
  try {
    await bot.logout();
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ─── Socket.IO ────────────────────────────────────────────────────────────────
io.on("connection", (socket) => {
  console.log("[WS] Client connected:", socket.id);

  // Send current status & QR on connect
  const st = bot.getStatus();
  socket.emit("status", { status: st.status });
  if (st.qr) socket.emit("qr", { qr: st.qr });

  socket.on("disconnect", () => {
    console.log("[WS] Client disconnected:", socket.id);
  });
});

// ─── Start ────────────────────────────────────────────────────────────────────
server.listen(PORT, () => {
  console.log(`[SERVER] Web UI running at http://localhost:${PORT}`);
  bot.startBot(io);
});
