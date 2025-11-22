// Routes for ingesting and querying heart-rate/SpO2 measurements.
const express = require("express");
const User = require("../models/User");
const router = express.Router();
const Measurement = require("../models/Measurement");
const Device = require("../models/Device");
const { protect, protectDevice } = require("../middleware/auth");

// Normalize raw measurement docs into chart-friendly shape.
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

// POST /api/measurements – device ingests a new measurement using API key.
router.post("/", protectDevice, async (req, res) => {
  try {
    // const { deviceId, heartRate, spo2 } = req.body;
    const { deviceId, heartRate, spo2, userId, deviceName } = req.body;
  
    if (!deviceId || heartRate === undefined || spo2 === undefined) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Missing required fields: deviceId, heartRate, spo2",
        });
    }


    const ensureDeviceRegistered = async () => {
      if (!userId) {
        const error = new Error(
          "Device not registered. Provide userId to auto-register this device."
        );
        error.statusCode = 400;
        throw error;
      }

      const user = await User.findById(userId);
      if (!user) {
        const error = new Error("User not found for userId");
        error.statusCode = 404;
        throw error;
      }

      return Device.create({
        user: user._id,
        deviceId,
        name: deviceName || `Device ${deviceId}`,
      });
    };

    // const device = await Device.findOne({ deviceId });
    // if (!device) {
    //   return res
    //     .status(404)
    //     .json({ success: false, message: "Device not registered" });
    // }
    const device =
      (await Device.findOne({ deviceId })) || (await ensureDeviceRegistered());


    const measurement = await Measurement.create({
      device: device._id,
      user: device.user,
      heartRate,
      spo2,
      timestamp: new Date(Date.now() - 7 * 60 * 60 * 1000),
    });

    res.status(201).json({ success: true, data: measurement });
  } catch (err) {
    console.error(err);
    if (err.statusCode) {
      return res
        .status(err.statusCode)
        .json({ success: false, message: err.message });
    }
    res.status(500).json({ success: false, message: "Server Error" });
  }
});

// GET /api/measurements/daily – return time-series data for selected day.
router.get("/daily", protect, async (req, res) => {
  try {
    const dateStr = req.query.date;
    if (!dateStr) {
      return res
        .status(400)
        .json({
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

// GET /api/measurements/weekly – aggregate last 7 days into summary stats.
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

    const stats =
      summary[0] || { avgHeartRate: 0, minHeartRate: 0, maxHeartRate: 0 };

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