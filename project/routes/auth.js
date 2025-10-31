const express = require("express");
const router = express.Router();
const User = require("../models/User");
const Device = require("../models/Device");

// Utility function to send token response
const sendTokenResponse = (user, statusCode, res) => {
  const token = user.getSignedJwtToken();
  res.status(statusCode).json({ success: true, token });
};

// @desc    Register a new user and their first device
// @route   POST /api/auth/register
// @access  Public
router.post("/register", async (req, res) => {
  try {
    const { email, password, deviceId } = req.body;

    if (!email || !password || !deviceId) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Please provide email, password, and deviceId",
        });
    }

    // Check if user already exists
    if (await User.findOne({ email })) {
      return res
        .status(400)
        .json({ success: false, message: "Email already in use" });
    }

    // Check if deviceId is already registered
    if (await Device.findOne({ deviceId })) {
      return res
        .status(440)
        .json({ success: false, message: "Device ID already registered" });
    }

    // Create user
    const user = await User.create({
      email,
      password,
      name: email.split("@")[0], // Default name
    });

    // Create and link first device (Req 2.1)
    await Device.create({
      user: user._id,
      deviceId: deviceId,
      name: "Initial Device", // Default name
    });

    // Create token and send response
    sendTokenResponse(user, 201, res);
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
});

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ success: false, message: "Please provide email and password" });
    }

    // Find user
    const user = await User.findOne({ email }).select("+password");
    if (!user) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid credentials" });
    }

    // Check if password matches
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid credentials" });
    }

    // Create token and send response
    sendTokenResponse(user, 200, res);
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
});

module.exports = router;
