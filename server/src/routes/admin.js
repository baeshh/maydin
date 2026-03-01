const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { adminAuthMiddleware } = require('../middleware/adminAuth');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

// POST /api/admin/auth/login
router.post('/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ success: false, message: '이메일과 비밀번호를 입력하세요.' });
  }

  const admin = db.prepare('SELECT * FROM admin_users WHERE email = ?').get(email);
  if (!admin) {
    return res.status(401).json({ success: false, message: '존재하지 않는 계정입니다.' });
  }

  const ok = bcrypt.compareSync(password, admin.password);
  if (!ok) {
    return res.status(401).json({ success: false, message: '비밀번호가 일치하지 않습니다.' });
  }

  const token = jwt.sign(
    { adminId: admin.id, role: 'admin' },
    JWT_SECRET,
    { expiresIn: '24h' }
  );

  res.json({
    success: true,
    admin: { id: admin.id, email: admin.email, name: admin.name },
    token
  });
});

// GET /api/admin/auth/me
router.get('/auth/me', adminAuthMiddleware, (req, res) => {
  res.json({ success: true, admin: { id: req.admin.id, email: req.admin.email, name: req.admin.name } });
});

// ---- 상품 관리 ----
router.get('/products', adminAuthMiddleware, (req, res) => {
  const rows = db.prepare('SELECT * FROM products ORDER BY id').all();
  const list = rows.map(r => ({
    id: r.id, name: r.name, description: r.description, price: r.price, originalPrice: r.original_price,
    unit: r.unit, tag: r.tag, category: r.category, descShort: r.desc_short,
    isBest: !!r.is_best, isNew: !!r.is_new, rating: r.rating, imageUrl: r.image_url,
    specs: r.specs ? JSON.parse(r.specs) : null, benefits: r.benefits ? JSON.parse(r.benefits) : null,
    options: r.options ? JSON.parse(r.options) : null, createdAt: r.created_at
  }));
  res.json({ success: true, products: list });
});

router.post('/products', adminAuthMiddleware, (req, res) => {
  const { name, description, price, originalPrice, unit, tag, category, descShort, isBest, isNew, rating, options } = req.body;
  if (!name || price == null) {
    return res.status(400).json({ success: false, message: '상품명과 가격은 필수입니다.' });
  }
  const stmt = db.prepare(`
    INSERT INTO products (name, description, price, original_price, unit, tag, category, desc_short, is_best, is_new, rating, options)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const opts = options ? JSON.stringify(Array.isArray(options) ? options : []) : '[]';
  stmt.run(name || null, description || null, price, originalPrice || null, unit || '/ 30일', tag || null, category || null, descShort || null, isBest ? 1 : 0, isNew ? 1 : 0, rating || null, opts);
  const row = db.prepare('SELECT * FROM products WHERE id = ?').get(db.prepare('SELECT last_insert_rowid() as id').get().id);
  res.json({ success: true, product: { id: row.id, name: row.name, price: row.price } });
});

router.put('/products/:id', adminAuthMiddleware, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { name, description, price, originalPrice, unit, tag, category, descShort, isBest, isNew, rating, options } = req.body;
  const existing = db.prepare('SELECT id FROM products WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ success: false, message: '상품을 찾을 수 없습니다.' });

  const stmt = db.prepare(`
    UPDATE products SET name=?, description=?, price=?, original_price=?, unit=?, tag=?, category=?, desc_short=?, is_best=?, is_new=?, rating=?
    ${options !== undefined ? ', options=?' : ''} WHERE id=?
  `);
  const opts = options !== undefined ? JSON.stringify(Array.isArray(options) ? options : []) : null;
  if (opts !== null) {
    stmt.run(name, description, price, originalPrice, unit, tag, category, descShort, isBest ? 1 : 0, isNew ? 1 : 0, rating, opts, id);
  } else {
    db.prepare('UPDATE products SET name=?, description=?, price=?, original_price=?, unit=?, tag=?, category=?, desc_short=?, is_best=?, is_new=?, rating=? WHERE id=?')
      .run(name, description, price, originalPrice, unit, tag, category, descShort, isBest ? 1 : 0, isNew ? 1 : 0, rating, id);
  }
  res.json({ success: true });
});

router.delete('/products/:id', adminAuthMiddleware, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const r = db.prepare('DELETE FROM products WHERE id = ?').run(id);
  if (r.changes === 0) return res.status(404).json({ success: false, message: '상품을 찾을 수 없습니다.' });
  res.json({ success: true });
});

// ---- 주문 관리 ----
router.get('/orders', adminAuthMiddleware, (req, res) => {
  const rows = db.prepare('SELECT * FROM orders ORDER BY created_at DESC').all();
  const list = rows.map(o => ({
    id: o.id, userId: o.user_id, userLicense: o.user_license, userEmail: o.user_email,
    items: JSON.parse(o.items || '[]'), total: o.total, status: o.status, createdAt: o.created_at
  }));
  res.json({ success: true, orders: list });
});

router.patch('/orders/:id', adminAuthMiddleware, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { status } = req.body;
  const allowed = ['pending', 'paid', 'preparing', 'shipped', 'delivered', 'cancelled'];
  if (!status || !allowed.includes(status)) {
    return res.status(400).json({ success: false, message: '유효한 배송상태가 아닙니다.' });
  }
  const r = db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(status, id);
  if (r.changes === 0) return res.status(404).json({ success: false });
  res.json({ success: true });
});

// ---- 블로그/소식 ----
router.get('/posts', adminAuthMiddleware, (req, res) => {
  const type = req.query.type;
  const rows = type && type !== 'all'
    ? db.prepare('SELECT * FROM posts WHERE type = ? ORDER BY created_at DESC').all(type)
    : db.prepare('SELECT * FROM posts ORDER BY created_at DESC').all();
  res.json({ success: true, posts: rows });
});

router.get('/posts/all', (req, res) => {
  const rows = db.prepare('SELECT * FROM posts WHERE is_published = 1 ORDER BY created_at DESC').all();
  res.json({ success: true, posts: rows });
});

router.post('/posts', adminAuthMiddleware, (req, res) => {
  const { title, content, type } = req.body;
  if (!title) return res.status(400).json({ success: false, message: '제목은 필수입니다.' });
  db.prepare('INSERT INTO posts (title, content, type) VALUES (?, ?, ?)').run(title, content || '', type || 'news');
  const row = db.prepare('SELECT * FROM posts ORDER BY id DESC LIMIT 1').get();
  res.json({ success: true, post: { id: row.id, title: row.title } });
});

router.put('/posts/:id', adminAuthMiddleware, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { title, content, type, isPublished } = req.body;
  const r = db.prepare('UPDATE posts SET title=?, content=?, type=?, is_published=?, updated_at=CURRENT_TIMESTAMP WHERE id=?')
    .run(title, content, type || 'news', isPublished !== false ? 1 : 0, id);
  if (r.changes === 0) return res.status(404).json({ success: false });
  res.json({ success: true });
});

router.delete('/posts/:id', adminAuthMiddleware, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const r = db.prepare('DELETE FROM posts WHERE id = ?').run(id);
  if (r.changes === 0) return res.status(404).json({ success: false });
  res.json({ success: true });
});

// ---- 대시보드 통계 ----
router.get('/stats', adminAuthMiddleware, (req, res) => {
  const productCount = db.prepare('SELECT COUNT(*) as c FROM products').get().c;
  const orderCount = db.prepare('SELECT COUNT(*) as c FROM orders').get().c;
  const userCount = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
  const totalSales = db.prepare('SELECT COALESCE(SUM(total), 0) as s FROM orders WHERE status NOT IN ("cancelled")').get().s;
  res.json({
    success: true,
    stats: { productCount, orderCount, userCount, totalSales }
  });
});

module.exports = router;
