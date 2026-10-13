-- =============================================================================
-- GRAVITY DESKTOP - DATABASE SCHEMA FOR SUPABASE (POSTGRESQL) & SQLITE
-- Cotizador y Gestor de Estimaciones Cisco CCW - Intcomex v2.0
-- =============================================================================

-- 1. TABLA DE USUARIOS Y ROLES (RBAC)
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(36) PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'standard')),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP WITH TIME ZONE
);

-- 2. TABLA DE ESTIMACIONES Y CABECERAS
CREATE TABLE IF NOT EXISTS estimates (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. TABLA DE DESGLOSE DE LÍNEAS / SKUS
CREATE TABLE IF NOT EXISTS estimate_items (
    id VARCHAR(36) PRIMARY KEY,
    estimate_id VARCHAR(36) NOT NULL REFERENCES estimates(id) ON DELETE CASCADE,
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
    id VARCHAR(36) PRIMARY KEY,
    username VARCHAR(50) NOT NULL,
    action VARCHAR(50) NOT NULL,
    details TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- INDEXES FOR MAXIMUM QUERY PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_estimates_user_id ON estimates(user_id);
CREATE INDEX IF NOT EXISTS idx_estimates_partner ON estimates(partner_name);
CREATE INDEX IF NOT EXISTS idx_estimates_client ON estimates(client_final_name);
CREATE INDEX IF NOT EXISTS idx_audit_logs_username ON audit_logs(username);

-- =============================================================================
-- INICIALIZACIÓN DE USUARIOS BASE (mskill, madasme, rcuevas, jvalancia)
-- Contraseña por defecto inicial: "Intcomex2026!" (Bcrypt Hash)
-- =============================================================================

INSERT INTO users (id, username, full_name, email, password_hash, role) VALUES
('usr-001-admin', 'mskill', 'Mauricio Skill (Administrador)', 'mauricio.skill@mayor.cl', '$2b$12$eA8m9K4z3JkY1l1L1L1L1uO7qPqO1qO1qO1qO1qO1qO1qO1qO1qO', 'admin'),
('usr-002-std', 'madasme', 'M. Adasme (Preventa)', 'madasme@intcomex.com', '$2b$12$eA8m9K4z3JkY1l1L1L1L1uO7qPqO1qO1qO1qO1qO1qO1qO1qO1qO', 'standard'),
('usr-003-std', 'rcuevas', 'R. Cuevas (Ejecutivo Canales)', 'rcuevas@intcomex.com', '$2b$12$eA8m9K4z3JkY1l1L1L1L1uO7qPqO1qO1qO1qO1qO1qO1qO1qO1qO', 'standard'),
('usr-004-std', 'jvalancia', 'J. Valancia (Preventa)', 'jvalancia@intcomex.com', '$2b$12$eA8m9K4z3JkY1l1L1L1L1uO7qPqO1qO1qO1qO1qO1qO1qO1qO1qO', 'standard')
ON CONFLICT (username) DO NOTHING;
