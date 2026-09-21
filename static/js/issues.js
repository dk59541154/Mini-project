/**
 * CivicEye AI - Issues Management Controller
 * static/js/issues.js
 * Search, filter, view details modal, and role-based actions (Viewer, Technician, Administrator).
 */

let allIssues = [];
let activeViewingIssue = null;

function updateRoleBannerUI() {
  const role = CivicEye.getRole();
  const iconEl = document.getElementById("role-banner-icon");
  const titleEl = document.getElementById("role-banner-title");
  const descEl = document.getElementById("role-banner-desc");
  const demoControls = document.getElementById("admin-demo-controls");

  if (demoControls) {
    demoControls.style.display = (role === "Administrator") ? "inline-flex" : "none";
  }

  if (!iconEl || !titleEl || !descEl) return;

  if (role === "Administrator") {
    iconEl.textContent = "👑";
    titleEl.textContent = "Current Role: Administrator (Chief Municipal Auditor)";
    descEl.textContent = "Full administrative authorization: verify defects, reclassify severity, and dispatch all life-cycle statuses.";
  } else if (role === "Technician") {
    iconEl.textContent = "🔧";
    titleEl.textContent = "Current Role: Technician (Field Repair Specialist)";
    descEl.textContent = "Operational field access: can update repair status to 'In Progress' and mark completed works as 'Resolved'.";
  } else {
    iconEl.textContent = "👁️";
    titleEl.textContent = "Current Role: Viewer (Observer)";
    descEl.textContent = "Read-only access to infrastructure records and health metrics. Switch role to test field actions.";
  }
}

async function loadIssues() {
  updateRoleBannerUI();
  const tbody = document.getElementById("issues-tbody");
  if (tbody) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 2rem;">Loading civic records...</td></tr>`;
  }

  const search = document.getElementById("filter-search")?.value || "";
  const severity = document.getElementById("filter-severity")?.value || "All";
  const status = document.getElementById("filter-status")?.value || "All";
  const issueType = document.getElementById("filter-type")?.value || "All";

  const params = new URLSearchParams();
  if (search) params.set("search", search);
  if (severity !== "All") params.set("severity", severity);
  if (status !== "All") params.set("status", status);
  if (issueType !== "All") params.set("issue_type", issueType);

  try {
    const res = await fetch(`/api/issues?${params.toString()}`);
    if (!res.ok) throw new Error("Failed to fetch issues");
    allIssues = await res.json();
    renderIssuesTable(allIssues);

    // Check if URL has ?view=CE-XXX
    const urlParams = new URLSearchParams(window.location.search);
    const viewId = urlParams.get("view");
    if (viewId) {
      const match = allIssues.find(i => i.issue_id === viewId);
      if (match) {
        openIssueModal(match);
      }
    }
  } catch (err) {
    console.error("Error loading issues:", err);
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:#b91c1c; padding:2rem;">Failed to load issues from SQLite database.</td></tr>`;
    }
  }
}

function renderIssuesTable(issues) {
  const tbody = document.getElementById("issues-tbody");
  const countBadge = document.getElementById("issues-count-badge");
  if (countBadge) countBadge.textContent = `${issues.length} record${issues.length === 1 ? '' : 's'}`;

  if (!tbody) return;
  tbody.innerHTML = "";

  if (issues.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align:center; padding: 3rem 1rem; color: var(--text-muted);">
          No matching issues found. Try adjusting your filters.
        </td>
      </tr>
    `;
    return;
  }

  const role = CivicEye.getRole();

  issues.forEach(issue => {
    const tr = document.createElement("tr");
    tr.id = `row-${issue.issue_id}`;

    // Generate role-specific action buttons
    let actionButtonsHtml = `<button onclick="viewIssueDetail('${issue.issue_id}')" class="btn btn-secondary btn-sm">View</button>`;

    if (role === "Administrator") {
      if (issue.status === "Reported") {
        actionButtonsHtml += `
          <button onclick="quickVerify('${issue.issue_id}')" class="btn btn-outline btn-sm" title="Administrator verification shortcut" style="color:#0284c7; border-color:#bae6fd;">Verify</button>
        `;
      }
    } else if (role === "Technician") {
      if (issue.status !== "In Progress" && issue.status !== "Resolved") {
        actionButtonsHtml += `
          <button onclick="quickUpdateStatus('${issue.issue_id}', 'In Progress')" class="btn btn-sm btn-outline" style="color:#2563eb; border-color:#bfdbfe;" title="Advance status to In Progress">Start</button>
        `;
      } else if (issue.status === "In Progress") {
        actionButtonsHtml += `
          <button onclick="quickUpdateStatus('${issue.issue_id}', 'Resolved')" class="btn btn-sm btn-outline" style="color:#059669; border-color:#a7f3d0;" title="Mark repair as Resolved">Resolve</button>
        `;
      }
    }

    tr.innerHTML = `
      <td><span class="issue-id-tag">${issue.issue_id}</span></td>
      <td><strong>${issue.issue_type}</strong></td>
      <td style="max-width: 250px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${issue.location}">
        ${issue.location}
      </td>
      <td>${CivicEye.getSeverityBadge(issue.severity)}</td>
      <td>${CivicEye.getStatusBadge(issue.status)}</td>
      <td style="color: var(--text-muted); font-size: 0.825rem;">${CivicEye.formatDate(issue.created_at)}</td>
      <td>
        <div style="display:flex; gap:0.35rem; align-items:center;">
          ${actionButtonsHtml}
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function viewIssueDetail(issueId) {
  const issue = allIssues.find(i => i.issue_id === issueId);
  if (issue) {
    openIssueModal(issue);
  }
}

function openIssueModal(issue) {
  activeViewingIssue = issue;
  const modal = document.getElementById("issue-modal");
  if (!modal) return;

  document.getElementById("modal-issue-id").textContent = issue.issue_id;
  document.getElementById("modal-type").textContent = issue.issue_type;
  document.getElementById("modal-location").textContent = issue.location;
  document.getElementById("modal-date").textContent = CivicEye.formatDate(issue.created_at);
  document.getElementById("modal-description").textContent = issue.description || "No description provided.";
  
  // GPS Coordinates
  const coordsEl = document.getElementById("modal-coords");
  if (issue.latitude && issue.longitude) {
    coordsEl.innerHTML = `<code>${issue.latitude.toFixed(5)}, ${issue.longitude.toFixed(5)}</code> <a href="/map?focus=${issue.issue_id}" class="btn btn-sm btn-outline" style="margin-left:0.5rem;">View on Map</a>`;
  } else {
    coordsEl.innerHTML = `<span style="color:var(--text-muted); font-style:italic;">GPS coordinates unavailable</span>`;
  }

  // Badges & Dropdowns
  document.getElementById("modal-severity-badge").innerHTML = CivicEye.getSeverityBadge(issue.severity);
  document.getElementById("modal-status-badge").innerHTML = CivicEye.getStatusBadge(issue.status);

  // Role-Based Modal Customization
  const role = CivicEye.getRole();
  const adminPanel = document.getElementById("modal-admin-controls");
  const guestNotice = document.getElementById("modal-guest-notice");
  const statusSelect = document.getElementById("modal-status-select");
  const severitySelect = document.getElementById("modal-severity-select");
  const saveBtn = document.getElementById("modal-save-btn");
  const verifyBtn = document.getElementById("modal-verify-btn");
  const statusHint = document.getElementById("modal-status-hint");
  const severityHint = document.getElementById("modal-severity-hint");
  const roleIcon = document.getElementById("modal-role-indicator-icon");
  const roleTitle = document.getElementById("modal-role-indicator-title");
  const roleBadge = document.getElementById("modal-role-badge");

  if (role === "Administrator") {
    // Administrator: Full access
    if (adminPanel) adminPanel.style.display = "block";
    if (guestNotice) guestNotice.style.display = "none";
    if (saveBtn) {
      saveBtn.style.display = "inline-block";
      saveBtn.textContent = "Save Administrator Changes";
    }
    if (verifyBtn) {
      verifyBtn.style.display = (issue.status === "Reported") ? "inline-block" : "none";
    }

    if (roleIcon) roleIcon.textContent = "👑";
    if (roleTitle) roleTitle.textContent = "Administrator Controls";
    if (roleBadge) {
      roleBadge.textContent = "Administrator";
      roleBadge.className = "badge badge-critical";
    }

    if (statusSelect) {
      statusSelect.innerHTML = `
        <option value="Reported">Reported</option>
        <option value="Verified">Verified</option>
        <option value="In Progress">In Progress</option>
        <option value="Resolved">Resolved</option>
      `;
      statusSelect.value = issue.status;
      statusSelect.disabled = false;
    }
    if (statusHint) statusHint.textContent = "Authorized to assign all 4 life-cycle stages.";

    if (severitySelect) {
      severitySelect.disabled = false;
      severitySelect.value = issue.severity;
    }
    if (severityHint) severityHint.textContent = "Reclassify hazard priority if needed.";

  } else if (role === "Technician") {
    // Technician: Status updates (In Progress, Resolved) only. Severity locked. Verification disabled.
    if (adminPanel) adminPanel.style.display = "block";
    if (guestNotice) guestNotice.style.display = "none";
    if (saveBtn) {
      saveBtn.style.display = "inline-block";
      saveBtn.textContent = "Update Status (Technician)";
    }
    if (verifyBtn) verifyBtn.style.display = "none";

    if (roleIcon) roleIcon.textContent = "🔧";
    if (roleTitle) roleTitle.textContent = "Technician Field Dispatch";
    if (roleBadge) {
      roleBadge.textContent = "Technician";
      roleBadge.className = "badge badge-verified";
    }

    if (statusSelect) {
      statusSelect.innerHTML = `
        <option value="In Progress">In Progress</option>
        <option value="Resolved">Resolved</option>
      `;
      // If current issue is already In Progress or Resolved, select that, otherwise default to In Progress
      statusSelect.value = (issue.status === "Resolved") ? "Resolved" : "In Progress";
      statusSelect.disabled = false;
    }
    if (statusHint) statusHint.textContent = "Technician allowed statuses: 'In Progress' and 'Resolved'.";

    if (severitySelect) {
      severitySelect.disabled = true;
      severitySelect.value = issue.severity;
    }
    if (severityHint) severityHint.textContent = "🔒 Locked: Severity reclassification is restricted to Administrators.";

  } else {
    // Viewer: Read-only
    if (adminPanel) adminPanel.style.display = "none";
    if (guestNotice) guestNotice.style.display = "flex";
    if (saveBtn) saveBtn.style.display = "none";
    if (verifyBtn) verifyBtn.style.display = "none";
  }

  // Image & AI Confidence
  const imgBox = document.getElementById("modal-image-box");
  const confidenceEl = document.getElementById("modal-ai-confidence");
  if (issue.image_path) {
    imgBox.innerHTML = `<img src="${issue.image_path}" alt="Defect Photo" style="max-height:220px; width:100%; object-fit:cover; border-radius:var(--radius-md); border:1px solid var(--border-light);" onerror="this.src='/static/img/placeholder_defect.svg'">`;
  } else {
    imgBox.innerHTML = `<div style="padding:1.5rem; text-align:center; background:var(--bg-subtle); border-radius:var(--radius-md); color:var(--text-muted); font-size:0.85rem;">No image uploaded with this report</div>`;
  }

  if (confidenceEl) {
    const conf = (issue.ai_confidence ? issue.ai_confidence * 100 : 88).toFixed(0);
    confidenceEl.textContent = `${conf}% Confidence`;
  }

  modal.classList.add("active");
}

function closeIssueModal() {
  const modal = document.getElementById("issue-modal");
  if (modal) modal.classList.remove("active");
  activeViewingIssue = null;
}

async function saveAdminUpdates() {
  if (!activeViewingIssue) return;
  const role = CivicEye.getRole();
  const newStatus = document.getElementById("modal-status-select")?.value;
  const newSeverity = document.getElementById("modal-severity-select")?.value;

  const payload = {};
  if (newStatus) payload.status = newStatus;

  // Only send severity if user is Administrator and severity is enabled
  if (role === "Administrator" && newSeverity) {
    payload.severity = newSeverity;
  }

  try {
    const res = await fetch(`/api/issues/${activeViewingIssue.issue_id}`, {
      method: "PUT",
      headers: CivicEye.authHeaders(),
      body: JSON.stringify(payload)
    });

    const result = await res.json();
    if (!res.ok || result.permission_denied) {
      CivicEye.showToast(result.error || "Permission denied", "error");
      return;
    }

    CivicEye.showToast(`Issue ${activeViewingIssue.issue_id} updated successfully as ${role}`);
    closeIssueModal();
    loadIssues();
  } catch (err) {
    console.error("Save error:", err);
    CivicEye.showToast("Failed to save changes. Verify role permissions.", "error");
  }
}

async function quickVerifyFromModal() {
  if (!activeViewingIssue) return;
  await quickVerify(activeViewingIssue.issue_id);
  closeIssueModal();
}

async function quickVerify(issueId) {
  try {
    const res = await fetch(`/api/issues/${issueId}`, {
      method: "PUT",
      headers: CivicEye.authHeaders(),
      body: JSON.stringify({ status: "Verified" })
    });
    const result = await res.json();
    if (!res.ok || result.permission_denied) {
      CivicEye.showToast(result.error || "Only Administrators can verify defects.", "error");
      return;
    }
    CivicEye.showToast(`Issue ${issueId} verified as authentic by Administrator`);
    loadIssues();
  } catch (err) {
    CivicEye.showToast("Verification failed", "error");
  }
}

async function quickUpdateStatus(issueId, newStatus) {
  try {
    const res = await fetch(`/api/issues/${issueId}`, {
      method: "PUT",
      headers: CivicEye.authHeaders(),
      body: JSON.stringify({ status: newStatus })
    });
    const result = await res.json();
    if (!res.ok || result.permission_denied) {
      CivicEye.showToast(result.error || "Update failed due to permission restriction", "error");
      return;
    }
    CivicEye.showToast(`Issue ${issueId} updated to '${newStatus}' by ${CivicEye.getRole()}`);
    loadIssues();
  } catch (err) {
    CivicEye.showToast("Status update failed", "error");
  }
}

async function clearDemoData() {
  if (!confirm("Are you sure you want to remove all demo records? Real user-reported issues will be preserved.")) return;
  try {
    const res = await fetch("/api/demo/clear", {
      method: "POST",
      headers: CivicEye.authHeaders()
    });
    const data = await res.json();
    if (!res.ok || data.permission_denied) {
      CivicEye.showToast(data.error || "Permission denied", "error");
      return;
    }
    CivicEye.showToast(data.message || "Demo records cleared");
    loadIssues();
  } catch (e) {
    CivicEye.showToast("Failed to clear demo records", "error");
  }
}

async function resetDemoData() {
  try {
    const res = await fetch("/api/demo/reset", {
      method: "POST",
      headers: CivicEye.authHeaders()
    });
    const data = await res.json();
    if (!res.ok || data.permission_denied) {
      CivicEye.showToast(data.error || "Permission denied", "error");
      return;
    }
    CivicEye.showToast(data.message || "Demo records restored");
    loadIssues();
  } catch (e) {
    CivicEye.showToast("Failed to restore demo records", "error");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  loadIssues();

  // Attach search and filter event listeners
  const searchInput = document.getElementById("filter-search");
  if (searchInput) {
    let debounceTimer;
    searchInput.addEventListener("input", () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(loadIssues, 250);
    });
  }

  ["filter-severity", "filter-status", "filter-type"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("change", loadIssues);
  });
});
