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
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    
    const students = await User.find({ role: 'student' });
    const teachers = await User.find({ role: 'teacher' });

    let ungeneratedInvoices = [];
    let ungeneratedPayslips = [];

    // Check students
    for (const student of students) {
      if (student.studentDetails && student.studentDetails.length > 0) {
        const groups = {};
        for (const detail of student.studentDetails) {
           if (!detail.joiningDate) continue;
           const dt = new Date(detail.joiningDate);
           if (isNaN(dt.getTime())) continue;
           const key = dt.getDate();
           if (!groups[key]) groups[key] = { date: detail.joiningDate, details: [] };
           groups[key].details.push(detail);
        }
        
        for (const key in groups) {
           const group = groups[key];
           const cycleDate = new Date(group.date);
           // Timezone safe window: +/- 1.5 days around the expected cycle
           const startOfDay = new Date(Date.UTC(now.getFullYear(), now.getMonth(), cycleDate.getDate() - 1, 0, 0, 0));
           const endOfDay = new Date(Date.UTC(now.getFullYear(), now.getMonth(), cycleDate.getDate() + 1, 23, 59, 59, 999));
           
           const invExists = await Invoice.findOne({ 
             student: student._id, 
             $or: [
               { billingPeriodStart: { $gte: startOfDay, $lte: endOfDay } },
               { createdAt: { $gte: startOfMonth, $lte: endOfMonth }, billingPeriodStart: null }
             ]
           });
           if (!invExists) {
             ungeneratedInvoices.push({
               studentId: student._id,
               studentName: `${student.name} (Cycle: ${cycleDate.getDate()}th)`,
               details: group.details
             });
           }
        }
      }
    }

    // Check teachers
    for (const teacher of teachers) {
      if (teacher.teacherDetails && teacher.teacherDetails.length > 0) {
        const groups = {};
        for (const detail of teacher.teacherDetails) {
           if (!detail.startDate) continue;
           const dt = new Date(detail.startDate);
           if (isNaN(dt.getTime())) continue;
           const key = dt.getDate();
           if (!groups[key]) groups[key] = { date: detail.startDate, details: [] };
           groups[key].details.push(detail);
        }

        for (const key in groups) {
           const group = groups[key];
           const cycleDate = new Date(group.date);
           // Timezone safe window: +/- 1.5 days around the expected cycle
           const startOfDay = new Date(Date.UTC(now.getFullYear(), now.getMonth() - 1, cycleDate.getDate() - 1, 0, 0, 0));
           const endOfDay = new Date(Date.UTC(now.getFullYear(), now.getMonth() - 1, cycleDate.getDate() + 1, 23, 59, 59, 999));
           
           const slipExists = await Payslip.findOne({ 
             teacher: teacher._id,
             $or: [
               { billingPeriodStart: { $gte: startOfDay, $lte: endOfDay } },
               { createdAt: { $gte: startOfMonth, $lte: endOfMonth }, billingPeriodStart: null }
             ]
           });
           
           if (!slipExists) {
             ungeneratedPayslips.push({
               teacherId: teacher._id,
               teacherName: `${teacher.name} (Cycle: ${cycleDate.getDate()}th)`,
               details: group.details
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
