require("dotenv").config();

const http = require("http");
const app = require("./src/app");
const { initializeSocket } = require("./src/socket/sockethandler.js");
const { initializeClient } = require("./src/services/whatsappService.js");
const logger = require("./src/config/logger.js");

const PORT = process.env.PORT || 3000;

// ─────────────────────────────────────────────
//  Create HTTP server from Express app
// ─────────────────────────────────────────────
const httpServer = http.createServer(app);

// ─────────────────────────────────────────────
//  Attach Socket.IO to HTTP server
// ─────────────────────────────────────────────
initializeSocket(httpServer);

// ─────────────────────────────────────────────
//  Start server
// ─────────────────────────────────────────────
httpServer.listen(PORT, () => {
  logger.info(`🚀 Server running on http://localhost:${PORT}`);
  logger.info(`📡 Socket.IO ready for real-time QR events`);
  logger.info(`🌍 Environment: ${process.env.NODE_ENV || "development"}`);

  // ── Initialize WhatsApp client after server starts ──
  logger.info("Starting WhatsApp client...");
  initializeClient();
});

// ─────────────────────────────────────────────
//  Graceful Shutdown
// ─────────────────────────────────────────────
const gracefulShutdown = (signal) => {
  logger.info(`${signal} received. Shutting down gracefully...`);

  httpServer.close(() => {
    logger.info("HTTP server closed.");
    process.exit(0);
  });

  // Force exit after 10s if graceful shutdown fails
  setTimeout(() => {
    logger.error("Forced shutdown after timeout.");
    process.exit(1);
  }, 10000);
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// ─────────────────────────────────────────────
//  Unhandled Errors
// ─────────────────────────────────────────────
process.on("uncaughtException", (err) => {
  logger.error("Uncaught Exception", { error: err.message, stack: err.stack });
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  logger.error("Unhandled Promise Rejection", { reason });
  process.exit(1);
});
