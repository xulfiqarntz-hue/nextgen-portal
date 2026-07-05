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

router.get('/my-students', require('../middleware/auth').verifyToken, require('../middleware/auth').allowRoles('teacher'), async (req, res) => {
  try {
    const teacher = await User.findById(req.user.id).populate('assignedStudents', 'name email');
    res.json({ students: teacher.assignedStudents });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/my-teacher', require('../middleware/auth').verifyToken, require('../middleware/auth').allowRoles('student'), async (req, res) => {
  try {
    const student = await User.findById(req.user.id).populate('assignedTeacher', 'name email');
    res.json({ teacher: student.assignedTeacher });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/all-users', require('../middleware/auth').verifyToken, require('../middleware/auth').allowRoles('mainadmin', 'subadmin'), async (req, res) => {
  try {
    const students = await User.find({ role: 'student' }, 'name email');
    const teachers = await User.find({ role: 'teacher' }, 'name email');
    res.json({ students, teachers });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
