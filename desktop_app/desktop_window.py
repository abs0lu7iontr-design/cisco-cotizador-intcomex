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

    def save_bo_sku(self, part_number: str, intcomex_sku: str, base_part_number: str = ""):
        """Saves Cisco Part Number to Intcomex SKU mapping in SQLite."""
        try:
            self.db.save_bo_sku_db(part_number, intcomex_sku, base_part_number)
            return {"success": True}
        except Exception as e:
            return {"success": False, "message": str(e)}

    def get_bo_skus(self):
        """Gets all Part Number -> Intcomex SKU mappings from SQLite."""
        try:
            return self.db.get_bo_skus_db()
        except Exception as e:
            print(f"[DesktopAPI Error - get_bo_skus]: {e}")
            return {}

    # -------------------------------------------------------------------------
    # 5.2 PARTNER & GLOBAL PARAMETER PROFILES PERSISTENCE
    # -------------------------------------------------------------------------
    def _get_partner_profiles_filepaths(self):
        paths = []
        try:
            user_home = os.path.expanduser("~")
            config_dir = os.path.join(user_home, ".cotizador_intcomex")
            os.makedirs(config_dir, exist_ok=True)
            paths.append(os.path.join(config_dir, "partner_profiles.json"))
        except Exception:
            pass

        try:
            exe_dir = os.path.dirname(os.path.abspath(sys.executable))
            paths.append(os.path.join(exe_dir, "partner_profiles.json"))
            paths.append(os.path.join(os.getcwd(), "partner_profiles.json"))
        except Exception:
            pass

        return list(dict.fromkeys(paths))

    def save_partner_profiles(self, profiles_json: str):
        """Saves Partner and Global CCW parameter profiles persistently to disk."""
        try:
            data = json.loads(profiles_json) if isinstance(profiles_json, str) else profiles_json
            if not isinstance(data, dict):
                return {"success": False, "error": "Invalid profiles payload"}

            for path in self._get_partner_profiles_filepaths():
                try:
                    with open(path, "w", encoding="utf-8") as f:
                        json.dump(data, f, indent=2, ensure_ascii=False)
                except Exception as e:
                    print(f"Warning writing partner profiles to {path}: {e}")

            return {"success": True}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def get_partner_profiles(self):
        """Loads Partner and Global CCW parameter profiles from disk."""
        try:
            merged = {}
            for path in self._get_partner_profiles_filepaths():
                if os.path.exists(path):
                    try:
                        with open(path, "r", encoding="utf-8") as f:
                            file_data = json.load(f)
                            if isinstance(file_data, dict):
                                merged.update(file_data)
                    except Exception:
                        pass
            return {"success": True, "profiles": merged}
        except Exception as e:
            return {"success": False, "error": str(e), "profiles": {}}

    # -------------------------------------------------------------------------
    # 5.3 CONFIGURIATOR MULTI-AI KEYS & FAILOVER PERSISTENCE
    # -------------------------------------------------------------------------
    def _get_ai_config_filepaths(self):
        paths = []
        try:
            user_home = os.path.expanduser("~")
            config_dir = os.path.join(user_home, ".cotizador_intcomex")
            os.makedirs(config_dir, exist_ok=True)
            paths.append(os.path.join(config_dir, "ai_config.json"))
        except Exception:
            pass

        try:
            exe_dir = os.path.dirname(os.path.abspath(sys.executable))
            paths.append(os.path.join(exe_dir, "ai_config.json"))
        except Exception:
            pass

        return list(dict.fromkeys(paths))

    def save_ai_config(self, config_json: str):
        """Saves ConfigurIAtor Multi-API Key Pool configuration persistently to disk."""
        try:
            data = json.loads(config_json) if isinstance(config_json, str) else config_json
            if not isinstance(data, dict):
                return {"success": False, "error": "Invalid AI config payload"}

            for path in self._get_ai_config_filepaths():
                try:
                    with open(path, "w", encoding="utf-8") as f:
                        json.dump(data, f, indent=2, ensure_ascii=False)
                except Exception as e:
                    print(f"Warning writing AI config to {path}: {e}")

            return {"success": True}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def get_ai_config(self):
        """Loads ConfigurIAtor Multi-API Key Pool configuration from disk."""
        try:
            for path in self._get_ai_config_filepaths():
                if os.path.exists(path):
                    try:
                        with open(path, "r", encoding="utf-8") as f:
                            file_data = json.load(f)
                            if isinstance(file_data, dict):
                                return {"success": True, "config": file_data}
                    except Exception:
                        pass
            return {"success": True, "config": None}
        except Exception as e:
            return {"success": False, "error": str(e), "config": None}

    # -------------------------------------------------------------------------
    # 7. CISCO DEVELOPER API SUITE (OAUTH2 M2M & APIX GATEWAY BRIDGE)
    # -------------------------------------------------------------------------
    def get_cisco_token(
        self,
        client_id: str,
        client_secret: str,
        auth_url: str = "https://id.cisco.com/oauth2/default/v1/token",
    ):
        """Executes Server-to-Server OAuth2 Client Credentials request against Cisco Okta ID."""
        import urllib.request
        import urllib.parse
        import urllib.error

        try:
            target_url = (auth_url or "https://id.cisco.com/oauth2/default/v1/token").strip()
            payload = urllib.parse.urlencode(
                {
                    "grant_type": "client_credentials",
                    "client_id": (client_id or "").strip(),
                    "client_secret": (client_secret or "").strip(),
                }
            ).encode("utf-8")

            req = urllib.request.Request(
                target_url,
                data=payload,
                headers={
                    "Content-Type": "application/x-www-form-urlencoded",
                    "Accept": "application/json",
                    "User-Agent": "CiscoAutomated-Desktop/3.3",
                },
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=15) as resp:
                raw_body = resp.read().decode("utf-8", errors="ignore")
                return json.loads(raw_body)
        except urllib.error.HTTPError as he:
            err_body = he.read().decode("utf-8", errors="ignore")
            return {"error": f"HTTP {he.code}", "error_description": err_body}
        except Exception as e:
            return {"error": "bridge_exception", "error_description": str(e)}

    def call_cisco_api(self, url: str, token: str, method: str = "GET"):
        """Calls https://apix.cisco.com endpoints natively from Python without browser CORS restrictions."""
        import urllib.request
        import urllib.error
        import time

        start_ts = time.time()
        try:
            req = urllib.request.Request(
                url.strip(),
                headers={
                    "Authorization": f"Bearer {token.strip()}",
                    "Accept": "application/json",
                    "User-Agent": "CiscoAutomated-Desktop/3.3",
                },
                method=(method or "GET").upper(),
            )
            with urllib.request.urlopen(req, timeout=15) as resp:
                raw_body = resp.read().decode("utf-8", errors="ignore")
                latency_ms = int((time.time() - start_ts) * 1000)
                try:
                    parsed = json.loads(raw_body)
                except Exception:
                    parsed = {"raw": raw_body}
                return {
                    "success": True,
                    "httpStatus": resp.status,
                    "latencyMs": latency_ms,
                    "data": parsed,
                }
        except urllib.error.HTTPError as he:
            err_body = he.read().decode("utf-8", errors="ignore")
            latency_ms = int((time.time() - start_ts) * 1000)
            try:
                parsed = json.loads(err_body)
            except Exception:
                parsed = {"raw": err_body}
            return {
                "success": False,
                "httpStatus": he.code,
                "latencyMs": latency_ms,
                "data": parsed,
            }
        except Exception as e:
            latency_ms = int((time.time() - start_ts) * 1000)
            return {
                "success": False,
                "httpStatus": 0,
                "latencyMs": latency_ms,
                "error": str(e),
            }


def get_index_html_path() -> str:
    """
    Locates the absolute path to dist/index.html across all execution modes:
      - Direct source python execution / fresh local build
      - PyInstaller onedir (_internal)
      - PyInstaller onefile (_MEIPASS)
    If both an external dist/index.html and a bundled _MEIPASS/dist/index.html exist,
    prefers whichever file has the most recent modification timestamp.
    """
    exe_dir = os.path.dirname(os.path.abspath(sys.executable))
    script_dir = os.path.dirname(os.path.abspath(__file__))
    cwd = os.getcwd()

    external_candidates = [
        os.path.join(exe_dir, "dist", "index.html"),
        os.path.join(exe_dir, "..", "dist", "index.html"),
        os.path.join(script_dir, "..", "dist", "index.html"),
        os.path.join(cwd, "dist", "index.html"),
        os.path.join(exe_dir, "_internal", "dist", "index.html"),
        os.path.join(exe_dir, "_internal", "index.html"),
        os.path.join(exe_dir, "index.html"),
        os.path.join(cwd, "index.html"),
    ]

    bundled_candidates = []
    if hasattr(sys, '_MEIPASS'):
        bundled_candidates += [
            os.path.join(sys._MEIPASS, "dist", "index.html"),
            os.path.join(sys._MEIPASS, "index.html"),
        ]

    existing_external = [os.path.abspath(p) for p in external_candidates if os.path.exists(os.path.abspath(p))]
    existing_bundled = [os.path.abspath(p) for p in bundled_candidates if os.path.exists(os.path.abspath(p))]

    if existing_external and existing_bundled:
        best_ext = max(existing_external, key=lambda p: os.path.getmtime(p))
        best_bun = max(existing_bundled, key=lambda p: os.path.getmtime(p))
        return best_ext if os.path.getmtime(best_ext) >= os.path.getmtime(best_bun) else best_bun

    if existing_external:
        return max(existing_external, key=lambda p: os.path.getmtime(p))

    if existing_bundled:
        return existing_bundled[0]

    fallback = bundled_candidates[0] if bundled_candidates else external_candidates[0]
    return os.path.abspath(fallback)

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

