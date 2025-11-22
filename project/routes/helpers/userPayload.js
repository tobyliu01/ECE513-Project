// // Helper to build the standardized user payload consumed by the frontend.
// const User = require("../../models/User");
// const Device = require("../../models/Device");

// // Fetch user and devices concurrently, then map to lightweight DTO.
// async function buildUserPayload(userId) {
//   const [userDoc, deviceDocs] = await Promise.all([
//     User.findById(userId).lean(),
//     Device.find({ user: userId }).lean(),
//   ]);

//   if (!userDoc) {
//     return null;
//   }

//   return {
//     id: userDoc._id.toString(),
//     email: userDoc.email,
//     name: userDoc.name,
//     config: userDoc.config,
//     devices: deviceDocs.map((device) => ({
//       mongoId: device._id.toString(),
//       deviceId: device.deviceId,
//       name: device.name,
//     })),
//   };
// }

// // Export for reuse across auth/account routes.
// module.exports = buildUserPayload;

const User = require("../../models/User");
const Device = require("../../models/Device");

async function buildUserPayload(userId) {
  const [userDoc, deviceDocs] = await Promise.all([
    User.findById(userId)
      .populate("physician", "name email specialty practiceName")
      .lean(),
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
    physician: userDoc.physician
      ? {
          id: userDoc.physician._id.toString(),
          name: userDoc.physician.name,
          email: userDoc.physician.email,
          specialty: userDoc.physician.specialty || "",
          practiceName: userDoc.physician.practiceName || "",
          assignedAt: userDoc.physicianAssignedAt,
        }
      : null,
    devices: deviceDocs.map((device) => ({
      mongoId: device._id.toString(),
      deviceId: device.deviceId,
      name: device.name,
    })),
  };
}

module.exports = buildUserPayload;
