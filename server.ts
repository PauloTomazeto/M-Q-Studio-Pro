import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import axios from "axios";
import admin from "firebase-admin";
import fs from "fs";
dotenv.config();

// Initialize Firebase Admin with Service Account credentials
if (!admin.apps.length) {
  try {
    const serviceAccountPath = path.join(process.cwd(), 'serviceAccountKey.json');

    if (fs.existsSync(serviceAccountPath)) {
      // Load service account key from file
      const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf-8'));
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
        storageBucket: 'gen-lang-client-0425317525.firebasestorage.app'
      });
      console.log("[Firebase Admin] Initialized with Service Account ✅");
    } else {
      // Fallback to environment variables (for production)
      admin.initializeApp({
        projectId: process.env.VITE_FIREBASE_PROJECT_ID || "gen-lang-client-0425317525",
        storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || "gen-lang-client-0425317525.firebasestorage.app"
      });
      console.log("[Firebase Admin] Initialized with environment variables");
    }
  } catch (err: any) {
    console.error("[Firebase Admin] Initialization Error:", err.message);
  }
}

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
  
  // Firebase Storage Upload - Server-side upload (no CORS)
  app.post("/api/storage/upload", async (req, res) => {
    const { base64, path: storagePath } = req.body;

    if (!base64) {
      return res.status(400).json({ error: "Missing base64 data" });
    }

    let processedBase64 = base64;
    let wasPythonProcessed = false;

    try {
      console.log(`[Storage Upload] Processing image for: ${storagePath || 'temp_gen'}`);

      // ============================================
      // ETAPA 1: Python processing (optional)
      // ============================================
      try {
        console.log("[Storage Upload] Attempting Python image processing...");
        const pythonResponse = await axios.post(
          "http://127.0.0.1:5000/process",
          {
            base64: base64,
            filename: `${storagePath || 'temp_generation'}_${Date.now()}.jpg`
          },
          { timeout: 10000 }
        );

        if (pythonResponse.data.status === "success" && pythonResponse.data.base64) {
          processedBase64 = pythonResponse.data.base64;
          wasPythonProcessed = true;
          console.log("[Storage Upload] Python processing successful ✅");
        }
      } catch (pythonError: any) {
        console.warn("[Storage Upload] Python offline (usando base64 original):", pythonError.message);
      }

      // ============================================
      // ETAPA 2: Parse base64 and upload to Firebase via Admin SDK
      // ============================================
      const matches = processedBase64.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
      if (!matches || matches.length !== 3) {
        return res.status(400).json({ error: "Invalid base64 format" });
      }

      const contentType = matches[1];
      const buffer = Buffer.from(matches[2], 'base64');
      const filename = `${Date.now()}_${Math.random().toString(36).substring(7)}`;
      const fullPath = `${storagePath || 'temp_generation'}/${filename}`;

      const bucket = admin.storage().bucket();
      const file = bucket.file(fullPath);

      console.log("[Storage Upload] Uploading to Firebase via Admin SDK...");
      await file.save(buffer, {
        metadata: { contentType },
        public: true,
        resumable: false
      });

      // Return public URL (no CORS needed - server uploaded it)
      const publicUrl = `https://storage.googleapis.com/${bucket.name}/${fullPath}`;
      console.log("[Storage Upload] Success ✅:", publicUrl);
      if (wasPythonProcessed) {
        console.log("[Storage Upload] ✅ Image was processed by Python");
      }

      res.json({ url: publicUrl, processed: wasPythonProcessed });
    } catch (error: any) {
      console.error("[Storage Upload] Error:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  // Firebase Storage Proxy Download - Resolve CORS issue
  app.get("/api/storage/download/:path(*)", async (req, res) => {
    const filePath = req.params.path;

    if (!filePath) {
      return res.status(400).json({ error: "Missing file path" });
    }

    try {
      console.log(`[Storage Proxy] Downloading: ${filePath}`);

      const bucket = admin.storage().bucket();
      const file = bucket.file(filePath);

      // Check if file exists
      const [exists] = await file.exists();
      if (!exists) {
        console.warn(`[Storage Proxy] File not found: ${filePath}`);
        return res.status(404).json({ error: "File not found" });
      }

      // Get file metadata for content type and caching
      const [metadata] = await file.getMetadata();
      const contentType = metadata.contentType || "application/octet-stream";
      const contentLength = metadata.size || 0;

      // Set CORS and cache headers
      res.set({
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Range",
        "Content-Type": contentType,
        "Content-Length": contentLength.toString(),
        "Cache-Control": "public, max-age=31536000", // 1 year for immutable files
        "Cross-Origin-Resource-Sharing": "enabled"
      });

      // Stream file to response
      const readStream = file.createReadStream();

      readStream.on("error", (error: any) => {
        console.error(`[Storage Proxy] Stream Error for ${filePath}:`, error.message);
        if (!res.headersSent) {
          res.status(500).json({ error: "Failed to read file" });
        }
      });

      readStream.pipe(res);
    } catch (error: any) {
      console.error("[Storage Proxy] Download Error:", error.message);
      if (!res.headersSent) {
        res.status(500).json({ error: error.message });
      }
    }
  });

  // Cache Local - Serve cached images from /cache/images/
  app.get("/api/cache/image/:imageId(*)", async (req, res) => {
    const imageId = req.params.imageId;

    if (!imageId) {
      return res.status(400).json({ error: "Missing imageId parameter" });
    }

    try {
      console.log(`[Cache] Serving image: ${imageId}`);

      const fs = require('fs');
      const path = require('path');

      // Construct path to cached image
      const cacheDir = path.join(process.cwd(), 'cache', 'images');
      const imagePath = path.join(cacheDir, imageId);

      // Security: Prevent path traversal attacks
      if (!imagePath.startsWith(cacheDir)) {
        return res.status(403).json({ error: "Access denied" });
      }

      // Check if file exists
      if (!fs.existsSync(imagePath)) {
        console.warn(`[Cache] Image not found: ${imageId}`);
        return res.status(404).json({ error: "Image not found" });
      }

      // Get file stats for content length
      const stats = fs.statSync(imagePath);
      const contentType = "image/jpeg"; // Cache sempre salva JPEG

      // Set headers (CORS-safe, localhost)
      res.set({
        "Content-Type": contentType,
        "Content-Length": stats.size.toString(),
        "Cache-Control": "public, max-age=86400", // 24 horas de cache
        "Access-Control-Allow-Origin": "*"
      });

      // Stream file to response
      const readStream = fs.createReadStream(imagePath);

      readStream.on("error", (error: any) => {
        console.error(`[Cache] Stream Error for ${imageId}:`, error.message);
        if (!res.headersSent) {
          res.status(500).json({ error: "Failed to read file" });
        }
      });

      readStream.pipe(res);
      console.log(`[Cache] Served: ${imageId} (${stats.size} bytes)`);
    } catch (error: any) {
      console.error("[Cache] Serve Error:", error.message);
      if (!res.headersSent) {
        res.status(500).json({ error: error.message });
      }
    }
  });

  // Firebase Storage Generate Signed URL - For authenticated downloads
  app.post("/api/storage/signed-url", async (req, res) => {
    const { filePath } = req.body;

    if (!filePath) {
      return res.status(400).json({ error: "Missing filePath in request body" });
    }

    try {
      console.log(`[Storage Proxy] Generating signed URL for: ${filePath}`);

      const bucket = admin.storage().bucket();
      const file = bucket.file(filePath);

      // Check if file exists
      const [exists] = await file.exists();
      if (!exists) {
        console.warn(`[Storage Proxy] File not found for signed URL: ${filePath}`);
        return res.status(404).json({ error: "File not found" });
      }

      // Generate signed URL valid for 1 hour
      const [signedUrl] = await file.getSignedUrl({
        version: "v4",
        action: "read",
        expires: Date.now() + 60 * 60 * 1000, // 1 hour
      });

      console.log(`[Storage Proxy] Signed URL generated successfully for: ${filePath}`);
      res.json({
        signedUrl,
        expiresIn: 3600, // seconds
        filePath
      });
    } catch (error: any) {
      console.error("[Storage Proxy] Signed URL Error:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  // Firebase Storage Validate Access - Check file accessibility
  app.post("/api/storage/validate", async (req, res) => {
    const { fileId } = req.body;

    if (!fileId) {
      return res.status(400).json({ error: "Missing fileId in request body" });
    }

    try {
      console.log(`[Storage Proxy] Validating access for: ${fileId}`);

      const bucket = admin.storage().bucket();
      const file = bucket.file(fileId);

      // Check if file exists
      const [exists] = await file.exists();

      // Try to get metadata to verify accessibility
      let accessible = false;
      if (exists) {
        try {
          await file.getMetadata();
          accessible = true;
        } catch (metadataError: any) {
          console.warn(`[Storage Proxy] Metadata access denied for ${fileId}:`, metadataError.message);
          accessible = false;
        }
      }

      console.log(`[Storage Proxy] Validation result for ${fileId}: exists=${exists}, accessible=${accessible}`);
      res.json({
        exists,
        accessible,
        fileId
      });
    } catch (error: any) {
      console.error("[Storage Proxy] Validate Error:", error.message);
      res.status(500).json({ error: error.message });
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
