const express = require('express');
const User = require('../models/User');
const Invoice = require('../models/Invoice');
const Payslip = require('../models/Payslip');
const { verifyToken, allowRoles } = require('../middleware/auth');

const router = express.Router();

router.get('/billing-overview', verifyToken, allowRoles('mainadmin', 'subadmin'), async (req, res) => {
  try {
    const unpaidInvoices = await Invoice.find({ status: 'unpaid' }).populate('student', 'name email').populate('teacher', 'name email').sort({ createdAt: -1 });
    const unpaidPayslips = await Payslip.find({ status: 'unpaid' }).populate('teacher', 'name email').sort({ createdAt: -1 });
    
    // Logic for finding ungenerated invoices/payslips
    const now = new Date();
    const currentMonth = `${now.toLocaleString('default', { month: 'short' })} ${now.getFullYear()}`;
    
    const students = await User.find({ role: 'student' });
    const teachers = await User.find({ role: 'teacher' });

    let ungeneratedInvoices = [];
    let ungeneratedPayslips = [];

    // Check students
    for (const student of students) {
      if (student.studentDetails && student.studentDetails.length > 0) {
        // Just checking if any invoice exists for the current month for this student
        const invExists = await Invoice.findOne({ student: student._id, month: currentMonth });
        if (!invExists) {
          ungeneratedInvoices.push({
            studentId: student._id,
            studentName: student.name,
            details: student.studentDetails
          });
        }
      }
    }

    // Check teachers
    for (const teacher of teachers) {
      if (teacher.teacherDetails && teacher.teacherDetails.length > 0) {
        // Just checking if any payslip exists for the current month for this teacher
        const slipExists = await Payslip.findOne({ teacher: teacher._id, month: currentMonth });
        if (!slipExists) {
          ungeneratedPayslips.push({
            teacherId: teacher._id,
            teacherName: teacher.name,
            details: teacher.teacherDetails
          });
        }
      }
    }

    res.json({
      unpaidInvoices,
      unpaidPayslips,
      ungeneratedInvoices,
      ungeneratedPayslips
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
