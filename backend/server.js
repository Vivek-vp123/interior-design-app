const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

require("dotenv").config();

const path = require("path");

const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/user");
const suggestionsRoutes = require("./routes/suggestions");

const app = express();

// Middleware
app.use(express.json());
app.use(cors());

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/upload", require("./routes/upload"));
app.use("/uploads", express.static("uploads")); // serve files
app.use("/api/suggestions", suggestionsRoutes);

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Serve outputs from segmentation_service
app.use(
  "/outputs",
  express.static(path.join(__dirname, "../segmentation_service/outputs"))
);



// MongoDB Connection
mongoose
  .connect("mongodb://127.0.0.1:27017/interior_design", {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => console.error("❌ MongoDB Error:", err));

// Start Server
app.listen(5000, () => console.log("🚀 Backend running on http://localhost:5000"));