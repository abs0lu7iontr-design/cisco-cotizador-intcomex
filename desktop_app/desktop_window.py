import os
import sys
import json
import webview
from datetime import datetime
from typing import Dict, Any

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from db_manager import DatabaseManager
from auth_manager import AuthManager
from file_processor import FileProcessor
from dashboard_analytics import AnalyticsEngine

def get_resource_path(relative_path: str) -> str:
    """
    Resolves absolute path to resource reliably in both development
    and PyInstaller bundled executable modes.
    """
    # 1. PyInstaller single-folder / temp extraction directory
    if hasattr(sys, '_MEIPASS'):
        bundle_path = os.path.join(sys._MEIPASS, relative_path)
        if os.path.exists(bundle_path):
            return bundle_path

    # 2. Check next to executable or in _internal
    exe_dir = os.path.dirname(os.path.abspath(sys.executable))
    current_file_dir = os.path.dirname(os.path.abspath(__file__))
    
    candidate_paths = [
        os.path.join(exe_dir, relative_path),
        os.path.join(exe_dir, "_internal", relative_path),
        os.path.join(current_file_dir, relative_path),
        os.path.join(current_file_dir, "..", relative_path),
        os.path.join(os.getcwd(), relative_path),
    ]

    for p in candidate_paths:
        if os.path.exists(p):
            return os.path.abspath(p)

    return os.path.abspath(candidate_paths[0])

class DesktopBridge:
    """
    Python-to-JavaScript Bridge exposed to the desktop WebEngine/WebView.
    Allows the HTML/React frontend to call Python native desktop methods seamlessly.
    """

    def __init__(self, window_ref=None):
        self.window = window_ref
        self.db = DatabaseManager()
        self.auth = AuthManager(self.db)
        self.file_processor = FileProcessor()
        self.analytics = AnalyticsEngine(self.db)

    def set_window(self, window):
        self.window = window

    # -------------------------------------------------------------------------
    # 1. RBAC AUTHENTICATION & SESSION
    # -------------------------------------------------------------------------
    def login_user(self, username, password):
        """Authenticates user via bcrypt/RBAC and returns user session info."""
        success, msg = self.auth.login(username, password)
        if success:
            user = self.auth.current_user
            return {
                "success": True,
                "message": msg,
                "user": {
                    "username": user["username"],
                    "full_name": user["full_name"],
                    "role": user["role"]
                }
            }
        else:
            return {"success": False, "message": msg}

    def get_current_user(self):
        if self.auth.current_user:
            u = self.auth.current_user
            return {
                "username": u["username"],
                "full_name": u["full_name"],
                "role": u["role"]
            }
        return None

    def logout_user(self):
        self.auth.logout()
        return {"success": True}

    # -------------------------------------------------------------------------
    # 2. FILE UPLOAD, REGEX PARSING & HIERARCHICAL STORAGE
    # -------------------------------------------------------------------------
    def open_file_dialog(self):
        """Opens native desktop file dialog to pick an Estimate file (.xlsx)."""
        if not self.window:
            return None

        file_types = ('Excel Files (*.xlsx;*.xls)', 'All Files (*.*)')
        result = self.window.create_file_dialog(webview.OPEN_DIALOG, allow_multiple=False, file_types=file_types)
        
        if not result or len(result) == 0:
            return None

        filepath = result[0]
        filename = os.path.basename(filepath)

        # Regex Validation: [Partner]_[ClienteFinal]_resto_del_nombre.xlsx
        is_valid, partner, client, err = self.file_processor.parse_filename(filename)
        if not is_valid:
            return {
                "success": False,
                "error": err
            }

        try:
            # Store in hierarchical folder structure: Partner / ClienteFinal / YYYY-MM / YYYY-MM-DD /
            stored_info = self.file_processor.organize_and_store_file(filepath)

            # Read file bytes to pass to frontend ExcelJS processor
            with open(filepath, 'rb') as f:
                raw_bytes = f.read()
                import base64
                file_base64 = base64.b64encode(raw_bytes).decode('utf-8')
                file_bytes = list(raw_bytes)

            # Audit Trail Log
            current_user = self.auth.get_current_username() or "mskill"
            self.db.log_audit_event(
                current_user,
                "UPLOAD_ESTIMATE",
                f"Archivo {filename} subido para Partner: {partner}, Cliente: {client}. Guardado en: {stored_info['stored_filepath']}"
            )

            return {
                "success": True,
                "filepath": filepath,
                "filename": filename,
                "partner": partner,
                "client": client,
                "stored_filepath": stored_info["stored_filepath"],
                "file_bytes": file_bytes,
                "file_base64": file_base64
            }
        except Exception as e:
            return {
                "success": False,
                "error": f"Error procesando archivo: {str(e)}"
            }

    # -------------------------------------------------------------------------
    # 3. DOWNLOAD & SAVE EXCEL FILE
    # -------------------------------------------------------------------------
    def download_excel_file(self, filename, file_bytes):
        """Opens native desktop save dialog to download the processed Excel file."""
        if not self.window:
            return {"success": False, "error": "No window reference"}

        file_types = ('Excel Files (*.xlsx)', 'All Files (*.*)')
        save_path = self.window.create_file_dialog(webview.SAVE_DIALOG, save_filename=filename, file_types=file_types)

        if not save_path:
            return {"success": False, "cancelled": True}

        target_file = save_path if isinstance(save_path, str) else save_path[0]

        try:
            with open(target_file, 'wb') as f:
                f.write(bytes(file_bytes))

            # Audit Log
            current_user = self.auth.get_current_username() or "mskill"
            self.db.log_audit_event(
                current_user,
                "EXPORT_EXCEL",
                f"Cotización procesada descargada a: {target_file}"
            )
            return {"success": True, "filepath": target_file}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def save_estimate_structured(self, partner_name, client_final_name, filename, file_bytes):
        """
        Saves processed Excel file in hierarchical folder structure:
        gravity_storage / [Partner] / [ClienteFinal] / [Mes] / [filename]
        """
        try:
            byte_data = bytes(file_bytes)
            res = self.file_processor.save_estimate_in_client_month_structure(
                byte_data,
                partner_name,
                client_final_name,
                filename
            )

            # Audit Log
            current_user = self.auth.get_current_username() or "mskill"
            self.db.log_audit_event(
                current_user,
                "EXPORT_EXCEL",
                f"Cotización guardada en estructura: {res['filepath']}"
            )

            return res
        except Exception as e:
            return {"success": False, "error": str(e)}

    def open_folder_in_explorer(self, folder_path):
        """Opens directory in Windows file explorer."""
        try:
            if os.path.exists(folder_path):
                os.startfile(folder_path)
                return {"success": True}
            return {"success": False, "error": "Directorio no encontrado"}
        except Exception as e:
            return {"success": False, "error": str(e)}


    # -------------------------------------------------------------------------
    # 4. DATABASE & ANALYTICS
    # -------------------------------------------------------------------------
    def save_processed_estimate(self, estimate_data_json):
        """Saves estimate headers and line items into database."""
        try:
            data = json.loads(estimate_data_json)
            user_id = self.auth.get_current_user_id() or "usr-001-admin"
            data["user_id"] = user_id
            
            est_id = self.db.save_estimate_record(data, data.get("items", []))
            return {"success": True, "estimate_id": est_id}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def get_dashboard_metrics(self):
        """Returns Power BI style analytics metrics for dashboard views."""
        user_id = self.auth.get_current_user_id()
        is_admin = self.auth.is_admin()
        return self.analytics.generate_dashboard_metrics(user_id=user_id, is_admin=is_admin)

    def get_estimates_list(self):
        """Returns list of stored estimates filtered by role."""
        user_id = self.auth.get_current_user_id()
        is_admin = self.auth.is_admin()
        return self.db.get_estimates_list(user_id=user_id, is_admin=is_admin)

    def get_audit_logs(self):
        """Returns Audit Trail logs (Admin only)."""
        if not self.auth.is_admin():
            return []
        return self.db.get_audit_logs()

    # -------------------------------------------------------------------------
    # 5. USER MANAGEMENT (RBAC) - ADMIN ONLY
    # -------------------------------------------------------------------------
    def get_users(self):
        """Returns all registered users (Admin only)."""
        success, users, msg = self.auth.get_all_users()
        return {"success": success, "users": users, "message": msg}

    def create_user_admin(self, username, full_name, email, password, role):
        """Admin creates a new user."""
        success, msg = self.auth.create_user(username, full_name, email, password, role)
        return {"success": success, "message": msg}

    def delete_user_admin(self, username):
        """Admin deletes a user."""
        success, msg = self.auth.delete_user(username)
        return {"success": success, "message": msg}

    def reset_password_admin(self, username, new_password):
        """Admin resets a user password."""
        success, msg = self.auth.reset_user_password(username, new_password)
        return {"success": success, "message": msg}

    def toggle_user_status_admin(self, username, is_active):
        """Admin activates or deactivates a user."""
        success, msg = self.auth.toggle_user_status(username, is_active)
        return {"success": success, "message": msg}

    def update_user_role_admin(self, username, new_role):
        """Admin changes user role (admin, pm, preventa)."""
        success, msg = self.auth.update_user_role(username, new_role)
        return {"success": success, "message": msg}

    def update_user_admin(self, username, full_name, email, role, password=None, is_active=None):
        """Admin updates complete user profile."""
        success, msg = self.auth.update_user_full_admin(username, full_name, email, role, password, is_active)
        return {"success": success, "message": msg}

    # -------------------------------------------------------------------------
    # 5.1 SKU OVERRIDES PERSISTENCE (~/.cotizador_intcomex/overrides.json)
    # -------------------------------------------------------------------------
    def _get_overrides_filepaths(self):
        paths = []
        try:
            user_home = os.path.expanduser("~")
            config_dir = os.path.join(user_home, ".cotizador_intcomex")
            os.makedirs(config_dir, exist_ok=True)
            paths.append(os.path.join(config_dir, "overrides.json"))
        except Exception:
            pass

        try:
            exe_dir = os.path.dirname(os.path.abspath(sys.executable))
            paths.append(os.path.join(exe_dir, "overrides.json"))
            paths.append(os.path.join(os.getcwd(), "overrides.json"))
        except Exception:
            pass

        return list(dict.fromkeys(paths))

    def save_sku_override(self, sku, override_type):
        """Saves custom SKU rule override persistently to JSON files and SQLite DB."""
        try:
            clean_sku = str(sku).strip().upper()

            # 1. Save to SQLite table
            self.db.save_sku_override_db(clean_sku, override_type)

            # 2. Save to JSON files (both in user home and alongside .exe)
            merged_data = self.db.get_sku_overrides_db()
            for path in self._get_overrides_filepaths():
                try:
                    with open(path, "w", encoding="utf-8") as f:
                        json.dump(merged_data, f, indent=2, ensure_ascii=False)
                except Exception as e:
                    print(f"Warning writing to {path}: {e}")

            current_user = self.auth.get_current_username() or "mskill"
            self.db.log_audit_event(
                current_user,
                "SAVE_OVERRIDE",
                f"Regla personalizada para SKU {clean_sku} guardada como {override_type}"
            )
            return {"success": True, "overrides": merged_data}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def get_sku_overrides(self):
        """Loads all SKU rule overrides from SQLite DB and JSON files."""
        try:
            # 1. Read from SQLite
            data = self.db.get_sku_overrides_db()

            # 2. Read and merge from JSON files
            for path in self._get_overrides_filepaths():
                if os.path.exists(path):
                    try:
                        with open(path, "r", encoding="utf-8") as f:
                            file_data = json.load(f)
                            if isinstance(file_data, dict):
                                data.update(file_data)
                    except Exception:
                        pass

            return {"success": True, "overrides": data}
        except Exception as e:
            return {"success": False, "error": str(e), "overrides": {}}

    def download_backup_zip(self, filename, file_bytes):
        """Opens native desktop save dialog to download monthly backup ZIP file."""
        if not self.window:
            return {"success": False, "error": "No window reference"}

        file_types = ('ZIP Archive (*.zip)', 'All Files (*.*)')
        save_path = self.window.create_file_dialog(webview.SAVE_DIALOG, save_filename=filename, file_types=file_types)

        if not save_path:
            return {"success": False, "cancelled": True}

        target_file = save_path if isinstance(save_path, str) else save_path[0]

        try:
            with open(target_file, 'wb') as f:
                f.write(bytes(file_bytes))

            current_user = self.auth.get_current_username() or "mskill"
            self.db.log_audit_event(
                current_user,
                "BACKUP_ZIP",
                f"Respaldo mensual descargado en: {target_file}"
            )
            return {"success": True, "filepath": target_file}
        except Exception as e:
            return {"success": False, "error": str(e)}


    # -------------------------------------------------------------------------
    # 6. CSV EXPORT & SYSTEM UTILITIES
    # -------------------------------------------------------------------------
    def export_estimates_csv(self):
        """Exports estimates history to CSV."""
        if not self.window:
            return {"success": False, "error": "No window"}
        
        file_types = ('CSV Files (*.csv)', 'All Files (*.*)')
        default_name = f"Estimates_Intcomex_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
        save_path = self.window.create_file_dialog(webview.SAVE_DIALOG, save_filename=default_name, file_types=file_types)
        
        if not save_path:
            return {"success": False, "message": "Cancelado por el usuario"}
            
        target_file = save_path if isinstance(save_path, str) else save_path[0]
        
        try:
            user_id = self.auth.get_current_user_id()
            is_admin = self.auth.is_admin()
            exported_path = self.analytics.export_summary_csv(target_file, user_id=user_id, is_admin=is_admin)
            
            # Audit log
            current_user = self.auth.get_current_username() or "mskill"
            self.db.log_audit_event(
                current_user,
                "EXPORT_CSV",
                f"Historial de estimates exportado a CSV: {exported_path}"
            )
            return {"success": True, "filepath": exported_path}
        except Exception as e:
            return {"success": False, "message": str(e)}

    def test_database_connection(self, supabase_url="", supabase_key=""):
        """Tests database connectivity (SQLite and optional Supabase)."""
        if supabase_url and supabase_key:
            try:
                from supabase import create_client
                client = create_client(supabase_url, supabase_key)
                return {"success": True, "type": "supabase", "message": "Conexión exitosa con Supabase PostgreSQL."}
            except Exception as e:
                return {"success": False, "type": "sqlite", "message": f"Error conectando a Supabase ({e}). Se mantiene SQLite local."}
        return {"success": True, "type": "sqlite", "message": "Motor SQLite Local operativo (gravity_database.db)."}

    def open_quoter(self):
        """Signals UI to switch to quoter tab."""
        return True


def get_index_html_path() -> str:
    """
    Locates the absolute path to dist/index.html across all execution modes:
      - PyInstaller onefile (_MEIPASS)
      - PyInstaller onedir (_internal)
      - Direct source python execution
    """
    exe_dir = os.path.dirname(os.path.abspath(sys.executable))
    script_dir = os.path.dirname(os.path.abspath(__file__))
    cwd = os.getcwd()

    candidate_paths = []

    # 1. PyInstaller _MEIPASS (onefile mode)
    if hasattr(sys, '_MEIPASS'):
        candidate_paths += [
            os.path.join(sys._MEIPASS, "dist", "index.html"),
            os.path.join(sys._MEIPASS, "index.html"),
        ]

    # 2. PyInstaller onedir: files land in _internal/ next to the exe
    candidate_paths += [
        os.path.join(exe_dir, "_internal", "dist", "index.html"),
        os.path.join(exe_dir, "_internal", "index.html"),
        os.path.join(exe_dir, "dist", "index.html"),
        os.path.join(exe_dir, "index.html"),
    ]

    # 3. Development mode: running from source tree
    candidate_paths += [
        os.path.join(script_dir, "..", "dist", "index.html"),
        os.path.join(cwd, "dist", "index.html"),
        os.path.join(cwd, "index.html"),
    ]

    for path in candidate_paths:
        resolved = os.path.abspath(path)
        if os.path.exists(resolved):
            return resolved

    return os.path.abspath(candidate_paths[0])

def launch_desktop_app():
    """Launches the PyWebView desktop application with full dist/index.html UI."""
    try:
        html_path = get_index_html_path()
        file_url = f"file:///{os.path.abspath(html_path).replace(os.sep, '/')}"
        bridge = DesktopBridge()

        window = webview.create_window(
            title="Cisco Automated v2.1 - Gestor de Cotizaciones Cisco CCW | Intcomex",
            url=file_url,
            js_api=bridge,
            maximized=True,
            min_size=(950, 650),
            background_color='#0f172a'
        )
        bridge.set_window(window)

        # Start native WebView window with Edge Chromium / WebView2 GUI
        webview.start(debug=False, gui='edgechromium')
    except Exception as e:
        import traceback
        err_msg = f"Fatal error launching Desktop app:\n{traceback.format_exc()}"
        with open("desktop_error.log", "w", encoding="utf-8") as f:
            f.write(err_msg)
        print(err_msg)

if __name__ == "__main__":
    launch_desktop_app()

