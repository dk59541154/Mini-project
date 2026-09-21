"""
CivicEye AI - Database Module
SQLite database manager using Python's standard sqlite3 library.
Handles schema initialization, issue CRUD operations, statistics, and demo data.
"""

import os
import sqlite3
import json
from datetime import datetime, timedelta
import hashlib

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'civic_eye.db')


def get_db_connection():
    """Create and return a thread-safe connection to the SQLite database with row dict factory."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def hash_password(password: str) -> str:
    """Hash password using SHA-256 for simple demo admin verification."""
    return hashlib.sha256(password.encode('utf-8')).hexdigest()


def init_db(seed_demo: bool = True):
    """
    Initialize SQLite database tables:
    - issues: Stores all reported road & infrastructure problems
    - admins: Stores administrative credentials
    """
    conn = get_db_connection()
    cursor = conn.cursor()

    # Create issues table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS issues (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            issue_id TEXT UNIQUE NOT NULL,
            issue_type TEXT NOT NULL,
            description TEXT,
            location TEXT NOT NULL,
            latitude REAL,
            longitude REAL,
            severity TEXT NOT NULL DEFAULT 'Medium',
            status TEXT NOT NULL DEFAULT 'Reported',
            image_path TEXT,
            ai_confidence REAL DEFAULT 0.0,
            is_demo INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    # Create admins table (kept for legacy support)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS admins (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    # Create users table with role support
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            name TEXT NOT NULL,
            role TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    # Insert default roles: Administrator, Technician, Viewer
    seed_users = [
        ('admin@civiceye.gov', 'admin123', 'Sarah Jenkins (Lead Auditor)', 'Administrator'),
        ('tech@civiceye.gov', 'tech123', 'Alex Rivera (Field Technician)', 'Technician'),
        ('viewer@civiceye.gov', 'viewer123', 'Morgan Chen (Civic Analyst)', 'Viewer')
    ]

    for email, pwd, name, role in seed_users:
        cursor.execute('SELECT id FROM users WHERE email = ?', (email,))
        if not cursor.fetchone():
            cursor.execute(
                'INSERT INTO users (email, password_hash, name, role) VALUES (?, ?, ?, ?)',
                (email, hash_password(pwd), name, role)
            )

    # Insert default admin for backwards compatibility
    cursor.execute('SELECT id FROM admins WHERE email = ?', ('admin@civiceye.gov',))
    if not cursor.fetchone():
        cursor.execute(
            'INSERT INTO admins (email, password_hash) VALUES (?, ?)',
            ('admin@civiceye.gov', hash_password('admin123'))
        )

    conn.commit()

    # Check if issues exist; if empty and seed_demo is requested, insert initial demo data
    cursor.execute('SELECT COUNT(*) FROM issues')
    count = cursor.fetchone()[0]
    if count == 0 and seed_demo:
        seed_demo_data(conn)

    conn.close()
    return True


def seed_demo_data(conn=None):
    """Insert realistic demo infrastructure issues so the system is fully auditable on first launch."""
    should_close = False
    if conn is None:
        conn = get_db_connection()
        should_close = True

    cursor = conn.cursor()
    now = datetime.utcnow()

    demo_records = [
        (
            "CE-001",
            "Pothole",
            "Deep asphalt pothole causing tire damage near the eastbound bus lane.",
            "452 Elm Street, Downtown Junction",
            37.7749,
            -122.4194,
            "Critical",
            "Reported",
            "/static/img/demo_pothole.jpg",
            0.94,
            1,
            (now - timedelta(days=5, hours=3)).strftime("%Y-%m-%d %H:%M:%S")
        ),
        (
            "CE-002",
            "Road Crack",
            "Transverse structural crack across two traffic lanes following recent freeze cycle.",
            "North Highway 101, Mile Marker 14",
            37.7833,
            -122.4167,
            "High",
            "Verified",
            "/static/img/demo_crack.jpg",
            0.88,
            1,
            (now - timedelta(days=4, hours=6)).strftime("%Y-%m-%d %H:%M:%S")
        ),
        (
            "CE-003",
            "Damaged Signal",
            "Traffic signal head detached and dangling by harness during high winds.",
            "Oak Avenue & 5th St Crossing",
            37.7690,
            -122.4467,
            "Critical",
            "In Progress",
            "/static/img/demo_signal.jpg",
            0.96,
            1,
            (now - timedelta(days=3, hours=1)).strftime("%Y-%m-%d %H:%M:%S")
        ),
        (
            "CE-004",
            "Damaged Sign",
            "Stop sign bent at 45 degrees, obstructed by tree branch overgrowth.",
            "Maple Court & Pine Boulevard",
            37.7550,
            -122.4300,
            "Medium",
            "Reported",
            "/static/img/demo_sign.jpg",
            0.82,
            1,
            (now - timedelta(days=2, hours=4)).strftime("%Y-%m-%d %H:%M:%S")
        ),
        (
            "CE-005",
            "Broken Streetlight",
            "Pedestrian walkway luminaire pole flickering and exposed terminal base.",
            "Civic Center Plaza East Walk",
            37.7790,
            -122.4180,
            "Medium",
            "Verified",
            "/static/img/demo_light.jpg",
            0.85,
            1,
            (now - timedelta(days=1, hours=8)).strftime("%Y-%m-%d %H:%M:%S")
        ),
        (
            "CE-006",
            "Pothole",
            "Subsurface washout cavity repaired and resurfaced by municipal crew.",
            "Market St & 8th Avenue",
            37.7765,
            -122.4172,
            "High",
            "Resolved",
            "/static/img/demo_repaired.jpg",
            0.91,
            1,
            (now - timedelta(hours=14)).strftime("%Y-%m-%d %H:%M:%S")
        )
    ]

    for rec in demo_records:
        cursor.execute('''
            INSERT OR IGNORE INTO issues (
                issue_id, issue_type, description, location, latitude, longitude,
                severity, status, image_path, ai_confidence, is_demo, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (rec[0], rec[1], rec[2], rec[3], rec[4], rec[5], rec[6], rec[7], rec[8], rec[9], rec[10], rec[11], rec[11]))

    conn.commit()
    if should_close:
        conn.close()
    return True


def clear_demo_data():
    """Remove all records marked as demo data."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('DELETE FROM issues WHERE is_demo = 1')
    deleted = cursor.rowcount
    conn.commit()
    conn.close()
    return deleted


def get_next_issue_id():
    """Generate sequential next issue identifier, e.g., CE-001, CE-002."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT id FROM issues ORDER BY id DESC LIMIT 1')
    row = cursor.fetchone()
    conn.close()
    next_num = 1 if not row else row['id'] + 1
    return f"CE-{next_num:03d}"


def get_dashboard_metrics():
    """
    Calculate and return live dashboard metrics from SQLite:
    - total issues
    - critical issues (severity == 'Critical')
    - in_progress (status == 'In Progress')
    - resolved (status == 'Resolved')
    - health percentage: 100 - percentage of unresolved critical/high severity issues
    - health status: Healthy, Moderate, Critical
    - recent_issues: latest 6 issues
    - trend: daily issue counts for the past 7 days
    """
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute('SELECT COUNT(*) FROM issues')
    total = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM issues WHERE severity = 'Critical'")
    critical = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM issues WHERE status = 'In Progress'")
    in_progress = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM issues WHERE status = 'Resolved'")
    resolved = cursor.fetchone()[0]

    # Health % = 100 - percentage of unresolved critical/high severity issues
    cursor.execute("""
        SELECT COUNT(*) FROM issues 
        WHERE status != 'Resolved' AND severity IN ('Critical', 'High')
    """)
    unresolved_crit_high = cursor.fetchone()[0]

    if total == 0:
        health = 100.0
        health_status = "Healthy"
    else:
        unresolved_pct = (unresolved_crit_high / total) * 100.0
        health = round(max(0.0, min(100.0, 100.0 - unresolved_pct)), 1)
        if health >= 80:
            health_status = "Healthy"
        elif health >= 50:
            health_status = "Moderate"
        else:
            health_status = "Critical"

    # Recent issues (latest 6)
    cursor.execute("""
        SELECT issue_id, issue_type, location, latitude, longitude, severity, status, 
               description, image_path, ai_confidence, created_at
        FROM issues
        ORDER BY created_at DESC, id DESC
        LIMIT 6
    """)
    recent_issues = [dict(row) for row in cursor.fetchall()]

    # 7-day trend
    # Gather counts for today and previous 6 days
    trend = []
    today = datetime.utcnow().date()
    for i in range(6, -1, -1):
        day_date = today - timedelta(days=i)
        day_str = day_date.strftime("%Y-%m-%d")
        cursor.execute("""
            SELECT COUNT(*) FROM issues 
            WHERE DATE(created_at) = ?
        """, (day_str,))
        count = cursor.fetchone()[0]
        trend.append({
            "date": day_str,
            "day_name": day_date.strftime("%a"),
            "display_date": day_date.strftime("%b %d"),
            "count": count
        })

    conn.close()

    return {
        "total": total,
        "critical": critical,
        "in_progress": in_progress,
        "resolved": resolved,
        "unresolved_critical_high": unresolved_crit_high,
        "health": health,
        "health_status": health_status,
        "recent_issues": recent_issues,
        "trend": trend
    }


def get_all_issues(search=None, severity=None, status=None, issue_type=None):
    """Query issues with flexible search and filtering."""
    conn = get_db_connection()
    cursor = conn.cursor()

    query = "SELECT * FROM issues WHERE 1=1"
    params = []

    if search:
        query += " AND (issue_id LIKE ? OR location LIKE ? OR description LIKE ?)"
        term = f"%{search}%"
        params.extend([term, term, term])

    if severity and severity != "All":
        query += " AND severity = ?"
        params.append(severity)

    if status and status != "All":
        query += " AND status = ?"
        params.append(status)

    if issue_type and issue_type != "All":
        query += " AND issue_type = ?"
        params.append(issue_type)

    query += " ORDER BY created_at DESC, id DESC"

    cursor.execute(query, params)
    issues = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return issues


def get_issue_by_id(issue_id):
    """Retrieve a single issue record by issue_id."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM issues WHERE issue_id = ?", (issue_id,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None


def insert_issue(data):
    """
    Insert a new issue into SQLite.
    Generates sequential issue_id (e.g., CE-001).
    """
    conn = get_db_connection()
    cursor = conn.cursor()

    issue_id = get_next_issue_id()
    now_str = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")

    cursor.execute('''
        INSERT INTO issues (
            issue_id, issue_type, description, location, latitude, longitude,
            severity, status, image_path, ai_confidence, is_demo, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        issue_id,
        data.get("issue_type", "Other"),
        data.get("description", ""),
        data.get("location", ""),
        data.get("latitude"),
        data.get("longitude"),
        data.get("severity", "Medium"),
        data.get("status", "Reported"),
        data.get("image_path", ""),
        data.get("ai_confidence", 0.0),
        0,
        now_str,
        now_str
    ))

    conn.commit()
    conn.close()
    return issue_id


def update_issue(issue_id, updates):
    """
    Update status, severity, or details for an issue.
    Returns the updated issue or None if not found.
    """
    conn = get_db_connection()
    cursor = conn.cursor()

    fields = []
    params = []
    allowed_fields = ["status", "severity", "description", "location", "latitude", "longitude"]

    for key, val in updates.items():
        if key in allowed_fields:
            fields.append(f"{key} = ?")
            params.append(val)

    if not fields:
        conn.close()
        return None

    fields.append("updated_at = ?")
    params.append(datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S"))

    params.append(issue_id)
    sql = f"UPDATE issues SET {', '.join(fields)} WHERE issue_id = ?"
    cursor.execute(sql, params)
    conn.commit()

    cursor.execute("SELECT * FROM issues WHERE issue_id = ?", (issue_id,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None


ROLE_PERMISSIONS = {
    "Administrator": {
        "role": "Administrator",
        "title": "Municipal Chief Auditor",
        "description": "Full administrative control including defect verification, severity reclassification, and life-cycle status dispatch.",
        "can_view": True,
        "can_report": True,
        "can_update_status": True,
        "allowed_statuses": ["Reported", "Verified", "In Progress", "Resolved"],
        "can_update_severity": True,
        "allowed_severities": ["Critical", "High", "Medium", "Low"],
        "can_verify": True,
        "can_manage_demo": True
    },
    "Technician": {
        "role": "Technician",
        "title": "Field Repair Specialist",
        "description": "Operational field access. Can update assigned repair statuses to 'In Progress' and mark works as 'Resolved'.",
        "can_view": True,
        "can_report": True,
        "can_update_status": True,
        "allowed_statuses": ["In Progress", "Resolved"],
        "can_update_severity": False,
        "allowed_severities": [],
        "can_verify": False,
        "can_manage_demo": False
    },
    "Viewer": {
        "role": "Viewer",
        "title": "Public & Agency Observer",
        "description": "Read-only access to infrastructure dashboard metrics, geospatial map, and audited issue records.",
        "can_view": True,
        "can_report": True,
        "can_update_status": False,
        "allowed_statuses": [],
        "can_update_severity": False,
        "allowed_severities": [],
        "can_verify": False,
        "can_manage_demo": False
    }
}


def get_role_permissions(role):
    """Retrieve permission descriptor for a given user role."""
    return ROLE_PERMISSIONS.get(role, ROLE_PERMISSIONS["Viewer"])


def authenticate_user(email, password):
    """Authenticate user against SQLite users table and return profile + role permissions."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, email, password_hash, name, role FROM users WHERE email = ?", (email,))
    user = cursor.fetchone()
    conn.close()

    if not user:
        # Fallback to admins table for legacy check
        if verify_admin_credentials(email, password):
            return {
                "id": 1,
                "email": email,
                "name": "Administrator",
                "role": "Administrator",
                "permissions": get_role_permissions("Administrator")
            }
        return None

    if user["password_hash"] != hash_password(password):
        return None

    role = user["role"]
    return {
        "id": user["id"],
        "email": user["email"],
        "name": user["name"],
        "role": role,
        "permissions": get_role_permissions(role)
    }


def validate_issue_update_permission(role, current_issue, updates):
    """
    Validate whether the specified role has permission to apply the requested updates.
    Returns (is_valid: bool, error_message: str | None)
    """
    if not role or role not in ROLE_PERMISSIONS:
        return False, "Authentication required to modify issue records."

    perm = ROLE_PERMISSIONS[role]

    # Check status updates
    if "status" in updates:
        new_status = updates["status"]
        if not perm["can_update_status"]:
            return False, f"Role '{role}' is read-only and cannot change issue status."
        if new_status not in perm["allowed_statuses"]:
            if role == "Technician" and new_status == "Verified":
                return False, "Only Administrators can verify reported defects. Technicians may only set 'In Progress' or 'Resolved'."
            if role == "Technician" and new_status == "Reported":
                return False, "Technicians cannot revert issues to 'Reported'. Allowed: 'In Progress', 'Resolved'."
            return False, f"Role '{role}' is not authorized to set status to '{new_status}'. Allowed: {', '.join(perm['allowed_statuses'])}."

    # Check severity updates
    if "severity" in updates:
        new_severity = updates["severity"]
        # If the severity is actually being changed
        if current_issue and current_issue.get("severity") != new_severity:
            if not perm["can_update_severity"]:
                return False, f"Role '{role}' cannot reclassify hazard severity. Only Administrators may change severity levels."
            if new_severity not in perm["allowed_severities"]:
                return False, f"Invalid severity '{new_severity}'."

    return True, None


def verify_admin_credentials(email, password):
    """Verify administrator email and password against hash in SQLite."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM admins WHERE email = ?", (email,))
    admin = cursor.fetchone()
    conn.close()
    if not admin:
        return False
    return admin["password_hash"] == hash_password(password)


if __name__ == "__main__":
    import sys
    action = sys.argv[1] if len(sys.argv) > 1 else "init"
    if action == "init":
        init_db()
        print(json.dumps({"status": "initialized", "metrics": get_dashboard_metrics()}))
    elif action == "metrics":
        init_db(seed_demo=False)
        print(json.dumps(get_dashboard_metrics()))
    elif action == "issues":
        init_db(seed_demo=False)
        search = sys.argv[2] if len(sys.argv) > 2 and sys.argv[2] != "None" else None
        severity = sys.argv[3] if len(sys.argv) > 3 and sys.argv[3] != "All" else None
        status = sys.argv[4] if len(sys.argv) > 4 and sys.argv[4] != "All" else None
        issue_type = sys.argv[5] if len(sys.argv) > 5 and sys.argv[5] != "All" else None
        print(json.dumps(get_all_issues(search=search, severity=severity, status=status, issue_type=issue_type)))
    elif action == "get_issue":
        init_db(seed_demo=False)
        issue_id = sys.argv[2] if len(sys.argv) > 2 else ""
        print(json.dumps(get_issue_by_id(issue_id)))
    elif action == "insert_issue":
        init_db(seed_demo=False)
        data = json.loads(sys.argv[2])
        new_id = insert_issue(data)
        print(json.dumps({"issue_id": new_id, "issue": get_issue_by_id(new_id)}))
    elif action == "update_issue":
        init_db(seed_demo=False)
        issue_id = sys.argv[2]
        updates = json.loads(sys.argv[3])
        role = sys.argv[4] if len(sys.argv) > 4 else "Administrator"

        current_issue = get_issue_by_id(issue_id)
        if not current_issue:
            print(json.dumps({"success": False, "error": "Issue not found"}))
        else:
            is_valid, err_msg = validate_issue_update_permission(role, current_issue, updates)
            if not is_valid:
                print(json.dumps({"success": False, "error": err_msg, "permission_denied": True}))
            else:
                updated = update_issue(issue_id, updates)
                print(json.dumps({"success": True, "issue": updated}))
    elif action == "login_user":
        init_db(seed_demo=False)
        email = sys.argv[2]
        pwd = sys.argv[3]
        user = authenticate_user(email, pwd)
        if user:
            print(json.dumps({"valid": True, "user": user}))
        else:
            print(json.dumps({"valid": False, "error": "Invalid email or password"}))
    elif action == "get_user_by_email":
        init_db(seed_demo=False)
        email = sys.argv[2]
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT id, email, name, role FROM users WHERE email = ?", (email,))
        u = cursor.fetchone()
        conn.close()
        if u:
            u_dict = dict(u)
            u_dict["permissions"] = get_role_permissions(u_dict["role"])
            print(json.dumps(u_dict))
        else:
            print(json.dumps(None))
    elif action == "verify_admin":
        init_db(seed_demo=False)
        email = sys.argv[2]
        pwd = sys.argv[3]
        valid = verify_admin_credentials(email, pwd)
        print(json.dumps({"valid": valid}))
    elif action == "clear_demo":
        init_db(seed_demo=False)
        del_count = clear_demo_data()
        print(json.dumps({"status": "cleared", "deleted_count": del_count}))
    elif action == "reset_demo":
        init_db(seed_demo=False)
        seed_demo_data()
        print(json.dumps({"status": "reset", "metrics": get_dashboard_metrics()}))


