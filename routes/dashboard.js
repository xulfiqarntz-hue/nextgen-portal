const express = require('express');
const User = require('../models/User');
const Invoice = require('../models/Invoice');
const Payslip = require('../models/Payslip');
const { getCompletedMonthlyCycles } = require('../utils/billing-cycles');
const { verifyToken, allowRoles } = require('../middleware/auth');

const router = express.Router();

function monthKey(value) {
  if (!value) return null;
  const match = String(value).trim().match(/^([A-Za-z]+)\s+(\d{4})$/);
  if (!match) return null;
  const parsed = new Date(`${match[1]} 1, ${match[2]} UTC`);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 7);
}

function invoiceIncludesSubject(invoice, subjectName) {
  const normalizedName = String(subjectName || '').trim().toLowerCase();
  if (!normalizedName) return false;
  const subjects = invoice.subjects || [];
  if (subjects.some((subject) => String(subject.name || '').trim().toLowerCase() === normalizedName)) return true;
  return String(invoice.className || '').trim().toLowerCase() === normalizedName;
}

router.get('/billing-overview', verifyToken, allowRoles('mainadmin', 'subadmin'), async (req, res) => {
  try {
    const unpaidInvoices = await Invoice.find({ status: 'unpaid' }).populate('student', 'name email').populate('teacher', 'name email').sort({ createdAt: -1 });
    const unpaidPayslips = await Payslip.find({ status: 'unpaid' }).populate('teacher', 'name email').sort({ createdAt: -1 });
    
    // Logic for finding ungenerated invoices/payslips
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    
    const students = await User.find({ role: 'student' });
    const teachers = await User.find({ role: 'teacher' });
    const invoices = await Invoice.find().select('student subjects className month billingPeriodStart');

    let ungeneratedInvoices = [];
    let ungeneratedPayslips = [];

    // Check students
    for (const student of students) {
      if (student.studentDetails && student.studentDetails.length > 0) {
        for (const detail of student.studentDetails) {
          if (!detail.joiningDate) continue;
          const dt = new Date(detail.joiningDate);
          if (isNaN(dt.getTime())) continue;
          
          const studentInvoices = invoices.filter((invoice) => invoice.student.toString() === student._id.toString());

          for (const { cycleStart, cycleEnd } of getCompletedMonthlyCycles(dt, now)) {
            const cycleStartKey = cycleStart.toISOString().slice(0, 10);
            const cycleMonthKey = cycleEnd.toISOString().slice(0, 7);
            const invoiceExists = studentInvoices.some((invoice) => {
              if (!invoiceIncludesSubject(invoice, detail.subjectName)) return false;
              if (invoice.billingPeriodStart) {
                const savedStart = new Date(invoice.billingPeriodStart).toISOString().slice(0, 10);
                if (savedStart === cycleStartKey) return true;
              }
              return monthKey(invoice.month) === cycleMonthKey;
            });

            if (!invoiceExists) {
              ungeneratedInvoices.push({
                studentId: student._id,
                studentName: student.name,
                subjectName: detail.subjectName,
                startingDate: dt,
                fee: detail.packageFee,
                cycleStart,
                cycleEnd
              });
            }
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

          // Determine the most recent cycle that should have been generated.
          // A payslip is due 30 days after the cycle start.
          let monthOffset = -1;
          let targetDate = new Date(now.getFullYear(), now.getMonth() + monthOffset, dt.getDate() + 30);
          
          if (now.getTime() < targetDate.getTime()) {
             // Current month's 30-day cycle hasn't finished yet, check previous month's
             monthOffset = -2;
             targetDate = new Date(now.getFullYear(), now.getMonth() + monthOffset, dt.getDate() + 30);
          }
          
          if (targetDate.getTime() < dt.getTime()) {
             // It hasn't even been 30 days since the class started
             continue;
          }

          // The billing cycle start date for this target date
          const cycleStart = new Date(now.getFullYear(), now.getMonth() + monthOffset, dt.getDate());
          
          // Timezone safe window: +/- 1.5 days around the expected cycle start date
          const startOfDay = new Date(Date.UTC(cycleStart.getFullYear(), cycleStart.getMonth(), cycleStart.getDate() - 1, 0, 0, 0));
          const endOfDay = new Date(Date.UTC(cycleStart.getFullYear(), cycleStart.getMonth(), cycleStart.getDate() + 1, 23, 59, 59, 999));
          
          // Since payslips don't have subjectName, we rely on the target date window. 
          const slipsInWindow = await Payslip.find({ 
            teacher: teacher._id,
            $or: [
              { billingPeriodStart: { $gte: startOfDay, $lte: endOfDay } },
              { createdAt: { $gte: startOfMonth, $lte: endOfMonth }, billingPeriodStart: null }
            ]
          });

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
