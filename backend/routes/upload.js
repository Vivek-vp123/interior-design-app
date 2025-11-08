// routes/upload.js
const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const axios = require("axios");
const FormData = require("form-data");

const auth = require("../middleware/auth");
const Room = require("../models/Room");

const router = express.Router();

/* ----------------------------- Config ----------------------------- */
const UPLOAD_DIR = path.join(__dirname, "../uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// FastAPI segmentation service base URL (no trailing slash)
const SEGMENTATION_URL =
  (process.env.SEGMENTATION_URL || "http://127.0.0.1:8000").replace(/\/+$/, "");

// Optional: if you want to store a full public URL for masks
const SEGMENTATION_PUBLIC_BASE =
  (process.env.SEGMENTATION_PUBLIC_BASE || SEGMENTATION_URL).replace(/\/+$/, "");

/* ----------------------------- Multer ----------------------------- */
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
    cb(null, name);
  },
});

const fileFilter = (req, file, cb) => {
  const allowed = /jpeg|jpg|png|webp/;
  const extOk = allowed.test(path.extname(file.originalname).toLowerCase());
  const mimeOk = allowed.test(file.mimetype);
  if (extOk && mimeOk) return cb(null, true);
  cb(new Error("Only JPEG, PNG, and WebP images are allowed"));
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

/* ----------------------- Helpers / Utilities ---------------------- */
function hexToHsv(hex) {
  // hex: "#rrggbb"
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;

  let h = 0;
  if (d !== 0) {
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0));
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h = h / 6;
  }
  const s = max === 0 ? 0 : d / max;
  const v = max;
  return { h: h * 360, s, v };
}

function determineColorScheme(colors = []) {
  if (!Array.isArray(colors) || colors.length === 0) return "Neutral";
  // colors are hex strings like "#aabbcc"
  const hues = [];
  let warm = 0;
  let cool = 0;

  for (const c of colors) {
    if (!/^#([A-Fa-f0-9]{6})$/.test(c)) continue;
    const { h, s, v } = hexToHsv(c);
    hues.push(h);
    // rough buckets
    const isWarm = (h >= 0 && h < 60) || (h >= 300 && h <= 360) || (h >= 60 && h < 90);
    const isCool = (h >= 90 && h < 300);
    if (isWarm) warm++;
    if (isCool) cool++;
  }

  if (warm === 0 && cool === 0) return "Neutral";
  if (warm > cool * 1.25) return "Warm";
  if (cool > warm * 1.25) return "Cool";
  return "Mixed";
}

async function callSegmentationService(fileAbsPath, reqId, retries = 1) {
  const form = new FormData();
  form.append("file", fs.createReadStream(fileAbsPath));

  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await axios.post(`${SEGMENTATION_URL}/segment`, form, {
        headers: { ...form.getHeaders(), "X-Request-ID": reqId },
        timeout: 120000,
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        validateStatus: (s) => s >= 200 && s < 300,
      });
      return res.data;
    } catch (err) {
      lastErr = err;
      if (attempt < retries) continue;
    }
  }
  throw lastErr;
}

/* ------------------------------ Routes ---------------------------- */

// Upload & segment
router.post("/", auth, upload.single("image"), async (req, res) => {
  const started = Date.now();

  if (!req.file) {
    return res.status(400).json({ success: false, msg: "No file uploaded" });
  }

  try {
    const filePath = `/uploads/${req.file.filename}`;
    const fileAbsPath = path.join(UPLOAD_DIR, req.file.filename);

    // Call FastAPI segmentation
    const reqId = `${req.user.id}-${Date.now()}`;
    const seg = await callSegmentationService(fileAbsPath, reqId, 1);

    const {
      mask_url,
      dominant_colors,
      width,
      height,
      device,
      analysis,
      processing_time,
      detected_objects,
    } = seg;

    const effectiveProcessingMs =
      (typeof processing_time === "number" ? processing_time : null) ||
      (Date.now() - started);

    // Build color analysis palette (ranked)
    const palette =
      Array.isArray(dominant_colors)
        ? dominant_colors.map((hex, idx) => ({
            color: hex,
            hex,
            percentage: Number((100 / dominant_colors.length).toFixed(2)),
            dominance: idx + 1,
          }))
        : [];

    const roomDoc = new Room({
      user: req.user.id,
      fileName: req.file.filename,
      originalName: req.file.originalname,
      filePath, // served by Node
      maskUrl: mask_url, // served by FastAPI (relative like "/outputs/xxx.png")
      dominantColors: Array.isArray(dominant_colors) ? dominant_colors : [],
      width,
      height,
      device,
      // Extended analysis
      segmentationData: {
        detectedObjects: Array.isArray(detected_objects) ? detected_objects : [],
        roomType:
          (analysis && Array.isArray(analysis.interior_objects) && analysis.interior_objects.length > 0)
            ? "Living Space"
            : "Unknown",
        processingTime: effectiveProcessingMs,
        modelVersion: "DeepLabV3",
        fullAnalysis: analysis || {},
      },
      colorAnalysis: {
        palette,
        colorScheme: determineColorScheme(dominant_colors),
        brightness: 0.5,
        contrast: 0.5,
      },
    });

    await roomDoc.save();

    res.json({
      success: true,
      data: roomDoc,
      meta: {
        maskFullUrl:
          mask_url && mask_url.startsWith("/")
            ? `${SEGMENTATION_PUBLIC_BASE}${mask_url}`
            : mask_url || null,
        processingMs: effectiveProcessingMs,
      },
    });
  } catch (err) {
    console.error("Segmentation error:", err?.response?.data || err.message);

    // Still save the room record so the user can see/uploaded image
    try {
      const fallbackRoom = new Room({
        user: req.user.id,
        fileName: req.file.filename,
        originalName: req.file.originalname,
        filePath: `/uploads/${req.file.filename}`,
        dominantColors: [],
        segmentationData: {
          detectedObjects: [],
          roomType: "Unknown",
          processingTime: Date.now() - started,
          modelVersion: "DeepLabV3",
          fullAnalysis: {},
        },
        colorAnalysis: {
          palette: [],
          colorScheme: "Neutral",
          brightness: 0.5,
          contrast: 0.5,
        },
      });

      await fallbackRoom.save();

      return res.status(200).json({
        success: true,
        warning: "Image uploaded but segmentation failed.",
        data: fallbackRoom,
      });
    } catch (saveErr) {
      console.error("Save error:", saveErr.message);
      return res.status(500).json({
        success: false,
        msg: "Upload failed and could not save fallback record",
      });
    }
  }
});

// List user's rooms
router.get("/", auth, async (req, res) => {
  try {
    const rooms = await Room.find({ user: req.user.id })
      .sort("-date")
      .select("-__v");
    res.json(rooms); // ✅ back to array
  } catch (err) {
    console.error("Fetch rooms error:", err);
    res.status(500).json({ msg: "Failed to fetch rooms" });
  }
});

// Single room
router.get("/:id", auth, async (req, res) => {
  try {
    const room = await Room.findOne({ _id: req.params.id, user: req.user.id });
    if (!room) return res.status(404).json({ success: false, msg: "Room not found" });

    res.json({
      success: true,
      data: room,
      meta: {
        maskFullUrl:
          room.maskUrl && room.maskUrl.startsWith("/")
            ? `${SEGMENTATION_PUBLIC_BASE}${room.maskUrl}`
            : room.maskUrl || null,
      },
    });
  } catch (err) {
    console.error("Get room error:", err);
    res.status(500).json({ success: false, msg: "Failed to fetch room" });
  }
});

// Detailed room info
router.get("/:id/details", auth, async (req, res) => {
  try {
    const room = await Room.findOne({ _id: req.params.id, user: req.user.id });
    if (!room) return res.status(404).json({ success: false, msg: "Room not found" });

    const analysis = room.segmentationData?.fullAnalysis || {};
    const objects =
      room.segmentationData?.detectedObjects && room.segmentationData.detectedObjects.length
        ? room.segmentationData.detectedObjects
        : [
            // minimal sensible fallback if empty
            { class: "sofa", confidence: 0.85, area: 0, percentage: 0 },
          ];

    res.json({
      success: true,
      data: {
        ...room.toObject(),
        analysis: {
          ...analysis,
          objects,
          roomType: room.segmentationData?.roomType || "Unknown",
          totalObjects: objects.length,
          processingTime: room.segmentationData?.processingTime || 0,
          colorScheme: room.colorAnalysis?.colorScheme || determineColorScheme(room.dominantColors),
        },
      },
      meta: {
        maskFullUrl:
          room.maskUrl && room.maskUrl.startsWith("/")
            ? `${SEGMENTATION_PUBLIC_BASE}${room.maskUrl}`
            : room.maskUrl || null,
      },
    });
  } catch (err) {
    console.error("Error fetching room details:", err);
    res.status(500).json({ success: false, msg: "Failed to fetch room details" });
  }
});

// Delete room (+ files)
router.delete("/:id", auth, async (req, res) => {
  try {
    const room = await Room.findOne({ _id: req.params.id, user: req.user.id });
    if (!room) return res.status(404).json({ success: false, msg: "Room not found" });

    // Delete local original upload
    const originalPath = path.join(UPLOAD_DIR, room.fileName || "");
    if (room.fileName && fs.existsSync(originalPath)) {
      try { fs.unlinkSync(originalPath); } catch (_) {}
    }

    // Note: mask is hosted by FastAPI service under /outputs; we do not delete it here.
    // (If you want to, add a deletion endpoint in the FastAPI service.)

    await room.deleteOne();
    res.json({ success: true, msg: "Room deleted" });
  } catch (err) {
    console.error("Delete room error:", err);
    res.status(500).json({ success: false, msg: "Failed to delete room" });
  }
});

// Retry segmentation
router.post("/:id/retry-segmentation", auth, async (req, res) => {
  try {
    const room = await Room.findOne({ _id: req.params.id, user: req.user.id });
    if (!room) return res.status(404).json({ success: false, msg: "Room not found" });
    if (!room.fileName) return res.status(400).json({ success: false, msg: "No original file to reprocess" });

    const fileAbsPath = path.join(UPLOAD_DIR, room.fileName);
    if (!fs.existsSync(fileAbsPath)) {
      return res.status(404).json({ success: false, msg: "Original file not found on disk" });
    }

    const started = Date.now();
    const reqId = `${req.user.id}-${Date.now()}-retry`;

    const seg = await callSegmentationService(fileAbsPath, reqId, 1);
    const {
      mask_url,
      dominant_colors,
      width,
      height,
      device,
      analysis,
      processing_time,
      detected_objects,
    } = seg;

    room.maskUrl = mask_url || room.maskUrl;
    room.dominantColors = Array.isArray(dominant_colors) ? dominant_colors : room.dominantColors;
    room.width = width || room.width;
    room.height = height || room.height;
    room.device = device || room.device;

    room.segmentationData = {
      detectedObjects: Array.isArray(detected_objects) ? detected_objects : room.segmentationData?.detectedObjects || [],
      roomType:
        (analysis && Array.isArray(analysis.interior_objects) && analysis.interior_objects.length > 0)
          ? "Living Space"
          : room.segmentationData?.roomType || "Unknown",
      processingTime:
        (typeof processing_time === "number" ? processing_time : null) || (Date.now() - started),
      modelVersion: "DeepLabV3",
      fullAnalysis: analysis || room.segmentationData?.fullAnalysis || {},
    };

    // Update color analysis
    room.colorAnalysis = {
      palette: Array.isArray(room.dominantColors)
        ? room.dominantColors.map((hex, idx) => ({
            color: hex,
            hex,
            percentage: Number((100 / room.dominantColors.length).toFixed(2)),
            dominance: idx + 1,
          }))
        : room.colorAnalysis?.palette || [],
      colorScheme: determineColorScheme(room.dominantColors),
      brightness: room.colorAnalysis?.brightness ?? 0.5,
      contrast: room.colorAnalysis?.contrast ?? 0.5,
    };

    await room.save();

    res.json({
      success: true,
      data: room,
      meta: {
        maskFullUrl:
          room.maskUrl && room.maskUrl.startsWith("/")
            ? `${SEGMENTATION_PUBLIC_BASE}${room.maskUrl}`
            : room.maskUrl || null,
      },
    });
  } catch (err) {
    console.error("Retry segmentation error:", err?.response?.data || err.message);
    res.status(500).json({ success: false, msg: "Segmentation retry failed" });
  }
});

// Summary stats
router.get("/stats/summary", auth, async (req, res) => {
  try {
    const [stats] = await Room.aggregate([
      { $match: { user: req.user.id } },
      {
        $group: {
          _id: null,
          totalRooms: { $sum: 1 },
          analyzedRooms: { $sum: { $cond: [{ $ifNull: ["$maskUrl", false] }, 1, 0] } },
        },
      },
    ]);

    res.json({
      success: true,
      data: {
        totalRooms: stats?.totalRooms || 0,
        analyzedRooms: stats?.analyzedRooms || 0,
      },
    });
  } catch (err) {
    console.error("Stats error:", err);
    res.status(500).json({ success: false, msg: "Failed to fetch statistics" });
  }
});

module.exports = router;