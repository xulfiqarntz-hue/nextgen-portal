const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const fetch = global.fetch || require('node-fetch');
const User = require('../models/User');

const MONGO = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/nextgenportal';
const SERVER = process.env.SERVER_URL || 'http://localhost:3000';

(async () => {
  await mongoose.connect(MONGO);
  console.log('Connected');
  const email = 'testsub@local';
  const password = 'subpass';
  let user = await User.findOne({ email });
  if (!user) {
    const hashed = await bcrypt.hash(password, 10);
    user = new User({ name: 'Test Sub', email, password: hashed, role: 'subadmin' });
    await user.save();
    console.log('Created subadmin');
  } else {
    console.log('Subadmin exists');
  }

  // Try login
  const res = await fetch(`${SERVER}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const body = await res.json().catch(()=> ({}));
  console.log('Login status', res.status, body);
  process.exit(0);
})();
