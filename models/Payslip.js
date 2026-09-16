const mongoose = require('mongoose');

const payslipSchema = new mongoose.Schema({
  teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  month: { type: String, required: true },
  bankAccountNo: { type: String },
  bankName: { type: String },
  noOfAbsents: { type: Number, default: 0 },
  noOfLectures: { type: Number, default: 0 },
  amount: { type: Number, required: true },
  deductions: { type: Number, default: 0 },
  totalSalary: { type: Number, required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now },
  status: { type: String, enum: ['paid', 'unpaid'], default: 'unpaid' },
  billingPeriodStart: { type: Date },
  billingPeriodEnd: { type: Date }
});

module.exports = mongoose.model('Payslip', payslipSchema);
