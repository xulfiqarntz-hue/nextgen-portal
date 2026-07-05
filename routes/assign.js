const express = require('express');
const User = require('../models/User');
const { verifyToken, allowRoles } = require('../middleware/auth');

const router = express.Router();

router.post('/assign', verifyToken, allowRoles('mainadmin', 'subadmin'), async (req, res) => {
  try {
    const { studentId, teacherId } = req.body;

    const student = await User.findById(studentId);
    const teacher = await User.findById(teacherId);

    if (!student || student.role !== 'student') {
      return res.status(400).json({ error: 'Invalid student ID' });
    }
    if (!teacher || teacher.role !== 'teacher') {
      return res.status(400).json({ error: 'Invalid teacher ID' });
    }

    student.assignedTeacher = teacher._id;
    await student.save();

    if (!teacher.assignedStudents.includes(student._id)) {
      teacher.assignedStudents.push(student._id);
      await teacher.save();
    }

    res.json({ message: `${student.name} has been assigned to ${teacher.name}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
