const express = require("express");
const router = express.Router();
const Physician = require("../models/Physician");
const User = require("../models/User");
const Measurement = require("../models/Measurement");
const { protectPhysician } = require("../middleware/auth");

const formatDailySeries = (docs) => ({
  labels: docs.map((m) =>
    new Date(m.timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    })
  ),
  hr: docs.map((m) => m.heartRate),
  spo2: docs.map((m) => m.spo2),
});

const mapPhysician = (doc) => ({
  id: doc._id.toString(),
  name: doc.name,
  email: doc.email,
  specialty: doc.specialty || "",
  practiceName: doc.practiceName || "",
});

const sendAuthResponse = async (physician, statusCode, res) => {
  const token = physician.getSignedJwtToken();
  res
    .status(statusCode)
    .json({ success: true, token, physician: mapPhysician(physician) });
};

router.post("/register", async (req, res) => {
  try {
    const { name, email, password, specialty, practiceName, phone } = req.body;
    if (!name || !email || !password) {
      return res
        .status(400)
        .json({ success: false, message: "Missing required fields" });
    }

    if (await Physician.findOne({ email })) {
      return res
        .status(409)
        .json({ success: false, message: "Email already in use" });
    }

    const physician = await Physician.create({
      name,
      email,
      password,
      specialty,
      practiceName,
      phone,
    });

    await sendAuthResponse(physician, 201, res);
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

    const physician = await Physician.findOne({ email }).select("+password");
    if (!physician) {
      return res
        .status(404)
        .json({ success: false, message: "No account found" });
    }

    const isMatch = await physician.matchPassword(password);
    if (!isMatch) {
      return res
        .status(401)
        .json({ success: false, message: "Incorrect password" });
    }

    await sendAuthResponse(physician, 200, res);
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
});

router.get("/public", async (_req, res) => {
  const physicians = await Physician.find({})
    .select("name email specialty practiceName")
    .sort("name")
    .lean();

  res.status(200).json({
    success: true,
    data: physicians.map((doc) => ({
      id: doc._id.toString(),
      name: doc.name,
      email: doc.email,
      specialty: doc.specialty || "",
      practiceName: doc.practiceName || "",
    })),
  });
});

router.get("/me", protectPhysician, async (req, res) => {
  res
    .status(200)
    .json({ success: true, data: mapPhysician(req.physician) });
});

router.get("/patients", protectPhysician, async (req, res) => {
  try {
    const patients = await User.find({ physician: req.physician._id })
      .select("name email config")
      .lean();

    const patientIds = patients.map((p) => p._id);
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    sevenDaysAgo.setUTCHours(0, 0, 0, 0);

    const weeklyStats = await Measurement.aggregate([
      {
        $match: {
          user: { $in: patientIds },
          timestamp: { $gte: sevenDaysAgo },
        },
      },
      {
        $group: {
          _id: "$user",
          avgHeartRate: { $avg: "$heartRate" },
          minHeartRate: { $min: "$heartRate" },
          maxHeartRate: { $max: "$heartRate" },
        },
      },
    ]);

    const weeklyByUser = weeklyStats.reduce((acc, doc) => {
      acc[doc._id.toString()] = {
        avg: Math.round(doc.avgHeartRate || 0),
        min: Math.round(doc.minHeartRate || 0),
        max: Math.round(doc.maxHeartRate || 0),
      };
      return acc;
    }, {});

    res.status(200).json({
      success: true,
      data: patients.map((patient) => ({
        patientId: patient._id.toString(),
        patientName: patient.name,
        patientEmail: patient.email,
        measurementFrequency: patient.config?.frequency ?? 30,
        weeklyMetrics: weeklyByUser[patient._id.toString()] || {
          avg: 0,
          min: 0,
          max: 0,
        },
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
});

router.get("/patients/:patientId/daily", protectPhysician, async (req, res) => {
  try {
    const { patientId } = req.params;
    const dateStr = req.query.date;
    const patient = await User.findOne({
      _id: patientId,
      physician: req.physician._id,
    });
    if (!patient) {
      return res
        .status(404)
        .json({ success: false, message: "Patient not found" });
    }

    const date = dateStr ? new Date(dateStr) : new Date();
    const start = new Date(date);
    start.setUTCHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    const measurements = await Measurement.find({
      user: patient._id,
      timestamp: { $gte: start, $lt: end },
    })
      .sort("timestamp")
      .lean();

    res
      .status(200)
      .json({ success: true, data: formatDailySeries(measurements || []) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
});

router.put(
  "/patients/:patientId/frequency",
  protectPhysician,
  async (req, res) => {
    try {
      const { patientId } = req.params;
      const { frequency } = req.body;
      if (!frequency || Number(frequency) <= 0) {
        return res.status(400).json({
          success: false,
          message: "Please provide a valid frequency",
        });
      }

      const patient = await User.findOne({
        _id: patientId,
        physician: req.physician._id,
      });
      if (!patient) {
        return res
          .status(404)
          .json({ success: false, message: "Patient not found" });
      }

      patient.config.frequency = Number(frequency);
      await patient.save();

      res.status(200).json({
        success: true,
        data: {
          patientId: patient._id.toString(),
          measurementFrequency: patient.config.frequency,
        },
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: "Server Error" });
    }
  }
);

module.exports = router;
