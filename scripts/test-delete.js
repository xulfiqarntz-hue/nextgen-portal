const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fetch = global.fetch || require('node-fetch');
const User = require('../models/User');

const MONGO = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/nextgenportal';
const SERVER = process.env.SERVER_URL || 'http://localhost:3000';
const SECRET = process.env.JWT_SECRET || 'testsecret';

(async () => {
  await mongoose.connect(MONGO);
  console.log('Connected to MongoDB for test');

  // create or upsert users
  async function upsertUser(name, email, password, role) {
    let user = await User.findOne({ email });
    if (!user) {
      const hashed = await bcrypt.hash(password, 10);
      user = new User({ name, email, password: hashed, role });
      await user.save();
      console.log('Created user', email, role);
    } else {
      user.name = name;
      user.role = role;
      await user.save();
      console.log('Ensured user', email, role);
    }
    return user;
  }

  const main = await upsertUser('Auto Main', 'automain@test.local', 'mainpass', 'mainadmin');
  const sub = await upsertUser('Auto Sub', 'autosub@test.local', 'subpass', 'subadmin');
  const student = await upsertUser('Auto Student', 'autostudent@test.local', 'studpass', 'student');

  const mainToken = jwt.sign({ id: main._id, role: main.role }, SECRET, { expiresIn: '7d' });
  const subToken = jwt.sign({ id: sub._id, role: sub.role }, SECRET, { expiresIn: '7d' });

  console.log('Tokens generated. Running delete tests...');

  // Attempt delete as subadmin
  let res = await fetch(`${SERVER}/api/users/${student._id}`, { method: 'DELETE', headers: { Authorization: 'Bearer ' + subToken } });
  let body = await res.json().catch(() => ({}));
  console.log('\nSubadmin DELETE status:', res.status, 'body:', body);

  // Attempt delete as mainadmin
  res = await fetch(`${SERVER}/api/users/${student._id}`, { method: 'DELETE', headers: { Authorization: 'Bearer ' + mainToken } });
  body = await res.json().catch(() => ({}));
  console.log('\nMainadmin DELETE status:', res.status, 'body:', body);

  await mongoose.disconnect();
  process.exit(0);
})();
