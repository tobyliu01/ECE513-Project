const jwt = require("jsonwebtoken");
const User = require("../models/User");

// Middleware to protect routes
exports.protect = async (req, res, next) => {
  let token;

  // Check headers for 'Bearer <token>'
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
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Add user object to the request (e.g., req.user)
    req.user = await User.findById(decoded.id);

    if (!req.user) {
      return res
        .status(401)
        .json({ success: false, message: "Not authorized, user not found" });
    }

    next(); // Call the next middleware or route handler
  } catch (err) {
    console.error(err);
    return res
      .status(401)
      .json({ success: false, message: "Not authorized, token failed" });
  }
};

// Middleware to protect the IoT device endpoint
exports.protectDevice = async (req, res, next) => {
  const apiKey = req.headers["x-api-key"];

  if (!apiKey || apiKey !== process.env.DEVICE_API_KEY) {
    return res.status(401).json({ success: false, message: "Invalid API Key" });
  }

  next();
};
