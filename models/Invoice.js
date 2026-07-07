const mongoose = require('mongoose');

const invoiceSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  month: { type: String, required: true },
  payment: { type: Number, required: true },
  discount: { type: Number, default: 0 },
  bankAccountNo: { type: String },
  bankName: { type: String },
  className: { type: String, default: '' },
  total: { type: Number, required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Invoice', invoiceSchema);
