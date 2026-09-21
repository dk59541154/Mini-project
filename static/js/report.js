/**
 * CivicEye AI - Report Issue Controller
 * static/js/report.js
 * Handles browser geolocation, image drag-and-drop, AI defect analysis,
 * validation, and submission via fetch() to /api/issues.
 */

let selectedFile = null;

function setupReportForm() {
  const form = document.getElementById("report-form");
  const geoBtn = document.getElementById("btn-geolocation");
  const fileInput = document.getElementById("file-input");
  const dropzone = document.getElementById("upload-dropzone");
  const removeImgBtn = document.getElementById("btn-remove-image");

  // 1. Geolocation Setup
  if (geoBtn) {
    geoBtn.addEventListener("click", () => {
      if (!navigator.geolocation) {
        CivicEye.showToast("Geolocation is not supported by your browser.", "error");
        return;
      }

      geoBtn.disabled = true;
      geoBtn.innerHTML = `
        <svg class="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10" stroke-opacity="0.25"></circle>
          <path d="M12 2a10 10 0 0 1 10 10"></path>
        </svg>
        Detecting GPS...
      `;

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          document.getElementById("input-latitude").value = lat.toFixed(6);
          document.getElementById("input-longitude").value = lng.toFixed(6);

          // If location description is empty, suggest coordinates label
          const locInput = document.getElementById("input-location");
          if (!locInput.value.trim()) {
            locInput.value = `GPS: ${lat.toFixed(4)}, ${lng.toFixed(4)}`;
          }

          CivicEye.showToast(`GPS coordinates captured (${lat.toFixed(4)}, ${lng.toFixed(4)})`);
          geoBtn.disabled = false;
          geoBtn.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
              <circle cx="12" cy="10" r="3"></circle>
            </svg>
            Location Updated
          `;
        },
        (error) => {
          console.warn("Geolocation error:", error);
          let msg = "Could not retrieve GPS position.";
          if (error.code === 1) msg = "Permission denied for location access.";
          else if (error.code === 2) msg = "Location position unavailable.";
          else if (error.code === 3) msg = "Location request timed out.";
          CivicEye.showToast(msg, "error");

          geoBtn.disabled = false;
          geoBtn.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
              <circle cx="12" cy="10" r="3"></circle>
            </svg>
            Use My Location
          `;
        },
        { timeout: 10000, enableHighAccuracy: true }
      );
    });
  }

  // 2. Drag & Drop and File Input
  if (dropzone && fileInput) {
    dropzone.addEventListener("click", () => fileInput.click());

    ["dragenter", "dragover"].forEach(event => {
      dropzone.addEventListener(event, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.add("dragover");
      });
    });

    ["dragleave", "drop"].forEach(event => {
      dropzone.addEventListener(event, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.remove("dragover");
      });
    });

    dropzone.addEventListener("drop", (e) => {
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleFileSelect(e.dataTransfer.files[0]);
      }
    });

    fileInput.addEventListener("change", (e) => {
      if (e.target.files && e.target.files.length > 0) {
        handleFileSelect(e.target.files[0]);
      }
    });
  }

  if (removeImgBtn) {
    removeImgBtn.addEventListener("click", () => {
      selectedFile = null;
      if (fileInput) fileInput.value = "";
      document.getElementById("preview-wrapper").style.display = "none";
      document.getElementById("upload-dropzone").style.display = "block";
      document.getElementById("ai-feedback-box").style.display = "none";
    });
  }

  // 3. Form Submission
  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      await submitIssueForm();
    });
  }
}

function handleFileSelect(file) {
  if (!file.type.startsWith("image/")) {
    CivicEye.showToast("Please upload an image file (JPEG, PNG, WebP)", "error");
    return;
  }

  selectedFile = file;

  const reader = new FileReader();
  reader.onload = (e) => {
    const previewImg = document.getElementById("image-preview");
    const previewWrapper = document.getElementById("preview-wrapper");
    const dropzone = document.getElementById("upload-dropzone");

    if (previewImg) previewImg.src = e.target.result;
    if (previewWrapper) previewWrapper.style.display = "block";
    if (dropzone) dropzone.style.display = "none";

    // Run AI heuristic analysis preview
    runAiDefectPreview(file.name);
  };
  reader.readAsDataURL(file);
}

async function runAiDefectPreview(filename) {
  const feedbackBox = document.getElementById("ai-feedback-box");
  const issueTypeSelect = document.getElementById("select-issue-type");
  const severitySelect = document.getElementById("select-severity");
  const descriptionInput = document.getElementById("input-description");

  try {
    const res = await fetch("/api/ai/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        image_path: filename,
        description: descriptionInput?.value || "",
        issue_type: issueTypeSelect?.value || ""
      })
    });

    if (res.ok) {
      const aiData = await res.json();
      if (feedbackBox) {
        feedbackBox.style.display = "block";
        document.getElementById("ai-predicted-type").textContent = aiData.issue_type;
        document.getElementById("ai-predicted-conf").textContent = `${Math.round(aiData.confidence * 100)}% Confidence`;
        document.getElementById("ai-predicted-sev").textContent = `${aiData.severity} Severity`;
        document.getElementById("ai-predicted-rec").textContent = aiData.recommendation;

        // Optionally auto-select if user hasn't chosen one
        if (issueTypeSelect && issueTypeSelect.value === "Other" && aiData.issue_type) {
          issueTypeSelect.value = aiData.issue_type;
        }
        if (severitySelect && aiData.severity) {
          severitySelect.value = aiData.severity;
        }
      }
    }
  } catch (err) {
    console.warn("AI preview error:", err);
  }
}

async function submitIssueForm() {
  const submitBtn = document.getElementById("btn-submit-report");
  const location = document.getElementById("input-location").value.trim();
  const issueType = document.getElementById("select-issue-type").value;
  const description = document.getElementById("input-description").value.trim();
  const severity = document.getElementById("select-severity").value;
  const latitude = document.getElementById("input-latitude").value.trim();
  const longitude = document.getElementById("input-longitude").value.trim();

  // Validate form
  if (!location) {
    CivicEye.showToast("Please provide the street address or location.", "error");
    document.getElementById("input-location").focus();
    return;
  }
  if (!issueType) {
    CivicEye.showToast("Please select an issue type.", "error");
    return;
  }

  // Prepare FormData for upload + data
  const formData = new FormData();
  formData.append("location", location);
  formData.append("issue_type", issueType);
  formData.append("description", description);
  formData.append("severity", severity);
  if (latitude) formData.append("latitude", latitude);
  if (longitude) formData.append("longitude", longitude);
  if (selectedFile) formData.append("image", selectedFile);

  try {
    submitBtn.disabled = true;
    submitBtn.innerHTML = `
      <svg class="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10" stroke-opacity="0.25"></circle>
        <path d="M12 2a10 10 0 0 1 10 10"></path>
      </svg>
      Submitting & Classifying...
    `;

    const res = await fetch("/api/issues", {
      method: "POST",
      body: formData
    });

    const result = await res.json();

    if (!res.ok) {
      throw new Error(result.error || "Failed to submit issue report");
    }

    // Success response!
    displaySuccessBanner(result.issue_id, result.issue);

  } catch (err) {
    console.error("Submission failed:", err);
    CivicEye.showToast(`Submission failed: ${err.message}`, "error");
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
        <polyline points="22 4 12 14.01 9 11.01"></polyline>
      </svg>
      Submit Issue Report
    `;
  }
}

function displaySuccessBanner(issueId, issue) {
  const formCard = document.getElementById("report-form-card");
  const successCard = document.getElementById("report-success-card");

  if (formCard && successCard) {
    formCard.style.display = "none";
    successCard.style.display = "block";

    document.getElementById("success-issue-id").textContent = issueId;
    document.getElementById("success-location").textContent = issue?.location || "";
    document.getElementById("success-type").textContent = issue?.issue_type || "";
    document.getElementById("success-severity").innerHTML = CivicEye.getSeverityBadge(issue?.severity);

    CivicEye.showToast(`Report ${issueId} created successfully!`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
}

function resetReportForm() {
  const form = document.getElementById("report-form");
  if (form) form.reset();
  selectedFile = null;
  document.getElementById("preview-wrapper").style.display = "none";
  document.getElementById("upload-dropzone").style.display = "block";
  document.getElementById("ai-feedback-box").style.display = "none";

  document.getElementById("report-form-card").style.display = "block";
  document.getElementById("report-success-card").style.display = "none";
}

document.addEventListener("DOMContentLoaded", () => {
  setupReportForm();
});
