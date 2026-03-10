const whatsappService = require("../services/whatsappService");
const logger = require("../config/logger");

// ─────────────────────────────────────────────
//  GET /api/whatsapp/status
//  Returns current WhatsApp connection status
// ─────────────────────────────────────────────
const getStatus = async (req, res) => {
  const status = whatsappService.getStatus();

  const statusMessages = {
    not_initialized: "WhatsApp client has not been initialized yet.",
    initializing: "WhatsApp client is initializing. Please wait...",
    ready: "WhatsApp is connected and ready to send messages.",
    disconnected: "WhatsApp is disconnected. Attempting to reconnect...",
  };

  const httpStatus = status === "ready" ? 200 : 503;

  return res.status(httpStatus).json({
    success: status === "ready",
    data: {
      status,
      message: statusMessages[status] || "Unknown status.",
      timestamp: new Date().toISOString(),
    },
  });
};

// ─────────────────────────────────────────────
//  GET /api/whatsapp/qr
//  Returns the latest QR code as base64 image
//  (REST fallback — Socket.IO is preferred)
// ─────────────────────────────────────────────
const getQR = async (req, res) => {
  const qrData = whatsappService.getLatestQR();

  if (!qrData) {
    const status = whatsappService.getStatus();

    // If already connected, no QR needed
    if (status === "ready") {
      return res.status(200).json({
        success: true,
        data: {
          qrAvailable: false,
          message: "WhatsApp is already connected. No QR needed.",
          status,
        },
      });
    }

    return res.status(404).json({
      success: false,
      error: "QR code not yet generated. Please wait and try again.",
      hint: "Connect via Socket.IO at ws://localhost:3000 for real-time QR.",
    });
  }

  return res.status(200).json({
    success: true,
    data: {
      qrAvailable: true,
      qrImage: qrData.qrImage, // base64 PNG — use as <img src="...">
      qrString: qrData.qrString, // raw string — use with any QR library
      generatedAt: qrData.generatedAt,
    },
  });
};

// ─────────────────────────────────────────────
//  POST /api/whatsapp/restart
//  Force restart the WhatsApp client
// ─────────────────────────────────────────────
const restartClient = async (req, res) => {
  logger.info("Manual WhatsApp client restart requested via API.");

  try {
    await whatsappService.restartClient();

    return res.status(200).json({
      success: true,
      message: "WhatsApp client is restarting. Please watch for a new QR code.",
    });
  } catch (err) {
    logger.error("Failed to restart WhatsApp client", { error: err.message });
    return res.status(500).json({
      success: false,
      error: "Failed to restart WhatsApp client.",
      details: err.message,
    });
  }
};

// ─────────────────────────────────────────────
//  GET /api/health
//  General server + WhatsApp health check
// ─────────────────────────────────────────────
const healthCheck = async (req, res) => {
  const whatsappStatus = whatsappService.getStatus();

  return res.status(200).json({
    success: true,
    data: {
      server: "running",
      whatsapp: whatsappStatus,
      uptime: `${Math.floor(process.uptime())}s`,
      memory: {
        used: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
        total: `${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)}MB`,
      },
      timestamp: new Date().toISOString(),
    },
  });
};

module.exports = {
  getStatus,
  getQR,
  restartClient,
  healthCheck,
};
