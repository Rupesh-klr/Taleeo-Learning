/* ═══════════════════════════════════════════════════════
   SERVER CONFIGURATION
═══════════════════════════════════════════════════════ */
const USE_SERVER = true; // Set to true to use backend, false for local storage
// const BACKEND_URL = "https://taleeo-backend.holistichealervedika.com/api/v1";
const BACKEND_URL = "https://taleeo-backend.holistichealervedika.com/api/v1/taleeo_lms";
// const BACKEND_URL = "http://localhost:3000/api/v1/taleeo_lms";

/* ═══════════════════════════════════════════════════════http://taleeo-backend.holistichealervedika.com/
   TAB & NAVIGATION HISTORY MANAGER
═══════════════════════════════════════════════════════ */


/* ═══════════════════════════════════════════════════════
   TAB & NAVIGATION HISTORY MANAGER (Corrected)
═══════════════════════════════════════════════════════ */
const MAX_TABS = 15;
// js/app.js
const _fetchCache = new Map();

// js/app.js refinement
async function apiGet(endpoint, allowSoftFail = false) {
    try {
        let response = await fetch(`${BACKEND_URL}${endpoint}`, {
            method: 'GET',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' }
        });
        if (response.status === 401) {
            // Attempt refresh using your persistent refreshToken
            const refreshed = await attemptSilentRefresh();
            if (refreshed) {
                return await apiGet(endpoint); // Retry the call
            }
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
   FRONTEND RBAC CONFIGURATION
═══════════════════════════════════════════════════════ */
// Map backend roles to specific sidebar modules
const FRONTEND_MODULES = {
  "admin": [
    { id: 'admin-dashboard', icon: '📊', label: 'Dashboard', section: 'Overview' },
    { id: 'admin-batches', icon: '🗂️', label: 'Batches', section: 'Management' },
    { id: 'admin-students', icon: '👥', label: 'Students', section: 'Management' },
    { id: 'admin-curriculum', icon: '📚', label: 'Course Curriculum', section: 'Overview' }, // New Admin Button
    { id: 'admin-documents', icon: '📄', label: 'Documents', section: 'Management' },
    { id: 'admin-recordings', icon: '🎥', label: 'Recordings', section: 'Management' },
    { id: 'admin-attendance', icon: '✅', label: 'Attendance', section: 'Tools' },
    { id: 'admin-certificates', icon: '🏆', label: 'Certificates', section: 'Tools' },
    { id: 'user-profile', icon: '👤', label: 'My Profile', section: 'Settings' }
  ],
  "student": [
    { id: 'student-dashboard', icon: '🏠', label: 'Dashboard', section: 'My Learning' },
    { id: 'student-course', icon: '📚', label: 'Course Content', section: 'My Learning' },
    { id: 'student-recordings', icon: '🎥', label: 'Recordings', section: 'My Learning' },
    { id: 'student-documents', icon: '📄', label: 'Notes & Docs', section: 'My Learning' },
    { id: 'student-attendance', icon: '✅', label: 'My Attendance', section: 'Academics' },
    { id: 'student-certificate', icon: '🏆', label: 'Certificate', section: 'Academics' },
    { id: 'user-profile', icon: '👤', label: 'My Profile', section: 'Settings' }
  ]
};

// Easily alias other roles to share the same view, or create custom arrays for them!
FRONTEND_MODULES["superadmin"] = FRONTEND_MODULES["admin"];
FRONTEND_MODULES["faculty"] = FRONTEND_MODULES["admin"]; 
FRONTEND_MODULES["staff"] = FRONTEND_MODULES["admin"];
FRONTEND_MODULES["technical-team"] = FRONTEND_MODULES["admin"];
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
    const newPass = document.getElementById('new-pass').value;
    if (!newPass || newPass.length < 6) {
        return showToast('Password must be at least 6 characters.', '⚠️');
    }
    
    try {
        const response = await fetch(`${BACKEND_URL}/auth/reset-password`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include', // CRITICAL: Sends session cookie to identify user
            body: JSON.stringify({ newPass: newPass })
        });

        const result = await response.json();

        if (response.ok) {
            showToast('Password changed successfully!', '🔐');
            document.getElementById('new-pass').value = '';
        } else {
            throw new Error(result.message || "Reset failed");
        }
    } catch (e) {
        showToast(e.message, '❌');
    }
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
                    <label class="form-label">New Password</label>
                    <input type="password" class="form-input" id="new-pass" placeholder="Enter new password">
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
// script.js

// Function to delete student from the entire database
async function deleteStudentPermanently(studentId, studentName) {
    const confirmed = confirm(`CRITICAL: Are you sure you want to PERMANENTLY delete ${studentName}? This will remove their account and all enrollment history.`);
    if (!confirmed) return;

    try {
        const response = await fetch(`${BACKEND_URL}/admin/students/${studentId}`, {
            method: 'DELETE',
            credentials: 'include' //
        });

        if (response.ok) {
            showToast(`Student ${studentName} removed from database`, '🗑️');
            
            // Refresh whichever view the user is currently on
            if (document.getElementById('modal-enroll')) {
                const batchId = document.querySelector('[onclick*="enrollExistingStudent"]').getAttribute('onclick').split("'")[3];
                openEnrollmentModal(batchId); 
            } else {
                renderAdminStudents();
            }
        } else {
            throw new Error("Server failed to delete student");
        }
    } catch (err) {
        showToast("Error: " + err.message, "❌");
    }
}
async function toggleStudentActiveState(studentId, currentStatus) {
    const action = currentStatus ? "deactivate" : "activate";
    if (!confirm(`Are you sure you want to ${action} this account?`)) return;

    try {
        const response = await fetch(`${BACKEND_URL}/admin/students/${studentId}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ isActive: !currentStatus })
        });

        if (response.ok) {
            showToast(`Account ${action}d`, '✅');
            renderAdminStudents(); // Refresh the management table
        }
    } catch (err) {
        showToast("Status update failed", "❌");
    }
}
async function submitCourseRequest(courseId, batchId) {
    try {
        const response = await fetch(`${BACKEND_URL}/requests`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ courseId, batchId })
        });

        if (response.ok) {
            showToast('Request sent to Admin! 🚀', '✅');
            // Optionally refresh the current view to show "Pending" status
        } else {
            const err = await response.json();
            throw new Error(err.message || "Submission failed");
        }
    } catch (e) {
        showToast(e.message, '❌');
    }
}

async function getData(key) {
  if (USE_SERVER) {
    try {
      const response = await fetch(`${BACKEND_URL}/admin/${key}`,{
          credentials: 'include' 
      });
      if (!response.ok) throw new Error('Server unreachable');
      return await response.json();
    } catch (err) {
      console.warn(`Server error for ${key}, falling back to LocalStorage`, err);
      return ls(key);
    }
  }
  return ls(key);
}

// Helper to show a loading spinner in the main content area
function showLoading() {
  document.getElementById('main-content').innerHTML = `
    <div style="display:flex;justify-content:center;align-items:center;height:100%;color:var(--v2);">
      <div style="font-size:1.2rem;font-weight:600;">Loading data...</div>
    </div>`;
}
function togglePinCourse(courseId) {
    let pinned = ls('pinned_courses') || [];
    if (pinned.includes(courseId)) {
        pinned = pinned.filter(id => id !== courseId);
    } else {
        pinned.push(courseId);
    }
    ls('pinned_courses', pinned);
    renderAdminCurriculum(); // Refresh UI
}
function openCreateCourseModal() {
    const modalHtml = `
        <div class="modal-overlay open" id="modal-create-course">
            <div class="modal">
                <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">✕</button>
                <div class="modal-title">Create New Program</div>
                <div class="modal-sub">Initialize course metadata before adding modules.</div>
                
                <div class="form-group">
                    <label class="form-label">Course Name</label>
                    <input class="form-input" id="new-c-name" placeholder="e.g. Full Stack Development">
                </div>
                <div class="form-group">
                    <label class="form-label">Duration</label>
                    <input class="form-input" id="new-c-dur" placeholder="e.g. 45 Days">
                </div>
                <div class="form-group">
                    <label class="form-label">Cover Image URL</label>
                    <input class="form-input" id="new-c-img" placeholder="https://...">
                </div>
                <div class="form-group">
                    <label class="form-label">Brief Description</label>
                    <textarea class="form-input" id="new-c-desc" style="height:80px;"></textarea>
                </div>
                
                <button class="btn btn-v btn-full" onclick="saveNewCourse()">Create Course Metadata →</button>
            </div>
        </div>`;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

async function saveNewCourse() {
    const payload = {
        name: document.getElementById('new-c-name').value,
        duration: document.getElementById('new-c-dur').value,
        image: document.getElementById('new-c-img').value || "https://taleeo-assets.com/courses/default.jpg",
        description: document.getElementById('new-c-desc').value,
        // System fields will be handled by backend
    };

    try {
        const response = await fetch(`${BACKEND_URL}/admin/courses`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            showToast('Course Created! Now add modules.', '✅');
            document.getElementById('modal-create-course').remove();
            renderAdminCurriculum();
        }
    } catch (e) { showToast('Error creating course', '❌'); }
}
async function deleteCourse(courseId) {
    if (!confirm("Are you sure you want to delete this course? This will hide it from the curriculum.")) return;

    try {
        const response = await fetch(`${BACKEND_URL}/admin/courses/${courseId}`, {
            method: 'DELETE',
            credentials: 'include' // Required for your session
        });

        const result = await response.json();
        if (response.ok) {
            showToast('Course deleted successfully', '🗑️');
            renderAdminCurriculum(); // Refresh the list
        } else {
            throw new Error(result.message || "Failed to delete");
        }
    } catch (err) {
        showToast('Error: ' + err.message, '❌');
    }
}
async function renderAdminCurriculum(searchTerm = '') {
    showLoading();
    const mc = document.getElementById('main-content');
    
    // Fetch data using the optimized search endpoint
    const data = await fetchApiData(`/admin/courses/search?q=${searchTerm}&limit=20`, () => {
        // FALLBACK: Use local MODULES if server is offline
        const localCourses = MODULES.map(m => ({
            id: m.id.toString(),
            name: m.title,
            modules: m.topics.map(t => ({ title: t })),
            batches: []
        })).filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()));
        
        return { totalRecords: localCourses.length, courses: localCourses }; 
    });

    const courses = data.courses || [];
    const totalRecords = data.totalRecords || 0;

    // Handle Pinning Logic
    const pinnedIds = ls('pinned_courses') || [];
    const pinnedCourses = courses.filter(c => pinnedIds.includes(c.id));
    const otherCourses = courses.filter(c => !pinnedIds.includes(c.id));

    mc.innerHTML = `
        <div class="topbar">
            <div class="topbar-left">
                <div class="topbar-title">Course Curriculum (${totalRecords})</div>
            </div>
            <div class="topbar-right" style="gap:10px;">
                <div style="display:flex; gap:5px;">
                    <input type="text" class="form-input" id="curr-search-input" value="${searchTerm}" 
                           placeholder="Search courses..." style="width:250px;">
                    <button class="btn btn-v btn-sm" 
                            onclick="renderAdminCurriculum(document.getElementById('curr-search-input').value)">🔍</button>
                </div>
                ${_currentUser.role === 'admin' ? 
                    `<button class="btn btn-success btn-sm" onclick="openCreateCourseModal()">+ New Course</button>` : ''}
            </div>
        </div>

        ${pinnedCourses.length > 0 ? `
            <div class="sb-section">📌 Pinned</div>
            <div class="grid-3">${pinnedCourses.map(c => renderCourseCard(c, true)).join('')}</div>
        ` : ''}

        <div class="sb-section">📚 All Modules</div>
        <div class="grid-3">${otherCourses.map(c => renderCourseCard(c, false)).join('')}</div>
    `;
}
// Variable to store the currently loaded course for modal context
let _activeCourseContext = null;
async function renderCourseDeepDive(courseId) {
    showLoading();
    const mc = document.getElementById('main-content');
    
    const response = await apiGet(`/admin/courses/search?q=${courseId}`); 
    const course = response.courses.find(c => c.id === courseId);
    if (!course) return renderAdminCurriculum();

    _activeCourseContext = course; 
    saveNavState('course-detail', courseId);

    mc.innerHTML = `
        <div class="topbar">
            <div class="topbar-left">
                <button class="btn btn-out btn-sm" onclick="renderAdminCurriculum()">← Back</button>
                <div style="margin-left:15px;"><div class="topbar-title">Editing: ${course.name}</div></div>
            </div>
            <div class="topbar-right">
                <button class="btn btn-v btn-sm" onclick="openModuleModal()">+ Add Module</button>
                <button class="btn btn-success btn-sm" onclick="openBatchModal(null, '${course.id}')">+ Add Batch</button>
            </div>
        </div>

        <div class="editor-layout anim-in">
            <div class="card" style="max-height: 80vh; overflow-y: auto;">
                <div class="card-header">
                    <div class="card-title">🗂️ Active Batches (${course.batches?.length || 0})</div>
                </div>
                <div style="display:flex; flex-direction:column; gap:16px;">
                    ${course.batches?.map(b => {
                        const daysLeft = Math.max(0, Math.ceil((new Date(b.end) - new Date()) / 86400000));
                        const progress = Math.min(100, Math.max(0, Math.round((new Date() - new Date(b.start)) / (new Date(b.end) - new Date(b.start)) * 100)));
                        
                        return `
                        <div class="card anim-in" style="background: var(--bg2); border: 1px solid var(--border);">
                          <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:14px;">
                            <div>
                                <div style="font-size:1rem;font-weight:700;color:white;margin-bottom:4px;">${b.name}</div>
                                <span class="badge ${b.type === 'weekend' ? 'badge-v' : 'badge-b'}">${b.type}</span>
                            </div>
                            <span class="badge ${daysLeft > 0 ? 'badge-g' : 'badge-r'}">${daysLeft > 0 ? daysLeft + 'd left' : 'Ended'}</span>
                          </div>
                          
                          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px;font-size:.78rem;color:var(--muted);">
                            <div>⏰ ${b.timing}</div>
                            <div>👥 ${b.students?.length || 0} students</div>
                            <div>📅 ${b.start} → ${b.end}</div>
                            <div>🔑 ${b.zoomDetails?.pass || 'N/A'}</div>
                          </div>

                          <div class="zoom-card" style="margin-bottom:14px; background: var(--bg);">
                            <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
                                <span class="zoom-live-dot"></span>
                                <span style="font-size:.75rem;font-weight:700;color:white;">Zoom Meeting</span>
                            </div>
                            <div style="font-size:.72rem;color:var(--muted);margin-bottom:6px;">ID: ${b.zoomDetails?.id} · Pass: ${b.zoomDetails?.pass}</div>
                            <a href="${b.zoomDetails?.link}" target="_blank" style="font-size:.72rem;color:var(--b2);word-break:break-all;">${b.zoomDetails?.link}</a>
                          </div>

                          <div class="progress-wrap" style="margin-bottom:10px;">
                            <div class="progress-fill" style="width:${progress}%;background:linear-gradient(90deg,var(--v1),var(--b1));"></div>
                          </div>

                          <div style="display:flex;gap:8px;flex-wrap:wrap;">
                          <button class="btn btn-success btn-sm" onclick="openInviteForBatch('${b.id}')">+ New Student</button>
    <button class="btn btn-v btn-sm" onclick="openEnrollmentModal('${b.id}')">👥 Manage Enrollment</button>
    <button class="btn btn-danger btn-sm" onclick="requestDeleteBatch('${b.id}')">Deactivate</button>
                            <button class="btn btn-out btn-sm" onclick="openBatchModal('${b.id}', '${course.id}')">Edit</button>
                          </div>
                        </div>`;
                    }).join('') || '<div class="card-sub">No batches for this course.</div>'}
                </div>
            </div>

            <div class="card" style="max-height: 80vh; overflow-y: auto;">
                <div class="card-header">
                    <div class="card-title">📚 Course Syllabus (${course.modules?.length || 0})</div>
                </div>
                <div class="syllabus-container">
                    ${course.modules?.map((m, i) => `
                        <div class="syllabus-item expandable" id="mod-card-${m.id}">
                            <div class="syllabus-header" onclick="toggleModuleExpand('${m.id}')" style="cursor:pointer;">
                                <span class="syllabus-index">Module 0${m.order || i+1}</span>
                                <div style="display:flex; gap:8px;">
                                    <button class="btn btn-out btn-icon" onclick="event.stopPropagation(); openModuleModal('${m.id}')">✏️</button>
                                    <button class="btn btn-danger btn-icon" onclick="event.stopPropagation(); requestDeleteModule('${m.id}', '${course.id}')">🗑️</button>
                                </div>
                            </div>
                            <div style="font-weight:600; color:white; font-size:1rem; margin-top:5px;">${m.title}</div>
                            
                            <div class="mod-details" id="details-${m.id}" style="display:none; margin-top:15px; border-top:1px solid var(--border); padding-top:15px;">
                                <div style="display:flex; flex-direction:column; gap:8px;">
                                    <div style="font-size:0.75rem; color:var(--v2); font-weight:700; text-transform:uppercase;">Key Topics</div>
                                    <div style="display:flex; flex-wrap:wrap; gap:6px;">
                                        ${m.topics?.map(t => `<span class="topic-tag">${t}</span>`).join('') || '<span style="color:var(--dim);">No topics.</span>'}
                                    </div>
                                </div>
                                <div style="margin-top:15px;">
                                    <div style="font-size:0.75rem; color:var(--gr); font-weight:700; text-transform:uppercase;">Outcomes / Bonus</div>
                                    <ul class="bonus-list">
                                        ${m.bonus?.length > 0 ? m.bonus.map(b => `<li>${b}</li>`).join('') : '<li style="list-style:none; color:var(--dim);">No outcomes listed.</li>'}
                                    </ul>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    `;
}
// Add this helper for filtering the list in real-time
function filterEnrollmentList(term) {
    const list = document.getElementById('enrollment-list');
    const items = list.getElementsByClassName('enroll-item');
    const lowTerm = term.toLowerCase();

    for (let item of items) {
        const text = item.textContent.toLowerCase();
        item.style.display = text.includes(lowTerm) ? 'flex' : 'none';
    }
}

async function openEnrollmentModal(batchId) {
    // Fetch students from server or local fallback
    const students = await apiGet('/admin/students?limit=500') || (ls('users') || []).filter(u => u.role === 'student');
    const currentBatch = _activeCourseContext?.batches?.find(b => b.id === batchId);
    const enrolledIds = currentBatch?.students || [];

    const modalHtml = `
        <div class="modal-overlay open" id="modal-enroll">
            <div class="modal" style="max-width: 600px;">
                <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">✕</button>
                <div class="modal-title">Batch Enrollment Management</div>
                <div class="modal-sub">Managing: ${currentBatch?.name || 'Batch'}</div>
                
                <div class="form-group">
                    <input type="text" class="form-input" id="student-search" placeholder="Search by name, email, or phone..." 
                           oninput="filterEnrollmentList(this.value)">
                </div>

                <div class="enrollment-scroll-container" id="enrollment-list">
                    ${students.map(s => {
                        const isEnrolled = enrolledIds.includes(s.id);
                        return `
                        <div class="enroll-item anim-in">
                            <div class="enroll-info">
                                <div class="enroll-name">${s.name} ${isEnrolled ? '<span class="badge badge-g">Enrolled</span>' : ''}</div>
                                <div class="enroll-meta">
                                    <span>📧 ${s.email}</span>
                                    <span>📱 ${s.phone || 'No Phone'}</span>
                                </div>
                            </div>
                            <button class="btn ${isEnrolled ? 'btn-danger' : 'btn-v'} btn-sm" 
                                onclick="${isEnrolled ? `removeStudentFromBatch('${s.id}', '${batchId}')` : `enrollExistingStudent('${s.id}', '${batchId}')`}">
                                ${isEnrolled ? 'Remove' : 'Add →'}
                            </button>
                            
                        </div>`;
                    }).join('')}
                </div>
            </div>
        </div>`;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}
async function removeStudentFromBatch(studentId, batchId) {
    if (!confirm("Are you sure you want to un-enroll this student from this batch?")) return;

    try {
        const response = await fetch(`${BACKEND_URL}/admin/batches/unenroll/${studentId}`, {
            method: 'PUT', // Using PUT for un-enrollment logic
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ batchId: batchId }) // Send the specific batch ID
        });

        if (response.ok) {
            showToast('Student un-enrolled', '🗑️');
            openEnrollmentModal(batchId); // Refresh modal
        }
    } catch (err) {
        showToast('Error: ' + err.message, '❌');
    }
}
// Add this helper for filtering the list in real-time
function filterEnrollmentList(term) {
    const list = document.getElementById('enrollment-list');
    const items = list.getElementsByClassName('enroll-item');
    const lowTerm = term.toLowerCase();

    for (let item of items) {
        const text = item.textContent.toLowerCase();
        item.style.display = text.includes(lowTerm) ? 'flex' : 'none';
    }
}
async function requestDeleteBatch(batchId) {
    if (!confirm("Are you sure you want to deactivate this batch? Students will lose access.")) return;

    try {
        const response = await fetch(`${BACKEND_URL}/admin/batches/${batchId}`, {
            method: 'DELETE',
            credentials: 'include'
        });

        if (response.ok) {
            showToast('Batch deactivated successfully', '🗑️');
            renderCourseDeepDive(_activeCourseContext.id); // Refresh view
        } else {
            throw new Error("Failed to delete batch");
        }
    } catch (err) {
        showToast('Error: ' + err.message, '❌');
    }
}
async function enrollExistingStudent(studentId, batchId) {
    try {
        const response = await fetch(`${BACKEND_URL}/admin/batches/${batchId}/enroll`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ studentId: studentId }) // Structured for controller
        });

        if (response.ok) {
            showToast('Student added to batch!', '✅');
            renderCourseDeepDive(_activeCourseContext.id);
        } else {
            throw new Error("Enrollment failed");
        }
    } catch (e) {
        showToast('Error: ' + e.message, '❌');
    }
}
// async function renderCourseDeepDive(courseId) {
//     showLoading();
//     const mc = document.getElementById('main-content');
    
//     const response = await apiGet(`/admin/courses/search?q=${courseId}`); 
//     const course = response.courses.find(c => c.id === courseId);
//     if (!course) return renderAdminCurriculum();

//     _activeCourseContext = course; 
//     saveNavState('course-detail', courseId);

//     mc.innerHTML = `
//         <div class="topbar">
//             <div class="topbar-left">
//                 <button class="btn btn-out btn-sm" onclick="renderAdminCurriculum()">← Back</button>
//                 <div style="margin-left:15px;"><div class="topbar-title">Editing: ${course.name}</div></div>
//             </div>
//             <div class="topbar-right">
//                 <button class="btn btn-v btn-sm" onclick="openModuleModal()">+ Add Module</button>
//                 <button class="btn btn-success btn-sm" onclick="openBatchModal(null, '${course.id}')">+ Add Batch</button>
//             </div>
//         </div>

//         <div class="editor-layout anim-in">
//             <div class="card">
//                 <div class="card-header">
//                     <div class="card-title">📚 Course Syllabus</div>
//                 </div>
//                 <div class="syllabus-container">
//                     ${course.modules?.map((m, i) => `
//                         <div class="syllabus-item expandable" id="mod-card-${m.id}">
//                             <div class="syllabus-header" onclick="toggleModuleExpand('${m.id}')" style="cursor:pointer;">
//                                 <span class="syllabus-index">Module 0${m.order || i+1}</span>
//                                 <div style="display:flex; gap:8px;">
//                                     <button class="btn btn-out btn-icon" onclick="event.stopPropagation(); openModuleModal('${m.id}')">✏️</button>
//                                     <button class="btn btn-danger btn-icon" onclick="event.stopPropagation(); requestDeleteModule('${m.id}', '${course.id}')">🗑️</button>
//                                 </div>
//                             </div>
//                             <div style="font-weight:600; color:white; font-size:1rem; margin-top:5px;">${m.title}</div>
                            
//                             <div class="mod-details" id="details-${m.id}" style="display:none; margin-top:15px; border-top:1px solid var(--border); padding-top:15px;">
//                                 <div class="card-sub" style="margin-bottom:10px;">${m.description || 'No description provided.'}</div>
                                
//                                 <div style="display:flex; flex-direction:column; gap:8px;">
//                                     <div style="font-size:0.75rem; color:var(--v2); font-weight:700; text-transform:uppercase;">Key Topics</div>
//                                     <div style="display:flex; flex-wrap:wrap; gap:6px;">
//                                         ${m.topics?.map(t => `<span class="topic-tag">${t}</span>`).join('') || '<span style="color:var(--dim);">No topics.</span>'}
//                                     </div>
//                                 </div>

//                                 <div style="margin-top:15px;">
//                                     <div style="font-size:0.75rem; color:var(--gr); font-weight:700; text-transform:uppercase;">Learning Outcomes / Bonus</div>
//                                     <ul class="bonus-list">
//                                         ${m.bonus?.length > 0 ? m.bonus.map(b => `<li>${b}</li>`).join('') : '<li style="list-style:none; color:var(--dim);">No outcomes listed.</li>'}
//                                     </ul>
//                                 </div>
//                             </div>
//                         </div>
//                     `).join('')}
//                 </div>
//             </div>
//             </div>
//     `;
// }
async function saveBatchAction(batchId, courseId) {
    const payload = {
        name: document.getElementById('in-b-name').value,
        type: document.getElementById('in-b-type').value,
        start: document.getElementById('in-b-start').value,
        end: document.getElementById('in-b-end').value,
        timing: document.getElementById('in-b-timing').value,
        courseId: courseId,
        zoomDetails: {
            link: document.getElementById('in-b-zoom').value,
            id: "Generated", 
            pass: "admin123"
        },
        active: true,
        isDeleted: false
    };

    const method = (batchId && batchId !== 'null') ? 'PUT' : 'POST';
    const url = method === 'PUT' ? `/admin/batches/${batchId}` : `/admin/batches`;

    try {
        const res = await apiWrite(url, method, payload); // Uses your common backend caller
        showToast('Batch Saved Successfully', '✅');
        document.getElementById('modal-manage-batch').remove();
        renderAdminBatches(); // Refresh UI
    } catch (e) {
        showToast('Error saving batch: ' + e.message, '❌');
    }
}
async function requestDeleteModule(moduleId, courseId) {
    if (!confirm("Are you sure you want to remove this module from the curriculum?")) return;

    try {
        // Construct the URL matching your backend route
        const response = await fetch(`${BACKEND_URL}/admin/modules/${moduleId}`, {
            method: 'DELETE',
            credentials: 'include' // Required for your session cookies
        });

        if (response.ok) {
            showToast('Module removed successfully', '🗑️');
            renderCourseDeepDive(courseId); // Refresh the UI to reflect changes
        } else {
            throw new Error("Failed to delete");
        }
    } catch (err) {
        showToast('Error deleting module', '❌');
        console.error(err);
    }
}
function toggleModuleExpand(id) {
    const el = document.getElementById(`details-${id}`);
    const isHidden = el.style.display === 'none';
    el.style.display = isHidden ? 'block' : 'none';
}
// Global state for simple editing
let activeModuleId = null;

function openModuleModal(moduleId = null,courseId) {
    const isEdit = !!moduleId;
    const m = isEdit ? _activeCourseContext.modules.find(mod => mod.id === moduleId) : {};
    
    // Build the Common Template
    const modalHtml = `
        <div class="modal-overlay open" id="modal-manage-module">
            <div class="modal">
                <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">✕</button>
                <div class="modal-title">${isEdit ? 'Update' : 'Create'} Module</div>
                <div class="modal-sub">${_activeCourseContext.name} <span style="color:var(--dim);">(${_activeCourseContext.id})</span></div>
                
                <div class="form-group">
                    <label class="form-label">Module Title</label>
                    <input class="form-input" id="in-mod-title" value="${m.title || ''}" placeholder="e.g. Intro to SEO">
                </div>
                
                <div class="grid-2">
                    <div class="form-group">
                        <label class="form-label">Sequence Order</label>
                        <input type="number" class="form-input" id="in-mod-order" value="${m.order || ''}" placeholder="1">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Course ID (Locked)</label>
                        <input class="form-input" value="${_activeCourseContext.id}" disabled style="opacity:0.5;">
                    </div>
                </div>

                <div class="form-group">
                    <label class="form-label">Topics (One per line)</label>
                    <textarea class="form-input" id="in-mod-topics" style="height:80px;">${m.topics?.join('\n') || ''}</textarea>
                </div>

                <div class="form-group">
                    <label class="form-label">Bonus Outcomes (One per line)</label>
                    <textarea class="form-input" id="in-mod-bonus" style="height:80px;">${m.bonus?.join('\n') || ''}</textarea>
                </div>

                <button class="btn btn-v btn-full" onclick="saveModuleAction('${moduleId}')">
                    ${isEdit ? 'Update Module Content →' : 'Post New Module →'}
                </button>
            </div>
        </div>`;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}
async function saveModuleAction(existingId) {
    const payload = {
        title: document.getElementById('in-mod-title').value,
        order: parseInt(document.getElementById('in-mod-order').value),
        topics: document.getElementById('in-mod-topics').value.split('\n').filter(x => x.trim()),
        bonus: document.getElementById('in-mod-bonus').value.split('\n').filter(x => x.trim()),
        courseId: _activeCourseContext.id
    };

    const method = existingId !== "null" && existingId ? 'PUT' : 'POST';
    const endpoint = method === 'PUT' ? `/admin/modules/${existingId}` : `/admin/modules`;

    try {
      console.log(method," ",endpoint, payload)
        await apiWrite(endpoint, method, payload); // Common API wrapper
        showToast('Module content saved!', '✅');
        document.getElementById('modal-manage-module').remove();
        renderCourseDeepDive(_activeCourseContext.id); // Refresh view
    } catch (e) {
        showToast('Save failed', '❌');
    }
}

async function apiWrite(endpoint, method = 'POST', payload = {}) {
    try {
        const response = await fetch(`${BACKEND_URL}${endpoint}`, {
            method: method,
            credentials: 'include', // CRITICAL: Sends session info
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (response.status === 401) {
            auth.doLogout();
            throw new Error("Unauthorized access.");
        }

        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.message || "Save Failed");
        }

        return await response.json();
    } catch (error) {
        console.error(`${method} Error [${endpoint}]:`, error);
        throw error;
    }
}

// function openModuleModal(moduleId = null, courseId) {
//   activeModuleId = moduleId;
//   const isEdit = !!moduleId;
  
//   // Create a dynamic modal for modules
//   const modalHtml = `
//     <div class="modal-overlay open" id="modal-manage-module">
//       <div class="modal">
//         <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">✕</button>
//         <div class="modal-title">${isEdit ? 'Edit' : 'Add'} Module</div>
//         <div class="form-group">
//           <label class="form-label">Title</label>
//           <input class="form-input" id="mod-title-input" placeholder="Module Title">
//         </div>
//         <div class="form-group">
//           <label class="form-label">Linked Course ID</label>
//           <input class="form-input" value="${courseId}" disabled>
//         </div>
//         <button class="btn btn-v btn-full" onclick="saveModule('${courseId}')">Save Module →</button>
//       </div>
//     </div>`;
//   document.body.insertAdjacentHTML('beforeend', modalHtml);
// }

async function saveModule(courseId) {
  const title = document.getElementById('mod-title-input').value;
  const payload = { title, courseId };

  try {
    const method = activeModuleId ? 'PUT' : 'POST';
    const endpoint = activeModuleId ? `/admin/modules/${activeModuleId}` : `/admin/modules`;
    
    // Call common apiWrite helper
    await apiWrite(endpoint, method, payload);
    
    showToast('Module saved successfully!', '✅');
    document.getElementById('modal-manage-module').remove();
    renderCourseDeepDive(courseId); // Refresh details
  } catch (e) {
    showToast('Error saving module', '❌');
  }
}

function renderCourseCard(course, isPinned) {
    const isAdmin = _currentUser.role === 'admin';
    const modCount = course.modules ? course.modules.length : 0;
    const batchCount = course.batches ? course.batches.length : 0;
    
    return `
    <div class="module-card anim-in">
      <div class="mc-top">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <div class="mc-num">${modCount} Modules</div>
          <div style="display:flex; gap:8px;">
            ${isAdmin ? `<button class="btn btn-danger btn-icon" onclick="deleteCourse('${course.id}')" title="Delete Course">🗑️</button>` : ''}
            <span class="badge" onclick="togglePinCourse('${course.id}'); event.stopPropagation();" 
                  style="cursor:pointer; background: ${isPinned ? 'var(--v1)' : 'transparent'};">
              ${isPinned ? '★ Pinned' : '☆ Pin'}
            </span>
          </div>
        </div>
        <div class="mc-title">${course.name || 'Untitled Course'}</div>
      </div>
      <div class="mc-bottom">
        <span class="badge badge-b">${batchCount} Active Batches</span>
        <span class="details-link" onclick="renderCourseDeepDive('${course.id}')" 
              style="cursor:pointer; color:var(--v2); font-weight:600;">More Details →</span>
      </div>
    </div>`;
}

async function postData(key, payload) {
  if (USE_SERVER) {
    try {
      const response = await fetch(`${BACKEND_URL}/admin/${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', 

        body: JSON.stringify(payload)
      });
      return await response.json();
    } catch (err) {
      console.error(`Failed to post to server for ${key}`, err);
    }
  }
  // Local fallback logic
  let data = ls(key) || (key === 'attendance' ? {} : []);
  if (Array.isArray(data)) {
    data.push(payload);
  } else {
    Object.assign(data, payload);
  }
  ls(key, data);
  return payload;
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

/* ═══════════════════════════════════════════════════════
   AUTH
═══════════════════════════════════════════════════════ */
var _currentUser = null;
var _loginPending = null;

function completeLogin(user) {
  _currentUser = user;
  ls('session_user', user);

  document.getElementById('login-page').classList.remove('active');
  document.getElementById('app-shell').classList.add('active');
  
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

  // Clear the saved session
  localStorage.removeItem('tlms_session_user');

  document.getElementById('app-shell').classList.remove('active');
  document.getElementById('login-page').classList.add('active');
  document.getElementById('step-login').style.display = 'block';
  document.getElementById('step-otp').style.display = 'none';
  document.getElementById('login-email').value = '';
  document.getElementById('login-pass').value = '';
  for (var i = 0; i < 6; i++) {
    let otpInput = document.getElementById('otp' + i);
    if (otpInput) otpInput.value = '';
  }
}

function checkSession() {
  var savedUser = ls('session_user');
  if (savedUser) {
    // If a saved user is found, instantly log them in and show dashboard
    completeLogin(savedUser);
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
/* ═══════════════════════════════════════════════════════
   SHELL BUILDER (Dynamic RBAC UI)
═══════════════════════════════════════════════════════ */
function buildShell() {
  var u = _currentUser;
  
  // 1. Setup User Profile UI
  document.getElementById('sb-name').textContent = u.name;
  // Capitalize the first letter of their role for the display
  document.getElementById('sb-role').textContent = u.role.charAt(0).toUpperCase() + u.role.slice(1);
  
  var isAdminType = ['admin', 'superadmin', 'faculty', 'staff', 'technical-team'].includes(u.role);
  document.getElementById('sb-role-badge').textContent = isAdminType ? 'Staff Panel' : 'Student Portal';
  
  document.getElementById('sb-avatar').textContent = u.name[0].toUpperCase();
  document.getElementById('sb-avatar').style.background = isAdminType 
    ? 'linear-gradient(135deg,#f59e0b,#ef4444)' 
    : 'linear-gradient(135deg,var(--v1),var(--b1))';

  // 2. Fetch Allowed Modules based on Backend Role
  var userRole = u.role || 'student';
  var allowedModules = FRONTEND_MODULES[userRole] || FRONTEND_MODULES['student']; // Fallback to student

  // 3. Dynamically Generate Sidebar HTML
  var nav = document.getElementById('sidebar-nav');
  var navHTML = '';
  var currentSection = '';

  allowedModules.forEach(function(mod, index) {
    // Add section headers automatically if it changes
    if (mod.section && mod.section !== currentSection) {
      navHTML += `<div class="sb-section">${mod.section}</div>`;
      currentSection = mod.section;
    }
    
    // Make the first item active by default
    var activeClass = index === 0 ? 'active' : '';
    navHTML += `<div class="sb-item ${activeClass}" onclick="navTo('${mod.id}', this)"><span class="sb-item-icon">${mod.icon}</span>${mod.label}</div>`;
  });

  nav.innerHTML = navHTML;

  // Instead, just highlight the first item visually
  const firstItem = nav.querySelector('.sb-item');
  if (firstItem) firstItem.classList.add('active');
  // 4. Automatically navigate to their first permitted module
  // navTo(allowedModules[0].id, null);
}
function navTo(page, el) {
    document.querySelectorAll('.sb-item').forEach(function (i) { i.classList.remove('active'); });
    if (el) {
        el.classList.add('active');
    } else {
        const matchingEl = document.querySelector(`.sb-item[onclick*="${page}"]`);
        if (matchingEl) matchingEl.classList.add('active');
    }

    // Save state (Normal pages have no args)
    saveNavState(page, null);

    if (_currentUser.role === 'admin') renderAdminPage(page);
    else renderStudentPage(page);
}

/* ═══════════════════════════════════════════════════════
   ADMIN PAGES
═══════════════════════════════════════════════════════ */
function renderAdminPage(page) {
  if (page === 'admin-dashboard') renderAdminDashboard();
  else if (page === 'admin-batches') renderAdminBatches();
  else if (page === 'admin-students') renderAdminStudents();
  else if (page === 'admin-documents') renderAdminDocuments();
  else if (page === 'admin-recordings') renderAdminRecordings();
  else if (page === 'admin-attendance') renderAdminAttendance();
  else if (page === 'admin-certificates') renderAdminCertificates();// Add this line so Admin can view the curriculum
  // else if (page === 'admin-curriculum') renderStudentCourse();
  else if (page === 'admin-curriculum') renderAdminCurriculum();
  else if (page === 'user-profile') renderUserProfile();
}

async function renderAdminDashboard() {
  showLoading();

  var mc = document.getElementById('main-content');
  try {
    const data = await fetchApiData('/public/dashboard/summary?top=20', () => {
      // FALLBACK IF API FAILS: Calculate from local storage
      const users = ls('users') || [];
      const batches = ls('batches') || [];
      const students = users.filter(u => u.role === 'student');
      return {
        totalStudents: students.length,
        activeBatchesCount: batches.filter(b => b.active).length,
        totalDocs: (ls('documents') || []).length,
        totalRecs: (ls('recordings') || []).length,
        recentStudents: students.slice(0, 5),
        activeBatches: batches
      };
    });
    mc.innerHTML = `
      <div class="topbar"><div class="topbar-left"><div><div class="topbar-title">Admin Dashboard</div><div class="topbar-sub">${new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div></div></div><div class="topbar-right"><div class="notif-bell">🔔<span class="notif-dot"></span></div></div></div>
      
      <div class="grid-4" style="margin-bottom:20px;">
        <div class="stat-card anim-in"><div class="stat-num" style="background:linear-gradient(135deg,var(--v2),var(--v3));-webkit-background-clip:text;-webkit-text-fill-color:transparent;">${data.totalStudents}</div><div class="stat-lbl">Total Students</div></div>
        <div class="stat-card anim-in" style="animation-delay:.07s"><div class="stat-num" style="background:linear-gradient(135deg,var(--b1),var(--b2));-webkit-background-clip:text;-webkit-text-fill-color:transparent;">${data.activeBatchesCount}</div><div class="stat-lbl">Active Batches</div></div>
        <div class="stat-card anim-in" style="animation-delay:.14s"><div class="stat-num" style="background:linear-gradient(135deg,var(--c1),var(--c2));-webkit-background-clip:text;-webkit-text-fill-color:transparent;">${data.totalDocs}</div><div class="stat-lbl">Documents</div></div>
        <div class="stat-card anim-in" style="animation-delay:.21s"><div class="stat-num" style="background:linear-gradient(135deg,var(--am),#fde68a);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">${data.totalRecs}</div><div class="stat-lbl">Recordings</div></div>
      </div>

      <div class="grid-2" style="margin-bottom:20px;">
        
        <div class="card anim-in">
          <div class="card-header"><div class="card-title">Active Batches</div><button class="btn btn-v btn-sm" onclick="openModal('modal-add-batch')">+ New Batch</button></div>
          
          <div style="max-height: 320px; overflow-y: auto; padding-right: 5px;">
            ${data.activeBatches.map(b => {
              let daysLeft = Math.max(0, Math.ceil((new Date(b.end) - new Date()) / 86400000));
              let progress = Math.min(100, Math.max(0, Math.round((new Date() - new Date(b.start)) / (new Date(b.end) - new Date(b.start)) * 100)));
              return `<div style="padding:14px 0;border-bottom:1px solid var(--border);">
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
                  <div><div style="font-size:.85rem;font-weight:600;color:white;">${b.name}</div><div style="font-size:.72rem;color:var(--muted);margin-top:2px;">${b.timing} · ${b.students ? b.students.length : 0} students</div></div>
                  <span class="badge ${b.active && daysLeft > 0 ? 'badge-g' : 'badge-r'}">${daysLeft > 0 ? daysLeft + 'd left' : 'Ended'}</span>
                </div>
                <div class="progress-wrap"><div class="progress-fill" style="width:${progress}%;background:linear-gradient(90deg,var(--v1),var(--b1));"></div></div>
              </div>`;
            }).join('')}
          </div>
        </div>
        
        <div class="card anim-in" style="animation-delay:.1s">
          <div class="card-header"><div class="card-title">Recent Students</div><button class="btn btn-v btn-sm" onclick="openModal('modal-add-student')">+ Invite</button></div>
          
          <div style="max-height: 320px; overflow-y: auto; padding-right: 5px;">
            ${data.recentStudents.length === 0 ? '<p style="font-size:.8rem;color:var(--muted);padding:16px 0;text-align:center;">No students yet.</p>' : ''}
            ${data.recentStudents.map(s => {
              return `<div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--border);">
                <div style="width:34px;height:34px;border-radius:50%;background:linear-gradient(135deg,var(--v1),var(--b1));display:flex;align-items:center;justify-content:center;font-weight:700;font-size:.85rem;color:white;flex-shrink:0;">${s.name[0]}</div>
                <div style="flex:1;"><div style="font-size:.83rem;font-weight:600;color:white;">${s.name}</div><div style="font-size:.7rem;color:var(--muted);">${s.email}</div></div>
              </div>`;
            }).join('')}
          </div>
        </div>

      </div>
      
      <div class="card anim-in">
        <div class="card-header"><div class="card-title">Quick Actions</div></div>
        <div style="display:flex;gap:12px;flex-wrap:wrap;">
          <button class="btn btn-v btn-sm" onclick="openModal('modal-add-batch')">🗂️ Create Batch</button>
          <button class="btn btn-v btn-sm" onclick="openModal('modal-add-student')">👤 Invite Student</button>
          <button class="btn btn-v btn-sm" onclick="openModal('modal-upload-doc')">📄 Upload Notes</button>
          <button class="btn btn-v btn-sm" onclick="openModal('modal-add-recording')">🎥 Add Recording</button>
          <button class="btn btn-v btn-sm" onclick="navTo('admin-certificates',null);document.querySelectorAll('.sb-item')[7]&&document.querySelectorAll('.sb-item')[7].classList.add('active')">🏆 Generate Certificates</button>
        </div>
      </div>
    `;
  } catch (e) {
    console.log(e)
    var users = ls('users') || [];
    var batches = ls('batches') || [];
    var docs = ls('documents') || [];
    var recs = ls('recordings') || [];
    var students = users.filter(function (u) { return u.role === 'student'; });
    mc.innerHTML = `
      <div class="topbar"><div class="topbar-left"><div><div class="topbar-title">Admin Dashboard</div><div class="topbar-sub">${new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div></div></div><div class="topbar-right"><div class="notif-bell">🔔<span class="notif-dot"></span></div></div></div>
      <div class="grid-4" style="margin-bottom:20px;">
        <div class="stat-card anim-in"><div class="stat-num" style="background:linear-gradient(135deg,var(--v2),var(--v3));-webkit-background-clip:text;-webkit-text-fill-color:transparent;">${students.length}</div><div class="stat-lbl">Total Students</div></div>
        <div class="stat-card anim-in" style="animation-delay:.07s"><div class="stat-num" style="background:linear-gradient(135deg,var(--b1),var(--b2));-webkit-background-clip:text;-webkit-text-fill-color:transparent;">${batches.filter(function (b) { return b.active; }).length}</div><div class="stat-lbl">Active Batches</div></div>
        <div class="stat-card anim-in" style="animation-delay:.14s"><div class="stat-num" style="background:linear-gradient(135deg,var(--c1),var(--c2));-webkit-background-clip:text;-webkit-text-fill-color:transparent;">${docs.length}</div><div class="stat-lbl">Documents</div></div>
        <div class="stat-card anim-in" style="animation-delay:.21s"><div class="stat-num" style="background:linear-gradient(135deg,var(--am),#fde68a);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">${recs.length}</div><div class="stat-lbl">Recordings</div></div>
      </div>
      <div class="grid-2" style="margin-bottom:20px;">
        <div class="card anim-in">
          <div class="card-header"><div class="card-title">Active Batches</div><button class="btn btn-v btn-sm" onclick="openModal('modal-add-batch')">+ New Batch</button></div>
          ${batches.map(function (b) {
            var daysLeft = Math.max(0, Math.ceil((new Date(b.end) - new Date()) / 86400000));
            var progress = Math.min(100, Math.max(0, Math.round((new Date() - new Date(b.start)) / (new Date(b.end) - new Date(b.start)) * 100)));
            return `<div style="padding:14px 0;border-bottom:1px solid var(--border);">
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
                <div><div style="font-size:.85rem;font-weight:600;color:white;">${b.name}</div><div style="font-size:.72rem;color:var(--muted);margin-top:2px;">${b.timing} · ${b.students.length} students</div></div>
                <span class="badge ${b.active && daysLeft > 0 ? 'badge-g' : 'badge-r'}">${daysLeft > 0 ? daysLeft + 'd left' : 'Ended'}</span>
              </div>
              <div class="progress-wrap"><div class="progress-fill" style="width:${progress}%;background:linear-gradient(90deg,var(--v1),var(--b1));"></div></div>
            </div>`;
          }).join('')}
        </div>
        <div class="card anim-in" style="animation-delay:.1s">
          <div class="card-header"><div class="card-title">Recent Students</div><button class="btn btn-v btn-sm" onclick="openModal('modal-add-student')">+ Invite</button></div>
          ${students.length === 0 ? '<p style="font-size:.8rem;color:var(--muted);padding:16px 0;text-align:center;">No students yet. Invite your first student!</p>' : ''}
          ${students.slice(0, 5).map(function (s) {
            var batch = batches.find(function (b) { return b.students.includes(s.id); }) || {};
            return `<div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--border);">
              <div style="width:34px;height:34px;border-radius:50%;background:linear-gradient(135deg,var(--v1),var(--b1));display:flex;align-items:center;justify-content:center;font-weight:700;font-size:.85rem;color:white;flex-shrink:0;">${s.name[0]}</div>
              <div style="flex:1;"><div style="font-size:.83rem;font-weight:600;color:white;">${s.name}</div><div style="font-size:.7rem;color:var(--muted);">${s.email}</div></div>
              <span class="badge badge-v">${batch.name ? batch.name.split(' ')[0] + ' ' + batch.name.split(' ')[1] : 'No Batch'}</span>
            </div>`;
          }).join('')}
        </div>
      </div>
      <div class="card anim-in">
        <div class="card-header"><div class="card-title">Quick Actions</div></div>
        <div style="display:flex;gap:12px;flex-wrap:wrap;">
          <button class="btn btn-v btn-sm" onclick="openModal('modal-add-batch')">🗂️ Create Batch</button>
          <button class="btn btn-v btn-sm" onclick="openModal('modal-add-student')">👤 Invite Student</button>
          <button class="btn btn-v btn-sm" onclick="openModal('modal-upload-doc')">📄 Upload Notes</button>
          <button class="btn btn-v btn-sm" onclick="openModal('modal-add-recording')">🎥 Add Recording</button>
          <button class="btn btn-v btn-sm" onclick="navTo('admin-certificates',null);document.querySelectorAll('.sb-item')[7]&&document.querySelectorAll('.sb-item')[7].classList.add('active')">🏆 Generate Certificates</button>
        </div>
      </div>
    `;
  }
}
let _allBatches = []; // 🌟 Add this global state

// Updated Batch Rendering to populate the global state
async function renderAdminBatches() {
    showLoading();
    const mc = document.getElementById('main-content');

    const batches = await apiGet('/admin/batches') || ls('batches') || [];
    const students = await apiGet('/admin/students?limit=500') || (ls('users') || []);
    
    _allBatches = batches; // 🌟 Save to global context for the modal

    mc.innerHTML = `
        <div class="topbar">
            <div class="topbar-left"><div class="topbar-title">Batch Management</div></div>
            <div class="topbar-right">
                <button class="btn btn-v btn-sm" onclick="openBatchModal()">+ Create New Batch</button>
            </div>
        </div>
        <div class="batch-grid anim-in">
            ${batches.map(b => renderBatchComponent(b, students)).join('')}
        </div>
    `;
}
function renderBatchComponent(b, allStudents) {
    const enrolled = allStudents.filter(s => b.students?.includes(s.id));
    const daysLeft = Math.max(0, Math.ceil((new Date(b.end) - new Date()) / 86400000));
    const progress = Math.min(100, Math.max(0, Math.round((new Date() - new Date(b.start)) / (new Date(b.end) - new Date(b.start)) * 100)));

    return `
    <div class="card anim-in" style="background: var(--bg2); border: 1px solid var(--border);">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:14px;">
            <div>
                <div style="font-size:1rem;font-weight:700;color:white;margin-bottom:4px;">${b.name}</div>
                <span class="badge badge-v">${b.type}</span>
            </div>
            <span class="badge ${daysLeft > 0 ? 'badge-g' : 'badge-r'}">${daysLeft > 0 ? daysLeft + 'd left' : 'Ended'}</span>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px;font-size:.78rem;color:var(--muted);">
            <div>⏰ ${b.timing}</div>
            <div>👥 ${enrolled.length} students</div>
            <div>📅 ${b.start} → ${b.end}</div>
            <div>🔑 ${b.zoomDetails?.pass || 'admin123'}</div>
        </div>
        <div class="zoom-card" style="margin-bottom:14px; background: var(--bg);">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;"><span class="zoom-live-dot"></span><span style="font-size:.75rem;font-weight:700;color:white;">Zoom Session</span></div>
            <div style="font-size:.72rem;color:var(--muted);margin-bottom:6px;">ID: ${b.zoomDetails?.id || 'Generated'}</div>
            <a href="${b.zoomDetails?.link || '#'}" target="_blank" style="font-size:.72rem;color:var(--b2);word-break:break-all;">${b.zoomDetails?.link || 'No Link'}</a>
        </div>
        <div class="progress-wrap" style="margin-bottom:15px;">
            <div class="progress-fill" style="width:${progress}%;background:linear-gradient(90deg,var(--v1),var(--b1));"></div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <button class="btn btn-v btn-sm" onclick="openEnrollmentModal('${b.id}')">👥 Manage Enrollment</button>
            <button class="btn btn-out btn-sm" onclick="openBatchModal('${b.id}', '${b.courseId}')">✏️ Edit</button>
            <button class="btn btn-danger btn-sm" onclick="requestDeleteBatch('${b.id}')">Deactivate</button>
        </div>
    </div>`;
}

// 🌟 FIX: Updated Modal to find batch data in ALL possible locations
function openBatchModal(batchId = null, courseId = null) {
    const isEdit = !!batchId;
    let b = {};

    if (isEdit) {
        // Look in active course first, then global batches
        const source = _activeCourseContext?.batches || _allBatches;
        b = source.find(x => x.id === batchId) || {};
    }

    const modalHtml = `
        <div class="modal-overlay open" id="modal-manage-batch">
            <div class="modal">
                <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">✕</button>
                <div class="modal-title">${isEdit ? 'Update' : 'Create'} Batch</div>
                <div class="modal-sub">Course ID: ${courseId || b.courseId || 'Select in next step'}</div>
                
                <div class="form-group"><label class="form-label">Batch Name</label>
                    <input class="form-input" id="in-b-name" value="${b.name || ''}">
                </div>
                <div class="grid-2">
                    <div class="form-group"><label class="form-label">Type</label>
                        <select class="form-input" id="in-b-type">
                            <option value="weekend" ${b.type === 'weekend' ? 'selected' : ''}>Weekend</option>
                            <option value="weekday" ${b.type === 'weekday' ? 'selected' : ''}>Weekday</option>
                        </select>
                    </div>
                    <div class="form-group"><label class="form-label">Timing</label>
                        <input class="form-input" id="in-b-timing" value="${b.timing || ''}">
                    </div>
                </div>
                <div class="grid-2">
                    <div class="form-group"><label class="form-label">Start Date</label>
                        <input type="date" class="form-input" id="in-b-start" value="${b.start || ''}">
                    </div>
                    <div class="form-group"><label class="form-label">End Date</label>
                        <input type="date" class="form-input" id="in-b-end" value="${b.end || ''}">
                    </div>
                </div>
                <div class="form-group"><label class="form-label">Zoom Link</label>
                    <input class="form-input" id="in-b-zoom" value="${b.zoomDetails?.link || b.zoomLink || ''}">
                </div>
                
                <button class="btn btn-v btn-full" onclick="saveBatchAction('${batchId}', '${courseId || b.courseId}')">
                    ${isEdit ? 'Update Batch Schedule →' : 'Create Batch →'}
                </button>
            </div>
        </div>`;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}
// async function renderAdminBatches() {
//   var mc = document.getElementById('main-content');
//   mc.innerHTML = '<div style="padding:24px;text-align:center;color:var(--muted);">Loading batches...</div>';

//   var batches = [];
//   var users = [];

//   if (USE_SERVER) {
//     try {
//       const response = await fetch(`${BACKEND_URL}/admin/batches`, {
//             credentials: 'include' // <--- ADD THIS LINE
//         });
//       if (!response.ok) throw new Error('API failed to load batches');
//       batches = await response.json();

//       try {
//         const userRes = await fetch(`${BACKEND_URL}/admin/students?limit=100`, {
//             credentials: 'include' // <--- ADD THIS LINE
//         });
//         if (userRes.ok) users = await userRes.json();
//         else users = ls('users') || [];
//       } catch (userErr) {
//         users = ls('users') || [];
//       }
//     } catch (error) {
//       console.warn("Backend unavailable, falling back to LocalStorage.", error);
//       batches = ls('batches') || [];
//       users = ls('users') || [];
//     }
//   } else {
//     batches = ls('batches') || [];
//     users = ls('users') || [];
//   }

//   mc.innerHTML = `
//     <div class="topbar">
//       <div class="topbar-left"><div class="topbar-title">Batch Management</div></div>
//       <div class="topbar-right"><button class="btn btn-v btn-sm" onclick="openModal('modal-add-batch')">+ Create Batch</button></div>
//     </div>
//     <div class="grid-2">
//       ${batches.map(function (b) {
//         var studentIds = b.students || [];
//         var daysLeft = Math.max(0, Math.ceil((new Date(b.end) - new Date()) / 86400000));
//         var progress = Math.min(100, Math.max(0, Math.round((new Date() - new Date(b.start)) / (new Date(b.end) - new Date(b.start)) * 100)));
//         var enrolled = users.filter(function (u) { return studentIds.includes(u.id); });

//         return `<div class="card anim-in">
//           <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:14px;">
//             <div><div style="font-size:1rem;font-weight:700;color:white;margin-bottom:4px;">${b.name}</div>
//             <span class="badge ${b.type === 'weekend' ? 'badge-v' : 'badge-b'}">${b.type === 'weekend' ? 'Weekend' : 'Weekday'}</span></div>
//             <span class="badge ${daysLeft > 0 ? 'badge-g' : 'badge-r'}">${daysLeft > 0 ? daysLeft + 'd left' : 'Ended'}</span>
//           </div>
//           <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px;font-size:.78rem;color:var(--muted);">
//             <div>⏰ ${b.timing}</div>
//             <div>👥 ${enrolled.length} students</div>
//             <div>📅 ${b.start} → ${b.end}</div>
//             <div>🔑 ${b.zoomPass}</div>
//           </div>
//           <div class="zoom-card" style="margin-bottom:14px;">
//             <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;"><span class="zoom-live-dot"></span><span style="font-size:.75rem;font-weight:700;color:white;">Zoom Meeting</span></div>
//             <div style="font-size:.72rem;color:var(--muted);margin-bottom:6px;">ID: ${b.zoomId} · Pass: ${b.zoomPass}</div>
//             <a href="${b.zoomLink}" target="_blank" style="font-size:.72rem;color:var(--b2);word-break:break-all;">${b.zoomLink}</a>
//           </div>
//           <div class="progress-wrap" style="margin-bottom:10px;"><div class="progress-fill" style="width:${progress}%;background:linear-gradient(90deg,var(--v1),var(--b1));"></div></div>
//           <div style="display:flex;gap:8px;flex-wrap:wrap;">
//             <button class="btn btn-success btn-sm" onclick="openInviteForBatch('${b.id}')">+ Invite Student</button>
//             <button class="btn btn-danger btn-sm" onclick="toggleBatch('${b.id}')">${b.active ? 'Deactivate' : 'Activate'}</button>
//           </div>
//           ${enrolled.length > 0 ? `<div style="margin-top:12px;"><div style="font-size:.68rem;font-weight:700;color:var(--dim);letter-spacing:.08em;text-transform:uppercase;margin-bottom:6px;">Enrolled Students</div>${enrolled.map(function (s) { return '<span class="badge badge-v" style="margin:2px;">' + s.name + '</span>'; }).join('')}</div>` : ''}
//         </div>`;
//       }).join('')}
//     </div>
//   `;
// }

// async function renderAdminBatches() {
//     showLoading();
//     const mc = document.getElementById('main-content');

//     // Fetch data from server with local fallbacks
//     const batches = await apiGet('/admin/batches') || ls('batches') || [];
//     const students = await apiGet('/admin/students?limit=500') || (ls('users') || []).filter(u => u.role === 'student');

//     mc.innerHTML = `
//         <div class="topbar">
//             <div class="topbar-left"><div class="topbar-title">Batch Management</div></div>
//             <div class="topbar-right">
//                 <button class="btn btn-v btn-sm" onclick="openBatchModal()">+ Create New Batch</button>
//             </div>
//         </div>

//         <div class="batch-grid anim-in">
//             ${batches.map(b => {
//                 // Calculate time metrics
//                 const daysLeft = Math.max(0, Math.ceil((new Date(b.end) - new Date()) / 86400000));
//                 const progress = Math.min(100, Math.max(0, Math.round((new Date() - new Date(b.start)) / (new Date(b.end) - new Date(b.start)) * 100)));
                
//                 // Cross-reference enrolled students
//                 const enrolled = students.filter(s => b.students?.includes(s.id));

//                 return `
//                 <div class="card anim-in" style="background: var(--bg2);">
//                     <div style="display:flex; align-items:flex-start; justify-content:space-between; margin-bottom:14px;">
//                         <div>
//                             <div style="font-size:1.1rem; font-weight:700; color:white; margin-bottom:4px;">${b.name}</div>
//                             <span class="badge ${b.type === 'weekend' ? 'badge-v' : 'badge-b'}">${b.type}</span>
//                         </div>
//                         <span class="badge ${daysLeft > 0 ? 'badge-g' : 'badge-r'}">${daysLeft > 0 ? daysLeft + 'd left' : 'Ended'}</span>
//                     </div>

//                     <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:14px; font-size:.78rem; color:var(--muted);">
//                         <div>⏰ ${b.timing || 'Not Set'}</div>
//                         <div>👥 ${enrolled.length} Enrolled</div>
//                         <div>📅 ${b.start} → ${b.end}</div>
//                         <div>🔑 Pass: ${b.zoomDetails?.pass || b.zoomPass || 'admin123'}</div>
//                     </div>

//                     <div class="zoom-card" style="margin-bottom:14px; background: var(--bg);">
//                         <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">
//                             <span class="zoom-live-dot"></span>
//                             <span style="font-size:.75rem; font-weight:700; color:white;">Zoom Session Info</span>
//                         </div>
//                         <div style="font-size:.72rem; color:var(--muted); margin-bottom:6px;">
//                             ID: ${b.zoomDetails?.id || b.zoomId || 'Generated'}
//                         </div>
//                         <a href="${b.zoomDetails?.link || b.zoomLink || '#'}" target="_blank" style="font-size:.72rem; color:var(--b2); word-break:break-all;">
//                             ${b.zoomDetails?.link || b.zoomLink || 'No link provided'}
//                         </a>
//                     </div>

//                     <div class="progress-wrap">
//                         <div class="progress-fill" style="width:${progress}%; background:linear-gradient(90deg, var(--v1), var(--b1));"></div>
//                     </div>

//                     <div style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom:15px;">
//                         <button class="btn btn-v btn-sm" onclick="openEnrollmentModal('${b.id}')">👥 Manage Enrollment</button>
//                         <button class="btn btn-out btn-sm" onclick="openBatchModal('${b.id}', '${b.courseId}')">✏️ Edit</button>
//                         <button class="btn btn-danger btn-sm" onclick="requestDeleteBatch('${b.id}')">🗑️ Deactivate</button>
//                     </div>

//                     ${enrolled.length > 0 ? `
//                         <div style="border-top:1px solid var(--border); padding-top:12px;">
//                             <div style="font-size:.65rem; font-weight:700; color:var(--dim); text-transform:uppercase; margin-bottom:6px;">Enrolled Students</div>
//                             ${enrolled.map(s => `<span class="student-tag">${s.name}</span>`).join('')}
//                         </div>
//                     ` : ''}
//                 </div>`;
//             }).join('') || '<div class="card-sub">No batches found. Create your first batch to begin.</div>'}
//         </div>
//     `;
// }

// function openBatchModal(batchId = null, courseId = null) {
//     const isEdit = !!batchId;
//     // If editing, find batch in local or fetched data
//     const b = isEdit ? (ls('batches') || []).find(x => x.id === batchId) : {};

//     const modalHtml = `
//         <div class="modal-overlay open" id="modal-manage-batch">
//             <div class="modal">
//                 <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">✕</button>
//                 <div class="modal-title">${isEdit ? 'Update' : 'Create'} Batch</div>
//                 <div class="modal-sub">Linked Course ID: ${courseId || b.courseId || 'N/A'}</div>
                
//                 <div class="form-group"><label class="form-label">Batch Name</label>
//                     <input class="form-input" id="in-b-name" value="${b.name || ''}" placeholder="e.g. Node.js Weekend Mastery">
//                 </div>
//                 <div class="grid-2">
//                     <div class="form-group"><label class="form-label">Type</label>
//                         <select class="form-input" id="in-b-type">
//                             <option value="weekend" ${b.type === 'weekend' ? 'selected' : ''}>Weekend</option>
//                             <option value="weekday" ${b.type === 'weekday' ? 'selected' : ''}>Weekday</option>
//                         </select>
//                     </div>
//                     <div class="form-group"><label class="form-label">Timing</label>
//                         <input class="form-input" id="in-b-timing" value="${b.timing || ''}" placeholder="10:00 AM - 1:00 PM">
//                     </div>
//                 </div>
//                 <div class="grid-2">
//                     <div class="form-group"><label class="form-label">Start Date</label><input type="date" class="form-input" id="in-b-start" value="${b.start || ''}"></div>
//                     <div class="form-group"><label class="form-label">End Date</label><input type="date" class="form-input" id="in-b-end" value="${b.end || ''}"></div>
//                 </div>
//                 <div class="form-group"><label class="form-label">Zoom Link</label><input class="form-input" id="in-b-zoom" value="${b.zoomDetails?.link || ''}"></div>
                
//                 <button class="btn btn-v btn-full" onclick="saveBatchAction('${batchId}', '${courseId || b.courseId}')">
//                     ${isEdit ? 'Update Batch →' : 'Create Batch →'}
//                 </button>
//             </div>
//         </div>`;
//     document.body.insertAdjacentHTML('beforeend', modalHtml);
// }
// script.js
// function openBatchModal(batchId = null, courseId = null) {
//     const isEdit = !!batchId;
    
//     // 1. If editing, find the batch inside the active course context
//     let b = {};
//     if (isEdit && _activeCourseContext) {
//         b = _activeCourseContext.batches.find(x => x.id === batchId) || {};
//     }

//     const modalHtml = `
//         <div class="modal-overlay open" id="modal-manage-batch">
//             <div class="modal">
//                 <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">✕</button>
//                 <div class="modal-title">${isEdit ? 'Update' : 'Create'} Batch</div>
//                 <div class="modal-sub">Linked Course ID: ${courseId || b.courseId}</div>
                
//                 <div class="form-group"><label class="form-label">Batch Name</label>
//                     <input class="form-input" id="in-b-name" value="${b.name || ''}">
//                 </div>
//                 <div class="grid-2">
//                     <div class="form-group"><label class="form-label">Type</label>
//                         <select class="form-input" id="in-b-type">
//                             <option value="weekend" ${b.type === 'weekend' ? 'selected' : ''}>Weekend</option>
//                             <option value="weekday" ${b.type === 'weekday' ? 'selected' : ''}>Weekday</option>
//                         </select>
//                     </div>
//                     <div class="form-group"><label class="form-label">Timing</label>
//                         <input class="form-input" id="in-b-timing" value="${b.timing || ''}">
//                     </div>
//                 </div>
//                 <div class="grid-2">
//                     <div class="form-group"><label class="form-label">Start Date</label>
//                         <input type="date" class="form-input" id="in-b-start" value="${b.start || ''}">
//                     </div>
//                     <div class="form-group"><label class="form-label">End Date</label>
//                         <input type="date" class="form-input" id="in-b-end" value="${b.end || ''}">
//                     </div>
//                 </div>
//                 <div class="form-group"><label class="form-label">Zoom Link</label>
//                     <input class="form-input" id="in-b-zoom" value="${b.zoomDetails?.link || ''}">
//                 </div>
                
//                 <button class="btn btn-v btn-full" onclick="saveBatchAction('${batchId}', '${courseId || b.courseId}')">
//                     ${isEdit ? 'Update Batch →' : 'Create Batch →'}
//                 </button>
//             </div>
//         </div>`;
//     document.body.insertAdjacentHTML('beforeend', modalHtml);
// }
async function renderAdminStudents() {
  var mc = document.getElementById('main-content');
  mc.innerHTML = '<div style="padding:24px;text-align:center;color:var(--muted);">Loading students...</div>';

  var students = [];
  var batches = [];

  if (USE_SERVER) {
    try {
      const response = await fetch(`${BACKEND_URL}/admin/students`, {
            credentials: 'include' // <--- ADD THIS LINE
        });
      if (!response.ok) throw new Error('API failed to load students');
      students = await response.json();

      try {
        const batchRes = await fetch(`${BACKEND_URL}/admin/batches`, {
            credentials: 'include' // <--- ADD THIS LINE
        });
        if (batchRes.ok) batches = await batchRes.json();
        else batches = ls('batches') || [];
      } catch (batchErr) {
        batches = ls('batches') || [];
      }
    } catch (error) {
      console.warn("Backend unavailable, falling back to LocalStorage.", error);
      var allUsers = ls('users') || [];
      students = allUsers.filter(function (u) { return u.role === 'student'; });
      batches = ls('batches') || [];
    }
  } else {
    var allUsers = ls('users') || [];
    students = allUsers.filter(function (u) { return u.role === 'student'; });
    batches = ls('batches') || [];
  }

  mc.innerHTML = `
    <div class="topbar"><div class="topbar-left"><div class="topbar-title">Student Management</div></div><div class="topbar-right"><button class="btn btn-v btn-sm" onclick="openModal('modal-add-student')">+ Invite Student</button></div></div>
    <div class="card">
      <div class="card-header"><div class="card-title">All Students (${students.length})</div></div>
      ${students.length === 0 ? '<p style="text-align:center;color:var(--muted);padding:32px;">No students yet. Click "Invite Student" to get started.</p>' : ''}
      <div style="overflow-x:auto;">
      <table class="tbl">
        <thead><tr><th>Student</th><th>Email</th><th>Phone</th><th>Batch</th><th>Password</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>
          ${students.map(function (s) {
            var batch = batches.find(function (b) { return b.students && b.students.includes(s.id); }) || null;
            return `<tr>
              <td><div style="display:flex;align-items:center;gap:9px;"><div style="width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,var(--v1),var(--b1));display:flex;align-items:center;justify-content:center;font-weight:700;font-size:.82rem;flex-shrink:0;">${s.name[0]}</div><span style="font-weight:600;">${s.name}</span></div></td>
              <td style="color:var(--muted);">${s.email}</td>
              <td style="color:var(--muted);">${s.phone || '—'}</td>
              <td>${batch ? '<span class="badge badge-v">' + batch.name.substring(0, 20) + '...</span>' : '<span class="badge badge-r">No Batch</span>'}</td>
              <td style="font-family:monospace;font-size:.78rem;color:var(--v2);">${s.password}</td>
              <td><span class="badge ${s.firstLogin ? 'badge-g' : 'badge-a'}">${s.firstLogin ? 'Active' : 'Invited'}</span></td>
              <td><button class="btn btn-danger btn-sm" onclick="removeStudent('${s.id}')">Remove</button></td>
              <td>
    <button class="btn btn-danger btn-sm" 
            onclick="deleteStudentPermanently('${s.id}', '${s.name}')">
        Remove from batch
    </button>
</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
      </div>
    </div>
  `;
}

async function renderAdminDocuments() {
  var mc = document.getElementById('main-content');
  mc.innerHTML = '<div style="padding:24px;text-align:center;color:var(--muted);">Loading documents...</div>';

  var docs = [];
  if (USE_SERVER) {
    try {
      const response = await fetch(`${BACKEND_URL}/admin/documents`, {
            credentials: 'include' // <--- ADD THIS LINE
        });
      if (!response.ok) throw new Error('API failed to load documents');
      docs = await response.json();
    } catch (error) {
      console.warn("Backend unavailable, falling back to LocalStorage.", error);
      docs = ls('documents') || [];
    }
  } else {
    docs = ls('documents') || [];
  }

  mc.innerHTML = `
    <div class="topbar"><div class="topbar-left"><div class="topbar-title">Documents & Notes</div></div><div class="topbar-right"><button class="btn btn-v btn-sm" onclick="openModal('modal-upload-doc')">+ Upload Document</button></div></div>
    <div class="grid-auto">
      ${docs.map(function (d) {
        var icons = { pdf: '📄', template: '📋', assignment: '📝', reference: '📖', recording: '🎥' };
        var colors = { pdf: 'badge-v', template: 'badge-b', assignment: 'badge-a', reference: 'badge-c', recording: 'badge-g' };
        return `<div class="card anim-in" style="position:relative;">
          <div style="font-size:2rem;margin-bottom:10px;">${icons[d.type] || '📄'}</div>
          <div style="font-size:.88rem;font-weight:700;color:white;margin-bottom:5px;">${d.title}</div>
          <div style="font-size:.72rem;color:var(--muted);margin-bottom:8px;">${d.module}</div>
          <span class="badge ${colors[d.type] || 'badge-v'}" style="margin-bottom:10px;">${d.type}</span>
          <div style="font-size:.68rem;color:var(--dim);margin-bottom:12px;">Uploaded: ${d.uploadedAt}</div>
          <div style="display:flex;gap:7px;">
            <a href="${d.url}" target="_blank" class="btn btn-out btn-sm">Open ↗</a>
            <button class="btn btn-danger btn-sm" onclick="deleteDoc('${d.id}')">Delete</button>
          </div>
        </div>`;
      }).join('')}
      <div class="card anim-in" style="border-style:dashed;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;cursor:pointer;min-height:160px;" onclick="openModal('modal-upload-doc')">
        <div style="font-size:2rem;">➕</div>
        <div style="font-size:.82rem;color:var(--muted);">Upload Document</div>
      </div>
    </div>
  `;
}

async function renderAdminRecordings() {
  var mc = document.getElementById('main-content');
  mc.innerHTML = '<div style="padding:24px;text-align:center;color:var(--muted);">Loading recordings...</div>';

  var recs = [];
  var batches = [];

  if (USE_SERVER) {
    try {
      const response = await fetch(`${BACKEND_URL}/admin/recordings`, {
            credentials: 'include' // <--- ADD THIS LINE
        });
      if (!response.ok) throw new Error('API failed to load recordings');
      recs = await response.json();

      try {
        const batchRes = await fetch(`${BACKEND_URL}/admin/batches`, {
            credentials: 'include' // <--- ADD THIS LINE
        });
        if (batchRes.ok) batches = await batchRes.json();
        else batches = ls('batches') || [];
      } catch (batchErr) {
        batches = ls('batches') || [];
      }
    } catch (error) {
      console.warn("Backend unavailable, falling back to LocalStorage.", error);
      recs = ls('recordings') || [];
      batches = ls('batches') || [];
    }
  } else {
    recs = ls('recordings') || [];
    batches = ls('batches') || [];
  }

  mc.innerHTML = `
    <div class="topbar"><div class="topbar-left"><div class="topbar-title">Class Recordings</div></div><div class="topbar-right"><button class="btn btn-v btn-sm" onclick="openModal('modal-add-recording')">+ Add Recording</button></div></div>
    <div style="display:flex;flex-direction:column;gap:12px;">
      ${recs.length === 0 ? '<p style="text-align:center;color:var(--muted);padding:20px;">No recordings uploaded yet.</p>' : ''}
      ${recs.map(function (r, i) {
        var batch = batches.find(function (b) { return b.id === r.batch; }) || { name: 'All Batches' };
        return `<div class="card anim-in" style="animation-delay:${i * 0.06}s;">
          <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;">
            <div style="display:flex;align-items:center;gap:14px;">
              <div style="width:44px;height:44px;border-radius:10px;background:linear-gradient(135deg,rgba(239,68,68,.2),rgba(239,68,68,.1));border:1px solid rgba(239,68,68,.2);display:flex;align-items:center;justify-content:center;font-size:1.3rem;flex-shrink:0;">🎥</div>
              <div>
                <div style="font-size:.9rem;font-weight:700;color:white;margin-bottom:3px;">${r.title}</div>
                <div style="font-size:.72rem;color:var(--muted);">📅 ${r.date} · ⏱ ${r.duration} · 🏷 ${r.topics}</div>
              </div>
            </div>
            <div style="display:flex;align-items:center;gap:8px;">
              <span class="badge badge-b">${batch.name.substring(0, 18)}...</span>
              <a href="${r.url}" target="_blank" class="btn btn-out btn-sm">Watch ▶</a>
              <button class="btn btn-danger btn-sm" onclick="deleteRec('${r.id}')">Delete</button>
            </div>
          </div>
        </div> `;
      }).join('')}
    </div>
  `;
}

async function renderAdminAttendance() {
  var mc = document.getElementById('main-content');
  mc.innerHTML = '<div style="padding:24px;text-align:center;color:var(--muted);">Loading attendance data...</div>';

  var students = [];
  var batches = [];
  var attendance = {};

  if (USE_SERVER) {
    try {
      try {
        const stuRes = await fetch(`${BACKEND_URL}/admin/students`, {
            credentials: 'include' // <--- ADD THIS LINE
        });
        if (stuRes.ok) students = await stuRes.json();
        else students = (ls('users') || []).filter(u => u.role === 'student');
      } catch (e) { students = (ls('users') || []).filter(u => u.role === 'student'); }

      try {
        const batchRes = await fetch(`${BACKEND_URL}/admin/batches`, {
            credentials: 'include' // <--- ADD THIS LINE
        });
        if (batchRes.ok) batches = await batchRes.json();
        else batches = ls('batches') || [];
      } catch (e) { batches = ls('batches') || []; }

      try {
        const attRes = await fetch(`${BACKEND_URL}/admin/attendance`, {
            credentials: 'include' // <--- ADD THIS LINE
        });
        if (attRes.ok) attendance = await attRes.json();
        else attendance = ls('attendance') || {};
      } catch (e) { attendance = ls('attendance') || {}; }

    } catch (error) {
      console.warn("Backend unavailable, falling back to LocalStorage.", error);
      students = (ls('users') || []).filter(u => u.role === 'student');
      batches = ls('batches') || [];
      attendance = ls('attendance') || {};
    }
  } else {
    students = (ls('users') || []).filter(u => u.role === 'student');
    batches = ls('batches') || [];
    attendance = ls('attendance') || {};
  }

  if (students.length === 0) {
    console.log("No students found. Loading dummy data for preview.");
    students = [{ id: 'demo_student_1', name: 'Jane Doe (Demo Student)' }];
    batches = [{ id: 'demo_batch', name: 'UI/UX Preview Batch', students: ['demo_student_1'] }];
    attendance = {
      'demo_student_1': { '2026-03-28': 'present', '2026-03-29': 'present', '2026-03-30': 'absent' }
    };
  }

  mc.innerHTML = `
    <div class="topbar"><div class="topbar-left"><div class="topbar-title">Attendance Management</div></div><div class="topbar-right"><button class="btn btn-v btn-sm" onclick="openAttendanceModal()">Mark Today's Attendance</button></div></div>
    <div class="card" style="margin-bottom:18px;">
      <div class="card-header"><div class="card-title">Attendance Overview</div></div>
      <div style="overflow-x:auto;">
      <table class="tbl">
        <thead><tr><th>Student</th><th>Batch</th><th>Present</th><th>Total Sessions</th><th>Attendance %</th><th>Status</th></tr></thead>
        <tbody>
          ${students.map(function (s) {
        var batch = batches.find(function (b) { return b.students && b.students.includes(s.id); }) || null;
        var att = attendance[s.id] || {};
        var totalDays = Object.keys(att).length || 0;
        var presentDays = Object.values(att).filter(function (v) { return v === 'present'; }).length || 0;
        var totalSessions = Math.max(totalDays, 10);
        var pct = totalSessions > 0 ? Math.round(presentDays / totalSessions * 100) : 0;

        return `<tr>
              <td style="font-weight:600;">${s.name}</td>
              <td>${batch ? '<span class="badge badge-v">' + batch.name.substring(0, 16) + '...</span>' : '—'}</td>
              <td style="color:#6ee7b7;">${presentDays}</td>
              <td>${totalSessions}</td>
              <td>
                <div style="display:flex;align-items:center;gap:8px;">
                  <div class="progress-wrap" style="width:80px;"><div class="progress-fill" style="width:${pct}%;background:${pct >= 75 ? 'linear-gradient(90deg,var(--gr),#6ee7b7)' : pct >= 50 ? 'linear-gradient(90deg,var(--am),#fde68a)' : 'linear-gradient(90deg,var(--ro),#fda4af)'};"></div></div>
                  <span style="font-size:.78rem;font-weight:700;color:${pct >= 75 ? '#6ee7b7' : pct >= 50 ? '#fde68a' : '#fda4af'};">${pct}%</span>
                </div>
              </td>
              <td><span class="badge ${pct >= 75 ? 'badge-g' : pct >= 50 ? 'badge-a' : 'badge-r'}">${pct >= 75 ? 'Good' : pct >= 50 ? 'Average' : 'Low'}</span></td>
            </tr>`;
      }).join('')}
        </tbody>
      </table>
      </div>
    </div>
  `;
}

async function renderAdminCertificates() {
  var mc = document.getElementById('main-content');
  mc.innerHTML = '<div style="padding:24px;text-align:center;color:var(--muted);">Loading certificate data...</div>';

  var students = [];
  var batches = [];

  if (USE_SERVER) {
    try {
      try {
        const stuRes = await fetch(`${BACKEND_URL}/admin/students`, {
            credentials: 'include' // <--- ADD THIS LINE
        });
        if (stuRes.ok) students = await stuRes.json();
        else students = (ls('users') || []).filter(u => u.role === 'student');
      } catch (e) {
        students = (ls('users') || []).filter(u => u.role === 'student');
      }

      try {
        const batchRes = await fetch(`${BACKEND_URL}/admin/batches`, {
            credentials: 'include' // <--- ADD THIS LINE
        });
        if (batchRes.ok) batches = await batchRes.json();
        else batches = ls('batches') || [];
      } catch (e) {
        batches = ls('batches') || [];
      }
    } catch (error) {
      console.warn("Backend unavailable, falling back to LocalStorage.", error);
      students = (ls('users') || []).filter(u => u.role === 'student');
      batches = ls('batches') || [];
    }
  } else {
    students = (ls('users') || []).filter(u => u.role === 'student');
    batches = ls('batches') || [];
  }

  mc.innerHTML = `
    <div class="topbar"><div class="topbar-left"><div class="topbar-title">Certificate Management</div></div></div>
    <div class="grid-2">
      <div class="card anim-in">
        <div class="card-header"><div class="card-title">Generate Individual Certificate</div></div>
        <div class="form-group"><label class="form-label">Select Student</label>
          <select class="form-input" id="cert-student-select">
            <option value="">Choose student...</option>
            ${students.map(function (s) { return '<option value="' + s.id + '">' + s.name + ' (' + s.email + ')</option>'; }).join('')}
          </select>
        </div>
        <div class="form-group"><label class="form-label">Course Name</label><input class="form-input" id="cert-course" value="Business Analysis Capstone Course"></div>
        <div class="form-group"><label class="form-label">Issue Date</label><input type="date" class="form-input" id="cert-date" value="${new Date().toISOString().split('T')[0]}"></div>
        <button class="btn btn-v btn-full" onclick="generateCertificate()">🏆 Generate & Download Certificate</button>
      </div>
      <div class="card anim-in" style="animation-delay:.1s;">
        <div class="card-header"><div class="card-title">Bulk Certificate Generation</div></div>
        <div class="form-group"><label class="form-label">Select Batch</label>
          <select class="form-input" id="bulk-batch-select">
            <option value="">Choose batch...</option>
            ${batches.map(function (b) { return '<option value="' + b.id + '">' + b.name + '</option>'; }).join('')}
          </select>
        </div>
        <div class="form-group"><label class="form-label">Minimum Attendance %</label><input type="number" class="form-input" id="bulk-min-att" value="75" min="0" max="100"></div>
        <button class="btn btn-v btn-full" onclick="generateBulkCertificates()">🏆 Generate All Certificates</button>
        <p style="font-size:.72rem;color:var(--muted);margin-top:10px;">⚠ This will generate certificates for all eligible students in the batch based on attendance threshold.</p>
      </div>
    </div>
    <div class="card anim-in" style="margin-top:18px;animation-delay:.2s;">
      <div class="card-header"><div class="card-title">Certificate Preview</div></div>
      <div class="cert-preview" id="cert-preview-area" style="max-width:500px;margin:0 auto;">
        <div style="font-size:.65rem;letter-spacing:.12em;text-transform:uppercase;color:rgba(196,168,240,.6);margin-bottom:8px;">CERTIFICATE OF COMPLETION</div>
        <div style="font-size:.8rem;color:rgba(255,255,255,.6);margin-bottom:4px;">This is to certify that</div>
        <div class="cert-name" id="preview-name">Student Name</div>
        <div class="cert-course" id="preview-course">Business Analysis Capstone Course</div>
        <div style="font-size:.72rem;color:rgba(196,168,240,.6);margin-bottom:12px;">has successfully completed the course at TALeeO Learning</div>
        <div class="cert-badge">🏆 Certified Business Analyst</div>
        <div style="margin-top:14px;font-size:.65rem;color:rgba(255,255,255,.4);" id="preview-date">Issued: ${new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
      </div>
    </div>
  `;

  document.getElementById('cert-student-select').addEventListener('change', function () {
    var selectedId = this.value;
    var s = students.find(function (u) { return u.id === selectedId; });
    if (s) {
      document.getElementById('preview-name').textContent = s.name;
    } else {
      document.getElementById('preview-name').textContent = 'Student Name';
    }
  });
}

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

function getStudentBatch() {
  var batches = ls('batches') || [];
  return batches.find(function (b) { return b.students.includes(_currentUser.id); }) || null;
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

function renderStudentDashboard() {
  var batch = getStudentBatch();
  var attendance = ls('attendance') || {};
  var att = attendance[_currentUser.id] || {};
  var totalSessions = Math.max(Object.keys(att).length, 10);
  var presentDays = Object.values(att).filter(function (v) { return v === 'present'; }).length;
  var pct = Math.round(presentDays / totalSessions * 100) || 0;
  var docs = ls('documents') || [];
  var recs = ls('recordings') || [];
  var now = new Date();
  var batchExpired = batch && new Date(batch.end) < now;
  var mc = document.getElementById('main-content');
  
  mc.innerHTML = `
    <div class="topbar">
      <div class="topbar-left">
        <div style="width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,var(--v1),var(--b1));display:flex;align-items:center;justify-content:center;font-weight:700;font-size:1rem;color:white;">${_currentUser.name[0]}</div>
        <div><div class="topbar-title">Welcome, ${_currentUser.name.split(' ')[0]}! 👋</div><div class="topbar-sub">${batch ? batch.name : 'No batch assigned'}</div></div>
      </div>
      <div class="topbar-right">${batch ? '<span class="badge ' + (!batchExpired ? 'badge-g' : 'badge-r') + '">' + (!batchExpired ? 'Active' : 'Course Ended') + '</span>' : ''}</div>
    </div>

    ${batchExpired ? `<div style="background:rgba(244,63,94,.1);border:1px solid rgba(244,63,94,.25);border-radius:12px;padding:16px;margin-bottom:20px;font-size:.85rem;color:#fda4af;">⚠️ Your batch has ended on ${batch.end}. Course access is now read-only.</div>` : ''}

    <div class="grid-4" style="margin-bottom:20px;">
      <div class="stat-card anim-in"><div class="stat-num" style="background:linear-gradient(135deg,var(--v2),var(--v3));-webkit-background-clip:text;-webkit-text-fill-color:transparent;">${pct}%</div><div class="stat-lbl">Attendance</div></div>
      <div class="stat-card anim-in" style="animation-delay:.07s"><div class="stat-num" style="background:linear-gradient(135deg,var(--b1),var(--b2));-webkit-background-clip:text;-webkit-text-fill-color:transparent;">${presentDays}</div><div class="stat-lbl">Classes Attended</div></div>
      <div class="stat-card anim-in" style="animation-delay:.14s"><div class="stat-num" style="background:linear-gradient(135deg,var(--c1),var(--c2));-webkit-background-clip:text;-webkit-text-fill-color:transparent;">${recs.filter(function (r) { return r.batch === (_currentUser.batchId) || r.batch === 'all'; }).length}</div><div class="stat-lbl">Recordings</div></div>
      <div class="stat-card anim-in" style="animation-delay:.21s"><div class="stat-num" style="background:linear-gradient(135deg,var(--am),#fde68a);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">${docs.filter(function (d) { return d.batch === 'all' || d.batch === (_currentUser.batchId || ''); }).length}</div><div class="stat-lbl">Documents</div></div>
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

    <div class="grid-2">
      <div class="card anim-in">
        <div class="card-header"><div class="card-title">Course Progress</div></div>
        ${MODULES.map(function (m, i) {
        return `<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--border);">
            <div style="display:flex;align-items:center;gap:10px;">
              <div style="width:30px;height:30px;border-radius:8px;background:rgba(124,58,237,.15);display:flex;align-items:center;justify-content:center;font-size:.72rem;font-weight:700;color:var(--v2);">0${m.id}</div>
              <div style="font-size:.82rem;font-weight:600;color:white;">${m.title}</div>
            </div>
            <span class="badge ${i < 2 ? 'badge-g' : i < 4 ? 'badge-a' : 'badge-r'}">${i < 2 ? 'Complete' : i < 4 ? 'In Progress' : 'Upcoming'}</span>
          </div>`;
      }).join('')}
      </div>
      <div class="card anim-in" style="animation-delay:.1s;">
        <div class="card-header"><div class="card-title">Recent Recordings</div><a onclick="navTo('student-recordings',null)" style="font-size:.75rem;color:var(--v2);cursor:pointer;">View All →</a></div>
        ${recs.slice(0, 4).map(function (r) {
        return `<div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--border);">
            <div style="width:34px;height:34px;border-radius:8px;background:rgba(239,68,68,.12);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:1rem;">▶</div>
            <div style="flex:1;"><div style="font-size:.8rem;font-weight:600;color:white;margin-bottom:2px;">${r.title}</div><div style="font-size:.68rem;color:var(--muted);">${r.date} · ${r.duration}</div></div>
            <a href="${r.url}" target="_blank" class="btn btn-out btn-sm">Watch</a>
          </div>`;
      }).join('')}
      </div>
    </div>
  `;
}

function renderStudentCourse() {
  var mc = document.getElementById('main-content');
  mc.innerHTML = `
    <div class="topbar"><div class="topbar-left"><div class="topbar-title">Course Content</div></div></div>
    <div style="margin-bottom:16px;"><div style="font-size:.8rem;color:var(--muted);">Business Analysis Capstone Course · 6 Modules · 30 Days</div></div>
    <div class="grid-3">
      ${MODULES.map(function (m, i) {
        var colorMap = { v: 'linear-gradient(90deg,var(--v1),var(--v2))', b: 'linear-gradient(90deg,var(--b1),var(--b2))', c: 'linear-gradient(90deg,var(--c1),var(--c2))', a: 'linear-gradient(90deg,var(--am),#fde68a)', g: 'linear-gradient(90deg,var(--gr),#6ee7b7)', r: 'linear-gradient(90deg,var(--ro),#fda4af)' };
        return `<div class="module-card anim-in" style="animation-delay:${i * 0.07}s;">
          <div class="mc-top">
            <div class="mc-num">Module 0${m.id}</div>
            <div class="mc-title">${m.title}</div>
            <div style="height:2px;background:${colorMap[m.color]};border-radius:2px;margin-top:8px;"></div>
          </div>
          <div style="padding:14px 18px;">
            <ul style="list-style:none;display:flex;flex-direction:column;gap:6px;">
              ${m.topics.map(function (t) { return '<li style="font-size:.76rem;color:var(--muted);display:flex;align-items:flex-start;gap:6px;"><span style="color:var(--v2);font-size:.8rem;flex-shrink:0;">›</span>' + t + '</li>'; }).join('')}
            </ul>
          </div>
          <div class="mc-bottom">
            <span class="mc-topics">${m.topics.length} topics</span>
            <span class="badge ${i < 2 ? 'badge-g' : i < 4 ? 'badge-a' : 'badge-r'}">${i < 2 ? 'Complete' : i < 4 ? 'In Progress' : 'Upcoming'}</span>
          </div>
        </div>`;
      }).join('')}
    </div>
  `;
}

function renderStudentRecordings() {
  var recs = ls('recordings') || [];
  var batch = getStudentBatch();
  var myRecs = recs.filter(function (r) { return r.batch === 'all' || (batch && r.batch === batch.id); });
  var mc = document.getElementById('main-content');
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
                <div class="dc-day">${r.date}</div>
                <div class="dc-title">${r.title}</div>
                <div class="dc-meta">
                  <span class="badge badge-b">⏱ ${r.duration}</span>
                  <span style="font-size:.72rem;color:var(--muted);">${r.topics}</span>
                </div>
              </div>
            </div>
            <a href="${r.url}" target="_blank" class="btn btn-v btn-sm">▶ Watch Recording</a>
          </div>
        </div>`;
      }).join('')}
    </div>
  `;
}

function renderStudentDocuments() {
  var docs = ls('documents') || [];
  var mc = document.getElementById('main-content');
  mc.innerHTML = `
    <div class="topbar"><div class="topbar-left"><div class="topbar-title">Notes & Documents</div></div></div>
    <div class="tabs" style="margin-bottom:20px;">
      <div class="tab active" onclick="filterDocs('all',this)">All</div>
      ${['Module 01', 'Module 02', 'Module 03', 'Module 04', 'Module 05', 'Module 06'].map(function (m) { return '<div class="tab" onclick="filterDocs(\'' + m + '\',this)">' + m.split(' ').slice(0, 2).join(' ') + '</div>'; }).join('')}
    </div>
    <div class="grid-auto" id="docs-grid">
      ${docs.map(function (d) {
        var icons = { pdf: '📄', template: '📋', assignment: '📝', reference: '📖', recording: '🎥' };
        var colors = { pdf: 'badge-v', template: 'badge-b', assignment: 'badge-a', reference: 'badge-c', recording: 'badge-g' };
        return `<div class="card anim-in" data-module="${d.module}">
          <div style="font-size:2rem;margin-bottom:10px;">${icons[d.type] || '📄'}</div>
          <div style="font-size:.88rem;font-weight:700;color:white;margin-bottom:5px;">${d.title}</div>
          <div style="font-size:.72rem;color:var(--muted);margin-bottom:8px;">${d.module}</div>
          <span class="badge ${colors[d.type] || 'badge-v'}" style="margin-bottom:10px;">${d.type}</span>
          <br>
          <a href="${d.url}" target="_blank" class="btn btn-v btn-sm" style="margin-top:10px;">Open ↗</a>
        </div>`;
      }).join('')}
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

/* ═══════════════════════════════════════════════════════
   ACTION FUNCTIONS
═══════════════════════════════════════════════════════ */
function openModal(id) {
  // populate selects in modals
  var batches = ls('batches') || [];
  ['new-student-batch', 'doc-batch', 'rec-batch', 'bulk-batch-select'].forEach(function (sid) {
    var el = document.getElementById(sid);
    if (el) {
      var opts = sid === 'doc-batch' || sid === 'rec-batch' ? '<option value="all">All Batches</option>' : '<option value="">Select batch</option>';
      opts += batches.map(function (b) { return '<option value="' + b.id + '">' + b.name + '</option>'; }).join('');
      el.innerHTML = opts;
    }
  });
  document.getElementById(id).classList.add('open');
}
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

function openInviteForBatch(batchId) {
  openModal('modal-add-student');
  setTimeout(function () {
    var el = document.getElementById('new-student-batch');
    if (el) el.value = batchId;
  }, 50);
}
function renderBatchCard(b) {
    const isAdmin = _currentUser.role === 'admin';
    return `
    <div class="card anim-in">
        <div class="card-header">
            <div class="card-title">${b.name}</div>
            ${isAdmin ? `
                <div style="display:flex; gap:5px;">
                    <button class="btn btn-out btn-sm" onclick="openBatchModal('${b.id}')">Edit</button>
                    <button class="btn btn-danger btn-sm" onclick="deactivateBatch('${b.id}')">${b.active ? 'Deactivate' : 'Activate'}</button>
                </div>
            ` : ''}
        </div>
        <div class="card-sub">${b.timing} | ${b.type}</div>
        <div class="zoom-card">
            <div style="font-size:0.7rem; color:var(--muted);">Zoom ID: ${b.zoomDetails?.id || 'N/A'}</div>
            <a href="${b.zoomDetails?.link || '#'}" target="_blank" style="color:var(--v2);">Join Class →</a>
        </div>
    </div>`;
}

async function inviteStudent() {
  const name = document.getElementById('new-student-name').value.trim();
  const email = document.getElementById('new-student-email').value.trim();
  const phone = document.getElementById('new-student-phone').value.trim().replace(/\D/g, '');
  const batchId = document.getElementById('new-student-batch').value;

  if (!name || !email) { 
    showToast('Please enter name and email.', '❌'); 
    return; 
  }

  // Define student payload
  const studentPayload = {
    name: name,
    email: email.toLowerCase(),
    password: 'admin123', // Default password as requested
    role: 'student',
    phone: phone || '',
    firstLogin: false,
    avatar: name[0].toUpperCase(),
    batchId: batchId || null
  };

  if (USE_SERVER) {
    try {
      // 1. Create student in backend
      const response = await fetch(`${BACKEND_URL}/admin/students`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', 
        body: JSON.stringify(studentPayload)
      });

      if (response.status === 409) {
        showToast('Student already exists!', '⚠️');
        return;
      }
      if (!response.ok) throw new Error('Server failed to invite student');
const currentHost = window.location.hostname;

// Your updated message
// const message = ;

      // 2. Trigger EmailJS after successful DB creation
      const emailParams = {
        lib_version: "3.10.0",
        user_id: "V3Y_MKWFWmMy-rl-t",
        service_id: "service_v1t534c",
        template_id: "template_6ige124",
        template_params: {
          title: "Welcome to TALeeO LMS",
          name: name,
          intro: "Your account has been successfully created.",
          phone: phone || "N/A",
          email: email,
          message: `Log in using your email (admin@${currentHost}) and the default password: admin123 +<br> batch id${batchId}`,
          time: new Date().toLocaleString()
        }
      };

      await fetch('https://api.emailjs.com/api/v1.0/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(emailParams)
      });

      showToast(`✅ Invitation & Credentials sent to ${email}`, '📧');
    } catch (error) {
      console.warn("Server error, falling back to LocalStorage.", error);
      handleStudentLocalSave(studentPayload, batchId);
    }
  } else {
    handleStudentLocalSave(studentPayload, batchId);
  }

  // Cleanup UI
  closeModal('modal-add-student');
  ['new-student-name', 'new-student-email', 'new-student-phone'].forEach(f => {
    document.getElementById(f).value = '';
  });
  renderAdminStudents();
}

function handleStudentLocalSave(payload, batchId) {
  var users = ls('users') || [];
  if (users.find(function (u) { return u.email === payload.email; })) {
    showToast('Student with this email already exists!', '⚠️');
    return;
  }

  var id = 's' + Date.now();
  users.push({ id: id, ...payload });
  ls('users', users);

  if (batchId) {
    var batches = ls('batches') || [];
    var bi = batches.findIndex(function (b) { return b.id === batchId; });
    if (bi >= 0 && !batches[bi].students.includes(id)) {
      batches[bi].students.push(id);
      ls('batches', batches);
    }r
  }
  showToast('✅ ' + payload.name + ' invited locally (Server Offline).', '⚠️');
}

async function createBatch() {
  var name = document.getElementById('new-batch-name').value.trim();
  var type = document.getElementById('new-batch-type').value;
  var start = document.getElementById('new-batch-start').value;
  var end = document.getElementById('new-batch-end').value;
  var timing = document.getElementById('new-batch-timing').value.trim() || 'TBD';
  var zoom = document.getElementById('new-batch-zoom').value.trim() || '#';
  var zoomId = document.getElementById('new-batch-zoom-id').value.trim() || 'TBD';
  var zoomPass = document.getElementById('new-batch-zoom-pass').value.trim() || 'TBD';

  if (!name || !start || !end) {
    showToast('Please fill name, start and end dates.', '❌');
    return;
  }

  var batchPayload = {
    name: name,
    type: type,
    start: start,
    end: end,
    timing: timing,
    zoomLink: zoom,
    zoomId: zoomId,
    zoomPass: zoomPass
  };

  if (USE_SERVER) {
    try {
      const response = await fetch(`${BACKEND_URL}/admin/batches`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // <--- ADD THIS LINE
        body: JSON.stringify(batchPayload)
      });

      if (!response.ok) throw new Error('Server failed to create batch');
      showToast('Batch "' + name + '" created successfully!', '✅');

    } catch (error) {
      console.warn("Backend unavailable, saving to LocalStorage.", error);
      var batches = ls('batches') || [];
      batches.push({ id: 'b' + Date.now(), ...batchPayload, active: true, students: [] });
      ls('batches', batches);
      showToast('Batch created locally (Server Offline).', '⚠️');
    }
  } else {
    var batches = ls('batches') || [];
    batches.push({ id: 'b' + Date.now(), ...batchPayload, active: true, students: [] });
    ls('batches', batches);
    showToast('Batch "' + name + '" created!', '✅');
  }

  closeModal('modal-add-batch');
  ['new-batch-name', 'new-batch-start', 'new-batch-end', 'new-batch-timing', 'new-batch-zoom', 'new-batch-zoom-id', 'new-batch-zoom-pass'].forEach(function (f) {
    document.getElementById(f).value = '';
  });
  renderAdminBatches();
}

function toggleBatch(id) {
  var batches = ls('batches') || [];
  var i = batches.findIndex(function (b) { return b.id === id; });
  if (i >= 0) { batches[i].active = !batches[i].active; ls('batches', batches); }
  renderAdminBatches();
  showToast('Batch status updated.', '✅');
}

async function uploadDocument() {
  var title = document.getElementById('doc-title').value.trim();
  var module = document.getElementById('doc-module').value;
  var batch = document.getElementById('doc-batch').value;
  var url = document.getElementById('doc-url').value.trim() || '#';
  var type = document.getElementById('doc-type').value;

  if (!title) { showToast('Please enter a document title.', '❌'); return; }

  var docPayload = {
    title: title,
    module: module,
    batch: batch,
    url: url,
    type: type,
    uploadedAt: new Date().toISOString().split('T')[0]
  };

  if (USE_SERVER) {
    try {
      const response = await fetch(`${BACKEND_URL}/admin/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include' ,// <--- ADD THIS LINE
        body: JSON.stringify(docPayload)
      });
      if (!response.ok) throw new Error('Server failed to upload document');
      showToast('Document "' + title + '" uploaded!', '✅');
    } catch (error) {
      console.warn("Backend unavailable, saving to LocalStorage.", error);
      var docs = ls('documents') || [];
      docs.push({ id: 'd' + Date.now(), ...docPayload });
      ls('documents', docs);
      showToast('Document saved locally (Server Offline).', '⚠️');
    }
  } else {
    var docs = ls('documents') || [];
    docs.push({ id: 'd' + Date.now(), ...docPayload });
    ls('documents', docs);
    showToast('Document "' + title + '" uploaded!', '✅');
  }

  closeModal('modal-upload-doc');
  document.getElementById('doc-title').value = '';
  document.getElementById('doc-url').value = '';
  renderAdminDocuments();
}

function deleteDoc(id) {
  if (!confirm('Delete this document?')) return;
  var docs = (ls('documents') || []).filter(function (d) { return d.id !== id; });
  ls('documents', docs); renderAdminDocuments();
  showToast('Document deleted.', '🗑️');
}

async function addRecording() {
  var title = document.getElementById('rec-title').value.trim();
  var date = document.getElementById('rec-date').value;
  var dur = document.getElementById('rec-duration').value.trim() || '—';
  var url = document.getElementById('rec-url').value.trim() || '#';
  var batch = document.getElementById('rec-batch').value;
  var topics = document.getElementById('rec-topics').value.trim() || '—';

  if (!title || !date) { showToast('Please enter title and date.', '❌'); return; }

  var recPayload = {
    title: title,
    date: date,
    duration: dur,
    url: url,
    batch: batch,
    topics: topics
  };

  if (USE_SERVER) {
    try {
      const response = await fetch(`${BACKEND_URL}/admin/recordings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include' ,// <--- ADD THIS LINE
        body: JSON.stringify(recPayload)
      });
      if (!response.ok) throw new Error('Server failed to add recording');
      showToast('Recording added!', '✅');
    } catch (error) {
      console.warn("Backend unavailable, saving to LocalStorage.", error);
      var recs = ls('recordings') || [];
      recs.push({ id: 'r' + Date.now(), ...recPayload });
      ls('recordings', recs);
      showToast('Recording added locally (Server Offline).', '⚠️');
    }
  } else {
    var recs = ls('recordings') || [];
    recs.push({ id: 'r' + Date.now(), ...recPayload });
    ls('recordings', recs);
    showToast('Recording added!', '✅');
  }

  closeModal('modal-add-recording');
  ['rec-title', 'rec-date', 'rec-duration', 'rec-url', 'rec-topics'].forEach(function (f) { document.getElementById(f).value = ''; });
  renderAdminRecordings();
}

function deleteRec(id) {
  if (!confirm('Delete this recording?')) return;
  var recs = (ls('recordings') || []).filter(function (r) { return r.id !== id; });
  ls('recordings', recs); renderAdminRecordings();
  showToast('Recording deleted.', '🗑️');
}

function removeStudent(id) {
  if (!confirm('Remove this student from the LMS?')) return;
  var users = (ls('users') || []).filter(function (u) { return u.id !== id; });
  var batches = ls('batches') || [];
  batches.forEach(function (b) { b.students = b.students.filter(function (s) { return s !== id; }); });
  ls('users', users); ls('batches', batches);
  renderAdminStudents(); showToast('Student removed.', '🗑️');
}

function openAttendanceModal() {
  var users = ls('users') || [];
  var students = users.filter(function (u) { return u.role === 'student'; });
  var today = new Date().toISOString().split('T')[0];
  document.getElementById('att-session-name').textContent = today;
  var list = document.getElementById('att-list');
  list.innerHTML = students.map(function (s) {
    return `<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:var(--panel);border-radius:9px;">
      <div style="display:flex;align-items:center;gap:10px;">
        <div style="width:30px;height:30px;border-radius:50%;background:linear-gradient(135deg,var(--v1),var(--b1));display:flex;align-items:center;justify-content:center;font-weight:700;font-size:.8rem;color:white;">${s.name[0]}</div>
        <div><div style="font-size:.83rem;font-weight:600;color:white;">${s.name}</div><div style="font-size:.68rem;color:var(--muted);">${s.email}</div></div>
      </div>
      <div style="display:flex;gap:8px;">
        <label style="cursor:pointer;display:flex;align-items:center;gap:5px;font-size:.78rem;color:#6ee7b7;"><input type="radio" name="att_${s.id}" value="present" checked> Present</label>
        <label style="cursor:pointer;display:flex;align-items:center;gap:5px;font-size:.78rem;color:#fda4af;"><input type="radio" name="att_${s.id}" value="absent"> Absent</label>
      </div>
    </div>`;
  }).join('');
  if (students.length === 0) list.innerHTML = '<p style="color:var(--muted);font-size:.82rem;text-align:center;">No students enrolled yet.</p>';
  openModal('modal-attendance');
}

function saveAttendance() {
  var users = ls('users') || [];
  var students = users.filter(function (u) { return u.role === 'student'; });
  var today = new Date().toISOString().split('T')[0];
  var attendance = ls('attendance') || {};
  students.forEach(function (s) {
    var radio = document.querySelector('input[name="att_' + s.id + '"]:checked');
    if (radio) {
      if (!attendance[s.id]) attendance[s.id] = {};
      attendance[s.id][today] = radio.value;
    }
  });
  ls('attendance', attendance);
  closeModal('modal-attendance');
  showToast('Attendance saved for ' + today + '!', '✅');
  renderAdminAttendance();
}

// ── CERTIFICATES ──
async function generateCertificate(name, course, dateStr) {
  var studentName = name;
  if (!studentName) {
    var selectEl = document.getElementById('cert-student-select');
    if (!selectEl || !selectEl.value) { showToast('Please select a student.', '❌'); return; }
    studentName = selectEl.options[selectEl.selectedIndex].text.split(' (')[0];
  }

  var courseName = course || document.getElementById('cert-course').value || 'Business Analysis Capstone Course';
  var issueDate = dateStr || (document.getElementById('cert-date') ? document.getElementById('cert-date').value : new Date().toISOString().split('T')[0]);

  var formattedDate = new Date(issueDate).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' });

  var previewArea = document.getElementById('cert-preview-area');
  if (!previewArea) { showToast('Certificate preview area not found.', '❌'); return; }

  document.getElementById('preview-name').textContent = studentName;
  document.getElementById('preview-course').textContent = courseName;
  document.getElementById('preview-date').textContent = 'Issued: ' + formattedDate;

  try {
    const canvas = await html2canvas(previewArea, {
      scale: 2,
      backgroundColor: '#1a0a2e',
      useCORS: true
    });

    var a = document.createElement('a');
    a.download = 'TALeeO-Certificate-' + studentName.replace(/\s/g, '_') + '.png';
    a.href = canvas.toDataURL('image/png');
    a.click();

    showToast('Certificate generated for ' + studentName + '!', '🏆');
  } catch (err) {
    console.error("Error generating certificate image:", err);
    showToast('Error generating certificate.', '❌');
  }
}

function roundRect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }

function generateBulkCertificates() {
  var batchId = document.getElementById('bulk-batch-select').value;
  var minAtt = parseInt(document.getElementById('bulk-min-att').value) || 75;
  if (!batchId) { showToast('Please select a batch.', '❌'); return; }
  var batches = ls('batches') || [];
  var batch = batches.find(function (b) { return b.id === batchId; });
  if (!batch) { showToast('Batch not found.', '❌'); return; }
  var users = ls('users') || [];
  var attendance = ls('attendance') || {};
  var students = users.filter(function (u) { return batch.students.includes(u.id); });
  var count = 0;
  students.forEach(function (s) {
    var att = attendance[s.id] || {};
    var totalSessions = Math.max(Object.keys(att).length, 10);
    var presentDays = Object.values(att).filter(function (v) { return v === 'present'; }).length;
    var pct = Math.round(presentDays / totalSessions * 100) || 0;
    if (pct >= minAtt) {
      setTimeout(function () { generateCertificate(s.name, 'Business Analysis Capstone Course', new Date().toISOString().split('T')[0]); }, count * 800);
      count++;
    }
  });
  showToast('Generating ' + count + ' certificates...', '🏆');
}

function downloadMyCertificate() {
  generateCertificate(_currentUser.name, 'Business Analysis Capstone Course', new Date().toISOString().split('T')[0]);
}
// Updated Course List (The Grid)
function renderStudentCourse() {
  var mc = document.getElementById('main-content');
  mc.innerHTML = `
    <div class="topbar">
        <div class="topbar-left"><div class="topbar-title">Course Curriculum</div></div>
    </div>
    <div style="margin-bottom:24px;">
        <div style="font-size:.85rem;color:var(--muted);">Select a module to view deep-dive syllabus and learning outcomes.</div>
    </div>
    <div class="grid-3">
      ${MODULES.map(function (m, i) {
        return `
        <div class="module-card anim-in" style="animation-delay:${i * 0.05}s" onclick="renderModuleDetail(${m.id})">
          <div class="mc-top">
            <div class="mc-num">Module 0${m.id}</div>
            <div class="mc-title">${m.title}</div>
          </div>
          <div class="mc-bottom">
            <span class="mc-topics">${m.topics.length} Key Topics</span>
            <span style="color:var(--v2); font-size:0.7rem; font-weight:600;">View Details →</span>
          </div>
        </div>`;
      }).join('')}
    </div>
  `;
}

function renderModuleDetail(moduleId) {
    const m = MODULES.find(mod => mod.id === parseInt(moduleId));
    if(!m) return renderAdminCurriculum();

    saveNavState('module-detail', moduleId);
    const backNavId = _currentUser.role === 'admin' ? 'admin-curriculum' : 'student-course';
    var mc = document.getElementById('main-content');
    
    mc.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
            <button class="btn btn-back btn-sm" onclick="navTo('${backNavId}', null)">← Back to Curriculum</button>
            ${_currentUser.role === 'admin' ? `<button class="btn btn-out btn-sm" onclick="openEditModuleModal(${m.id})">⚙️ Edit Content</button>` : ''}
        </div>
        
        <div class="card anim-in" style="background: linear-gradient(135deg, rgba(124, 58, 237, 0.05), transparent);">
            <div class="mc-num">Detailed Syllabus</div>
            <h2 style="font-family:'Poppins'; margin-bottom:10px;">Module 0${m.id}: ${m.title}</h2>
        </div>

        <div class="syllabus-container anim-in">
            ${m.topics.map((topic, idx) => `
                <div class="syllabus-item anim-in" style="animation-delay: ${idx * 0.05}s;">
                    <div class="syllabus-header">
                        <span class="syllabus-index">Topic 0${idx + 1}</span>
                    </div>
                    <div style="font-weight: 600; color: white; font-size: 0.95rem;">${topic}</div>
                </div>
            `).join('')}
        </div>
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


// ── TOAST ──
function showToast(msg, icon) {
  var t = document.getElementById('toast');
  document.getElementById('toast-msg').textContent = msg;
  t.querySelector('.toast-icon').textContent = (icon || '✅') + ' ';
  t.classList.add('show');
  setTimeout(function () { t.classList.remove('show'); }, 3500);
}


// ── INIT ──
initTabSession(); // Initialize unique tab tracking
initData();
checkSession();