const mongoose = require('mongoose');

const timetableSchema = new mongoose.Schema({
  data: {
    type: mongoose.Schema.Types.Mixed,
    default: { teachers: [], students: [], classes: [] }
  },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Timetable', timetableSchema);
