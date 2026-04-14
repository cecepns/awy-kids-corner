-- Migration: add purchase_price to incoming_goods
-- Date: 2026-04-14
--
-- UP
SET @column_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'incoming_goods'
    AND COLUMN_NAME = 'purchase_price'
);

SET @up_sql := IF(
  @column_exists = 0,
  'ALTER TABLE incoming_goods ADD COLUMN purchase_price DECIMAL(15,2) NOT NULL DEFAULT 0 AFTER quantity',
  'SELECT "purchase_price already exists"'
);
PREPARE up_stmt FROM @up_sql;
EXECUTE up_stmt;
DEALLOCATE PREPARE up_stmt;

-- DOWN
SET @column_exists_down := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'incoming_goods'
    AND COLUMN_NAME = 'purchase_price'
);

SET @down_sql := IF(
  @column_exists_down > 0,
  'ALTER TABLE incoming_goods DROP COLUMN purchase_price',
  'SELECT "purchase_price does not exist"'
);
PREPARE down_stmt FROM @down_sql;
EXECUTE down_stmt;
DEALLOCATE PREPARE down_stmt;
