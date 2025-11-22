const mongoose = require("mongoose");

const MeasurementSchema = new mongoose.Schema({
  // The device that took this measurement
  device: {
    type: mongoose.Schema.ObjectId,
    ref: "Device",
    required: true,
  },
  // The user who owns the device
  user: {
    type: mongoose.Schema.ObjectId,
    ref: "User",
    required: true,
  },
  heartRate: {
    type: Number,
    required: [true, "Please provide a heart rate"],
  },
  spo2: {
    type: Number,
    required: [true, "Please provide a blood oxygen level"],
  },
  // The timestamp from the device
  timestamp: {
    type: Date,
    default: Date.now,
    // default: () => moment().tz("America/Los_Angeles").toDate(),
    required: true,
  },
  // timestamp: {
  //   type: Date,
  //   default: () => new Date(Date.now() - 7 * 60 * 60 * 1000),
  //   required: true,
  // },
});


module.exports = mongoose.model("Measurement", MeasurementSchema);
