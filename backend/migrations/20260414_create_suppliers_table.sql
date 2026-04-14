-- Migration: create suppliers table
-- Date: 2026-04-14
--
-- UP
CREATE TABLE IF NOT EXISTS suppliers (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(150) NOT NULL UNIQUE,
  phone VARCHAR(50) NULL,
  address TEXT NULL,
  notes TEXT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE INDEX idx_suppliers_name ON suppliers(name);

-- DOWN
-- Jalankan hanya jika ingin rollback tabel supplier.
DROP TABLE IF EXISTS suppliers;
