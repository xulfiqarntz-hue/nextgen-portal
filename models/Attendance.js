const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema(
  {
    teacher: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    // The session date (YYYY-MM-DD) as chosen by the teacher — may differ from submittedAt
    date: {
      type: String, // stored as 'YYYY-MM-DD' string for easy querying/filtering
      required: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
    },
    topic: {
      type: String,
      default: '',
      trim: true,
    },
    status: {
      type: String,
      enum: ['present', 'absent', 'late'],
      required: true,
    },
    // Server-stamped time — allows admins to detect retrospective edits (date vs submittedAt)
    submittedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: false }
);

// Prevent duplicate entries for the same teacher-student-date combination
attendanceSchema.index({ teacher: 1, student: 1, date: 1 }, { unique: true });

// Speed up common admin queries
attendanceSchema.index({ date: 1 });
attendanceSchema.index({ teacher: 1, date: 1 });

module.exports = mongoose.model('Attendance', attendanceSchema);
