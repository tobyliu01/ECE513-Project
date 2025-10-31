const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const UserSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: [true, "Please provide an email"],
      unique: true,
      match: [
        /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
        "Please provide a valid email",
      ],
    },
    password: {
      type: String,
      required: [true, "Please provide a password"],
      minlength: 6,
      select: false, // Don't send password back in query results
    },
    name: {
      type: String,
      default: "New User",
    },
    // Measurement config (Req 4.8)
    config: {
      frequency: {
        type: Number, // in minutes
        default: 30,
      },
      startTime: {
        type: String, // "HH:MM"
        default: "08:00",
      },
      endTime: {
        type: String, // "HH:MM"
        default: "22:00",
      },
    },
  },
  { timestamps: true }
); // Adds createdAt and updatedAt

// This function runs BEFORE a user is saved to hash the password
UserSchema.pre("save", async function (next) {
  // Only hash the password if it has been modified
  if (!this.isModified("password")) {
    next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Helper function to compare entered password with hashed password
UserSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Helper function to sign a JWT token
UserSchema.methods.getSignedJwtToken = function () {
  return jwt.sign({ id: this._id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || "30d",
  });
};

module.exports = mongoose.model("User", UserSchema);
