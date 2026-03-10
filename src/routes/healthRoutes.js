const express = require("express");
const router = express.Router();
const whatsappController = require("../controllers/whatsappController");

// ─────────────────────────────────────────────
//  GET /api/health
//  Overall server + WhatsApp health check
// ─────────────────────────────────────────────
router.get("/", whatsappController.healthCheck);

module.exports = router;
