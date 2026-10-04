import os
import shutil
import sqlite3
import uuid
from datetime import datetime
from typing import Dict, Any, List, Optional, Tuple

class DatabaseManager:
    """
    Dual-layer Database Manager supporting SQLite (local standalone)
    and Supabase (PostgreSQL Cloud) for multi-user collaboration.
    Includes Automatic Fail-Safe Redundancy, Rolling Backups, and Auto-Merging.
    """

    def __init__(self, db_path: str = None, supabase_url: str = None, supabase_key: str = None):
        user_home = os.path.expanduser("~")
        canonical_dir = os.path.join(user_home, ".cotizador_intcomex")
        os.makedirs(canonical_dir, exist_ok=True)
        canonical_db_path = os.path.join(canonical_dir, "gravity_database.db")

        if db_path:
            self.db_path = db_path
        else:
            self.db_path = canonical_db_path

        # Consolidate, auto-backup, and self-heal from any candidate paths
        self._consolidate_and_backup_databases(canonical_db_path)

        self.supabase_url = supabase_url or os.getenv("SUPABASE_URL", "")
        self.supabase_key = supabase_key or os.getenv("SUPABASE_KEY", "")
        self.use_supabase = bool(self.supabase_url and self.supabase_key)
        self.supabase_client = None

        if self.use_supabase:
            try:
                from supabase import create_client
                self.supabase_client = create_client(self.supabase_url, self.supabase_key)
                print("Conectado exitosamente a Supabase (PostgreSQL Cloud).")
            except Exception as e:
                print(f"Error conectando a Supabase ({e}). Usando motor SQLite local.")
                self.use_supabase = False

        self._init_db_schema()

    def _consolidate_and_backup_databases(self, canonical_path: str):
        """
        Discovers any scattered databases (root, dist/, desktop_app/, cwd),
        creates rolling timestamped backups, and merges all records into canonical path.
        """
        try:
            backup_dir = os.path.join(os.path.dirname(canonical_path), "backups")
            os.makedirs(backup_dir, exist_ok=True)

            candidate_paths = [
                canonical_path,
                os.path.join(os.getcwd(), "gravity_database.db"),
                os.path.join(os.getcwd(), "dist", "gravity_database.db"),
                os.path.join(os.path.dirname(os.path.abspath(__file__)), "gravity_database.db"),
            ]
            import sys
            if getattr(sys, 'frozen', False):
                exe_dir = os.path.dirname(os.path.abspath(sys.executable))
                candidate_paths.append(os.path.join(exe_dir, "gravity_database.db"))
                candidate_paths.append(os.path.join(exe_dir, "_internal", "gravity_database.db"))

            valid_candidates = []
            for p in candidate_paths:
                norm = os.path.normpath(os.path.abspath(p))
                if os.path.isfile(norm) and norm not in valid_candidates:
                    valid_candidates.append(norm)

            if not valid_candidates:
                return

            if not os.path.exists(canonical_path):
                shutil.copy2(valid_candidates[0], canonical_path)

            try:
                if os.path.exists(canonical_path) and os.path.getsize(canonical_path) > 0:
                    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
                    backup_file = os.path.join(backup_dir, f"gravity_database_backup_{ts}.db")
                    shutil.copy2(canonical_path, backup_file)
                    
                    backups = sorted([os.path.join(backup_dir, f) for f in os.listdir(backup_dir) if f.startswith("gravity_database_backup_") and f.endswith(".db")])
                    while len(backups) > 10:
                        oldest = backups.pop(0)
                        try:
                            os.remove(oldest)
                        except Exception:
                            pass
            except Exception as b_err:
                print(f"[DB Backup Warning]: {b_err}")

            with sqlite3.connect(canonical_path) as target_conn:
                target_conn.row_factory = sqlite3.Row
                target_cur = target_conn.cursor()

                for src_path in valid_candidates:
                    if src_path == os.path.normpath(os.path.abspath(canonical_path)):
                        continue
                    try:
                        with sqlite3.connect(src_path) as src_conn:
                            src_conn.row_factory = sqlite3.Row
                            src_cur = src_conn.cursor()

                            try:
                                src_cur.execute("SELECT * FROM estimates")
                                for row in src_cur.fetchall():
                                    d = dict(row)
                                    target_cur.execute("""
                                        INSERT OR IGNORE INTO estimates (
                                            id, user_id, estimate_id_cisco, deal_id, partner_name,
                                            client_final_name, original_filename, stored_filepath,
                                            net_cisco_total, total_cotizado_intcomex, recargo_reglas_usd,
                                            ganancia_intcomex_usd, items_count, created_at
                                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                                    """, (
                                        d["id"], d["user_id"], d["estimate_id_cisco"], d["deal_id"],
                                        d["partner_name"], d["client_final_name"], d["original_filename"],
                                        d["stored_filepath"], d["net_cisco_total"], d["total_cotizado_intcomex"],
                                        d["recargo_reglas_usd"], d["ganancia_intcomex_usd"], d["items_count"],
                                        d["created_at"]
                                    ))
                            except Exception:
                                pass

                            try:
                                src_cur.execute("SELECT * FROM estimate_items")
                                for row in src_cur.fetchall():
                                    d = dict(row)
                                    target_cur.execute("""
                                        INSERT OR IGNORE INTO estimate_items (
                                            id, estimate_id, line_number, part_number, description, qty,
                                            net_cisco_unit, is_intangible, lleva_arancel, costo_internacion,
                                            costo_arancel, precio_venta_unitario, precio_venta_extendido
                                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                                    """, (
                                        d["id"], d["estimate_id"], d["line_number"], d["part_number"],
                                        d["description"], d["qty"], d["net_cisco_unit"], d["is_intangible"],
                                        d["lleva_arancel"], d["costo_internacion"], d["costo_arancel"],
                                        d["precio_venta_unitario"], d["precio_venta_extendido"]
                                    ))
                            except Exception:
                                pass

                            try:
                                src_cur.execute("SELECT * FROM audit_logs")
                                for row in src_cur.fetchall():
                                    d = dict(row)
                                    target_cur.execute("""
                                        INSERT OR IGNORE INTO audit_logs (id, username, action, details, created_at)
                                        VALUES (?, ?, ?, ?, ?)
                                    """, (d["id"], d["username"], d["action"], d["details"], d["created_at"]))
                            except Exception:
                                pass

                        target_conn.commit()
                    except Exception as merge_err:
                        print(f"[DB Merge Warning from {src_path}]: {merge_err}")

            root_db = os.path.join(os.getcwd(), "gravity_database.db")
            if os.path.normpath(os.path.abspath(root_db)) != os.path.normpath(os.path.abspath(canonical_path)):
                try:
                    shutil.copy2(canonical_path, root_db)
                except Exception:
                    pass
        except Exception as e:
            print(f"[DB Consolidation Error]: {e}")

    def get_connection(self):
        """Returns SQLite connection."""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db_schema(self):
        """Initializes DDL schema and seeds default users if not present."""
        if not self.use_supabase:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                cursor.executescript("""
                    CREATE TABLE IF NOT EXISTS users (
                        id TEXT PRIMARY KEY,
                        username TEXT UNIQUE NOT NULL,
                        full_name TEXT NOT NULL,
                        email TEXT UNIQUE NOT NULL,
                        password_hash TEXT NOT NULL,
                        role TEXT NOT NULL CHECK (role IN ('admin', 'pm', 'preventa', 'standard')),
                        is_active INTEGER DEFAULT 1,
                        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                        last_login TEXT
                    );

                    CREATE TABLE IF NOT EXISTS estimates (
                        id TEXT PRIMARY KEY,
                        user_id TEXT NOT NULL,
                        estimate_id_cisco TEXT NOT NULL,
                        deal_id TEXT,
                        partner_name TEXT NOT NULL,
                        client_final_name TEXT NOT NULL,
                        original_filename TEXT NOT NULL,
                        stored_filepath TEXT NOT NULL,
                        net_cisco_total REAL NOT NULL DEFAULT 0.0,
                        total_cotizado_intcomex REAL NOT NULL DEFAULT 0.0,
                        recargo_reglas_usd REAL NOT NULL DEFAULT 0.0,
                        ganancia_intcomex_usd REAL NOT NULL DEFAULT 0.0,
                        items_count INTEGER NOT NULL DEFAULT 0,
                        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                    );

                    CREATE TABLE IF NOT EXISTS estimate_items (
                        id TEXT PRIMARY KEY,
                        estimate_id TEXT NOT NULL,
                        line_number TEXT NOT NULL,
                        part_number TEXT NOT NULL,
                        description TEXT,
                        qty INTEGER NOT NULL DEFAULT 1,
                        net_cisco_unit REAL NOT NULL DEFAULT 0.0,
                        is_intangible INTEGER DEFAULT 0,
                        lleva_arancel INTEGER DEFAULT 0,
                        costo_internacion REAL DEFAULT 0.0,
                        costo_arancel REAL DEFAULT 0.0,
                        precio_venta_unitario REAL NOT NULL DEFAULT 0.0,
                        precio_venta_extendido REAL NOT NULL DEFAULT 0.0,
                        FOREIGN KEY (estimate_id) REFERENCES estimates(id) ON DELETE CASCADE
                    );

                    CREATE TABLE IF NOT EXISTS audit_logs (
                        id TEXT PRIMARY KEY,
                        username TEXT NOT NULL,
                        action TEXT NOT NULL,
                        details TEXT,
                        created_at TEXT DEFAULT CURRENT_TIMESTAMP
                    );

                    CREATE TABLE IF NOT EXISTS sku_overrides (
                        sku TEXT PRIMARY KEY,
                        override_type TEXT NOT NULL,
                        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
                    );

                    CREATE TABLE IF NOT EXISTS bo_sku_catalog (
                        part_number TEXT PRIMARY KEY,
                        intcomex_sku TEXT NOT NULL,
                        base_part_number TEXT,
                        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
                    );
                """)
                conn.commit()
            self._ensure_updated_user_schema()
            self._seed_default_users()
            self._migrate_users_to_pm()

    def save_sku_override_db(self, sku: str, override_type: str):
        """Saves SKU override into SQLite database."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT OR REPLACE INTO sku_overrides (sku, override_type, updated_at)
                VALUES (?, ?, ?)
            """, (sku.strip().upper(), override_type, datetime.now().isoformat()))
            conn.commit()

    def get_sku_overrides_db(self) -> Dict[str, str]:
        """Gets all SKU overrides from SQLite database."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT sku, override_type FROM sku_overrides")
            rows = cursor.fetchall()
            return {row["sku"]: row["override_type"] for row in rows}

    def save_bo_sku_db(self, part_number: str, intcomex_sku: str, base_part_number: str = ""):
        """Saves or updates a Cisco Part Number to Intcomex SKU mapping in SQLite."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT OR REPLACE INTO bo_sku_catalog (part_number, intcomex_sku, base_part_number, updated_at)
                VALUES (?, ?, ?, ?)
            """, (part_number.strip().upper(), intcomex_sku.strip().upper(), (base_part_number or "").strip().upper(), datetime.now().isoformat()))
            conn.commit()

    def get_bo_skus_db(self) -> Dict[str, str]:
        """Gets all Part Number -> Intcomex SKU mappings from SQLite."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT part_number, intcomex_sku, base_part_number FROM bo_sku_catalog")
            rows = cursor.fetchall()
            mapping = {}
            for row in rows:
                sku = row["intcomex_sku"]
                pn = row["part_number"]
                base_pn = row["base_part_number"]
                if pn:
                    mapping[pn.upper()] = sku
                if base_pn:
                    mapping[base_pn.upper()] = sku
            return mapping

    def _ensure_updated_user_schema(self):
        """Migrates users table schema if old CHECK constraint without 'pm' is present."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name='users'")
            row = cursor.fetchone()
            if row and row[0] and "'pm'" not in row[0]:
                cursor.executescript("""
                    CREATE TABLE users_migrated (
                        id TEXT PRIMARY KEY,
                        username TEXT UNIQUE NOT NULL,
                        full_name TEXT NOT NULL,
                        email TEXT UNIQUE NOT NULL,
                        password_hash TEXT NOT NULL,
                        role TEXT NOT NULL CHECK (role IN ('admin', 'pm', 'preventa', 'standard')),
                        is_active INTEGER DEFAULT 1,
                        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                        last_login TEXT
                    );

                    INSERT INTO users_migrated (id, username, full_name, email, password_hash, role, is_active, created_at, last_login)
                    SELECT id, username, full_name, email, password_hash,
                           CASE WHEN role = 'standard' THEN 'pm' ELSE role END,
                           is_active, created_at, last_login
                    FROM users;

                    DROP TABLE users;
                    ALTER TABLE users_migrated RENAME TO users;
                """)
                conn.commit()

    def _seed_default_users(self):
        """Seeds initial required users: mskill (admin), madasme (pm), rcuevas (pm), jvalancia (pm)."""
        try:
            from auth_manager import AuthManager
        except ImportError:
            from desktop_app.auth_manager import AuthManager
        default_pwd_hash = AuthManager.hash_password("Intcomex2026!")

        users_seed = [
            ("usr-001-admin", "mskill", "Mauricio Skill (Administrador)", "mauricio.skill@mayor.cl", default_pwd_hash, "admin"),
            ("usr-002-pm", "madasme", "M. Adasme (Product Manager)", "madasme@intcomex.com", default_pwd_hash, "pm"),
            ("usr-003-pm", "rcuevas", "R. Cuevas (Product Manager)", "rcuevas@intcomex.com", default_pwd_hash, "pm"),
            ("usr-004-pm", "jvalancia", "J. Valancia (Product Manager)", "jvalancia@intcomex.com", default_pwd_hash, "pm"),
        ]

        with self.get_connection() as conn:
            cursor = conn.cursor()
            for uid, uname, fname, email, phash, role in users_seed:
                cursor.execute("""
                    INSERT OR IGNORE INTO users (id, username, full_name, email, password_hash, role)
                    VALUES (?, ?, ?, ?, ?, ?)
                """, (uid, uname, fname, email, phash, role))
            conn.commit()

    def _migrate_users_to_pm(self):
        """Migrates all non-admin users to the PM (Product Manager) role automatically."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                UPDATE users 
                SET role = 'pm' 
                WHERE username != 'mskill' AND (role = 'standard' OR role IS NULL)
            """)
            conn.commit()

    def update_user_role(self, username: str, new_role: str) -> Tuple[bool, str]:
        """Updates user role (admin, pm, preventa)."""
        if username == "mskill" and new_role != "admin":
            return (False, "No es posible degradar al administrador principal (mskill).")
        if new_role not in ["admin", "pm", "preventa", "standard"]:
            return (False, f"Rol '{new_role}' no válido.")
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("UPDATE users SET role = ? WHERE username = ?", (new_role, username))
                conn.commit()
            return (True, f"Rol de '{username}' actualizado a '{new_role.upper()}'.")
        except Exception as e:
            return (False, f"Error actualizando rol: {e}")


    def get_user_by_username(self, username: str) -> Optional[Dict[str, Any]]:
        """Retrieves user by username."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM users WHERE username = ?", (username,))
            row = cursor.fetchone()
            return dict(row) if row else None

    def update_last_login(self, user_id: str):
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("UPDATE users SET last_login = ? WHERE id = ?", (datetime.now().isoformat(), user_id))
            conn.commit()

    def log_audit_event(self, username: str, action: str, details: str):
        """Records an audit trail event into audit_logs table."""
        log_id = f"log-{uuid.uuid4().hex[:8]}"
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO audit_logs (id, username, action, details, created_at)
                VALUES (?, ?, ?, ?, ?)
            """, (log_id, username or "SYSTEM", action, details, datetime.now().isoformat()))
            conn.commit()

    def insert_user(self, user_id: str, username: str, full_name: str, email: str, pwd_hash: str, role: str) -> Tuple[bool, str]:
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    INSERT INTO users (id, username, full_name, email, password_hash, role)
                    VALUES (?, ?, ?, ?, ?, ?)
                """, (user_id, username, full_name, email, pwd_hash, role))
                conn.commit()
            return (True, f"Usuario '{username}' registrado correctamente.")
        except Exception as e:
            return (False, f"Error creando usuario: {e}")

    def update_user_password(self, username: str, pwd_hash: str) -> Tuple[bool, str]:
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("UPDATE users SET password_hash = ? WHERE username = ?", (pwd_hash, username))
                conn.commit()
            return (True, f"Contraseña del usuario '{username}' modificada con éxito.")
        except Exception as e:
            return (False, f"Error actualizando contraseña: {e}")

    def update_user_full(self, original_username: str, full_name: str, email: str, role: str, pwd_hash: Optional[str] = None, is_active: Optional[int] = None) -> Tuple[bool, str]:
        """Updates full user record including name, email, role, password, and active state."""
        if original_username == "mskill" and role != "admin":
            return (False, "No es posible degradar al administrador principal (mskill).")
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                if pwd_hash:
                    if is_active is not None:
                        cursor.execute("""
                            UPDATE users SET full_name = ?, email = ?, role = ?, password_hash = ?, is_active = ?
                            WHERE username = ?
                        """, (full_name.strip(), email.strip(), role, pwd_hash, is_active, original_username))
                    else:
                        cursor.execute("""
                            UPDATE users SET full_name = ?, email = ?, role = ?, password_hash = ?
                            WHERE username = ?
                        """, (full_name.strip(), email.strip(), role, pwd_hash, original_username))
                else:
                    if is_active is not None:
                        cursor.execute("""
                            UPDATE users SET full_name = ?, email = ?, role = ?, is_active = ?
                            WHERE username = ?
                        """, (full_name.strip(), email.strip(), role, is_active, original_username))
                    else:
                        cursor.execute("""
                            UPDATE users SET full_name = ?, email = ?, role = ?
                            WHERE username = ?
                        """, (full_name.strip(), email.strip(), role, original_username))
                conn.commit()
            return (True, f"Datos del usuario '{original_username}' actualizados exitosamente.")
        except Exception as e:
            return (False, f"Error actualizando usuario: {e}")

    def save_estimate_record(self, estimate_data: Dict[str, Any], items: List[Dict[str, Any]]) -> str:
        """Saves processed estimate header and detailed items into database."""
        est_id = f"est-{uuid.uuid4().hex[:8]}"
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO estimates (
                    id, user_id, estimate_id_cisco, deal_id, partner_name, client_final_name,
                    original_filename, stored_filepath, net_cisco_total, total_cotizado_intcomex,
                    recargo_reglas_usd, ganancia_intcomex_usd, items_count, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                est_id,
                estimate_data["user_id"],
                estimate_data.get("estimate_id_cisco", "N/A"),
                estimate_data.get("deal_id", "N/A"),
                estimate_data["partner_name"],
                estimate_data["client_final_name"],
                estimate_data["original_filename"],
                estimate_data["stored_filepath"],
                estimate_data["net_cisco_total"],
                estimate_data["total_cotizado_intcomex"],
                estimate_data["recargo_reglas_usd"],
                estimate_data["ganancia_intcomex_usd"],
                len(items),
                datetime.now().isoformat()
            ))

            for item in items:
                item_id = f"itm-{uuid.uuid4().hex[:8]}"
                cursor.execute("""
                    INSERT INTO estimate_items (
                        id, estimate_id, line_number, part_number, description, qty,
                        net_cisco_unit, is_intangible, lleva_arancel, costo_internacion,
                        costo_arancel, precio_venta_unitario, precio_venta_extendido
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    item_id,
                    est_id,
                    item.get("lineNumber", "1.0"),
                    item.get("partNumber", ""),
                    item.get("description", ""),
                    item.get("qty", 1),
                    item.get("netCiscoUnit", 0.0),
                    1 if item.get("isIntangible") else 0,
                    1 if item.get("llevaArancel") else 0,
                    item.get("costoInternacion", 0.0),
                    item.get("costoArancel", 0.0),
                    item.get("precioVentaUnitario", 0.0),
                    item.get("precioVentaExtendido", 0.0)
                ))

            conn.commit()
        return est_id

    def get_user_kpis(self, user_id: str = None, is_admin: bool = False) -> Dict[str, Any]:
        """Calculates global or personal KPIs for dashboard (files uploaded, totals, margins)."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            if is_admin or user_id is None:
                query = "SELECT COUNT(*) as total_files, COALESCE(SUM(total_cotizado_intcomex), 0) as total_revenue, COALESCE(SUM(ganancia_intcomex_usd), 0) as total_profit FROM estimates"
                cursor.execute(query)
            else:
                query = "SELECT COUNT(*) as total_files, COALESCE(SUM(total_cotizado_intcomex), 0) as total_revenue, COALESCE(SUM(ganancia_intcomex_usd), 0) as total_profit FROM estimates WHERE user_id = ?"
                cursor.execute(query, (user_id,))
            row = cursor.fetchone()
            return dict(row)

    def get_estimates_list(self, user_id: str = None, is_admin: bool = False) -> List[Dict[str, Any]]:
        """Retrieves estimate history list filtered by user role isolation using fail-safe LEFT JOIN."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            if is_admin or user_id is None:
                query = """
                    SELECT e.*, 
                           COALESCE(u.username, e.user_id, 'Usuario') AS username, 
                           COALESCE(u.full_name, u.username, 'Usuario Intcomex') AS full_name 
                    FROM estimates e 
                    LEFT JOIN users u ON e.user_id = u.id 
                    ORDER BY e.created_at DESC
                """
                cursor.execute(query)
            else:
                query = """
                    SELECT e.*, 
                           COALESCE(u.username, e.user_id, 'Usuario') AS username, 
                           COALESCE(u.full_name, u.username, 'Usuario Intcomex') AS full_name 
                    FROM estimates e 
                    LEFT JOIN users u ON e.user_id = u.id 
                    WHERE (e.user_id = ? OR u.username = ?) 
                    ORDER BY e.created_at DESC
                """
                cursor.execute(query, (user_id, user_id))
            return [dict(row) for row in cursor.fetchall()]

    def get_all_users(self) -> List[Dict[str, Any]]:
        """Retrieves all users for the RBAC management screen."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT id, username, full_name, email, role, is_active, created_at, last_login FROM users ORDER BY created_at ASC")
            return [dict(row) for row in cursor.fetchall()]

    def toggle_user_active(self, username: str, is_active: bool) -> Tuple[bool, str]:
        """Activates or deactivates a user."""
        if username == "mskill":
            return (False, "No es posible desactivar al usuario administrador principal (mskill).")
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("UPDATE users SET is_active = ? WHERE username = ?", (1 if is_active else 0, username))
                conn.commit()
            status_str = "activado" if is_active else "desactivado"
            return (True, f"Usuario '{username}' {status_str} exitosamente.")
        except Exception as e:
            return (False, f"Error cambiando estado de usuario: {e}")

    def delete_user(self, username: str) -> Tuple[bool, str]:
        """Deletes a user (mskill cannot be deleted)."""
        if username == "mskill":
            return (False, "No es posible eliminar al usuario administrador principal (mskill).")
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("DELETE FROM users WHERE username = ?", (username,))
                conn.commit()
            return (True, f"Usuario '{username}' eliminado correctamente.")
        except Exception as e:
            return (False, f"Error eliminando usuario: {e}")

    def get_audit_logs(self) -> List[Dict[str, Any]]:
        """Retrieves audit trail logs (Admin only)."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 300")
            return [dict(row) for row in cursor.fetchall()]

