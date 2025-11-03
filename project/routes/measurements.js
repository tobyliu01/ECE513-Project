const express = require("express");
const router = express.Router();
const Measurement = require("../models/Measurement");
const Device = require("../models/Device");
const { protect, protectDevice } = require("../middleware/auth");

const formatDaily = (docs) => ({
  labels: docs.map((m) =>
    new Date(m.timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    })
  ),
  hr: docs.map((m) => m.heartRate),
  spo2: docs.map((m) => m.spo2),
});

router.post("/", protectDevice, async (req, res) => {
  try {
    const { deviceId, heartRate, spo2 } = req.body;

    if (!deviceId || heartRate === undefined || spo2 === undefined) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: deviceId, heartRate, spo2",
      });
    }

    const device = await Device.findOne({ deviceId });
    if (!device) {
      return res
        .status(404)
        .json({ success: false, message: "Device not registered" });
    }

    const measurement = await Measurement.create({
      device: device._id,
      user: device.user,
      heartRate,
      spo2,
      timestamp: new Date(),
    });

    res.status(201).json({ success: true, data: measurement });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
});

router.get("/daily", protect, async (req, res) => {
  try {
    const dateStr = req.query.date;
    if (!dateStr) {
      return res.status(400).json({
        success: false,
        message: "Please provide a 'date' query parameter.",
      });
    }

    const startDate = new Date(dateStr);
    startDate.setUTCHours(0, 0, 0, 0);

    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 1);

    const measurements = await Measurement.find({
      user: req.user.id,
      timestamp: {
        $gte: startDate,
        $lt: endDate,
      },
    })
      .sort("timestamp")
      .lean();

    res
      .status(200)
      .json({ success: true, data: formatDaily(measurements || []) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
});

router.get("/weekly", protect, async (req, res) => {
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    sevenDaysAgo.setUTCHours(0, 0, 0, 0);

    const summary = await Measurement.aggregate([
      {
        $match: {
          user: req.user._id,
          timestamp: { $gte: sevenDaysAgo },
        },
      },
      {
        $group: {
          _id: null,
          avgHeartRate: { $avg: "$heartRate" },
          minHeartRate: { $min: "$heartRate" },
          maxHeartRate: { $max: "$heartRate" },
        },
      },
    ]);

    const stats = summary[0] || {
      avgHeartRate: 0,
      minHeartRate: 0,
      maxHeartRate: 0,
    };

    res.status(200).json({
      success: true,
      data: {
        avg: Math.round(stats.avgHeartRate || 0),
        min: Math.round(stats.minHeartRate || 0),
        max: Math.round(stats.maxHeartRate || 0),
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
});

module.exports = router;
