const express = require("express");
const router = express.Router();
const whatsappController = require("../controllers/whatsappController");

// ─────────────────────────────────────────────
//  GET /api/whatsapp/status
//  Check WhatsApp connection status
// ─────────────────────────────────────────────
router.get("/status", whatsappController.getStatus);

// ─────────────────────────────────────────────
//  GET /api/whatsapp/qr
//  Get current QR code as base64 image (REST fallback)
//  Use Socket.IO for real-time QR — this is just a fallback
// ─────────────────────────────────────────────
router.get("/qr", whatsappController.getQR);

// ─────────────────────────────────────────────
//  POST /api/whatsapp/restart
//  Force restart the WhatsApp client
// ─────────────────────────────────────────────
router.post("/restart", whatsappController.restartClient);

module.exports = router;
