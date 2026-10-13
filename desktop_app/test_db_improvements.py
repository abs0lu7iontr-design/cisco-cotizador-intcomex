# -*- coding: utf-8 -*-
"""
QA Suite for SQLite Persistence, Referential Integrity, Versioned Migrations,
Idempotent Estimate Versioning, BO SKU Alias Resolution, and Query Plans (Items 5, 6, 7, 13, 14).
Uses exclusively temporary SQLite databases (tempfile.TemporaryDirectory) and synthetic data.
Never touches real user databases.
"""

import os
import sqlite3
import sys
import tempfile

# Support both direct script execution and stdin execution (`python -`)
repo_root = os.getcwd()
desktop_dir = os.path.join(repo_root, "desktop_app")
if desktop_dir not in sys.path:
    sys.path.insert(0, desktop_dir)
if repo_root not in sys.path:
    sys.path.insert(0, repo_root)

from db_manager import DatabaseManager


def test_item5_referential_integrity():
    with tempfile.TemporaryDirectory() as tmpdir:
        db_path = os.path.join(tmpdir, "test_item5.db")
        db = DatabaseManager(db_path=db_path, auto_migrate=True, consolidate_on_init=False)

        # 5A. Verify PRAGMA foreign_keys = ON in managed connection
        diag0 = db.diagnose_referential_integrity()
        assert diag0["foreign_keys_enabled"] is True, "PRAGMA foreign_keys must be ON"
        assert diag0["has_orphans"] is False

        # 5B. Attempt to insert an estimate for a non-existent user_id -> must raise IntegrityError
        raised_fk = False
        try:
            db.save_estimate_record(
                {
                    "user_id": "usr-non-existent-999",
                    "estimate_id_cisco": "EST-FK-FAIL",
                    "deal_id": "DEAL-FK",
                    "partner_name": "Partner FK",
                    "client_final_name": "Client FK",
                    "original_filename": "fk.xlsx",
                    "stored_filepath": "/tmp/fk.xlsx",
                    "net_cisco_total": 1000.0,
                    "total_cotizado_intcomex": 1100.0,
                    "recargo_reglas_usd": 0.0,
                    "ganancia_intcomex_usd": 100.0,
                },
                [{"lineNumber": "1.0", "partNumber": "C9200L-24P-4G-E", "qty": 1, "netCiscoUnit": 1000.0}],
            )
        except sqlite3.IntegrityError:
            raised_fk = True
        assert raised_fk, "Inserting estimate with non-existent user_id must fail with IntegrityError"

        # 5C. Create a user, save an estimate with 2 line items, and verify ON DELETE RESTRICT on user deletion
        ok_user, _ = db.insert_user("usr-qa-5", "qa_user_5", "QA User 5", "qa5@test.cl", "hash123", "pm")
        assert ok_user is True

        est_id = db.save_estimate_record(
            {
                "user_id": "usr-qa-5",
                "estimate_id_cisco": "EST-FK-OK-1",
                "deal_id": "DEAL-500",
                "partner_name": "Partner 5",
                "client_final_name": "Client 5",
                "original_filename": "ok5.xlsx",
                "stored_filepath": "/tmp/ok5.xlsx",
                "net_cisco_total": 2000.0,
                "total_cotizado_intcomex": 2200.0,
                "recargo_reglas_usd": 20.0,
                "ganancia_intcomex_usd": 180.0,
            },
            [
                {"lineNumber": "1.0", "partNumber": "C9200L-24P-4G-E", "qty": 1, "netCiscoUnit": 1000.0},
                {"lineNumber": "2.0", "partNumber": "CON-SNT-C9200L24", "qty": 1, "netCiscoUnit": 1000.0},
            ],
        )

        # Deleting a user who owns historical estimates must be blocked without losing history
        ok_del_user, msg_del_user = db.delete_user("qa_user_5")
        assert ok_del_user is False, "Deleting user with estimates must be blocked by ON DELETE RESTRICT policy"
        assert "cotización(es) histórica(s)" in msg_del_user

        # 5D. Deleting the estimate cascades to estimate_items (`ON DELETE CASCADE`)
        ok_del_est, _ = db.delete_estimate_record(est_id)
        assert ok_del_est is True
        with db.get_connection() as conn:
            cnt_items = conn.execute(
                "SELECT COUNT(*) FROM estimate_items WHERE estimate_id = ?", (est_id,)
            ).fetchone()[0]
            assert cnt_items == 0, "estimate_items must be deleted via ON DELETE CASCADE when parent estimate is deleted"

        # Now user has 0 estimates and can be deleted cleanly
        ok_del_user_after, _ = db.delete_user("qa_user_5")
        assert ok_del_user_after is True

        # 5E. Legacy orphan detection without automatic deletion
        with db.get_connection(enforce_foreign_keys=False) as conn:
            conn.execute(
                """
                INSERT INTO estimates (
                    id, user_id, estimate_id_cisco, deal_id, partner_name, client_final_name,
                    original_filename, stored_filepath, net_cisco_total, total_cotizado_intcomex,
                    recargo_reglas_usd, ganancia_intcomex_usd, items_count, commercial_scope_key
                ) VALUES ('est-orphan-1', 'usr-ghost-missing', 'EST-ORPHAN', 'D1', 'P1', 'C1', 'f.xlsx', '/f.xlsx', 100, 110, 0, 10, 1, 'CISCO::EST-ORPHAN')
                """
            )
        diag_orphan = db.diagnose_referential_integrity()
        assert diag_orphan["has_orphans"] is True
        assert len(diag_orphan["orphan_estimates"]) == 1
        assert diag_orphan["orphan_estimates"][0]["id"] == "est-orphan-1"

    print("✓ SQLite Item 5 (Referential Integrity & Orphan Diagnostics) passed")


def test_item6_versioned_migrations():
    with tempfile.TemporaryDirectory() as tmpdir:
        # 6A. Fresh installation applies V001..V005 and matches CURRENT_SCHEMA_VERSION
        fresh_db_path = os.path.join(tmpdir, "fresh_v005.db")
        db_fresh = DatabaseManager(db_path=fresh_db_path, auto_migrate=True, consolidate_on_init=False)
        applied = db_fresh.get_applied_migrations()
        versions = [m["version"] for m in applied]
        assert versions == ["V001", "V002", "V003", "V004", "V005"], f"Unexpected migrations: {versions}"

        # 6B. Second execution of run_migrations() is idempotent (0 new migrations)
        second_run = db_fresh.run_migrations()
        assert second_run == [], "Second execution of run_migrations must be a no-op"

        # 6C. Upgrade from a legacy pre-V003 SQLite database preserves historical rows and adds new columns/indexes
        legacy_db_path = os.path.join(tmpdir, "legacy_v001.db")
        raw_conn = sqlite3.connect(legacy_db_path)
        raw_conn.executescript(
            """
            CREATE TABLE users (
                id TEXT PRIMARY KEY,
                username TEXT UNIQUE NOT NULL,
                full_name TEXT NOT NULL,
                email TEXT,
                password_hash TEXT NOT NULL,
                role TEXT NOT NULL DEFAULT 'standard',
                is_active INTEGER NOT NULL DEFAULT 1,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                last_login TEXT
            );
            INSERT INTO users (id, username, full_name, password_hash, role)
            VALUES ('usr-leg-1', 'legacy_pm', 'Legacy PM', 'hash', 'standard');

            CREATE TABLE estimates (
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
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            );
            INSERT INTO estimates (
                id, user_id, estimate_id_cisco, deal_id, partner_name, client_final_name,
                original_filename, stored_filepath, net_cisco_total, total_cotizado_intcomex,
                recargo_reglas_usd, ganancia_intcomex_usd, items_count
            ) VALUES (
                'est-leg-100', 'usr-leg-1', 'EST-LEGACY-100', 'DEAL-L1', 'Partner L', 'Client L',
                'leg.xlsx', '/leg.xlsx', 5000.0, 5500.0, 50.0, 450.0, 2
            );
            """
        )
        raw_conn.commit()
        raw_conn.close()

        db_upgraded = DatabaseManager(db_path=legacy_db_path, auto_migrate=True, consolidate_on_init=False)
        assert [m["version"] for m in db_upgraded.get_applied_migrations()] == [
            "V001",
            "V002",
            "V003",
            "V004",
            "V005",
        ]
        est_list = db_upgraded.get_estimates_list(is_admin=True)
        assert len(est_list) == 1
        assert est_list[0]["id"] == "est-leg-100"
        assert est_list[0]["commercial_scope_key"] == "CISCO::EST-LEGACY-100"
        assert est_list[0]["version_tag"] == "v1"
        assert est_list[0]["baseline_v0_amount"] == 5000.0

    print("✓ SQLite Item 6 (Versioned Schema Migrations & Legacy Upgrade) passed")


def test_item7_version_uniqueness_and_idempotency():
    with tempfile.TemporaryDirectory() as tmpdir:
        db_path = os.path.join(tmpdir, "test_item7.db")
        db = DatabaseManager(db_path=db_path, auto_migrate=True, consolidate_on_init=False)

        items = [
            {
                "lineNumber": "1.0",
                "partNumber": "C9300-24T-E",
                "description": "Catalyst 9300",
                "qty": 2,
                "netCiscoUnit": 2000.0,
                "precioVentaUnitario": 2200.0,
                "precioVentaExtendido": 4400.0,
            }
        ]
        payload_v1 = {
            "user_id": "usr-001-admin",
            "estimate_id_cisco": "EST-IDEMP-700",
            "deal_id": "DEAL-700",
            "partner_name": "Partner 7",
            "client_final_name": "Client 7",
            "original_filename": "quote7.xlsx",
            "stored_filepath": "/tmp/quote7_v1.xlsx",
            "net_cisco_total": 4000.0,
            "total_cotizado_intcomex": 4400.0,
            "recargo_reglas_usd": 40.0,
            "ganancia_intcomex_usd": 360.0,
            "version_number": 1,
            "version_tag": "v1",
            "baseline_v0_amount": 4000.0,
        }

        # 7A. Double-click / identical retry returns the exact same record ID without creating a duplicate
        id_first = db.save_estimate_record(payload_v1, items)
        id_retry = db.save_estimate_record(payload_v1, items)
        assert id_first == id_retry, "Idempotent retry of identical version payload must return existing ID"

        # 7B. Attempting to overwrite historical v1 with different totals without allow_draft_overwrite raises ValueError
        raised_conflict = False
        try:
            db.save_estimate_record(
                {**payload_v1, "total_cotizado_intcomex": 4999.0},
                [{**items[0], "precioVentaUnitario": 2499.5, "precioVentaExtendido": 4999.0}],
            )
        except ValueError:
            raised_conflict = True
        assert raised_conflict, "Must reject silent overwrite of existing historical version v1"

        # 7C. Saving v2 deactivates v1 (`is_active_version = 0`) and sets v2 as the single active version
        payload_v2 = {
            **payload_v1,
            "version_number": 2,
            "version_tag": "v2",
            "total_cotizado_intcomex": 4600.0,
            "ganancia_intcomex_usd": 560.0,
        }
        id_v2 = db.save_estimate_record(
            payload_v2,
            [{**items[0], "precioVentaUnitario": 2300.0, "precioVentaExtendido": 4600.0}],
        )
        assert id_v2 != id_first

        with db.get_connection() as conn:
            active_rows = conn.execute(
                "SELECT id, version_tag FROM estimates WHERE commercial_scope_key = 'CISCO::EST-IDEMP-700' AND is_active_version = 1"
            ).fetchall()
            assert len(active_rows) == 1
            assert active_rows[0]["id"] == id_v2
            assert active_rows[0]["version_tag"] == "v2"

        # 7D. Two distinct quotes with estimate_id_cisco = 'N/A' must NOT collide into a single quote
        na_quote_a = {
            **payload_v1,
            "estimate_id_cisco": "N/A",
            "deal_id": "DEAL-NA-A",
            "partner_name": "Partner Alpha",
            "client_final_name": "Client Alpha",
            "original_filename": "bom_alpha.xlsx",
        }
        na_quote_b = {
            **payload_v1,
            "estimate_id_cisco": "N/A",
            "deal_id": "DEAL-NA-B",
            "partner_name": "Partner Beta",
            "client_final_name": "Client Beta",
            "original_filename": "bom_beta.xlsx",
        }
        id_na_a = db.save_estimate_record(na_quote_a, items)
        id_na_b = db.save_estimate_record(na_quote_b, items)
        assert id_na_a != id_na_b, "Unrelated quotes with 'N/A' Cisco ID must not be grouped together"

        kpis = db.get_user_kpis(is_admin=True)
        assert kpis["total_files"] == 3, "KPIs must count 3 distinct commercial scopes (EST-IDEMP-700, NA-A, NA-B)"

    print("✓ SQLite Item 7 (Version Uniqueness, Single Active Version & 'N/A' Isolation) passed")


def test_item13_and_item14_bo_sku_and_query_plans():
    with tempfile.TemporaryDirectory() as tmpdir:
        db_path = os.path.join(tmpdir, "test_item13_14.db")
        db = DatabaseManager(db_path=db_path, auto_migrate=True, consolidate_on_init=False)

        # 13A. Save two variants sharing base C9300-48P-E with distinct Intcomex SKUs
        db.save_bo_sku_db("C9300-48P-E-CBN", "IX-9300-48P-CBN", updated_by="qa", source="MANUAL")
        db.save_bo_sku_db("C9300-48P-E-RF", "IX-9300-48P-RF", updated_by="qa", source="EXCEL_IMPORT")
        # Save one unambiguous variant for C9200L-24T-4G-E
        db.save_bo_sku_db("C9200L-24T-4G-E-CBN", "IX-9200L-24T", updated_by="qa", source="MANUAL")

        res_cbn = db.resolve_bo_sku_db("C9300-48P-E-CBN")
        res_rf = db.resolve_bo_sku_db("C9300-48P-E-RF")
        res_ambig = db.resolve_bo_sku_db("C9300-48P-E")
        res_alias = db.resolve_bo_sku_db("C9200L-24T-4G-E")

        assert res_cbn["status"] == "EXACT_MATCH" and res_cbn["sku"] == "IX-9300-48P-CBN"
        assert res_rf["status"] == "EXACT_MATCH" and res_rf["sku"] == "IX-9300-48P-RF"
        assert res_ambig["status"] == "AMBIGUOUS_ALIAS" and res_ambig["sku"] == ""
        assert res_ambig["candidates"] == ["IX-9300-48P-CBN", "IX-9300-48P-RF"]
        assert res_alias["status"] == "ALIAS_MATCH" and res_alias["sku"] == "IX-9200L-24T"

        # 14A. Verify EXPLAIN QUERY PLAN uses secondary indexes (`USING INDEX`)
        plans = db.explain_critical_queries()
        for query_name, steps in plans.items():
            detail_text = " | ".join(str(s.get("detail", "")) for s in steps)
            assert "USING INDEX" in detail_text, f"Query '{query_name}' did not use an index: {detail_text}"

        # 14B. Verify connection lifecycle: 0 leaked open connections after all operations
        stats = db.get_connection_stats()
        assert stats["open_connections"] == 0, f"Expected 0 open connections, got: {stats}"
        assert stats["total_opened"] == stats["total_closed"] and stats["total_opened"] > 0

    print("✓ SQLite Items 13 & 14 (BO SKU Variant/Alias Resolution, EXPLAIN QUERY PLAN & Connection Lifecycle) passed")


if __name__ == "__main__":
    test_item5_referential_integrity()
    test_item6_versioned_migrations()
    test_item7_version_uniqueness_and_idempotency()
    test_item13_and_item14_bo_sku_and_query_plans()
    print("=== ALL SQLITE PERSISTENCE QA TESTS PASSED ===")
