const express = require('express');
const Attendance = require('../models/Attendance');
const User = require('../models/User');
const Timetable = require('../models/Timetable');
const TeacherAttendance = require('../models/TeacherAttendance');
const { verifyToken, allowRoles } = require('../middleware/auth');

const router = express.Router();

/* ─────────────────────────────────────────────────────────────────────────
   POST /api/attendance/submit
   Teacher submits attendance for a session (upserts by teacher+student+date)
───────────────────────────────────────────────────────────────────────── */
router.post(
  '/submit',
  verifyToken,
  allowRoles('teacher'),
  async (req, res) => {
    try {
      const { date, topic, records } = req.body;
      // records: [{ studentId, status }]

      if (!date || !records || !Array.isArray(records) || records.length === 0) {
        return res.status(400).json({ error: 'date and records[] are required.' });
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(400).json({ error: 'date must be YYYY-MM-DD format.' });
      }

      const VALID_STATUSES = ['present', 'absent', 'late'];
      for (const r of records) {
        if (!r.studentId || !VALID_STATUSES.includes(r.status)) {
          return res.status(400).json({
            error: 'Each record must have studentId and status (present|absent|late).',
          });
        }
      }

      const teacherId = req.user.id;
      const now = new Date();

      // Upsert each student record atomically
      const ops = records.map((r) => ({
        updateOne: {
          filter: { teacher: teacherId, student: r.studentId, date },
          update: {
            $set: {
              status: r.status,
              topic: topic || '',
              submittedAt: now,
            },
          },
          upsert: true,
        },
      }));

      await Attendance.bulkWrite(ops);

      res.json({
        message: `Attendance submitted successfully for ${records.length} student(s) on ${date}.`,
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

/* ─────────────────────────────────────────────────────────────────────────
   POST /api/attendance/teacher-self-submit
   Teacher submits their own attendance for a session
───────────────────────────────────────────────────────────────────────── */
router.post(
  '/teacher-self-submit',
  verifyToken,
  allowRoles('teacher'),
  async (req, res) => {
    try {
      const { date, status } = req.body;

      if (!date || !status) {
        return res.status(400).json({ error: 'date and status are required.' });
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(400).json({ error: 'date must be YYYY-MM-DD format.' });
      }

      const VALID_STATUSES = ['present', 'absent', 'late'];
      if (!VALID_STATUSES.includes(status)) {
        return res.status(400).json({ error: 'status must be present, absent, or late.' });
      }

      const teacherId = req.user.id;
      const now = new Date();

      await TeacherAttendance.updateOne(
        { teacher: teacherId, date },
        {
          $set: {
            status,
            submittedAt: now,
          }
        },
        { upsert: true }
      );

      res.json({
        message: `Your attendance marked as ${status} for ${date}.`,
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

/* ─────────────────────────────────────────────────────────────────────────
   GET /api/attendance/my-logs
   Teacher views their own attendance history
   Query params: date (YYYY-MM-DD, optional)
───────────────────────────────────────────────────────────────────────── */
router.get(
  '/my-logs',
  verifyToken,
  allowRoles('teacher'),
  async (req, res) => {
    try {
      const filter = { teacher: req.user.id };
      if (req.query.date) filter.date = req.query.date;

      const logs = await Attendance.find(filter)
        .populate('student', 'name email')
        .sort({ date: -1, submittedAt: -1 })
        .lean();

      res.json({ logs });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

/* ─────────────────────────────────────────────────────────────────────────
   GET /api/attendance/admin-logs
   Admin / Sub-admin views all attendance records with filters
   Query params: dateFrom, dateTo, teacherId, studentId, studentName (legacy)
─────────────────────────────────────────────────────────────────────────── */
router.get(
  '/admin-logs',
  verifyToken,
  allowRoles('mainadmin', 'subadmin'),
  async (req, res) => {
    try {
      const { dateFrom, dateTo, teacherId, studentId, studentName } = req.query;

      const filter = {};

      if (dateFrom || dateTo) {
        filter.date = {};
        if (dateFrom) filter.date.$gte = dateFrom;
        if (dateTo) filter.date.$lte = dateTo;
      }

      if (teacherId) filter.teacher = teacherId;
      // Filter directly in DB when a specific student is selected
      if (studentId) filter.student = studentId;

      let query = Attendance.find(filter)
        .populate('teacher', 'name email')
        .populate('student', 'name email')
        .sort({ date: -1, submittedAt: -1 })
        .lean();

      let logs = await query;

      // Legacy: Post-filter by studentName (case-insensitive) if no studentId
      if (!studentId && studentName) {
        const lower = studentName.toLowerCase();
        logs = logs.filter(
          (l) => l.student && l.student.name.toLowerCase().includes(lower)
        );
      }

      res.json({ logs });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

/* ─────────────────────────────────────────────────────────────────────────
   GET /api/attendance/daily-status
   Returns which teachers have / have not submitted attendance today
   Query param: date (YYYY-MM-DD, defaults to today)
───────────────────────────────────────────────────────────────────────── */
router.get(
  '/daily-status',
  verifyToken,
  allowRoles('mainadmin', 'subadmin'),
  async (req, res) => {
    try {
      const targetDate =
        req.query.date ||
        new Date().toISOString().slice(0, 10); // YYYY-MM-DD

      // All teachers in the system
      const allTeachers = await User.find({ role: 'teacher' }, 'name email assignedStudents').lean();

      const timetable = await Timetable.findOne().lean();
      const targetDateObj = new Date(targetDate);
      const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const dayName = daysOfWeek[targetDateObj.getDay()];

      const scheduledTeacherIds = new Set();
      if (timetable && timetable.data && timetable.data.classes) {
        timetable.data.classes.forEach(c => {
          if (c.days && c.days.includes(dayName)) {
            scheduledTeacherIds.add(c.teacher);
          }
        });
      }

      // Records submitted on this date, grouped by teacher
      const submitted = await Attendance.find({ date: targetDate })
        .select('teacher student')
        .lean();

      // Map teacherId → set of student IDs that have been marked
      const submittedMap = {};
      submitted.forEach((r) => {
        const tid = r.teacher.toString();
        if (!submittedMap[tid]) submittedMap[tid] = new Set();
        submittedMap[tid].add(r.student.toString());
      });

      // Fetch teacher own attendance
      const teacherOwnAttendance = await TeacherAttendance.find({ date: targetDate }).lean();
      const teacherStatusMap = {};
      teacherOwnAttendance.forEach(t => {
        teacherStatusMap[t.teacher.toString()] = t.status;
      });

      const status = [];
      allTeachers.forEach((t) => {
        const tid = t._id.toString();
        const markedCount = submittedMap[tid] ? submittedMap[tid].size : 0;
        const ownStatus = teacherStatusMap[tid] || 'pending';
        // Only include if scheduled today or if they submitted attendance anyway
        if (scheduledTeacherIds.has(tid) || markedCount > 0 || ownStatus !== 'pending') {
          const totalStudents = t.assignedStudents ? t.assignedStudents.length : 0;
          status.push({
            teacherId: tid,
            teacherName: t.name,
            teacherEmail: t.email,
            totalStudents,
            studentsMarked: markedCount,
            submitted: markedCount > 0 || ownStatus !== 'pending',
            ownStatus: ownStatus
          });
        }
      });


      res.json({ date: targetDate, status });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

/* ─────────────────────────────────────────────────────────────────────────
   GET /api/attendance/export-csv
   Streams a CSV file of attendance logs (same filter params as admin-logs)
─────────────────────────────────────────────────────────────────────────── */
router.get(
  '/export-csv',
  verifyToken,
  allowRoles('mainadmin', 'subadmin'),
  async (req, res) => {
    try {
      const { dateFrom, dateTo, teacherId, studentId, studentName } = req.query;

      const filter = {};
      if (dateFrom || dateTo) {
        filter.date = {};
        if (dateFrom) filter.date.$gte = dateFrom;
        if (dateTo) filter.date.$lte = dateTo;
      }
      if (teacherId) filter.teacher = teacherId;
      if (studentId) filter.student = studentId;

      let logs = await Attendance.find(filter)
        .populate('teacher', 'name email')
        .populate('student', 'name email')
        .sort({ date: -1 })
        .lean();

      // Legacy: filter by student name text if no specific studentId
      if (!studentId && studentName) {
        const lower = studentName.toLowerCase();
        logs = logs.filter(
          (l) => l.student && l.student.name.toLowerCase().includes(lower)
        );
      }

      const escapeCSV = (val) => {
        const s = String(val ?? '');
        return s.includes(',') || s.includes('"') || s.includes('\n')
          ? `"${s.replace(/"/g, '""')}"`
          : s;
      };

      const header = ['Date', 'Teacher Name', 'Teacher Email', 'Student Name', 'Student Email', 'Topic', 'Status', 'Submitted At'];
      const rows = logs.map((l) => [
        l.date,
        l.teacher?.name ?? '',
        l.teacher?.email ?? '',
        l.student?.name ?? '',
        l.student?.email ?? '',
        l.topic ?? '',
        l.status,
        l.submittedAt ? new Date(l.submittedAt).toISOString() : '',
      ]);

      const csv = [header, ...rows].map((r) => r.map(escapeCSV).join(',')).join('\r\n');

      const filename = `attendance_${dateFrom || 'all'}_to_${dateTo || 'all'}.csv`;
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(csv);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

/* ─────────────────────────────────────────────────────────────────────────
   GET /api/attendance/student-report/:studentId
   Returns a summary of a student's attendance (counts + percentage)
   Optional query params: dateFrom, dateTo (YYYY-MM-DD) to filter by range
───────────────────────────────────────────────────────────────────────── */
router.get(
  '/student-report/:studentId',
  verifyToken,
  allowRoles('mainadmin', 'subadmin'),
  async (req, res) => {
    try {
      const student = await User.findById(req.params.studentId, 'name email').lean();
      if (!student || student.role === 'mainadmin') {
        return res.status(404).json({ error: 'Student not found.' });
      }

      const { dateFrom, dateTo } = req.query;

      const filter = { student: req.params.studentId };
      if (dateFrom || dateTo) {
        filter.date = {};
        if (dateFrom) filter.date.$gte = dateFrom;
        if (dateTo)   filter.date.$lte = dateTo;
      }

      const records = await Attendance.find(filter)
        .populate('teacher', 'name email')
        .sort({ date: -1 })
        .lean();

      const total = records.length;
      const present = records.filter((r) => r.status === 'present').length;
      const absent  = records.filter((r) => r.status === 'absent').length;
      const late    = records.filter((r) => r.status === 'late').length;

      const pct = (n) => (total > 0 ? Math.round((n / total) * 100) : 0);

      res.json({
        student,
        summary: {
          total,
          present,
          absent,
          late,
          presentPct: pct(present),
          absentPct:  pct(absent),
          latePct:    pct(late),
        },
        records,
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

module.exports = router;
