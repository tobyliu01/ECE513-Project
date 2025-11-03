const express = require("express");
const router = express.Router();
const User = require("../models/User");
const Device = require("../models/Device");
const buildUserPayload = require("./helpers/userPayload");

const sendAuthResponse = async (user, statusCode, res) => {
  const token = user.getSignedJwtToken();
  const payload = await buildUserPayload(user._id);
  res.status(statusCode).json({ success: true, token, user: payload });
};

router.post("/register", async (req, res) => {
  try {
    const { email, password, deviceId } = req.body;

    if (!email || !password || !deviceId) {
      return res.status(400).json({
        success: false,
        message: "Please provide email, password, and deviceId",
      });
    }

    if (await User.findOne({ email })) {
      return res
        .status(409)
        .json({ success: false, message: "Email already in use" });
    }

    if (await Device.findOne({ deviceId })) {
      return res
        .status(409)
        .json({ success: false, message: "Device ID already registered" });
    }

    const user = await User.create({
      email,
      password,
      name: email.split("@")[0],
    });

    await Device.create({
      user: user._id,
      deviceId,
      name: "Initial Device",
    });

    await sendAuthResponse(user, 201, res);
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ success: false, message: "Please provide email and password" });
    }

    const user = await User.findOne({ email }).select("+password");
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "No account found with this email.",
      });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Incorrect password. Please try again.",
      });
    }

    await sendAuthResponse(user, 200, res);
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
});

module.exports = router;
