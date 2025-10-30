const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Device = require('../models/Device');
const Measurement = require('../models/Measurement');
const { protect } = require('../middleware/auth');

// All routes in this file are protected
router.use(protect);

// @desc    Get current user details (name, email, config)
// @route   GET /api/account/me
// @access  Private
router.get('/me', (req, res) => {
    // req.user is attached by the 'protect' middleware
    res.status(200).json({ success: true, data: req.user });
});

// @desc    Update user details (name, password) (Req 2.2)
// @route   PUT /api/account/me
// @access  Private
router.put('/me', async (req, res) => {
    try {
        const { name, password } = req.body;
        const user = await User.findById(req.user.id);

        if (name) {
            user.name = name;
        }

        // Only update password if it's provided
        if (password) {
            user.password = password;
        }

        await user.save();
        res.status(200).json({ success: true, data: user });

    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
});

// @desc    Update user measurement configuration (Req 4.8)
// @route   PUT /api/account/config
// @access  Private
router.put('/config', async (req, res) => {
    try {
        const { frequency, startTime, endTime } = req.body;

        const user = await User.findByIdAndUpdate(req.user.id, {
            config: { frequency, startTime, endTime }
        }, { new: true, runValidators: true }); // 'new: true' returns the updated doc

        res.status(200).json({ success: true, data: user.config });

    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
});

// --- Device Management ---

// @desc    Get all devices for current user
// @route   GET /api/account/devices
// @access  Private
router.get('/devices', async (req, res) => {
    try {
        const devices = await Device.find({ user: req.user.id });
        res.status(200).json({ success: true, data: devices });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
});

// @desc    Add a new device (Req 2.3)
// @route   POST /api/account/devices
// @access  Private
router.post('/devices', async (req, res) => {
    try {
        const { deviceId, name } = req.body;

        if (!deviceId || !name) {
            return res.status(400).json({ success: false, message: 'Please provide deviceId and name' });
        }

        // Check if deviceId is already registered
        if (await Device.findOne({ deviceId })) {
            return res.status(400).json({ success: false, message: 'Device ID already registered' });
        }

        const device = await Device.create({
            user: req.user.id,
            deviceId,
            name
        });

        res.status(201).json({ success: true, data: device });

    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
});

// @desc    Remove a device (Req 2.3)
// @route   DELETE /api/account/devices/:id
// @access  Private
router.delete('/devices/:id', async (req, res) => {
    try {
        const device = await Device.findById(req.params.id);

        if (!device) {
            return res.status(404).json({ success: false, message: 'Device not found' });
        }

        // Make sure user owns this device
        if (device.user.toString() !== req.user.id) {
            return res.status(401).json({ success: false, message: 'Not authorized to remove this device' });
        }

        // Delete all measurements associated with this device
        await Measurement.deleteMany({ device: req.params.id });

        // Delete the device
        await device.deleteOne();

        res.status(200).json({ success: true, data: {} });

    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
});

module.exports = router;