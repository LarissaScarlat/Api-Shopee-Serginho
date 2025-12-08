import express from "express";
import axios from "axios";

const router = express.Router();

router.get("/meu-ip", async (req, res) => {
  try {
    const response = await axios.get("https://api.ipify.org?format=json");
    res.json({ ip: response.data.ip });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

