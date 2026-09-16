const express = require('express');
const User = require('../models/User');
const Invoice = require('../models/Invoice');
const Payslip = require('../models/Payslip');
const { verifyToken, allowRoles } = require('../middleware/auth');

const router = express.Router();

router.get('/billing-overview', verifyToken, allowRoles('mainadmin', 'subadmin'), async (req, res) => {
  try {
    const unpaidInvoices = await Invoice.find({ status: 'unpaid' }).populate('student', 'name email').populate('teacher', 'name email').sort({ createdAt: -1 });
    const unpaidPayslips = await Payslip.find({ status: 'unpaid' }).populate('teacher', 'name email').populate('student', 'name email').sort({ createdAt: -1 });
    
    // Logic for finding ungenerated invoices/payslips
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    
    const students = await User.find({ role: 'student' });
    const teachers = await User.find({ role: 'teacher' });

    let ungeneratedInvoices = [];
    let ungeneratedPayslips = [];

    // Check students
    for (const student of students) {
      if (student.studentDetails && student.studentDetails.length > 0) {
        // Find if any invoice was created this month, or covers this month
        const invExists = await Invoice.findOne({ 
          student: student._id, 
          $or: [
            { createdAt: { $gte: startOfMonth, $lte: endOfMonth } },
            { billingPeriodStart: { $gte: startOfMonth, $lte: endOfMonth } }
          ]
        });
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
        // Teachers now get a payslip per student they teach
        for (const detail of teacher.teacherDetails) {
          if (!detail.studentId) continue;
          const slipExists = await Payslip.findOne({ 
            teacher: teacher._id,
            student: detail.studentId,
            $or: [
              { createdAt: { $gte: startOfMonth, $lte: endOfMonth } },
              { billingPeriodStart: { $gte: startOfMonth, $lte: endOfMonth } }
            ]
          });
          if (!slipExists) {
            const studentObj = students.find(s => s._id.toString() === detail.studentId.toString());
            const studentName = studentObj ? studentObj.name : 'Unknown Student';
            ungeneratedPayslips.push({
              teacherId: teacher._id,
              teacherName: teacher.name + ' - ' + studentName, // Merge names for simple display
              details: [detail]
            });
          }
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
