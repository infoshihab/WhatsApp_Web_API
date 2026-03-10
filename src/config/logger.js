const { createLogger, format, transports, addColors } = require("winston");
const path = require("path");
const fs = require("fs");

// Ensure logs directory exists
const logDir = process.env.LOG_DIR || "./logs";
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// ── Add custom 'http' level ────────────────────
const customLevels = {
  levels: { error: 0, warn: 1, info: 2, http: 3, debug: 4 },
  colors: {
    error: "red",
    warn: "yellow",
    info: "green",
    http: "magenta",
    debug: "white",
  },
};
addColors(customLevels.colors);

// ── Console format (colorized) ─────────────────
const consoleFormat = format.combine(
  format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  format.colorize({ all: true }),
  format.errors({ stack: true }),
  format.printf(({ timestamp, level, message, stack, ...meta }) => {
    let log = `[${timestamp}] [${level}]: ${message}`;
    if (Object.keys(meta).length > 0) log += ` | ${JSON.stringify(meta)}`;
    if (stack) log += `\n${stack}`;
    return log;
  }),
);

// ── File format (JSON) ─────────────────────────
const fileFormat = format.combine(
  format.timestamp(),
  format.errors({ stack: true }),
  format.json(),
);

const logger = createLogger({
  levels: customLevels.levels,
  level: process.env.LOG_LEVEL || "http", // capture http logs too
  transports: [
    // Console — colorized
    new transports.Console({ format: consoleFormat }),

    // File — all logs
    new transports.File({
      filename: path.join(logDir, "app.log"),
      format: fileFormat,
      maxsize: 5 * 1024 * 1024, // 5MB
      maxFiles: 5,
    }),

    // File — errors only
    new transports.File({
      filename: path.join(logDir, "error.log"),
      level: "error",
      format: fileFormat,
      maxsize: 5 * 1024 * 1024,
      maxFiles: 5,
    }),
  ],
});

module.exports = logger;
