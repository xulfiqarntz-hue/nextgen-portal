const mongoose = require('mongoose');

const testRecordSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  score: { type: Number, required: true },
  totalMarks: { type: Number, required: true, default: 100 }
}, { timestamps: true });

module.exports = mongoose.model('TestRecord', testRecordSchema);
