const express = require("express");
const Room = require("../models/Room");
const axios = require("axios");
const auth = require("../middleware/auth");

const UNSPLASH_ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY; // put your API key in .env


// Helper to fetch image from Unsplash API
async function fetchUnsplashImage(query) {
  try {
    const url = `https://api.unsplash.com/photos/random?query=${encodeURIComponent(query)}&orientation=landscape&client_id=${UNSPLASH_ACCESS_KEY}`;
    const res = await axios.get(url, { timeout: 10000 });
    return res.data.urls?.regular || res.data.urls?.small || null;
  } catch (err) {
    console.error("Unsplash API error:", err.message);
    return null;
  }
}


const router = express.Router();

// AI-powered suggestions (replacing static catalog)
router.get("/:roomId", auth, async (req, res) => {
  try {
    const room = await Room.findById(req.params.roomId);
    if (!room) return res.status(404).json({ success: false, msg: "Room not found" });

    // Verify user owns this room
    if (room.user.toString() !== req.user.id) {
      return res.status(403).json({ success: false, msg: "Access denied" });
    }

    // Call AI service to generate suggestions
    try {
      const aiRes = await axios.post("http://127.0.0.1:8000/generate-suggestions", {
        room_id: room._id,
        dominant_colors: room.dominantColors || [],
        detected_objects: room.segmentationData?.detectedObjects || [],
        room_type: room.segmentationData?.roomType || "Unknown",
        color_scheme: room.colorAnalysis?.colorScheme || "Neutral"
      }, {
        timeout: 30000
      });

      const suggestions = aiRes.data.suggestions || [];
      
      // Format suggestions for frontend
  const formattedSuggestions = await Promise.all(
  suggestions.map(async (item, idx) => {
    const unsplashImg = await fetchUnsplashImage(item.name || item.title);

    return {
      id: `ai-${room._id}-${idx}`,
      title: item.name || item.title,
      desc: item.description || item.reason,
      price: item.price || "$" + Math.floor(Math.random() * 500 + 50),
      category: item.category || "Furniture",
      confidence: item.confidence || Math.floor(Math.random() * 20 + 80),
      imageUrl: unsplashImg || item.image || "https://via.placeholder.com/400x300?text=No+Image",
      colorTags: item.matching_colors || room.dominantColors?.slice(0, 3) || [],
      aiGenerated: true,
      reason: item.reason
    };
  })
);


      res.json(formattedSuggestions);
    } catch (aiError) {
      console.error("AI suggestion generation failed:", aiError.message);
      
      // Fallback to basic suggestions based on room data
      const fallbackSuggestions = await generateFallbackSuggestions(room);
      res.json(fallbackSuggestions);
    }
  } catch (err) {
    console.error("Error fetching suggestions:", err);
    res.status(500).json({ success: false, error: "Failed to generate suggestions" });
  }
});

// Generate fallback suggestions if AI service fails
async function generateFallbackSuggestions(room) {
  const suggestions = [];
  const objects = room.segmentationData?.detectedObjects || [];
  const colors = room.dominantColors || [];
  const colorScheme = room.colorAnalysis?.colorScheme || "Neutral";

  // Object-based suggestions
  const objectMap = {
    'sofa': [
      { name: 'Modern Coffee Table', category: 'Furniture', reason: 'Perfect companion for your sofa' },
      { name: 'Throw Pillows Set', category: 'Textiles', reason: 'Add comfort and style to your sofa' },
      { name: 'Floor Lamp', category: 'Lighting', reason: 'Create ambient lighting near seating area' }
    ],
    'chair': [
      { name: 'Ottoman', category: 'Furniture', reason: 'Comfortable footrest for your chair' },
      { name: 'Side Table', category: 'Furniture', reason: 'Convenient surface next to seating' }
    ],
    'dining table': [
      { name: 'Pendant Light', category: 'Lighting', reason: 'Focused lighting for dining area' },
      { name: 'Table Runner', category: 'Textiles', reason: 'Decorative element for your dining table' }
    ],
    'tv/monitor': [
      { name: 'Media Console', category: 'Storage', reason: 'Organize your entertainment area' },
      { name: 'Cable Management System', category: 'Storage', reason: 'Keep cables tidy and hidden' }
    ]
  };

  // Add suggestions based on detected objects
  for (const obj of objects) {
    const objSuggestions = objectMap[obj.class] || objectMap[obj.type];
    
    if (objSuggestions) {
      for (const [idx, sugg] of objSuggestions.entries()) {
        const imgUrl = await fetchUnsplashImage(sugg.name);
        suggestions.push({
          id: `fallback-${room._id}-${obj.class || obj.type}-${idx}`,
          title: sugg.name,
          desc: sugg.reason,
          price: "$" + Math.floor(Math.random() * 300 + 50),
          category: sugg.category,
          confidence: Math.max(70, Math.floor((obj.confidence || 0.9) * 100) - 10),
          imageUrl: imgUrl || `https://via.placeholder.com/400x300?text=${encodeURIComponent(sugg.name)}`,
          colorTags: colors.slice(0, 3),
          aiGenerated: false,
          reason: sugg.reason
        });
      }
    }
  }

  // Color scheme based suggestions
  if (colorScheme === "Warm") {
    const imgUrl = await fetchUnsplashImage("cool accent decor");
    suggestions.push({
      id: `fallback-${room._id}-warm-1`,
      title: "Cool-toned Accent Pieces",
      desc: "Balance warm colors with cool accents",
      price: "$75",
      category: "Decor",
      confidence: 85,
      imageUrl: imgUrl || "https://via.placeholder.com/400x300?text=No+Image",
      colorTags: ["#4A90E2", "#5DADE2"],
      reason: "Creates visual balance in warm spaces"
    });
  } else if (colorScheme === "Cool") {
    const imgUrl = await fetchUnsplashImage("wood furniture");
    suggestions.push({
      id: `fallback-${room._id}-cool-1`,
      title: "Warm Wood Furniture",
      desc: "Add warmth to cool-toned rooms",
      price: "$299",
      category: "Furniture",
      confidence: 85,
      imageUrl: imgUrl || "https://via.placeholder.com/400x300?text=Wood+Furniture",
      colorTags: ["#8B4513", "#D2691E"],
      reason: "Brings warmth to cool color schemes"
    });
  }

  // Always suggest plants if not detected
  if (!objects.find(o => (o.class === 'potted plant' || o.type === 'potted plant'))) {
    const imgUrl = await fetchUnsplashImage("indoor plant");
    suggestions.push({
      id: `fallback-${room._id}-plant`,
      title: "Indoor Potted Plant",
      desc: "Bring life to your space with natural greenery",
      price: "$" + Math.floor(Math.random() * 150 + 20),
      category: "Decor",
      confidence: 85,
      imageUrl: imgUrl || "https://via.placeholder.com/400x300?text=Plant",
      colorTags: colors.slice(0, 3),
      aiGenerated: false,
      reason: "Adds freshness to any room"
    });
  }

  return suggestions.slice(0, 12); // Return max 12 suggestions
}

module.exports = router;