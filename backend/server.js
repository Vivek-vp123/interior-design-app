const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("node:path");
const fs = require("node:fs");
const axios = require("axios");

require("dotenv").config();

const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/user");
const suggestionsRoutes = require("./routes/suggestions");

const app = express();
const PORT = Number(process.env.PORT) || 5000;
const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/interior_design";
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || "http://localhost:3000";

app.use(express.json());
app.use(
  cors({
    origin: FRONTEND_ORIGIN,
    credentials: true,
  })
);

app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/upload", require("./routes/upload"));
app.use("/api/suggestions", suggestionsRoutes);

app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use("/outputs", express.static(path.join(__dirname, "../segmentation_service/outputs")));

// Fallback for distributed deployments where segmentation runs in a separate service.
app.get("/outputs/:file", async (req, res) => {
  const localPath = path.join(__dirname, "../segmentation_service/outputs", req.params.file);
  if (fs.existsSync(localPath)) {
    return res.sendFile(localPath);
  }

  const segmentationBase = (
    process.env.SEGMENTATION_PUBLIC_BASE ||
    process.env.SEGMENTATION_URL ||
    "http://127.0.0.1:8000"
  ).replace(/\/+$/, "");

  try {
    const remote = await axios.get(
      `${segmentationBase}/outputs/${encodeURIComponent(req.params.file)}`,
      {
        responseType: "stream",
        timeout: 15000,
      }
    );

    if (remote.headers["content-type"]) {
      res.setHeader("Content-Type", remote.headers["content-type"]);
    }
    remote.data.pipe(res);
  } catch (err) {
    console.error("Outputs proxy error:", err.message);
    res.status(404).json({ msg: "Output file not found" });
  }
});

mongoose
  .connect(MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => {
    console.error("MongoDB connection error:", err.message);
    console.error(
      "Check MONGO_URI, Atlas network access allowlist, and database user credentials."
    );
  });

app.listen(PORT, () => console.log(`Backend running on http://localhost:${PORT}`));
