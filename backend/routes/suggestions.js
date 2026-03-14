const express = require("express");
const Room = require("../models/Room");
const axios = require("axios");
const auth = require("../middleware/auth");
const fs = require("fs");
const path = require("path");

const UNSPLASH_ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY;
const SEGMENTATION_URL = (process.env.SEGMENTATION_URL || "http://127.0.0.1:8000").replace(/\/+$/, "");

const router = express.Router();
const CATALOG_PATH = path.join(__dirname, "../data/catalog.json");

function loadCatalog() {
  try {
    const raw = fs.readFileSync(CATALOG_PATH, "utf-8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error("Catalog load error:", err.message);
    return [];
  }
}

function normalize(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function tokenize(value) {
  return normalize(value).split(" ").filter((w) => w.length > 2);
}

function findBestCatalogMatch(item, catalog) {
  if (!catalog.length) return null;

  const targetTitle = normalize(item.name || item.title);
  const targetCategory = normalize(item.category);
  const words = tokenize(targetTitle);

  let best = null;
  let bestScore = -1;

  for (const c of catalog) {
    const cTitle = normalize(c.title);
    const cCategory = normalize(c.category);

    let score = 0;

    if (targetCategory && cCategory === targetCategory) score += 5;
    if (targetCategory && cCategory.includes(targetCategory)) score += 3;
    if (targetTitle && cTitle.includes(targetTitle)) score += 4;

    for (const w of words) {
      if (cTitle.includes(w)) score += 1;
    }

    if (score > bestScore) {
      bestScore = score;
      best = c;
    }
  }

  if (bestScore <= 0 && targetCategory) {
    return catalog.find((c) => normalize(c.category) === targetCategory) || null;
  }

  return best;
}

async function fetchUnsplashImage(query) {
  if (!UNSPLASH_ACCESS_KEY) return null;
  try {
    const url = `https://api.unsplash.com/photos/random?query=${encodeURIComponent(query)}&orientation=landscape&client_id=${UNSPLASH_ACCESS_KEY}`;
    const res = await axios.get(url, { timeout: 10000 });
    return res.data.urls?.regular || res.data.urls?.small || null;
  } catch (err) {
    console.error("Unsplash API error:", err.message);
    return null;
  }
}

async function buildSuggestionPayload(item, room, idx, catalog) {
  const matchedCatalog = findBestCatalogMatch(item, catalog);

  let imageUrl = matchedCatalog?.image || item.image || null;
  if (!imageUrl) {
    imageUrl = await fetchUnsplashImage(item.name || item.title || item.category || "furniture");
  }

  return {
    id: item.id || `ai-${room._id}-${idx}`,
    title: item.name || item.title || matchedCatalog?.title || "Suggested Item",
    desc: item.description || item.reason || matchedCatalog?.desc || "AI recommendation based on your room",
    price: item.price || matchedCatalog?.price || `$${Math.floor(Math.random() * 500 + 80)}`,
    category: item.category || matchedCatalog?.category || "Furniture",
    confidence: item.confidence || Math.floor(Math.random() * 20 + 80),
    imageUrl: imageUrl || "https://via.placeholder.com/400x300?text=Suggested+Item",
    fallbackImage: imageUrl || "https://via.placeholder.com/400x300?text=Suggested+Item",
    modelUrl: item.modelUrl || matchedCatalog?.modelUrl || null,
    realWidthM: Number(item.realWidthM) || Number(matchedCatalog?.realWidthM) || null,
    colorTags: item.matching_colors || matchedCatalog?.colorTags || room.dominantColors?.slice(0, 3) || [],
    aiGenerated: true,
    reason: item.reason || "Generated from room analysis",
    catalogMatched: Boolean(matchedCatalog),
  };
}

router.get("/:roomId", auth, async (req, res) => {
  try {
    const room = await Room.findById(req.params.roomId);
    if (!room) return res.status(404).json({ success: false, msg: "Room not found" });

    if (room.user.toString() !== req.user.id) {
      return res.status(403).json({ success: false, msg: "Access denied" });
    }

    const catalog = loadCatalog();

    try {
      const aiRes = await axios.post(
        `${SEGMENTATION_URL}/generate-suggestions`,
        {
          room_id: room._id,
          dominant_colors: room.dominantColors || [],
          detected_objects: room.segmentationData?.detectedObjects || [],
          room_type: room.segmentationData?.roomType || "Unknown",
          color_scheme: room.colorAnalysis?.colorScheme || "Neutral",
        },
        {
          timeout: 30000,
        }
      );

      const suggestions = aiRes.data?.suggestions || [];
      const formattedSuggestions = await Promise.all(
        suggestions.map((item, idx) => buildSuggestionPayload(item, room, idx, catalog))
      );

      if (formattedSuggestions.length > 0) {
        return res.json(formattedSuggestions);
      }

      const fallbackSuggestions = await generateFallbackSuggestions(room, catalog);
      return res.json(fallbackSuggestions);
    } catch (aiError) {
      console.error("AI suggestion generation failed:", aiError.message);
      const fallbackSuggestions = await generateFallbackSuggestions(room, catalog);
      return res.json(fallbackSuggestions);
    }
  } catch (err) {
    console.error("Error fetching suggestions:", err);
    res.status(500).json({ success: false, error: "Failed to generate suggestions" });
  }
});

async function generateFallbackSuggestions(room, catalog = []) {
  const suggestions = [];
  const objects = room.segmentationData?.detectedObjects || [];
  const colors = room.dominantColors || [];
  const colorScheme = room.colorAnalysis?.colorScheme || "Neutral";

  const objectMap = {
    sofa: [
      { name: "Modern Coffee Table", category: "Furniture", reason: "Perfect companion for your sofa" },
      { name: "Throw Pillows Set", category: "Textiles", reason: "Add comfort and style to your sofa" },
      { name: "Floor Lamp", category: "Lighting", reason: "Create ambient lighting near seating area" },
    ],
    chair: [
      { name: "Ottoman", category: "Furniture", reason: "Comfortable footrest for your chair" },
      { name: "Side Table", category: "Furniture", reason: "Convenient surface next to seating" },
    ],
    "dining table": [
      { name: "Pendant Light", category: "Lighting", reason: "Focused lighting for dining area" },
      { name: "Table Runner", category: "Textiles", reason: "Decorative element for your dining table" },
    ],
    "tv/monitor": [
      { name: "Media Console", category: "Storage", reason: "Organize your entertainment area" },
      { name: "Cable Management System", category: "Storage", reason: "Keep cables tidy and hidden" },
    ],
  };

  for (const obj of objects) {
    const key = obj.class || obj.type;
    const objSuggestions = objectMap[key];

    if (objSuggestions) {
      for (const [idx, sugg] of objSuggestions.entries()) {
        const payload = await buildSuggestionPayload(
          {
            name: sugg.name,
            category: sugg.category,
            reason: sugg.reason,
            confidence: Math.max(70, Math.floor((obj.confidence || 0.9) * 100) - 10),
            matching_colors: colors.slice(0, 3),
          },
          room,
          idx,
          catalog
        );
        payload.id = `fallback-${room._id}-${key}-${idx}`;
        payload.aiGenerated = false;
        suggestions.push(payload);
      }
    }
  }

  if (colorScheme === "Warm") {
    suggestions.push(
      await buildSuggestionPayload(
        {
          name: "Cool-toned Accent Pieces",
          category: "Decor",
          reason: "Creates visual balance in warm spaces",
          price: "$75",
          confidence: 85,
          matching_colors: ["#4A90E2", "#5DADE2"],
        },
        room,
        1,
        catalog
      )
    );
  } else if (colorScheme === "Cool") {
    suggestions.push(
      await buildSuggestionPayload(
        {
          name: "Warm Wood Furniture",
          category: "Furniture",
          reason: "Brings warmth to cool color schemes",
          price: "$299",
          confidence: 85,
          matching_colors: ["#8B4513", "#D2691E"],
        },
        room,
        1,
        catalog
      )
    );
  }

  if (!objects.find((o) => o.class === "potted plant" || o.type === "potted plant")) {
    suggestions.push(
      await buildSuggestionPayload(
        {
          name: "Indoor Potted Plant",
          category: "Decor",
          reason: "Adds freshness to any room",
          confidence: 85,
          matching_colors: colors.slice(0, 3),
        },
        room,
        999,
        catalog
      )
    );
  }

  return suggestions.slice(0, 12);
}

module.exports = router;
