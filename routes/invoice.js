console.log('Invoice route loaded');
const express = require('express');
const Invoice = require('../models/Invoice');
const User = require('../models/User');
const { verifyToken, allowRoles } = require('../middleware/auth');

const router = express.Router();

router.get('/dummy', (req, res) => {
  res.json({ message: 'This is a dummy route for testing purposes.' });
});

router.post('/create', verifyToken, allowRoles('mainadmin', 'subadmin'), async (req, res) => {
  try {
    const { studentId, teacherId, month, payment, subjects, discount, arrears, bankAccountNo, bankName, className } = req.body;
    console.log('Invoice create request - className:', className);
    if (!studentId || !month) {
      return res.status(400).json({ error: 'Student and month are required.' });
    }

    const student = await User.findById(studentId);
    let teacher = null;
    if (teacherId) {
      teacher = await User.findById(teacherId);
      if (!teacher || teacher.role !== 'teacher') return res.status(400).json({ error: 'Invalid teacher selected.' });
    }
    if (!student || student.role !== 'student') return res.status(400).json({ error: 'Invalid student selected.' });

    let paymentNumber = 0;
    let finalSubjects = [];
    if (subjects && Array.isArray(subjects) && subjects.length > 0) {
      subjects.forEach(sub => {
        const amt = Number(sub.amount);
        if (sub.name && !isNaN(amt) && amt >= 0) {
          finalSubjects.push({ name: sub.name, amount: amt });
          paymentNumber += amt;
        }
      });
    } else if (payment != null) {
      paymentNumber = Number(payment);
    }

    const discountNumber = Number(discount) || 0;
    const arrearsNumber = Number(arrears) || 0;
    if (isNaN(paymentNumber) || paymentNumber < 0) return res.status(400).json({ error: 'Valid payment or subjects are required.' });
    if (isNaN(discountNumber) || discountNumber < 0) return res.status(400).json({ error: 'Discount must be a valid number.' });

    const total = paymentNumber - discountNumber + arrearsNumber;

    const invoice = new Invoice({
      student: student._id,
      teacher: teacher ? teacher._id : undefined,
      month,
      payment: paymentNumber,
      subjects: finalSubjects,
      discount: discountNumber,
      arrears: arrearsNumber,
      bankAccountNo: bankAccountNo || '',
      bankName: bankName || '',
      className: className || '',
      total,
      createdBy: req.user.id
    });
    await invoice.save();

    res.status(201).json({ message: 'Invoice generated successfully.', invoice });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/list', verifyToken, allowRoles('mainadmin', 'subadmin'), async (req, res) => {
  try {
    const invoices = await Invoice.find().populate('student', 'name email').populate('teacher', 'name email').sort({ createdAt: -1 });
    res.json({ invoices });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single invoice
router.get('/get/:id', verifyToken, allowRoles('mainadmin', 'subadmin'), async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id).populate('student', 'name email').populate('teacher', 'name email');
    if (!invoice) return res.status(404).json({ error: 'Invoice not found.' });
    res.json({ invoice });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete invoice
router.delete('/:id', verifyToken, allowRoles('mainadmin', 'subadmin'), async (req, res) => {
  try {
    console.log('DELETE /api/invoices/:id called for', req.params.id);
    const inv = await Invoice.findByIdAndDelete(req.params.id);
    if (!inv) return res.status(404).json({ error: 'Invoice not found.' });
    res.json({ message: 'Invoice deleted.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
