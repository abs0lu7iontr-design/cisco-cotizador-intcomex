-- =============================================================================
-- GRAVITY DESKTOP - DATABASE SCHEMA FOR SUPABASE (POSTGRESQL) & SQLITE
-- Cotizador y Gestor de Estimaciones Cisco CCW - Intcomex v2.1
-- Aligned with Schema Migration Version: V005
-- =============================================================================

-- 0. TABLA DE CONTROL DE MIGRACIONES DE ESQUEMA (Item 6)
CREATE TABLE IF NOT EXISTS schema_migrations (
    version VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    checksum VARCHAR(64) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'APPLIED',
    execution_ms INT DEFAULT 0
);

-- 1. TABLA DE USUARIOS Y ROLES (RBAC)
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(64) PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'pm', 'preventa', 'standard')),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP WITH TIME ZONE
);

-- 2. TABLA DE ESTIMACIONES Y CABECERAS (Items 5, 6, 7)
-- Política ON DELETE sobre user_id: RESTRICT para impedir pérdida accidental de historial
-- financiero al dar de baja un usuario (los usuarios con historial deben desactivarse con is_active = FALSE).
CREATE TABLE IF NOT EXISTS estimates (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    estimate_id_cisco VARCHAR(50) NOT NULL,
    deal_id VARCHAR(50),
    partner_name VARCHAR(100) NOT NULL,
    client_final_name VARCHAR(100) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    stored_filepath TEXT NOT NULL,
    net_cisco_total NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    total_cotizado_intcomex NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    recargo_reglas_usd NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    ganancia_intcomex_usd NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    items_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    version_number INT NOT NULL DEFAULT 1,
    version_tag VARCHAR(32) NOT NULL DEFAULT 'v1',
    baseline_v0_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    is_active_version INT NOT NULL DEFAULT 1,
    commercial_scope_key VARCHAR(255) NOT NULL DEFAULT '',
    idempotency_key VARCHAR(128),
    legacy_duplicate_of VARCHAR(64)
);

-- 3. TABLA DE DESGLOSE DE LÍNEAS / SKUS (Item 5)
-- Política ON DELETE sobre estimate_id: CASCADE (las líneas pertenecen íntegramente a una versión de cotización)
CREATE TABLE IF NOT EXISTS estimate_items (
    id VARCHAR(64) PRIMARY KEY,
    estimate_id VARCHAR(64) NOT NULL REFERENCES estimates(id) ON DELETE CASCADE,
    line_number VARCHAR(20) NOT NULL,
    part_number VARCHAR(100) NOT NULL,
    description TEXT,
    qty INT NOT NULL DEFAULT 1,
    net_cisco_unit NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    is_intangible BOOLEAN DEFAULT FALSE,
    lleva_arancel BOOLEAN DEFAULT FALSE,
    costo_internacion NUMERIC(12, 2) DEFAULT 0.00,
    costo_arancel NUMERIC(12, 2) DEFAULT 0.00,
    precio_venta_unitario NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    precio_venta_extendido NUMERIC(12, 2) NOT NULL DEFAULT 0.00
);

-- 4. TABLA DE REGISTROS DE AUDITORÍA (AUDIT LOGS)
CREATE TABLE IF NOT EXISTS audit_logs (
    id VARCHAR(64) PRIMARY KEY,
    username VARCHAR(50) NOT NULL,
    action VARCHAR(50) NOT NULL,
    details TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. TABLA DE OVERRIDES DE REGLAS DE SKU (TANGIBLE / INTANGIBLE)
CREATE TABLE IF NOT EXISTS sku_overrides (
    sku VARCHAR(100) PRIMARY KEY,
    override_type VARCHAR(50) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. TABLA DE CATÁLOGO DE MAPEOS PART NUMBER CISCO <-> SKU INTCOMEX (Item 13)
CREATE TABLE IF NOT EXISTS bo_sku_catalog (
    part_number VARCHAR(100) PRIMARY KEY,
    intcomex_sku VARCHAR(64) NOT NULL,
    base_part_number VARCHAR(100),
    source VARCHAR(32) NOT NULL DEFAULT 'MANUAL',
    updated_by VARCHAR(64) NOT NULL DEFAULT 'system',
    is_exact_variant INT NOT NULL DEFAULT 1,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- INDEXES & CONSTRAINTS FOR INTEGRITY AND QUERY PERFORMANCE (Items 7, 13, 14)
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_estimates_user_id ON estimates(user_id);
CREATE INDEX IF NOT EXISTS idx_estimates_partner ON estimates(partner_name);
CREATE INDEX IF NOT EXISTS idx_estimates_client ON estimates(client_final_name);
CREATE INDEX IF NOT EXISTS idx_estimates_created_at ON estimates(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_estimates_cisco_id ON estimates(estimate_id_cisco);
CREATE INDEX IF NOT EXISTS idx_estimates_scope_active ON estimates(commercial_scope_key, is_active_version);
CREATE UNIQUE INDEX IF NOT EXISTS idx_estimates_unique_idempotency
    ON estimates(idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_estimates_unique_scope_version
    ON estimates(commercial_scope_key, version_tag) WHERE legacy_duplicate_of IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_estimates_single_active_per_scope
    ON estimates(commercial_scope_key) WHERE is_active_version = 1 AND legacy_duplicate_of IS NULL;

CREATE INDEX IF NOT EXISTS idx_estimate_items_estimate_id ON estimate_items(estimate_id);
CREATE INDEX IF NOT EXISTS idx_estimate_items_part_number ON estimate_items(part_number);
CREATE INDEX IF NOT EXISTS idx_audit_logs_username ON audit_logs(username);
CREATE INDEX IF NOT EXISTS idx_audit_logs_username_created_at ON audit_logs(username, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bo_sku_base_pn ON bo_sku_catalog(base_part_number);

-- =============================================================================
-- INICIALIZACIÓN DE USUARIOS BASE (mskill, madasme, rcuevas, jvalancia)
-- Contraseña por defecto inicial: "Intcomex2026!" (Bcrypt Hash)
-- =============================================================================

INSERT INTO users (id, username, full_name, email, password_hash, role) VALUES
('usr-001-admin', 'mskill', 'Mauricio Skill (Administrador)', 'mauricio.skill@mayor.cl', '$2b$12$eA8m9K4z3JkY1l1L1L1L1uO7qPqO1qO1qO1qO1qO1qO1qO1qO1qO', 'admin'),
('usr-002-pm', 'madasme', 'M. Adasme (Product Manager)', 'madasme@intcomex.com', '$2b$12$eA8m9K4z3JkY1l1L1L1L1uO7qPqO1qO1qO1qO1qO1qO1qO1qO1qO', 'pm'),
('usr-003-pm', 'rcuevas', 'R. Cuevas (Product Manager)', 'rcuevas@intcomex.com', '$2b$12$eA8m9K4z3JkY1l1L1L1L1uO7qPqO1qO1qO1qO1qO1qO1qO1qO1qO', 'pm'),
('usr-004-pm', 'jvalancia', 'J. Valancia (Product Manager)', 'jvalancia@intcomex.com', '$2b$12$eA8m9K4z3JkY1l1L1L1L1uO7qPqO1qO1qO1qO1qO1qO1qO1qO1qO', 'pm')
ON CONFLICT (username) DO NOTHING;
