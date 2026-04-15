/* ═══════════════════════════════════════════════════════
   SERVER CONFIGURATION
═══════════════════════════════════════════════════════ */
const USE_SERVER = true; // Set to true to use backend, false for local storage
// const BACKEND_URL = "https://taleeo-backend.holistichealervedika.com/api/v1";
// const BACKEND_URL = "https://taleeo-backend.holistichealervedika.com/api/v1/taleeo_lms";
const FRONTEND_HOST = (typeof window !== 'undefined' && window.location && window.location.hostname)
  ? window.location.hostname
  : '';
const IS_LOCAL_FRONTEND = FRONTEND_HOST === 'localhost' || FRONTEND_HOST === '127.0.0.1';
const IS_PROD_FRONTEND = FRONTEND_HOST === 'taleeo-learning.holistichealervedika.com';
const BACKEND_BASE_URL = IS_PROD_FRONTEND
  ? 'https://taleeo-backend.holistichealervedika.com'
  : `http://${FRONTEND_HOST === '127.0.0.1' ? '127.0.0.1' : 'localhost'}:3000`;
const BACKEND_URL = `${BACKEND_BASE_URL}/api/v1/taleeo_lms`;

/* ═══════════════════════════════════════════════════════http://taleeo-backend.holistichealervedika.com/
   TAB & NAVIGATION HISTORY MANAGER
═══════════════════════════════════════════════════════ */


/* ═══════════════════════════════════════════════════════
   TAB & NAVIGATION HISTORY MANAGER (Corrected)
═══════════════════════════════════════════════════════ */
const MAX_TABS = 15;
// js/app.js
const _fetchCache = new Map();
let _refreshInFlight = null;

function isBackendRequestUrl(url) {
  return typeof url === 'string' && url.indexOf(BACKEND_URL) === 0;
}

async function attemptSilentRefresh() {
  if (!USE_SERVER) return false;
  if (_refreshInFlight) return _refreshInFlight;

  _refreshInFlight = (async function () {
    try {
      const response = await window.__tlmsNativeFetch(`${BACKEND_URL}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      });
      return response.ok;
    } catch (error) {
      console.warn('Silent refresh failed.', error);
      return false;
    } finally {
      _refreshInFlight = null;
    }
  })();

  return _refreshInFlight;
}

function installFetchInterceptor() {
  if (!USE_SERVER) return;
  if (window.__tlmsFetchInterceptorInstalled) return;

  const nativeFetch = window.fetch.bind(window);
  window.__tlmsNativeFetch = nativeFetch;

  window.fetch = async function (input, init) {
    const requestUrl = typeof input === 'string' ? input : (input && input.url ? input.url : '');
    const isBackend = isBackendRequestUrl(requestUrl);
    const isRefreshCall = requestUrl.indexOf('/auth/refresh') !== -1;
    const isLoginCall = requestUrl.indexOf('/auth/login') !== -1;

    const requestInit = isBackend
      ? Object.assign({}, init || {}, { credentials: 'include' })
      : init;

    let response = await nativeFetch(input, requestInit);

    if (!isBackend || isRefreshCall || isLoginCall || response.status !== 401) {
      return response;
    }

    const refreshed = await attemptSilentRefresh();
    if (!refreshed) return response;

    if (input instanceof Request) {
      return nativeFetch(input.clone(), requestInit);
    }
    return nativeFetch(input, requestInit);
  };

  window.__tlmsFetchInterceptorInstalled = true;
}

installFetchInterceptor();

/* ═══════════════════════════════════════════════════════
   UI HELPERS
═══════════════════════════════════════════════════════ */
const MOBILE_BREAKPOINT = 768;
const ADMIN_ROLES = new Set(['admin', 'superadmin', 'faculty', 'staff', 'technical-team']);

function byId(id) {
  return document.getElementById(id);
}

function isMobileView() {
  return window.innerWidth <= MOBILE_BREAKPOINT;
}

function isAdminRole(role) {
  return ADMIN_ROLES.has((role || '').toLowerCase());
}

function clearInputs(ids) {
  ids.forEach(function (id) {
    const el = byId(id);
    if (el) el.value = '';
  });
}

// js/app.js refinement
async function apiGet(endpoint, allowSoftFail = false) {
    try {
    let response = await fetch(`${BACKEND_URL}${endpoint}`, {
            method: 'GET',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' }
        });
    if (!response.ok) {
      if (allowSoftFail) return null;
      throw new Error(`GET ${endpoint} failed with status ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        // If fetch fails (server is down/restarting), don't logout yet
        console.warn("Server is likely restarting...");
        return null; 
    }
}

function initTabSession() {
    // 1. Identify or Create unique Tab ID for this specific tab instance
    let tabId = sessionStorage.getItem('lms_tab_id');
    if (!tabId) {
        tabId = 'tab_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
        sessionStorage.setItem('lms_tab_id', tabId);
    }

    // 2. Fetch global tab history. Ensure we use the 'tlms_' prefix consistent with your ls() helper
    let tabHistory = ls('tab_history');
    if (!tabHistory) tabHistory = {}; // Force initialization if missing
    
    // 3. Update timestamp for current tab
    tabHistory[tabId] = {
        lastActive: Date.now(),
        lastPage: tabHistory[tabId]?.lastPage || null,
        lastArgs: tabHistory[tabId]?.lastArgs || null
    };

    // 4. Cleanup: Keep only the 15 most recently active tabs
    let entries = Object.entries(tabHistory);
    if (entries.length > MAX_TABS) {
        entries.sort((a, b) => b[1].lastActive - a[1].lastActive); // Sort newest first
        tabHistory = Object.fromEntries(entries.slice(0, MAX_TABS)); // Keep only top 15
    }

    // 5. Save back to localStorage
    ls('tab_history', tabHistory);
    console.log("📍 Tab Session Initialized:", tabId);
    return tabId;
}
function ls(key, val) {
  if (val !== undefined) { 
    localStorage.setItem('tlms_' + key, JSON.stringify(val)); 
    return val; 
  }
  try { 
    return JSON.parse(localStorage.getItem('tlms_' + key)); 
  } catch (e) { 
    return null; 
  }
}

// Fixed Save Nav State
function saveNavState(pageId, args = null) {
    const tabId = sessionStorage.getItem('lms_tab_id');
    let tabHistory = ls('tab_history') || {};
    
    if (tabId && tabHistory[tabId]) {
        tabHistory[tabId].lastPage = pageId;
        tabHistory[tabId].lastArgs = args;
        tabHistory[tabId].lastActive = Date.now();
        ls('tab_history', tabHistory);
    }
}

// Fixed Restore Nav State
function restoreNavState() {
    const tabId = sessionStorage.getItem('lms_tab_id');
    const tabHistory = ls('tab_history') || {};
    const state = tabHistory[tabId];

    if (state && state.lastPage) {
        console.log(`🚀 Restoring state for ${tabId}: ${state.lastPage}`);
        if (state.lastPage === 'module-detail' && state.lastArgs) {
            renderModuleDetail(state.lastArgs);
        } else {
            navTo(state.lastPage);
        }
        return true;
    }
    return false;
}
async function checkSession() {
  var savedUser = ls('session_user');
  console.log("logged in...")
  
  if (savedUser) {
    // If we have a saved user, let's see if the server still likes our cookie
    if (USE_SERVER) {
      try {
        const response = await fetch(`${BACKEND_URL}/auth/me`, { // Create a /me endpoint on backend
          credentials: 'include'
        });
        if (response.ok) {
          const result = await response.json();
          completeLogin(result.user || savedUser);
        } else {
          // Cookie likely expired
          doLogout();
        }
      } catch (err) {
        // Server offline, but we have local data, so allow offline mode
        completeLogin(savedUser);
      }
    } else {
      completeLogin(savedUser);
    }
  }
}
/* ═══════════════════════════════════════════════════════
   UNIVERSAL DATA HANDLER
═══════════════════════════════════════════════════════ */
// Universal fetch function with local fallback
async function fetchApiData(endpoint, fallbackFunction) {
  if (USE_SERVER) {
    try {
      const response = await fetch(`${BACKEND_URL}${endpoint}`, {
          credentials: 'include' 
      });
      if (!response.ok) throw new Error('API unreachable');
      return await response.json();
    } catch (err) {
      console.warn(`Backend not ready for ${endpoint}. Using local fallback data.`);
      return fallbackFunction(); // Fallback to local storage data
    }
  }
  return fallbackFunction();
}
async function updateProfile() {
    const newName = document.getElementById('prof-name').value;
    try {
        // Implement your backend PUT /auth/profile update here
        showToast('Profile name updated locally', '✅');
        _currentUser.name = newName;
        buildShell(); // Refresh sidebar name
    } catch (e) {
        showToast('Update failed', '❌');
    }
}

async function resetPassword() {
  const oldPass = document.getElementById('old-pass').value;
    const newPass = document.getElementById('new-pass').value;
  const confirmPass = document.getElementById('confirm-pass').value;

  if (!oldPass || oldPass.trim().length === 0) {
    return showToast('Please enter old password.', '⚠️');
  }

    if (!newPass || newPass.length < 6) {
        return showToast('Password must be at least 6 characters.', '⚠️');
    }

  if (newPass !== confirmPass) {
    return showToast('New and confirm password do not match.', '⚠️');
  }

  if (oldPass === newPass) {
    return showToast('New password must be different from old password.', '⚠️');
  }
    
    try {
        const response = await fetch(`${BACKEND_URL}/auth/reset-password`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include', // CRITICAL: Sends session cookie to identify user
          body: JSON.stringify({ oldPass: oldPass, newPass: newPass })
        });

        const result = await response.json();

        if (response.ok) {
            showToast('Password changed successfully!', '🔐');
          document.getElementById('old-pass').value = '';
            document.getElementById('new-pass').value = '';
          document.getElementById('confirm-pass').value = '';
        } else {
            throw new Error(result.message || "Reset failed");
        }
    } catch (e) {
        showToast(e.message, '❌');
    }
}

    function toggleOldPasswordVisibility() {
      const input = document.getElementById('old-pass');
      const btn = document.getElementById('old-pass-eye');
      if (!input || !btn) return;

      const isHidden = input.type === 'password';
      input.type = isHidden ? 'text' : 'password';
      btn.textContent = isHidden ? '🙈' : '👁';
    }

function renderUserProfile() {
    const u = _currentUser;
    const mc = document.getElementById('main-content');
    
    mc.innerHTML = `
        <div class="topbar"><div class="topbar-left"><div class="topbar-title">My Profile Settings</div></div></div>
        
        <div class="grid-2">
            <div class="card anim-in">
                <div class="card-header"><div class="card-title">Account Details</div></div>
                <div class="form-group">
                    <label class="form-label">Full Name</label>
                    <input class="form-input" value="${u.name}" id="prof-name">
                </div>
                <div class="form-group">
                    <label class="form-label">Email Address (Locked)</label>
                    <input class="form-input" value="${u.email}" disabled style="opacity:0.5;">
                </div>
                <button class="btn btn-v btn-full" onclick="updateProfile()">Update Profile Info</button>
            </div>

            <div class="card anim-in" style="animation-delay: 0.1s;">
                <div class="card-header"><div class="card-title">Security & Integration</div></div>
                <div class="form-group">
                <label class="form-label">Old Password</label>
                <div style="position:relative;">
                  <input type="password" class="form-input" id="old-pass" placeholder="Enter old password" style="padding-right:44px;">
                  <button id="old-pass-eye" type="button" onclick="toggleOldPasswordVisibility()" style="position:absolute;right:8px;top:50%;transform:translateY(-50%);border:none;background:transparent;color:var(--muted);cursor:pointer;font-size:1rem;">👁</button>
                </div>
              </div>
              <div class="form-group">
                    <label class="form-label">New Password</label>
                    <input type="password" class="form-input" id="new-pass" placeholder="Enter new password">
                </div>
              <div class="form-group">
                <label class="form-label">Confirm New Password</label>
                <input type="password" class="form-input" id="confirm-pass" placeholder="Confirm new password">
              </div>
                
                <div style="margin-top:20px; padding:15px; background:rgba(255,255,255,0.03); border-radius:10px;">
                    <div style="font-size:0.8rem; font-weight:600; margin-bottom:10px;">Social Connections</div>
                    <button class="btn btn-out btn-full" disabled style="justify-content:center; opacity:0.6;">
                        🔗 Link Google Account (Coming Soon)
                    </button>
                </div>
                
                <button class="btn btn-danger btn-full" style="margin-top:20px;" onclick="resetPassword()">Reset Password Now</button>
            </div>
        </div>
    `;
}

/* ═══════════════════════════════════════════════════════
   DATA STORE (localStorage-backed)
═══════════════════════════════════════════════════════ */
function ls(key, val) {
  if (val !== undefined) { localStorage.setItem('tlms_' + key, JSON.stringify(val)); return val; }
  try { return JSON.parse(localStorage.getItem('tlms_' + key)); } catch (e) { return null; }
}

// ── SEED INITIAL DATA ──
function initData() {
  if (!ls('seeded')) {
    ls('users', [
      { id: 'admin1', name: 'Admin', email: 'taleeolearnings@gmail.com', password: 'admin123', role: 'admin', phone: '9000000000', firstLogin: false, avatar: 'A' }
    ]);
    ls('batches', [
      { id: 'b1', name: 'Weekend Batch – April 2026', type: 'weekend', start: '2026-04-05', end: '2026-05-31', timing: '10:00 AM – 12:00 PM IST', zoomLink: 'https://zoom.us/j/1234567890', zoomId: '123 456 7890', zoomPass: 'learn123', active: true, students: [] },
      { id: 'b2', name: 'Weekday Batch – April 2026', type: 'weekday', start: '2026-04-07', end: '2026-05-28', timing: '07:00 PM – 09:00 PM IST', zoomLink: 'https://zoom.us/j/9876543210', zoomId: '987 654 3210', zoomPass: 'ba2026', active: true, students: [] }
    ]);
    ls('documents', [
      { id: 'd1', title: 'BA Foundations – Introduction Deck', module: 'Module 01', batch: 'all', url: '#', type: 'pdf', uploadedAt: '2026-04-01' },
      { id: 'd2', title: 'BRD Template', module: 'Module 02', batch: 'all', url: '#', type: 'template', uploadedAt: '2026-04-03' },
      { id: 'd3', title: 'User Story Format & Examples', module: 'Module 02', batch: 'all', url: '#', type: 'reference', uploadedAt: '2026-04-04' },
      { id: 'd4', title: 'JIRA Basics Cheat Sheet', module: 'Module 03', batch: 'all', url: '#', type: 'pdf', uploadedAt: '2026-04-06' }
    ]);
    ls('recordings', [
      { id: 'r1', title: 'Day 1 – Foundations of BA & SDLC Overview', date: '2026-04-05', duration: '2h 10m', url: '#', batch: 'b1', topics: 'Role of BA, SDLC Phases, Business Domains' },
      { id: 'r2', title: 'Day 2 – Requirements Gathering Techniques', date: '2026-04-06', duration: '1h 55m', url: '#', batch: 'b1', topics: 'BRD, FRD, User Stories, RTM' },
      { id: 'r3', title: 'Day 1 – BA Foundations', date: '2026-04-07', duration: '2h 05m', url: '#', batch: 'b2', topics: 'Role of BA, Stakeholder Management' }
    ]);
    ls('attendance', {});
    ls('seeded', true);
  }
}

// ── TOAST ──
function showToast(msg, icon) {
  var t = document.getElementById('toast');
  document.getElementById('toast-msg').textContent = msg;
  t.querySelector('.toast-icon').textContent = (icon || '✅') + ' ';
  t.classList.add('show');
  setTimeout(function () { t.classList.remove('show'); }, 3500);
}


