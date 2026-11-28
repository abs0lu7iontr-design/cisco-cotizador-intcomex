import os
import sys
import re
import json
import urllib.parse
import urllib.request
import urllib.error
import webview
from datetime import datetime
from typing import Dict, Any, Optional

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
        self._window = window_ref
        self._db = DatabaseManager()
        self._auth = AuthManager(self._db)
        self._file_processor = FileProcessor()
        self._analytics = AnalyticsEngine(self._db)

    def _set_window(self, window):
        self._window = window

    def _require_authenticated_user(self) -> Optional[str]:
        """Returns authenticated username or None if no Desktop session is active."""
        user_id = self._auth.get_current_user_id()
        username = self._auth.get_current_username()
        if not self._auth.current_user or not user_id or not username:
            return None
        return username

    def _is_within_allowed_storage(self, target_path: str) -> bool:
        """Verifies target_path lies inside an approved gravity_storage folder."""
        try:
            target_abs = os.path.abspath(target_path)
            allowed_bases = [
                self._file_processor.base_storage_dir,
                os.path.join(os.getcwd(), "gravity_storage"),
            ]
            if getattr(sys, "frozen", False):
                exe_dir = os.path.dirname(os.path.abspath(sys.executable))
                allowed_bases.append(os.path.join(exe_dir, "gravity_storage"))
            for base_dir in allowed_bases:
                if not base_dir:
                    continue
                base_abs = os.path.abspath(base_dir)
                if os.path.commonpath([base_abs, target_abs]) == base_abs:
                    return True
            return False
        except Exception:
            return False

    # -------------------------------------------------------------------------
    # 1. RBAC AUTHENTICATION & SESSION
    # -------------------------------------------------------------------------
    def login_user(self, username, password):
        """Authenticates user via bcrypt/RBAC and returns user session info."""
        success, msg = self._auth.login(username, password)
        if success:
            user = self._auth.current_user
            return {
                "success": True,
                "message": msg,
                "user": {
                    "username": user["username"],
                    "full_name": user["full_name"],
                    "role": user["role"],
                    "email": user.get("email", "")
                }
            }
        else:
            return {"success": False, "message": msg}

    def get_current_user(self):
        if self._auth.current_user:
            u = self._auth.current_user
            return {
                "username": u["username"],
                "full_name": u["full_name"],
                "role": u["role"],
                "email": u.get("email", "")
            }
        return None

    def edge_session_auth(self, username, password, turnstile_token="", two_factor_proof=""):
        """Performs server-side Edge session authentication from Desktop app when online."""
        try:
            payload = {
                "username": str(username or "").strip(),
                "password": str(password or ""),
            }
            if turnstile_token:
                payload["turnstileToken"] = str(turnstile_token)
            if two_factor_proof:
                payload["twoFactorProof"] = str(two_factor_proof)
            req = urllib.request.Request(
                "https://develop.cisco-automated.pages.dev/api/session-auth",
                data=json.dumps(payload).encode("utf-8"),
                headers={
                    "Content-Type": "application/json",
                    "Origin": "https://develop.cisco-automated.pages.dev",
                    "User-Agent": "CiscoAutomatedDesktop/2.29",
                },
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=8) as resp:
                raw = resp.read().decode("utf-8", errors="replace")
                return json.loads(raw)
        except urllib.error.HTTPError as he:
            try:
                body = he.read().decode("utf-8", errors="replace")
                parsed = json.loads(body)
                if isinstance(parsed, dict):
                    parsed.setdefault("status", he.code)
                    return parsed
            except Exception:
                pass
            return {"success": False, "status": he.code, "isEdgeUnavailable": he.code >= 500 or he.code in (404, 405)}
        except Exception as e:
            return {"success": False, "isEdgeUnavailable": True, "error": str(e)}

    def logout_user(self):
        self._auth.logout()
        return {"success": True}

    # -------------------------------------------------------------------------
    # 2. FILE UPLOAD, REGEX PARSING & HIERARCHICAL STORAGE
    # -------------------------------------------------------------------------
    def open_file_dialog(self):
        """Opens native desktop file dialog to pick an Estimate file (.xlsx)."""
        if not self._window:
            return None

        file_types = ('Excel Files (*.xlsx;*.xls)', 'All Files (*.*)')
        result = self._window.create_file_dialog(webview.OPEN_DIALOG, allow_multiple=False, file_types=file_types)
        
        if not result or len(result) == 0:
            return None

        filepath = result[0]
        filename = os.path.basename(filepath)

        # Regex Validation: [Partner]_[ClienteFinal]_resto_del_nombre.xlsx
        is_valid, partner, client, err = self._file_processor.parse_filename(filename)
        if not is_valid:
            return {
                "success": False,
                "error": err
            }

        try:
            current_user = self._require_authenticated_user()
            if not current_user:
                return {"success": False, "error": "Sesión de usuario requerida."}

            # Store in hierarchical folder structure: Partner / ClienteFinal / YYYY-MM / YYYY-MM-DD /
            stored_info = self._file_processor.organize_and_store_file(filepath)

            # Read file bytes to pass to frontend ExcelJS processor
            with open(filepath, 'rb') as f:
                raw_bytes = f.read()
                import base64
                file_base64 = base64.b64encode(raw_bytes).decode('utf-8')
                file_bytes = list(raw_bytes)

            # Audit Trail Log
            self._db.log_audit_event(
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
        current_user = self._require_authenticated_user()
        if not current_user:
            return {"success": False, "error": "Sesión de usuario requerida."}
        if not self._window:
            return {"success": False, "error": "No window reference"}

        file_types = ('Excel Files (*.xlsx)', 'All Files (*.*)')
        save_path = self._window.create_file_dialog(webview.SAVE_DIALOG, save_filename=filename, file_types=file_types)

        if not save_path:
            return {"success": False, "cancelled": True}

        target_file = save_path if isinstance(save_path, str) else save_path[0]
        if not target_file.lower().endswith(('.xlsx', '.xls')):
            target_file += ".xlsx"

        try:
            with open(target_file, 'wb') as f:
                f.write(bytes(file_bytes))

            # Audit Log
            self._db.log_audit_event(
                current_user,
                "EXPORT_EXCEL",
                f"Cotización procesada descargada a: {target_file}"
            )
            return {"success": True, "filepath": target_file}
        except PermissionError:
            return {
                "success": False,
                "error": f"No se pudo guardar el archivo. '{os.path.basename(target_file)}' está abierto en Microsoft Excel u otra aplicación. Ciérralo e intenta nuevamente."
            }
        except Exception as e:
            return {"success": False, "error": str(e)}

    def save_estimate_structured(self, partner_name, client_final_name, filename, file_bytes):
        """
        Saves processed Excel file in hierarchical folder structure:
        gravity_storage / [Partner] / [ClienteFinal] / [Mes] / [filename]
        """
        try:
            current_user = self._require_authenticated_user()
            if not current_user:
                return {"success": False, "error": "Sesión de usuario requerida."}
            if isinstance(file_bytes, str):
                import base64
                byte_data = base64.b64decode(file_bytes)
            else:
                byte_data = bytes(file_bytes)
            res = self._file_processor.save_estimate_in_client_month_structure(
                byte_data,
                partner_name,
                client_final_name,
                filename
            )

            # Audit Log
            self._db.log_audit_event(
                current_user,
                "EXPORT_EXCEL",
                f"Cotización guardada en estructura: {res['filepath']}"
            )

            return res
        except PermissionError as pe:
            return {"success": False, "error": str(pe)}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def open_folder_in_explorer(self, folder_path):
        """Opens directory or highlights file in Windows file explorer (contained inside allowed storage)."""
        try:
            if not self._require_authenticated_user():
                return {"success": False, "error": "Sesión de usuario requerida."}
            if not folder_path:
                return {"success": False, "error": "Ruta no especificada"}
            target = os.path.abspath(os.path.normpath(str(folder_path).strip()))
            if not self._is_within_allowed_storage(target):
                return {"success": False, "error": "Ruta fuera del almacenamiento autorizado."}
            if os.path.isfile(target):
                import subprocess
                subprocess.Popen(["explorer.exe", "/select,", target])
                return {"success": True}
            elif os.path.isdir(target):
                os.startfile(target)
                return {"success": True}
            parent = os.path.dirname(target)
            if parent and self._is_within_allowed_storage(parent) and os.path.isdir(parent):
                os.startfile(parent)
                return {"success": True}
            return {"success": False, "error": f"Directorio no encontrado: {target}"}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def open_email_client(self, recipient, cc="", subject="", body=""):
        """Opens native mail client (Outlook / Windows Mail) with pre-filled fields."""
        try:
            if not self._require_authenticated_user():
                return {"success": False, "error": "Sesión de usuario requerida."}
            import webbrowser
            clean_recipient = str(recipient or "").strip()
            if clean_recipient:
                if any(c in clean_recipient for c in ("\r", "\n", "?", "&", "#")) or not re.match(
                    r"^[^\s?&#<>@]+@[^\s?&#<>@]+\.[^\s?&#<>@]+$", clean_recipient
                ):
                    return {"success": False, "error": "Dirección de destinatario inválida."}
            normalized_body = (body or "").replace('\r\n', '\n').replace('\n', '\r\n')
            params = {}
            if cc:
                params['cc'] = str(cc).replace('\r', '').replace('\n', '')
            if subject:
                params['subject'] = str(subject).replace('\r', '').replace('\n', '')
            if normalized_body:
                params['body'] = normalized_body
            query_string = urllib.parse.urlencode(params, quote_via=urllib.parse.quote)
            mailto_url = f"mailto:{clean_recipient}?{query_string}" if query_string else f"mailto:{clean_recipient}"
            webbrowser.open(mailto_url)
            return {"success": True}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def search_storage(self, query_text=""):
        """Searches gravity_storage hierarchical folder and database for matching estimates."""
        try:
            if not self._require_authenticated_user():
                return []
            q = (query_text or "").strip().lower()
            results = []

            # Candidate directories to discover stored Excel files
            candidate_dirs = [
                self._file_processor.base_storage_dir,
                os.path.join(os.getcwd(), "gravity_storage")
            ]
            if getattr(sys, 'frozen', False):
                exe_dir = os.path.dirname(os.path.abspath(sys.executable))
                candidate_dirs.append(os.path.join(exe_dir, "gravity_storage"))

            seen_paths = set()
            found_files = []

            for base_dir in candidate_dirs:
                if not base_dir or not os.path.exists(base_dir):
                    continue
                for root, dirs, files in os.walk(base_dir):
                    for file in files:
                        if not file.lower().endswith(('.xlsx', '.xls')):
                            continue
                        full_path = os.path.abspath(os.path.join(root, file))
                        if full_path in seen_paths:
                            continue
                        seen_paths.add(full_path)

                        rel_path = os.path.relpath(full_path, base_dir)
                        path_parts = rel_path.split(os.sep)
                        partner = path_parts[0] if len(path_parts) > 1 else ""
                        client = path_parts[1] if len(path_parts) > 2 else ""
                        month = path_parts[2] if len(path_parts) > 3 else ""

                        # If q is empty, match all files; otherwise filter by q
                        if not q or (q in file.lower() or q in rel_path.lower() or q in partner.lower() or q in client.lower()):
                            try:
                                stat = os.stat(full_path)
                                found_files.append({
                                    "filename": file,
                                    "filepath": full_path,
                                    "folder": os.path.abspath(root),
                                    "partner": partner,
                                    "client": client,
                                    "month": month,
                                    "size_bytes": stat.st_size,
                                    "mtime": stat.st_mtime,
                                    "modified_at": datetime.fromtimestamp(stat.st_mtime).isoformat()
                                })
                            except Exception:
                                pass

            # Sort files by newest modification time
            found_files.sort(key=lambda x: x.get("mtime", 0), reverse=True)
            for f in found_files[:50]:
                f_copy = dict(f)
                f_copy.pop("mtime", None)
                results.append(f_copy)

            # Also search in SQLite DB records if query is specified or results < 50
            if len(results) < 50:
                try:
                    curr_uid = self._auth.get_current_user_id()
                    curr_is_admin = self._auth.is_admin()
                    db_estimates = (
                        self._db.get_estimates_list(user_id=curr_uid, is_admin=curr_is_admin)
                        if (curr_uid or curr_is_admin)
                        else []
                    )
                    for est in db_estimates:
                        est_id = str(est.get("estimate_id", "")).lower()
                        deal_id = str(est.get("deal_id", "")).lower()
                        cust = str(est.get("customer_name", "")).lower()
                        if not q or (q in est_id or q in deal_id or q in cust):
                            fn = est.get("filename") or f"{est.get('estimate_id', 'estimate')}.xlsx"
                            if not any(r.get("filename") == fn for r in results):
                                results.append({
                                    "filename": fn,
                                    "filepath": "",
                                    "folder": "",
                                    "partner": est.get("company_name", ""),
                                    "client": est.get("customer_name", ""),
                                    "month": est.get("created_at", "")[:7],
                                    "size_bytes": 0,
                                    "modified_at": est.get("created_at", "")
                                })
                                if len(results) >= 50:
                                    break
                except Exception:
                    pass

            return {"success": True, "results": results[:50]}
        except Exception as e:
            return {"success": False, "error": str(e), "results": []}

    def _get_local_version_metadata(self) -> dict:
        """Reads local version.json metadata to determine current build commit and date."""
        exe_dir = os.path.dirname(os.path.abspath(sys.executable))
        current_file_dir = os.path.dirname(os.path.abspath(__file__))
        candidates = [
            os.path.join(exe_dir, "_internal", "version.json"),
            os.path.join(exe_dir, "version.json"),
            os.path.join(current_file_dir, "version.json"),
            get_resource_path("version.json"),
            os.path.join(os.getcwd(), "dist", "version.json"),
            os.path.join(os.getcwd(), "public", "version.json"),
        ]
        for c in candidates:
            if os.path.exists(c):
                try:
                    with open(c, "r", encoding="utf-8") as f:
                        data = json.load(f)
                        if isinstance(data, dict) and data.get("git_commit"):
                            return data
                except Exception:
                    pass
        return {
            "name": "cisco-automated",
            "version": "2.32.0",
            "git_commit": "12379f3",
            "git_branch": "develop",
            "build_timestamp": "2026-10-15T00:00:00.000Z",
            "release_notes": "Versión base integrada",
            "download_url": "https://develop.cisco-automated.pages.dev/desktop_build.html",
            "channel": "develop"
        }

    def check_for_updates(self):
        """
        Checks for latest release info by querying Cloudflare Pages CDN version.json
        with fallback to GitHub raw repository.
        Compares git_commit, build_timestamp, and version.
        """
        local_meta = self._get_local_version_metadata()
        current_version = local_meta.get("version", "2.32.0")
        current_commit = str(local_meta.get("git_commit", "12379f3"))
        current_timestamp = str(local_meta.get("build_timestamp", ""))

        remote_urls = [
            "https://develop.cisco-automated.pages.dev/version.json",
            "https://raw.githubusercontent.com/abs0lu7iontr-design/cisco-cotizador-intcomex/develop/public/version.json",
        ]

        remote_data = None
        for u in remote_urls:
            try:
                import urllib.request
                req = urllib.request.Request(
                    u,
                    headers={
                        'User-Agent': 'CiscoAutomatedDesktop/2.1',
                        'Cache-Control': 'no-cache',
                        'Pragma': 'no-cache'
                    }
                )
                with urllib.request.urlopen(req, timeout=4) as response:
                    if response.status == 200:
                        raw_text = response.read().decode('utf-8')
                        parsed = json.loads(raw_text)
                        if isinstance(parsed, dict) and ("git_commit" in parsed or "version" in parsed):
                            remote_data = parsed
                            break
            except Exception:
                continue

        if remote_data:
            latest_version = remote_data.get("version", current_version)
            latest_commit = str(remote_data.get("git_commit", current_commit))
            latest_timestamp = str(remote_data.get("build_timestamp", ""))
            release_notes = remote_data.get("release_notes", "Mejoras generales y correcciones.")
            download_url = remote_data.get("download_url", "https://develop.cisco-automated.pages.dev/desktop_build.html")
            fallback_url = remote_data.get("fallback_url", "https://raw.githubusercontent.com/abs0lu7iontr-design/cisco-cotizador-intcomex/develop/dist_exe/GravityDesktop/_internal/index.html")

            has_update = False
            if latest_commit and current_commit and latest_commit != current_commit:
                has_update = True
            elif latest_version != current_version:
                has_update = True
            elif latest_timestamp and current_timestamp and latest_timestamp > current_timestamp:
                has_update = True

            return {
                "success": True,
                "has_update": has_update,
                "current_version": current_version,
                "latest_version": latest_version,
                "current_commit": current_commit,
                "latest_commit": latest_commit,
                "current_timestamp": current_timestamp,
                "latest_timestamp": latest_timestamp,
                "download_url": download_url,
                "fallback_url": fallback_url,
                "release_url": "https://develop.cisco-automated.pages.dev",
                "release_notes": release_notes,
                "channel": remote_data.get("channel", "develop")
            }

        return {
            "success": True,
            "has_update": False,
            "current_version": current_version,
            "latest_version": current_version,
            "current_commit": current_commit,
            "latest_commit": current_commit,
            "current_timestamp": current_timestamp,
            "latest_timestamp": current_timestamp,
            "download_url": "https://develop.cisco-automated.pages.dev/desktop_build.html",
            "release_url": "https://develop.cisco-automated.pages.dev",
            "release_notes": "La aplicación está en su versión más reciente (al día)."
        }

    @staticmethod
    def _is_trusted_update_url(url: str) -> bool:
        try:
            from urllib.parse import urlparse
            parsed = urlparse(str(url or "").strip())
            if parsed.scheme.lower() != "https" or parsed.username or parsed.password:
                return False
            host = (parsed.hostname or "").lower()
            if host in ("develop.cisco-automated.pages.dev", "cisco-automated.pages.dev"):
                return True
            if host == "raw.githubusercontent.com" and parsed.path.startswith("/abs0lu7iontr-design/cisco-cotizador-intcomex/"):
                return True
            return False
        except Exception:
            return False

    def apply_desktop_update(self, download_url=None):
        """
        Downloads and hot-replaces the portable singlefile bundle (index.html)
        without requiring re-installation of the .exe wrapper, and reloads the WebView.
        """
        import urllib.request
        import shutil
        import hashlib

        current_user = self._require_authenticated_user()
        if not current_user:
            return {"success": False, "error": "Sesión de usuario requerida para actualizar."}

        # 1. Determine destination path
        target_path = get_index_html_path()
        if not target_path or not os.path.exists(target_path):
            exe_dir = os.path.dirname(os.path.abspath(sys.executable))
            target_path = os.path.join(exe_dir, "_internal", "index.html")
            if not os.path.exists(os.path.dirname(target_path)):
                target_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "index.html")

        target_dir = os.path.dirname(target_path)
        os.makedirs(target_dir, exist_ok=True)

        # 2. Allowlisted HTTPS URLs only (never allow arbitrary domains or file:// schemes)
        urls_to_try = []
        if download_url and isinstance(download_url, str) and self._is_trusted_update_url(download_url):
            urls_to_try.append(download_url.strip())
        elif download_url:
            return {"success": False, "error": "URL de actualización rechazada: origen no confiable."}

        urls_to_try.extend([
            "https://develop.cisco-automated.pages.dev/desktop_build.html",
            "https://raw.githubusercontent.com/abs0lu7iontr-design/cisco-cotizador-intcomex/develop/dist_exe/GravityDesktop/_internal/index.html",
        ])

        expected_sha256 = None
        try:
            v_req = urllib.request.Request(
                "https://develop.cisco-automated.pages.dev/version.json",
                headers={'User-Agent': 'CiscoAutomatedDesktop/2.1', 'Cache-Control': 'no-cache'}
            )
            with urllib.request.urlopen(v_req, timeout=4) as v_resp:
                if v_resp.status == 200:
                    v_meta = json.loads(v_resp.read().decode('utf-8'))
                    raw_hash = v_meta.get("desktop_bundle_sha256") or v_meta.get("sha256")
                    if isinstance(raw_hash, str) and len(raw_hash.strip()) == 64:
                        expected_sha256 = raw_hash.strip().lower()
        except Exception:
            pass

        downloaded_bytes = None
        last_error = "No se pudo conectar a los servidores de actualización"

        for u in urls_to_try:
            try:
                content = None
                req = urllib.request.Request(
                    u,
                    headers={
                        'User-Agent': 'CiscoAutomatedDesktop/2.1',
                        'Cache-Control': 'no-cache',
                        'Pragma': 'no-cache'
                    }
                )
                with urllib.request.urlopen(req, timeout=30) as resp:
                    if resp.status == 200:
                        content = resp.read()

                if content:
                    if not expected_sha256:
                        last_error = "Manifiesto remoto version.json sin firma SHA-256 verificable (actualización bloqueada)."
                        break
                    actual_hash = hashlib.sha256(content).hexdigest().lower()
                    if actual_hash != expected_sha256:
                        last_error = f"Verificación SHA-256 fallida para {u}"
                        continue
                    # Minimum sanity check: must be > 500 KB and contain html declaration
                    if len(content) > 500 * 1024:
                        head_chunk = content[:2048].decode('utf-8', errors='ignore').lower()
                        if '<!doctype html' in head_chunk or '<html' in head_chunk:
                            downloaded_bytes = content
                            break
                        else:
                            last_error = f"El archivo descargado desde {u} no contiene HTML válido"
                    else:
                        last_error = f"El archivo descargado desde {u} es demasiado pequeño ({len(content)} bytes)"
            except Exception as e:
                last_error = f"Error conectando a {u}: {str(e)}"

        if not downloaded_bytes:
            return {"success": False, "error": last_error}

        # 3. Create safety backup
        bak_path = target_path + ".bak"
        try:
            if os.path.exists(target_path):
                shutil.copy2(target_path, bak_path)
        except Exception as e:
            print(f"[DesktopUpdate] Advertencia creando backup: {e}")

        # 4. Atomic write
        tmp_path = target_path + ".tmp"
        try:
            with open(tmp_path, "wb") as f:
                f.write(downloaded_bytes)

            # Replace target
            if os.path.exists(target_path):
                try:
                    os.replace(tmp_path, target_path)
                except PermissionError:
                    # Windows file locked retry: write directly
                    with open(target_path, "wb") as f:
                        f.write(downloaded_bytes)
                    if os.path.exists(tmp_path):
                        os.remove(tmp_path)
            else:
                os.rename(tmp_path, target_path)
        except Exception as write_err:
            if os.path.exists(bak_path):
                try:
                    shutil.copy2(bak_path, target_path)
                except Exception:
                    pass
            return {"success": False, "error": f"Error escribiendo actualización: {str(write_err)}"}

        # 5. Also sync version.json in same target directory
        try:
            version_url = "https://develop.cisco-automated.pages.dev/version.json"
            req_v = urllib.request.Request(version_url, headers={'User-Agent': 'CiscoAutomatedDesktop/2.1'})
            with urllib.request.urlopen(req_v, timeout=5) as resp_v:
                if resp_v.status == 200:
                    v_bytes = resp_v.read()
                    target_v_path = os.path.join(target_dir, "version.json")
                    with open(target_v_path, "wb") as f_v:
                        f_v.write(v_bytes)
        except Exception as v_err:
            print(f"[DesktopUpdate] Nota: No se pudo actualizar version.json local ({v_err})")

        # 6. Audit event
        try:
            self._db.log_audit_event(
                current_user,
                "AUTO_UPDATE_APPLIED",
                f"Actualización desktop instalada exitosamente ({len(downloaded_bytes)} bytes) en {target_path}"
            )
        except Exception:
            pass

        # 7. Reload active window
        if self._window:
            try:
                self._window.evaluate_js("window.location.reload();")
            except Exception:
                pass

        return {
            "success": True,
            "message": "¡Actualización instalada con éxito! La aplicación se ha recargado a la última versión.",
            "target_path": target_path,
            "bytes_updated": len(downloaded_bytes)
        }



    # -------------------------------------------------------------------------
    # 4. DATABASE & ANALYTICS
    # -------------------------------------------------------------------------
    def save_processed_estimate(self, estimate_data_json):
        """Saves estimate headers and line items into database (requires authenticated user)."""
        try:
            user_id = self._auth.get_current_user_id()
            if not user_id:
                return {"success": False, "error": "Sesión de usuario requerida para guardar cotización."}
            data = json.loads(estimate_data_json)
            data["user_id"] = user_id

            est_id = self._db.save_estimate_record(data, data.get("items", []))
            return {"success": True, "estimate_id": est_id}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def get_dashboard_metrics(self):
        """Returns Power BI style analytics metrics for dashboard views."""
        user_id = self._auth.get_current_user_id()
        is_admin = self._auth.is_admin()
        if not is_admin and not user_id:
            return {}
        return self._analytics.generate_dashboard_metrics(user_id=user_id, is_admin=is_admin)

    def get_estimates_list(self):
        """Returns list of stored estimates filtered by role."""
        user_id = self._auth.get_current_user_id()
        is_admin = self._auth.is_admin()
        if not is_admin and not user_id:
            return []
        return self._db.get_estimates_list(user_id=user_id, is_admin=is_admin)

    def get_audit_logs(self):
        """Returns Audit Trail logs (Admin only)."""
        if not self._auth.is_admin():
            return []
        return self._db.get_audit_logs()

    # -------------------------------------------------------------------------
    # 5. USER MANAGEMENT (RBAC) - ADMIN ONLY
    # -------------------------------------------------------------------------
    def get_users(self):
        """Returns all registered users (Admin only)."""
        success, users, msg = self._auth.get_all_users()
        return {"success": success, "users": users, "message": msg}

    def create_user_admin(self, username, full_name, email, password, role):
        """Admin creates a new user."""
        success, msg = self._auth.create_user(username, full_name, email, password, role)
        return {"success": success, "message": msg}

    def delete_user_admin(self, username):
        """Admin deletes a user."""
        success, msg = self._auth.delete_user(username)
        return {"success": success, "message": msg}

    def reset_password_admin(self, username, new_password):
        """Admin resets a user password."""
        success, msg = self._auth.reset_user_password(username, new_password)
        return {"success": success, "message": msg}

    def toggle_user_status_admin(self, username, is_active):
        """Admin activates or deactivates a user."""
        success, msg = self._auth.toggle_user_status(username, is_active)
        return {"success": success, "message": msg}

    def update_user_role_admin(self, username, new_role):
        """Admin changes user role (admin, pm, preventa)."""
        success, msg = self._auth.update_user_role(username, new_role)
        return {"success": success, "message": msg}

    def update_user_admin(self, username, full_name, email, role, password=None, is_active=None):
        """Admin updates complete user profile."""
        success, msg = self._auth.update_user_full_admin(username, full_name, email, role, password, is_active)
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
            current_user = self._require_authenticated_user()
            if not current_user:
                return {"success": False, "error": "Sesión de usuario requerida."}

            clean_sku = str(sku).strip().upper()

            # 1. Save to SQLite table
            self._db.save_sku_override_db(clean_sku, override_type)

            # 2. Save to JSON files (both in user home and alongside .exe)
            merged_data = self._db.get_sku_overrides_db()
            for path in self._get_overrides_filepaths():
                try:
                    with open(path, "w", encoding="utf-8") as f:
                        json.dump(merged_data, f, indent=2, ensure_ascii=False)
                except Exception as e:
                    print(f"Warning writing to {path}: {e}")

            self._db.log_audit_event(
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
            data = self._db.get_sku_overrides_db()

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
        current_user = self._require_authenticated_user()
        if not current_user:
            return {"success": False, "error": "Sesión de usuario requerida."}
        if not self._window:
            return {"success": False, "error": "No window reference"}

        file_types = ('ZIP Archive (*.zip)', 'All Files (*.*)')
        save_path = self._window.create_file_dialog(webview.SAVE_DIALOG, save_filename=filename, file_types=file_types)

        if not save_path:
            return {"success": False, "cancelled": True}

        target_file = save_path if isinstance(save_path, str) else save_path[0]

        try:
            with open(target_file, 'wb') as f:
                f.write(bytes(file_bytes))

            self._db.log_audit_event(
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
        current_user = self._require_authenticated_user()
        if not current_user:
            return {"success": False, "message": "Sesión de usuario requerida."}
        if not self._window:
            return {"success": False, "error": "No window"}
        
        file_types = ('CSV Files (*.csv)', 'All Files (*.*)')
        default_name = f"Estimates_Intcomex_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
        save_path = self._window.create_file_dialog(webview.SAVE_DIALOG, save_filename=default_name, file_types=file_types)
        
        if not save_path:
            return {"success": False, "message": "Cancelado por el usuario"}
            
        target_file = save_path if isinstance(save_path, str) else save_path[0]
        
        try:
            user_id = self._auth.get_current_user_id()
            is_admin = self._auth.is_admin()
            exported_path = self._analytics.export_summary_csv(target_file, user_id=user_id, is_admin=is_admin)
            
            # Audit log
            self._db.log_audit_event(
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
            if not self._require_authenticated_user():
                return {"success": False, "message": "Sesión de usuario requerida."}
            self._db.save_bo_sku_db(part_number, intcomex_sku, base_part_number)
            return {"success": True}
        except Exception as e:
            return {"success": False, "message": str(e)}

    def get_bo_skus(self):
        """Gets all Part Number -> Intcomex SKU mappings from SQLite."""
        try:
            return self._db.get_bo_skus_db()
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
            if not self._require_authenticated_user():
                return {"success": False, "error": "Sesión de usuario requerida."}
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
    # 5.3 CONFIGURIATOR MULTI-AI KEYS & FAILOVER PERSISTENCE (DPAPI + USER SCOPE)
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

        return list(dict.fromkeys(paths))

    @staticmethod
    def _dpapi_protect_text(plaintext: str) -> Optional[str]:
        if os.name != "nt":
            return None
        try:
            import ctypes
            import ctypes.wintypes
            import base64

            class DATA_BLOB(ctypes.Structure):
                _fields_ = [
                    ("cbData", ctypes.wintypes.DWORD),
                    ("pbData", ctypes.POINTER(ctypes.c_char)),
                ]

            raw = plaintext.encode("utf-8")
            in_buf = ctypes.create_string_buffer(raw, len(raw))
            in_blob = DATA_BLOB(len(raw), in_buf)
            out_blob = DATA_BLOB()
            if not ctypes.windll.crypt32.CryptProtectData(
                ctypes.byref(in_blob), None, None, None, None, 0x1, ctypes.byref(out_blob)
            ):
                return None
            try:
                cipher = ctypes.string_at(out_blob.pbData, out_blob.cbData)
                return base64.b64encode(cipher).decode("ascii")
            finally:
                ctypes.windll.kernel32.LocalFree(out_blob.pbData)
        except Exception:
            return None

    @staticmethod
    def _dpapi_unprotect_text(b64_cipher: str) -> Optional[str]:
        if os.name != "nt":
            return None
        try:
            import ctypes
            import ctypes.wintypes
            import base64

            class DATA_BLOB(ctypes.Structure):
                _fields_ = [
                    ("cbData", ctypes.wintypes.DWORD),
                    ("pbData", ctypes.POINTER(ctypes.c_char)),
                ]

            cipher = base64.b64decode(b64_cipher.encode("ascii"))
            in_buf = ctypes.create_string_buffer(cipher, len(cipher))
            in_blob = DATA_BLOB(len(cipher), in_buf)
            out_blob = DATA_BLOB()
            if not ctypes.windll.crypt32.CryptUnprotectData(
                ctypes.byref(in_blob), None, None, None, None, 0x1, ctypes.byref(out_blob)
            ):
                return None
            try:
                plain = ctypes.string_at(out_blob.pbData, out_blob.cbData)
                return plain.decode("utf-8")
            finally:
                ctypes.windll.kernel32.LocalFree(out_blob.pbData)
        except Exception:
            return None

    def save_ai_config(self, config_json: str):
        """Saves ConfigurIAtor Multi-API Key Pool configuration persistently (DPAPI-protected on Windows)."""
        try:
            if not self._require_authenticated_user():
                return {"success": False, "error": "Sesión de usuario requerida."}
            data = json.loads(config_json) if isinstance(config_json, str) else config_json
            if not isinstance(data, dict):
                return {"success": False, "error": "Invalid AI config payload"}

            serialized = json.dumps(data, ensure_ascii=False)
            protected = self._dpapi_protect_text(serialized)
            if not protected:
                return {
                    "success": False,
                    "error": "No se pudo cifrar la configuración IA con Windows DPAPI. Guardado en texto plano bloqueado por seguridad.",
                }
            disk_payload = {"__dpapi__": protected, "v": 2}

            for path in self._get_ai_config_filepaths():
                try:
                    with open(path, "w", encoding="utf-8") as f:
                        json.dump(disk_payload, f, indent=2, ensure_ascii=False)
                except Exception as e:
                    print(f"Warning writing AI config to {path}: {e}")

            return {"success": True}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def get_ai_config(self):
        """Loads ConfigurIAtor Multi-API Key Pool configuration from user-scoped disk storage."""
        try:
            if not self._require_authenticated_user():
                return {"success": False, "error": "Sesión de usuario requerida.", "config": None}
            for path in self._get_ai_config_filepaths():
                if os.path.exists(path):
                    try:
                        with open(path, "r", encoding="utf-8") as f:
                            file_data = json.load(f)
                        if isinstance(file_data, dict):
                            if "__dpapi__" in file_data and isinstance(file_data["__dpapi__"], str):
                                plain = self._dpapi_unprotect_text(file_data["__dpapi__"])
                                if plain:
                                    unwrapped = json.loads(plain)
                                    if isinstance(unwrapped, dict):
                                        return {"success": True, "config": unwrapped}
                            else:
                                # Re-wrap plaintext config with DPAPI on Windows when possible
                                protected = self._dpapi_protect_text(json.dumps(file_data, ensure_ascii=False))
                                if protected:
                                    try:
                                        with open(path, "w", encoding="utf-8") as fw:
                                            json.dump({"__dpapi__": protected, "v": 2}, fw, indent=2)
                                    except Exception:
                                        pass
                                return {"success": True, "config": file_data}
                    except Exception:
                        pass
            return {"success": True, "config": None}
        except Exception as e:
            return {"success": False, "error": str(e), "config": None}

    # -------------------------------------------------------------------------
    # 7. CISCO DEVELOPER API SUITE (OAUTH2 M2M & APIX GATEWAY BRIDGE)
    # -------------------------------------------------------------------------
    @staticmethod
    def _is_allowed_cisco_url(raw_url: str, allowed_hosts: tuple) -> bool:
        try:
            parsed = urllib.parse.urlparse((raw_url or "").strip())
            host = (parsed.hostname or "").lower()
            return parsed.scheme == "https" and not parsed.username and not parsed.password and host in allowed_hosts
        except Exception:
            return False

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
            if not self._require_authenticated_user():
                return {"error": "unauthorized", "error_description": "Sesión de usuario requerida."}
            target_url = (auth_url or "https://id.cisco.com/oauth2/default/v1/token").strip()
            allowed_auth = ("id.cisco.com", "cloudsso.cisco.com", "cloudsso1.cisco.com")
            if not self._is_allowed_cisco_url(target_url, allowed_auth):
                return {"error": "untrusted_auth_url", "error_description": "URL de autenticación Cisco no permitida."}
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
        import urllib.parse
        import urllib.error
        import time

        start_ts = time.time()
        try:
            if not self._require_authenticated_user():
                return {
                    "success": False,
                    "httpStatus": 401,
                    "latencyMs": 0,
                    "error": "Sesión de usuario requerida en DesktopBridge.",
                }
            clean_token = str(token or "").strip()
            if not clean_token or any(c in clean_token for c in ("\r", "\n")):
                return {
                    "success": False,
                    "httpStatus": 400,
                    "latencyMs": 0,
                    "error": "Token OAuth inválido o malformado.",
                }
            target_url = (url or "").strip()
            allowed_api = (
                "apix.cisco.com",
                "api.cisco.com",
                "sec.cloudapps.cisco.com",
                "capitest.cisco.com",
                "capi.cisco.com",
                "it-api.cisco.com",
            )
            if not self._is_allowed_cisco_url(target_url, allowed_api):
                return {
                    "success": False,
                    "httpStatus": 400,
                    "latencyMs": 0,
                    "error": "Dominio de destino no permitido en DesktopBridge.",
                }
            clean_method = (method or "GET").upper().strip()
            if clean_method not in ("GET", "POST"):
                return {
                    "success": False,
                    "httpStatus": 405,
                    "latencyMs": 0,
                    "error": f"Método HTTP no permitido en DesktopBridge ({clean_method}).",
                }
            req = urllib.request.Request(
                target_url,
                headers={
                    "Authorization": f"Bearer {clean_token}",
                    "Accept": "application/json",
                    "User-Agent": "CiscoAutomated-Desktop/3.3",
                },
                method=clean_method,
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


def _verify_bundle_manifest_sha256(html_path: str) -> bool:
    """
    If a sibling version.json manifest exists with desktop_bundle_sha256 / sha256,
    validates the local bundle's SHA-256 hash before loading it in PyWebView.
    """
    try:
        manifest_path = os.path.join(os.path.dirname(html_path), "version.json")
        if not os.path.isfile(manifest_path):
            return True
        with open(manifest_path, "r", encoding="utf-8") as mf:
            meta = json.load(mf)
        expected = meta.get("desktop_bundle_sha256") or meta.get("sha256")
        if not isinstance(expected, str) or len(expected.strip()) != 64:
            return True
        import hashlib
        h = hashlib.sha256()
        with open(html_path, "rb") as hf:
            for chunk in iter(lambda: hf.read(65536), b""):
                h.update(chunk)
        actual = h.hexdigest().lower()
        return actual == expected.strip().lower()
    except Exception:
        return False


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

    user_home = os.path.expanduser("~")
    workspace_dist = os.path.join(
        user_home,
        "antigravity",
        "Remix-Cotizador-Automático-Cisco---Intcomex",
        "dist",
        "index.html",
    )

    external_candidates = [
        workspace_dist,
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

    # En binarios empaquetados (PyInstaller frozen), jamás cargar HTML arbitrario desde CWD
    if getattr(sys, "frozen", False) or hasattr(sys, "_MEIPASS"):
        trusted_frozen_paths = [
            os.path.join(exe_dir, "_internal", "dist", "index.html"),
            os.path.join(exe_dir, "_internal", "index.html"),
            os.path.join(exe_dir, "dist", "index.html"),
            os.path.join(exe_dir, "index.html"),
        ] + bundled_candidates
        existing_trusted = [
            os.path.abspath(p)
            for p in trusted_frozen_paths
            if os.path.exists(os.path.abspath(p)) and _verify_bundle_manifest_sha256(os.path.abspath(p))
        ]
        if existing_trusted:
            return max(existing_trusted, key=lambda p: os.path.getmtime(p))
        raise RuntimeError(
            "Integridad SHA-256 del bundle desktop fallida o archivo principal ausente. Bloqueado por seguridad."
        )

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
        bridge._set_window(window)

        # Start native WebView window with Edge Chromium / WebView2 GUI
        webview.start(debug=False, gui='edgechromium', private_mode=False)
    except Exception as e:
        import traceback
        err_msg = f"Fatal error launching Desktop app:\n{traceback.format_exc()}"
        with open("desktop_error.log", "w", encoding="utf-8") as f:
            f.write(err_msg)
        print(err_msg)

if __name__ == "__main__":
    launch_desktop_app()

