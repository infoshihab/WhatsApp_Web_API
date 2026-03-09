const logger = require("../config/logger");

// ─────────────────────────────────────────────
//  404 Handler — Route not found
// ─────────────────────────────────────────────
const notFoundHandler = (req, res, next) => {
  logger.warn("Route not found", { method: req.method, path: req.path });

  res.status(404).json({
    success: false,
    error: "Route not found.",
    path: req.originalUrl,
  });
};

// ─────────────────────────────────────────────
//  Global Error Handler
//  Catches all errors thrown in controllers/services
// ─────────────────────────────────────────────
const globalErrorHandler = (err, req, res, next) => {
  // Log the full error
  logger.error("Unhandled error", {
    message: err.message,
    stack: err.stack,
    method: req.method,
    path: req.path,
    ip: req.ip,
  });

  // Determine status code
  const statusCode = err.statusCode || err.status || 500;

  // Build error response
  const response = {
    success: false,
    error: err.message || "Internal server error.",
  };

  // Show stack trace in development only
  if (process.env.NODE_ENV === "development") {
    response.stack = err.stack;
  }

  return res.status(statusCode).json(response);
};

module.exports = {
  notFoundHandler,
  globalErrorHandler,
};
