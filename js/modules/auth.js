/* ═══════════════════════════════════════════════════════
   AUTH
═══════════════════════════════════════════════════════ */
var _currentUser = null;
var _loginPending = null;
var _mobileSidebarBound = false;

function toggleMobileSidebar() {
  const sidebar = byId('sidebar');
  const overlay = byId('sidebar-overlay');
  if (!sidebar || !overlay) return;

  sidebar.classList.toggle('open');
  overlay.classList.toggle('show', sidebar.classList.contains('open'));
}

function closeMobileSidebar() {
  const sidebar = byId('sidebar');
  const overlay = byId('sidebar-overlay');
  if (!sidebar || !overlay) return;

  sidebar.classList.remove('open');
  overlay.classList.remove('show');
}

function setupMobileSidebarControls() {
  if (_mobileSidebarBound) return;

  const sidebar = byId('sidebar');
  const overlay = byId('sidebar-overlay');
  const menuButton = byId('mobile-menu-btn');
  if (!sidebar || !overlay || !menuButton) return;

  window.addEventListener('resize', function () {
    if (!isMobileView()) closeMobileSidebar();
  });

  _mobileSidebarBound = true;
}

function completeLogin(user) {
  _currentUser = user;
  ls('session_user', user);

  byId('login-page').classList.remove('active');
  byId('app-shell').classList.add('active');
  setupMobileSidebarControls();
  closeMobileSidebar();
  
  buildShell(); // This builds the sidebar

  // Use a small timeout to ensure the sidebar items exist before navigating
  setTimeout(() => {
    const wasRestored = restoreNavState();
    if (!wasRestored) {
        showToast('Welcome back, ' + user.name + '! 👋', '✅');
    }
  }, 50);
}

function doLogout() {
  _currentUser = null;
  closeMobileSidebar();

  // Clear the saved session
  localStorage.removeItem('tlms_session_user');

  byId('app-shell').classList.remove('active');
  byId('login-page').classList.add('active');
  byId('step-login').style.display = 'block';
  byId('step-otp').style.display = 'none';
  byId('login-email').value = '';
  byId('login-pass').value = '';
  for (var i = 0; i < 6; i++) {
    let otpInput = byId('otp' + i);
    if (otpInput) otpInput.value = '';
  }
}

async function checkSession() {
  var savedUser = ls('session_user');
  if (!savedUser) return;

  if (!USE_SERVER) {
    completeLogin(savedUser);
    return;
  }

  // Optimistic restore: show app immediately, then validate cookie in background.
  completeLogin(savedUser);

  try {
    const response = await fetch(`${BACKEND_URL}/auth/me`, {
      credentials: 'include'
    });

    if (!response.ok) {
      doLogout();
      return;
    }

    const result = await response.json();
    const freshUser = result.databaseUser || result.user || savedUser;
    const changed = JSON.stringify(savedUser) !== JSON.stringify(freshUser);
    if (changed) {
      _currentUser = freshUser;
      ls('session_user', freshUser);
      buildShell();
    }
  } catch (error) {
    // Keep optimistic session if backend is temporarily unavailable.
  }
}

async function doLogin() {
  var email = document.getElementById('login-email').value.trim().toLowerCase();
  var pass = document.getElementById('login-pass').value.trim();
  var msg = document.getElementById('login-msg');

  if (USE_SERVER) {
    try {
      const response = await fetch(`${BACKEND_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, pass })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);

      if (result.requiresOtp) {
        _loginPending = result.user;
        document.getElementById('step-login').style.display = 'none';
        document.getElementById('step-otp').style.display = 'block';
      } else {
        completeLogin(result.user);
      }
      return;
    } catch (e) {
      msg.className = 'login-msg show error';
      msg.textContent = '❌ ' + e.message;
      return;
    }
  }
  
  // Original LocalStorage Auth Logic
  var users = ls('users') || [];
  // console.log(users)
  var user = users.find(u => u.email.toLowerCase() === email && u.password === pass);
  if (!user) {
    msg.className = 'login-msg show error';
    msg.textContent = '❌ Invalid email or password.';
    return;
  }
  _loginPending = user;
  if (user.firstLogin === false && user.role !== 'admin') {
    document.getElementById('step-login').style.display = 'none';
    document.getElementById('step-otp').style.display = 'block';
  } else {
    completeLogin(user);
  }
}

function otpInput(el, idx) {
  if (el.value.length === 1 && idx < 5) document.getElementById('otp' + (idx + 1)).focus();
}

function verifyOtp() {
  var otp = '';
  for (var i = 0; i < 6; i++) otp += document.getElementById('otp' + i).value;
  if (otp === '123456') {
    // Mark first login done
    var users = ls('users') || [];
    var idx = users.findIndex(function (u) { return u.id === _loginPending.id; });
    if (idx >= 0) { users[idx].firstLogin = true; ls('users', users); }
    completeLogin(_loginPending);
  } else {
    var msg = document.getElementById('otp-msg');
    msg.className = 'login-msg show error';
    msg.textContent = '❌ Invalid OTP. Try 123456 for demo.';
  }
}

/* ═══════════════════════════════════════════════════════
   SHELL BUILDER
═══════════════════════════════════════════════════════ */
// function buildShell() {
//   var u = _currentUser;
//   document.getElementById('sb-name').textContent = u.name;
//   document.getElementById('sb-role').textContent = u.role === 'admin' ? 'Administrator' : 'Student';
//   document.getElementById('sb-role-badge').textContent = u.role === 'admin' ? 'Admin Panel' : 'Student Portal';
//   document.getElementById('sb-avatar').textContent = u.name[0].toUpperCase();
//   document.getElementById('sb-avatar').style.background = u.role === 'admin' ? 'linear-gradient(135deg,#f59e0b,#ef4444)' : 'linear-gradient(135deg,var(--v1),var(--b1))';

//   var nav = document.getElementById('sidebar-nav');
//   if (u.role === 'admin') {
//     nav.innerHTML = `
//       <div class="sb-section">Overview</div>
//       <div class="sb-item active" onclick="navTo('admin-dashboard',this)"><span class="sb-item-icon">📊</span>Dashboard</div>
//       <div class="sb-section">Management</div>
//       <div class="sb-item" onclick="navTo('admin-batches',this)"><span class="sb-item-icon">🗂️</span>Batches</div>
//       <div class="sb-item" onclick="navTo('admin-students',this)"><span class="sb-item-icon">👥</span>Students</div>
//       <div class="sb-item" onclick="navTo('admin-documents',this)"><span class="sb-item-icon">📄</span>Documents</div>
//       <div class="sb-item" onclick="navTo('admin-recordings',this)"><span class="sb-item-icon">🎥</span>Recordings</div>
//       <div class="sb-section">Tools</div>
//       <div class="sb-item" onclick="navTo('admin-attendance',this)"><span class="sb-item-icon">✅</span>Attendance</div>
//       <div class="sb-item" onclick="navTo('admin-certificates',this)"><span class="sb-item-icon">🏆</span>Certificates</div>
//     `;
//     renderAdminDashboard();
//   } else {
//     nav.innerHTML = `
//       <div class="sb-section">My Learning</div>
//       <div class="sb-item active" onclick="navTo('student-dashboard',this)"><span class="sb-item-icon">🏠</span>Dashboard</div>
//       <div class="sb-item" onclick="navTo('student-course',this)"><span class="sb-item-icon">📚</span>Course Content</div>
//       <div class="sb-item" onclick="navTo('student-recordings',this)"><span class="sb-item-icon">🎥</span>Recordings</div>
//       <div class="sb-item" onclick="navTo('student-documents',this)"><span class="sb-item-icon">📄</span>Notes & Docs</div>
//       <div class="sb-section">Academics</div>
//       <div class="sb-item" onclick="navTo('student-attendance',this)"><span class="sb-item-icon">✅</span>My Attendance</div>
//       <div class="sb-item" onclick="navTo('student-certificate',this)"><span class="sb-item-icon">🏆</span>Certificate</div>
//     `;
//     renderStudentDashboard();
//   }
// }
