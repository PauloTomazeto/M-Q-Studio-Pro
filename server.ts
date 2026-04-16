import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import axios from "axios";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create Express app for both local and Vercel deployment
async function createApp() {
  const app = express();

  app.use(express.json({ limit: '50mb' }));

  // COOP/COEP headers to fix Firebase Auth window.closed issue
  // Note: COEP: require-corp removed to allow Firebase Storage images to load
  // This header was blocking image resources that don't have CORP header
  app.use((req, res, next) => {
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
    // res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp'); // DISABLED: Blocks Firebase Storage
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    // Log confirmation that COEP is disabled
    if (req.path === '/') {
      console.log('[CORS Headers] COEP disabled ✓ | CORP: cross-origin ✓ | COOP: same-origin-allow-popups ✓');
    }
    next();
  });

  // Validate required environment variables
  const apiKey = process.env.KIE_API_KEY;
  if (!apiKey) {
    throw new Error(
      'KIE_API_KEY environment variable is required. ' +
      'Please set it in your .env file. ' +
      'Get your API key at: https://kie.ai/api-key'
    );
  }

  // KIE API Proxy with improved timeout handling and logging
  app.all("/api/kie/*", async (req, res) => {
    const startTime = Date.now();
    try {
      const subPath = req.params[0];
      const targetUrl = `https://api.kie.ai/${subPath}`;

      console.log(`[KIE Proxy] START ${req.method} ${subPath}`);
      console.log(`[KIE Proxy] Body size: ${JSON.stringify(req.body).length} bytes`);

      // Vercel has 60s timeout for normal functions (900s for Pro)
      // Set axios timeout slightly less than Vercel limit
      const timeout = process.env.VERCEL === '1' ? 55000 : 180000;

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
        timeout
      });

      const duration = Date.now() - startTime;
      console.log(`[KIE Proxy] SUCCESS ${response.status} - ${duration}ms`);
      res.status(response.status).json(response.data);
    } catch (error: any) {
      const duration = Date.now() - startTime;
      console.error(`[KIE Proxy] ERROR after ${duration}ms:`, error.message);
      
      if (error.response) {
        const errorData = error.response.data;
        const responsePayload = typeof errorData === 'string' && errorData.includes('<!doctype html>') 
          ? { error: "KIE_API_HTML_ERROR", message: "Target API returned HTML instead of JSON", raw: errorData.substring(0, 500) }
          : errorData;
        console.error(`[KIE Proxy] Response error:`, error.response.status, errorData);
        res.status(error.response.status).json(responsePayload);
      } else if (error.code === 'ECONNABORTED') {
        console.error(`[KIE Proxy] TIMEOUT after ${duration}ms`);
        res.status(504).json({ error: "Gateway Timeout", message: "KIE API took too long to respond (180s limit)", duration });
      } else if (error.code === 'ENOTFOUND') {
        console.error(`[KIE Proxy] DNS error - could not find host`);
        res.status(503).json({ error: "Service Unavailable", message: "Could not reach KIE API", code: error.code });
      } else {
        console.error(`[KIE Proxy] Unexpected error:`, error.code, error.message);
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

  return app;
}

// Store app instance for reuse
let appInstance: any = null;

// Get or create app instance
async function getApp() {
  if (!appInstance) {
    appInstance = await createApp();
  }
  return appInstance;
}

// Export for Vercel Serverless Functions
export default (req: any, res: any) => {
  getApp().then(app => app(req, res)).catch((err: any) => {
    console.error('App initialization error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  });
};

// Local development server
async function startServer() {
  const app = await createApp();
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔗 Vercel: ${process.env.VERCEL === '1' ? 'Yes' : 'No'}`);
  });
}

// Only start local server if running directly (not imported)
if (import.meta.url === `file://${process.argv[1]}`) {
  startServer().catch(console.error);
}
