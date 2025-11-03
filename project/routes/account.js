const express = require("express");
const router = express.Router();
const User = require("../models/User");
const Device = require("../models/Device");
const Measurement = require("../models/Measurement");
const { protect } = require("../middleware/auth");
const buildUserPayload = require("./helpers/userPayload");

router.use(protect);

router.get("/me", async (req, res) => {
  try {
    const payload = await buildUserPayload(req.user.id);
    res.status(200).json({ success: true, data: payload });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
});

router.put("/me", async (req, res) => {
  try {
    const { name, password } = req.body;
    const user = await User.findById(req.user.id).select("+password");

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    if (name) {
      user.name = name;
    }

    if (password) {
      user.password = password;
    }

    await user.save();
    const payload = await buildUserPayload(req.user.id);
    res.status(200).json({ success: true, data: payload });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
});

router.put("/config", async (req, res) => {
  try {
    const { frequency, startTime, endTime } = req.body;

    const user = await User.findByIdAndUpdate(
      req.user.id,
      {
        config: { frequency, startTime, endTime },
      },
      { new: true, runValidators: true }
    ).lean();

    res.status(200).json({ success: true, data: user.config });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
});

router.get("/devices", async (req, res) => {
  try {
    const devices = await Device.find({ user: req.user.id }).lean();
    res.status(200).json({ success: true, data: devices });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
});

router.post("/devices", async (req, res) => {
  try {
    const { deviceId, name } = req.body;

    if (!deviceId || !name) {
      return res
        .status(400)
        .json({ success: false, message: "Please provide deviceId and name" });
    }

    if (await Device.findOne({ deviceId })) {
      return res
        .status(409)
        .json({ success: false, message: "Device ID already registered" });
    }

    const device = await Device.create({
      user: req.user.id,
      deviceId,
      name,
    });

    res.status(201).json({ success: true, data: device });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
});

router.put("/devices/:id", async (req, res) => {
  try {
    const { name } = req.body;
    const device = await Device.findById(req.params.id);

    if (!device) {
      return res
        .status(404)
        .json({ success: false, message: "Device not found" });
    }

    if (device.user.toString() !== req.user.id) {
      return res.status(401).json({
        success: false,
        message: "Not authorized to update this device",
      });
    }

    device.name = name;
    await device.save();

    res.status(200).json({ success: true, data: device });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
});

router.delete("/devices/:id", async (req, res) => {
  try {
    const device = await Device.findById(req.params.id);

    if (!device) {
      return res
        .status(404)
        .json({ success: false, message: "Device not found" });
    }

    if (device.user.toString() !== req.user.id) {
      return res.status(401).json({
        success: false,
        message: "Not authorized to remove this device",
      });
    }

    await Measurement.deleteMany({ device: req.params.id });
    await device.deleteOne();

    res.status(200).json({ success: true, data: {} });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
});

module.exports = router;
