/**
 * CivicEye AI - Civic Infrastructure Map Controller
 * static/js/map.js
 * Renders GPS coordinates from SQLite onto an interactive map.
 * Shows markers with Issue ID, Type, Severity, and Status.
 * Clearly separates issues with coordinates from those without.
 */

let mapInstance = null;
let mapMarkers = [];
let mapIssues = [];

async function initCivicMap() {
  const mapContainer = document.getElementById("civic-map");
  if (!mapContainer) return;

  try {
    const res = await fetch("/api/issues");
    if (!res.ok) throw new Error("Failed to load map points");
    mapIssues = await res.json();
    renderMapUI(mapIssues);
  } catch (err) {
    console.error("Map data fetch error:", err);
    CivicEye.showToast("Could not load geolocation markers", "error");
  }
}

function renderMapUI(issues) {
  const listContainer = document.getElementById("map-sidebar-list");
  const gpsCountBadge = document.getElementById("gps-count-badge");
  const noGpsCountBadge = document.getElementById("nogps-count-badge");

  const validGps = issues.filter(i => typeof i.latitude === "number" && typeof i.longitude === "number" && !isNaN(i.latitude) && !isNaN(i.longitude));
  const noGps = issues.filter(i => !validGps.includes(i));

  if (gpsCountBadge) gpsCountBadge.textContent = `${validGps.length} Plotted`;
  if (noGpsCountBadge) noGpsCountBadge.textContent = `${noGps.length} Unplotted`;

  // Render Sidebar List
  if (listContainer) {
    listContainer.innerHTML = "";
    
    if (issues.length === 0) {
      listContainer.innerHTML = `<li style="padding:1rem; color:var(--text-muted); text-align:center;">No issues in database</li>`;
    } else {
      issues.forEach(issue => {
        const hasCoords = typeof issue.latitude === "number" && typeof issue.longitude === "number";
        const li = document.createElement("li");
        li.className = "map-issue-item";
        li.id = `sidebar-item-${issue.issue_id}`;
        li.innerHTML = `
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.25rem;">
            <span class="issue-id-tag">${issue.issue_id}</span>
            ${CivicEye.getSeverityBadge(issue.severity)}
          </div>
          <div style="font-weight:700; font-size:0.875rem; margin-bottom:0.2rem;">${issue.issue_type}</div>
          <div style="font-size:0.775rem; color:var(--text-muted); margin-bottom:0.35rem;">${issue.location}</div>
          <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.75rem;">
            <span>${CivicEye.getStatusBadge(issue.status)}</span>
            ${hasCoords 
              ? `<span style="color:#047857; font-weight:600;">📍 GPS Plotted</span>` 
              : `<span style="color:#b91c1c; font-style:italic;">⚠️ No GPS</span>`}
          </div>
        `;

        li.addEventListener("click", () => {
          document.querySelectorAll(".map-issue-item").forEach(el => el.classList.remove("active"));
          li.classList.add("active");
          if (hasCoords) {
            focusMarkerOnMap(issue);
          } else {
            CivicEye.showToast(`Issue ${issue.issue_id} has no GPS coordinates recorded. Location is unavailable.`);
          }
        });

        listContainer.appendChild(li);
      });
    }
  }

  // Initialize Map
  setupLeafletMap(validGps);
}

function setupLeafletMap(points) {
  const mapEl = document.getElementById("civic-map");
  if (!mapEl) return;

  // Clear previous instance if re-initializing
  if (mapInstance) {
    mapInstance.remove();
    mapInstance = null;
    mapMarkers = [];
  }

  // Default coordinate center (San Francisco or first point)
  let centerLat = 37.7749;
  let centerLng = -122.4194;

  if (points.length > 0) {
    centerLat = points[0].latitude;
    centerLng = points[0].longitude;
  }

  if (typeof L !== "undefined") {
    // Leaflet is loaded
    mapInstance = L.map("civic-map", {
      zoomControl: true,
      scrollWheelZoom: true
    }).setView([centerLat, centerLng], 13);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors | CivicEye AI',
      maxZoom: 19
    }).addTo(mapInstance);

    const bounds = [];

    points.forEach(issue => {
      const lat = issue.latitude;
      const lng = issue.longitude;
      bounds.push([lat, lng]);

      // Choose marker color based on severity
      let markerColor = "#2563eb"; // default blue
      if (issue.severity === "Critical") markerColor = "#dc2626"; // red
      else if (issue.severity === "High") markerColor = "#ea580c"; // orange
      else if (issue.severity === "Medium") markerColor = "#d97706"; // amber
      else if (issue.severity === "Low") markerColor = "#059669"; // green

      // Custom styled SVG icon
      const customIcon = L.divIcon({
        className: "custom-civic-pin",
        html: `
          <div style="
            background-color: ${markerColor};
            width: 28px;
            height: 28px;
            border-radius: 50% 50% 50% 0;
            transform: rotate(-45deg);
            display: flex;
            align-items: center;
            justify-content: center;
            border: 2px solid #ffffff;
            box-shadow: 0 2px 5px rgba(0,0,0,0.3);
          ">
            <span style="transform: rotate(45deg); color: white; font-weight: 800; font-size: 11px;">!</span>
          </div>
        `,
        iconSize: [28, 28],
        iconAnchor: [14, 28],
        popupAnchor: [0, -28]
      });

      const marker = L.marker([lat, lng], { icon: customIcon }).addTo(mapInstance);

      const popupContent = `
        <div style="font-family: var(--font-sans); min-width: 180px; padding: 4px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
            <strong style="color:var(--primary); font-family:var(--font-mono); font-size:14px;">${issue.issue_id}</strong>
            ${CivicEye.getSeverityBadge(issue.severity)}
          </div>
          <div style="font-size:13px; font-weight:700; color:var(--text-main); margin-bottom:4px;">${issue.issue_type}</div>
          <div style="font-size:12px; color:var(--text-muted); margin-bottom:8px;">${issue.location}</div>
          <div style="display:flex; justify-content:space-between; align-items:center;">
            ${CivicEye.getStatusBadge(issue.status)}
            <a href="/issues?view=${issue.issue_id}" style="color:var(--primary); font-size:12px; font-weight:700;">View Details &rarr;</a>
          </div>
        </div>
      `;

      marker.bindPopup(popupContent);
      marker.issue_id = issue.issue_id;
      mapMarkers.push(marker);
    });

    if (bounds.length > 1) {
      mapInstance.fitBounds(bounds, { padding: [40, 40] });
    }

    // Check if URL has ?focus=CE-XXX
    const urlParams = new URLSearchParams(window.location.search);
    const focusId = urlParams.get("focus");
    if (focusId) {
      const match = points.find(p => p.issue_id === focusId);
      if (match) focusMarkerOnMap(match);
    }
  } else {
    // Fallback if CDN is unreachable
    renderCanvasFallbackMap(mapEl, points);
  }
}

function focusMarkerOnMap(issue) {
  if (mapInstance && typeof issue.latitude === "number") {
    mapInstance.setView([issue.latitude, issue.longitude], 15, { animate: true });
    const targetMarker = mapMarkers.find(m => m.issue_id === issue.issue_id);
    if (targetMarker) {
      targetMarker.openPopup();
    }
  }
}

function renderCanvasFallbackMap(container, points) {
  container.innerHTML = `
    <div style="padding:2rem; text-align:center; background:#ffffff; height:100%; display:flex; flex-direction:column; align-items:center; justify-content:center;">
      <h3 style="margin-bottom:0.5rem; color:var(--text-main);">Civic Infrastructure Geographic Plotter</h3>
      <p style="color:var(--text-muted); margin-bottom:1.5rem; max-width:450px; font-size:0.9rem;">
        Plotted ${points.length} GPS coordinates directly from SQLite database.
      </p>
      <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap:1rem; width:100%; max-height:300px; overflow-y:auto; padding:1rem; background:var(--bg-subtle); border-radius:var(--radius-md);">
        ${points.map(p => `
          <div style="padding:0.75rem; background:#fff; border:1px solid var(--border-light); border-radius:var(--radius-sm); text-align:left;">
            <strong>${p.issue_id}</strong> - ${p.issue_type}
            <div style="font-size:0.75rem; color:var(--text-muted);">${p.latitude.toFixed(4)}, ${p.longitude.toFixed(4)}</div>
            <div style="margin-top:0.4rem;">${CivicEye.getSeverityBadge(p.severity)} ${CivicEye.getStatusBadge(p.status)}</div>
          </div>
        `).join("")}
      </div>
    </div>
  `;
}

document.addEventListener("DOMContentLoaded", () => {
  initCivicMap();
});
