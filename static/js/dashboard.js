/**
 * CivicEye AI - Dashboard Controller
 * static/js/dashboard.js
 * Connects to /api/dashboard and dynamically renders metrics, health bar,
 * 7-day trend chart, and recent issues table.
 */

async function loadDashboardData() {
  const loadingIndicator = document.getElementById("dashboard-loading");
  if (loadingIndicator) loadingIndicator.style.display = "block";

  try {
    const response = await fetch("/api/dashboard");
    if (!response.ok) {
      throw new Error(`Failed to fetch metrics: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    updateDashboardUI(data);
  } catch (error) {
    console.error("Dashboard error:", error);
    CivicEye.showToast("Could not load live dashboard data. Check backend connection.", "error");
  } finally {
    if (loadingIndicator) loadingIndicator.style.display = "none";
  }
}

function updateDashboardUI(data) {
  // 0. Update Role Status Banner
  const role = CivicEye.getRole();
  const roleIcon = document.getElementById("dash-role-icon");
  const roleTitle = document.getElementById("dash-role-title");
  const roleDesc = document.getElementById("dash-role-desc");

  if (roleIcon && roleTitle && roleDesc) {
    if (role === "Administrator") {
      roleIcon.textContent = "👑";
      roleTitle.textContent = "Active Role: Administrator (Chief Municipal Auditor)";
      roleDesc.textContent = "Full administrative authorization: manage defect verifications, reclassify severity, and dispatch crew statuses.";
    } else if (role === "Technician") {
      roleIcon.textContent = "🔧";
      roleTitle.textContent = "Active Role: Technician (Field Repair Specialist)";
      roleDesc.textContent = "Field work order view: can transition issues to 'In Progress' and sign off as 'Resolved'.";
    } else {
      roleIcon.textContent = "👁️";
      roleTitle.textContent = "Active Role: Viewer (Public Observer)";
      roleDesc.textContent = "Read-only access to infrastructure records, network health scores, and defect trends.";
    }
  }

  // 1. Update Core Metric Cards
  const totalEl = document.getElementById("metric-total");
  const criticalEl = document.getElementById("metric-critical");
  const inProgressEl = document.getElementById("metric-in-progress");
  const resolvedEl = document.getElementById("metric-resolved");

  if (totalEl) totalEl.textContent = data.total ?? 0;
  if (criticalEl) criticalEl.textContent = data.critical ?? 0;
  if (inProgressEl) inProgressEl.textContent = data.in_progress ?? 0;
  if (resolvedEl) resolvedEl.textContent = data.resolved ?? 0;

  // 2. Update Infrastructure Health Section
  const healthPercent = data.health ?? 100;
  const healthStatus = data.health_status || (healthPercent >= 80 ? "Healthy" : (healthPercent >= 50 ? "Moderate" : "Critical"));

  const healthScoreEl = document.getElementById("health-score");
  const healthStatusEl = document.getElementById("health-status-badge");
  const progressBarFill = document.getElementById("health-progress-fill");
  const healthDetailEl = document.getElementById("health-detail-text");

  if (healthScoreEl) healthScoreEl.textContent = `${healthPercent}%`;
  
  if (healthStatusEl) {
    healthStatusEl.textContent = healthStatus;
    healthStatusEl.className = `health-status-badge ${healthStatus.toLowerCase()}`;
  }

  if (progressBarFill) {
    progressBarFill.style.width = `${healthPercent}%`;
    progressBarFill.className = `progress-bar-fill ${healthStatus.toLowerCase()}`;
  }

  if (healthDetailEl) {
    const unresolvedCrit = data.unresolved_critical_high ?? (data.total - data.resolved);
    healthDetailEl.textContent = `${unresolvedCrit} unresolved high/critical priority issue${unresolvedCrit === 1 ? '' : 's'} affecting municipal network reliability.`;
  }

  // 3. Render 7-Day Trend Chart
  renderTrendChart(data.trend || []);

  // 4. Render Recent Issues Table
  renderRecentIssues(data.recent_issues || []);
}

function renderTrendChart(trendData) {
  const container = document.getElementById("trend-chart");
  if (!container) return;

  container.innerHTML = "";

  if (!trendData || trendData.length === 0) {
    container.innerHTML = `<div style="margin:auto; color:var(--text-muted); font-size:0.85rem;">No trend data available.</div>`;
    return;
  }

  // Find max count to scale bar heights
  const maxCount = Math.max(...trendData.map(d => d.count), 1);

  trendData.forEach(day => {
    const group = document.createElement("div");
    group.className = "chart-bar-group";

    // Height scaled between 8% and 90%
    const heightPercent = Math.max(10, Math.round((day.count / maxCount) * 85));

    group.innerHTML = `
      <span class="chart-bar-count">${day.count}</span>
      <div class="chart-bar" style="height: ${heightPercent}%;" title="${day.display_date || day.date}: ${day.count} detected issue(s)"></div>
      <span class="chart-bar-label">${day.day_name || day.date.slice(5)}</span>
    `;

    container.appendChild(group);
  });
}

function renderRecentIssues(issues) {
  const tbody = document.getElementById("recent-issues-tbody");
  if (!tbody) return;

  tbody.innerHTML = "";

  if (issues.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align:center; padding: 2rem; color: var(--text-muted);">
          No issues recorded in the database yet. Click "Report Issue" to submit one.
        </td>
      </tr>
    `;
    return;
  }

  issues.forEach(issue => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><span class="issue-id-tag">${issue.issue_id}</span></td>
      <td><strong>${issue.issue_type}</strong></td>
      <td style="max-width: 200px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${issue.location}">
        ${issue.location}
      </td>
      <td>${CivicEye.getSeverityBadge(issue.severity)}</td>
      <td>${CivicEye.getStatusBadge(issue.status)}</td>
      <td style="color: var(--text-muted); font-size:0.825rem;">${CivicEye.formatDate(issue.created_at)}</td>
      <td>
        <a href="/issues?view=${issue.issue_id}" class="btn btn-secondary btn-sm">View</a>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// Auto load when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  loadDashboardData();
  // Refresh every 30 seconds for live monitoring
  setInterval(loadDashboardData, 30000);
});
