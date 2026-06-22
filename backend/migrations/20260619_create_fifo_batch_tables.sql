-- Migration: FIFO batch tracking tables (stock_batches + outgoing_allocations)
-- Date: 2026-06-19
--
-- Purpose:
--   Opsi B FIFO — lacak sisa stok per batch masuk dan alokasi batch saat barang keluar.
--
-- Notes:
--   1) Validasi qty (initial_qty > 0, remaining_qty >= 0, dll) di-handle backend.
--   2) Satu batch initial per produk juga dijaga di backend (bukan DB constraint).
--   3) outgoing_allocations untuk data lama perlu diisi lewat script replay FIFO
--      setelah migration ini dijalankan.

-- =============================================================================
-- UP
-- =============================================================================

CREATE TABLE IF NOT EXISTS stock_batches (
id BIGINT PRIMARY KEY AUTO_INCREMENT,
product_id BIGINT NOT NULL,
source_type ENUM('initial', 'incoming') NOT NULL,
incoming_goods_id BIGINT NULL,
initial_qty INT NOT NULL DEFAULT 0,
remaining_qty INT NOT NULL DEFAULT 0,
purchase_price DECIMAL(15,2) NOT NULL DEFAULT 0,
batch_date DATE NOT NULL,
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
CONSTRAINT fk_stock_batches_product
  FOREIGN KEY (product_id) REFERENCES products(id)
  ON UPDATE CASCADE ON DELETE RESTRICT,
CONSTRAINT fk_stock_batches_incoming
  FOREIGN KEY (incoming_goods_id) REFERENCES incoming_goods(id)
  ON UPDATE CASCADE ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS outgoing_allocations (
id BIGINT PRIMARY KEY AUTO_INCREMENT,
outgoing_goods_id BIGINT NOT NULL,
stock_batch_id BIGINT NOT NULL,
quantity INT NOT NULL DEFAULT 0,
purchase_price DECIMAL(15,2) NOT NULL DEFAULT 0,
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
CONSTRAINT fk_outgoing_alloc_outgoing
  FOREIGN KEY (outgoing_goods_id) REFERENCES outgoing_goods(id)
  ON UPDATE CASCADE ON DELETE CASCADE,
CONSTRAINT fk_outgoing_alloc_batch
  FOREIGN KEY (stock_batch_id) REFERENCES stock_batches(id)
  ON UPDATE CASCADE ON DELETE RESTRICT
);

SET @uk_stock_batches_incoming_exists := (
SELECT COUNT(*)
FROM INFORMATION_SCHEMA.STATISTICS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'stock_batches'
  AND INDEX_NAME = 'uk_stock_batches_incoming_goods'
);

SET @uk_stock_batches_incoming_sql := IF(
@uk_stock_batches_incoming_exists = 0,
'CREATE UNIQUE INDEX uk_stock_batches_incoming_goods ON stock_batches(incoming_goods_id)',
'SELECT 1'
);
PREPARE uk_stock_batches_incoming_stmt FROM @uk_stock_batches_incoming_sql;
EXECUTE uk_stock_batches_incoming_stmt;
DEALLOCATE PREPARE uk_stock_batches_incoming_stmt;

SET @idx_stock_batches_fifo_exists := (
SELECT COUNT(*)
FROM INFORMATION_SCHEMA.STATISTICS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'stock_batches'
  AND INDEX_NAME = 'idx_stock_batches_product_fifo'
);

SET @idx_stock_batches_fifo_sql := IF(
@idx_stock_batches_fifo_exists = 0,
'CREATE INDEX idx_stock_batches_product_fifo ON stock_batches(product_id, batch_date, id)',
'SELECT 1'
);
PREPARE idx_stock_batches_fifo_stmt FROM @idx_stock_batches_fifo_sql;
EXECUTE idx_stock_batches_fifo_stmt;
DEALLOCATE PREPARE idx_stock_batches_fifo_stmt;

SET @idx_stock_batches_product_exists := (
SELECT COUNT(*)
FROM INFORMATION_SCHEMA.STATISTICS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'stock_batches'
  AND INDEX_NAME = 'idx_stock_batches_product_id'
);

SET @idx_stock_batches_product_sql := IF(
@idx_stock_batches_product_exists = 0,
'CREATE INDEX idx_stock_batches_product_id ON stock_batches(product_id)',
'SELECT 1'
);
PREPARE idx_stock_batches_product_stmt FROM @idx_stock_batches_product_sql;
EXECUTE idx_stock_batches_product_stmt;
DEALLOCATE PREPARE idx_stock_batches_product_stmt;

SET @idx_stock_batches_source_exists := (
SELECT COUNT(*)
FROM INFORMATION_SCHEMA.STATISTICS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'stock_batches'
  AND INDEX_NAME = 'idx_stock_batches_product_source'
);

SET @idx_stock_batches_source_sql := IF(
@idx_stock_batches_source_exists = 0,
'CREATE INDEX idx_stock_batches_product_source ON stock_batches(product_id, source_type)',
'SELECT 1'
);
PREPARE idx_stock_batches_source_stmt FROM @idx_stock_batches_source_sql;
EXECUTE idx_stock_batches_source_stmt;
DEALLOCATE PREPARE idx_stock_batches_source_stmt;

SET @idx_outgoing_alloc_outgoing_exists := (
SELECT COUNT(*)
FROM INFORMATION_SCHEMA.STATISTICS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'outgoing_allocations'
  AND INDEX_NAME = 'idx_outgoing_alloc_outgoing'
);

SET @idx_outgoing_alloc_outgoing_sql := IF(
@idx_outgoing_alloc_outgoing_exists = 0,
'CREATE INDEX idx_outgoing_alloc_outgoing ON outgoing_allocations(outgoing_goods_id)',
'SELECT 1'
);
PREPARE idx_outgoing_alloc_outgoing_stmt FROM @idx_outgoing_alloc_outgoing_sql;
EXECUTE idx_outgoing_alloc_outgoing_stmt;
DEALLOCATE PREPARE idx_outgoing_alloc_outgoing_stmt;

SET @idx_outgoing_alloc_batch_exists := (
SELECT COUNT(*)
FROM INFORMATION_SCHEMA.STATISTICS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'outgoing_allocations'
  AND INDEX_NAME = 'idx_outgoing_alloc_batch'
);

SET @idx_outgoing_alloc_batch_sql := IF(
@idx_outgoing_alloc_batch_exists = 0,
'CREATE INDEX idx_outgoing_alloc_batch ON outgoing_allocations(stock_batch_id)',
'SELECT 1'
);
PREPARE idx_outgoing_alloc_batch_stmt FROM @idx_outgoing_alloc_batch_sql;
EXECUTE idx_outgoing_alloc_batch_stmt;
DEALLOCATE PREPARE idx_outgoing_alloc_batch_stmt;

INSERT INTO stock_batches (
product_id,
source_type,
incoming_goods_id,
initial_qty,
remaining_qty,
purchase_price,
batch_date
)
SELECT
ig.product_id,
'incoming',
ig.id,
ig.quantity,
ig.quantity,
ig.purchase_price,
ig.transaction_date
FROM incoming_goods ig
WHERE NOT EXISTS (
SELECT 1
FROM stock_batches sb
WHERE sb.incoming_goods_id = ig.id
);

INSERT INTO stock_batches (
product_id,
source_type,
incoming_goods_id,
initial_qty,
remaining_qty,
purchase_price,
batch_date
)
SELECT
p.id,
'initial',
NULL,
p.initial_stock,
p.initial_stock,
p.purchase_price,
DATE(p.created_at)
FROM products p
WHERE p.initial_stock > 0
AND NOT EXISTS (
  SELECT 1
  FROM stock_batches sb
  WHERE sb.product_id = p.id
    AND sb.source_type = 'initial'
);

-- =============================================================================
-- DOWN
-- =============================================================================
-- DROP TABLE IF EXISTS outgoing_allocations;
-- DROP TABLE IF EXISTS stock_batches;
