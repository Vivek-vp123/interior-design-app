const mongoose = require("mongoose");

const RoomSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  fileName: String,
  originalName: String,
  filePath: String,
  maskUrl: String,
  dominantColors: [String],
  width: Number,
  height: Number,
  device: String,
  date: { type: Date, default: Date.now },
  
  // Enhanced segmentation data
  segmentationData: {
    detectedObjects: [{
      class: String,
      confidence: Number,
      area: Number,
      percentage: Number,
      boundingBox: {
        x: Number,
        y: Number,
        width: Number,
        height: Number
      }
    }],
    roomType: String,
    processingTime: Number,
    modelVersion: String,
    fullAnalysis: mongoose.Schema.Types.Mixed
  },
  
  colorAnalysis: {
    palette: [{
      color: String,
      hex: String,
      percentage: Number,
      dominance: Number
    }],
    colorScheme: String,
    brightness: Number,
    contrast: Number
  },
  
  // AI Suggestions tracking
  aiSuggestions: {
    lastGenerated: Date,
    suggestions: [{
      name: String,
      category: String,
      reason: String,
      confidence: Number,
      selected: { type: Boolean, default: false },
      dismissed: { type: Boolean, default: false }
    }],
    userFeedback: {
      helpful: Number,
      notHelpful: Number
    }
  }
});

// Method to check if suggestions need refresh
RoomSchema.methods.needsSuggestionRefresh = function() {
  if (!this.aiSuggestions?.lastGenerated) return true;
  
  const hoursSinceGenerated = (Date.now() - this.aiSuggestions.lastGenerated) / (1000 * 60 * 60);
  return hoursSinceGenerated > 24; // Refresh every 24 hours
};

module.exports = mongoose.model("Room", RoomSchema);