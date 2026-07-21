const express = require('express');
const User = require('../models/User');
const Message = require('../models/Message');
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

    res.json({ message: student.name + ' has been assigned to ' + teacher.name });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/deassign', verifyToken, allowRoles('mainadmin', 'subadmin'), async (req, res) => {
  try {
    const { studentId, teacherId } = req.body;
    const student = await User.findById(studentId);
    const teacher = await User.findById(teacherId);

    if (!student || student.role !== 'student') return res.status(400).json({ error: 'Invalid student ID' });
    if (!teacher || teacher.role !== 'teacher') return res.status(400).json({ error: 'Invalid teacher ID' });

    student.assignedTeachers = student.assignedTeachers.filter(id => id.toString() !== teacher._id.toString());
    await student.save();

    teacher.assignedStudents = teacher.assignedStudents.filter(id => id.toString() !== student._id.toString());
    await teacher.save();

    res.json({ message: student.name + ' has been unassigned from ' + teacher.name });
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

router.get('/admins', verifyToken, allowRoles('student', 'teacher'), async (req, res) => {
  try {
    const admins = await User.find({ role: { $in: ['mainadmin', 'subadmin'] } }, 'name email role');
    res.json({ admins });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/all-users', verifyToken, allowRoles('mainadmin', 'subadmin'), async (req, res) => {
  try {
    const students = await User.find({ role: 'student' }, 'name email assignedTeachers');
    const teachers = await User.find({ role: 'teacher' }, 'name email assignedStudents');
    let subadmins = [];
    if (req.user.role === 'mainadmin') {
      subadmins = await User.find({ role: 'subadmin' }, 'name email');
    }
    res.json({ students, teachers, subadmins });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/view/:studentId/:teacherId', verifyToken, allowRoles('mainadmin', 'subadmin'), async (req, res) => {
  try {
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

router.delete('/users/:userId', verifyToken, allowRoles('mainadmin', 'subadmin'), async (req, res) => {
  try {
    // Double-check the requester's role from the database to prevent role spoofing
    const requester = await User.findById(req.user.id);
    if (!requester) return res.status(403).json({ error: 'Requesting user not found' });
    if (requester.role !== 'mainadmin' && requester.role !== 'subadmin') return res.status(403).json({ error: 'Only Admins can delete users' });

    const targetUser = await User.findById(req.params.userId);
    if (!targetUser) return res.status(404).json({ error: 'User not found' });

    if (targetUser.role === 'mainadmin') {
      return res.status(403).json({ error: 'Cannot delete a Main Admin account' });
    }

    await User.updateMany({}, { $pull: { assignedTeachers: targetUser._id, assignedStudents: targetUser._id } });
    await User.findByIdAndDelete(req.params.userId);

    res.json({ message: targetUser.name + ' has been deleted. Their past chat messages remain preserved for record-keeping.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
