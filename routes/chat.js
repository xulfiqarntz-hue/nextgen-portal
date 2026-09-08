console.log('Chat route loaded');
const express = require('express');
const Message = require('../models/Message');
const { verifyToken, allowRoles } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const mongoose = require('mongoose');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 6 * 1024 * 1024 }
});
const pendingUploads = new Map();
const chunkSize = 5 * 1024 * 1024;

function getFileBucket() {
  if (!mongoose.connection.db) return null;
  return new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: 'chatFiles' });
}

function verifyFileToken(req, res, next) {
  if (!req.headers.authorization && req.query.token) {
    req.headers.authorization = 'Bearer ' + req.query.token;
  }
  verifyToken(req, res, next);
}

function saveGridFile(fileName, buffer) {
  const bucket = getFileBucket();
  if (!bucket) throw new Error('Database is not ready');
  const fileId = new mongoose.Types.ObjectId();
  return new Promise((resolve, reject) => {
    const stream = bucket.openUploadStreamWithId(fileId, fileName, {
      metadata: { contentType: 'application/pdf' }
    });
    stream.on('error', reject);
    stream.on('finish', () => resolve(fileId));
    stream.end(buffer);
  });
}

async function removeExpiredMessages() {
  const cutoff = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000);
  const expired = await Message.find({ createdAt: { $lt: cutoff }, fileUrl: { $regex: '^/api/chat/file/' } }).select('fileUrl');
  const bucket = getFileBucket();
  if (bucket) {
    for (const message of expired) {
      const fileId = message.fileUrl.split('/').pop();
      if (mongoose.isValidObjectId(fileId)) {
        try { await bucket.delete(new mongoose.Types.ObjectId(fileId)); } catch (err) { if (err.code !== 'ENOENT') console.error('Failed to remove chat file:', err.message); }
      }
    }
  }
  await Message.deleteMany({ createdAt: { $lt: cutoff } });
}

mongoose.connection.once('open', () => {
  removeExpiredMessages().catch(err => console.error('Chat cleanup failed:', err.message));
  setInterval(() => removeExpiredMessages().catch(err => console.error('Chat cleanup failed:', err.message)), 24 * 60 * 60 * 1000).unref();
});

const router = express.Router();

router.post('/upload', verifyToken, upload.single('file'), async (req, res) => {
  try {
    const { uploadId, chunkIndex, totalChunks, fileName } = req.body;
    if (!req.file || !uploadId || chunkIndex === undefined || !totalChunks || !fileName) {
      return res.status(400).json({ error: 'Invalid upload chunk' });
    }

    let uploadState = pendingUploads.get(uploadId);
    if (!uploadState) {
      uploadState = { fileName, totalChunks: Number(totalChunks), chunks: new Map() };
      pendingUploads.set(uploadId, uploadState);
    }
    uploadState.chunks.set(Number(chunkIndex), req.file.buffer);

    if (uploadState.chunks.size < uploadState.totalChunks) {
      return res.status(202).json({ complete: false });
    }

    const completeFile = Buffer.concat(Array.from({ length: uploadState.totalChunks }, (_, index) => uploadState.chunks.get(index)));
    const fileId = await saveGridFile(uploadState.fileName, completeFile);
    pendingUploads.delete(uploadId);
    res.status(200).json({
      message: 'File uploaded successfully',
      fileUrl: '/api/chat/file/' + fileId.toString(),
      fileName: uploadState.fileName
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/file/:fileId', verifyFileToken, async (req, res) => {
  try {
    const bucket = getFileBucket();
    if (!bucket || !mongoose.isValidObjectId(req.params.fileId)) return res.status(404).end();
    const fileId = new mongoose.Types.ObjectId(req.params.fileId);
    const file = await mongoose.connection.db.collection('chatFiles.files').findOne({ _id: fileId });
    if (!file) return res.status(404).end();
    res.set('Content-Type', file.metadata?.contentType || 'application/pdf');
    res.set('Content-Disposition', `inline; filename="${encodeURIComponent(file.filename)}"`);
    bucket.openDownloadStream(fileId).on('error', () => res.status(404).end()).pipe(res);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/send', verifyToken, async (req, res) => {
  try {
    let { receiverId, text, fileUrl, fileName } = req.body;
    
    // If no text but file is provided, set an empty string or default text
    if (!text && fileUrl) {
      text = '';
    }

    // Temporarily preserve class links and general URLs to prevent them from being blocked
    const urls = [];
    // Matches http/https links or common class link domains (zoom, meet, teams)
    const urlRegex = /(https?:\/\/[^\s]+|(?:[a-zA-Z0-9-]+\.)?(?:zoom\.us|meet\.google\.com|teams\.microsoft\.com)[^\s]*)/gi;
    text = text.replace(urlRegex, (match, p1, offset, string) => {
      // If preceded by '@', it might be an email address domain (e.g., test@zoom.us), so don't preserve it
      if (offset > 0 && string[offset - 1] === '@') {
        return match;
      }
      urls.push(match);
      return `__URL_${urls.length - 1}__`;
    });

    // Filter email addresses
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi;
    text = text.replace(emailRegex, '[CONTACT INFO REMOVED]');

    // Filter phone numbers (basic detection for sequences of 7+ digits with optional separators)
    const phoneRegex = /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
    text = text.replace(phoneRegex, '[CONTACT INFO REMOVED]');

    // Restore URLs
    urls.forEach((url, i) => {
      text = text.replace(`__URL_${i}__`, url);
    });

    const newMessage = new Message({
      sender: req.user.id,
      receiver: receiverId,
      text,
      fileUrl,
      fileName
    });
    await newMessage.save();
    res.status(201).json({ message: 'Message sent', data: newMessage });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/conversation/:userId', verifyToken, async (req, res) => {
  try {
    const messages = await Message.find({
      $or: [
        { sender: req.user.id, receiver: req.params.userId },
        { sender: req.params.userId, receiver: req.user.id }
      ]
    }).sort({ createdAt: 1 });
    res.json({ messages });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/view/:studentId/:teacherId', verifyToken, allowRoles('mainadmin', 'subadmin'), async (req, res) => {
  try {
    const messages = await Message.find({
      $or: [
        { sender: req.params.studentId, receiver: req.params.teacherId },
        { sender: req.params.teacherId, receiver: req.params.studentId }
      ]
    }).sort({ createdAt: 1 });
    res.json({ messages });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
