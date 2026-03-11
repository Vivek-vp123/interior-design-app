const express = require("express");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const auth = require("../middleware/auth"); // your JWT middleware

const router = express.Router();

// GET /api/user/me
router.get("/me", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    if (!user) return res.status(404).json({ msg: "User not found" });

    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const path = require('path');
const fs = require('fs');

router.get('/catalog', async (req, res) => {
  try {
    const catalogPath = path.join(__dirname, '../data/catalog.json');
    const data = fs.readFileSync(catalogPath, 'utf-8');
    const catalog = JSON.parse(data);
    res.json(catalog);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load catalog.' });
  }
});

module.exports = router;