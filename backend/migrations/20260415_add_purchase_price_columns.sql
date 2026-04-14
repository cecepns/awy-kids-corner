-- Migration: ensure purchase_price columns for products/incoming/outgoing
-- Date: 2026-04-15
--
-- This migration is idempotent and safe to run multiple times.

-- 1) incoming_goods.purchase_price
SET @incoming_purchase_price_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'incoming_goods'
    AND COLUMN_NAME = 'purchase_price'
);

SET @incoming_up_sql := IF(
  @incoming_purchase_price_exists = 0,
  'ALTER TABLE incoming_goods ADD COLUMN purchase_price DECIMAL(15,2) NOT NULL DEFAULT 0 AFTER quantity',
  'SELECT "incoming_goods.purchase_price already exists"'
);
PREPARE incoming_up_stmt FROM @incoming_up_sql;
EXECUTE incoming_up_stmt;
DEALLOCATE PREPARE incoming_up_stmt;

-- 2) products.purchase_price
SET @products_purchase_price_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'products'
    AND COLUMN_NAME = 'purchase_price'
);

SET @products_up_sql := IF(
  @products_purchase_price_exists = 0,
  'ALTER TABLE products ADD COLUMN purchase_price DECIMAL(15,2) NOT NULL DEFAULT 0 AFTER current_stock',
  'SELECT "products.purchase_price already exists"'
);
PREPARE products_up_stmt FROM @products_up_sql;
EXECUTE products_up_stmt;
DEALLOCATE PREPARE products_up_stmt;

-- 3) outgoing_goods.purchase_price
SET @outgoing_purchase_price_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'outgoing_goods'
    AND COLUMN_NAME = 'purchase_price'
);

SET @outgoing_up_sql := IF(
  @outgoing_purchase_price_exists = 0,
  'ALTER TABLE outgoing_goods ADD COLUMN purchase_price DECIMAL(15,2) NOT NULL DEFAULT 0 AFTER transaction_date',
  'SELECT "outgoing_goods.purchase_price already exists"'
);
PREPARE outgoing_up_stmt FROM @outgoing_up_sql;
EXECUTE outgoing_up_stmt;
DEALLOCATE PREPARE outgoing_up_stmt;
