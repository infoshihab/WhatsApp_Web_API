## Project Structure
```
whatsapp-backend/
├── server.js                         ← Entry point
├── src/
│   ├── app.js                        ← Express setup
│   ├── config/logger.js              ← Logging
│   ├── controllers/
│   │   ├── messageController.js      ← Message logic
│   │   └── whatsappController.js     ← WA status logic
│   ├── services/whatsappService.js   ← Core WhatsApp
│   ├── routes/
│   │   ├── healthRoutes.js
│   │   ├── whatsappRoutes.js
│   │   └── messageRoutes.js
│   ├── socket/socketHandler.js       ← Real-time QR
│   ├── middlewares/
│   │   ├── validator.js              ← Request validation
│   │   ├── rateLimiter.js            ← Rate limiting
│   │   └── errorHandler.js           ← Error handling
│   └── queue/messageQueue.js         ← Concurrency
├── public/client.html                ← QR scan page
└── .env                              ← Config
```

## Setup & Run
```bash
npm install
npm run dev
```

## QR Authentication
Open `http://localhost:3000/client.html` and scan the QR code with your phone.
WhatsApp → Linked Devices → Link a Device → Scan.
Terminal will show `✅ WhatsApp client is READY!` on success.

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Server health check |
| GET | `/api/whatsapp/status` | WhatsApp connection status |
| GET | `/api/whatsapp/qr` | Get QR code (REST fallback) |
| POST | `/api/whatsapp/restart` | Restart WhatsApp client |
| POST | `/api/message/send` | Send a WhatsApp message |
| GET | `/api/message/status/:jobId` | Check message delivery status |
| GET | `/api/message/queue/stats` | View queue statistics |

### Send Message — Request Body
```json
{
  "phone": "8801XXXXXXXXX",
  "message": "Hello!"
}
```
> Phone number must be digits only, no `+`, no spaces. Example: `8801712345678`

### Send Message — Response
```json
{
  "success": true,
  "message": "Message queued successfully.",
  "data": {
    "jobId": "uuid-here",
    "status": "queued"
  }
}
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `SESSION_PATH` | `./session` | WhatsApp session storage path |
| `RATE_LIMIT_WINDOW` | `15` | Rate limit window in minutes |
| `RATE_LIMIT_MAX` | `100` | Max requests per window |
| `MAX_RETRIES` | `5` | Max reconnection attempts |
| `RETRY_DELAY` | `5000` | Delay between retries in ms |
| `QUEUE_CONCURRENCY` | `5` | Max concurrent message workers |
| `MESSAGE_DELAY` | `1000` | Delay between messages in ms |
| `LOG_LEVEL` | `info` | Logging level |

## Session Persistence
Once authenticated, session is saved in `./session` folder. Server restart will not require re-scanning.
To force re-authentication:
```bash
rm -rf ./session
```
