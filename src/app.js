require("dotenv").config();
require("express-async-errors");

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const path = require("path");

const logger = require("./config/logger");
const { generalLimiter } = require("./middlewares/rateLimiter");
const {
  notFoundHandler,
  globalErrorHandler,
} = require("./middlewares/errorHandler");

const healthRoutes = require("./routes/healthRoutes");
const whatsappRoutes = require("./routes/whatsappRoutes");
const messageRoutes = require("./routes/messageRoutes");

const app = express();

// ── Security ───────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());

// ── Parsing ────────────────────────────────────
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true }));

// ── Logging ────────────────────────────────────
app.use(
  morgan("combined", {
    stream: { write: (msg) => logger.http(msg.trim()) },
  }),
);

// ── Rate limiting ──────────────────────────────
app.use("/api", generalLimiter);

// ── API Routes ─────────────────────────────────
app.use("/api/health", healthRoutes);
app.use("/api/whatsapp", whatsappRoutes);
app.use("/api/message", messageRoutes);

// ── Static files — NO cache (dev) ─────────────
// This ensures browser always gets latest client.html
app.use(
  express.static(path.join(__dirname, "../public"), {
    etag: false,
    lastModified: false,
    setHeaders: (res) => {
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
    },
  }),
);

// ── Explicit route for client.html ─────────────
app.get("/client.html", (req, res) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.sendFile(path.join(__dirname, "../public/client.html"));
});

// ── Root ───────────────────────────────────────
app.get("/", (req, res) => {
  res.json({
    name: "WhatsApp Backend API",
    version: "1.0.0",
    status: "running",
    qrPage: "http://localhost:3000/client.html",
    docs: {
      health: "GET  /api/health",
      whatsappStatus: "GET  /api/whatsapp/status",
      whatsappQR: "GET  /api/whatsapp/qr",
      sendMessage: "POST /api/message/send",
      messageStatus: "GET  /api/message/status/:jobId",
      queueStats: "GET  /api/message/queue/stats",
    },
  });
});

// ── Error handling (must be last) ──────────────
app.use(notFoundHandler);
app.use(globalErrorHandler);

module.exports = app;
