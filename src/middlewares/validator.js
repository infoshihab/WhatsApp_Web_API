const Joi = require("joi");
const logger = require("../config/logger");

// ─────────────────────────────────────────────
//  Validation schema for sending a message
// ─────────────────────────────────────────────
const sendMessageSchema = Joi.object({
  phone: Joi.string()
    .pattern(/^[0-9]{7,15}$/)
    .required()
    .messages({
      "string.pattern.base":
        "Phone number must contain only digits and be 7–15 characters long. Example: 8801XXXXXXXXX",
      "any.required": "Phone number is required.",
    }),

  message: Joi.string().min(1).max(4096).required().messages({
    "string.min": "Message cannot be empty.",
    "string.max": "Message cannot exceed 4096 characters.",
    "any.required": "Message is required.",
  }),
});

// ─────────────────────────────────────────────
//  Middleware: Validate send message request
// ─────────────────────────────────────────────
const validateSendMessage = (req, res, next) => {
  const { error, value } = sendMessageSchema.validate(req.body, {
    abortEarly: false, // Return ALL validation errors at once
    stripUnknown: true, // Remove unknown fields
  });

  if (error) {
    const errors = error.details.map((d) => ({
      field: d.path[0],
      message: d.message,
    }));

    logger.warn("Validation failed for send message request", { errors });

    return res.status(400).json({
      success: false,
      error: "Validation failed.",
      details: errors,
    });
  }

  // Replace req.body with validated & sanitized value
  req.body = value;
  next();
};

module.exports = {
  validateSendMessage,
};
