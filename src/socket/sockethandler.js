const { Server } = require("socket.io");
const logger = require("../config/logger");
const whatsappService = require("../services/whatsappService");

const initializeSocket = (httpServer) => {
  const io = new Server(httpServer, {
    cors: { origin: "*", methods: ["GET", "POST"] },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  whatsappService.setSocketIo(io);

  io.on("connection", (socket) => {
    logger.info("✅ Socket.IO client connected", { socketId: socket.id });

    // 1. Send current WhatsApp status immediately
    const status = whatsappService.getStatus();
    socket.emit("whatsapp_status", { status, message: `Status: ${status}` });
    logger.info(`Sent status '${status}' to client ${socket.id}`);

    // 2. If QR already in memory → send it after short delay
    const latestQR = whatsappService.getLatestQR();
    if (latestQR) {
      logger.info(`Sending cached QR to client ${socket.id}`);
      setTimeout(() => {
        socket.emit("qr", {
          qrImage: latestQR.qrImage,
          qrString: latestQR.qrString,
        });
      }, 800);
    } else {
      logger.info(`No cached QR available for client ${socket.id}`);
    }

    // 3. Client manually requests refresh
    socket.on("get_status", () => {
      logger.info(`get_status requested by ${socket.id}`);
      const s = whatsappService.getStatus();
      socket.emit("whatsapp_status", { status: s, message: `Status: ${s}` });

      const qr = whatsappService.getLatestQR();
      if (qr) {
        socket.emit("qr", { qrImage: qr.qrImage, qrString: qr.qrString });
        logger.info(`Sent cached QR on get_status to ${socket.id}`);
      }
    });

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
