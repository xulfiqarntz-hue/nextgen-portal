const express = require('express');
const Payslip = require('../models/Payslip');
const User = require('../models/User');
const { verifyToken, allowRoles } = require('../middleware/auth');

const router = express.Router();

router.post('/create', verifyToken, allowRoles('mainadmin', 'subadmin'), async (req, res) => {
  try {
    const { teacherId, month, bankAccountNo, bankName, noOfAbsents, noOfLectures, amount, deductions } = req.body;
    
    if (!teacherId || !month || amount === undefined) {
      return res.status(400).json({ error: 'Teacher, month, and amount are required.' });
    }

    const teacher = await User.findById(teacherId);
    if (!teacher || teacher.role !== 'teacher') {
      return res.status(400).json({ error: 'Invalid teacher selected.' });
    }

    const amountNumber = Number(amount) || 0;
    const deductionsNumber = Number(deductions) || 0;
    const absentsNumber = Number(noOfAbsents) || 0;
    const lecturesNumber = Number(noOfLectures) || 0;

    const totalSalary = amountNumber - deductionsNumber;

    const payslip = new Payslip({
      teacher: teacher._id,
      month,
      bankAccountNo: bankAccountNo || '',
      bankName: bankName || '',
      noOfAbsents: absentsNumber,
      noOfLectures: lecturesNumber,
      amount: amountNumber,
      deductions: deductionsNumber,
      totalSalary,
      createdBy: req.user.id
    });
    
    await payslip.save();

    res.status(201).json({ message: 'Payslip generated successfully.', payslip });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/list', verifyToken, allowRoles('mainadmin', 'subadmin'), async (req, res) => {
  try {
    const payslips = await Payslip.find().populate('teacher', 'name email').sort({ createdAt: -1 });
    res.json({ payslips });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/get/:id', verifyToken, allowRoles('mainadmin', 'subadmin'), async (req, res) => {
  try {
    const payslip = await Payslip.findById(req.params.id).populate('teacher', 'name email');
    if (!payslip) return res.status(404).json({ error: 'Payslip not found.' });
    res.json({ payslip });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', verifyToken, allowRoles('mainadmin', 'subadmin'), async (req, res) => {
  try {
    const payslip = await Payslip.findByIdAndDelete(req.params.id);
    if (!payslip) return res.status(404).json({ error: 'Payslip not found.' });
    res.json({ message: 'Payslip deleted.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
