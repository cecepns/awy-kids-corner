/* eslint-env node */
const express = require('express')
const cors = require('cors')
const mysql = require('mysql2/promise')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
require('dotenv').config()

const app = express()
const port = Number(process.env.PORT || 5000)
const jwtSecret = process.env.JWT_SECRET || 'awy-kids-corner-secret'

app.use(cors())
app.use(express.json())

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'awy_kids_corner_db',
  waitForConnections: true,
  connectionLimit: 10,
})

const PAGINATION_LIMITS = [10, 20, 50, 100]
const DEFAULT_PAGE_LIMIT = 20

const parsePagination = (query) => {
  const requestedPage = Number(query.page)
  const requestedLimit = Number(query.limit)

  return {
    page: Number.isFinite(requestedPage) && requestedPage > 0 ? Math.floor(requestedPage) : 1,
    limit: PAGINATION_LIMITS.includes(requestedLimit) ? requestedLimit : DEFAULT_PAGE_LIMIT,
  }
}

const buildPaginationMeta = (requestedPage, limit, totalItems) => {
  const totalPages = Math.max(1, Math.ceil(totalItems / limit))
  const page = Math.min(requestedPage, totalPages)

  return {
    page,
    limit,
    total_items: totalItems,
    total_pages: totalPages,
    offset: (page - 1) * limit,
  }
}

const logActivity = async (connection, action, details) => {
  await connection.execute('INSERT INTO activity_logs (action, details) VALUES (?, ?)', [action, details])
}

const recalculateStockByProductId = async (connection, productId) => {
  const [rows] = await connection.execute(
    `
      SELECT
        p.initial_stock,
        COALESCE((SELECT SUM(quantity) FROM incoming_goods ig WHERE ig.product_id = p.id), 0) AS incoming_qty,
        COALESCE((SELECT SUM(quantity) FROM outgoing_goods og WHERE og.product_id = p.id), 0) AS outgoing_qty
      FROM products p
      WHERE p.id = ?
    `,
    [productId],
  )

  if (!rows.length) return

  const stock = Number(rows[0].initial_stock) + Number(rows[0].incoming_qty) - Number(rows[0].outgoing_qty)
  await connection.execute('UPDATE products SET current_stock = ? WHERE id = ?', [stock, productId])
}

const getProductById = async (connection, productId) => {
  const [rows] = await connection.execute('SELECT * FROM products WHERE id = ?', [productId])
  return rows[0]
}

const hasColumn = async (connection, tableName, columnName) => {
  const [rows] = await connection.execute(
    `
    SELECT COLUMN_NAME
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = ?
      AND COLUMN_NAME = ?
    `,
    [tableName, columnName],
  )
  return rows.length > 0
}

const normalizeDateInput = (value) => {
  if (!value) return null
  const s = String(value).trim()
  if (!s) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  return null
}

const getProductAveragePurchasePrice = async (connection, productId, upToDate = null) => {
  const product = await getProductById(connection, productId)
  const fallbackPrice = Number(product?.purchase_price || 0)
  const hasIncomingPurchasePrice = await hasColumn(connection, 'incoming_goods', 'purchase_price')
  if (!hasIncomingPurchasePrice) return fallbackPrice

  const validDate = normalizeDateInput(upToDate)
  const dateClause = validDate ? 'AND transaction_date <= ?' : ''
  const queryParams = validDate ? [productId, validDate] : [productId]
  const [rows] = await connection.execute(
    `
    SELECT
      COALESCE(SUM(quantity), 0) AS total_qty,
      COALESCE(SUM(quantity * purchase_price), 0) AS total_cost
    FROM incoming_goods
    WHERE product_id = ?
      ${dateClause}
    `,
    queryParams,
  )

  const totalQty = Number(rows[0]?.total_qty || 0)
  const totalCost = Number(rows[0]?.total_cost || 0)
  if (totalQty <= 0 || totalCost <= 0) return fallbackPrice
  return totalCost / totalQty
}

const normalizeReferenceNo = (referenceNo) => {
  if (referenceNo == null) return null
  const s = String(referenceNo).trim()
  return s.length ? s : null
}

/** Nomor resi/referensi unik di barang masuk dan barang keluar (abaikan baris yang sedang diedit). */
const assertReferenceNoUnique = async (connection, normalizedRef, { excludeIncomingId, excludeOutgoingId } = {}) => {
  if (!normalizedRef) return

  const incParams = [normalizedRef]
  let incSql = `
    SELECT id FROM incoming_goods
    WHERE reference_no IS NOT NULL AND TRIM(reference_no) = ?
  `
  if (excludeIncomingId != null) {
    incSql += ' AND id <> ?'
    incParams.push(excludeIncomingId)
  }
  const [incDup] = await connection.execute(incSql, incParams)
  if (incDup.length) {
    const err = new Error('Nomor referensi / resi sudah digunakan')
    err.statusCode = 400
    throw err
  }

  const outParams = [normalizedRef]
  let outSql = `
    SELECT id FROM outgoing_goods
    WHERE reference_no IS NOT NULL AND TRIM(reference_no) = ?
  `
  if (excludeOutgoingId != null) {
    outSql += ' AND id <> ?'
    outParams.push(excludeOutgoingId)
  }
  const [outDup] = await connection.execute(outSql, outParams)
  if (outDup.length) {
    const err = new Error('Nomor referensi / resi sudah digunakan')
    err.statusCode = 400
    throw err
  }
}

const sanitizeUser = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
})

const createToken = (user) =>
  jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
    },
    jwtSecret,
    { expiresIn: '1d' },
  )

const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
    if (!token) {
      return res.status(401).json({ message: 'Unauthorized, token diperlukan' })
    }

    const payload = jwt.verify(token, jwtSecret)
    const [rows] = await pool.execute('SELECT id, name, email, role, is_active FROM users WHERE id = ?', [payload.id])
    if (!rows.length || !rows[0].is_active) {
      return res.status(401).json({ message: 'Akun tidak valid atau tidak aktif' })
    }

    req.user = sanitizeUser(rows[0])
    next()
  } catch (error) {
    return res.status(401).json({ message: 'Token tidak valid atau sudah expired' })
  }
}

const ensureDefaultAdmin = async () => {
  const connection = await pool.getConnection()
  try {
    const [rows] = await connection.execute('SELECT COUNT(*) AS total FROM users')
    if (rows[0].total > 0) return

    const defaultName = process.env.ADMIN_NAME || 'Admin Awy'
    const defaultEmail = process.env.ADMIN_EMAIL || 'admin@awykidscorner.local'
    const defaultPassword = process.env.ADMIN_PASSWORD || 'admin12345'
    const hashedPassword = await bcrypt.hash(defaultPassword, 10)

    await connection.execute(
      'INSERT INTO users (name, email, password, role, is_active) VALUES (?, ?, ?, ?, ?)',
      [defaultName, defaultEmail, hashedPassword, 'admin', 1],
    )
    // eslint-disable-next-line no-console
    console.log(`Default admin dibuat: ${defaultEmail}`)
  } finally {
    connection.release()
  }
}

const ensurePurchasePriceColumns = async () => {
  const connection = await pool.getConnection()
  try {
    const hasIncomingPurchasePrice = await hasColumn(connection, 'incoming_goods', 'purchase_price')
    if (!hasIncomingPurchasePrice) {
      await connection.execute(
        `
        ALTER TABLE incoming_goods
        ADD COLUMN purchase_price DECIMAL(15,2) NOT NULL DEFAULT 0 AFTER quantity
        `,
      )
    }

    const hasProductsPurchasePrice = await hasColumn(connection, 'products', 'purchase_price')
    if (!hasProductsPurchasePrice) {
      await connection.execute(
        `
        ALTER TABLE products
        ADD COLUMN purchase_price DECIMAL(15,2) NOT NULL DEFAULT 0 AFTER current_stock
        `,
      )
    }

    const hasOutgoingPurchasePrice = await hasColumn(connection, 'outgoing_goods', 'purchase_price')
    if (!hasOutgoingPurchasePrice) {
      await connection.execute(
        `
        ALTER TABLE outgoing_goods
        ADD COLUMN purchase_price DECIMAL(15,2) NOT NULL DEFAULT 0 AFTER transaction_date
        `,
      )
    }
  } finally {
    connection.release()
  }
}

const ensureNotesTable = async () => {
  const connection = await pool.getConnection()
  try {
    await connection.execute(
      `
      CREATE TABLE IF NOT EXISTS notes_sheets (
        id BIGINT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(120) NOT NULL DEFAULT 'Catatan Utama',
        columns_json LONGTEXT NOT NULL,
        rows_json LONGTEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
      `,
    )

    const [rows] = await connection.execute('SELECT id FROM notes_sheets LIMIT 1')
    if (!rows.length) {
      await connection.execute(
        `
        INSERT INTO notes_sheets (name, columns_json, rows_json)
        VALUES (?, ?, ?)
        `,
        ['Catatan Utama', JSON.stringify(['Data', 'Hutang', 'Total', 'Dead']), JSON.stringify([])],
      )
    }
  } finally {
    connection.release()
  }
}

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', app: 'awy-kids-corner-api' })
})

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body
    if (!email || !password) {
      return res.status(400).json({ message: 'Email dan password wajib diisi' })
    }

    const [rows] = await pool.execute('SELECT * FROM users WHERE email = ? LIMIT 1', [email])
    if (!rows.length) {
      return res.status(401).json({ message: 'Email atau password salah' })
    }

    const user = rows[0]
    if (!user.is_active) {
      return res.status(403).json({ message: 'Akun nonaktif, hubungi admin' })
    }

    const passwordValid = await bcrypt.compare(password, user.password)
    if (!passwordValid) {
      return res.status(401).json({ message: 'Email atau password salah' })
    }

    const token = createToken(user)
    res.json({
      token,
      user: sanitizeUser(user),
    })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
})

app.use('/api', (req, res, next) => {
  if (req.path === '/health' || req.path === '/auth/login') {
    return next()
  }
  return authenticateToken(req, res, next)
})

app.get('/api/auth/me', async (req, res) => {
  res.json({ user: req.user })
})

app.get('/api/users', async (req, res) => {
  try {
    const { page, limit } = parsePagination(req.query)
    const [countRows] = await pool.execute('SELECT COUNT(*) AS total FROM users')
    const meta = buildPaginationMeta(page, limit, Number(countRows[0]?.total || 0))

    const [rows] = await pool.execute(
      `
      SELECT id, name, email, role, is_active, created_at, updated_at
      FROM users
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
      `,
      [meta.limit, meta.offset],
    )

    res.json({
      data: rows,
      meta: {
        page: meta.page,
        limit: meta.limit,
        total_items: meta.total_items,
        total_pages: meta.total_pages,
      },
    })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
})

app.post('/api/users', async (req, res) => {
  const connection = await pool.getConnection()
  try {
    const { name, email, password, is_active } = req.body
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Nama, email, dan password wajib diisi' })
    }

    await connection.beginTransaction()
    const [existing] = await connection.execute('SELECT id FROM users WHERE email = ?', [email])
    if (existing.length) {
      await connection.rollback()
      return res.status(400).json({ message: 'Email sudah digunakan' })
    }

    const hashedPassword = await bcrypt.hash(password, 10)
    const [insert] = await connection.execute(
      'INSERT INTO users (name, email, password, role, is_active) VALUES (?, ?, ?, ?, ?)',
      [name, email, hashedPassword, 'admin', is_active ? 1 : 0],
    )
    await logActivity(connection, 'CREATE_USER', `User admin baru dibuat: ${email}`)
    await connection.commit()

    res.status(201).json({ id: insert.insertId, message: 'User berhasil dibuat' })
  } catch (error) {
    await connection.rollback()
    res.status(500).json({ message: error.message })
  } finally {
    connection.release()
  }
})

app.put('/api/users/:id', async (req, res) => {
  const connection = await pool.getConnection()
  try {
    const { id } = req.params
    const { name, email, password, is_active } = req.body
    if (!name || !email) {
      return res.status(400).json({ message: 'Nama dan email wajib diisi' })
    }

    await connection.beginTransaction()
    const [rows] = await connection.execute('SELECT * FROM users WHERE id = ?', [id])
    if (!rows.length) {
      await connection.rollback()
      return res.status(404).json({ message: 'User tidak ditemukan' })
    }

    const [emailConflict] = await connection.execute('SELECT id FROM users WHERE email = ? AND id <> ?', [email, id])
    if (emailConflict.length) {
      await connection.rollback()
      return res.status(400).json({ message: 'Email sudah dipakai user lain' })
    }

    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10)
      await connection.execute(
        `
          UPDATE users
          SET name = ?, email = ?, password = ?, is_active = ?, role = 'admin'
          WHERE id = ?
        `,
        [name, email, hashedPassword, is_active ? 1 : 0, id],
      )
    } else {
      await connection.execute(
        `
          UPDATE users
          SET name = ?, email = ?, is_active = ?, role = 'admin'
          WHERE id = ?
        `,
        [name, email, is_active ? 1 : 0, id],
      )
    }

    await logActivity(connection, 'UPDATE_USER', `User diperbarui: ${email}`)
    await connection.commit()

    res.json({ message: 'User berhasil diperbarui' })
  } catch (error) {
    await connection.rollback()
    res.status(500).json({ message: error.message })
  } finally {
    connection.release()
  }
})

app.delete('/api/users/:id', async (req, res) => {
  const connection = await pool.getConnection()
  try {
    const { id } = req.params
    await connection.beginTransaction()

    const [rows] = await connection.execute('SELECT id, email FROM users WHERE id = ?', [id])
    if (!rows.length) {
      await connection.rollback()
      return res.status(404).json({ message: 'User tidak ditemukan' })
    }

    if (Number(req.user.id) === Number(id)) {
      await connection.rollback()
      return res.status(400).json({ message: 'Tidak bisa menghapus akun yang sedang login' })
    }

    await connection.execute('DELETE FROM users WHERE id = ?', [id])
    await logActivity(connection, 'DELETE_USER', `User dihapus: ${rows[0].email}`)
    await connection.commit()

    res.json({ message: 'User berhasil dihapus' })
  } catch (error) {
    await connection.rollback()
    res.status(500).json({ message: error.message })
  } finally {
    connection.release()
  }
})

app.get('/api/products', async (req, res) => {
  try {
    const search = (req.query.search || '').trim()
    const { page, limit } = parsePagination(req.query)
    const params = []
    let where = ''

    if (search) {
      where = 'WHERE code LIKE ? OR name LIKE ? OR category LIKE ?'
      const searchValue = `%${search}%`
      params.push(searchValue, searchValue, searchValue)
    }

    const [countRows] = await pool.execute(`SELECT COUNT(*) AS total FROM products ${where}`, params)
    const meta = buildPaginationMeta(page, limit, Number(countRows[0]?.total || 0))
    const [rows] = await pool.execute(
      `
      SELECT *
      FROM products
      ${where}
      ORDER BY created_at DESC, id DESC
      LIMIT ? OFFSET ?
      `,
      [...params, meta.limit, meta.offset],
    )

    res.json({
      data: rows,
      meta: {
        page: meta.page,
        limit: meta.limit,
        total_items: meta.total_items,
        total_pages: meta.total_pages,
      },
    })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
})

app.post('/api/products', async (req, res) => {
  const connection = await pool.getConnection()
  try {
    const {
      code,
      name,
      unit,
      min_stock,
      initial_stock,
      category,
    } = req.body

    if (!code || !name) {
      return res.status(400).json({ message: 'Kode dan nama produk wajib diisi' })
    }

    await connection.beginTransaction()

    const [existing] = await connection.execute('SELECT id FROM products WHERE code = ?', [code])
    if (existing.length) {
      await connection.rollback()
      return res.status(400).json({ message: 'Kode produk sudah digunakan' })
    }

    const [insert] = await connection.execute(
      `
        INSERT INTO products
        (code, name, unit, min_stock, initial_stock, current_stock, purchase_price, selling_price, category)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        code,
        name,
        unit || 'buah',
        Number(min_stock || 0),
        Number(initial_stock || 0),
        Number(initial_stock || 0),
        0,
        0,
        category || null,
      ],
    )

    await logActivity(connection, 'CREATE_PRODUCT', `Menambahkan produk ${name} (${code})`)
    await connection.commit()

    res.status(201).json({ id: insert.insertId, message: 'Produk berhasil dibuat' })
  } catch (error) {
    await connection.rollback()
    res.status(500).json({ message: error.message })
  } finally {
    connection.release()
  }
})

app.put('/api/products/:id', async (req, res) => {
  const connection = await pool.getConnection()
  try {
    const { id } = req.params
    const {
      code,
      name,
      unit,
      min_stock,
      initial_stock,
      category,
    } = req.body

    await connection.beginTransaction()

    const [exists] = await connection.execute('SELECT id FROM products WHERE id = ?', [id])
    if (!exists.length) {
      await connection.rollback()
      return res.status(404).json({ message: 'Produk tidak ditemukan' })
    }

    const [duplicate] = await connection.execute('SELECT id FROM products WHERE code = ? AND id <> ?', [code, id])
    if (duplicate.length) {
      await connection.rollback()
      return res.status(400).json({ message: 'Kode produk sudah digunakan produk lain' })
    }

    await connection.execute(
      `
        UPDATE products
        SET code = ?, name = ?, unit = ?, min_stock = ?, initial_stock = ?,
            purchase_price = ?, selling_price = ?, category = ?
        WHERE id = ?
      `,
      [
        code,
        name,
        unit || 'buah',
        Number(min_stock || 0),
        Number(initial_stock || 0),
        0,
        0,
        category || null,
        id,
      ],
    )

    await recalculateStockByProductId(connection, id)
    await logActivity(connection, 'UPDATE_PRODUCT', `Memperbarui produk ${name} (${code})`)
    await connection.commit()

    res.json({ message: 'Produk berhasil diperbarui' })
  } catch (error) {
    await connection.rollback()
    res.status(500).json({ message: error.message })
  } finally {
    connection.release()
  }
})

app.delete('/api/products/:id', async (req, res) => {
  const connection = await pool.getConnection()
  try {
    const { id } = req.params
    await connection.beginTransaction()

    const [rows] = await connection.execute('SELECT name, code FROM products WHERE id = ?', [id])
    if (!rows.length) {
      await connection.rollback()
      return res.status(404).json({ message: 'Produk tidak ditemukan' })
    }

    const [incoming] = await connection.execute('SELECT COUNT(*) AS total FROM incoming_goods WHERE product_id = ?', [id])
    const [outgoing] = await connection.execute('SELECT COUNT(*) AS total FROM outgoing_goods WHERE product_id = ?', [id])

    if (incoming[0].total > 0 || outgoing[0].total > 0) {
      await connection.rollback()
      return res.status(400).json({ message: 'Produk sudah dipakai transaksi dan tidak bisa dihapus' })
    }

    await connection.execute('DELETE FROM products WHERE id = ?', [id])
    await logActivity(connection, 'DELETE_PRODUCT', `Menghapus produk ${rows[0].name} (${rows[0].code})`)
    await connection.commit()

    res.json({ message: 'Produk berhasil dihapus' })
  } catch (error) {
    await connection.rollback()
    res.status(500).json({ message: error.message })
  } finally {
    connection.release()
  }
})

app.post('/api/products/bulk', async (req, res) => {
  const connection = await pool.getConnection()
  try {
    const products = Array.isArray(req.body.products) ? req.body.products : []
    if (!products.length) {
      return res.status(400).json({ message: 'Data bulk insert kosong' })
    }

    await connection.beginTransaction()

    let inserted = 0
    let skipped = 0
    for (const item of products) {
      if (!item.code || !item.name) {
        skipped += 1
        continue
      }
      const [exists] = await connection.execute('SELECT id FROM products WHERE code = ?', [item.code])
      if (exists.length) {
        skipped += 1
        continue
      }
      await connection.execute(
        `
          INSERT INTO products
          (code, name, unit, min_stock, initial_stock, current_stock, purchase_price, selling_price, category)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          item.code,
          item.name,
          item.unit || 'buah',
          Number(item.min_stock || 0),
          Number(item.initial_stock || 0),
          Number(item.initial_stock || 0),
          0,
          0,
          item.category || null,
        ],
      )
      inserted += 1
    }

    await logActivity(connection, 'BULK_INSERT_PRODUCT', `Bulk insert produk: ${inserted} sukses, ${skipped} dilewati`)
    await connection.commit()

    res.status(201).json({ inserted, skipped, message: 'Bulk insert selesai' })
  } catch (error) {
    await connection.rollback()
    res.status(500).json({ message: error.message })
  } finally {
    connection.release()
  }
})

app.get('/api/products/:id/cost', async (req, res) => {
  const connection = await pool.getConnection()
  try {
    const { id } = req.params
    const transactionDate = normalizeDateInput(req.query.transaction_date)
    const product = await getProductById(connection, id)
    if (!product) {
      return res.status(404).json({ message: 'Produk tidak ditemukan' })
    }

    const hasIncomingPurchasePrice = await hasColumn(connection, 'incoming_goods', 'purchase_price')
    const dateClause = transactionDate ? 'AND transaction_date <= ?' : ''
    const queryParams = transactionDate ? [id, transactionDate] : [id]
    const [summaryRows] = hasIncomingPurchasePrice
      ? await connection.execute(
          `
          SELECT
            COALESCE(SUM(quantity), 0) AS total_qty,
            COALESCE(SUM(quantity * purchase_price), 0) AS total_cost
          FROM incoming_goods
          WHERE product_id = ?
            ${dateClause}
          `,
          queryParams,
        )
      : await connection.execute(
          `
          SELECT
            COALESCE(SUM(quantity), 0) AS total_qty,
            0 AS total_cost
          FROM incoming_goods
          WHERE product_id = ?
            ${dateClause}
          `,
          queryParams,
        )
    const totalQty = Number(summaryRows[0]?.total_qty || 0)
    const totalCost = Number(summaryRows[0]?.total_cost || 0)
    const fallbackPrice = Number(product.purchase_price || 0)
    const averagePurchasePrice = totalQty > 0 && totalCost > 0 ? totalCost / totalQty : fallbackPrice

    res.json({
      product_id: Number(id),
      average_purchase_price: averagePurchasePrice,
      total_incoming_qty: totalQty,
      total_incoming_cost: totalCost,
      transaction_date: transactionDate,
    })
  } catch (error) {
    res.status(500).json({ message: error.message })
  } finally {
    connection.release()
  }
})

app.get('/api/incoming', async (req, res) => {
  try {
    const search = (req.query.search || '').trim()
    const { page, limit } = parsePagination(req.query)
    let where = ''
    const params = []
    if (search) {
      where = 'WHERE p.code LIKE ? OR p.name LIKE ? OR ig.reference_no LIKE ?'
      const searchValue = `%${search}%`
      params.push(searchValue, searchValue, searchValue)
    }

    const [countRows] = await pool.execute(
      `
      SELECT COUNT(*) AS total
      FROM incoming_goods ig
      JOIN products p ON p.id = ig.product_id
      ${where}
      `,
      params,
    )
    const meta = buildPaginationMeta(page, limit, Number(countRows[0]?.total || 0))

    const [rows] = await pool.execute(
      `
      SELECT ig.*, p.code AS product_code, p.name AS product_name
      FROM incoming_goods ig
      JOIN products p ON p.id = ig.product_id
      ${where}
      ORDER BY ig.transaction_date DESC, ig.id DESC
      LIMIT ? OFFSET ?
      `,
      [...params, meta.limit, meta.offset],
    )
    res.json({
      data: rows.map((row) => ({
        ...row,
        total_purchase: Number(row.quantity || 0) * Number(row.purchase_price || 0),
      })),
      meta: {
        page: meta.page,
        limit: meta.limit,
        total_items: meta.total_items,
        total_pages: meta.total_pages,
      },
    })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
})

app.post('/api/incoming', async (req, res) => {
  const connection = await pool.getConnection()
  try {
    const { product_id, quantity, purchase_price, reference_no, notes, transaction_date } = req.body
    if (!product_id || Number(quantity) <= 0 || Number(purchase_price) < 0) {
      return res.status(400).json({ message: 'Produk, quantity, dan harga beli wajib valid' })
    }

    await connection.beginTransaction()
    const product = await getProductById(connection, product_id)
    if (!product) {
      await connection.rollback()
      return res.status(404).json({ message: 'Produk tidak ditemukan' })
    }

    const refNorm = normalizeReferenceNo(reference_no)
    await assertReferenceNoUnique(connection, refNorm, {})

    await connection.execute(
      `
      INSERT INTO incoming_goods (product_id, quantity, purchase_price, reference_no, notes, transaction_date)
      VALUES (?, ?, ?, ?, ?, ?)
      `,
      [product_id, Number(quantity), Number(purchase_price || 0), refNorm, notes || null, transaction_date],
    )

    await recalculateStockByProductId(connection, product_id)
    await logActivity(connection, 'CREATE_INCOMING', `Barang masuk ${product.name} sebanyak ${quantity}`)
    await connection.commit()

    res.status(201).json({ message: 'Barang masuk berhasil ditambahkan' })
  } catch (error) {
    await connection.rollback()
    if (Number(error.statusCode) === 400) {
      res.status(400).json({ message: error.message })
      return
    }
    res.status(500).json({ message: error.message })
  } finally {
    connection.release()
  }
})

app.put('/api/incoming/:id', async (req, res) => {
  const connection = await pool.getConnection()
  try {
    const { id } = req.params
    const { product_id, quantity, purchase_price, reference_no, notes, transaction_date } = req.body

    await connection.beginTransaction()
    const [oldRows] = await connection.execute('SELECT * FROM incoming_goods WHERE id = ?', [id])
    if (!oldRows.length) {
      await connection.rollback()
      return res.status(404).json({ message: 'Data barang masuk tidak ditemukan' })
    }

    const old = oldRows[0]
    const product = await getProductById(connection, product_id)
    if (!product) {
      await connection.rollback()
      return res.status(404).json({ message: 'Produk tidak ditemukan' })
    }
    if (Number(quantity) <= 0 || Number(purchase_price) < 0) {
      await connection.rollback()
      return res.status(400).json({ message: 'Quantity dan harga beli wajib valid' })
    }

    const refNorm = normalizeReferenceNo(reference_no)
    await assertReferenceNoUnique(connection, refNorm, { excludeIncomingId: Number(id) })

    await connection.execute(
      `
      UPDATE incoming_goods
      SET product_id = ?, quantity = ?, purchase_price = ?, reference_no = ?, notes = ?, transaction_date = ?
      WHERE id = ?
      `,
      [product_id, Number(quantity), Number(purchase_price || 0), refNorm, notes || null, transaction_date, id],
    )

    await recalculateStockByProductId(connection, old.product_id)
    if (Number(old.product_id) !== Number(product_id)) {
      await recalculateStockByProductId(connection, product_id)
    }

    await logActivity(connection, 'UPDATE_INCOMING', `Edit barang masuk ${product.name} sebanyak ${quantity}`)
    await connection.commit()

    res.json({ message: 'Barang masuk berhasil diperbarui' })
  } catch (error) {
    await connection.rollback()
    if (Number(error.statusCode) === 400) {
      res.status(400).json({ message: error.message })
      return
    }
    res.status(500).json({ message: error.message })
  } finally {
    connection.release()
  }
})

app.delete('/api/incoming/:id', async (req, res) => {
  const connection = await pool.getConnection()
  try {
    const { id } = req.params
    await connection.beginTransaction()

    const [rows] = await connection.execute(
      `
      SELECT ig.id, ig.quantity, ig.product_id, p.name
      FROM incoming_goods ig
      JOIN products p ON p.id = ig.product_id
      WHERE ig.id = ?
      `,
      [id],
    )
    if (!rows.length) {
      await connection.rollback()
      return res.status(404).json({ message: 'Data barang masuk tidak ditemukan' })
    }

    await connection.execute('DELETE FROM incoming_goods WHERE id = ?', [id])
    await recalculateStockByProductId(connection, rows[0].product_id)
    await logActivity(connection, 'DELETE_INCOMING', `Hapus barang masuk ${rows[0].name}`)
    await connection.commit()

    res.json({ message: 'Barang masuk berhasil dihapus' })
  } catch (error) {
    await connection.rollback()
    res.status(500).json({ message: error.message })
  } finally {
    connection.release()
  }
})

app.get('/api/outgoing', async (req, res) => {
  const connection = await pool.getConnection()
  try {
    const search = (req.query.search || '').trim()
    const startDate = normalizeDateInput(req.query.start_date)
    const endDate = normalizeDateInput(req.query.end_date)
    const { page, limit } = parsePagination(req.query)
    const whereClauses = []
    const params = []
    if (search) {
      whereClauses.push('(p.code LIKE ? OR p.name LIKE ? OR og.reference_no LIKE ?)')
      const searchValue = `%${search}%`
      params.push(searchValue, searchValue, searchValue)
    }
    if (startDate) {
      whereClauses.push('og.transaction_date >= ?')
      params.push(startDate)
    }
    if (endDate) {
      whereClauses.push('og.transaction_date <= ?')
      params.push(endDate)
    }
    const where = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : ''

    const [countRows] = await connection.execute(
      `
      SELECT COUNT(*) AS total
      FROM outgoing_goods og
      JOIN products p ON p.id = og.product_id
      ${where}
      `,
      params,
    )
    const meta = buildPaginationMeta(page, limit, Number(countRows[0]?.total || 0))

    const [rows] = await connection.execute(
      `
      SELECT og.*, p.code AS product_code, p.name AS product_name
      FROM outgoing_goods og
      JOIN products p ON p.id = og.product_id
      ${where}
      ORDER BY og.transaction_date DESC, og.id DESC
      LIMIT ? OFFSET ?
      `,
      [...params, meta.limit, meta.offset],
    )

    res.json({
      data: await Promise.all(
        rows.map(async (row) => {
          const livePurchasePrice = await getProductAveragePurchasePrice(
            connection,
            row.product_id,
            row.transaction_date,
          )
          const qty = Number(row.quantity || 0)
          return {
            ...row,
            purchase_price: livePurchasePrice,
            total_purchase: livePurchasePrice * qty,
            total_selling: Number(row.selling_price || 0) * qty,
          }
        }),
      ),
      meta: {
        page: meta.page,
        limit: meta.limit,
        total_items: meta.total_items,
        total_pages: meta.total_pages,
      },
    })
  } catch (error) {
    res.status(500).json({ message: error.message })
  } finally {
    connection.release()
  }
})

app.post('/api/outgoing', async (req, res) => {
  const connection = await pool.getConnection()
  try {
    const { product_id, quantity, selling_price, reference_no, notes, transaction_date } = req.body
    if (!product_id || Number(quantity) <= 0 || Number(selling_price) < 0) {
      return res.status(400).json({ message: 'Produk, quantity, dan harga jual wajib valid' })
    }

    await connection.beginTransaction()
    const product = await getProductById(connection, product_id)
    if (!product) {
      await connection.rollback()
      return res.status(404).json({ message: 'Produk tidak ditemukan' })
    }

    if (Number(product.current_stock) < Number(quantity)) {
      await connection.rollback()
      return res.status(400).json({ message: `Stok ${product.name} tidak cukup` })
    }

    const averagePurchasePrice = await getProductAveragePurchasePrice(
      connection,
      product_id,
      normalizeDateInput(transaction_date),
    )

    const refNorm = normalizeReferenceNo(reference_no)
    await assertReferenceNoUnique(connection, refNorm, {})

    await connection.execute(
      `
      INSERT INTO outgoing_goods
      (product_id, quantity, reference_no, notes, transaction_date, purchase_price, selling_price, discount)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        product_id,
        Number(quantity),
        refNorm,
        notes || null,
        transaction_date,
        Number(averagePurchasePrice || 0),
        Number(selling_price || 0),
        0,
      ],
    )

    await recalculateStockByProductId(connection, product_id)
    await logActivity(connection, 'CREATE_OUTGOING', `Barang keluar ${product.name} sebanyak ${quantity}`)
    await connection.commit()

    res.status(201).json({ message: 'Barang keluar berhasil ditambahkan' })
  } catch (error) {
    await connection.rollback()
    if (Number(error.statusCode) === 400) {
      res.status(400).json({ message: error.message })
      return
    }
    res.status(500).json({ message: error.message })
  } finally {
    connection.release()
  }
})

app.put('/api/outgoing/:id', async (req, res) => {
  const connection = await pool.getConnection()
  try {
    const { id } = req.params
    const { product_id, quantity, selling_price, reference_no, notes, transaction_date } = req.body
    await connection.beginTransaction()

    const [oldRows] = await connection.execute('SELECT * FROM outgoing_goods WHERE id = ?', [id])
    if (!oldRows.length) {
      await connection.rollback()
      return res.status(404).json({ message: 'Data barang keluar tidak ditemukan' })
    }
    const old = oldRows[0]

    const product = await getProductById(connection, product_id)
    if (!product) {
      await connection.rollback()
      return res.status(404).json({ message: 'Produk tidak ditemukan' })
    }

    if (Number(old.product_id) === Number(product_id)) {
      const allowedQty = Number(product.current_stock) + Number(old.quantity)
      if (allowedQty < Number(quantity)) {
        await connection.rollback()
        return res.status(400).json({ message: 'Stok tidak cukup untuk update transaksi ini' })
      }
    } else if (Number(product.current_stock) < Number(quantity)) {
      await connection.rollback()
      return res.status(400).json({ message: 'Stok produk tujuan tidak cukup' })
    }
    if (Number(selling_price) < 0 || Number(quantity) <= 0) {
      await connection.rollback()
      return res.status(400).json({ message: 'Quantity dan harga jual wajib valid' })
    }

    const averagePurchasePrice = await getProductAveragePurchasePrice(
      connection,
      product_id,
      normalizeDateInput(transaction_date),
    )

    const refNorm = normalizeReferenceNo(reference_no)
    await assertReferenceNoUnique(connection, refNorm, { excludeOutgoingId: Number(id) })

    await connection.execute(
      `
      UPDATE outgoing_goods
      SET product_id = ?, quantity = ?, reference_no = ?, notes = ?, transaction_date = ?, purchase_price = ?, selling_price = ?
      WHERE id = ?
      `,
      [
        product_id,
        Number(quantity),
        refNorm,
        notes || null,
        transaction_date,
        Number(averagePurchasePrice || 0),
        Number(selling_price || 0),
        id,
      ],
    )

    await recalculateStockByProductId(connection, old.product_id)
    if (Number(old.product_id) !== Number(product_id)) {
      await recalculateStockByProductId(connection, product_id)
    }

    await logActivity(connection, 'UPDATE_OUTGOING', `Edit barang keluar ${product.name} sebanyak ${quantity}`)
    await connection.commit()

    res.json({ message: 'Barang keluar berhasil diperbarui' })
  } catch (error) {
    await connection.rollback()
    if (Number(error.statusCode) === 400) {
      res.status(400).json({ message: error.message })
      return
    }
    res.status(500).json({ message: error.message })
  } finally {
    connection.release()
  }
})

app.delete('/api/outgoing/:id', async (req, res) => {
  const connection = await pool.getConnection()
  try {
    const { id } = req.params
    await connection.beginTransaction()

    const [rows] = await connection.execute(
      `
      SELECT og.id, og.quantity, og.product_id, p.name
      FROM outgoing_goods og
      JOIN products p ON p.id = og.product_id
      WHERE og.id = ?
      `,
      [id],
    )

    if (!rows.length) {
      await connection.rollback()
      return res.status(404).json({ message: 'Data barang keluar tidak ditemukan' })
    }

    await connection.execute('DELETE FROM outgoing_goods WHERE id = ?', [id])
    await recalculateStockByProductId(connection, rows[0].product_id)
    await logActivity(connection, 'DELETE_OUTGOING', `Hapus barang keluar ${rows[0].name}`)
    await connection.commit()

    res.json({ message: 'Barang keluar berhasil dihapus' })
  } catch (error) {
    await connection.rollback()
    res.status(500).json({ message: error.message })
  } finally {
    connection.release()
  }
})

app.get('/api/bookkeeping', async (req, res) => {
  const connection = await pool.getConnection()
  try {
    const startDate = normalizeDateInput(req.query.start_date)
    const endDate = normalizeDateInput(req.query.end_date)
    const { page, limit } = parsePagination(req.query)
    const whereClauses = []
    const whereParams = []
    if (startDate) {
      whereClauses.push('og.transaction_date >= ?')
      whereParams.push(startDate)
    }
    if (endDate) {
      whereClauses.push('og.transaction_date <= ?')
      whereParams.push(endDate)
    }
    const where = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : ''

    const [countRows] = await connection.execute(
      `
      SELECT COUNT(*) AS total
      FROM outgoing_goods og
      ${where}
      `,
      whereParams,
    )
    const meta = buildPaginationMeta(page, limit, Number(countRows[0]?.total || 0))

    const [rows] = await connection.execute(
      `
      SELECT
        og.id,
        og.product_id,
        og.transaction_date,
        og.quantity,
        og.purchase_price,
        og.selling_price,
        og.discount,
        p.code AS product_code,
        p.name AS product_name
      FROM outgoing_goods og
      JOIN products p ON p.id = og.product_id
      ${where}
      ORDER BY og.transaction_date DESC, og.id DESC
      LIMIT ? OFFSET ?
      `,
      [...whereParams, meta.limit, meta.offset],
    )

    const data = await Promise.all(
      rows.map(async (row) => {
        const qty = Number(row.quantity || 0)
        const livePurchase = await getProductAveragePurchasePrice(connection, row.product_id, row.transaction_date)
        const margin = (Number(row.selling_price || 0) - Number(row.discount || 0) - livePurchase) * qty
        return {
          ...row,
          purchase_price: livePurchase,
          margin,
        }
      }),
    )

    const hasIncomingPurchasePrice = await hasColumn(connection, 'incoming_goods', 'purchase_price')
    const statsSql = hasIncomingPurchasePrice
      ? `
      SELECT
        COUNT(*) AS total_transactions,
        COALESCE(SUM(og.selling_price * og.quantity), 0) AS total_revenue,
        COALESCE(SUM(
          (og.selling_price - og.discount - (
            CASE
              WHEN COALESCE(ig.total_qty, 0) > 0 AND COALESCE(ig.total_cost, 0) > 0
                THEN ig.total_cost / ig.total_qty
              ELSE p.purchase_price
            END
          )) * og.quantity
        ), 0) AS total_margin
      FROM outgoing_goods og
      JOIN products p ON p.id = og.product_id
      LEFT JOIN (
        SELECT
          product_id,
          COALESCE(SUM(quantity), 0) AS total_qty,
          COALESCE(SUM(quantity * purchase_price), 0) AS total_cost
        FROM incoming_goods
        GROUP BY product_id
      ) ig ON ig.product_id = og.product_id
      ${where}
      `
      : `
      SELECT
        COUNT(*) AS total_transactions,
        COALESCE(SUM(og.selling_price * og.quantity), 0) AS total_revenue,
        COALESCE(SUM((og.selling_price - og.discount - p.purchase_price) * og.quantity), 0) AS total_margin
      FROM outgoing_goods og
      JOIN products p ON p.id = og.product_id
      ${where}
      `

    const [statsRows] = await connection.execute(statsSql, whereParams)
    const stats = statsRows[0] || {
      total_transactions: 0,
      total_revenue: 0,
      total_margin: 0,
    }

    res.json({
      data,
      stats,
      meta: {
        page: meta.page,
        limit: meta.limit,
        total_items: meta.total_items,
        total_pages: meta.total_pages,
      },
    })
  } catch (error) {
    res.status(500).json({ message: error.message })
  } finally {
    connection.release()
  }
})

app.post('/api/bookkeeping', async (req, res) => {
  const connection = await pool.getConnection()
  try {
    const { outgoing_id, selling_price, discount } = req.body
    await connection.beginTransaction()

    const [rows] = await connection.execute('SELECT id, product_id, transaction_date FROM outgoing_goods WHERE id = ?', [outgoing_id])
    if (!rows.length) {
      await connection.rollback()
      return res.status(404).json({ message: 'Transaksi keluar tidak ditemukan' })
    }

    const productId = rows[0].product_id
    const averagePurchasePrice = await getProductAveragePurchasePrice(connection, productId, rows[0].transaction_date)

    await connection.execute(
      `
      UPDATE outgoing_goods
      SET purchase_price = ?, selling_price = ?, discount = ?
      WHERE id = ?
      `,
      [Number(averagePurchasePrice || 0), Number(selling_price || 0), Number(discount || 0), outgoing_id],
    )

    await logActivity(connection, 'UPDATE_BOOKKEEPING', `Edit pembukuan transaksi keluar #${outgoing_id}`)
    await connection.commit()
    res.json({ message: 'Pembukuan berhasil diperbarui' })
  } catch (error) {
    await connection.rollback()
    res.status(500).json({ message: error.message })
  } finally {
    connection.release()
  }
})

app.get('/api/activity', async (req, res) => {
  try {
    const { page, limit } = parsePagination(req.query)
    const [countRows] = await pool.execute('SELECT COUNT(*) AS total FROM activity_logs')
    const meta = buildPaginationMeta(page, limit, Number(countRows[0]?.total || 0))
    const [rows] = await pool.execute(
      'SELECT * FROM activity_logs ORDER BY created_at DESC LIMIT ? OFFSET ?',
      [meta.limit, meta.offset],
    )

    res.json({
      data: rows,
      meta: {
        page: meta.page,
        limit: meta.limit,
        total_items: meta.total_items,
        total_pages: meta.total_pages,
      },
    })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
})

app.get('/api/notes', async (_req, res) => {
  try {
    const [rows] = await pool.execute(
      `
      SELECT id, name, columns_json, rows_json, updated_at
      FROM notes_sheets
      ORDER BY id ASC
      LIMIT 1
      `,
    )
    if (!rows.length) {
      return res.status(404).json({ message: 'Sheet catatan tidak ditemukan' })
    }

    const sheet = rows[0]
    res.json({
      data: {
        id: sheet.id,
        name: sheet.name,
        columns: JSON.parse(sheet.columns_json || '[]'),
        rows: JSON.parse(sheet.rows_json || '[]'),
        updated_at: sheet.updated_at,
      },
    })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
})

app.post('/api/notes', async (req, res) => {
  const connection = await pool.getConnection()
  try {
    const columns = Array.isArray(req.body.columns) ? req.body.columns : []
    const rows = Array.isArray(req.body.rows) ? req.body.rows : []

    if (!columns.length) {
      return res.status(400).json({ message: 'Minimal harus ada 1 kolom' })
    }

    const normalizedColumns = columns
      .map((item) => String(item || '').trim())
      .filter(Boolean)
      .slice(0, 30)
    if (!normalizedColumns.length) {
      return res.status(400).json({ message: 'Nama kolom tidak boleh kosong' })
    }

    const normalizedRows = rows.slice(0, 1000).map((row) => {
      const source = row && typeof row === 'object' ? row : {}
      const normalizedRow = {}
      normalizedColumns.forEach((column) => {
        normalizedRow[column] = String(source[column] ?? '').slice(0, 500)
      })
      return normalizedRow
    })

    await connection.beginTransaction()
    const [sheetRows] = await connection.execute('SELECT id FROM notes_sheets ORDER BY id ASC LIMIT 1')
    if (!sheetRows.length) {
      await connection.execute(
        `
        INSERT INTO notes_sheets (name, columns_json, rows_json)
        VALUES (?, ?, ?)
        `,
        ['Catatan Utama', JSON.stringify(normalizedColumns), JSON.stringify(normalizedRows)],
      )
    } else {
      await connection.execute(
        `
        UPDATE notes_sheets
        SET columns_json = ?, rows_json = ?
        WHERE id = ?
        `,
        [JSON.stringify(normalizedColumns), JSON.stringify(normalizedRows), sheetRows[0].id],
      )
    }

    await logActivity(connection, 'SAVE_NOTE_SHEET', `Menyimpan sheet catatan (${normalizedRows.length} baris)`)
    await connection.commit()
    res.json({ message: 'Catatan berhasil disimpan' })
  } catch (error) {
    await connection.rollback()
    res.status(500).json({ message: error.message })
  } finally {
    connection.release()
  }
})

app.post('/api/notes/reset', async (_req, res) => {
  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()
    const defaultColumns = ['Data', 'Hutang', 'Total', 'Dead']
    const [sheetRows] = await connection.execute('SELECT id FROM notes_sheets ORDER BY id ASC LIMIT 1')
    if (!sheetRows.length) {
      await connection.execute(
        `
        INSERT INTO notes_sheets (name, columns_json, rows_json)
        VALUES (?, ?, ?)
        `,
        ['Catatan Utama', JSON.stringify(defaultColumns), JSON.stringify([])],
      )
    } else {
      await connection.execute(
        `
        UPDATE notes_sheets
        SET columns_json = ?, rows_json = ?
        WHERE id = ?
        `,
        [JSON.stringify(defaultColumns), JSON.stringify([]), sheetRows[0].id],
      )
    }

    await logActivity(connection, 'RESET_NOTE_SHEET', 'Reset sheet catatan')
    await connection.commit()
    res.json({ message: 'Catatan berhasil direset' })
  } catch (error) {
    await connection.rollback()
    res.status(500).json({ message: error.message })
  } finally {
    connection.release()
  }
})

app.get('/api/dashboard', async (_req, res) => {
  try {
    const [productStats] = await pool.execute(
      `
      SELECT
        COUNT(*) AS total_products,
        COALESCE(SUM(current_stock), 0) AS total_stock,
        COALESCE(SUM(current_stock * purchase_price), 0) AS stock_value,
        COALESCE(SUM(CASE WHEN current_stock <= min_stock THEN 1 ELSE 0 END), 0) AS low_stock_count
      FROM products
      `,
    )
    const [incomingStats] = await pool.execute('SELECT COALESCE(SUM(quantity), 0) AS total_incoming_qty FROM incoming_goods')
    const [outgoingStats] = await pool.execute('SELECT COALESCE(SUM(quantity), 0) AS total_outgoing_qty FROM outgoing_goods')
    const [activityStats] = await pool.execute('SELECT COUNT(*) AS total_activities FROM activity_logs')
    const [lowStockProducts] = await pool.execute(
      `
      SELECT id, code, name, current_stock, min_stock
      FROM products
      WHERE current_stock <= min_stock
      ORDER BY current_stock ASC
      LIMIT 5
      `,
    )

    res.json({
      totalProducts: productStats[0].total_products,
      totalStock: productStats[0].total_stock,
      stockValue: productStats[0].stock_value,
      lowStockCount: productStats[0].low_stock_count,
      totalIncomingQty: incomingStats[0].total_incoming_qty,
      totalOutgoingQty: outgoingStats[0].total_outgoing_qty,
      totalActivities: activityStats[0].total_activities,
      lowStockProducts,
    })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
})

const startServer = async () => {
  await ensureNotesTable()
  await ensurePurchasePriceColumns()
  await ensureDefaultAdmin()
  app.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`Awy Kids Corner API running on http://localhost:${port}`)
  })
}

startServer().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('Gagal start server:', error)
  process.exit(1)
})
