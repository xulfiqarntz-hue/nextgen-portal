const express = require('express');
const Timetable = require('../models/Timetable');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

// Get the global timetable
router.get('/', verifyToken, async (req, res) => {
  try {
    let timetable = await Timetable.findOne();
    if (!timetable) {
      timetable = new Timetable();
      await timetable.save();
    }
    res.json(timetable.data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update the global timetable
router.post('/', verifyToken, async (req, res) => {
  try {
    let timetable = await Timetable.findOne();
    if (!timetable) {
      timetable = new Timetable();
    }
    timetable.data = req.body;
    timetable.updatedAt = Date.now();
    
    // Use markModified because data is of Mixed type
    timetable.markModified('data');
    await timetable.save();
    
    res.json({ message: 'Timetable updated successfully', data: timetable.data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
