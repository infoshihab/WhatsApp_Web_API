const rateLimit = require("express-rate-limit");
const logger = require("../config/logger");

// ─────────────────────────────────────────────
//  General API rate limiter
//  Applied to all /api/* routes
// ─────────────────────────────────────────────
const generalLimiter = rateLimit({
  windowMs: (parseInt(process.env.RATE_LIMIT_WINDOW) || 15) * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX) || 100,
  standardHeaders: true, // Return rate limit info in headers
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn("Rate limit exceeded", {
      ip: req.ip,
      path: req.path,
    });

    return res.status(429).json({
      success: false,
      error: "Too many requests. Please try again later.",
      retryAfter: Math.ceil(
        (parseInt(process.env.RATE_LIMIT_WINDOW) || 15) * 60,
      ),
    });
  },
});

// ─────────────────────────────────────────────
//  Strict rate limiter for message sending
//  More aggressive limit to prevent spam
// ─────────────────────────────────────────────
const messageLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute window
  max: 20, // max 20 messages per minute
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn("Message rate limit exceeded", {
      ip: req.ip,
      phone: req.body?.phone,
    });

    return res.status(429).json({
      success: false,
      error: "Message sending rate limit exceeded. Max 20 messages per minute.",
      retryAfter: 60,
    });
  },
});

module.exports = {
  generalLimiter,
  messageLimiter,
};
