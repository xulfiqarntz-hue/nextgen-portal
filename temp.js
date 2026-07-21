
    const token = localStorage.getItem('token');
    const name = localStorage.getItem('name');
    const role = localStorage.getItem('role');
    const tabs = ['dashboard','students','add-student','assign','tutors','add-tutor','add-subadmin','subjects','chat','direct-chat','invoices','expenses','attendance'];

    let directChatUsers = [];
    let activeDirectChatUser = null;
    let directChatPollInterval = null;

    if (!token || role !== 'mainadmin') {
      window.location.href = '/login.html';
    }

    document.getElementById('adminName').innerText = name;

    async function loadAllData() {
      const res = await fetch('/api/all-users', { headers: { 'Authorization': 'Bearer ' + token } });
      const data = await res.json();
      window.students = data.students || [];
      window.tutors = data.teachers || [];

      const st = window.students.map(u => ({...u, role: 'student'}));
      const te = window.tutors.map(u => ({...u, role: 'teacher'}));
      directChatUsers = [...st, ...te];
      renderDirectChatList();

      document.getElementById('studentCount').innerText = window.students.length;
      document.getElementById('tutorCount').innerText = window.tutors.length;
      document.getElementById('studentBadge').innerText = window.students.length;
      document.getElementById('tutorBadge').innerText = window.tutors.length;

      const assignmentCount = window.students.reduce((sum, student) => sum + (student.assignedTeachers?.length || 0), 0);
      document.getElementById('assignmentCount').innerText = assignmentCount;

      renderStudentTable();
      renderTutorTable();
      populateSelects();
      renderSubjects();
      loadInvoices();
    }

    function selectTab(tab) {
      tabs.forEach(name => {
        const el = document.getElementById(name);
        if(el) el.classList.toggle('active', name === tab);
      });
      document.querySelectorAll('.nav button').forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tab));
      if (tab === 'attendance') {
        loadDailyStatus();
        populateAttTeacherFilter();
        populateAttStudentSelect();
      }
    }

    function renderStudentTable() {
      const body = document.getElementById('studentTableBody');
      body.innerHTML = '';
      window.students.forEach(s => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${s.name}</td>
          <td>${s.email}</td>
          <td><button class="button-secondary" onclick="deleteUser('${s._id}', '${s.name}')">Delete</button></td>`;
        body.appendChild(tr);
      });
    }

    function renderTutorTable() {
      const body = document.getElementById('tutorTableBody');
      body.innerHTML = '';
      window.tutors.forEach(t => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${t.name}</td>
          <td>${t.email}</td>
          <td><button class="button-secondary" onclick="deleteUser('${t._id}', '${t.name}')">Delete</button></td>`;
        body.appendChild(tr);
      });
    }

    

    function populateSelects() {
      const studentSelects = [document.getElementById('assignStudentSelect'), document.getElementById('chatStudentSelect'), document.getElementById('invoiceStudentSelect')];
      const tutorSelects = [document.getElementById('assignTutorSelect'), document.getElementById('chatTutorSelect')];
      studentSelects.forEach(select => {
        select.innerHTML = '<option value="">Select student</option>';
        window.students.forEach(s => { select.innerHTML += `<option value="${s._id}">${s.name} (${s.email})</option>`; });
      });
      tutorSelects.forEach(select => {
        select.innerHTML = '<option value="">Select tutor</option>';
        window.tutors.forEach(t => { select.innerHTML += `<option value="${t._id}">${t.name} (${t.email})</option>`; });
      });
    }

    async function loadInvoices() {
      const res = await fetch('/api/invoices/list', { headers: { 'Authorization': 'Bearer ' + token } });
      const data = await res.json();
      const body = document.getElementById('invoiceTableBody');
      body.innerHTML = '';
      if (!data.invoices) return;
      data.invoices.forEach(inv => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${inv.student?.name || 'N/A'}</td>
          <td>${inv.month}</td>
          <td>${inv.className || 'N/A'}</td>
          <td>${inv.payment}</td>
          <td>${inv.discount}</td>
          <td>${inv.arrears || 0}</td>
          <td>${inv.total}</td>
          <td><button class="button-primary" onclick="downloadInvoice('${inv._id}')">Download</button>
              <button class="button-secondary" onclick="deleteInvoice('${inv._id}')" style="margin-left:8px;background:#ef4444;color:#fff;">Delete</button></td>`;
        body.appendChild(tr);
      });
    }

    function renderSubjects() {
      const subjects = ['Mathematics', 'Science', 'English', 'Computer Studies', 'History'];
      document.getElementById('subjectList').innerHTML = subjects.map(name => `<li>${name}</li>`).join('');
    }

    async function createStudent() {
      const name = document.getElementById('newStudentName').value.trim();
      const email = document.getElementById('newStudentEmail').value.trim();
      const password = document.getElementById('newStudentPassword').value.trim();
      if (!name || !email || !password) {
        document.getElementById('studentCreateMsg').innerText = 'All fields are required.';
        return;
      }
      const res = await fetch('/api/auth/register', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({ name, email, password, role: 'student' })
      });
      const data = await res.json();
      document.getElementById('studentCreateMsg').innerText = data.message || data.error;
      if (res.ok) { clearAddStudent(); loadAllData(); }
    }

    function clearAddStudent() {
      document.getElementById('newStudentName').value = '';
      document.getElementById('newStudentEmail').value = '';
      document.getElementById('newStudentPassword').value = '';
      document.getElementById('studentCreateMsg').innerText = '';
    }

    async function createTutor() {
      const name = document.getElementById('newTutorName').value.trim();
      const email = document.getElementById('newTutorEmail').value.trim();
      const password = document.getElementById('newTutorPassword').value.trim();
      if (!name || !email || !password) {
        document.getElementById('tutorCreateMsg').innerText = 'All fields are required.';
        return;
      }
      const res = await fetch('/api/auth/register', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({ name, email, password, role: 'teacher' })
      });
      const data = await res.json();
      document.getElementById('tutorCreateMsg').innerText = data.message || data.error;
      if (res.ok) { clearAddTutor(); loadAllData(); }
    }

    function clearAddTutor() {
      document.getElementById('newTutorName').value = '';
      document.getElementById('newTutorEmail').value = '';
      document.getElementById('newTutorPassword').value = '';
      document.getElementById('tutorCreateMsg').innerText = '';
    }

    async function createSubadmin() {
      const name = document.getElementById('newSubadminName').value.trim();
      const email = document.getElementById('newSubadminEmail').value.trim();
      const password = document.getElementById('newSubadminPassword').value.trim();
      if (!name || !email || !password) {
        document.getElementById('subadminCreateMsg').innerText = 'All fields are required.';
        return;
      }
      const res = await fetch('/api/auth/register', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({ name, email, password, role: 'subadmin' })
      });
      const data = await res.json();
      document.getElementById('subadminCreateMsg').innerText = data.message || data.error;
      if (res.ok) { clearAddSubadmin(); loadAllData(); }
    }

    async function createInvoice() {
      
      const studentId = document.getElementById('invoiceStudentSelect').value;
      const teacherId = null;
      const month = document.getElementById('invoiceMonth').value.trim();
      
      const subjects = [];
      for (let i = 1; i <= 4; i++) {
        const sName = document.getElementById('invSub' + i + 'Name').value.trim();
        const sAmt = document.getElementById('invSub' + i + 'Amt').value.trim();
        if (sName && sAmt !== '') {
          subjects.push({ name: sName, amount: Number(sAmt) });
        }
      }

      const discount = document.getElementById('invoiceDiscount').value.trim();
      const arrears = document.getElementById('invoiceArrears').value.trim();
      const bankAccountNo = document.getElementById('invoiceBankAccount').value.trim();
      const bankName = document.getElementById('invoiceBankName').value.trim();
      const classElement = document.getElementById('invoiceClass');
      const className = classElement ? classElement.value.trim() : '';
      const msgEl = document.getElementById('invoiceMsg');

      msgEl.innerText = '';
      if (!studentId || !month || subjects.length === 0) {
        msgEl.innerText = 'Student, month, and at least one subject with amount are required.';
        return;
      }
      
      try {
        const payload = { studentId, teacherId, month, subjects, discount, arrears, bankAccountNo, bankName, className };
        console.log('Invoice payload:', payload);
        const res = await fetch('/api/invoices/create', {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
          body: JSON.stringify(payload)
        });

        const text = await res.text();
        let data = {};
        try {
          data = text ? JSON.parse(text) : {};
        } catch (parseErr) {
          data.error = text;
        }
        
        console.log('Response from server:', data);
        if (data.invoice) {
          console.log('Saved invoice className:', data.invoice.className);
        }

        if (!res.ok) {
          const errorText = data.error || `${res.status} ${res.statusText}`;
          msgEl.innerText = 'Invoice error: ' + errorText;
          return;
        }

        msgEl.innerText = data.message || 'Invoice generated successfully.';
        clearInvoiceForm();
        loadInvoices();
      } catch (err) {
        msgEl.innerText = 'Unable to send invoice request: ' + err.message;
      }
    }

    function clearInvoiceForm() {
      document.getElementById('invoiceStudentSelect').value = '';
      document.getElementById('invoiceMonth').value = '';
      for (let i = 1; i <= 4; i++) {
        document.getElementById('invSub' + i + 'Name').value = '';
        document.getElementById('invSub' + i + 'Amt').value = '';
      }
      document.getElementById('invoiceDiscount').value = '';
      const ia = document.getElementById('invoiceArrears');
      if (ia) ia.value = '';
      document.getElementById('invoiceBankAccount').value = '';
      document.getElementById('invoiceBankName').value = '';
      const ce = document.getElementById('invoiceClass');
      if (ce) ce.value = '';
      document.getElementById('invoiceMsg').innerText = '';
    }

    async function deleteInvoice(id) {
      if (!confirm('Delete this invoice?')) return;
      try {
        const res = await fetch('/api/invoices/' + id, { method: 'DELETE', headers: { 'Authorization': 'Bearer ' + token } });
        const text = await res.text();
        let data = {};
        try { data = text ? JSON.parse(text) : {}; } catch (e) { data.error = text; }
        if (!res.ok) {
          alert('Delete failed: ' + (data.error || `${res.status} ${res.statusText}`));
          return;
        }
        alert(data.message || 'Invoice deleted.');
        loadInvoices();
      } catch (err) {
        alert('Delete failed: ' + err.message);
      }
    }

    function downloadInvoice(id) {
      // open printable invoice view
      window.open('/invoice-view.html?id=' + id, '_blank');
    }

    function clearAddSubadmin() {
      document.getElementById('newSubadminName').value = '';
      document.getElementById('newSubadminEmail').value = '';
      document.getElementById('newSubadminPassword').value = '';
      document.getElementById('subadminCreateMsg').innerText = '';
    }

    async function assignStudent() {
      const studentId = document.getElementById('assignStudentSelect').value;
      const tutorId = document.getElementById('assignTutorSelect').value;
      if (!studentId || !tutorId) { document.getElementById('assignMsg').innerText = 'Please select both student and tutor.'; return; }
      const res = await fetch('/api/assign', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({ studentId, teacherId: tutorId })
      });
      const data = await res.json();
      document.getElementById('assignMsg').innerText = data.message || data.error;
      if (res.ok) loadAllData();
    }

    async function deassignStudent() {
      const studentId = document.getElementById('assignStudentSelect').value;
      const tutorId = document.getElementById('assignTutorSelect').value;
      if (!studentId || !tutorId) { document.getElementById('assignMsg').innerText = 'Please select both student and tutor.'; return; }
      const res = await fetch('/api/deassign', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({ studentId, teacherId: tutorId })
      });
      const data = await res.json();
      document.getElementById('assignMsg').innerText = data.message || data.error;
      if (res.ok) loadAllData();
    }

    async function viewChat() {
      const studentId = document.getElementById('chatStudentSelect').value;
      const tutorId = document.getElementById('chatTutorSelect').value;
      const box = document.getElementById('chatViewBox');
      box.innerHTML = '';
      if (!studentId || !tutorId) { box.innerHTML = '<p class="note">Choose both student and tutor.</p>'; return; }
      const res = await fetch(`/api/chat/view/${studentId}/${tutorId}`, { headers: { 'Authorization': 'Bearer ' + token } });
      const data = await res.json();
      if (!data.messages || !data.messages.length) { box.innerHTML = '<p class="note">No conversation found.</p>'; return; }
      data.messages.forEach(m => {
        const row = document.createElement('div');
        row.className = 'chat-row ' + (m.sender === studentId ? 'other' : 'user');
        const bubble = document.createElement('div');
        bubble.className = 'bubble';
        bubble.innerText = m.text;
        bubble.innerHTML = bubble.innerHTML.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer" style="color: #60a5fa; text-decoration: underline;">$1</a>');
        row.appendChild(bubble);
        box.appendChild(row);
      });
    }

    async function deleteUser(userId, userName) {
      if (!confirm(`Delete ${userName}? This cannot be undone.`)) return;
      const res = await fetch(`/api/users/${userId}`, { method: 'DELETE', headers: { 'Authorization': 'Bearer ' + token } });
      const data = await res.json();
      alert(data.message || data.error);
      if (res.ok) loadAllData();
    }

    function logout() {
      localStorage.clear();
      window.location.href = '/login.html';
    }

    /* ═══════════════════════════════════════════════════════
       ATTENDANCE ADMIN MODULE
    ═══════════════════════════════════════════════════════ */

    const attASubtabs = ['daily', 'logs', 'report'];

    function switchAttAdminTab(tab) {
      attASubtabs.forEach(t => {
        document.getElementById('attASubPanel' + t.charAt(0).toUpperCase() + t.slice(1)).classList.toggle('active', t === tab);
        document.getElementById('attASub' + t.charAt(0).toUpperCase() + t.slice(1)).classList.toggle('active', t === tab);
      });
      if (tab === 'daily') loadDailyStatus();
      if (tab === 'logs') { populateAttTeacherFilter(); }
      if (tab === 'report') populateAttStudentSelect();
    }

    // ── DAILY OVERSIGHT ──
    async function loadDailyStatus() {
      const dateEl = document.getElementById('attADailyDate');
      if (!dateEl.value) dateEl.value = new Date().toISOString().slice(0, 10);
      const date = dateEl.value;

      document.getElementById('attADailyDate').value = date;
      document.getElementById('attAdminDateBadge').textContent = '\uD83D\uDCC5 ' + date;

      // show skeleton, hide table
      document.getElementById('attADailySkel').style.display = 'block';
      document.getElementById('attADailyTable').style.display = 'none';
      document.getElementById('attADailyEmpty').style.display = 'none';

      try {
        const res = await fetch('/api/attendance/daily-status?date=' + date, {
          headers: { 'Authorization': 'Bearer ' + token }
        });
        const data = await res.json();
        const list = data.status || [];

        // Stats
        const done = list.filter(t => t.submitted).length;
        const pending = list.length - done;
        document.getElementById('attAStatTotal').textContent = list.length;
        document.getElementById('attAStatDone').textContent = done;
        document.getElementById('attAStatPending').textContent = pending;

        document.getElementById('attADailySkel').style.display = 'none';

        if (!list.length) {
          document.getElementById('attADailyEmpty').style.display = 'flex';
          return;
        }

        const tbody = document.getElementById('attADailyBody');
        tbody.innerHTML = '';
        list.forEach(t => {
          const pill = t.submitted
            ? '<span class="att-a-pill att-a-pill-done">Submitted</span>'
            : '<span class="att-a-pill att-a-pill-pending">Pending</span>';
          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td><strong>${t.teacherName}</strong></td>
            <td style="color:var(--muted);font-size:.82rem;">${t.teacherEmail}</td>
            <td style="text-align:center;">${t.totalStudents}</td>
            <td style="text-align:center;">${t.studentsMarked}</td>
            <td>${pill}</td>`;
          tbody.appendChild(tr);
        });

        document.getElementById('attADailyTable').style.display = 'table';

      } catch (err) {
        document.getElementById('attADailySkel').style.display = 'none';
        document.getElementById('attADailyEmpty').style.display = 'flex';
        document.getElementById('attADailyEmpty').querySelector('h4').textContent = 'Error loading status';
        document.getElementById('attADailyEmpty').querySelector('p').textContent = err.message;
      }
    }

    // ── LOGS TAB ──
    async function populateAttTeacherFilter() {
      const sel = document.getElementById('attALogTeacher');
      if (sel.options.length > 1) return; // already populated
      (window.tutors || []).forEach(t => {
        const opt = document.createElement('option');
        opt.value = t._id;
        opt.textContent = t.name;
        sel.appendChild(opt);
      });
      // Populate student dropdown initially with all students
      populateAttLogStudentFilter();
    }

    function populateAttLogStudentFilter() {
      const teacherSel = document.getElementById('attALogTeacher');
      const studentSel = document.getElementById('attALogStudent');
      const selectedTeacherId = teacherSel ? teacherSel.value : '';

      studentSel.innerHTML = '<option value="">-- All Students --</option>';

      let studentsToShow = window.students || [];

      // If a teacher is selected, filter to only their assigned students
      if (selectedTeacherId) {
        studentsToShow = studentsToShow.filter(s =>
          (s.assignedTeachers || []).some(t =>
            (t._id || t) === selectedTeacherId
          )
        );
      }

      if (studentsToShow.length === 0) {
        const opt = document.createElement('option');
        opt.value = '';
        opt.textContent = '-- No students assigned --';
        opt.disabled = true;
        studentSel.appendChild(opt);
        return;
      }

      studentsToShow.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s._id;
        opt.textContent = s.name;
        studentSel.appendChild(opt);
      });
    }

    async function loadAdminLogs() {
      const dateFrom = document.getElementById('attALogFrom').value;
      const dateTo   = document.getElementById('attALogTo').value;
      const teacherId = document.getElementById('attALogTeacher').value;
      const studentId = document.getElementById('attALogStudent').value;

      const emptyEl = document.getElementById('attALogsEmpty');
      const tableWrap = document.getElementById('attALogsTableWrap');
      const tbody = document.getElementById('attALogsBody');

      // Show skeleton
      emptyEl.style.display = 'none';
      tableWrap.style.display = 'none';
      document.getElementById('attALogsWrap').innerHTML = `
        <div style="padding:16px;">
          ${Array(5).fill('<div class="att-a-skel-row"><div class="att-a-skel att-a-skel-circle"></div><div class="att-a-skel-lines"><div class="att-a-skel att-a-skel-line" style="width:55%;"></div><div class="att-a-skel att-a-skel-line" style="width:30%;"></div></div></div>').join('')}
        </div>`;

      const params = new URLSearchParams();
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo)   params.set('dateTo', dateTo);
      if (teacherId) params.set('teacherId', teacherId);
      if (studentId) params.set('studentId', studentId);

      try {
        const res = await fetch('/api/attendance/admin-logs?' + params.toString(), {
          headers: { 'Authorization': 'Bearer ' + token }
        });
        const data = await res.json();
        const logs = data.logs || [];

        if (!logs.length) {
          document.getElementById('attALogsWrap').innerHTML = `
            <div class="att-a-empty" id="attALogsEmpty">
              <div class="att-a-empty-icon">📭</div>
              <h4>No records found</h4>
              <p>Try adjusting your filters.</p>
            </div>`;
          return;
        }

        // ── Compute summary from returned logs ──
        const total   = logs.length;
        const present = logs.filter(l => l.status === 'present').length;
        const absent  = logs.filter(l => l.status === 'absent').length;
        const late    = logs.filter(l => l.status === 'late').length;
        const pct     = n => total > 0 ? Math.round((n / total) * 100) : 0;

        const presentPct = pct(present);
        const absentPct  = pct(absent);
        const latePct    = pct(late);

        // ── Rebuild wrap with summary + table ──
        document.getElementById('attALogsWrap').innerHTML = `

          <!-- Stat cards -->
          <div style="display:flex;gap:10px;flex-wrap:wrap;padding:18px 18px 0;">
            <div style="background:rgba(34,197,94,.12);border:1px solid rgba(34,197,94,.3);border-radius:12px;padding:10px 20px;min-width:100px;text-align:center;flex:1;">
              <div style="font-size:1.6rem;font-weight:700;color:#4ade80;">${present}</div>
              <div style="font-size:.75rem;color:var(--muted);margin-top:2px;">Present</div>
            </div>
            <div style="background:rgba(239,68,68,.12);border:1px solid rgba(239,68,68,.3);border-radius:12px;padding:10px 20px;min-width:100px;text-align:center;flex:1;">
              <div style="font-size:1.6rem;font-weight:700;color:#f87171;">${absent}</div>
              <div style="font-size:.75rem;color:var(--muted);margin-top:2px;">Absent</div>
            </div>
            <div style="background:rgba(245,158,11,.12);border:1px solid rgba(245,158,11,.3);border-radius:12px;padding:10px 20px;min-width:100px;text-align:center;flex:1;">
              <div style="font-size:1.6rem;font-weight:700;color:#fbbf24;">${late}</div>
              <div style="font-size:.75rem;color:var(--muted);margin-top:2px;">Late</div>
            </div>
            <div style="background:rgba(99,102,241,.12);border:1px solid rgba(99,102,241,.3);border-radius:12px;padding:10px 20px;min-width:100px;text-align:center;flex:1;">
              <div style="font-size:1.6rem;font-weight:700;color:#a5b4fc;">${total}</div>
              <div style="font-size:.75rem;color:var(--muted);margin-top:2px;">Total</div>
            </div>
          </div>

          <!-- Progress bars -->
          <div style="padding:14px 18px 4px;">
            <div class="att-a-bar-row">
              <div class="att-a-bar-label">Present</div>
              <div class="att-a-bar-track"><div class="att-a-bar-fill" style="width:${presentPct}%;background:#22c55e;"></div></div>
              <div class="att-a-bar-pct" style="color:#4ade80;">${presentPct}%</div>
              <div style="font-size:.78rem;color:var(--muted);min-width:48px;text-align:right;">${present}/${total}</div>
            </div>
            <div class="att-a-bar-row">
              <div class="att-a-bar-label">Absent</div>
              <div class="att-a-bar-track"><div class="att-a-bar-fill" style="width:${absentPct}%;background:#ef4444;"></div></div>
              <div class="att-a-bar-pct" style="color:#f87171;">${absentPct}%</div>
              <div style="font-size:.78rem;color:var(--muted);min-width:48px;text-align:right;">${absent}/${total}</div>
            </div>
            <div class="att-a-bar-row">
              <div class="att-a-bar-label">Late</div>
              <div class="att-a-bar-track"><div class="att-a-bar-fill" style="width:${latePct}%;background:#f59e0b;"></div></div>
              <div class="att-a-bar-pct" style="color:#fbbf24;">${latePct}%</div>
              <div style="font-size:.78rem;color:var(--muted);min-width:48px;text-align:right;">${late}/${total}</div>
            </div>
          </div>

          <!-- Divider -->
          <div style="margin:10px 18px;border-top:1px solid rgba(255,255,255,.06);"></div>

          <!-- Results table -->
          <div style="overflow-x:auto;" id="attALogsTableWrap">
            <table class="att-a-table" id="attALogsTable">
              <thead><tr><th>Date</th><th>Teacher</th><th>Student</th><th>Topic</th><th>Status</th><th>Submitted At</th></tr></thead>
              <tbody id="attALogsBody"></tbody>
            </table>
          </div>`;

        const statusPill = s => {
          const map = { present: 'Present', absent: 'Absent', late: 'Late' };
          const cls = { present: 'att-a-pill-present', absent: 'att-a-pill-absent', late: 'att-a-pill-late' };
          return `<span class="att-a-pill ${cls[s] || ''}">${map[s] || s}</span>`;
        };

        const newBody = document.getElementById('attALogsBody');
        logs.forEach(l => {
          const submittedAt = l.submittedAt ? new Date(l.submittedAt).toLocaleString() : '\u2014';
          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td>${l.date}</td>
            <td><strong>${l.teacher?.name || '\u2014'}</strong></td>
            <td>${l.student?.name || '\u2014'}<div style="color:var(--muted);font-size:.75rem;">${l.student?.email || ''}</div></td>
            <td style="color:var(--muted);">${l.topic || '\u2014'}</td>
            <td>${statusPill(l.status)}</td>
            <td style="color:var(--muted);font-size:.78rem;">${submittedAt}</td>`;
          newBody.appendChild(tr);
        });

      } catch (err) {
        document.getElementById('attALogsWrap').innerHTML = `
          <div class="att-a-empty"><div class="att-a-empty-icon">⚠️</div><h4>Error loading logs</h4><p>${err.message}</p></div>`;
      }
    }

    function clearAdminLogs() {
      ['attALogFrom','attALogTo'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
      });
      document.getElementById('attALogTeacher').value = '';
      populateAttLogStudentFilter(); // reset student dropdown to all students
      document.getElementById('attALogsWrap').innerHTML = `
        <div class="att-a-empty" id="attALogsEmpty">
          <div class="att-a-empty-icon">📂</div>
          <h4>No records loaded</h4>
          <p>Apply filters above and click Search.</p>
        </div>`;
    }

    function exportAttCSV() {
      const dateFrom = document.getElementById('attALogFrom').value;
      const dateTo   = document.getElementById('attALogTo').value;
      const teacherId = document.getElementById('attALogTeacher').value;
      const studentId = document.getElementById('attALogStudent').value;
      const params = new URLSearchParams();
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo)   params.set('dateTo', dateTo);
      if (teacherId) params.set('teacherId', teacherId);
      if (studentId) params.set('studentId', studentId);
      const url = '/api/attendance/export-csv?' + params.toString();
      // Create a temporary anchor with the auth token
      const a = document.createElement('a');
      a.href = url;
      a.setAttribute('download', '');
      // For authenticated download, fetch as blob
      fetch(url, { headers: { 'Authorization': 'Bearer ' + token } })
        .then(r => r.blob())
        .then(blob => {
          const blobUrl = URL.createObjectURL(blob);
          a.href = blobUrl;
          a.download = 'attendance_export.csv';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(blobUrl);
        })
        .catch(err => alert('CSV export failed: ' + err.message));
    }

    function exportAttPDF() {
      window.print();
    }

    // ── STUDENT REPORT ──
    function populateAttStudentSelect() {
      const sel = document.getElementById('attAReportStudent');
      if (sel.options.length > 1) return;
      (window.students || []).forEach(s => {
        const opt = document.createElement('option');
        opt.value = s._id;
        opt.textContent = s.name;
        sel.appendChild(opt);
      });
    }

    async function loadStudentReport() {
      const studentId = document.getElementById('attAReportStudent').value;
      const dateFrom  = document.getElementById('attAReportFrom').value;
      const dateTo    = document.getElementById('attAReportTo').value;
      const card = document.getElementById('attAReportCard');
      if (!studentId) {
        card.innerHTML = '<div class="att-a-empty"><div class="att-a-empty-icon">💡</div><h4>Select a student first</h4><p>Use the dropdown above.</p></div>';
        return;
      }

      card.innerHTML = `<div style="padding:16px;">${Array(4).fill('<div class="att-a-skel-row"><div class="att-a-skel att-a-skel-circle"></div><div class="att-a-skel-lines"><div class="att-a-skel att-a-skel-line" style="width:60%;"></div></div></div>').join('')}</div>`;

      try {
        const params = new URLSearchParams();
        if (dateFrom) params.set('dateFrom', dateFrom);
        if (dateTo)   params.set('dateTo', dateTo);

        const res = await fetch('/api/attendance/student-report/' + studentId + '?' + params.toString(), {
          headers: { 'Authorization': 'Bearer ' + token }
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed');

        const { student, summary, records } = data;
        const { total, present, absent, late, presentPct, absentPct, latePct } = summary;

        // Build date range label
        const rangeLabel = (dateFrom || dateTo)
          ? `<span style="font-size:.8rem;background:rgba(99,102,241,.15);color:#818cf8;border-radius:8px;padding:3px 10px;margin-left:10px;">
               ${dateFrom || '—'} → ${dateTo || '—'}
             </span>`
          : '';

        // Summary stat pills
        const statPills = `
          <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:20px;">
            <div style="background:rgba(34,197,94,.12);border:1px solid rgba(34,197,94,.3);border-radius:12px;padding:10px 18px;min-width:100px;text-align:center;">
              <div style="font-size:1.6rem;font-weight:700;color:#4ade80;">${present}</div>
              <div style="font-size:.75rem;color:var(--muted);margin-top:2px;">Present</div>
            </div>
            <div style="background:rgba(239,68,68,.12);border:1px solid rgba(239,68,68,.3);border-radius:12px;padding:10px 18px;min-width:100px;text-align:center;">
              <div style="font-size:1.6rem;font-weight:700;color:#f87171;">${absent}</div>
              <div style="font-size:.75rem;color:var(--muted);margin-top:2px;">Absent</div>
            </div>
            <div style="background:rgba(245,158,11,.12);border:1px solid rgba(245,158,11,.3);border-radius:12px;padding:10px 18px;min-width:100px;text-align:center;">
              <div style="font-size:1.6rem;font-weight:700;color:#fbbf24;">${late}</div>
              <div style="font-size:.75rem;color:var(--muted);margin-top:2px;">Late</div>
            </div>
            <div style="background:rgba(99,102,241,.12);border:1px solid rgba(99,102,241,.3);border-radius:12px;padding:10px 18px;min-width:100px;text-align:center;">
              <div style="font-size:1.6rem;font-weight:700;color:#a5b4fc;">${total}</div>
              <div style="font-size:.75rem;color:var(--muted);margin-top:2px;">Total</div>
            </div>
          </div>`;

        // Progress bars with % + count
        const bars = `
          <div style="margin-bottom:24px;">
            <div class="att-a-bar-row">
              <div class="att-a-bar-label">Present</div>
              <div class="att-a-bar-track"><div class="att-a-bar-fill" style="width:${presentPct}%;background:#22c55e;"></div></div>
              <div class="att-a-bar-pct" style="color:#4ade80;">${presentPct}%</div>
              <div style="font-size:.78rem;color:var(--muted);min-width:42px;text-align:right;">${present}/${total}</div>
            </div>
            <div class="att-a-bar-row">
              <div class="att-a-bar-label">Absent</div>
              <div class="att-a-bar-track"><div class="att-a-bar-fill" style="width:${absentPct}%;background:#ef4444;"></div></div>
              <div class="att-a-bar-pct" style="color:#f87171;">${absentPct}%</div>
              <div style="font-size:.78rem;color:var(--muted);min-width:42px;text-align:right;">${absent}/${total}</div>
            </div>
            <div class="att-a-bar-row">
              <div class="att-a-bar-label">Late</div>
              <div class="att-a-bar-track"><div class="att-a-bar-fill" style="width:${latePct}%;background:#f59e0b;"></div></div>
              <div class="att-a-bar-pct" style="color:#fbbf24;">${latePct}%</div>
              <div style="font-size:.78rem;color:var(--muted);min-width:42px;text-align:right;">${late}/${total}</div>
            </div>
          </div>`;

        // Full session list (all records in date range)
        const allRows = records.map(r => {
          const map = { present: 'Present', absent: 'Absent', late: 'Late' };
          const cls = { present: 'att-a-pill-present', absent: 'att-a-pill-absent', late: 'att-a-pill-late' };
          return `<tr><td>${r.date}</td><td style="color:var(--muted);">${r.topic || '\u2014'}</td><td><span class="att-a-pill ${cls[r.status]}">${map[r.status]}</span></td></tr>`;
        }).join('');

        card.innerHTML = `
          <div style="display:flex;align-items:center;flex-wrap:wrap;gap:6px;margin-bottom:4px;">
            <h3 style="margin:0;">${student.name}</h3>${rangeLabel}
          </div>
          <p style="margin:0 0 20px;color:var(--muted);font-size:.85rem;">${student.email} &mdash; ${total} session(s) in selected period</p>

          ${statPills}
          ${bars}

          ${records.length ? `
          <h4 style="margin:0 0 10px;color:var(--muted);font-size:.8rem;text-transform:uppercase;letter-spacing:.06em;">All Sessions (${records.length})</h4>
          <div style="overflow-x:auto;">
            <table class="att-a-table">
              <thead><tr><th>Date</th><th>Topic</th><th>Status</th></tr></thead>
              <tbody>${allRows}</tbody>
            </table>
          </div>` : '<p class="note">No sessions recorded for this period.</p>'}
        `;

      } catch (err) {
        card.innerHTML = `<div class="att-a-empty"><div class="att-a-empty-icon">⚠️</div><h4>Failed to load report</h4><p>${err.message}</p></div>`;
      }
    }

    function clearStudentReport() {
      document.getElementById('attAReportStudent').value = '';
      document.getElementById('attAReportFrom').value = '';
      document.getElementById('attAReportTo').value = '';
      document.getElementById('attAReportCard').innerHTML = `
        <div class="att-a-empty">
          <div class="att-a-empty-icon">📊</div>
          <h4>Select a student</h4>
          <p>Choose a student above and click Generate Report.</p>
        </div>`;
    }

    /* ── DIRECT CHAT SECTION ── */

    async function loadDirectChatUsers() {
      try {
        const res = await fetch('/api/all-users', {
          headers: { 'Authorization': 'Bearer ' + token }
        });
        const data = await res.json();
        const students = (data.students || []).map(u => ({...u, role: 'student'}));
        const teachers = (data.teachers || []).map(u => ({...u, role: 'teacher'}));
        directChatUsers = [...students, ...teachers];
        renderDirectChatList();
      } catch (err) {
        console.error('Failed to load users for direct chat', err);
      }
    }

    function renderDirectChatList() {
      const container = document.getElementById('directChatList');
      const query = document.getElementById('directChatSearch').value.toLowerCase();
      
      const filtered = directChatUsers.filter(u => 
        u.name.toLowerCase().includes(query) || (u.email && u.email.toLowerCase().includes(query))
      );

      container.innerHTML = '';
      if (!filtered.length) {
        container.innerHTML = '<p class="note" style="text-align:center; padding:20px;">No users found.</p>';
        return;
      }

      filtered.forEach(u => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.style.cssText = `
          display:flex; align-items:center; gap:12px; padding:12px;
          border:none; border-radius:8px; background:transparent;
          cursor:pointer; text-align:left; color:var(--text); transition:all 0.2s;
        `;
        if (activeDirectChatUser && activeDirectChatUser._id === u._id) {
          btn.style.background = 'var(--active-bg)';
        }
        btn.onmouseover = () => { if(!activeDirectChatUser || activeDirectChatUser._id !== u._id) btn.style.background = 'var(--hover-bg)'; };
        btn.onmouseout = () => { if(!activeDirectChatUser || activeDirectChatUser._id !== u._id) btn.style.background = 'transparent'; };
        
        btn.onclick = () => selectDirectChatUser(u);

        const avatar = document.createElement('div');
        avatar.style.cssText = 'width:40px; height:40px; border-radius:12px; background:var(--accent); color:#fff; display:flex; align-items:center; justify-content:center; font-weight:600; font-size:14px; flex-shrink:0;';
        const initials = u.name.trim().split(/\\s+/).map(p=>p[0]).join('').substring(0,2).toUpperCase();
        avatar.innerText = initials;

        const info = document.createElement('div');
        info.style.flex = '1';
        info.style.overflow = 'hidden';
        const roleColor = u.role === 'teacher' ? '#f59e0b' : '#38bdf8';
        info.innerHTML = `
          <div style="font-weight:600; font-size:0.95rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${u.name}</div>
          <div style="font-size:0.75rem; color:${roleColor}; font-weight:500; text-transform:uppercase;">${u.role}</div>
        `;

        btn.append(avatar, info);
        container.appendChild(btn);
      });
    }

    function selectDirectChatUser(user) {
      activeDirectChatUser = user;
      document.getElementById('directChatTitle').innerText = user.name + ' (' + user.role + ')';
      document.getElementById('directChatBottomBar').style.display = 'flex';
      renderDirectChatList(); // update active styling
      loadDirectChatMessages();
      
      if (!directChatPollInterval) {
        directChatPollInterval = setInterval(() => {
          if (activeDirectChatUser) loadDirectChatMessages();
        }, 3000);
      }
    }

    async function loadDirectChatMessages() {
      if (!activeDirectChatUser) return;
      try {
        const res = await fetch('/api/chat/conversation/' + activeDirectChatUser._id, {
          headers: { 'Authorization': 'Bearer ' + token }
        });
        const data = await res.json();
        const box = document.getElementById('directChatBox');
        const wasAtBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 50;
        const prevCount = box.children.length;
        
        box.innerHTML = '';
        const messages = data.messages || [];
        
        if (!messages.length) {
          box.innerHTML = '<p class="note" style="text-align:center; margin-top:40px;">No messages yet. Send one to start the conversation.</p>';
        } else {
          messages.forEach(m => {
            const isMine = m.sender !== activeDirectChatUser._id;
            const row = document.createElement('div');
            row.style.display = 'flex';
            row.style.flexDirection = 'column';
            row.style.alignItems = isMine ? 'flex-end' : 'flex-start';
            
            const bubble = document.createElement('div');
            bubble.style.cssText = `
              max-width:75%; padding:10px 14px; border-radius:12px; font-size:0.9rem; line-height:1.4;
            `;
            if (isMine) {
              bubble.style.background = 'var(--accent)';
              bubble.style.color = '#fff';
              bubble.style.borderBottomRightRadius = '4px';
            } else {
              bubble.style.background = 'var(--panel)';
              bubble.style.color = 'var(--text)';
              bubble.style.border = '1px solid var(--border)';
              bubble.style.borderBottomLeftRadius = '4px';
            }
            bubble.innerText = m.text;
            bubble.innerHTML = bubble.innerHTML.replace(/(https?:\\/\\/[^\\s]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer" style="color: inherit; text-decoration: underline;">$1</a>');
            
            const time = document.createElement('div');
            time.style.cssText = 'font-size:0.7rem; color:var(--muted); margin-top:4px;';
            time.innerText = new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            
            row.append(bubble, time);
            box.appendChild(row);
          });
        }
        
        if (wasAtBottom || prevCount === 0 || messages.length > prevCount) {
          box.scrollTop = box.scrollHeight;
        }
      } catch (err) {
        console.error('Failed to load messages', err);
      }
    }

    async function sendDirectMessage() {
      const input = document.getElementById('directChatInput');
      const text = input.value.trim();
      if (!text || !activeDirectChatUser) return;
      
      try {
        await fetch('/api/chat/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + token
          },
          body: JSON.stringify({ receiverId: activeDirectChatUser._id, text })
        });
        input.value = '';
        await loadDirectChatMessages();
      } catch (err) {
        console.error('Failed to send message', err);
      }
    }

    /* ── THEME TOGGLE ── */
    function applyTheme(theme) {
      document.documentElement.setAttribute('data-theme', theme);
      const icon  = document.getElementById('themeIcon');
      const label = document.getElementById('themeLabel');
      if (theme === 'light') {
        icon.textContent  = '☀️';
        label.textContent = 'Light Mode';
      } else {
        icon.textContent  = '🌙';
        label.textContent = 'Dark Mode';
      }
      localStorage.setItem('ngAdminTheme', theme);
    }

    function toggleTheme() {
      const current = document.documentElement.getAttribute('data-theme') || 'dark';
      applyTheme(current === 'dark' ? 'light' : 'dark');
    }

    // Apply saved theme immediately on load
    (function() {
      const saved = localStorage.getItem('ngAdminTheme') || 'dark';
      applyTheme(saved);
    })();

    loadAllData();
  