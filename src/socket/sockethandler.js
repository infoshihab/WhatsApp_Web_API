const { Server } = require("socket.io");
const logger = require("../config/logger");
const whatsappService = require("../services/whatsappService");

// ─────────────────────────────────────────────
//  Initialize Socket.IO and handle connections
// ─────────────────────────────────────────────
const initializeSocket = (httpServer) => {
  const io = new Server(httpServer, {
    cors: {
      origin: "*", // In production, restrict to your frontend domain
      methods: ["GET", "POST"],
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // Inject io into whatsappService so it can emit events
  whatsappService.setSocketIo(io);

  io.on("connection", (socket) => {
    logger.info("New Socket.IO client connected", { socketId: socket.id });

    // Send current WhatsApp status immediately on connect
    const currentStatus = whatsappService.getStatus();
    socket.emit("whatsapp_status", {
      status: currentStatus,
      message: `Current status: ${currentStatus}`,
    });

    // ── Client requests current status ──────────
    socket.on("get_status", () => {
      const status = whatsappService.getStatus();
      socket.emit("whatsapp_status", { status });
    });

    // ── Client disconnected ──────────────────────
    socket.on("disconnect", (reason) => {
      logger.info("Socket.IO client disconnected", {
        socketId: socket.id,
        reason,
      });
    });
  });

  logger.info("Socket.IO initialized successfully.");
  return io;
};

module.exports = { initializeSocket };
