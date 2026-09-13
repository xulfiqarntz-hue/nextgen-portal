const express = require('express');
const Attendance = require('../models/Attendance');
const User = require('../models/User');
const Timetable = require('../models/Timetable');
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

      const status = [];
      allTeachers.forEach((t) => {
        const tid = t._id.toString();
        const markedCount = submittedMap[tid] ? submittedMap[tid].size : 0;
        
        // Only include if scheduled today or if they submitted attendance anyway
        if (scheduledTeacherIds.has(tid) || markedCount > 0) {
          const totalStudents = t.assignedStudents ? t.assignedStudents.length : 0;
          status.push({
            teacherId: tid,
            teacherName: t.name,
            teacherEmail: t.email,
            totalStudents,
            studentsMarked: markedCount,
            submitted: markedCount > 0
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

      let minDate = dateFrom;
      let maxDate = dateTo;
      
      if (!minDate && records.length > 0) {
        minDate = records[records.length - 1].date; // oldest record
      }
      if (!maxDate && records.length > 0) {
        maxDate = records[0].date; // newest record
      }

      let total = 0;
      if (minDate && maxDate) {
        const timetable = await Timetable.findOne().lean();
        if (timetable && timetable.data && Array.isArray(timetable.data.classes)) {
          const studentClasses = timetable.data.classes.filter(c => 
            c.students && c.students.includes(student._id.toString())
          );
          
          const dayCounts = {};
          studentClasses.forEach(c => {
            (c.days || []).forEach(day => {
              dayCounts[day] = (dayCounts[day] || 0) + 1;
            });
          });

          const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
          let current = new Date(minDate + 'T00:00:00Z');
          const end = new Date(maxDate + 'T00:00:00Z');
          
          while (current <= end) {
            const dayName = dayNames[current.getUTCDay()];
            if (dayCounts[dayName]) {
              total += dayCounts[dayName];
            }
            current.setUTCDate(current.getUTCDate() + 1);
          }
        }
      }

      // Fallback if timetable is empty or no dates available
      if (total === 0 && records.length > 0) {
        total = records.length;
      }

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
