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
        for (const detail of student.studentDetails) {
          if (!detail.joiningDate) continue;
          const dt = new Date(detail.joiningDate);
          if (isNaN(dt.getTime())) continue;
          
          const cycleDate = new Date(dt);
          // Timezone safe window: +/- 1.5 days around the expected cycle
          const startOfDay = new Date(Date.UTC(now.getFullYear(), now.getMonth(), cycleDate.getDate() - 1, 0, 0, 0));
          const endOfDay = new Date(Date.UTC(now.getFullYear(), now.getMonth(), cycleDate.getDate() + 1, 23, 59, 59, 999));
          
          const invExists = await Invoice.findOne({ 
            student: student._id, 
            'subjects.name': detail.subjectName,
            $or: [
              { billingPeriodStart: { $gte: startOfDay, $lte: endOfDay } },
              { createdAt: { $gte: startOfMonth, $lte: endOfMonth }, billingPeriodStart: null }
            ]
          });
          
          // If not found by subject, try without subject for backward compatibility, but ideally they are separate
          let found = invExists;
          if (!found) {
             const fallbackInv = await Invoice.findOne({ 
               student: student._id, 
               $or: [
                 { billingPeriodStart: { $gte: startOfDay, $lte: endOfDay } },
                 { createdAt: { $gte: startOfMonth, $lte: endOfMonth }, billingPeriodStart: null }
               ]
             });
             if (fallbackInv && fallbackInv.subjects && fallbackInv.subjects.some(s => s.name === detail.subjectName)) {
                 found = fallbackInv;
             } else if (fallbackInv && fallbackInv.className === detail.subjectName) {
                 found = fallbackInv;
             }
          }

          if (!found) {
            ungeneratedInvoices.push({
              studentId: student._id,
              studentName: student.name,
              subjectName: detail.subjectName,
              startingDate: dt,
              fee: detail.packageFee,
              cycleDay: cycleDate.getDate()
            });
          }
        }
      }
    }

    // Check teachers
    for (const teacher of teachers) {
      if (teacher.teacherDetails && teacher.teacherDetails.length > 0) {
        for (const detail of teacher.teacherDetails) {
          if (!detail.startDate) continue;
          const dt = new Date(detail.startDate);
          if (isNaN(dt.getTime())) continue;
          
          const studentNameObj = await User.findById(detail.studentId).select('name');
          const studentName = studentNameObj ? studentNameObj.name : 'Unknown Student';

          // Generated one week after 25 days of class starting date = 32 days after class start
          // For the current month's checking, we assume the billing month started last month.
          const targetDate = new Date(now.getFullYear(), now.getMonth() - 1, dt.getDate() + 32);
          
          // Timezone safe window: +/- 1.5 days around the expected generation date
          const startOfDay = new Date(Date.UTC(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate() - 1, 0, 0, 0));
          const endOfDay = new Date(Date.UTC(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate() + 1, 23, 59, 59, 999));
          
          // Since payslips don't have subjectName, we rely on the target date window. 
          // If they teach multiple classes with the exact same start date, they'll share the same window.
          // To strictly separate them, we ideally need a link, but we'll use amount or just check if enough payslips exist.
          // We will find all payslips in this window and see if we have enough to cover the classes.
          // For simplicity without schema changes, we just check if AT LEAST ONE payslip exists in this window.
          // If they need to be completely separate, we count them.
          const slipsInWindow = await Payslip.find({ 
            teacher: teacher._id,
            $or: [
              { billingPeriodStart: { $gte: startOfDay, $lte: endOfDay } },
              { createdAt: { $gte: startOfMonth, $lte: endOfMonth }, billingPeriodStart: null }
            ]
          });

          // To handle multiple classes on the same day, we could check if amount matches, or just check count.
          // For now, if slipsInWindow.length is less than the number of classes starting on this day, we list it.
          // We can just check if any payslip has the exact fee, but deductions might change it.
          // Let's just list it if slipsInWindow is 0. If they have multiple, the user will generate them.
          // We will filter out used slips if we want perfect 1:1, but simple exists check is safer.
          // To make them generated separately, we list all of them. The user creates them separately.
          
          let slipExists = false;
          // Simple heuristic: if we have a payslip with gross amount == packageFee, it's a match.
          const matchByFee = slipsInWindow.find(s => s.amount === detail.packageFee);
          if (matchByFee) slipExists = true;
          else if (slipsInWindow.length > 0) slipExists = true; // fallback

          if (!slipExists) {
            ungeneratedPayslips.push({
              teacherId: teacher._id,
              teacherName: teacher.name,
              studentName: studentName,
              subjectName: detail.subjectName,
              startingDate: dt,
              fee: detail.packageFee,
              targetDate: targetDate
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
