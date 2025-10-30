const express = require('express');
const router = express.Router();
const Measurement = require('../models/Measurement');
const Device = require('../models/Device');
const { protect, protectDevice } = require('../middleware/auth');

// --- IoT Device Endpoint ---

// @desc    IoT device posts new measurement
// @route   POST /api/measurements
// @access  Private (Device API Key)
router.post('/', protectDevice, async (req, res) => {
    try {
        const { deviceId, heartRate, spo2 } = req.body;

        if (!deviceId || heartRate === undefined || spo2 === undefined) {
            return res.status(400).json({ success: false, message: 'Missing required fields: deviceId, heartRate, spo2' });
        }
        
        // Find the device in the database
        const device = await Device.findOne({ deviceId });
        if (!device) {
            return res.status(404).json({ success: false, message: 'Device not registered' });
        }

        // Create new measurement
        const measurement = await Measurement.create({
            device: device._id,
            user: device.user, // User is linked from the device
            heartRate,
            spo2,
            timestamp: new Date()
        });

        res.status(201).json({ success: true, data: measurement });

    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
});

// --- Web App Endpoints ---

// @desc    Get detailed daily measurements (Req 4.4)
// @route   GET /api/measurements/daily
// @access  Private (User Token)
router.get('/daily', protect, async (req, res) => {
    try {
        const dateStr = req.query.date; // Expects "YYYY-MM-DD"
        if (!dateStr) {
            return res.status(400).json({ success: false, message: "Please provide a 'date' query parameter." });
        }

        const startDate = new Date(dateStr);
        startDate.setUTCHours(0, 0, 0, 0);

        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 1);

        const measurements = await Measurement.find({
            user: req.user.id,
            timestamp: {
                $gte: startDate,
                $lt: endDate
            }
        }).sort('timestamp'); // Sort by time (Req 4.5)

        res.status(200).json({ success: true, data: measurements });

    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
});

// @desc    Get weekly summary (avg, min, max) (Req 4.3)
// @route   GET /api/measurements/weekly
// @access  Private (User Token)
router.get('/weekly', protect, async (req, res) => {
    try {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        sevenDaysAgo.setUTCHours(0, 0, 0, 0);

        const summary = await Measurement.aggregate([
            {
                // Find measurements for this user in the last 7 days
                $match: {
                    user: req.user._id,
                    timestamp: { $gte: sevenDaysAgo }
                }
            },
            {
                // Group them to calculate stats
                $group: {
                    _id: null, // Group all as one
                    avgHeartRate: { $avg: '$heartRate' },
                    minHeartRate: { $min: '$heartRate' },
                    maxHeartRate: { $max: '$heartRate' }
                }
            }
        ]);

        if (summary.length === 0) {
            // No data for the last 7 days
            return res.status(200).json({ 
                success: true, 
                data: { avgHeartRate: 0, minHeartRate: 0, maxHeartRate: 0 } 
            });
        }
        
        // Return the first (and only) element from the summary
        res.status(200).json({ success: true, data: summary[0] });

    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
});

module.exports = router;