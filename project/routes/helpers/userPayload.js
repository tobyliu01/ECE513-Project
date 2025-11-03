const User = require("../../models/User");
const Device = require("../../models/Device");

async function buildUserPayload(userId) {
  const [userDoc, deviceDocs] = await Promise.all([
    User.findById(userId).lean(),
    Device.find({ user: userId }).lean(),
  ]);

  if (!userDoc) {
    return null;
  }

  return {
    id: userDoc._id.toString(),
    email: userDoc.email,
    name: userDoc.name,
    config: userDoc.config,
    devices: deviceDocs.map((device) => ({
      mongoId: device._id.toString(),
      deviceId: device.deviceId,
      name: device.name,
    })),
  };
}

module.exports = buildUserPayload;
