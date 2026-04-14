-- Migration: remove suppliers feature
-- Date: 2026-04-14
--
-- UP
DROP TABLE IF EXISTS suppliers;

SET @supplier_column_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'products'
    AND COLUMN_NAME = 'supplier'
);

SET @drop_supplier_column_sql := IF(
  @supplier_column_exists > 0,
  'ALTER TABLE products DROP COLUMN supplier',
  'SELECT "products.supplier column does not exist"'
);
PREPARE drop_supplier_col_stmt FROM @drop_supplier_column_sql;
EXECUTE drop_supplier_col_stmt;
DEALLOCATE PREPARE drop_supplier_col_stmt;

-- DOWN
SET @supplier_column_exists_down := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'products'
    AND COLUMN_NAME = 'supplier'
);

SET @add_supplier_column_sql := IF(
  @supplier_column_exists_down = 0,
  'ALTER TABLE products ADD COLUMN supplier VARCHAR(120) NULL AFTER category',
  'SELECT "products.supplier column already exists"'
);
PREPARE add_supplier_col_stmt FROM @add_supplier_column_sql;
EXECUTE add_supplier_col_stmt;
DEALLOCATE PREPARE add_supplier_col_stmt;

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
