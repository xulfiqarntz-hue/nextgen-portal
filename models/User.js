const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: {
    type: String,
    enum: ['mainadmin', 'subadmin', 'teacher', 'student'],
    required: true
  },
  assignedTeacher: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  assignedStudents: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
