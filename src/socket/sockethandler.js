const { Server } = require("socket.io");
const logger = require("../config/logger");
const whatsappService = require("../services/whatsappService");

// ─────────────────────────────────────────────
//  Initialize Socket.IO
// ─────────────────────────────────────────────
const initializeSocket = (httpServer) => {
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // Inject io into whatsappService so it can emit events
  whatsappService.setSocketIo(io);

  io.on("connection", (socket) => {
    logger.info("New Socket.IO client connected", { socketId: socket.id });

    // ── Send current status immediately on connect ──
    const currentStatus = whatsappService.getStatus();
    socket.emit("whatsapp_status", {
      status: currentStatus,
      message: `Current status: ${currentStatus}`,
    });

    // ── KEY FIX: If QR already generated, send it immediately ──
    // This handles the case where browser connects AFTER QR was emitted
    const latestQR = whatsappService.getLatestQR();
    if (latestQR) {
      logger.info("Sending cached QR to newly connected client", {
        socketId: socket.id,
      });
      socket.emit("qr", {
        qrImage: latestQR.qrImage,
        qrString: latestQR.qrString,
      });
    }

    // ── Client requests current status ──────────
    socket.on("get_status", () => {
      const status = whatsappService.getStatus();
      socket.emit("whatsapp_status", {
        status,
        message: `Current status: ${status}`,
      });

      // Also resend QR if available
      const qr = whatsappService.getLatestQR();
      if (qr) {
        socket.emit("qr", { qrImage: qr.qrImage, qrString: qr.qrString });
      }
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
