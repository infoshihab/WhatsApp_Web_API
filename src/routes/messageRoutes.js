const express = require("express");
const router = express.Router();
const messageController = require("../controllers/messageController");
const { validateSendMessage } = require("../middlewares/validator");
const { messageLimiter } = require("../middlewares/rateLimiter");

// ─────────────────────────────────────────────
//  POST /api/message/send
//  Validate → Rate limit → Queue → Send
// ─────────────────────────────────────────────
router.post(
  "/send",
  messageLimiter, // 1. Rate limit check
  validateSendMessage, // 2. Validate request body
  messageController.sendMessage, // 3. Queue and send
);

// ─────────────────────────────────────────────
//  GET /api/message/status/:jobId
//  Check delivery status of a queued message
// ─────────────────────────────────────────────
router.get("/status/:jobId", messageController.getMessageStatus);

// ─────────────────────────────────────────────
//  GET /api/message/queue/stats
//  View current queue statistics
// ─────────────────────────────────────────────
router.get("/queue/stats", messageController.getQueueStats);

module.exports = router;
