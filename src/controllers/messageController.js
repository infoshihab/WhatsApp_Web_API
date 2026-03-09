const messageQueue = require("../queue/messageQueue");
const whatsappService = require("../services/whatsappService");
const logger = require("../config/logger");

// ─────────────────────────────────────────────
//  POST /api/message/send
//  Send a WhatsApp message (queued)
// ─────────────────────────────────────────────
const sendMessage = async (req, res) => {
  const { phone, message } = req.body;

  logger.info("Send message request received", { phone });

  // Check WhatsApp connection before queuing
  if (!whatsappService.isClientReady()) {
    return res.status(503).json({
      success: false,
      error: "WhatsApp client is not ready.",
      hint: "Please scan the QR code first via the /api/whatsapp/qr endpoint or Socket.IO.",
    });
  }

  // Add to queue and get job ID
  const jobId = messageQueue.addToQueue(phone, message);

  return res.status(202).json({
    success: true,
    message: "Message queued successfully.",
    data: {
      jobId,
      phone,
      status: "queued",
      queuedAt: new Date().toISOString(),
    },
  });
};

// ─────────────────────────────────────────────
//  GET /api/message/status/:jobId
//  Check status of a queued message
// ─────────────────────────────────────────────
const getMessageStatus = async (req, res) => {
  const { jobId } = req.params;

  const job = messageQueue.getJobStatus(jobId);

  if (!job) {
    return res.status(404).json({
      success: false,
      error: "Job not found.",
      jobId,
    });
  }

  return res.status(200).json({
    success: true,
    data: job,
  });
};

// ─────────────────────────────────────────────
//  GET /api/message/queue/stats
//  Get queue statistics
// ─────────────────────────────────────────────
const getQueueStats = async (req, res) => {
  const stats = messageQueue.getQueueStats();

  return res.status(200).json({
    success: true,
    data: stats,
  });
};

module.exports = {
  sendMessage,
  getMessageStatus,
  getQueueStats,
};
