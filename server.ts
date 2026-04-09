import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import axios from "axios";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  // KIE API Proxy
  app.all("/api/kie/*", async (req, res) => {
    try {
      const subPath = req.params[0];
      const apiKey = process.env.KIE_API_KEY || "b7e6d04e2b37c593a0f8dac63ef612e9";
      const targetUrl = `https://api.kie.ai/${subPath}`;

      console.log(`Proxying ${req.method} request to KIE: ${targetUrl}`);

      const response = await axios({
        method: req.method,
        url: targetUrl,
        data: req.body,
        params: req.query,
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "x-api-key": apiKey,
          "Content-Type": "application/json"
        },
        timeout: 180000 // Increased to 180s for very slow responses
      });

      console.log(`KIE Response Status: ${response.status}`);
      res.status(response.status).json(response.data);
    } catch (error: any) {
      console.error("KIE Proxy Error:", error.message);
      if (error.response) {
        const errorData = error.response.data;
        const responsePayload = typeof errorData === 'string' && errorData.includes('<!doctype html>') 
          ? { error: "KIE_API_HTML_ERROR", message: "Target API returned HTML instead of JSON", raw: errorData.substring(0, 500) }
          : errorData;
        res.status(error.response.status).json(responsePayload);
      } else if (error.code === 'ECONNABORTED') {
        res.status(504).json({ error: "Gateway Timeout", message: "KIE API took too long to respond (180s limit)" });
      } else {
        res.status(500).json({ error: "Internal Server Error", message: error.message, code: error.code });
      }
    }
  });

  // Stripe Integration Preparation
  app.post("/api/stripe/create-checkout-session", async (req, res) => {
    const { planId, userId, email } = req.body;
    // This will be implemented when Stripe API key is provided
    res.json({ url: 'https://checkout.stripe.com/pay/placeholder' });
  });

  app.post("/api/stripe/webhook", express.raw({ type: 'application/json' }), (req, res) => {
    // This will handle Stripe webhooks to update user plans in Firestore
    res.json({ received: true });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
