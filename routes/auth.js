const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { verifyToken, allowRoles, JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

router.post('/register', verifyToken, allowRoles('mainadmin', 'subadmin'), async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    if (req.user.role === 'subadmin' && !['teacher', 'student'].includes(role)) {
      return res.status(403).json({ error: 'Sub Admins can only create teacher or student accounts' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ name, email, password: hashedPassword, role });
    await newUser.save();
    res.status(201).json({ message: 'User created successfully', user: newUser });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ error: 'User not found' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ error: 'Incorrect password' });

    const token = jwt.sign(
      { id: user._id, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({ message: 'Login successful', token, role: user.role, name: user.name });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// Return current user info
router.get('/me', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id, 'name email role');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ id: user._id, name: user.name, email: user.email, role: user.role });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update current user info
router.put('/profile', verifyToken, async (req, res) => {
  try {
    const { name, email, password } = req.body;
    
    // Find the user
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Check if email is being updated and if it's already taken
    if (email && email !== user.email) {
      const existingUser = await User.findOne({ email });
      if (existingUser) return res.status(400).json({ error: 'Email already in use' });
      user.email = email;
    }

    if (name) user.name = name;

    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      user.password = hashedPassword;
    }

    await user.save();

    res.json({ 
      message: 'Profile updated successfully', 
      user: { id: user._id, name: user.name, email: user.email, role: user.role } 
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
