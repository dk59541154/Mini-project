# CivicEye AI: Smart Road & Infrastructure Auditor

**Tagline**: Detect → Locate → Verify → Prioritize → Track  
**Architecture**: Python (Flask) + SQLite + HTML5 / CSS3 / Vanilla JavaScript

CivicEye AI is a municipal-grade civic infrastructure monitoring platform designed to detect, locate, verify, prioritize, and track road and infrastructure defects including potholes, road cracks, damaged traffic signals, bent traffic signs, and broken streetlights.

---

## 🏛️ System Features

1. **AI Defect Detection Engine (`ai_detector.py`)**:
   - Modular defect classification pipeline.
   - Built-in heuristic vision analyzer with confidence scoring and severity estimation.
   - Designed for seamless drop-in integration of YOLOv8 / ONNX PyTorch computer vision weights.

2. **Dynamic Infrastructure Health Index**:
   - Real-time network health calculated directly from SQLite records:
     $$\text{Health \%} = 100 - \left( \frac{\text{Unresolved Critical \& High Defects}}{\text{Total Defects}} \times 100 \right)$$
   - Categorized as **Healthy** ($\ge 80\%$), **Moderate** ($50-79\%$), or **Critical** ($<50\%$).
   - Clean linear progress bar indicator.

3. **Live 7-Day Incident Trend**:
   - JavaScript SVG chart plotting daily defect detections across municipal sectors.

4. **Geospatial Map (`/map`)**:
   - Interactive GIS map plotting real GPS coordinates (`latitude`, `longitude`) from SQLite.
   - Color-coded severity pins and interactive incident popups.
   - Explicit fallback indicators for records without coordinates.

5. **Citizen Reporting Portal (`/report`)**:
   - HTML5 Geolocation API integration ("Use My Location").
   - Image drag-and-drop file upload saved into `static/uploads/`.
   - Real-time client-side AI analysis feedback.
   - Sequential unique identifier generation (e.g. `CE-001`, `CE-002`).

6. **Searchable & Filterable Issue Directory (`/issues`)**:
   - Instant search by issue ID, location, or notes.
   - Multi-parameter filtering by issue type, severity, and workflow status.
   - Detailed incident modal with evidence photo and status audit trail.

7. **Auditor Authentication (`/login`)**:
   - Role-based auditor session management.
   - Allows auditors to verify reports, reclassify severity, and transition lifecycle states.
   - Demo credentials: `admin@civiceye.gov` / `admin123`.

---

## 📂 Project Directory Structure

```
CivicEye_AI/
│
├── app.py                     # Flask web server and REST API endpoints
├── database.py                # SQLite database management, CRUD & metrics calculations
├── ai_detector.py             # Infrastructure defect detection engine (modular architecture)
├── requirements.txt           # Python backend dependencies
├── civic_eye.db               # SQLite database file
│
├── templates/
│   ├── index.html             # Landing page with workflow & features
│   ├── dashboard.html         # Live metrics, health bar, trend & recent issues
│   ├── issues.html            # Searchable and filterable issue table
│   ├── map.html               # Geospatial GIS map with SQLite markers
│   ├── report.html            # Citizen defect reporting form with GPS & file upload
│   └── login.html             # Auditor authentication portal
│
├── static/
│   ├── css/
│   │   └── style.css          # Government/smart-city design system
│   │
│   ├── js/
│   │   ├── app.js             # Core client state, navigation & toast notifications
│   │   ├── dashboard.js       # Dashboard fetch & live metrics updater
│   │   ├── issues.js          # Table filtering, modal inspector & status updates
│   │   ├── map.js             # Leaflet & GIS marker plotting
│   │   └── report.js          # Geolocation, file upload & submission handler
│   │
│   ├── uploads/               # Stored citizen defect uploads
│   └── img/                   # Graphic defect evidence assets
│
└── README.md
```

---

## 🔌 REST API Specification

| Endpoint | Method | Description |
|---|---|---|
| `GET /api/dashboard` | GET | Returns live SQLite metrics: totals, critical, in-progress, resolved, health %, recent issues, 7-day trend |
| `GET /api/issues` | GET | Query issues with `search`, `severity`, `status`, and `issue_type` filters |
| `POST /api/issues` | POST | Create a new issue (supports JSON or multipart form with image upload) |
| `GET /api/issues/<issue_id>` | GET | Retrieve a specific issue by ID (e.g. `CE-001`) |
| `PUT /api/issues/<issue_id>` | PUT | Update issue status (`Reported`, `Verified`, `In Progress`, `Resolved`) or severity |
| `POST /api/login` | POST | Authenticate auditor credentials |
| `GET /api/auth/status` | GET | Inspect current session authentication state |
| `POST /api/ai/analyze` | POST | Run preview inference through `ai_detector.py` |
| `POST /api/demo/clear` | POST | Remove demo records |
| `POST /api/demo/reset` | POST | Re-seed demonstration infrastructure issues |

---

## 🚀 Running Locally with Python Flask

```bash
# 1. Install dependencies
pip install -r requirements.txt

# 2. Initialize SQLite database
python database.py init

# 3. Launch Flask server
python app.py
```

Access the application in your browser at `http://localhost:5000`.
