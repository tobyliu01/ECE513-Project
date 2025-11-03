require("dotenv").config();

const express = require("express");
const path = require("path");
const morgan = require("morgan");
const cors = require("cors");
const mongoose = require("mongoose");

const authRoutes = require("./routes/auth");
const accountRoutes = require("./routes/account");
const measurementRoutes = require("./routes/measurements");

const app = express();
const PORT = process.env.PORT || 3000;

const connectionString = process.env.MONGO_URI;

mongoose
  .connect(connectionString)
  .then(() => console.log("MongoDB connected successfully."))
  .catch((err) => console.error("MongoDB connection error:", err));

app.use(cors());
app.use(morgan("dev"));
app.use(express.json());

app.use(express.static(path.join(__dirname, "public")));

app.use("/api/auth", authRoutes);
app.use("/api/account", accountRoutes);
app.use("/api/measurements", measurementRoutes);

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "app.html"));
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    message: err.message || "An unexpected error occurred.",
    error: process.env.NODE_ENV === "development" ? err : {},
  });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

module.exports = app;
