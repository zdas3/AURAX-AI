import express from 'express';
import dotenv from 'dotenv';

dotenv.config();
const router = express.Router();

// Mock in-memory alerts log
let alertsLog = [
  { id: "ALT_0", timestamp: new Date(Date.now() - 3600000).toISOString(), type: "Liquidity Sweep", message: "Bullish Liquidity Sweep (SSL) detected at $1997.50 on 15m chart. Price rejecting strongly.", confidence: 82 },
  { id: "ALT_1", timestamp: new Date(Date.now() - 7200000).toISOString(), type: "Strong News Impact", message: "High Impact News Alert: Dovish FOMC rate statements released. Gold price surging.", confidence: 75 },
  { id: "ALT_2", timestamp: new Date(Date.now() - 10800000).toISOString(), type: "Trend Reversal", message: "Change of Character (CHoCH) detected on 1H chart. Trend shifting bullish.", confidence: 88 }
];

// Mock push subscriptions
let pushSubscriptions = [];

// 1. Get Alert History
router.get('/history', (req, res) => {
  res.json(alertsLog);
});

// 2. Register Browser Push Subscription
router.post('/subscribe', (req, res) => {
  const subscription = req.body;
  if (subscription && !pushSubscriptions.some(sub => sub.endpoint === subscription.endpoint)) {
    pushSubscriptions.push(subscription);
  }
  res.json({ success: true, message: "Browser push subscription registered successfully." });
});

// 3. Dispatch Alert (Simulated or triggered internally)
router.post('/dispatch', (req, res) => {
  const { type, message, confidence } = req.body;
  
  if (!type || !message) {
    return res.status(400).json({ error: "Missing type or message in alert dispatch." });
  }

  const alertId = "ALT_" + Math.random().toString(36).substr(2, 9).toUpperCase();
  const newAlert = {
    id: alertId,
    timestamp: new Date().toISOString(),
    type,
    message,
    confidence: confidence || 70
  };

  // Prepend to history
  alertsLog.unshift(newAlert);
  if (alertsLog.length > 50) alertsLog.pop();

  // Simulate Telegram Dispatch (Log to console)
  console.log(`[TELEGRAM ALERT DISPATCHED] ID: ${alertId} | Type: ${type} | Message: ${message}`);

  // Simulate Email Dispatch (Log to console)
  console.log(`[EMAIL ALERT DISPATCHED] To: traders@aurax.ai | Subject: AURAX Alert - ${type} | Body: ${message}`);

  // Return success back to the caller so frontend can display immediately via web socket / polling
  res.json({
    success: true,
    message: "Alert dispatched successfully.",
    dispatchedAlert: newAlert,
    dispatchChannels: ["Console", "Telegram (Console-Proxy)", "Email (Console-Proxy)"]
  });
});

export default router;
