/* ═══════════════════════════════════════════════════════
   STUDENT PAGES
═══════════════════════════════════════════════════════ */
var MODULES = [
  { id: 1, title: 'Foundations of BA', topics: ['Role of a Business Analyst', 'BA vs Data Analyst vs PM', 'SDLC — Waterfall & Agile', 'Stakeholder Management', 'Business Domains — Banking, FinTech, EdTech'], color: 'v' },
  { id: 2, title: 'Requirements Gathering', topics: ['Gathering Techniques & Metrics', 'User Stories & Acceptance Criteria', 'Traceability Matrix (RTM)', 'BRD — Business Requirement Document', 'FRD — Functional Requirement Document'], color: 'b' },
  { id: 3, title: 'Agile, Scrum & Methodologies', topics: ['Scrum Framework & Sprint Planning', 'Backlog Grooming & Roles', 'Waterfall & Hybrid Approaches', 'JIRA Basics & Writing User Stories', 'Methodologies Deep Dive'], color: 'c' },
  { id: 4, title: 'Process Modelling', topics: ['Use Case Diagrams & Process Flows', 'Flowcharts & Gap Analysis', 'Root Cause Analysis', 'Wireframes — Figma Overview', 'Draw.io & Documentation Tools'], color: 'a' },
  { id: 5, title: 'UAT & Testing', topics: ['Test Cases & UAT Process', 'Defect Lifecycle', 'Types of Testing & BA\'s Role', 'Working with QA Teams', 'Phase 4–5 BA Responsibilities'], color: 'g' },
  { id: 6, title: 'Career & Interview Prep', topics: ['Important BA & PM Jargon', 'Resume Building & Portfolio', 'Mock & Panel Interviews', 'BA Roadmap & Golden Rules', 'Reference Notes + Freelancing Workshop'], color: 'r' }
];

var STUDENT_DYNAMIC_MODULES = [];

function normalizeStudentModule(module, index) {
  return {
    id: module && module.id ? module.id : String(index + 1),
    title: module && module.title ? module.title : `Module ${index + 1}`,
    topics: module && Array.isArray(module.topics) ? module.topics : [],
    description: module && module.description ? module.description : '',
    bonus: module && Array.isArray(module.bonus) ? module.bonus : [],
    order: module && module.order ? module.order : index + 1,
    courseTitle: module && module.courseTitle ? module.courseTitle : '',
    color: module && module.color ? module.color : MODULES[index % MODULES.length].color
  };
}

function getEffectiveStudentModules() {
  if (Array.isArray(STUDENT_DYNAMIC_MODULES) && STUDENT_DYNAMIC_MODULES.length > 0) {
    return STUDENT_DYNAMIC_MODULES;
  }
  return MODULES;
}

function getStudentBatch() {
  var batches = ls('batches') || [];
  return batches.find(function (b) { return b.students.includes(_currentUser.id); }) || null;
}

async function fetchStudentDashboardSummary() {
  try {
    const response = await fetch(`${BACKEND_URL}/public/student/dashboard/summary?top=20`, {
      credentials: 'include'
    });
    if (!response.ok) throw new Error('Failed to load student dashboard summary');
    return await response.json();
  } catch (error) {
    console.warn('Student dashboard summary unavailable, falling back to local data.', error);
    return null;
  }
}

function uniqueValues(values) {
  return Array.from(new Set((values || []).map(function (v) { return String(v || '').trim(); }).filter(Boolean)));
}

async function resolveStudentAssignedContext() {
  const summary = await fetchStudentDashboardSummary();
  var modules = summary && Array.isArray(summary.modules) ? summary.modules : [];
  var batches = summary && Array.isArray(summary.batches) ? summary.batches : [];

  var context = {
    modules: modules,
    batches: batches,
    moduleIds: uniqueValues(modules.map(function (m) { return m && m.id; })),
    moduleTitles: uniqueValues(modules.map(function (m) { return m && m.title; })),
    batchIds: uniqueValues(batches.map(function (b) { return b && b.batchId; })),
    courseIds: uniqueValues(modules.map(function (m) { return m && m.courseId; }))
  };

  return context;
}

function buildStudentContentQuery(context) {
  var params = new URLSearchParams();
  if (context && Array.isArray(context.courseIds) && context.courseIds.length > 0) {
    params.set('courseId', context.courseIds.join(','));
  }
  if (context && Array.isArray(context.batchIds) && context.batchIds.length > 0) {
    params.set('batchId', context.batchIds.join(','));
  }
  if (context && Array.isArray(context.moduleIds) && context.moduleIds.length > 0) {
    params.set('moduleId', context.moduleIds.join(','));
  }
  var query = params.toString();
  return query ? `?${query}` : '';
}

async function fetchStudentRecordingsByAssignment(context) {
  const query = buildStudentContentQuery(context);
  const response = await fetch(`${BACKEND_URL}/student/recordings${query}`, {
    credentials: 'include'
  });
  if (!response.ok) throw new Error('Failed to fetch student recordings');
  return await response.json();
}

async function fetchStudentDocumentsByAssignment(context) {
  const query = buildStudentContentQuery(context);
  const response = await fetch(`${BACKEND_URL}/student/documents${query}`, {
    credentials: 'include'
  });
  if (!response.ok) throw new Error('Failed to fetch student documents');
  return await response.json();
}

function renderStudentPage(page) {
  if (page === 'student-dashboard') renderStudentDashboard();
  else if (page === 'student-course') renderStudentCourse();
  else if (page === 'student-recordings') renderStudentRecordings();
  else if (page === 'student-documents') renderStudentDocuments();
  else if (page === 'student-attendance') renderStudentAttendance();
  else if (page === 'student-certificate') renderStudentCertificate();
  else if (page === 'user-profile') renderUserProfile();
}

async function renderStudentDashboard() {
  var mc = document.getElementById('main-content');
  mc.innerHTML = '<div class="card anim-in" style="padding:24px;text-align:center;">Loading dashboard...</div>';

  const summary = await fetchStudentDashboardSummary();
  var batch = getStudentBatch();
  var attendance = ls('attendance') || {};
  var att = attendance[_currentUser.id] || {};
  var totalSessions = Math.max(Object.keys(att).length, 10);
  var presentDays = Object.values(att).filter(function (v) { return v === 'present'; }).length;
  var pct = Math.round(presentDays / totalSessions * 100) || 0;
  var docs = ls('documents') || [];
  var recs = ls('recordings') || [];
  var apiStats = summary && summary.stats ? summary.stats : {};
  var apiActiveUser = summary && summary.activeUser ? summary.activeUser : null;
  var apiModules = summary && Array.isArray(summary.modules) ? summary.modules : [];
  var apiBatches = summary && Array.isArray(summary.batches) ? summary.batches : [];
  var apiRecentRecordings = summary && Array.isArray(summary.recentRecordings) ? summary.recentRecordings : [];
  var apiQuickActions = summary && Array.isArray(summary.quickActions) ? summary.quickActions : [];
  var now = new Date();
  var batchExpired = batch && new Date(batch.end) < now;
  var dashboardName = apiActiveUser && apiActiveUser.name ? apiActiveUser.name : _currentUser.name;
  var dashboardEmail = apiActiveUser && apiActiveUser.email ? apiActiveUser.email : _currentUser.email;
  var dashboardRole = apiActiveUser && apiActiveUser.role ? apiActiveUser.role : _currentUser.role;
  var dashboardAvatar = apiActiveUser && apiActiveUser.avatar ? apiActiveUser.avatar : '';
  STUDENT_DYNAMIC_MODULES = apiModules.length > 0
    ? apiModules.map(function (m, i) { return normalizeStudentModule(m, i); })
    : [];
  var dashboardModules = getEffectiveStudentModules();
  var dashboardBatches = apiBatches.length > 0 ? apiBatches : (batch ? [{
    batchId: batch.id,
    title: batch.name,
    timing: batch.timing,
    days: batch.type === 'weekend' ? 'Sat-Sun' : 'Mon-Fri',
    type: batch.type,
    zoomConfig: {
      meetingId: batch.zoomId || 'N/A',
      passcode: batch.zoomPass || 'N/A',
      link: batch.zoomLink || '#'
    },
    studentCount: (batch.students || []).length,
    status: batch.active ? 'Active' : 'Inactive'
  }] : []);
  var dashboardRecentRecordings = apiRecentRecordings.length > 0 ? apiRecentRecordings : recs.slice(0, 2).map(function (r) {
    return {
      date: r.date,
      duration: r.duration,
      thumbnail: '/assets/recs/default.png',
      url: r.url,
      title: r.title
    };
  });
  var dashboardQuickActions = apiQuickActions.length > 0 ? apiQuickActions : [
    { label: 'View Course Content', icon: '📚', route: 'student-course' },
    { label: 'Check Attendance', icon: '✅', route: 'student-attendance' }
  ];
  
  mc.innerHTML = `
    <div class="topbar">
      <div class="topbar-left">
        <div style="width:40px;height:40px;border-radius:50%;${dashboardAvatar ? 'background-image:url(' + dashboardAvatar + ');background-size:cover;background-position:center;' : 'background:linear-gradient(135deg,var(--v1),var(--b1));display:flex;align-items:center;justify-content:center;font-weight:700;font-size:1rem;color:white;'}">${dashboardAvatar ? '' : dashboardName[0]}</div>
        <div><div class="topbar-title">Welcome, ${dashboardName.split(' ')[0]}! 👋</div><div class="topbar-sub">${dashboardRole}${dashboardEmail ? ' · ' + dashboardEmail : ''}</div></div>
      </div>
      <div class="topbar-right">${batch ? '<span class="badge ' + (!batchExpired ? 'badge-g' : 'badge-r') + '">' + (!batchExpired ? 'Active' : 'Course Ended') + '</span>' : ''}</div>
    </div>

    ${batchExpired ? `<div style="background:rgba(244,63,94,.1);border:1px solid rgba(244,63,94,.25);border-radius:12px;padding:16px;margin-bottom:20px;font-size:.85rem;color:#fda4af;">⚠️ Your batch has ended on ${batch.end}. Course access is now read-only.</div>` : ''}

    <div class="grid-4" style="margin-bottom:20px;">
      <div class="stat-card anim-in"><div class="stat-num" style="background:linear-gradient(135deg,var(--v2),var(--v3));-webkit-background-clip:text;-webkit-text-fill-color:transparent;">${apiStats.studentsAttendance ?? pct}%</div><div class="stat-lbl">Attendance</div></div>
      <div class="stat-card anim-in" style="animation-delay:.07s"><div class="stat-num" style="background:linear-gradient(135deg,var(--b1),var(--b2));-webkit-background-clip:text;-webkit-text-fill-color:transparent;">${apiStats.classesAttended ?? presentDays}</div><div class="stat-lbl">Classes Attended</div></div>
      <div class="stat-card anim-in" style="animation-delay:.14s"><div class="stat-num" style="background:linear-gradient(135deg,var(--c1),var(--c2));-webkit-background-clip:text;-webkit-text-fill-color:transparent;">${apiStats.recordingsAvailable ?? recs.filter(function (r) { return r.batch === (_currentUser.batchId) || r.batch === 'all'; }).length}</div><div class="stat-lbl">Recordings</div></div>
      <div class="stat-card anim-in" style="animation-delay:.21s"><div class="stat-num" style="background:linear-gradient(135deg,var(--am),#fde68a);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">${apiStats.documentsShared ?? docs.filter(function (d) { return d.batch === 'all' || d.batch === (_currentUser.batchId || ''); }).length}</div><div class="stat-lbl">Documents</div></div>
    </div>

    ${batch ? `
    <div class="zoom-card anim-in" style="margin-bottom:20px;">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;">
        <div>
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;"><span class="zoom-live-dot"></span><span style="font-family:'Poppins',sans-serif;font-size:.95rem;font-weight:700;color:white;">Live Class — Zoom Meeting</span></div>
          <div style="font-size:.78rem;color:var(--muted);">${batch.timing} · ${batch.type === 'weekend' ? 'Every Sat & Sun' : 'Mon–Fri'}</div>
          <div style="font-size:.74rem;color:var(--b2);margin-top:4px;">Meeting ID: ${batch.zoomId} · Passcode: ${batch.zoomPass}</div>
        </div>
        <a href="${batch.zoomLink}" target="_blank" class="btn btn-v">🎥 Join Now</a>
      </div>
    </div>
    `: '<div class="card anim-in" style="margin-bottom:20px;text-align:center;padding:24px;"><div style="font-size:1.5rem;margin-bottom:8px;">📭</div><div style="color:var(--muted);font-size:.85rem;">You haven\'t been assigned to a batch yet. Contact admin.</div></div>'}

    ${dashboardBatches.length > 0 ? `
    <div class="card anim-in" style="margin-bottom:20px;">
      <div class="card-header"><div class="card-title">My Batches</div></div>
      <div class="grid-2">
        ${dashboardBatches.map(function (item) {
          return `<div class="card" style="background:var(--panel2);border-color:var(--border);">
            <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;">
              <div>
                <div style="font-weight:700;color:white;margin-bottom:4px;">${item.title}</div>
                <div style="font-size:.72rem;color:var(--muted);">${item.timing || ''}${item.days ? ' · ' + item.days : ''}</div>
              </div>
              <span class="badge ${item.status === 'Active' ? 'badge-g' : 'badge-r'}">${item.status || 'Active'}</span>
            </div>
            <div style="font-size:.72rem;color:var(--muted);margin-top:10px;">Meeting ID: ${item.zoomConfig && item.zoomConfig.meetingId ? item.zoomConfig.meetingId : 'N/A'}</div>
          </div>`;
        }).join('')}
      </div>
    </div>
    ` : ''}

    <div class="grid-2">
      <div class="card anim-in">
        <div class="card-header"><div class="card-title">Course Progress</div></div>
        ${dashboardModules.map(function (m, i) {
        return `<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--border);">
            <div style="display:flex;align-items:center;gap:10px;">
              <div style="width:30px;height:30px;border-radius:8px;background:rgba(124,58,237,.15);display:flex;align-items:center;justify-content:center;font-size:.72rem;font-weight:700;color:var(--v2);">${String(i + 1).padStart(2, '0')}</div>
              <div style="font-size:.82rem;font-weight:600;color:white;">${m.title}</div>
            </div>
            <span class="badge ${i < 2 ? 'badge-g' : i < 4 ? 'badge-a' : 'badge-r'}">${i < 2 ? 'Complete' : i < 4 ? 'In Progress' : 'Upcoming'}</span>
          </div>`;
      }).join('')}
      </div>
      <div class="card anim-in" style="animation-delay:.1s;">
        <div class="card-header"><div class="card-title">Recent Recordings</div><a onclick="navTo('student-recordings',null)" style="font-size:.75rem;color:var(--v2);cursor:pointer;">View All →</a></div>
        ${(dashboardRecentRecordings.length > 0 ? dashboardRecentRecordings : recs.slice(0, 4)).map(function (r) {
        return `<div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--border);">
            <div style="width:34px;height:34px;border-radius:8px;background:rgba(239,68,68,.12);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:1rem;">${r.thumbnail ? '🎬' : '▶'}</div>
            <div style="flex:1;"><div style="font-size:.8rem;font-weight:600;color:white;margin-bottom:2px;">${r.title || 'Recent Recording'}</div><div style="font-size:.68rem;color:var(--muted);">${r.date || 'Recent'} · ${r.duration || '00:00'}</div></div>
            <a href="${r.url || '#'}" target="_blank" class="btn btn-out btn-sm">Watch</a>
          </div>`;
      }).join('')}
      </div>
    </div>

    ${dashboardQuickActions.length > 0 ? `
    <div class="card anim-in" style="margin-top:20px;">
      <div class="card-header"><div class="card-title">Quick Actions</div></div>
      <div style="display:flex;gap:12px;flex-wrap:wrap;">
        ${dashboardQuickActions.map(function (action) {
          return `<button class="btn btn-v btn-sm" onclick="navTo('${action.route || 'student-dashboard'}', null)">${action.icon ? action.icon + ' ' : ''}${action.label}</button>`;
        }).join('')}
      </div>
    </div>
    ` : ''}
  `;
}

function renderStudentCourse() {
  var activeModules = getEffectiveStudentModules();
  var mc = document.getElementById('main-content');
  mc.innerHTML = `
    <div class="topbar"><div class="topbar-left"><div class="topbar-title">Course Content</div></div></div>
    <div style="margin-bottom:16px;"><div style="font-size:.8rem;color:var(--muted);">${activeModules.length} Modules available</div></div>
    <div class="grid-3">
      ${activeModules.map(function (m, i) {
        var colorMap = { v: 'linear-gradient(90deg,var(--v1),var(--v2))', b: 'linear-gradient(90deg,var(--b1),var(--b2))', c: 'linear-gradient(90deg,var(--c1),var(--c2))', a: 'linear-gradient(90deg,var(--am),#fde68a)', g: 'linear-gradient(90deg,var(--gr),#6ee7b7)', r: 'linear-gradient(90deg,var(--ro),#fda4af)' };
        var topics = Array.isArray(m.topics) ? m.topics : [];
        return `<div class="module-card anim-in" style="animation-delay:${i * 0.07}s;">
          <div class="mc-top">
            <div class="mc-num">Module ${String(m.order || (i + 1)).padStart(2, '0')}</div>
            <div class="mc-title">${m.title}</div>
            <div style="height:2px;background:${colorMap[m.color || 'v']};border-radius:2px;margin-top:8px;"></div>
          </div>
          <div style="padding:14px 18px;">
            <ul style="list-style:none;display:flex;flex-direction:column;gap:6px;">
              ${topics.map(function (t) { return '<li style="font-size:.76rem;color:var(--muted);display:flex;align-items:flex-start;gap:6px;"><span style="color:var(--v2);font-size:.8rem;flex-shrink:0;">›</span>' + t + '</li>'; }).join('')}
            </ul>
          </div>
          <div class="mc-bottom">
            <span class="mc-topics">${topics.length} topics</span>
            <span class="badge ${i < 2 ? 'badge-g' : i < 4 ? 'badge-a' : 'badge-r'}">${i < 2 ? 'Complete' : i < 4 ? 'In Progress' : 'Upcoming'}</span>
          </div>
        </div>`;
      }).join('')}
    </div>
  `;
}

async function renderStudentRecordings() {
  var mc = document.getElementById('main-content');
  mc.innerHTML = '<div class="card anim-in" style="padding:24px;text-align:center;">Loading recordings from assigned modules...</div>';

  var myRecs = [];
  try {
    const context = await resolveStudentAssignedContext();
    const payload = await fetchStudentRecordingsByAssignment(context);
    myRecs = payload && Array.isArray(payload.items) ? payload.items : [];
    if (payload && payload.isDummy) {
      console.log('Dummy recordings payload coming soon.', payload.context || {});
    }
  } catch (error) {
    console.warn('Student recordings API failed, using local fallback.', error);
    var recs = ls('recordings') || [];
    var batch = getStudentBatch();
    myRecs = recs.filter(function (r) { return r.batch === 'all' || (batch && r.batch === batch.id); });
  }

  mc.innerHTML = `
    <div class="topbar"><div class="topbar-left"><div class="topbar-title">Class Recordings</div><div class="topbar-sub">Watch missed classes anytime</div></div></div>
    <div style="display:flex;flex-direction:column;gap:14px;">
      ${myRecs.length === 0 ? '<div class="card" style="text-align:center;padding:40px;"><div style="font-size:2rem;margin-bottom:10px;">🎥</div><div style="color:var(--muted);">No recordings yet. Check back after your first class.</div></div>' : ''}
      ${myRecs.map(function (r, i) {
        return `<div class="day-card anim-in" style="animation-delay:${i * 0.06}s;">
          <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;">
            <div style="display:flex;align-items:center;gap:14px;">
              <div style="width:50px;height:50px;border-radius:12px;background:rgba(239,68,68,.12);border:1px solid rgba(239,68,68,.2);display:flex;align-items:center;justify-content:center;font-size:1.4rem;flex-shrink:0;">▶</div>
              <div>
                <div class="dc-day">${r.date || 'Recent'}</div>
                <div class="dc-title">${r.title || 'Recording'}</div>
                <div class="dc-meta">
                  <span class="badge badge-b">⏱ ${r.duration || '00:00'}</span>
                  <span style="font-size:.72rem;color:var(--muted);">${r.topics || ''}</span>
                </div>
              </div>
            </div>
            <a href="${r.url || '#'}" target="_blank" class="btn btn-v btn-sm">▶ Watch Recording</a>
          </div>
        </div>`;
      }).join('')}
    </div>
  `;
}

async function renderStudentDocuments() {
  var mc = document.getElementById('main-content');
  mc.innerHTML = '<div class="card anim-in" style="padding:24px;text-align:center;">Loading notes and documents from assigned modules...</div>';

  var docs = [];
  var context = { moduleTitles: [] };
  try {
    context = await resolveStudentAssignedContext();
    const payload = await fetchStudentDocumentsByAssignment(context);
    docs = payload && Array.isArray(payload.items) ? payload.items : [];
    if (payload && payload.isDummy) {
      console.log('Dummy documents payload coming soon.', payload.context || {});
    }
    if (payload && payload.context && Array.isArray(payload.context.moduleTitles) && payload.context.moduleTitles.length > 0) {
      context.moduleTitles = payload.context.moduleTitles;
    }
  } catch (error) {
    console.warn('Student documents API failed, using local fallback.', error);
    docs = ls('documents') || [];
  }

  var moduleTabs = uniqueValues(
    (Array.isArray(context.moduleTitles) ? context.moduleTitles : []).concat(
      docs.map(function (d) { return d && d.module; })
    )
  );

  mc.innerHTML = `
    <div class="topbar"><div class="topbar-left"><div class="topbar-title">Notes & Documents</div></div></div>
    <div class="tabs docs-tabs" style="margin-bottom:20px;">
      <div class="tab active" onclick="filterDocs('all',this)">All</div>
      ${moduleTabs.map(function (m) { return '<div class="tab" onclick="filterDocs(\'' + m.replace(/'/g, "\\'") + '\',this)">' + m + '</div>'; }).join('')}
    </div>
    <div class="grid-auto" id="docs-grid">
      ${docs.map(function (d) {
        var icons = { pdf: '📄', template: '📋', assignment: '📝', reference: '📖', recording: '🎥' };
        var colors = { pdf: 'badge-v', template: 'badge-b', assignment: 'badge-a', reference: 'badge-c', recording: 'badge-g' };
        return `<div class="card anim-in" data-module="${d.module || 'General'}">
          <div style="font-size:2rem;margin-bottom:10px;">${icons[d.type] || '📄'}</div>
          <div style="font-size:.88rem;font-weight:700;color:white;margin-bottom:5px;">${d.title || 'Document'}</div>
          <div style="font-size:.72rem;color:var(--muted);margin-bottom:8px;">${d.module || 'General'}</div>
          <span class="badge ${colors[d.type] || 'badge-v'}" style="margin-bottom:10px;">${d.type || 'reference'}</span>
          <br>
          <a href="${d.url || '#'}" target="_blank" class="btn btn-v btn-sm" style="margin-top:10px;">Open ↗</a>
        </div>`;
      }).join('')}
      ${docs.length === 0 ? '<div class="card" style="text-align:center;padding:34px;"><div style="font-size:2rem;margin-bottom:10px;">📚</div><div style="color:var(--muted);">No documents available yet.</div></div>' : ''}
    </div>
  `;
}

function filterDocs(module, el) {
  document.querySelectorAll('.tab').forEach(function (t) { t.classList.remove('active'); });
  el.classList.add('active');
  document.querySelectorAll('[data-module]').forEach(function (c) {
    c.style.display = (module === 'all' || c.dataset.module === module) ? 'block' : 'none';
  });
}

function renderStudentAttendance() {
  var attendance = ls('attendance') || {};
  var att = attendance[_currentUser.id] || {};
  var dates = Object.keys(att).sort();
  var presentDays = Object.values(att).filter(function (v) { return v === 'present'; }).length;
  var totalSessions = Math.max(dates.length, 10);
  var pct = Math.round(presentDays / totalSessions * 100) || 0;
  var mc = document.getElementById('main-content');
  mc.innerHTML = `
    <div class="topbar"><div class="topbar-left"><div class="topbar-title">My Attendance</div></div></div>
    <div class="grid-3" style="margin-bottom:20px;">
      <div class="stat-card anim-in"><div class="stat-num" style="color:${pct >= 75 ? '#6ee7b7' : pct >= 50 ? '#fde68a' : '#fda4af'};">${pct}%</div><div class="stat-lbl">Overall Attendance</div></div>
      <div class="stat-card anim-in" style="animation-delay:.07s"><div class="stat-num" style="color:#6ee7b7;">${presentDays}</div><div class="stat-lbl">Days Present</div></div>
      <div class="stat-card anim-in" style="animation-delay:.14s"><div class="stat-num" style="color:#fda4af;">${totalSessions - presentDays}</div><div class="stat-lbl">Days Absent</div></div>
    </div>
    <div class="card anim-in">
      <div class="card-header">
        <div><div class="card-title">Attendance Record</div><div class="card-sub">${pct >= 75 ? '✅ Great! You\'re on track.' : pct >= 50 ? '⚠️ Attendance is below recommended 75%.' : '❌ Critical: Attendance is very low. Please attend classes regularly.'}</div></div>
      </div>
      <div class="att-bar" style="height:12px;margin-bottom:16px;"><div class="att-present" style="width:${pct}%;"></div><div class="att-absent" style="width:${100 - pct}%;"></div></div>
      ${dates.length === 0 ? '<p style="color:var(--muted);font-size:.82rem;text-align:center;padding:20px;">No attendance records yet.</p>' : ''}
      <div style="display:flex;flex-wrap:wrap;gap:8px;">
        ${dates.map(function (d) {
        return `<div style="background:${att[d] === 'present' ? 'rgba(16,185,129,.1)' : 'rgba(244,63,94,.1)'};border:1px solid ${att[d] === 'present' ? 'rgba(16,185,129,.3)' : 'rgba(244,63,94,.3)'};border-radius:8px;padding:8px 12px;text-align:center;">
            <div style="font-size:.65rem;color:var(--muted);">${d}</div>
            <div style="font-size:.75rem;font-weight:700;color:${att[d] === 'present' ? '#6ee7b7' : '#fda4af'};margin-top:2px;">${att[d] === 'present' ? '✓ Present' : '✗ Absent'}</div>
          </div>`;
      }).join('')}
      </div>
    </div>
  `;
}

function renderStudentCertificate() {
  var attendance = ls('attendance') || {};
  var att = attendance[_currentUser.id] || {};
  var totalSessions = Math.max(Object.keys(att).length, 10);
  var presentDays = Object.values(att).filter(function (v) { return v === 'present'; }).length;
  var pct = Math.round(presentDays / totalSessions * 100) || 0;
  var eligible = pct >= 75;
  var mc = document.getElementById('main-content');
  mc.innerHTML = `
    <div class="topbar"><div class="topbar-left"><div class="topbar-title">My Certificate</div></div></div>
    <div class="grid-2">
      <div class="card anim-in">
        <div class="card-title" style="margin-bottom:12px;">Certificate Status</div>
        <div style="display:flex;flex-direction:column;gap:12px;">
          <div style="display:flex;align-items:center;justify-content:space-between;padding:12px;background:var(--panel2);border-radius:10px;"><span style="font-size:.82rem;">Attendance (min 75%)</span><span style="font-weight:700;color:${pct >= 75 ? '#6ee7b7' : '#fda4af'};">${pct}% ${pct >= 75 ? '✓' : '✗'}</span></div>
          <div style="display:flex;align-items:center;justify-content:space-between;padding:12px;background:var(--panel2);border-radius:10px;"><span style="font-size:.82rem;">Course Modules</span><span style="font-weight:700;color:#fde68a;">In Progress</span></div>
          <div style="display:flex;align-items:center;justify-content:space-between;padding:12px;background:var(--panel2);border-radius:10px;"><span style="font-size:.82rem;">Admin Approval</span><span style="font-weight:700;color:${eligible ? '#6ee7b7' : 'var(--muted)'};">${eligible ? 'Eligible' : 'Pending'}</span></div>
        </div>
        ${eligible ? `<button class="btn btn-v btn-full" style="margin-top:16px;" onclick="downloadMyCertificate()">🏆 Download My Certificate</button>` : `<div style="background:rgba(245,158,11,.1);border:1px solid rgba(245,158,11,.25);border-radius:10px;padding:14px;margin-top:16px;font-size:.8rem;color:#fde68a;">Complete at least 75% attendance to unlock your certificate.</div>`}
      </div>
      <div class="anim-in" style="animation-delay:.1s;">
        <div class="cert-preview">
          <div style="font-size:.62rem;letter-spacing:.12em;text-transform:uppercase;color:rgba(196,168,240,.6);margin-bottom:8px;">CERTIFICATE OF COMPLETION</div>
          <div style="font-size:.78rem;color:rgba(255,255,255,.6);margin-bottom:4px;">This is to certify that</div>
          <div class="cert-name">${_currentUser.name}</div>
          <div class="cert-course">Business Analysis Capstone Course</div>
          <div style="font-size:.7rem;color:rgba(196,168,240,.6);margin-bottom:12px;">has successfully completed the course at TALeeO Learning</div>
          <div class="cert-badge">🏆 Certified Business Analyst</div>
          <div style="margin-top:12px;font-size:.62rem;color:rgba(255,255,255,.35);">Issued: ${new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
        </div>
      </div>
    </div>
  `;
}


function downloadMyCertificate() {
  generateCertificate(_currentUser.name, 'Business Analysis Capstone Course', new Date().toISOString().split('T')[0]);
}
// Updated Course List (The Grid)
function renderStudentCourse() {
  var activeModules = getEffectiveStudentModules();
  var mc = document.getElementById('main-content');
  mc.innerHTML = `
    <div class="topbar">
        <div class="topbar-left"><div class="topbar-title">Course Curriculum</div></div>
    </div>
    <div style="margin-bottom:24px;">
        <div style="font-size:.85rem;color:var(--muted);">Select a module to view deep-dive syllabus and learning outcomes.</div>
    </div>
    <div class="grid-3">
      ${activeModules.map(function (m, i) {
        return `
        <div class="module-card anim-in" style="animation-delay:${i * 0.05}s" onclick="renderModuleDetail('${m.id}')">
          <div class="mc-top">
            <div class="mc-num">Module ${String(m.order || (i + 1)).padStart(2, '0')}</div>
            <div class="mc-title">${m.title}</div>
          </div>
          <div class="mc-bottom">
            <span class="mc-topics">${(Array.isArray(m.topics) ? m.topics.length : 0)} Key Topics</span>
            <span style="color:var(--v2); font-size:0.7rem; font-weight:600;">View Details →</span>
          </div>
        </div>`;
      }).join('')}
    </div>
  `;
}

function renderModuleDetail(moduleId) {
    const activeModules = getEffectiveStudentModules();
    const m = activeModules.find(function (mod) { return String(mod.id) === String(moduleId); });
    if(!m) return navTo('student-course', null);

    saveNavState('module-detail', moduleId);
    const backNavId = isAdminRole(_currentUser.role) ? 'admin-curriculum' : 'student-course';
    var mc = document.getElementById('main-content');
    
    mc.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
            <button class="btn btn-back btn-sm" onclick="navTo('${backNavId}', null)">← Back to Curriculum</button>
            ${isAdminRole(_currentUser.role) ? `<button class="btn btn-out btn-sm" onclick="openEditModuleModal(${m.id})">⚙️ Edit Content</button>` : ''}
        </div>
        
        <div class="card anim-in" style="background: linear-gradient(135deg, rgba(124, 58, 237, 0.05), transparent);">
            <div class="mc-num">Detailed Syllabus</div>
          <h2 style="font-family:'Poppins'; margin-bottom:10px;">${m.title}</h2>
          ${m.courseTitle ? `<div class="card-sub">Course: ${m.courseTitle}</div>` : ''}
          ${m.description ? `<div class="card-sub" style="margin-top:8px;">${m.description}</div>` : ''}
        </div>

        <div class="syllabus-container anim-in">
          ${(Array.isArray(m.topics) ? m.topics : []).map((topic, idx) => `
                <div class="syllabus-item anim-in" style="animation-delay: ${idx * 0.05}s;">
                    <div class="syllabus-header">
                        <span class="syllabus-index">Topic 0${idx + 1}</span>
                    </div>
                    <div style="font-weight: 600; color: white; font-size: 0.95rem;">${topic}</div>
                </div>
            `).join('')}
        </div>

        ${(Array.isArray(m.bonus) && m.bonus.length > 0) ? `
          <div class="card anim-in" style="margin-top:16px;">
          <div class="card-header"><div class="card-title">Outcomes / Bonus</div></div>
          <ul class="bonus-list">
            ${m.bonus.map(function (item) { return `<li>${item}</li>`; }).join('')}
          </ul>
          </div>
        ` : ''}
    `;
}

// window.openEditModuleModal = function(moduleId) {
//     const m = MODULES.find(mod => mod.id === parseInt(moduleId));
//     if (!m) {
//         showToast("Module not found", "❌");
//         return;
//     }

//     const modalHtml = `
//         <div class="modal-overlay open" id="modal-edit-module">
//             <div class="modal">
//                 <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">✕</button>
//                 <div class="modal-title">Edit Module: ${m.title}</div>
//                 <div class="form-group">
//                     <label class="form-label">Module Title</label>
//                     <input class="form-input" id="edit-mod-title" value="${m.title}">
//                 </div>
//                 <div class="form-group">
//                     <label class="form-label">Topics (One per line)</label>
//                     <textarea class="form-input" id="edit-mod-topics" style="height:150px;">${m.topics.join('\n')}</textarea>
//                 </div>
//                 <button class="btn btn-v btn-full" onclick="saveModuleEdit(${m.id})">Save Content →</button>
//             </div>
//         </div>`;
//     document.body.insertAdjacentHTML('beforeend', modalHtml);
// };

// window.saveModuleEdit = async function(moduleId) {
//     const newTitle = document.getElementById('edit-mod-title').value;
//     const newTopics = document.getElementById('edit-mod-topics').value.split('\n').filter(t => t.trim() !== "");

//     // Update local MODULES array
//     const idx = MODULES.findIndex(mod => mod.id === moduleId);
//     if (idx !== -1) {
//         MODULES[idx].title = newTitle;
//         MODULES[idx].topics = newTopics;
        
//         showToast('Module Content Updated!', '✅');
//         const modal = document.getElementById('modal-edit-module');
//         if(modal) modal.remove();
//         renderModuleDetail(moduleId);
//     }
// };
function openEditModuleModal(moduleId) {
    // Find module from local MODULES or from your fetched list
    const m = MODULES.find(mod => mod.id === moduleId);
    if (!m) return;

    const modalHtml = `
        <div class="modal-overlay open" id="modal-edit-module">
            <div class="modal">
                <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">✕</button>
                <div class="modal-title">Edit Content: ${m.title}</div>
                <div class="form-group">
                    <label class="form-label">Module Title</label>
                    <input class="form-input" id="edit-mod-title" value="${m.title}">
                </div>
                <div class="form-group">
                    <label class="form-label">Topics (Comma Separated)</label>
                    <textarea class="form-input" id="edit-mod-topics" style="height:120px;">${m.topics.join(', ')}</textarea>
                </div>
                <button class="btn btn-v btn-full" onclick="saveModuleEdit(${m.id})">Update Module →</button>
            </div>
        </div>`;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

async function saveModuleEdit(moduleId) {
    const title = document.getElementById('edit-mod-title').value;
    const topics = document.getElementById('edit-mod-topics').value.split(',').map(t => t.trim());

    if (USE_SERVER) {
        await fetch(`${BACKEND_URL}/admin/modules/${moduleId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ title, topics })
        });
    }

    // Update local state and UI
    const idx = MODULES.findIndex(mod => mod.id === moduleId);
    if (idx !== -1) {
        MODULES[idx].title = title;
        MODULES[idx].topics = topics;
    }
    
    document.getElementById('modal-edit-module').remove();
    showToast('Module changes saved!', '✅');
    renderModuleDetail(moduleId);
}


