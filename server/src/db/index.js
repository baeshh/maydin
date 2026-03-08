const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
const dbPath = path.join(dataDir, 'maydin.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');

function getColumns(table) {
  return db.prepare(`PRAGMA table_info(${table})`).all().map((col) => col.name);
}

function ensureRuntimeSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS cart (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      product_name TEXT,
      option_label TEXT,
      price INTEGER NOT NULL,
      qty INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      user_license TEXT,
      user_email TEXT,
      items TEXT NOT NULL,
      total INTEGER NOT NULL,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const cartCols = getColumns('cart');
  const ordersCols = getColumns('orders');

  if (!cartCols.includes('product_id')) db.exec('ALTER TABLE cart ADD COLUMN product_id INTEGER');
  if (!cartCols.includes('product_name')) db.exec('ALTER TABLE cart ADD COLUMN product_name TEXT');
  if (!cartCols.includes('option_label')) db.exec('ALTER TABLE cart ADD COLUMN option_label TEXT');
  if (!cartCols.includes('price')) db.exec('ALTER TABLE cart ADD COLUMN price INTEGER');
  if (!cartCols.includes('qty')) db.exec('ALTER TABLE cart ADD COLUMN qty INTEGER DEFAULT 1');
  if (!cartCols.includes('created_at')) db.exec('ALTER TABLE cart ADD COLUMN created_at DATETIME');

  if (!ordersCols.includes('delivery_address')) db.exec('ALTER TABLE orders ADD COLUMN delivery_address TEXT');
  if (!ordersCols.includes('payment_method')) db.exec("ALTER TABLE orders ADD COLUMN payment_method TEXT DEFAULT 'bank_transfer'");
  if (!ordersCols.includes('tracking_company')) db.exec('ALTER TABLE orders ADD COLUMN tracking_company TEXT');
  if (!ordersCols.includes('tracking_number')) db.exec('ALTER TABLE orders ADD COLUMN tracking_number TEXT');
  if (!ordersCols.includes('paid_at')) db.exec('ALTER TABLE orders ADD COLUMN paid_at DATETIME');

  try { db.exec('CREATE INDEX IF NOT EXISTS idx_cart_user ON cart(user_id)'); } catch (_) {}
  try { db.exec('CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id)'); } catch (_) {}

  const productCols = getColumns('products');
  if (productCols.length && !productCols.includes('margin_percent')) {
    db.exec('ALTER TABLE products ADD COLUMN margin_percent REAL');
  }
}

ensureRuntimeSchema();

module.exports = db;
