"""
CivicEye AI - Smart Road & Infrastructure Auditor
Flask Web Application & REST API Server
"""

import os
import json
from datetime import datetime
from werkzeug.utils import secure_filename

try:
    from flask import Flask, render_template, request, jsonify, session, redirect, url_for, send_from_directory
except ImportError:
    Flask = None

import database
import ai_detector

UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'static', 'uploads')
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'webp', 'gif'}
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

app = None
if Flask:
    app = Flask(__name__, template_folder='templates', static_folder='static')
    app.secret_key = os.environ.get('SECRET_KEY', 'civiceye-secret-key-prod-994')
    app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
    app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16 MB max


def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


if app:
    # Initialize database on startup
    with app.app_context():
        database.init_db(seed_demo=True)

    # ---------------- PAGE ROUTES ----------------
    @app.route('/')
    def home_page():
        return render_template('index.html', active_page='home')

    @app.route('/dashboard')
    def dashboard_page():
        return render_template('dashboard.html', active_page='dashboard')

    @app.route('/issues')
    def issues_page():
        return render_template('issues.html', active_page='issues')

    @app.route('/map')
    def map_page():
        return render_template('map.html', active_page='map')

    @app.route('/report')
    def report_page():
        return render_template('report.html', active_page='report')

    @app.route('/login')
    def login_page():
        return render_template('login.html', active_page='login')

    @app.route('/logout')
    def logout_route():
        session.pop('is_admin', None)
        session.pop('admin_email', None)
        return redirect(url_for('home_page'))

    # ---------------- REST API ROUTES ----------------

    @app.route('/api/dashboard', methods=['GET'])
    def api_dashboard():
        """Returns live metrics calculated from SQLite."""
        try:
            metrics = database.get_dashboard_metrics()
            return jsonify(metrics), 200
        except Exception as e:
            return jsonify({"error": str(e)}), 500

    @app.route('/api/issues', methods=['GET'])
    def api_get_issues():
        """Retrieve all issues with optional filtering."""
        search = request.args.get('search', '').strip()
        severity = request.args.get('severity', 'All').strip()
        status = request.args.get('status', 'All').strip()
        issue_type = request.args.get('issue_type', 'All').strip()

        issues = database.get_all_issues(
            search=search if search else None,
            severity=severity,
            status=status,
            issue_type=issue_type
        )
        return jsonify(issues), 200

    @app.route('/api/issues', methods=['POST'])
    def api_create_issue():
        """
        Create a new civic issue report:
        - Validates input
        - Supports file upload to static/uploads/
        - Runs AI defect detection engine (ai_detector.py)
        - Inserts into SQLite
        - Returns generated issue ID (e.g. CE-007)
        """
        try:
            image_path = ""
            issue_type = "Other"
            location = ""
            description = ""
            latitude = None
            longitude = None
            severity = "Medium"

            # Check if multipart form data or JSON
            if request.content_type and 'multipart/form-data' in request.content_type:
                issue_type = request.form.get('issue_type', 'Other').strip()
                location = request.form.get('location', '').strip()
                description = request.form.get('description', '').strip()
                lat_raw = request.form.get('latitude')
                lng_raw = request.form.get('longitude')
                severity = request.form.get('severity', 'Medium').strip()

                if lat_raw and lat_raw.strip():
                    try:
                        latitude = float(lat_raw)
                    except ValueError:
                        pass
                if lng_raw and lng_raw.strip():
                    try:
                        longitude = float(lng_raw)
                    except ValueError:
                        pass

                # Handle uploaded file
                if 'image' in request.files:
                    file = request.files['image']
                    if file and file.filename and allowed_file(file.filename):
                        fname = secure_filename(file.filename)
                        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                        saved_name = f"{timestamp}_{fname}"
                        save_dest = os.path.join(app.config['UPLOAD_FOLDER'], saved_name)
                        file.save(save_dest)
                        image_path = f"/static/uploads/{saved_name}"
            else:
                data = request.get_json(force=True) or {}
                issue_type = data.get('issue_type', 'Other')
                location = data.get('location', '')
                description = data.get('description', '')
                latitude = data.get('latitude')
                longitude = data.get('longitude')
                severity = data.get('severity', 'Medium')
                image_path = data.get('image_path', '')

            # Validation
            if not location:
                return jsonify({"error": "Location is required"}), 400
            if not issue_type:
                return jsonify({"error": "Issue type is required"}), 400

            # Execute AI Defect Detection
            ai_result = ai_detector.detect_defect(
                image_path=image_path,
                metadata={"issue_type": issue_type, "description": description}
            )

            # If user didn't explicitly override severity, use AI detected severity
            ai_severity = ai_result.get('severity', severity)
            confidence = ai_result.get('confidence', 0.88)

            record = {
                "issue_type": issue_type,
                "description": description,
                "location": location,
                "latitude": latitude,
                "longitude": longitude,
                "severity": severity if severity in ["Critical", "High", "Medium", "Low"] else ai_severity,
                "status": "Reported",
                "image_path": image_path,
                "ai_confidence": confidence
            }

            issue_id = database.insert_issue(record)

            return jsonify({
                "success": True,
                "message": "Issue successfully reported and queued for verification.",
                "issue_id": issue_id,
                "issue": database.get_issue_by_id(issue_id),
                "ai_detection": ai_result
            }), 201

        except Exception as e:
            return jsonify({"error": str(e)}), 500

    @app.route('/api/roles', methods=['GET'])
    def api_roles():
        """Get role definitions and permissions."""
        return jsonify({
            "roles": database.ROLE_PERMISSIONS,
            "demo_users": [
                {"email": "admin@civiceye.gov", "name": "Sarah Jenkins (Lead Auditor)", "role": "Administrator"},
                {"email": "tech@civiceye.gov", "name": "Alex Rivera (Field Technician)", "role": "Technician"},
                {"email": "viewer@civiceye.gov", "name": "Morgan Chen (Civic Analyst)", "role": "Viewer"}
            ]
        }), 200

    @app.route('/api/issues/<issue_id>', methods=['GET'])
    def api_get_single_issue(issue_id):
        """Retrieve issue details by issue_id."""
        issue = database.get_issue_by_id(issue_id)
        if not issue:
            return jsonify({"error": "Issue not found"}), 404
        return jsonify(issue), 200

    @app.route('/api/issues/<issue_id>', methods=['PUT'])
    def api_update_issue(issue_id):
        """Update status or severity of an issue with role permission checks."""
        data = request.get_json(force=True) or {}
        issue = database.get_issue_by_id(issue_id)
        if not issue:
            return jsonify({"error": "Issue not found"}), 404

        # Determine user role from session or request header
        session_user = session.get('user')
        role = None
        if session_user:
            role = session_user.get('role')
        elif request.headers.get('x-user-role'):
            role = request.headers.get('x-user-role')
        elif session.get('is_admin'):
            role = "Administrator"

        is_valid, err_msg = database.validate_issue_update_permission(role, issue, data)
        if not is_valid:
            return jsonify({"error": err_msg, "permission_denied": True}), 403

        updated = database.update_issue(issue_id, data)
        return jsonify({
            "success": True,
            "message": f"Issue {issue_id} successfully updated",
            "issue": updated
        }), 200

    @app.route('/api/login', methods=['POST'])
    def api_login():
        """Authenticate user credentials and return profile with role permissions."""
        data = request.get_json(force=True) or {}
        email = data.get('email', '').strip()
        password = data.get('password', '').strip()

        if not email or not password:
            return jsonify({"error": "Email and password are required"}), 400

        user = database.authenticate_user(email, password)
        if user:
            session['user'] = user
            session['user_role'] = user['role']
            session['is_admin'] = (user['role'] == "Administrator")
            return jsonify({
                "success": True,
                "message": f"Login successful. Authenticated as {user['name']} ({user['role']})",
                "user": user
            }), 200
        else:
            return jsonify({
                "error": "Invalid email or password. Demo accounts: admin@civiceye.gov / tech@civiceye.gov / viewer@civiceye.gov"
            }), 401

    @app.route('/api/auth/status', methods=['GET'])
    def api_auth_status():
        """Check current user session and permissions."""
        user = session.get('user')
        if not user and session.get('is_admin'):
            user = {
                "email": session.get('admin_email', 'admin@civiceye.gov'),
                "name": "Administrator",
                "role": "Administrator",
                "permissions": database.get_role_permissions("Administrator")
            }
        return jsonify({
            "authenticated": user is not None,
            "user": user
        }), 200

    @app.route('/api/logout', methods=['POST', 'GET'])
    def api_logout():
        """Terminate current user session."""
        session.clear()
        if request.method == 'GET':
            return redirect('/')
        return jsonify({"success": True, "message": "Logged out successfully"}), 200

    @app.route('/api/demo/clear', methods=['POST'])
    def api_clear_demo():
        """Remove demo issues (Administrator only)."""
        role = session.get('user', {}).get('role') or request.headers.get('x-user-role')
        if role != "Administrator":
            return jsonify({"error": "Only Administrators can clear demo records.", "permission_denied": True}), 403

        deleted = database.clear_demo_data()
        return jsonify({
            "success": True,
            "message": f"Successfully cleared {deleted} demo records."
        }), 200

    @app.route('/api/demo/reset', methods=['POST'])
    def api_reset_demo():
        """Restore demo issues (Administrator only)."""
        role = session.get('user', {}).get('role') or request.headers.get('x-user-role')
        if role != "Administrator":
            return jsonify({"error": "Only Administrators can restore demo records.", "permission_denied": True}), 403

        database.seed_demo_data()
        return jsonify({
            "success": True,
            "message": "Demo data restored successfully."
        }), 200

    @app.route('/api/ai/analyze', methods=['POST'])
    def api_ai_analyze():
        """Analyze text or image preview with ai_detector."""
        data = request.get_json(force=True) or {}
        result = ai_detector.detect_defect(
            image_path=data.get('image_path'),
            metadata=data
        )
        return jsonify(result), 200

    @app.route('/api/demo/clear', methods=['POST'])
    def api_clear_demo():
        """Delete all demo records."""
        count = database.clear_demo_data()
        return jsonify({"success": True, "message": f"Cleared {count} demo records"}), 200

    @app.route('/api/demo/reset', methods=['POST'])
    def api_reset_demo():
        """Re-seed demo records."""
        database.seed_demo_data()
        return jsonify({"success": True, "message": "Demo data refreshed"}), 200


if __name__ == '__main__':
    if app:
        print("Starting CivicEye AI Flask Server on http://0.0.0.0:5000")
        app.run(host='0.0.0.0', port=5000, debug=True)
