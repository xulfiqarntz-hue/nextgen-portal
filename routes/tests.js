const express = require('express');
const TestRecord = require('../models/TestRecord');
const { verifyToken, allowRoles } = require('../middleware/auth');

const router = express.Router();

// Teacher creates a test record
router.post('/', verifyToken, allowRoles('teacher'), async (req, res) => {
  try {
    const { studentId, title, score, totalMarks } = req.body;
    const testRecord = new TestRecord({
      studentId,
      teacherId: req.user.id,
      title,
      score,
      totalMarks
    });
    await testRecord.save();
    res.status(201).json(testRecord);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Teacher gets all their test records
router.get('/teacher', verifyToken, allowRoles('teacher'), async (req, res) => {
  try {
    const records = await TestRecord.find({ teacherId: req.user.id })
      .populate('studentId', 'name')
      .sort({ createdAt: -1 });
    res.json(records);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Student gets all their test records
router.get('/student', verifyToken, allowRoles('student'), async (req, res) => {
  try {
    const records = await TestRecord.find({ studentId: req.user.id })
      .populate('teacherId', 'name')
      .sort({ createdAt: -1 });
    res.json(records);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin gets all test records (optional, for mainadmin dashboard)
router.get('/all', verifyToken, allowRoles('mainadmin', 'subadmin'), async (req, res) => {
  try {
    const records = await TestRecord.find()
      .populate('studentId', 'name')
      .populate('teacherId', 'name')
      .sort({ createdAt: -1 });
    res.json(records);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
