/**
 * CivicEye AI - Smart Road & Infrastructure Auditor
 * High-Performance Express & Full-Stack Bridge Server
 * Coordinates between the HTML5/Vanilla JS frontend and the Python/SQLite backend.
 */

import express, { Request, Response } from "express";
import path from "path";
import fs from "fs";
import { execFile } from "child_process";
import multer from "multer";
import { createServer as createViteServer } from "vite";

const app = express();
const PORT = 3000;
const ROOT_DIR = process.cwd();
const TEMPLATES_DIR = path.join(ROOT_DIR, "templates");
const STATIC_DIR = path.join(ROOT_DIR, "static");
const UPLOAD_DIR = path.join(STATIC_DIR, "uploads");

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Multer storage for uploaded hazard images
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (_req, file, cb) => {
    const timestamp = new Date().toISOString().replace(/[-:T.]/g, "").slice(0, 14);
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    cb(null, `${timestamp}_${safeName}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 16 * 1024 * 1024 } // 16MB
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// In-memory admin session tracker (supports demo login)
let currentAdmin: { email: string; loggedInAt: string } | null = null;

/**
 * Execute Python module with arguments and parse JSON response
 */
function runPythonCommand(script: string, args: string[]): Promise<any> {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(ROOT_DIR, script);
    execFile("python3", [scriptPath, ...args], { cwd: ROOT_DIR }, (error, stdout, stderr) => {
      if (error) {
        console.error(`Python error (${script}):`, stderr || error.message);
        return reject(new Error(stderr || error.message));
      }
      try {
        const trimmed = stdout.trim();
        const jsonMatch = trimmed.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
        if (jsonMatch) {
          resolve(JSON.parse(jsonMatch[0]));
        } else {
          resolve({ raw: trimmed });
        }
      } catch (e: any) {
        console.error("Failed to parse Python JSON output:", stdout);
        reject(e);
      }
    });
  });
}

// Initialize SQLite database on boot
runPythonCommand("database.py", ["init"])
  .then(() => console.log("SQLite database initialized and verified via database.py"))
  .catch((err) => console.warn("Database initial check note:", err.message));

// ---------------- REST API ENDPOINTS ----------------

// GET /api/dashboard
app.get("/api/dashboard", async (_req: Request, res: Response) => {
  try {
    const metrics = await runPythonCommand("database.py", ["metrics"]);
    res.json(metrics);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/issues
app.get("/api/issues", async (req: Request, res: Response) => {
  try {
    const search = String(req.query.search || "None");
    const severity = String(req.query.severity || "All");
    const status = String(req.query.status || "All");
    const issueType = String(req.query.issue_type || "All");

    const issues = await runPythonCommand("database.py", ["issues", search, severity, status, issueType]);
    res.json(issues);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/issues (handles both JSON and multipart form file upload)
app.post("/api/issues", upload.single("image"), async (req: Request, res: Response) => {
  try {
    const issueType = req.body.issue_type || "Other";
    const location = req.body.location || "";
    const description = req.body.description || "";
    let latitude: number | null = null;
    let longitude: number | null = null;
    const severity = req.body.severity || "Medium";

    if (req.body.latitude && String(req.body.latitude).trim()) {
      const lat = parseFloat(req.body.latitude);
      if (!isNaN(lat)) latitude = lat;
    }
    if (req.body.longitude && String(req.body.longitude).trim()) {
      const lng = parseFloat(req.body.longitude);
      if (!isNaN(lng)) longitude = lng;
    }

    if (!location.trim()) {
      return res.status(400).json({ error: "Location is required" });
    }
    if (!issueType.trim()) {
      return res.status(400).json({ error: "Issue type is required" });
    }

    let imagePath = req.body.image_path || "";
    if (req.file) {
      imagePath = `/static/uploads/${req.file.filename}`;
    }

    // Run AI defect detector
    let aiResult = { issue_type: issueType, severity, confidence: 0.89, recommendation: "" };
    try {
      const detected = await runPythonCommand("ai_detector.py", [imagePath || "inspection.jpg", description]);
      if (detected && detected.issue_type) {
        aiResult = detected;
      }
    } catch (aiErr) {
      console.warn("AI detector note:", aiErr);
    }

    const payload = {
      issue_type: issueType,
      description,
      location,
      latitude,
      longitude,
      severity: ["Critical", "High", "Medium", "Low"].includes(severity) ? severity : aiResult.severity,
      status: "Reported",
      image_path: imagePath,
      ai_confidence: aiResult.confidence || 0.88
    };

    const inserted = await runPythonCommand("database.py", ["insert_issue", JSON.stringify(payload)]);

    res.status(201).json({
      success: true,
      message: "Issue successfully reported and queued for verification.",
      issue_id: inserted.issue_id,
      issue: inserted.issue,
      ai_detection: aiResult
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Role definition interface
interface UserRolePermissions {
  role: string;
  title: string;
  description: string;
  can_view: boolean;
  can_report: boolean;
  can_update_status: boolean;
  allowed_statuses: string[];
  can_update_severity: boolean;
  allowed_severities: string[];
  can_verify: boolean;
  can_manage_demo: boolean;
}

interface AuthUser {
  id: number;
  email: string;
  name: string;
  role: "Administrator" | "Technician" | "Viewer";
  permissions: UserRolePermissions;
}

// In-memory active session tracker (supports multi-role demo authentication)
let activeUser: AuthUser | null = null;

// GET /api/roles
app.get("/api/roles", (_req: Request, res: Response) => {
  res.json({
    roles: {
      Administrator: {
        role: "Administrator",
        title: "Municipal Chief Auditor",
        description: "Full administrative control including defect verification, severity reclassification, and status dispatch.",
        can_view: true,
        can_report: true,
        can_update_status: true,
        allowed_statuses: ["Reported", "Verified", "In Progress", "Resolved"],
        can_update_severity: true,
        allowed_severities: ["Critical", "High", "Medium", "Low"],
        can_verify: true,
        can_manage_demo: true
      },
      Technician: {
        role: "Technician",
        title: "Field Repair Specialist",
        description: "Operational field access. Can update assigned repair statuses to 'In Progress' and mark works as 'Resolved'.",
        can_view: true,
        can_report: true,
        can_update_status: true,
        allowed_statuses: ["In Progress", "Resolved"],
        can_update_severity: false,
        allowed_severities: [],
        can_verify: false,
        can_manage_demo: false
      },
      Viewer: {
        role: "Viewer",
        title: "Public & Agency Observer",
        description: "Read-only access to infrastructure dashboard metrics, geospatial map, and audited issue records.",
        can_view: true,
        can_report: true,
        can_update_status: false,
        allowed_statuses: [],
        can_update_severity: false,
        allowed_severities: [],
        can_verify: false,
        can_manage_demo: false
      }
    },
    demo_accounts: [
      { email: "admin@civiceye.gov", role: "Administrator", title: "Chief Auditor", name: "Sarah Jenkins" },
      { email: "tech@civiceye.gov", role: "Technician", title: "Field Tech", name: "Alex Rivera" },
      { email: "viewer@civiceye.gov", role: "Viewer", title: "Civic Analyst", name: "Morgan Chen" }
    ]
  });
});

// GET /api/issues/:id
app.get("/api/issues/:id", async (req: Request, res: Response) => {
  try {
    const issue = await runPythonCommand("database.py", ["get_issue", req.params.id]);
    if (!issue) {
      return res.status(404).json({ error: "Issue not found" });
    }
    res.json(issue);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/issues/:id (Enforces role permissions)
app.put("/api/issues/:id", async (req: Request, res: Response) => {
  try {
    const updates = req.body;
    // Resolve caller role from request header or session
    const headerRole = req.headers["x-user-role"] as string | undefined;
    const effectiveRole = headerRole || activeUser?.role || "Viewer";

    const result = await runPythonCommand("database.py", [
      "update_issue",
      req.params.id,
      JSON.stringify(updates),
      effectiveRole
    ]);

    if (!result || result.success === false) {
      const isForbidden = result?.permission_denied === true;
      return res.status(isForbidden ? 403 : 400).json({
        error: result?.error || "Update failed",
        permission_denied: isForbidden
      });
    }

    res.json({
      success: true,
      message: `Issue ${req.params.id} successfully updated by ${effectiveRole}`,
      issue: result.issue
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/login
app.post("/api/login", async (req: Request, res: Response) => {
  try {
    const email = req.body.email?.trim();
    const password = req.body.password?.trim();

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const authResult = await runPythonCommand("database.py", ["login_user", email, password]);
    if (authResult && authResult.valid && authResult.user) {
      activeUser = authResult.user;
      res.json({
        success: true,
        message: `Authenticated as ${authResult.user.name} (${authResult.user.role})`,
        user: authResult.user
      });
    } else {
      res.status(401).json({
        error: "Invalid email or password. Demo accounts: admin@civiceye.gov / tech@civiceye.gov / viewer@civiceye.gov (password: admin123, tech123, viewer123)"
      });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/auth/status
app.get("/api/auth/status", (req: Request, res: Response) => {
  // If client passes an authenticated email header, sync
  const clientEmail = req.headers["x-user-email"] as string | undefined;
  if (clientEmail && (!activeUser || activeUser.email !== clientEmail)) {
    runPythonCommand("database.py", ["get_user_by_email", clientEmail])
      .then((u) => {
        if (u) activeUser = u;
        res.json({
          authenticated: activeUser !== null,
          user: activeUser
        });
      })
      .catch(() => {
        res.json({
          authenticated: activeUser !== null,
          user: activeUser
        });
      });
    return;
  }

  res.json({
    authenticated: activeUser !== null,
    user: activeUser
  });
});

// GET & POST /logout
app.all("/logout", (_req: Request, res: Response) => {
  activeUser = null;
  res.redirect("/");
});

app.post("/api/logout", (_req: Request, res: Response) => {
  activeUser = null;
  res.json({ success: true, message: "Signed out successfully" });
});

// POST /api/ai/analyze
app.post("/api/ai/analyze", async (req: Request, res: Response) => {
  try {
    const filename = req.body.image_path || "";
    const description = req.body.description || "";
    const analysis = await runPythonCommand("ai_detector.py", [filename, description]);
    res.json(analysis);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/demo/clear (Administrator only)
app.post("/api/demo/clear", async (req: Request, res: Response) => {
  try {
    const headerRole = req.headers["x-user-role"] as string | undefined;
    const effectiveRole = headerRole || activeUser?.role;
    if (effectiveRole !== "Administrator") {
      return res.status(403).json({
        error: "Permission denied: Only Administrators can clear municipal demo records.",
        permission_denied: true
      });
    }

    const result = await runPythonCommand("database.py", ["clear_demo"]);
    res.json({ success: true, message: `Cleared ${result.deleted_count || 0} demo records` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/demo/reset (Administrator only)
app.post("/api/demo/reset", async (req: Request, res: Response) => {
  try {
    const headerRole = req.headers["x-user-role"] as string | undefined;
    const effectiveRole = headerRole || activeUser?.role;
    if (effectiveRole !== "Administrator") {
      return res.status(403).json({
        error: "Permission denied: Only Administrators can restore municipal demo records.",
        permission_denied: true
      });
    }

    await runPythonCommand("database.py", ["reset_demo"]);
    res.json({ success: true, message: "Demo data restored successfully" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------- STATIC ASSETS ROUTE ----------------
app.use("/static", express.static(STATIC_DIR));

// ---------------- TEMPLATE PAGE ROUTES ----------------
app.get("/", (_req: Request, res: Response) => {
  res.sendFile(path.join(TEMPLATES_DIR, "index.html"));
});

app.get("/dashboard", (_req: Request, res: Response) => {
  res.sendFile(path.join(TEMPLATES_DIR, "dashboard.html"));
});

app.get("/issues", (_req: Request, res: Response) => {
  res.sendFile(path.join(TEMPLATES_DIR, "issues.html"));
});

app.get("/map", (_req: Request, res: Response) => {
  res.sendFile(path.join(TEMPLATES_DIR, "map.html"));
});

app.get("/report", (_req: Request, res: Response) => {
  res.sendFile(path.join(TEMPLATES_DIR, "report.html"));
});

app.get("/login", (_req: Request, res: Response) => {
  res.sendFile(path.join(TEMPLATES_DIR, "login.html"));
});

// ---------------- SERVER BOOT ----------------
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    try {
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
    } catch (e) {
      console.warn("Vite middleware setup note:", e);
    }
  } else {
    const distPath = path.join(process.cwd(), "dist");
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
    }
  }

  // Fallback for any unhandled routes
  app.use((_req: Request, res: Response) => {
    res.sendFile(path.join(TEMPLATES_DIR, "index.html"));
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`CivicEye AI Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
