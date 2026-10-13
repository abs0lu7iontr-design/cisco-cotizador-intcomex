import hashlib
import json
import os
import re
import shutil
import sqlite3
import time
import uuid
from datetime import datetime
from typing import Dict, Any, List, Optional, Tuple, Callable


class ManagedSQLiteConnection:
    """
    Item 5 & Item 14: Context-managed SQLite connection wrapper that:
    - Configures `PRAGMA busy_timeout = 5000` and `PRAGMA foreign_keys = ON` (when requested).
    - Commits on clean `__exit__` or rolls back on exception.
    - Explicitly closes the underlying `sqlite3.Connection` on `__exit__` so file descriptors
      and SQLite locks are never leaked across operations.
    """

    def __init__(
        self,
        db_path: str,
        enforce_foreign_keys: bool = True,
        busy_timeout_ms: int = 5000,
        on_open: Optional[Callable[[], None]] = None,
        on_close: Optional[Callable[[], None]] = None,
    ):
        self.db_path = db_path
        self.enforce_foreign_keys = enforce_foreign_keys
        self.busy_timeout_ms = busy_timeout_ms
        self._on_open = on_open
        self._on_close = on_close
        self._closed = False
        self._conn = sqlite3.connect(self.db_path, timeout=max(busy_timeout_ms / 1000.0, 5.0))
        self._conn.row_factory = sqlite3.Row
        if self._on_open:
            self._on_open()
        try:
            self._conn.execute(f"PRAGMA busy_timeout = {int(self.busy_timeout_ms)};")
            fk_val = "ON" if self.enforce_foreign_keys else "OFF"
            self._conn.execute(f"PRAGMA foreign_keys = {fk_val};")
        except Exception:
            self.close()
            raise

    def __enter__(self) -> "ManagedSQLiteConnection":
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        try:
            if not self._closed:
                if exc_type is None:
                    self._conn.commit()
                else:
                    try:
                        self._conn.rollback()
                    except Exception:
                        pass
        finally:
            self.close()
        return False

    def cursor(self) -> sqlite3.Cursor:
        return self._conn.cursor()

    def execute(self, sql: str, parameters: Tuple[Any, ...] = ()) -> sqlite3.Cursor:
        return self._conn.execute(sql, parameters)

    def executescript(self, sql_script: str) -> sqlite3.Cursor:
        return self._conn.executescript(sql_script)

    def commit(self):
        if not self._closed:
            self._conn.commit()

    def rollback(self):
        if not self._closed:
            self._conn.rollback()

    def close(self):
        if not self._closed:
            self._closed = True
            try:
                self._conn.close()
            finally:
                if self._on_close:
                    self._on_close()

    @property
    def is_closed(self) -> bool:
        return self._closed

    @property
    def in_transaction(self) -> bool:
        return False if self._closed else self._conn.in_transaction

    @property
    def row_factory(self):
        return self._conn.row_factory

    @row_factory.setter
    def row_factory(self, value):
        self._conn.row_factory = value

    def __getattr__(self, name: str):
        return getattr(self._conn, name)


class DatabaseManager:
    """
    Dual-layer Database Manager supporting SQLite (local standalone)
    and Supabase (PostgreSQL Cloud) for multi-user collaboration.
    Includes Versioned Schema Migrations (V001-V005), Referential Integrity Enforcement,
    Idempotent Estimate Versioning, Non-Overwriting BO SKU Alias Resolution,
    and Connection Lifecycle Management.
    """

    CURRENT_SCHEMA_VERSION = "V005"

    def __init__(
        self,
        db_path: str = None,
        supabase_url: str = None,
        supabase_key: str = None,
        auto_migrate: bool = True,
        consolidate_on_init: Optional[bool] = None,
    ):
        user_home = os.path.expanduser("~")
        canonical_dir = os.path.join(user_home, ".cotizador_intcomex")
        canonical_db_path = os.path.join(canonical_dir, "gravity_database.db")

        self._open_connections_count = 0
        self._total_connections_opened = 0
        self._total_connections_closed = 0

        if db_path:
            self.db_path = db_path
            # Item 6: Si se entrega un db_path explícito (ej. pruebas o base temporal),
            # no consolidar contra la base real del usuario salvo que se pida explícitamente.
            should_consolidate = bool(consolidate_on_init) if consolidate_on_init is not None else False
        else:
            os.makedirs(canonical_dir, exist_ok=True)
            self.db_path = canonical_db_path
            should_consolidate = True if consolidate_on_init is None else bool(consolidate_on_init)

        if should_consolidate:
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

        if auto_migrate and not self.use_supabase:
            self._init_db_schema()

    def _on_conn_open(self):
        self._open_connections_count += 1
        self._total_connections_opened += 1

    def _on_conn_close(self):
        self._open_connections_count = max(0, self._open_connections_count - 1)
        self._total_connections_closed += 1

    def get_connection_stats(self) -> Dict[str, int]:
        """Item 14: Returns connection lifecycle counters to verify zero leaked connections."""
        return {
            "open_connections": self._open_connections_count,
            "total_opened": self._total_connections_opened,
            "total_closed": self._total_connections_closed,
        }

    def get_connection(self, enforce_foreign_keys: bool = True) -> ManagedSQLiteConnection:
        """
        Item 5 & Item 14: Centralizes SQLite connection creation with `PRAGMA foreign_keys = ON`,
        `PRAGMA busy_timeout = 5000`, and deterministic close on context manager exit.
        """
        return ManagedSQLiteConnection(
            db_path=self.db_path,
            enforce_foreign_keys=enforce_foreign_keys,
            busy_timeout_ms=5000,
            on_open=self._on_conn_open,
            on_close=self._on_conn_close,
        )

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

                    backups = sorted([
                        os.path.join(backup_dir, f)
                        for f in os.listdir(backup_dir)
                        if f.startswith("gravity_database_backup_") and f.endswith(".db")
                    ])
                    while len(backups) > 10:
                        oldest = backups.pop(0)
                        try:
                            os.remove(oldest)
                        except Exception:
                            pass
            except Exception as b_err:
                print(f"[DB Backup Warning]: {b_err}")

            with ManagedSQLiteConnection(canonical_path, enforce_foreign_keys=False) as target_conn:
                target_cur = target_conn.cursor()

                for src_path in valid_candidates:
                    if src_path == os.path.normpath(os.path.abspath(canonical_path)):
                        continue
                    try:
                        with ManagedSQLiteConnection(src_path, enforce_foreign_keys=False) as src_conn:
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

    # =========================================================================
    # ITEM 6: VERSIONED SCHEMA & REPEATABLE TRANSACTIONAL MIGRATIONS (V001-V005)
    # =========================================================================

    def _init_db_schema(self):
        """Initializes versioned schema migrations and seeds default users if not present."""
        if not self.use_supabase:
            self.run_migrations()
            self._seed_default_users()

    def get_applied_migrations(self) -> List[Dict[str, Any]]:
        """Returns the list of applied migrations from `schema_migrations`."""
        with self.get_connection() as conn:
            cur = conn.cursor()
            cur.execute("""
                CREATE TABLE IF NOT EXISTS schema_migrations (
                    version TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    applied_at TEXT NOT NULL,
                    checksum TEXT NOT NULL,
                    status TEXT NOT NULL DEFAULT 'APPLIED',
                    execution_ms INTEGER DEFAULT 0
                )
            """)
            cur.execute("SELECT * FROM schema_migrations ORDER BY version ASC")
            return [dict(r) for r in cur.fetchall()]

    def _migration_v001_baseline_core_tables(self, conn: ManagedSQLiteConnection):
        cur = conn.cursor()
        cur.execute("""
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
            )
        """)
        cur.execute("""
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
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
                version_number INTEGER NOT NULL DEFAULT 1,
                version_tag TEXT NOT NULL DEFAULT 'v1',
                baseline_v0_amount REAL NOT NULL DEFAULT 0.0,
                is_active_version INTEGER NOT NULL DEFAULT 1,
                commercial_scope_key TEXT NOT NULL DEFAULT '',
                idempotency_key TEXT,
                legacy_duplicate_of TEXT,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT
            )
        """)
        cur.execute("""
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
            )
        """)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS audit_logs (
                id TEXT PRIMARY KEY,
                username TEXT NOT NULL,
                action TEXT NOT NULL,
                details TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        """)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS sku_overrides (
                sku TEXT PRIMARY KEY,
                override_type TEXT NOT NULL,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        """)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS bo_sku_catalog (
                part_number TEXT PRIMARY KEY,
                intcomex_sku TEXT NOT NULL,
                base_part_number TEXT,
                source TEXT NOT NULL DEFAULT 'MANUAL',
                updated_by TEXT NOT NULL DEFAULT 'system',
                is_exact_variant INTEGER NOT NULL DEFAULT 1,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        """)

    def _migration_v002_users_roles_and_pm_upgrade(self, conn: ManagedSQLiteConnection):
        cur = conn.cursor()
        cur.execute("PRAGMA table_info(users)")
        user_cols = {row["name"] for row in cur.fetchall()}
        for col_name, col_def in [
            ("full_name", "TEXT NOT NULL DEFAULT ''"),
            ("email", "TEXT"),
            ("is_active", "INTEGER DEFAULT 1"),
            ("created_at", "TEXT"),
            ("last_login", "TEXT"),
        ]:
            if col_name not in user_cols:
                cur.execute(f"ALTER TABLE users ADD COLUMN {col_name} {col_def}")

        cur.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name='users'")
        row = cur.fetchone()
        if row and row[0] and "'pm'" not in row[0]:
            cur.execute("PRAGMA foreign_keys = OFF")
            try:
                cur.execute("DROP TABLE IF EXISTS users_migrated")
                cur.execute("""
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
                    )
                """)
                cur.execute("""
                    INSERT INTO users_migrated (id, username, full_name, email, password_hash, role, is_active, created_at, last_login)
                    SELECT id,
                           username,
                           COALESCE(NULLIF(TRIM(full_name), ''), username),
                           COALESCE(NULLIF(TRIM(email), ''), username || '@intcomex.com'),
                           password_hash,
                           CASE WHEN role = 'standard' AND username != 'mskill' THEN 'pm' ELSE COALESCE(role, 'pm') END,
                           COALESCE(is_active, 1),
                           COALESCE(created_at, CURRENT_TIMESTAMP),
                           last_login
                    FROM users
                """)
                cur.execute("DROP TABLE users")
                cur.execute("ALTER TABLE users_migrated RENAME TO users")
            finally:
                if getattr(conn, "enforce_foreign_keys", True):
                    cur.execute("PRAGMA foreign_keys = ON")

        cur.execute("""
            UPDATE users
            SET role = 'pm'
            WHERE username != 'mskill' AND (role = 'standard' OR role IS NULL)
        """)

    def _migration_v003_estimates_versioning_and_scope_columns(self, conn: ManagedSQLiteConnection):
        cur = conn.cursor()
        cur.execute("PRAGMA table_info(estimates)")
        cols = {row["name"] for row in cur.fetchall()}

        additions = [
            ("updated_at", "TEXT"),
            ("version_number", "INTEGER NOT NULL DEFAULT 1"),
            ("version_tag", "TEXT NOT NULL DEFAULT 'v1'"),
            ("baseline_v0_amount", "REAL NOT NULL DEFAULT 0.0"),
            ("is_active_version", "INTEGER NOT NULL DEFAULT 1"),
            ("commercial_scope_key", "TEXT NOT NULL DEFAULT ''"),
            ("idempotency_key", "TEXT"),
            ("legacy_duplicate_of", "TEXT"),
        ]
        for col_name, col_def in additions:
            if col_name not in cols:
                cur.execute(f"ALTER TABLE estimates ADD COLUMN {col_name} {col_def}")

        cur.execute("""
            UPDATE estimates
            SET updated_at = COALESCE(updated_at, created_at, CURRENT_TIMESTAMP),
                baseline_v0_amount = CASE
                    WHEN baseline_v0_amount IS NULL OR baseline_v0_amount = 0.0 THEN COALESCE(net_cisco_total, 0.0)
                    ELSE baseline_v0_amount
                END
            WHERE updated_at IS NULL OR baseline_v0_amount IS NULL OR baseline_v0_amount = 0.0
        """)

        # Item 5: Si la tabla `estimates` antigua tenía `ON DELETE CASCADE` hacia `users(id)`,
        # reconstruirla con `ON DELETE RESTRICT` preservando el 100% de las filas históricas.
        cur.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name='estimates'")
        est_sql_row = cur.fetchone()
        if est_sql_row and est_sql_row[0] and "ON DELETE CASCADE" in est_sql_row[0].upper():
            cur.execute("PRAGMA foreign_keys = OFF")
            try:
                cur.execute("DROP TABLE IF EXISTS estimates_migrated")
                cur.execute("""
                    CREATE TABLE estimates_migrated (
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
                        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
                        version_number INTEGER NOT NULL DEFAULT 1,
                        version_tag TEXT NOT NULL DEFAULT 'v1',
                        baseline_v0_amount REAL NOT NULL DEFAULT 0.0,
                        is_active_version INTEGER NOT NULL DEFAULT 1,
                        commercial_scope_key TEXT NOT NULL DEFAULT '',
                        idempotency_key TEXT,
                        legacy_duplicate_of TEXT,
                        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT
                    )
                """)
                cur.execute("""
                    INSERT INTO estimates_migrated (
                        id, user_id, estimate_id_cisco, deal_id, partner_name, client_final_name,
                        original_filename, stored_filepath, net_cisco_total, total_cotizado_intcomex,
                        recargo_reglas_usd, ganancia_intcomex_usd, items_count, created_at, updated_at,
                        version_number, version_tag, baseline_v0_amount, is_active_version,
                        commercial_scope_key, idempotency_key, legacy_duplicate_of
                    )
                    SELECT
                        id, user_id, estimate_id_cisco, deal_id, partner_name, client_final_name,
                        original_filename, stored_filepath, net_cisco_total, total_cotizado_intcomex,
                        recargo_reglas_usd, ganancia_intcomex_usd, items_count, created_at,
                        COALESCE(updated_at, created_at, CURRENT_TIMESTAMP),
                        COALESCE(version_number, 1),
                        COALESCE(version_tag, 'v1'),
                        COALESCE(NULLIF(baseline_v0_amount, 0.0), net_cisco_total, 0.0),
                        COALESCE(is_active_version, 1),
                        COALESCE(commercial_scope_key, ''),
                        idempotency_key,
                        legacy_duplicate_of
                    FROM estimates
                """)
                cur.execute("DROP TABLE estimates")
                cur.execute("ALTER TABLE estimates_migrated RENAME TO estimates")
            finally:
                if getattr(conn, "enforce_foreign_keys", True):
                    cur.execute("PRAGMA foreign_keys = ON")

        # Backfill `commercial_scope_key` para todas las filas existentes sin agrupar 'N/A' como una sola cotización
        cur.execute("""
            SELECT id, estimate_id_cisco, deal_id, partner_name, client_final_name, original_filename,
                   version_number, version_tag, is_active_version, created_at, commercial_scope_key
            FROM estimates
            ORDER BY created_at DESC, id DESC
        """)
        rows = [dict(r) for r in cur.fetchall()]
        seen_scope_version: Dict[Tuple[str, str], str] = {}
        seen_active_scope: Dict[str, str] = {}

        for r in rows:
            scope_key = r.get("commercial_scope_key") or self.compute_commercial_scope_key(r)
            ver_tag = str(r.get("version_tag") or f"v{r.get('version_number') or 1}").strip()
            row_id = r["id"]
            is_active = int(r.get("is_active_version") if r.get("is_active_version") is not None else 1)
            legacy_dup_of = None

            sv_key = (scope_key, ver_tag)
            if sv_key in seen_scope_version:
                # Preservar el duplicado histórico sin borrarlo, marcando su referencia canónica
                legacy_dup_of = seen_scope_version[sv_key]
                is_active = 0
            else:
                seen_scope_version[sv_key] = row_id

            if is_active == 1:
                if scope_key in seen_active_scope:
                    is_active = 0
                else:
                    seen_active_scope[scope_key] = row_id

            cur.execute("""
                UPDATE estimates
                SET commercial_scope_key = ?,
                    version_tag = ?,
                    is_active_version = ?,
                    legacy_duplicate_of = COALESCE(legacy_duplicate_of, ?)
                WHERE id = ?
            """, (scope_key, ver_tag, is_active, legacy_dup_of, row_id))

    def _migration_v004_bo_sku_catalog_provenance_columns(self, conn: ManagedSQLiteConnection):
        cur = conn.cursor()
        cur.execute("PRAGMA table_info(bo_sku_catalog)")
        cols = {row["name"] for row in cur.fetchall()}
        if "source" not in cols:
            cur.execute("ALTER TABLE bo_sku_catalog ADD COLUMN source TEXT NOT NULL DEFAULT 'MANUAL'")
        if "updated_by" not in cols:
            cur.execute("ALTER TABLE bo_sku_catalog ADD COLUMN updated_by TEXT NOT NULL DEFAULT 'system'")
        if "is_exact_variant" not in cols:
            cur.execute("ALTER TABLE bo_sku_catalog ADD COLUMN is_exact_variant INTEGER NOT NULL DEFAULT 1")

    def _migration_v005_indexes_and_uniqueness_constraints(self, conn: ManagedSQLiteConnection):
        cur = conn.cursor()
        index_statements = [
            "CREATE INDEX IF NOT EXISTS idx_estimates_user_id ON estimates(user_id)",
            "CREATE INDEX IF NOT EXISTS idx_estimates_partner ON estimates(partner_name)",
            "CREATE INDEX IF NOT EXISTS idx_estimates_client ON estimates(client_final_name)",
            "CREATE INDEX IF NOT EXISTS idx_estimates_created_at ON estimates(created_at DESC)",
            "CREATE INDEX IF NOT EXISTS idx_estimates_cisco_id ON estimates(estimate_id_cisco)",
            "CREATE INDEX IF NOT EXISTS idx_estimates_scope_active ON estimates(commercial_scope_key, is_active_version)",
            "CREATE UNIQUE INDEX IF NOT EXISTS idx_estimates_unique_idempotency ON estimates(idempotency_key) WHERE idempotency_key IS NOT NULL",
            "CREATE UNIQUE INDEX IF NOT EXISTS idx_estimates_unique_scope_version ON estimates(commercial_scope_key, version_tag) WHERE legacy_duplicate_of IS NULL",
            "CREATE UNIQUE INDEX IF NOT EXISTS idx_estimates_single_active_per_scope ON estimates(commercial_scope_key) WHERE is_active_version = 1 AND legacy_duplicate_of IS NULL",
            "CREATE INDEX IF NOT EXISTS idx_estimate_items_estimate_id ON estimate_items(estimate_id)",
            "CREATE INDEX IF NOT EXISTS idx_estimate_items_part_number ON estimate_items(part_number)",
            "CREATE INDEX IF NOT EXISTS idx_audit_logs_username ON audit_logs(username)",
            "CREATE INDEX IF NOT EXISTS idx_audit_logs_username_created_at ON audit_logs(username, created_at DESC)",
            "CREATE INDEX IF NOT EXISTS idx_bo_sku_base_pn ON bo_sku_catalog(base_part_number)",
        ]
        for stmt in index_statements:
            cur.execute(stmt)

    def run_migrations(self, stop_before_version: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Item 6: Runs all pending versioned migrations in strict order.
        Each migration executes inside an explicit transaction (`BEGIN IMMEDIATE ... COMMIT`)
        so an interrupted or failing migration rolls back cleanly without partial schema corruption.
        """
        migrations = [
            ("V001", "baseline_core_tables", self._migration_v001_baseline_core_tables),
            ("V002", "users_roles_and_pm_upgrade", self._migration_v002_users_roles_and_pm_upgrade),
            ("V003", "estimates_versioning_and_scope_columns", self._migration_v003_estimates_versioning_and_scope_columns),
            ("V004", "bo_sku_catalog_provenance_columns", self._migration_v004_bo_sku_catalog_provenance_columns),
            ("V005", "indexes_and_uniqueness_constraints", self._migration_v005_indexes_and_uniqueness_constraints),
        ]

        # Ensure schema_migrations table exists
        with self.get_connection(enforce_foreign_keys=True) as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS schema_migrations (
                    version TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    applied_at TEXT NOT NULL,
                    checksum TEXT NOT NULL,
                    status TEXT NOT NULL DEFAULT 'APPLIED',
                    execution_ms INTEGER DEFAULT 0
                )
            """)

        applied_map = {m["version"]: m for m in self.get_applied_migrations() if m.get("status") == "APPLIED"}
        newly_applied: List[Dict[str, Any]] = []

        for version, name, fn in migrations:
            if stop_before_version and version == stop_before_version:
                break
            if version in applied_map:
                continue

            checksum = hashlib.sha256(f"{version}:{name}".encode("utf-8")).hexdigest()[:16]
            start_ts = time.perf_counter()
            # Table-rebuild migrations (V002, V003) follow SQLite's official 12-step ALTER TABLE
            # procedure with foreign_keys=OFF during the table swap inside the transaction.
            needs_table_swap = version in ("V002", "V003")
            with self.get_connection(enforce_foreign_keys=not needs_table_swap) as conn:
                conn.execute("BEGIN IMMEDIATE")
                try:
                    fn(conn)
                    elapsed_ms = int((time.perf_counter() - start_ts) * 1000)
                    now_iso = datetime.now().isoformat()
                    conn.execute("""
                        INSERT OR REPLACE INTO schema_migrations (version, name, applied_at, checksum, status, execution_ms)
                        VALUES (?, ?, ?, ?, 'APPLIED', ?)
                    """, (version, name, now_iso, checksum, elapsed_ms))
                    conn.commit()
                    newly_applied.append({
                        "version": version,
                        "name": name,
                        "applied_at": now_iso,
                        "checksum": checksum,
                        "status": "APPLIED",
                        "execution_ms": elapsed_ms,
                    })
                except Exception:
                    conn.rollback()
                    raise

        return newly_applied

    def _ensure_updated_user_schema(self):
        """Legacy compatibility wrapper for V002."""
        self.run_migrations()

    def _ensure_updated_estimate_schema(self):
        """Legacy compatibility wrapper for V003-V005."""
        self.run_migrations()

    def _migrate_users_to_pm(self):
        """Legacy compatibility wrapper for V002."""
        with self.get_connection() as conn:
            conn.execute("""
                UPDATE users
                SET role = 'pm'
                WHERE username != 'mskill' AND (role = 'standard' OR role IS NULL)
            """)

    # =========================================================================
    # ITEM 5: REFERENTIAL INTEGRITY DIAGNOSTICS & POLICIES
    # =========================================================================

    def diagnose_referential_integrity(self) -> Dict[str, Any]:
        """
        Item 5: Inspects referential integrity across `users`, `estimates`, and `estimate_items`
        without automatically deleting any orphan records.
        """
        with self.get_connection(enforce_foreign_keys=True) as conn:
            cur = conn.cursor()
            cur.execute("PRAGMA foreign_keys")
            fk_Row = cur.fetchone()
            fk_enabled = bool(fk_Row[0]) if fk_Row else False

            cur.execute("""
                SELECT e.id, e.user_id, e.estimate_id_cisco, e.deal_id, e.partner_name, e.created_at
                FROM estimates e
                LEFT JOIN users u ON e.user_id = u.id
                WHERE u.id IS NULL
            """)
            orphan_estimates = [dict(r) for r in cur.fetchall()]

            cur.execute("""
                SELECT i.id, i.estimate_id, i.line_number, i.part_number, i.precio_venta_extendido
                FROM estimate_items i
                LEFT JOIN estimates e ON i.estimate_id = e.id
                WHERE e.id IS NULL
            """)
            orphan_items = [dict(r) for r in cur.fetchall()]

            cur.execute("PRAGMA foreign_key_check")
            fk_violations = [dict(r) for r in cur.fetchall()]

            return {
                "foreign_keys_enabled": fk_enabled,
                "orphan_estimates": orphan_estimates,
                "orphan_estimate_items": orphan_items,
                "foreign_key_violations": fk_violations,
                "has_orphans": len(orphan_estimates) > 0 or len(orphan_items) > 0 or len(fk_violations) > 0,
            }

    def delete_estimate_record(self, estimate_id: str) -> Tuple[bool, str]:
        """
        Item 5: Deletes an estimate version header; `ON DELETE CASCADE` on `estimate_items.estimate_id`
        automatically deletes all associated line items in the same transaction.
        """
        with self.get_connection(enforce_foreign_keys=True) as conn:
            cur = conn.cursor()
            cur.execute("SELECT id FROM estimates WHERE id = ?", (estimate_id,))
            if not cur.fetchone():
                return (False, f"Cotización '{estimate_id}' no encontrada.")
            cur.execute("DELETE FROM estimates WHERE id = ?", (estimate_id,))
            return (True, f"Cotización '{estimate_id}' y sus líneas asociadas eliminadas correctamente.")

    # =========================================================================
    # ITEM 7: COMMERCIAL IDENTITY, VERSION UNIQUENESS & IDEMPOTENCY
    # =========================================================================

    @staticmethod
    def _normalize_scope_token(val: Any, fallback: str = "NONE") -> str:
        s = str(val if val is not None else "").strip().upper()
        s = re.sub(r"\s+", " ", s)
        return s if s else fallback

    @classmethod
    def compute_commercial_scope_key(cls, estimate_data: Dict[str, Any]) -> str:
        """
        Item 7: Computes the canonical commercial identity scope of a quote:
        - If `estimate_id_cisco` is a real Cisco Estimate ID (not 'N/A', 'NA', ''), scopes by `CISCO::<ID>`.
        - If `estimate_id_cisco` is missing or 'N/A', scopes by `(deal_id, partner_name, client_final_name, original_filename)`
          so distinct quotes without a Cisco ID are NEVER grouped together under 'N/A'.
        """
        explicit_scope = str(estimate_data.get("commercial_scope_key") or "").strip()
        if explicit_scope:
            return explicit_scope

        raw_cisco_id = cls._normalize_scope_token(estimate_data.get("estimate_id_cisco"), "N/A")
        if raw_cisco_id not in ("N/A", "NA", "NONE", "NULL", "SIN-ID", "SIN_ID", "-"):
            return f"CISCO::{raw_cisco_id}"

        deal_id = cls._normalize_scope_token(estimate_data.get("deal_id"), "NO_DEAL")
        partner = cls._normalize_scope_token(estimate_data.get("partner_name"), "NO_PARTNER")
        client = cls._normalize_scope_token(estimate_data.get("client_final_name"), "NO_CLIENT")
        filename = cls._normalize_scope_token(estimate_data.get("original_filename"), "NO_FILE")

        if (deal_id, partner, client, filename) == ("NO_DEAL", "NO_PARTNER", "NO_CLIENT", "NO_FILE"):
            fallback_id = cls._normalize_scope_token(estimate_data.get("id"), uuid.uuid4().hex)
            return f"LOCAL_UNSCOPED::{fallback_id}"

        return f"LOCAL::DEAL={deal_id}::PARTNER={partner}::CLIENT={client}::FILE={filename}"

    @classmethod
    def compute_estimate_idempotency_key(
        cls,
        scope_key: str,
        version_tag: str,
        estimate_data: Dict[str, Any],
        items: List[Dict[str, Any]],
    ) -> str:
        """Computes a canonical SHA-256 idempotency key for a quote version save."""
        explicit_key = str(estimate_data.get("idempotency_key") or "").strip()
        if explicit_key:
            return explicit_key

        canonical_items = [
            {
                "line": str(it.get("lineNumber", "1.0")).strip(),
                "pn": str(it.get("partNumber", "")).strip().upper(),
                "qty": int(it.get("qty", 1)),
                "net": round(float(it.get("netCiscoUnit", 0.0)), 4),
                "unit": round(float(it.get("precioVentaUnitario", 0.0)), 4),
                "ext": round(float(it.get("precioVentaExtendido", 0.0)), 4),
            }
            for it in (items or [])
        ]
        payload = {
            "scope": scope_key,
            "version_tag": version_tag,
            "user_id": str(estimate_data.get("user_id", "")),
            "net_cisco_total": round(float(estimate_data.get("net_cisco_total", 0.0)), 2),
            "total_cotizado_intcomex": round(float(estimate_data.get("total_cotizado_intcomex", 0.0)), 2),
            "recargo_reglas_usd": round(float(estimate_data.get("recargo_reglas_usd", 0.0)), 2),
            "ganancia_intcomex_usd": round(float(estimate_data.get("ganancia_intcomex_usd", 0.0)), 2),
            "items": canonical_items,
        }
        digest = hashlib.sha256(json.dumps(payload, sort_keys=True).encode("utf-8")).hexdigest()[:32]
        return f"idemp_{digest}"

    def diagnose_duplicate_versions(self) -> Dict[str, Any]:
        """
        Item 7: Diagnoses any historical duplicate `(commercial_scope_key, version_tag)` records
        or multiple active versions per scope without automatically deleting them.
        """
        with self.get_connection() as conn:
            cur = conn.cursor()
            cur.execute("""
                SELECT commercial_scope_key, version_tag, COUNT(*) as cnt, GROUP_CONCAT(id) as ids
                FROM estimates
                GROUP BY commercial_scope_key, version_tag
                HAVING COUNT(*) > 1
            """)
            duplicate_version_groups = [dict(r) for r in cur.fetchall()]

            cur.execute("""
                SELECT id, commercial_scope_key, version_tag, legacy_duplicate_of, created_at
                FROM estimates
                WHERE legacy_duplicate_of IS NOT NULL
            """)
            flagged_legacy_duplicates = [dict(r) for r in cur.fetchall()]

            cur.execute("""
                SELECT commercial_scope_key, COUNT(*) as active_count, GROUP_CONCAT(id) as active_ids
                FROM estimates
                WHERE is_active_version = 1 AND legacy_duplicate_of IS NULL
                GROUP BY commercial_scope_key
                HAVING COUNT(*) > 1
            """)
            multiple_active_scopes = [dict(r) for r in cur.fetchall()]

            return {
                "duplicate_version_groups": duplicate_version_groups,
                "flagged_legacy_duplicates": flagged_legacy_duplicates,
                "multiple_active_scopes": multiple_active_scopes,
                "has_duplicates": len(duplicate_version_groups) > 0 or len(multiple_active_scopes) > 0,
            }

    # =========================================================================
    # ITEM 13: NON-OVERWRITING BO SKU CATALOG & ALIAS RESOLUTION IN SQLITE
    # =========================================================================

    @staticmethod
    def normalize_base_part_number_py(part_number: str) -> str:
        pn = (part_number or "").strip().upper()
        pn = re.sub(r"(-CBN|\s+CBN|=|-RF|-WS)$", "", pn, flags=re.IGNORECASE).strip()
        return pn

    def save_sku_override_db(self, sku: str, override_type: str):
        """Saves SKU override into SQLite database."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT OR REPLACE INTO sku_overrides (sku, override_type, updated_at)
                VALUES (?, ?, ?)
            """, (sku.strip().upper(), override_type, datetime.now().isoformat()))

    def get_sku_overrides_db(self) -> Dict[str, str]:
        """Gets all SKU overrides from SQLite database."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT sku, override_type FROM sku_overrides")
            rows = cursor.fetchall()
            return {row["sku"]: row["override_type"] for row in rows}

    def save_bo_sku_db(
        self,
        part_number: str,
        intcomex_sku: str,
        base_part_number: str = "",
        updated_by: str = "system",
        source: str = "MANUAL",
    ):
        """
        Item 13: Saves or updates an exact Cisco Part Number -> Intcomex SKU mapping in SQLite
        with provenance (`source`, `updated_by`, `updated_at`) without overwriting other variants
        of the same `base_part_number`.
        """
        clean_pn = (part_number or "").strip().upper()
        clean_sku = (intcomex_sku or "").strip().upper()
        if not clean_pn or not clean_sku:
            return
        clean_base = (base_part_number or "").strip().upper() or self.normalize_base_part_number_py(clean_pn)
        now_iso = datetime.now().isoformat()

        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT OR REPLACE INTO bo_sku_catalog (
                    part_number, intcomex_sku, base_part_number, source, updated_by, is_exact_variant, updated_at
                ) VALUES (?, ?, ?, ?, ?, 1, ?)
            """, (clean_pn, clean_sku, clean_base, (source or "MANUAL").upper(), updated_by or "system", now_iso))

    def resolve_bo_sku_db(self, part_number: str) -> Dict[str, Any]:
        """
        Item 13: Resolves a Part Number against SQLite `bo_sku_catalog` with explicit priority:
        1. `EXACT_MATCH` on `part_number` (unless querying a bare base key that has conflicting variants).
        2. `ALIAS_MATCH` on `base_part_number` when all variants of that base map to a single SKU.
        3. `AMBIGUOUS_ALIAS` when >= 2 distinct SKUs exist under the same `base_part_number`.
        4. `NOT_FOUND` when no match exists.
        """
        clean_pn = (part_number or "").strip().upper()
        clean_base = self.normalize_base_part_number_py(clean_pn)
        if not clean_pn:
            return {"status": "NOT_FOUND", "sku": "", "base_part_number": "", "candidates": [], "variants": []}

        with self.get_connection() as conn:
            cur = conn.cursor()
            cur.execute("SELECT * FROM bo_sku_catalog WHERE part_number = ?", (clean_pn,))
            exact_row = cur.fetchone()

            cur.execute(
                "SELECT * FROM bo_sku_catalog WHERE base_part_number = ? ORDER BY part_number ASC",
                (clean_base,),
            )
            base_rows = [dict(r) for r in cur.fetchall()]
            distinct_skus = sorted({r["intcomex_sku"].strip().upper() for r in base_rows if r.get("intcomex_sku")})

            if exact_row:
                exact_dict = dict(exact_row)
                if clean_pn == clean_base and len(distinct_skus) > 1:
                    return {
                        "status": "AMBIGUOUS_ALIAS",
                        "sku": "",
                        "matched_key": clean_base,
                        "base_part_number": clean_base,
                        "candidates": distinct_skus,
                        "variants": base_rows,
                    }
                return {
                    "status": "EXACT_MATCH",
                    "sku": exact_dict["intcomex_sku"],
                    "matched_key": clean_pn,
                    "base_part_number": clean_base,
                    "candidates": [exact_dict["intcomex_sku"]],
                    "variants": base_rows if base_rows else [exact_dict],
                }

            if len(distinct_skus) == 1:
                return {
                    "status": "ALIAS_MATCH",
                    "sku": distinct_skus[0],
                    "matched_key": clean_base,
                    "base_part_number": clean_base,
                    "candidates": distinct_skus,
                    "variants": base_rows,
                }

            if len(distinct_skus) > 1:
                return {
                    "status": "AMBIGUOUS_ALIAS",
                    "sku": "",
                    "matched_key": clean_base,
                    "base_part_number": clean_base,
                    "candidates": distinct_skus,
                    "variants": base_rows,
                }

            return {
                "status": "NOT_FOUND",
                "sku": "",
                "base_part_number": clean_base,
                "candidates": [],
                "variants": [],
            }

    def get_bo_skus_db(self) -> Dict[str, str]:
        """
        Item 13: Gets Part Number -> Intcomex SKU mappings from SQLite.
        Exact variants always preserve their specific SKU. Base keys are only included
        when all variants sharing that base resolve to a single unambiguous SKU.
        """
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT part_number, intcomex_sku, base_part_number FROM bo_sku_catalog")
            rows = cursor.fetchall()

            exact_map: Dict[str, str] = {}
            base_candidates: Dict[str, set] = {}

            for row in rows:
                sku = (row["intcomex_sku"] or "").strip().upper()
                pn = (row["part_number"] or "").strip().upper()
                base_pn = (row["base_part_number"] or "").strip().upper()
                if not sku:
                    continue
                if pn:
                    exact_map[pn] = sku
                if base_pn:
                    base_candidates.setdefault(base_pn, set()).add(sku)

            mapping: Dict[str, str] = {}
            # 1. Include unambiguous base aliases first
            for base_pn, skus in base_candidates.items():
                if len(skus) == 1:
                    mapping[base_pn] = next(iter(skus))
            # 2. Apply exact variant mappings so they are never overwritten
            for pn, sku in exact_map.items():
                if pn in base_candidates and len(base_candidates[pn]) > 1:
                    continue
                mapping[pn] = sku

            return mapping

    # =========================================================================
    # USERS, AUTH & AUDIT TRAIL
    # =========================================================================

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

    def log_audit_event(self, username: str, action: str, details: str):
        """Records an audit trail event into audit_logs table."""
        log_id = f"log-{uuid.uuid4().hex}"
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO audit_logs (id, username, action, details, created_at)
                VALUES (?, ?, ?, ?, ?)
            """, (log_id, username or "SYSTEM", action, details, datetime.now().isoformat()))

    def insert_user(self, user_id: str, username: str, full_name: str, email: str, pwd_hash: str, role: str) -> Tuple[bool, str]:
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    INSERT INTO users (id, username, full_name, email, password_hash, role)
                    VALUES (?, ?, ?, ?, ?, ?)
                """, (user_id, username, full_name, email, pwd_hash, role))
            return (True, f"Usuario '{username}' registrado correctamente.")
        except Exception as e:
            return (False, f"Error creando usuario: {e}")

    def update_user_password(self, username: str, pwd_hash: str) -> Tuple[bool, str]:
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("UPDATE users SET password_hash = ? WHERE username = ?", (pwd_hash, username))
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
            return (True, f"Datos del usuario '{original_username}' actualizados exitosamente.")
        except Exception as e:
            return (False, f"Error actualizando usuario: {e}")

    # =========================================================================
    # ITEM 7: TRANSACTIONAL & IDEMPOTENT ESTIMATE PERSISTENCE
    # =========================================================================

    def save_estimate_record(self, estimate_data: Dict[str, Any], items: List[Dict[str, Any]]) -> str:
        """
        Item 5 & Item 7: Saves processed estimate header and detailed items into SQLite
        inside an atomic transaction with:
        - Referential integrity check (`user_id` must exist in `users`).
        - Commercial scope key isolation (never grouping unrelated 'N/A' Cisco IDs together).
        - Idempotency on retries/double-clicks (returns existing `id` if identical payload already saved).
        - Protection against silent overwrite of historical versions (`(commercial_scope_key, version_tag)`).
        - Exactly one active version (`is_active_version = 1`) per `commercial_scope_key`.
        """
        est_cisco_id = str(estimate_data.get("estimate_id_cisco", "N/A")).strip() or "N/A"
        ver_num = int(estimate_data.get("version_number", 1))
        ver_tag = str(estimate_data.get("version_tag", f"v{ver_num}")).strip() or f"v{ver_num}"
        baseline_v0 = float(estimate_data.get("baseline_v0_amount", estimate_data.get("net_cisco_total", 0.0)))
        scope_key = self.compute_commercial_scope_key(estimate_data)
        idemp_key = self.compute_estimate_idempotency_key(scope_key, ver_tag, estimate_data, items)
        allow_draft_overwrite = bool(estimate_data.get("allow_draft_overwrite", False))

        requested_id = str(estimate_data.get("id") or "").strip()
        est_id = requested_id if requested_id else f"est-{uuid.uuid4().hex}"
        now_iso = datetime.now().isoformat()

        with self.get_connection(enforce_foreign_keys=True) as conn:
            conn.execute("BEGIN IMMEDIATE")
            try:
                cursor = conn.cursor()

                # 1. Idempotency check by `idempotency_key`
                cursor.execute(
                    "SELECT id, commercial_scope_key, version_tag FROM estimates WHERE idempotency_key = ? AND legacy_duplicate_of IS NULL",
                    (idemp_key,),
                )
                existing_by_idemp = cursor.fetchone()
                if existing_by_idemp:
                    conn.commit()
                    return existing_by_idemp["id"]

                # 2. Check if `(commercial_scope_key, version_tag)` already exists
                cursor.execute(
                    """
                    SELECT id, idempotency_key, net_cisco_total, total_cotizado_intcomex, items_count
                    FROM estimates
                    WHERE commercial_scope_key = ? AND version_tag = ? AND legacy_duplicate_of IS NULL
                    """,
                    (scope_key, ver_tag),
                )
                existing_by_ver = cursor.fetchone()
                if existing_by_ver:
                    existing_id = existing_by_ver["id"]
                    same_totals = (
                        abs(float(existing_by_ver["net_cisco_total"] or 0.0) - float(estimate_data.get("net_cisco_total", 0.0))) < 0.005
                        and abs(float(existing_by_ver["total_cotizado_intcomex"] or 0.0) - float(estimate_data.get("total_cotizado_intcomex", 0.0))) < 0.005
                        and int(existing_by_ver["items_count"] or 0) == len(items)
                    )
                    if existing_by_ver["idempotency_key"] == idemp_key or (existing_by_ver["idempotency_key"] is None and same_totals):
                        cursor.execute(
                            "UPDATE estimates SET idempotency_key = COALESCE(idempotency_key, ?) WHERE id = ?",
                            (idemp_key, existing_id),
                        )
                        conn.commit()
                        return existing_id

                    if not allow_draft_overwrite:
                        raise ValueError(
                            f"Conflicto de versión duplicada: la versión '{ver_tag}' para '{scope_key}' "
                            f"ya existe (id={existing_id}) con contenido distinto y es inmutable."
                        )

                    # Si es edición explícita de borrador (`allow_draft_overwrite=True`), actualizar in-place
                    cursor.execute("DELETE FROM estimate_items WHERE estimate_id = ?", (existing_id,))
                    cursor.execute("UPDATE estimates SET is_active_version = 0 WHERE commercial_scope_key = ?", (scope_key,))
                    cursor.execute(
                        """
                        UPDATE estimates
                        SET user_id = ?, deal_id = ?, partner_name = ?, client_final_name = ?,
                            original_filename = ?, stored_filepath = ?, net_cisco_total = ?,
                            total_cotizado_intcomex = ?, recargo_reglas_usd = ?, ganancia_intcomex_usd = ?,
                            items_count = ?, updated_at = ?, version_number = ?, baseline_v0_amount = ?,
                            is_active_version = 1, idempotency_key = ?
                        WHERE id = ?
                        """,
                        (
                            estimate_data["user_id"],
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
                            now_iso,
                            ver_num,
                            baseline_v0,
                            idemp_key,
                            existing_id,
                        ),
                    )
                    est_id = existing_id
                else:
                    # 3. Deactivate any previous active version within the same `commercial_scope_key`
                    cursor.execute(
                        """
                        UPDATE estimates
                        SET is_active_version = 0, updated_at = ?
                        WHERE commercial_scope_key = ? AND is_active_version = 1
                        """,
                        (now_iso, scope_key),
                    )

                    cursor.execute(
                        """
                        INSERT INTO estimates (
                            id, user_id, estimate_id_cisco, deal_id, partner_name, client_final_name,
                            original_filename, stored_filepath, net_cisco_total, total_cotizado_intcomex,
                            recargo_reglas_usd, ganancia_intcomex_usd, items_count, created_at, updated_at,
                            version_number, version_tag, baseline_v0_amount, is_active_version,
                            commercial_scope_key, idempotency_key
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        """,
                        (
                            est_id,
                            estimate_data["user_id"],
                            est_cisco_id,
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
                            now_iso,
                            now_iso,
                            ver_num,
                            ver_tag,
                            baseline_v0,
                            1,
                            scope_key,
                            idemp_key,
                        ),
                    )

                for item in items:
                    item_id = str(item.get("id") or f"itm-{uuid.uuid4().hex}")
                    cursor.execute(
                        """
                        INSERT INTO estimate_items (
                            id, estimate_id, line_number, part_number, description, qty,
                            net_cisco_unit, is_intangible, lleva_arancel, costo_internacion,
                            costo_arancel, precio_venta_unitario, precio_venta_extendido
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        """,
                        (
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
                            item.get("precioVentaExtendido", 0.0),
                        ),
                    )

                conn.commit()
            except Exception:
                conn.rollback()
                raise
        return est_id

    def get_user_kpis(self, user_id: str = None, is_admin: bool = False) -> Dict[str, Any]:
        """Calculates global or personal KPIs for dashboard deduplicated by commercial_scope_key."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            scope_expr = "CASE WHEN commercial_scope_key != '' THEN commercial_scope_key ELSE estimate_id_cisco END"
            if is_admin or user_id is None:
                query = f"""
                    SELECT 
                        COUNT(DISTINCT {scope_expr}) as total_files,
                        COALESCE(SUM(CASE WHEN is_active_version = 1 AND legacy_duplicate_of IS NULL THEN total_cotizado_intcomex ELSE 0 END), 0) as total_revenue,
                        COALESCE(SUM(CASE WHEN is_active_version = 1 AND legacy_duplicate_of IS NULL THEN baseline_v0_amount ELSE 0 END), 0) as total_baseline,
                        COALESCE(SUM(CASE WHEN is_active_version = 1 AND legacy_duplicate_of IS NULL THEN ganancia_intcomex_usd ELSE 0 END), 0) as total_profit
                    FROM estimates
                """
                cursor.execute(query)
            else:
                query = f"""
                    SELECT 
                        COUNT(DISTINCT {scope_expr}) as total_files,
                        COALESCE(SUM(CASE WHEN is_active_version = 1 AND legacy_duplicate_of IS NULL THEN total_cotizado_intcomex ELSE 0 END), 0) as total_revenue,
                        COALESCE(SUM(CASE WHEN is_active_version = 1 AND legacy_duplicate_of IS NULL THEN baseline_v0_amount ELSE 0 END), 0) as total_baseline,
                        COALESCE(SUM(CASE WHEN is_active_version = 1 AND legacy_duplicate_of IS NULL THEN ganancia_intcomex_usd ELSE 0 END), 0) as total_profit
                    FROM estimates 
                    WHERE user_id = ?
                """
                cursor.execute(query, (user_id,))
            row = cursor.fetchone()
            d = dict(row)
            if d.get("total_revenue", 0) == 0 and d.get("total_files", 0) > 0:
                if is_admin or user_id is None:
                    cursor.execute(f"""
                        SELECT 
                            COALESCE(SUM(total_cotizado_intcomex), 0) as rev, 
                            COALESCE(SUM(ganancia_intcomex_usd), 0) as prof,
                            COALESCE(SUM(net_cisco_total), 0) as base
                        FROM (SELECT * FROM estimates GROUP BY {scope_expr})
                    """)
                else:
                    cursor.execute(f"""
                        SELECT 
                            COALESCE(SUM(total_cotizado_intcomex), 0) as rev, 
                            COALESCE(SUM(ganancia_intcomex_usd), 0) as prof,
                            COALESCE(SUM(net_cisco_total), 0) as base
                        FROM (SELECT * FROM estimates WHERE user_id = ? GROUP BY {scope_expr})
                    """, (user_id,))
                sub = cursor.fetchone()
                if sub:
                    d["total_revenue"] = sub["rev"]
                    d["total_profit"] = sub["prof"]
                    d["total_baseline"] = sub["base"]
            return d

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
            status_str = "activado" if is_active else "desactivado"
            return (True, f"Usuario '{username}' {status_str} exitosamente.")
        except Exception as e:
            return (False, f"Error cambiando estado de usuario: {e}")

    def delete_user(self, username: str) -> Tuple[bool, str]:
        """
        Item 5: Deletes a user only if they have no historical estimates.
        If the user has associated estimates, blocks deletion (`ON DELETE RESTRICT` policy)
        to prevent loss of financial history and recommends deactivation (`is_active = 0`).
        """
        if username == "mskill":
            return (False, "No es posible eliminar al usuario administrador principal (mskill).")
        try:
            with self.get_connection(enforce_foreign_keys=True) as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT id FROM users WHERE username = ?", (username,))
                user_row = cursor.fetchone()
                if not user_row:
                    return (False, f"Usuario '{username}' no existe.")

                cursor.execute("SELECT COUNT(*) as cnt FROM estimates WHERE user_id = ?", (user_row["id"],))
                est_count = int(cursor.fetchone()["cnt"] or 0)
                if est_count > 0:
                    return (
                        False,
                        f"No es posible eliminar físicamente al usuario '{username}' porque posee {est_count} "
                        f"cotización(es) histórica(s). Desactívelo (is_active=0) para preservar el historial financiero.",
                    )

                cursor.execute("DELETE FROM users WHERE username = ?", (username,))
            return (True, f"Usuario '{username}' eliminado correctamente.")
        except Exception as e:
            return (False, f"Error eliminando usuario: {e}")

    def get_audit_logs(self) -> List[Dict[str, Any]]:
        """Retrieves audit trail logs (Admin only)."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 300")
            return [dict(row) for row in cursor.fetchall()]

    # =========================================================================
    # ITEM 14: EXPLAIN QUERY PLAN VERIFICATION FOR CRITICAL SQLITE QUERIES
    # =========================================================================

    def explain_critical_queries(self) -> Dict[str, List[Dict[str, Any]]]:
        """
        Item 14: Executes `EXPLAIN QUERY PLAN` on the critical SQLite queries to verify
        that secondary indexes (`SEARCH ... USING INDEX`) are used instead of full table scans.
        """
        queries = {
            "estimates_by_user": (
                "SELECT * FROM estimates WHERE user_id = ? ORDER BY created_at DESC",
                ("usr-001-admin",),
            ),
            "estimates_active_by_scope": (
                "SELECT * FROM estimates WHERE commercial_scope_key = ? AND is_active_version = 1",
                ("CISCO::EST-100",),
            ),
            "estimate_items_by_estimate": (
                "SELECT * FROM estimate_items WHERE estimate_id = ?",
                ("est-100",),
            ),
            "audit_logs_by_username_date": (
                "SELECT * FROM audit_logs WHERE username = ? ORDER BY created_at DESC LIMIT 50",
                ("mskill",),
            ),
            "bo_sku_by_base_pn": (
                "SELECT * FROM bo_sku_catalog WHERE base_part_number = ?",
                ("C9200L-24P-4G-E",),
            ),
        }
        plans: Dict[str, List[Dict[str, Any]]] = {}
        with self.get_connection() as conn:
            cur = conn.cursor()
            for key, (sql, params) in queries.items():
                cur.execute(f"EXPLAIN QUERY PLAN {sql}", params)
                plans[key] = [dict(r) for r in cur.fetchall()]
        return plans


