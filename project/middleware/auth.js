const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Physician = require("../models/Physician");

exports.protect = async (req, res, next) => {
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  }
  if (!token) {
    return res
      .status(401)
      .json({ success: false, message: "Not authorized, no token" });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id);
    if (!req.user) {
      return res
        .status(401)
        .json({ success: false, message: "Not authorized, user not found" });
    }
    next();
  } catch (err) {
    console.error(err);
    return res
      .status(401)
      .json({ success: false, message: "Not authorized, token failed" });
  }
};

exports.protectPhysician = async (req, res, next) => {
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  }
  if (!token) {
    return res
      .status(401)
      .json({ success: false, message: "Not authorized, no token" });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== "physician") {
      return res
        .status(401)
        .json({ success: false, message: "Not authorized for this route" });
    }
    req.physician = await Physician.findById(decoded.id);
    if (!req.physician) {
      return res
        .status(401)
        .json({ success: false, message: "Physician not found" });
    }
    next();
  } catch (err) {
    console.error(err);
    return res
      .status(401)
      .json({ success: false, message: "Not authorized, token failed" });
  }
};

exports.protectDevice = async (req, res, next) => {
  const apiKey = req.headers["x-api-key"];
  if (!apiKey || apiKey !== process.env.DEVICE_API_KEY) {
    return res.status(401).json({ success: false, message: "Invalid API Key" });
  }
  next();
};
