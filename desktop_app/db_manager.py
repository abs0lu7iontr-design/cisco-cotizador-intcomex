import os
import sqlite3
import uuid
from datetime import datetime
from typing import Dict, Any, List, Optional, Tuple

class DatabaseManager:
    """
    Dual-layer Database Manager supporting SQLite (local standalone)
    and Supabase (PostgreSQL Cloud) for multi-user collaboration.
    """

    def __init__(self, db_path: str = None, supabase_url: str = None, supabase_key: str = None):
        if not db_path:
            import sys
            if getattr(sys, 'frozen', False):
                exe_dir = os.path.dirname(os.path.abspath(sys.executable))
                self.db_path = os.path.join(exe_dir, "gravity_database.db")
            else:
                self.db_path = os.path.join(os.getcwd(), "gravity_database.db")
        else:
            self.db_path = db_path
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
        from auth_manager import AuthManager
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
        """Retrieves estimate history list filtered by user role isolation."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            if is_admin or user_id is None:
                query = "SELECT e.*, u.username, u.full_name FROM estimates e JOIN users u ON e.user_id = u.id ORDER BY e.created_at DESC"
                cursor.execute(query)
            else:
                query = "SELECT e.*, u.username, u.full_name FROM estimates e JOIN users u ON e.user_id = u.id WHERE e.user_id = ? ORDER BY e.created_at DESC"
                cursor.execute(query, (user_id,))
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

