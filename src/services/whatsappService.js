const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode");
const logger = require("../config/logger");

// ─────────────────────────────────────────────
//  Singleton: only one WhatsApp client instance
// ─────────────────────────────────────────────
let client = null;
let isReady = false;
let isInitializing = false;
let retryCount = 0;
let socketIo = null; // Will be injected from socketHandler

const MAX_RETRIES = parseInt(process.env.MAX_RETRIES) || 5;
const RETRY_DELAY = parseInt(process.env.RETRY_DELAY) || 5000;
const SESSION_PATH = process.env.SESSION_PATH || "./session";

// ─────────────────────────────────────────────
//  Inject Socket.IO instance (called from app.js)
// ─────────────────────────────────────────────
const setSocketIo = (io) => {
  socketIo = io;
};

// ─────────────────────────────────────────────
//  Emit event to all connected socket clients
// ─────────────────────────────────────────────
const emitToClients = (event, data) => {
  if (socketIo) {
    socketIo.emit(event, data);
  }
};

// ─────────────────────────────────────────────
//  Initialize WhatsApp Client
// ─────────────────────────────────────────────
const initializeClient = () => {
  if (isInitializing) {
    logger.warn("WhatsApp client is already initializing.");
    return;
  }

  isInitializing = true;
  isReady = false;

  logger.info("Initializing WhatsApp client...");

  client = new Client({
    // LocalAuth saves session to disk so re-auth is not needed after restart
    authStrategy: new LocalAuth({
      dataPath: SESSION_PATH,
    }),
    puppeteer: {
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-accelerated-2d-canvas",
        "--no-first-run",
        "--no-zygote",
        "--disable-gpu",
      ],
    },
  });

  // ── EVENT: QR Code generated ──────────────────
  client.on("qr", async (qr) => {
    logger.info("QR Code received. Waiting for scan...");
    retryCount = 0;

    try {
      // Convert raw QR string to base64 PNG image
      const qrImage = await qrcode.toDataURL(qr);
      emitToClients("qr", { qrImage, qrString: qr });
      logger.info("QR Code emitted to connected clients via Socket.IO");
    } catch (err) {
      logger.error("Failed to generate QR image", { error: err.message });
    }
  });

  // ── EVENT: Client is ready ─────────────────────
  client.on("ready", () => {
    isReady = true;
    isInitializing = false;
    retryCount = 0;
    logger.info("✅ WhatsApp client is READY!");
    emitToClients("whatsapp_status", {
      status: "ready",
      message: "WhatsApp connected successfully!",
    });
  });

  // ── EVENT: Authenticated ───────────────────────
  client.on("authenticated", () => {
    logger.info("✅ WhatsApp authenticated. Session saved.");
    emitToClients("whatsapp_status", {
      status: "authenticated",
      message: "Authentication successful!",
    });
  });

  // ── EVENT: Authentication failed ──────────────
  client.on("auth_failure", (msg) => {
    isReady = false;
    isInitializing = false;
    logger.error("❌ Authentication failed", { message: msg });
    emitToClients("whatsapp_status", {
      status: "auth_failure",
      message: "Authentication failed. Please restart and scan QR again.",
    });
  });

  // ── EVENT: Disconnected ────────────────────────
  client.on("disconnected", (reason) => {
    isReady = false;
    isInitializing = false;
    logger.warn("⚠️  WhatsApp disconnected", { reason });
    emitToClients("whatsapp_status", {
      status: "disconnected",
      message: `Disconnected: ${reason}`,
    });

    // Auto-reconnect logic
    handleReconnect();
  });

  // ── Initialize the client ──────────────────────
  client.initialize().catch((err) => {
    isInitializing = false;
    isReady = false;
    logger.error("Client initialization error", { error: err.message });
    handleReconnect();
  });
};

// ─────────────────────────────────────────────
//  Auto Reconnect Handler
// ─────────────────────────────────────────────
const handleReconnect = () => {
  if (retryCount >= MAX_RETRIES) {
    logger.error(`Max retry attempts (${MAX_RETRIES}) reached. Giving up.`);
    emitToClients("whatsapp_status", {
      status: "failed",
      message: "Max reconnection attempts reached. Please restart the server.",
    });
    return;
  }

  retryCount++;
  const delay = RETRY_DELAY * retryCount; // exponential-style backoff

  logger.info(
    `Reconnecting in ${delay / 1000}s... (Attempt ${retryCount}/${MAX_RETRIES})`,
  );

  emitToClients("whatsapp_status", {
    status: "reconnecting",
    message: `Reconnecting... Attempt ${retryCount} of ${MAX_RETRIES}`,
  });

  setTimeout(() => {
    // Destroy old client before creating new one
    if (client) {
      client.destroy().catch(() => {});
    }
    initializeClient();
  }, delay);
};

// ─────────────────────────────────────────────
//  Send a WhatsApp Message
// ─────────────────────────────────────────────
const sendMessage = async (phone, message) => {
  if (!isReady || !client) {
    throw new Error(
      "WhatsApp client is not ready. Please scan the QR code first.",
    );
  }

  // Format phone number: remove +, spaces, dashes
  // whatsapp-web.js needs format: 8801XXXXXXXXX@c.us
  const formattedPhone = formatPhoneNumber(phone);

  logger.info("Sending message", { to: formattedPhone });

  try {
    // Check if number exists on WhatsApp
    const isRegistered = await client.isRegisteredUser(formattedPhone);
    if (!isRegistered) {
      throw new Error(`Phone number ${phone} is not registered on WhatsApp.`);
    }

    const response = await client.sendMessage(formattedPhone, message);

    logger.info("Message sent successfully", {
      to: phone,
      messageId: response.id._serialized,
    });

    return {
      messageId: response.id._serialized,
      to: phone,
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    logger.error("Failed to send message", { to: phone, error: err.message });
    throw err;
  }
};

// ─────────────────────────────────────────────
//  Format phone number for WhatsApp
// ─────────────────────────────────────────────
const formatPhoneNumber = (phone) => {
  // Remove all non-digit characters
  const digits = phone.toString().replace(/\D/g, "");
  return `${digits}@c.us`;
};

// ─────────────────────────────────────────────
//  Get current connection status
// ─────────────────────────────────────────────
const getStatus = () => {
  if (!client) return "not_initialized";
  if (isInitializing) return "initializing";
  if (isReady) return "ready";
  return "disconnected";
};

const isClientReady = () => isReady;

module.exports = {
  initializeClient,
  sendMessage,
  getStatus,
  isClientReady,
  setSocketIo,
};
