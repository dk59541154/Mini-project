/**
 * CivicEye AI - Core Frontend Utilities & State Management
 * static/js/app.js
 */

/**
 * CivicEye AI - Core Frontend Utilities & State Management
 * static/js/app.js
 */

const CivicEye = {
  // Global authenticated user and role state
  currentUser: null,

  init() {
    this.checkAuthStatus();
    this.setupMobileNav();
    this.updateActiveNavLink();
  },

  getRole() {
    return this.currentUser?.role || "Viewer";
  },

  getPermissions() {
    if (this.currentUser?.permissions) {
      return this.currentUser.permissions;
    }
    // Default fallback permissions (Viewer)
    return {
      role: "Viewer",
      title: "Public & Agency Observer",
      can_view: true,
      can_report: true,
      can_update_status: false,
      allowed_statuses: [],
      can_update_severity: false,
      allowed_severities: [],
      can_verify: false,
      can_manage_demo: false
    };
  },

  canUpdateStatus(status) {
    const perm = this.getPermissions();
    if (!perm.can_update_status) return false;
    if (status) {
      return perm.allowed_statuses.includes(status);
    }
    return true;
  },

  canUpdateSeverity() {
    return !!this.getPermissions().can_update_severity;
  },

  canVerify() {
    return !!this.getPermissions().can_verify;
  },

  canManageDemo() {
    return !!this.getPermissions().can_manage_demo;
  },

  authHeaders() {
    const headers = { "Content-Type": "application/json" };
    if (this.currentUser) {
      headers["x-user-role"] = this.currentUser.role;
      headers["x-user-email"] = this.currentUser.email;
    }
    return headers;
  },

  async checkAuthStatus() {
    try {
      // 1. Check local storage cache
      const cached = localStorage.getItem("civiceye_user");
      if (cached) {
        try {
          this.currentUser = JSON.parse(cached);
        } catch (e) {}
      }

      // 2. Fetch live status from server
      const headers = this.currentUser ? { "x-user-email": this.currentUser.email } : {};
      const res = await fetch("/api/auth/status", { headers });
      if (res.ok) {
        const data = await res.json();
        if (data.authenticated && data.user) {
          this.currentUser = data.user;
          localStorage.setItem("civiceye_user", JSON.stringify(this.currentUser));
        }
      }
    } catch (e) {
      console.warn("Auth check note:", e);
    }
    this.renderHeaderUI();
  },

  renderHeaderUI() {
    const adminContainer = document.getElementById("admin-nav-slot");
    if (!adminContainer) return;

    if (this.currentUser) {
      const role = this.currentUser.role;
      let badgeClass = "badge-low";
      let roleIcon = "👁️";
      if (role === "Administrator") {
        badgeClass = "badge-critical";
        roleIcon = "👑";
      } else if (role === "Technician") {
        badgeClass = "badge-verified";
        roleIcon = "🔧";
      }

      adminContainer.innerHTML = `
        <div class="admin-session-pill" style="display:flex; align-items:center; gap:0.4rem; padding:0.35rem 0.75rem;">
          <span style="font-size:0.9rem;" title="${this.currentUser.permissions?.title || role}">${roleIcon}</span>
          <span style="font-weight:700; font-size:0.8rem; color:var(--text-main);">${role}</span>
          <div style="position:relative; display:inline-block;" class="role-menu-wrapper">
            <button onclick="CivicEye.toggleRoleMenu(event)" class="btn btn-sm btn-outline" style="padding:0.15rem 0.4rem; font-size:0.75rem; margin-left:0.25rem;" title="Switch Role">
              Switch ▾
            </button>
            <div id="role-quick-dropdown" style="display:none; position:absolute; right:0; top:125%; background:white; border:1px solid var(--border-medium); border-radius:var(--radius-md); box-shadow:0 10px 25px rgba(0,0,0,0.15); width:230px; z-index:9999; padding:0.5rem; text-align:left;">
              <div style="font-size:0.7rem; font-weight:700; color:var(--text-muted); text-transform:uppercase; padding:0.25rem 0.5rem;">Switch Demo Persona</div>
              <button onclick="CivicEye.quickSwitchRole('admin@civiceye.gov', 'admin123')" class="btn btn-sm" style="width:100%; text-align:left; justify-content:flex-start; margin-bottom:0.25rem; font-size:0.78rem; background:${role === 'Administrator' ? '#eff6ff' : 'transparent'}; border:none;">
                👑 <strong>Administrator</strong> (Full Access)
              </button>
              <button onclick="CivicEye.quickSwitchRole('tech@civiceye.gov', 'tech123')" class="btn btn-sm" style="width:100%; text-align:left; justify-content:flex-start; margin-bottom:0.25rem; font-size:0.78rem; background:${role === 'Technician' ? '#f0fdf4' : 'transparent'}; border:none;">
                🔧 <strong>Technician</strong> (In Progress/Resolved)
              </button>
              <button onclick="CivicEye.quickSwitchRole('viewer@civiceye.gov', 'viewer123')" class="btn btn-sm" style="width:100%; text-align:left; justify-content:flex-start; margin-bottom:0.25rem; font-size:0.78rem; background:${role === 'Viewer' ? '#f8fafc' : 'transparent'}; border:none;">
                👁️ <strong>Viewer</strong> (Read-Only)
              </button>
              <hr style="margin:0.4rem 0; border:0; border-top:1px solid var(--border-light);">
              <button onclick="CivicEye.logout()" class="btn btn-sm" style="width:100%; text-align:left; justify-content:flex-start; color:#b91c1c; font-size:0.78rem; background:transparent; border:none;">
                Sign Out
              </button>
            </div>
          </div>
        </div>
      `;
    } else {
      adminContainer.innerHTML = `
        <a href="/login" class="nav-link" id="nav-login">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3"/></svg>
          Sign In
        </a>
      `;
    }
  },

  toggleRoleMenu(e) {
    e.stopPropagation();
    const dropdown = document.getElementById("role-quick-dropdown");
    if (dropdown) {
      dropdown.style.display = dropdown.style.display === "block" ? "none" : "block";
    }
  },

  async quickSwitchRole(email, password) {
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        this.currentUser = data.user;
        localStorage.setItem("civiceye_user", JSON.stringify(data.user));
        this.showToast(`Switched role to: ${data.user.role}`);
        setTimeout(() => window.location.reload(), 400);
      } else {
        this.showToast(data.error || "Failed to switch role", "error");
      }
    } catch (e) {
      this.showToast("Network error switching role", "error");
    }
  },

  async logout() {
    try {
      await fetch("/api/logout", { method: "POST" });
    } catch (e) {}
    localStorage.removeItem("civiceye_user");
    localStorage.removeItem("civiceye_admin");
    this.currentUser = null;
    this.showToast("Signed out successfully");
    setTimeout(() => {
      window.location.reload();
    }, 400);
  },

  setupMobileNav() {
    const toggle = document.querySelector(".mobile-toggle");
    const nav = document.querySelector(".main-nav");
    if (toggle && nav) {
      toggle.addEventListener("click", () => {
        nav.classList.toggle("open");
      });
    }

    // Close role quick menu on outside click
    document.addEventListener("click", () => {
      const dropdown = document.getElementById("role-quick-dropdown");
      if (dropdown) dropdown.style.display = "none";
    });
  },

  updateActiveNavLink() {
    const path = window.location.pathname;
    document.querySelectorAll(".nav-link").forEach(link => {
      const href = link.getAttribute("href");
      if (href === path || (path === "/" && href === "/") || (path.startsWith(href) && href !== "/")) {
        link.classList.add("active");
      } else {
        link.classList.remove("active");
      }
    });
  },

  showToast(message, type = "info") {
    let container = document.getElementById("toast-container");
    if (!container) {
      container = document.createElement("div");
      container.id = "toast-container";
      container.className = "toast-container";
      document.body.appendChild(container);
    }

    const toast = document.createElement("div");
    toast.className = "toast";
    if (type === "error") {
      toast.style.borderColor = "#f87171";
      toast.style.background = "#fef2f2";
      toast.style.color = "#991b1b";
    }
    toast.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="16" x2="12" y2="12"></line>
        <line x1="12" y1="8" x2="12.01" y2="8"></line>
      </svg>
      <span>${message}</span>
    `;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateY(10px)";
      toast.style.transition = "all 0.3s ease";
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  },

  formatDate(dateStr) {
    if (!dateStr) return "N/A";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  },

  getSeverityBadge(sev) {
    const s = (sev || "Medium").toLowerCase();
    return `<span class="badge badge-${s}">${sev || "Medium"}</span>`;
  },

  getStatusBadge(st) {
    const slug = (st || "Reported").toLowerCase().replace(/\s+/g, "-");
    return `<span class="badge badge-${slug}">${st || "Reported"}</span>`;
  }
};

document.addEventListener("DOMContentLoaded", () => {
  CivicEye.init();
});
