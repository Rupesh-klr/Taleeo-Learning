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
   SHELL BUILDER (Dynamic RBAC UI)
═══════════════════════════════════════════════════════ */
function buildShell() {
  var u = _currentUser;
  
  // 1. Setup User Profile UI
  byId('sb-name').textContent = u.name;
  // Capitalize the first letter of their role for the display
  byId('sb-role').textContent = u.role.charAt(0).toUpperCase() + u.role.slice(1);
  
  var isAdminType = isAdminRole(u.role);
  byId('sb-role-badge').textContent = isAdminType ? 'Staff Panel' : 'Student Portal';
  
  byId('sb-avatar').textContent = u.name[0].toUpperCase();
  byId('sb-avatar').style.background = isAdminType 
    ? 'linear-gradient(135deg,#f59e0b,#ef4444)' 
    : 'linear-gradient(135deg,var(--v1),var(--b1))';

  // 2. Fetch Allowed Modules based on Backend Role
  var userRole = u.role || 'student';
  var allowedModules = FRONTEND_MODULES[userRole] || FRONTEND_MODULES['student']; // Fallback to student

  // 3. Dynamically Generate Sidebar HTML
  var nav = byId('sidebar-nav');
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

    if (isMobileView()) {
      closeMobileSidebar();
    }

    if (isAdminRole(_currentUser.role)) renderAdminPage(page);
    else renderStudentPage(page);
}
