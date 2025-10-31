const mongoose = require("mongoose");

const DeviceSchema = new mongoose.Schema(
  {
    // The user who owns this device
    user: {
      type: mongoose.Schema.ObjectId,
      ref: "User",
      required: true,
    },
    // The physical device's unique ID (e.g., A1B2C3)
    deviceId: {
      type: String,
      required: [true, "Please provide a device ID"],
      unique: true,
    },
    // A friendly name (e.g., "Bedroom Monitor")
    name: {
      type: String,
      required: [true, "Please provide a device name"],
      trim: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Device", DeviceSchema);
