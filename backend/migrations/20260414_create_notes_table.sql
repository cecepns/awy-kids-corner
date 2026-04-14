-- Migration: create notes sheet table
-- Date: 2026-04-14
--
-- UP
CREATE TABLE IF NOT EXISTS notes_sheets (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(120) NOT NULL DEFAULT 'Catatan Utama',
  columns_json LONGTEXT NOT NULL,
  rows_json LONGTEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE INDEX idx_notes_sheets_created_at ON notes_sheets(created_at);

INSERT INTO notes_sheets (name, columns_json, rows_json)
SELECT 'Catatan Utama', '["Data","Hutang","Total","Dead"]', '[]'
WHERE NOT EXISTS (SELECT 1 FROM notes_sheets LIMIT 1);

-- DOWN
DROP TABLE IF EXISTS notes_sheets;
