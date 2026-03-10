require("dotenv").config();
require("express-async-errors");

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const path = require("path");

const logger = require("./config/logger.js");
const { generalLimiter } = require("./middlewares/rateLimiter.js");
const {
  notFoundHandler,
  globalErrorHandler,
} = require("./middlewares/errorHandler.js");

// ── Route imports ──────────────────────────────
const healthRoutes = require("./routes/healthRoutes.js");
const whatsappRoutes = require("./routes/whatsappRoutes.js");
const messageRoutes = require("./routes/messageRoutes.js");

const app = express();

// ─────────────────────────────────────────────
//  Security Middlewares
// ─────────────────────────────────────────────
app.use(helmet()); // Adds security headers
app.use(cors()); // Allow cross-origin requests

// ─────────────────────────────────────────────
//  Request Parsing
// ─────────────────────────────────────────────
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true }));

// ─────────────────────────────────────────────
//  HTTP Request Logging (Morgan → Winston)
// ─────────────────────────────────────────────
app.use(
  morgan("combined", {
    stream: {
      write: (message) => logger.http(message.trim()),
    },
  }),
);

// ─────────────────────────────────────────────
//  Global Rate Limiting
// ─────────────────────────────────────────────
app.use("/api", generalLimiter);

// ─────────────────────────────────────────────
//  API Routes
// ─────────────────────────────────────────────
app.use("/api/health", healthRoutes);
app.use("/api/whatsapp", whatsappRoutes);
app.use("/api/message", messageRoutes);

// ─────────────────────────────────────────────
//  Serve static QR viewer page
// ─────────────────────────────────────────────
app.use(express.static(path.join(__dirname, "../public")));
app.get("/client.html", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/client.html"));
});

// ─────────────────────────────────────────────
//  Root route — basic info
// ─────────────────────────────────────────────
app.get("/", (req, res) => {
  res.json({
    name: "WhatsApp Backend API",
    version: "1.0.0",
    status: "running",
    docs: {
      health: "GET  /api/health",
      whatsappStatus: "GET  /api/whatsapp/status",
      sendMessage: "POST /api/message/send",
      messageStatus: "GET  /api/message/status/:jobId",
      queueStats: "GET  /api/message/queue/stats",
    },
  });
});

// ─────────────────────────────────────────────
//  Error Handling (must be last)
// ─────────────────────────────────────────────
app.use(notFoundHandler);
app.use(globalErrorHandler);

module.exports = app;
