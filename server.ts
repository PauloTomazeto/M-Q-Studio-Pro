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
  const KIE_API_KEY = process.env.KIE_API_KEY || "b7e6d04e2b37c593a0f8dac63ef612e9";

  app.use(express.json({ limit: '50mb' }));

  // KIE API Proxy Endpoints
  app.post("/api/kie/gemini", async (req, res) => {
    console.log(`[KIE Proxy] Request to Gemini API. Key suffix: ...${KIE_API_KEY.slice(-4)}`);
    try {
      const response = await axios.post(
        "https://api.kie.ai/gemini-3.1-pro/v1/chat/completions",
        req.body,
        {
          headers: {
            Authorization: `Bearer ${KIE_API_KEY}`,
            "Content-Type": "application/json",
          },
          timeout: 120000 // 120s timeout for AI response
        }
      );
      console.log("[KIE Proxy] Gemini API Success");
      res.json(response.data);
    } catch (error: any) {
      const status = error.response?.status || 500;
      const errorData = error.response?.data || error.message;
      console.error(`[KIE Proxy] Gemini API Error (${status}):`, JSON.stringify(errorData));
      res.status(status).json(errorData);
    }
  });

  app.post("/api/kie/kling", async (req, res) => {
    try {
      const response = await axios.post(
        "https://api.kie.ai/api/v1/jobs/createTask",
        req.body,
        {
          headers: {
            Authorization: `Bearer ${KIE_API_KEY}`,
            "Content-Type": "application/json",
          },
        }
      );
      res.json(response.data);
    } catch (error: any) {
      console.error("KIE Kling Error:", error.response?.data || error.message);
      res.status(error.response?.status || 500).json(error.response?.data || { error: "Internal Server Error" });
    }
  });

  app.get("/api/kie/kling/status/:taskId", async (req, res) => {
    try {
      const response = await axios.get(
        `https://api.kie.ai/api/v1/jobs/getTask?taskId=${req.params.taskId}`,
        {
          headers: {
            Authorization: `Bearer ${KIE_API_KEY}`,
          },
        }
      );
      res.json(response.data);
    } catch (error: any) {
      console.error("KIE Kling Status Error:", error.response?.data || error.message);
      res.status(error.response?.status || 500).json(error.response?.data || { error: "Internal Server Error" });
    }
  });

  // Nano Banana endpoints
  app.post("/api/kie/nano-banana/create", async (req, res) => {
    console.log("[KIE Proxy] Nano Banana Create Task:", {
      model: req.body.model,
      promptLength: req.body.input?.prompt?.length,
      imageCount: req.body.input?.image_input?.length,
      resolution: req.body.input?.resolution,
      aspect_ratio: req.body.input?.aspect_ratio
    });
    try {
      const response = await axios.post(
        "https://api.kie.ai/api/v1/jobs/createTask",
        req.body,
        {
          headers: {
            Authorization: `Bearer ${KIE_API_KEY}`,
            "Content-Type": "application/json",
          },
        }
      );
      console.log("[KIE Proxy] Nano Banana Success:", response.data.code);
      res.json(response.data);
    } catch (error: any) {
      const status = error.response?.status || 500;
      const errorData = error.response?.data || error.message;
      console.error(`[KIE Proxy] Nano Banana Error (${status}):`, JSON.stringify(errorData));
      res.status(status).json(errorData);
    }
  });

  app.get("/api/kie/nano-banana/status/:taskId", async (req, res) => {
    try {
      const response = await axios.get(
        `https://api.kie.ai/api/v1/jobs/getTask?taskId=${req.params.taskId}`,
        {
          headers: {
            Authorization: `Bearer ${KIE_API_KEY}`,
          },
        }
      );
      res.json(response.data);
    } catch (error: any) {
      console.error("KIE Nano Banana Status Error:", error.response?.data || error.message);
      res.status(error.response?.status || 500).json(error.response?.data || { error: "Internal Server Error" });
    }
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
