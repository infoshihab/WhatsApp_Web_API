const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode");
const logger = require("../config/logger");

// ─────────────────────────────────────────────
//  Singleton state
// ─────────────────────────────────────────────
let client = null;
let isReady = false;
let isInitializing = false;
let retryCount = 0;
let socketIo = null;
let latestQR = null; // { qrImage, qrString, generatedAt }

const MAX_RETRIES = parseInt(process.env.MAX_RETRIES) || 5;
const RETRY_DELAY = parseInt(process.env.RETRY_DELAY) || 5000;
const SESSION_PATH = process.env.SESSION_PATH || "./session";

// ─────────────────────────────────────────────
//  Inject Socket.IO instance
// ─────────────────────────────────────────────
const setSocketIo = (io) => {
  socketIo = io;
};

// ─────────────────────────────────────────────
//  Emit to all connected Socket.IO clients
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
  latestQR = null;

  logger.info("Initializing WhatsApp client...");

  client = new Client({
    authStrategy: new LocalAuth({ dataPath: SESSION_PATH }),
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

  // ── QR Code generated ─────────────────────
  client.on("qr", async (qr) => {
    logger.info("QR Code received. Waiting for scan...");
    retryCount = 0;

    try {
      const qrImage = await qrcode.toDataURL(qr);

      // Store latest QR for REST fallback endpoint
      latestQR = {
        qrImage,
        qrString: qr,
        generatedAt: new Date().toISOString(),
      };

      emitToClients("qr", { qrImage, qrString: qr });
      logger.info("QR Code emitted to Socket.IO clients.");
    } catch (err) {
      logger.error("Failed to generate QR image", { error: err.message });
    }
  });

  // ── Ready ─────────────────────────────────
  client.on("ready", () => {
    isReady = true;
    isInitializing = false;
    retryCount = 0;
    latestQR = null; // Clear QR — no longer needed

    logger.info("✅ WhatsApp client is READY!");
    emitToClients("whatsapp_status", {
      status: "ready",
      message: "WhatsApp connected successfully!",
    });
  });

  // ── Authenticated ─────────────────────────
  client.on("authenticated", () => {
    logger.info("✅ WhatsApp authenticated. Session saved.");
    emitToClients("whatsapp_status", {
      status: "authenticated",
      message: "Authentication successful!",
    });
  });

  // ── Auth Failure ──────────────────────────
  client.on("auth_failure", (msg) => {
    isReady = false;
    isInitializing = false;

    logger.error("❌ Authentication failed", { message: msg });
    emitToClients("whatsapp_status", {
      status: "auth_failure",
      message: "Authentication failed. Please restart and scan QR again.",
    });
  });

  // ── Disconnected ──────────────────────────
  client.on("disconnected", (reason) => {
    isReady = false;
    isInitializing = false;

    logger.warn("⚠️  WhatsApp disconnected", { reason });
    emitToClients("whatsapp_status", {
      status: "disconnected",
      message: `Disconnected: ${reason}`,
    });

    handleReconnect();
  });

  // ── Initialize ────────────────────────────
  client.initialize().catch((err) => {
    isInitializing = false;
    isReady = false;
    logger.error("Client initialization error", { error: err.message });
    handleReconnect();
  });
};

// ─────────────────────────────────────────────
//  Auto Reconnect with exponential backoff
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
  const delay = RETRY_DELAY * retryCount;

  logger.info(
    `Reconnecting in ${delay / 1000}s... (Attempt ${retryCount}/${MAX_RETRIES})`,
  );
  emitToClients("whatsapp_status", {
    status: "reconnecting",
    message: `Reconnecting... Attempt ${retryCount} of ${MAX_RETRIES}`,
  });

  setTimeout(() => {
    if (client) client.destroy().catch(() => {});
    initializeClient();
  }, delay);
};

// ─────────────────────────────────────────────
//  Manual Restart (called from controller)
// ─────────────────────────────────────────────
const restartClient = async () => {
  logger.info("Manual restart triggered.");
  isReady = false;
  isInitializing = false;
  retryCount = 0;
  latestQR = null;

  if (client) {
    await client.destroy().catch(() => {});
    client = null;
  }

  initializeClient();
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

  const formattedPhone = formatPhoneNumber(phone);
  logger.info("Sending message", { to: formattedPhone });

  // Verify number is on WhatsApp
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
};

// ─────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────
const formatPhoneNumber = (phone) => {
  const digits = phone.toString().replace(/\D/g, "");
  return `${digits}@c.us`;
};

const getStatus = () => {
  if (!client) return "not_initialized";
  if (isInitializing) return "initializing";
  if (isReady) return "ready";
  return "disconnected";
};

const isClientReady = () => isReady;

const getLatestQR = () => latestQR;

module.exports = {
  initializeClient,
  restartClient,
  sendMessage,
  getStatus,
  isClientReady,
  getLatestQR,
  setSocketIo,
};
