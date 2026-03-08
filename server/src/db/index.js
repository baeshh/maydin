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

    CREATE TABLE IF NOT EXISTS product_reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      order_id INTEGER NOT NULL,
      order_item_key TEXT NOT NULL,
      option_label TEXT,
      rating INTEGER NOT NULL DEFAULT 5,
      title TEXT,
      content TEXT NOT NULL,
      images TEXT,
      is_deleted INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(order_id, order_item_key)
    );

    CREATE TABLE IF NOT EXISTS product_qna (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      subject TEXT NOT NULL,
      content TEXT NOT NULL,
      images TEXT,
      is_secret INTEGER DEFAULT 0,
      status TEXT DEFAULT 'pending',
      admin_answer TEXT,
      answered_at DATETIME,
      answered_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const cartCols = getColumns('cart');
  const ordersCols = getColumns('orders');
  const reviewCols = getColumns('product_reviews');
  const qnaCols = getColumns('product_qna');

  if (!cartCols.includes('product_id')) db.exec('ALTER TABLE cart ADD COLUMN product_id INTEGER');
  if (!cartCols.includes('product_name')) db.exec('ALTER TABLE cart ADD COLUMN product_name TEXT');
  if (!cartCols.includes('option_label')) db.exec('ALTER TABLE cart ADD COLUMN option_label TEXT');
  if (!cartCols.includes('price')) db.exec('ALTER TABLE cart ADD COLUMN price INTEGER');
  if (!cartCols.includes('qty')) db.exec('ALTER TABLE cart ADD COLUMN qty INTEGER DEFAULT 1');
  if (!cartCols.includes('created_at')) db.exec('ALTER TABLE cart ADD COLUMN created_at DATETIME');
  if (!reviewCols.includes('option_label')) db.exec('ALTER TABLE product_reviews ADD COLUMN option_label TEXT');
  if (!reviewCols.includes('title')) db.exec('ALTER TABLE product_reviews ADD COLUMN title TEXT');
  if (!reviewCols.includes('images')) db.exec('ALTER TABLE product_reviews ADD COLUMN images TEXT');
  if (!reviewCols.includes('is_deleted')) db.exec('ALTER TABLE product_reviews ADD COLUMN is_deleted INTEGER DEFAULT 0');
  if (!reviewCols.includes('updated_at')) db.exec('ALTER TABLE product_reviews ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP');
  if (!qnaCols.includes('images')) db.exec('ALTER TABLE product_qna ADD COLUMN images TEXT');
  if (!qnaCols.includes('is_secret')) db.exec('ALTER TABLE product_qna ADD COLUMN is_secret INTEGER DEFAULT 0');
  if (!qnaCols.includes('status')) db.exec("ALTER TABLE product_qna ADD COLUMN status TEXT DEFAULT 'pending'");
  if (!qnaCols.includes('admin_answer')) db.exec('ALTER TABLE product_qna ADD COLUMN admin_answer TEXT');
  if (!qnaCols.includes('answered_at')) db.exec('ALTER TABLE product_qna ADD COLUMN answered_at DATETIME');
  if (!qnaCols.includes('answered_by')) db.exec('ALTER TABLE product_qna ADD COLUMN answered_by INTEGER');
  if (!qnaCols.includes('updated_at')) db.exec('ALTER TABLE product_qna ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP');

  if (!ordersCols.includes('delivery_address')) db.exec('ALTER TABLE orders ADD COLUMN delivery_address TEXT');
  if (!ordersCols.includes('payment_method')) db.exec("ALTER TABLE orders ADD COLUMN payment_method TEXT DEFAULT 'bank_transfer'");
  if (!ordersCols.includes('tracking_company')) db.exec('ALTER TABLE orders ADD COLUMN tracking_company TEXT');
  if (!ordersCols.includes('tracking_number')) db.exec('ALTER TABLE orders ADD COLUMN tracking_number TEXT');
  if (!ordersCols.includes('paid_at')) db.exec('ALTER TABLE orders ADD COLUMN paid_at DATETIME');

  try { db.exec('CREATE INDEX IF NOT EXISTS idx_cart_user ON cart(user_id)'); } catch (_) {}
  try { db.exec('CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id)'); } catch (_) {}
  try { db.exec('CREATE INDEX IF NOT EXISTS idx_product_reviews_product ON product_reviews(product_id, created_at DESC)'); } catch (_) {}
  try { db.exec('CREATE INDEX IF NOT EXISTS idx_product_reviews_user ON product_reviews(user_id, created_at DESC)'); } catch (_) {}
  try { db.exec('CREATE INDEX IF NOT EXISTS idx_product_qna_product ON product_qna(product_id, created_at DESC)'); } catch (_) {}
  try { db.exec('CREATE INDEX IF NOT EXISTS idx_product_qna_user ON product_qna(user_id, created_at DESC)'); } catch (_) {}

  const productCols = getColumns('products');
  if (productCols.length && !productCols.includes('margin_percent')) db.exec('ALTER TABLE products ADD COLUMN margin_percent REAL');
  if (productCols.length && !productCols.includes('images')) db.exec('ALTER TABLE products ADD COLUMN images TEXT');
  if (productCols.length && !productCols.includes('detail_images')) db.exec('ALTER TABLE products ADD COLUMN detail_images TEXT');
  if (!cartCols.includes('image_url')) db.exec('ALTER TABLE cart ADD COLUMN image_url TEXT');
}

ensureRuntimeSchema();

module.exports = db;
