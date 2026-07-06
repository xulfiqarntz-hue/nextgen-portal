const express = require('express');
const User = require('../models/User');
const { verifyToken, allowRoles } = require('../middleware/auth');

const router = express.Router();

router.post('/assign', verifyToken, allowRoles('mainadmin', 'subadmin'), async (req, res) => {
  try {
    const { studentId, teacherId } = req.body;
    const student = await User.findById(studentId);
    const teacher = await User.findById(teacherId);

    if (!student || student.role !== 'student') return res.status(400).json({ error: 'Invalid student ID' });
    if (!teacher || teacher.role !== 'teacher') return res.status(400).json({ error: 'Invalid teacher ID' });

    if (!student.assignedTeachers.includes(teacher._id)) {
      student.assignedTeachers.push(teacher._id);
      await student.save();
    }
    if (!teacher.assignedStudents.includes(student._id)) {
      teacher.assignedStudents.push(student._id);
      await teacher.save();
    }

    res.json({ message: `${student.name} has been assigned to ${teacher.name}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/my-students', verifyToken, allowRoles('teacher'), async (req, res) => {
  try {
    const teacher = await User.findById(req.user.id).populate('assignedStudents', 'name email');
    res.json({ students: teacher.assignedStudents });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/my-teachers', verifyToken, allowRoles('student'), async (req, res) => {
  try {
    const student = await User.findById(req.user.id).populate('assignedTeachers', 'name email');
    res.json({ teachers: student.assignedTeachers });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/all-users', verifyToken, allowRoles('mainadmin', 'subadmin'), async (req, res) => {
  try {
    const students = await User.find({ role: 'student' }, 'name email');
    const teachers = await User.find({ role: 'teacher' }, 'name email');
    res.json({ students, teachers });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/view/:studentId/:teacherId', verifyToken, allowRoles('mainadmin', 'subadmin'), async (req, res) => {
  try {
    const Message = require('../models/Message');
    const messages = await Message.find({
      $or: [
        { sender: req.params.studentId, receiver: req.params.teacherId },
        { sender: req.params.teacherId, receiver: req.params.studentId }
      ]
    }).sort({ createdAt: 1 });
    res.json({ messages });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
