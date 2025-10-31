// 1. IMPORTS
require("dotenv").config(); // Loads environment variables from .env file
const express = require("express");
const path = require("path");
const morgan = require("morgan");
const cors = require("cors");
const mongoose = require("mongoose");

// --- Import Route Files ---
const authRoutes = require("./routes/auth");
const accountRoutes = require("./routes/account");
const measurementRoutes = require("./routes/measurements");

// 2. INITIALIZATION
const app = express();
const PORT = 3000;
const MONGO_URI = process.env.MONGO_URI;

// 3. DATABASE CONNECTION
mongoose
  .connect(MONGO_URI)
  .then(() => console.log("MongoDB connected successfully."))
  .catch((err) => console.error("MongoDB connection error:", err));

// 4. MIDDLEWARE
app.use(cors()); // Enable Cross-Origin Resource Sharing
app.use(morgan("dev")); // Logger for incoming requests
app.use(express.json()); // Parse JSON request bodies

// 5. STATIC FILE SERVER
// Serve your frontend (app.html, app.js, index.html, etc.)
app.use(express.static(path.join(__dirname, "public")));

// 6. API ROUTES
// Connect your route files to specific URL paths
app.use("/api/auth", authRoutes);
app.use("/api/account", accountRoutes);
app.use("/api/measurements", measurementRoutes);

// 7. CATCH-ALL FOR FRONTEND
// This sends all other non-API requests to your app.html
// This is important for a Single Page Application (SPA)
app.get("*", (req, res, next) => {
  // If the request is for an API route, it won't get here
  // So we can safely send the frontend app
  res.sendFile(path.join(__dirname, "public", "app.html"));
});

// 8. ERROR HANDLER
// A simple JSON-based error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    message: err.message || "An unexpected error occurred.",
    error: process.env.NODE_ENV === "development" ? err : {},
  });
});

// 9. START THE SERVER
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

module.exports = app;
