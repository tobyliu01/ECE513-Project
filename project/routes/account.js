const express = require("express");
const router = express.Router();
const User = require("../models/User");
const Device = require("../models/Device");
const Measurement = require("../models/Measurement");
const { protect } = require("../middleware/auth");
const buildUserPayload = require("./helpers/userPayload");

// All endpoints below require a valid user JWT.
router.use(protect);

// GET /api/account/me – fetch current user's profile snapshot.
router.get("/me", async (req, res) => {
  try {
    const payload = await buildUserPayload(req.user.id);
    res.status(200).json({ success: true, data: payload });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
});

// PUT /api/account/me – update name/password, then return refreshed payload.
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

// PUT /api/account/config – update measurement preferences.
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

// GET /api/account/devices – list all devices owned by current user.
router.get("/devices", async (req, res) => {
  try {
    const devices = await Device.find({ user: req.user.id }).lean();
    res.status(200).json({ success: true, data: devices });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
});

// POST /api/account/devices – register a new device after validation.
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

// PUT /api/account/devices/:id – rename a device if user owns it.
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

// DELETE /api/account/devices/:id – remove device and its measurements.
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


const Physician = require("../models/Physician");
// GET /api/account/physician 
router.get("/physician", async (req, res) => {
  try {
    const payload = await buildUserPayload(req.user.id);
    res.status(200).json({ success: true, data: payload.physician });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
});

async function syncPhysicianAssignments(user, nextPhysicianId) {
  if (user.physician && (!nextPhysicianId || user.physician.toString() !== nextPhysicianId.toString())) {
    await Physician.findByIdAndUpdate(user.physician, {
      $pull: { patients: user._id },
    });
  }
  if (nextPhysicianId) {
    await Physician.findByIdAndUpdate(nextPhysicianId, {
      $addToSet: { patients: user._id },
    });
  }
}

// PUT /api/account/physician 
router.put("/physician", async (req, res) => {
  try {
    const { physicianId } = req.body;
    if (!physicianId) {
      return res
        .status(400)
        .json({ success: false, message: "Please provide physicianId" });
    }

    const physician = await Physician.findById(physicianId);
    console.log("[PUT /account/physician] user:", req.user.id, "physicianId:", physicianId);

    if (!physician) {
      return res
        .status(404)
        .json({ success: false, message: "Physician not found" });
    }

    const user = await User.findById(req.user.id);
    await syncPhysicianAssignments(user, physician._id);
    user.physician = physician._id;
    user.physicianAssignedAt = new Date();
    await user.save();

    const payload = await buildUserPayload(user._id);
    res.status(200).json({ success: true, data: payload });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
});

// DELETE /api/account/physician
router.delete("/physician", async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    await syncPhysicianAssignments(user, null);
    user.physician = null;
    user.physicianAssignedAt = null;
    await user.save();

    const payload = await buildUserPayload(user._id);
    res.status(200).json({ success: true, data: payload });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
});


module.exports = router;
