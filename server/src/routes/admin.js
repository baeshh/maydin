const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../db');
const { adminAuthMiddleware } = require('../middleware/adminAuth');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => cb(null, Date.now() + '-' + Math.random().toString(36).slice(2) + (path.extname(file.originalname) || '.jpg'))
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

function parseJsonArray(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

function refreshProductRating(productId) {
  const row = db.prepare(`
    SELECT ROUND(AVG(rating), 1) AS avg_rating
    FROM product_reviews
    WHERE product_id = ? AND is_deleted = 0
  `).get(productId);
  db.prepare('UPDATE products SET rating = ? WHERE id = ?').run(row && row.avg_rating != null ? row.avg_rating : null, productId);
}

// POST /api/admin/upload - 상품 이미지 업로드 (관리자 인증). 항상 JSON 응답.
router.post('/upload', adminAuthMiddleware, (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      const msg = err.code === 'LIMIT_FILE_SIZE' ? '파일 크기는 5MB 이하여야 합니다.' : (err.message || '업로드 실패');
      return res.status(400).json({ success: false, message: msg });
    }
    if (!req.file) return res.status(400).json({ success: false, message: '파일이 없습니다.' });
    res.json({ success: true, url: '/api/uploads/' + req.file.filename });
  });
});

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
    images: r.images ? (typeof r.images === 'string' ? JSON.parse(r.images) : r.images) : [],
    detailImages: r.detail_images ? (typeof r.detail_images === 'string' ? JSON.parse(r.detail_images) : r.detail_images) : [],
    specs: r.specs ? JSON.parse(r.specs) : null, benefits: r.benefits ? JSON.parse(r.benefits) : null,
    options: r.options ? JSON.parse(r.options) : null, marginPercent: r.margin_percent != null ? r.margin_percent : null,
    createdAt: r.created_at
  }));
  res.json({ success: true, products: list });
});

router.get('/products/:id', adminAuthMiddleware, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const r = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
  if (!r) return res.status(404).json({ success: false, message: '상품을 찾을 수 없습니다.' });
  const product = {
    id: r.id, name: r.name, description: r.description, price: r.price, originalPrice: r.original_price,
    unit: r.unit, tag: r.tag, category: r.category, descShort: r.desc_short,
    isBest: !!r.is_best, isNew: !!r.is_new, rating: r.rating, imageUrl: r.image_url,
    images: r.images ? (typeof r.images === 'string' ? JSON.parse(r.images) : r.images) : [],
    detailImages: r.detail_images ? (typeof r.detail_images === 'string' ? JSON.parse(r.detail_images) : r.detail_images) : [],
    specs: r.specs ? JSON.parse(r.specs) : null, benefits: r.benefits ? JSON.parse(r.benefits) : null,
    options: r.options ? JSON.parse(r.options) : null, marginPercent: r.margin_percent != null ? r.margin_percent : null,
    createdAt: r.created_at
  };
  res.json({ success: true, product });
});

router.post('/products', adminAuthMiddleware, (req, res) => {
  const { name, description, price, originalPrice, unit, tag, category, descShort, isBest, isNew, rating, options, marginPercent, images, detailImages } = req.body;
  if (!name || price == null) {
    return res.status(400).json({ success: false, message: '상품명과 가격은 필수입니다.' });
  }
  const margin = marginPercent != null && marginPercent !== '' ? parseFloat(marginPercent) : null;
  const imgs = Array.isArray(images) ? images : (images ? JSON.parse(images) : []);
  const detailImgs = Array.isArray(detailImages) ? detailImages : (detailImages ? JSON.parse(detailImages) : []);
  const firstImageUrl = (imgs && imgs[0]) ? imgs[0] : null;
  const stmt = db.prepare(`
    INSERT INTO products (name, description, price, original_price, unit, tag, category, desc_short, is_best, is_new, rating, options, margin_percent, images, detail_images, image_url)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const opts = options ? JSON.stringify(Array.isArray(options) ? options : []) : '[]';
  stmt.run(name || null, description || null, price, originalPrice || null, unit || '/ 30일', tag || null, category || null, descShort || null, isBest ? 1 : 0, isNew ? 1 : 0, rating || null, opts, margin, JSON.stringify(imgs), JSON.stringify(detailImgs), firstImageUrl);
  const row = db.prepare('SELECT * FROM products WHERE id = ?').get(db.prepare('SELECT last_insert_rowid() as id').get().id);
  res.json({ success: true, product: { id: row.id, name: row.name, price: row.price } });
});

router.put('/products/:id', adminAuthMiddleware, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { name, description, price, originalPrice, unit, tag, category, descShort, isBest, isNew, rating, options, marginPercent, images, detailImages } = req.body;
  const existing = db.prepare('SELECT id FROM products WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ success: false, message: '상품을 찾을 수 없습니다.' });

  const margin = marginPercent != null && marginPercent !== '' ? parseFloat(marginPercent) : null;
  const imgs = Array.isArray(images) ? images : (images ? JSON.parse(images) : []);
  const detailImgs = Array.isArray(detailImages) ? detailImages : (detailImages ? JSON.parse(detailImages) : []);
  const firstImageUrl = (imgs && imgs[0]) ? imgs[0] : null;
  const stmt = db.prepare(`
    UPDATE products SET name=?, description=?, price=?, original_price=?, unit=?, tag=?, category=?, desc_short=?, is_best=?, is_new=?, rating=?, margin_percent=?, images=?, detail_images=?, image_url=?
    ${options !== undefined ? ', options=?' : ''} WHERE id=?
  `);
  const opts = options !== undefined ? JSON.stringify(Array.isArray(options) ? options : []) : null;
  if (opts !== null) {
    stmt.run(name, description, price, originalPrice, unit, tag, category, descShort, isBest ? 1 : 0, isNew ? 1 : 0, rating, margin, JSON.stringify(imgs), JSON.stringify(detailImgs), firstImageUrl, opts, id);
  } else {
    db.prepare('UPDATE products SET name=?, description=?, price=?, original_price=?, unit=?, tag=?, category=?, desc_short=?, is_best=?, is_new=?, rating=?, margin_percent=?, images=?, detail_images=?, image_url=? WHERE id=?')
      .run(name, description, price, originalPrice, unit, tag, category, descShort, isBest ? 1 : 0, isNew ? 1 : 0, rating, margin, JSON.stringify(imgs), JSON.stringify(detailImgs), firstImageUrl, id);
  }
  res.json({ success: true });
});

router.delete('/products/:id', adminAuthMiddleware, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const r = db.prepare('DELETE FROM products WHERE id = ?').run(id);
  if (r.changes === 0) return res.status(404).json({ success: false, message: '상품을 찾을 수 없습니다.' });
  res.json({ success: true });
});

// ---- 회원 관리 ----
router.get('/users', adminAuthMiddleware, (req, res) => {
  const rows = db.prepare(`
    SELECT id, license, name, email, phone, address, pharmacy_name, biz_no, open_date, pharmacy_code, pharmacy_univ, tax_email, status, created_at, approved_at, points_balance, member_no
    FROM users ORDER BY created_at DESC
  `).all();
  const list = rows.map(u => ({
    id: u.id, license: u.license, name: u.name, email: u.email, phone: u.phone, address: u.address,
    pharmacyName: u.pharmacy_name, bizNo: u.biz_no, openDate: u.open_date, pharmacyCode: u.pharmacy_code, pharmacyUniv: u.pharmacy_univ, taxEmail: u.tax_email,
    status: u.status || 'pending', createdAt: u.created_at, approvedAt: u.approved_at,
    pointsBalance: u.points_balance != null ? u.points_balance : 0, memberNo: u.member_no
  }));
  res.json({ success: true, users: list });
});

router.patch('/users/:id', adminAuthMiddleware, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const body = req.body || {};
  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(id);
  if (!user) return res.status(404).json({ success: false, message: '회원을 찾을 수 없습니다.' });

  if (body.status !== undefined) {
    const allowed = ['pending', 'approved', 'rejected', 'withdrawn'];
    if (!allowed.includes(body.status)) {
      return res.status(400).json({ success: false, message: '유효한 상태가 아닙니다.' });
    }
    if (body.status === 'approved') {
      db.prepare('UPDATE users SET status = ?, approved_at = CURRENT_TIMESTAMP, approved_by = ? WHERE id = ?').run(body.status, req.admin.id, id);
    } else {
      db.prepare('UPDATE users SET status = ? WHERE id = ?').run(body.status, id);
    }
  }

  const allowFields = ['name', 'email', 'phone', 'address', 'pharmacy_name', 'biz_no', 'pharmacy_code', 'tax_email', 'member_no', 'memberNo', 'points_balance'];
  const dbKeys = { pharmacy_name: 'pharmacy_name', biz_no: 'biz_no', pharmacy_code: 'pharmacy_code', tax_email: 'tax_email', member_no: 'member_no', memberNo: 'member_no', points_balance: 'points_balance' };
  const updates = [];
  const values = [];
  for (const key of allowFields) {
    const dbKey = dbKeys[key] || key;
    const val = body[key] !== undefined ? body[key] : (key === 'member_no' ? body.memberNo : undefined);
    if (val === undefined) continue;
    if (dbKey === 'points_balance') {
      updates.push('points_balance = ?');
      values.push(parseInt(val, 10) || 0);
    } else {
      updates.push(dbKey + ' = ?');
      values.push(typeof val === 'string' ? val.trim() : val);
    }
  }
  if (updates.length) {
    values.push(id);
    db.prepare('UPDATE users SET ' + updates.join(', ') + ' WHERE id = ?').run(...values);
  }
  res.json({ success: true });
});

router.delete('/users/:id', adminAuthMiddleware, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const r = db.prepare('DELETE FROM users WHERE id = ?').run(id);
  if (r.changes === 0) return res.status(404).json({ success: false, message: '회원을 찾을 수 없습니다.' });
  res.json({ success: true });
});

// ---- 주문 관리 (고객 정보 조인) ----
router.get('/orders', adminAuthMiddleware, (req, res) => {
  const rows = db.prepare(`
    SELECT o.*, u.name as user_name, u.phone as user_phone, u.pharmacy_name, u.address as user_address
    FROM orders o
    LEFT JOIN users u ON u.id = o.user_id
    ORDER BY o.created_at DESC
  `).all();
  const list = rows.map(o => ({
    id: o.id, userId: o.user_id, userLicense: o.user_license, userEmail: o.user_email,
    userName: o.user_name, userPhone: o.user_phone, pharmacyName: o.pharmacy_name,
    deliveryAddress: o.delivery_address || null,
    userAddress: o.user_address || null,
    items: JSON.parse(o.items || '[]'), total: o.total, status: o.status,
    paymentMethod: o.payment_method || 'bank_transfer',
    trackingCompany: o.tracking_company || null, trackingNumber: o.tracking_number || null, paidAt: o.paid_at || null,
    createdAt: o.created_at
  }));
  res.json({ success: true, orders: list });
});

router.patch('/orders/:id', adminAuthMiddleware, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { status, trackingCompany, trackingNumber } = req.body;
  const allowed = ['pending', 'paid', 'preparing', 'shipped', 'delivered', 'cancelled'];
  const updates = [];
  const values = [];

  if (status && allowed.includes(status)) {
    updates.push('status = ?');
    values.push(status);
    if (status === 'paid') {
      updates.push('paid_at = CURRENT_TIMESTAMP');
    }
  }
  if (trackingCompany !== undefined) {
    updates.push('tracking_company = ?');
    values.push(trackingCompany ? String(trackingCompany).trim() : null);
  }
  if (trackingNumber !== undefined) {
    updates.push('tracking_number = ?');
    values.push(trackingNumber ? String(trackingNumber).trim() : null);
  }

  if (updates.length === 0) {
    return res.status(400).json({ success: false, message: '변경할 항목이 없습니다.' });
  }
  values.push(id);
  const r = db.prepare('UPDATE orders SET ' + updates.join(', ') + ' WHERE id = ?').run(...values);
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

// ---- 취소/교환/반품 관리 ----
router.get('/refunds', adminAuthMiddleware, (req, res) => {
  const rows = db.prepare(`
    SELECT r.*, u.name as user_name, u.license, u.email, o.total as order_total, o.items as order_items
    FROM refunds r
    LEFT JOIN users u ON u.id = r.user_id
    LEFT JOIN orders o ON o.id = r.order_id
    ORDER BY r.created_at DESC
  `).all();
  const list = rows.map(r => ({
    id: r.id, orderId: r.order_id, userId: r.user_id, userName: r.user_name, userLicense: r.license, userEmail: r.email,
    type: r.type, reason: r.reason, status: r.status, adminComment: r.admin_comment,
    orderTotal: r.order_total, orderItems: r.order_items ? JSON.parse(r.order_items) : [],
    createdAt: r.created_at, updatedAt: r.updated_at
  }));
  res.json({ success: true, refunds: list });
});

router.patch('/refunds/:id', adminAuthMiddleware, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { status, adminComment } = req.body;
  const allowed = ['pending', 'approved', 'rejected'];
  if (!status || !allowed.includes(status)) {
    return res.status(400).json({ success: false, message: '유효한 상태가 아닙니다.' });
  }
  const r = db.prepare('UPDATE refunds SET status = ?, admin_comment = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(status, (adminComment || '').trim(), id);
  if (r.changes === 0) return res.status(404).json({ success: false });
  res.json({ success: true });
});

// ---- 쿠폰 관리 ----
router.get('/coupons', adminAuthMiddleware, (req, res) => {
  const rows = db.prepare('SELECT * FROM coupons ORDER BY id DESC').all();
  const list = rows.map(c => ({
    id: c.id, name: c.name, code: c.code, type: c.type, value: c.value, minOrder: c.min_order, startAt: c.start_at, endAt: c.end_at, createdAt: c.created_at
  }));
  res.json({ success: true, coupons: list });
});

router.post('/coupons', adminAuthMiddleware, (req, res) => {
  const { name, code, type, value, minOrder, endAt } = req.body;
  if (!name || value == null) {
    return res.status(400).json({ success: false, message: '쿠폰명과 할인값은 필수입니다.' });
  }
  db.prepare('INSERT INTO coupons (name, code, type, value, min_order, end_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(String(name).trim(), (code || '').trim(), type || 'fixed', parseInt(value, 10) || 0, parseInt(minOrder, 10) || 0, endAt || null);
  const row = db.prepare('SELECT * FROM coupons ORDER BY id DESC LIMIT 1').get();
  res.json({ success: true, coupon: { id: row.id, name: row.name } });
});

router.post('/coupons/issue', adminAuthMiddleware, (req, res) => {
  const { userId, couponId } = req.body;
  if (!userId || !couponId) {
    return res.status(400).json({ success: false, message: '회원 ID와 쿠폰 ID가 필요합니다.' });
  }
  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(userId);
  const coupon = db.prepare('SELECT id FROM coupons WHERE id = ?').get(couponId);
  if (!user) return res.status(404).json({ success: false, message: '회원을 찾을 수 없습니다.' });
  if (!coupon) return res.status(404).json({ success: false, message: '쿠폰을 찾을 수 없습니다.' });
  db.prepare('INSERT INTO user_coupons (user_id, coupon_id) VALUES (?, ?)').run(userId, couponId);
  res.json({ success: true, message: '쿠폰이 지급되었습니다.' });
});

// ---- 적립금 지급 ----
router.post('/users/:id/points', adminAuthMiddleware, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { points } = req.body;
  const user = db.prepare('SELECT id, points_balance FROM users WHERE id = ?').get(id);
  if (!user) return res.status(404).json({ success: false, message: '회원을 찾을 수 없습니다.' });
  const add = parseInt(points, 10) || 0;
  const newBalance = (user.points_balance || 0) + add;
  db.prepare('UPDATE users SET points_balance = ? WHERE id = ?').run(newBalance, id);
  res.json({ success: true, pointsBalance: newBalance });
});

// ---- 1:1 문의 관리 ----
router.get('/inquiries', adminAuthMiddleware, (req, res) => {
  const rows = db.prepare(`
    SELECT i.*, u.name as user_name, u.license, u.email
    FROM inquiries i
    LEFT JOIN users u ON u.id = i.user_id
    ORDER BY i.created_at DESC
  `).all();
  const list = rows.map(i => ({
    id: i.id, userId: i.user_id, userName: i.user_name, userLicense: i.license, userEmail: i.email,
    subject: i.subject, content: i.content, adminReply: i.admin_reply, status: i.status, createdAt: i.created_at, repliedAt: i.replied_at
  }));
  res.json({ success: true, inquiries: list });
});

router.patch('/inquiries/:id', adminAuthMiddleware, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { adminReply } = req.body;
  const r = db.prepare('UPDATE inquiries SET admin_reply = ?, status = ?, replied_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run((adminReply || '').trim(), adminReply ? 'answered' : 'pending', id);
  if (r.changes === 0) return res.status(404).json({ success: false });
  res.json({ success: true });
});

// ---- 상품 구매평 관리 ----
router.get('/reviews', adminAuthMiddleware, (req, res) => {
  const rows = db.prepare(`
    SELECT pr.*, p.name AS product_name, u.name AS user_name, u.license AS user_license, u.email AS user_email
    FROM product_reviews pr
    LEFT JOIN products p ON p.id = pr.product_id
    LEFT JOIN users u ON u.id = pr.user_id
    ORDER BY pr.created_at DESC
  `).all();
  const reviews = rows.map((r) => ({
    id: r.id,
    productId: r.product_id,
    productName: r.product_name || '-',
    userId: r.user_id,
    userName: r.user_name || '-',
    userLicense: r.user_license || '-',
    userEmail: r.user_email || '-',
    orderId: r.order_id,
    rating: Number(r.rating || 0),
    title: r.title || '',
    content: r.content || '',
    images: parseJsonArray(r.images),
    isDeleted: !!r.is_deleted,
    createdAt: r.created_at,
    updatedAt: r.updated_at
  }));
  res.json({ success: true, reviews });
});

router.patch('/reviews/:id', adminAuthMiddleware, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const existing = db.prepare('SELECT id, product_id FROM product_reviews WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ success: false, message: '구매평을 찾을 수 없습니다.' });
  const isDeleted = req.body && req.body.isDeleted ? 1 : 0;
  db.prepare('UPDATE product_reviews SET is_deleted = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(isDeleted, id);
  refreshProductRating(existing.product_id);
  res.json({ success: true });
});

// ---- 상품 Q&A 관리 ----
router.get('/product-qna', adminAuthMiddleware, (req, res) => {
  const rows = db.prepare(`
    SELECT q.*, p.name AS product_name, u.name AS user_name, u.license AS user_license, u.email AS user_email
    FROM product_qna q
    LEFT JOIN products p ON p.id = q.product_id
    LEFT JOIN users u ON u.id = q.user_id
    ORDER BY q.created_at DESC
  `).all();
  const qna = rows.map((q) => ({
    id: q.id,
    productId: q.product_id,
    productName: q.product_name || '-',
    userId: q.user_id,
    userName: q.user_name || '-',
    userLicense: q.user_license || '-',
    userEmail: q.user_email || '-',
    subject: q.subject || '',
    content: q.content || '',
    images: parseJsonArray(q.images),
    isSecret: !!q.is_secret,
    status: q.status || 'pending',
    adminAnswer: q.admin_answer || '',
    answeredAt: q.answered_at || null,
    createdAt: q.created_at
  }));
  res.json({ success: true, qna });
});

router.patch('/product-qna/:id', adminAuthMiddleware, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const existing = db.prepare('SELECT id FROM product_qna WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ success: false, message: 'Q&A를 찾을 수 없습니다.' });
  const adminAnswer = (req.body && req.body.adminAnswer ? String(req.body.adminAnswer) : '').trim();
  const status = req.body && req.body.status ? String(req.body.status) : (adminAnswer ? 'answered' : 'pending');
  if (!['pending', 'answered'].includes(status)) {
    return res.status(400).json({ success: false, message: '유효한 상태가 아닙니다.' });
  }
  db.prepare(`
    UPDATE product_qna
    SET admin_answer = ?, status = ?, answered_at = ?, answered_by = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(adminAnswer || null, status, adminAnswer ? new Date().toISOString() : null, adminAnswer ? req.admin.id : null, id);
  res.json({ success: true });
});

// ---- 대시보드 통계 ----
router.get('/stats', adminAuthMiddleware, (req, res) => {
  const productCount = db.prepare('SELECT COUNT(*) as c FROM products').get().c;
  const orderCount = db.prepare('SELECT COUNT(*) as c FROM orders').get().c;
  const userCount = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
  const totalSales = db.prepare('SELECT COALESCE(SUM(total), 0) as s FROM orders WHERE status NOT IN ("cancelled")').get().s;

  // 이번 달 / 지난달 (SQLite)
  const thisMonthStart = db.prepare("SELECT date('now', 'start of month', 'localtime') as s").get().s;
  const nextMonthStart = db.prepare("SELECT date('now', 'start of month', '+1 month', 'localtime') as s").get().s;
  const lastMonthStart = db.prepare("SELECT date('now', 'start of month', '-1 month', 'localtime') as s").get().s;

  const thisMonthSalesRow = db.prepare(`
    SELECT COALESCE(SUM(total), 0) as s FROM orders
    WHERE status NOT IN ('cancelled') AND date(created_at) >= date(?) AND date(created_at) < date(?)
  `).get(thisMonthStart, nextMonthStart);
  const lastMonthSalesRow = db.prepare(`
    SELECT COALESCE(SUM(total), 0) as s FROM orders
    WHERE status NOT IN ('cancelled') AND date(created_at) >= date(?) AND date(created_at) < date(?)
  `).get(lastMonthStart, thisMonthStart);
  const thisMonthOrdersRow = db.prepare(`
    SELECT COUNT(*) as c FROM orders
    WHERE status NOT IN ('cancelled') AND date(created_at) >= date(?) AND date(created_at) < date(?)
  `).get(thisMonthStart, nextMonthStart);
  const lastMonthOrdersRow = db.prepare(`
    SELECT COUNT(*) as c FROM orders
    WHERE status NOT IN ('cancelled') AND date(created_at) >= date(?) AND date(created_at) < date(?)
  `).get(lastMonthStart, thisMonthStart);

  const thisMonthSales = thisMonthSalesRow ? Number(thisMonthSalesRow.s) : 0;
  const lastMonthSales = lastMonthSalesRow ? Number(lastMonthSalesRow.s) : 0;
  const thisMonthOrderCount = thisMonthOrdersRow ? thisMonthOrdersRow.c : 0;
  const lastMonthOrderCount = lastMonthOrdersRow ? lastMonthOrdersRow.c : 0;

  const salesTrend = lastMonthSales > 0 ? ((thisMonthSales - lastMonthSales) / lastMonthSales) * 100 : (thisMonthSales > 0 ? 100 : 0);
  const orderTrend = lastMonthOrderCount > 0 ? ((thisMonthOrderCount - lastMonthOrderCount) / lastMonthOrderCount) * 100 : (thisMonthOrderCount > 0 ? 100 : 0);

  // 상품별 마진율 (미설정 시 30.6% 기본)
  const DEFAULT_MARGIN = 30.6;
  const productRows = db.prepare('SELECT id, name, margin_percent FROM products').all();
  const productMarginMap = {};
  productRows.forEach(p => {
    productMarginMap[p.id] = p.margin_percent != null ? p.margin_percent : DEFAULT_MARGIN;
  });
  const productNameMap = {};
  productRows.forEach(p => { productNameMap[p.id] = p.name; });

  function sumProfitAndSales(orders) {
    let totalProfit = 0;
    const byProduct = {};
    orders.forEach(row => {
      try {
        const items = JSON.parse(row.items || '[]');
        items.forEach(it => {
          const pid = it.productId != null ? it.productId : it.product_id;
          const name = it.name || it.productName || productNameMap[pid] || '미상';
          const price = Number(it.price) || 0;
          const qty = Number(it.qty) || 1;
          const margin = (pid != null && productMarginMap[pid] != null) ? productMarginMap[pid] : DEFAULT_MARGIN;
          const profit = (price * qty) * (margin / 100);
          totalProfit += profit;
          if (!byProduct[pid]) byProduct[pid] = { name, sales: 0, profit: 0, marginPercent: margin };
          byProduct[pid].sales += price * qty;
          byProduct[pid].profit += profit;
        });
      } catch (_) {}
    });
    return { totalProfit, byProduct };
  }

  const thisMonthOrders = db.prepare(`
    SELECT items FROM orders
    WHERE status NOT IN ('cancelled') AND date(created_at) >= date(?) AND date(created_at) < date(?)
  `).all(thisMonthStart, nextMonthStart);
  const lastMonthOrders = db.prepare(`
    SELECT items FROM orders
    WHERE status NOT IN ('cancelled') AND date(created_at) >= date(?) AND date(created_at) < date(?)
  `).all(lastMonthStart, thisMonthStart);

  const thisMonthAgg = sumProfitAndSales(thisMonthOrders);
  const lastMonthAgg = sumProfitAndSales(lastMonthOrders);
  const thisMonthNetProfit = Math.round(thisMonthAgg.totalProfit);
  const lastMonthNetProfit = Math.round(lastMonthAgg.totalProfit);
  const netProfitTrend = lastMonthNetProfit > 0 ? ((thisMonthNetProfit - lastMonthNetProfit) / lastMonthNetProfit) * 100 : (thisMonthNetProfit > 0 ? 100 : 0);

  const effectiveMarginThis = thisMonthSales > 0 ? (thisMonthNetProfit / thisMonthSales) * 100 : 0;
  const effectiveMarginLast = lastMonthSales > 0 ? (lastMonthNetProfit / lastMonthSales) * 100 : 0;
  const marginPercent = Math.round(effectiveMarginThis * 10) / 10;
  const marginTrend = effectiveMarginLast > 0 ? Math.round((effectiveMarginThis - effectiveMarginLast) * 10) / 10 : 0;

  const bestProducts = Object.values(thisMonthAgg.byProduct)
    .map(p => ({ name: p.name, sales: p.sales, marginPercent: Math.round((p.sales > 0 ? (p.profit / p.sales) * 100 : p.marginPercent) * 10) / 10 }))
    .sort((a, b) => b.sales - a.sales)
    .slice(0, 10);

  res.json({
    success: true,
    stats: {
      productCount,
      orderCount,
      userCount,
      totalSales,
      thisMonthSales,
      lastMonthSales,
      salesTrend: Math.round(salesTrend * 10) / 10,
      thisMonthNetProfit,
      lastMonthNetProfit,
      netProfitTrend: Math.round(netProfitTrend * 10) / 10,
      marginPercent,
      marginTrend,
      thisMonthOrderCount,
      lastMonthOrderCount,
      orderTrend: Math.round(orderTrend * 10) / 10,
      bestProducts
    }
  });
});

// ---- 차트용 기간별 매출/순수익 (Chart.js 등 직접 연동용) ----
// GET /api/admin/stats/chart?period=1|3|12  (1=1개월, 3=3개월, 12=1년)
router.get('/stats/chart', adminAuthMiddleware, (req, res) => {
  const period = parseInt(req.query.period, 10) || 1;
  const months = period === 12 ? 12 : period === 3 ? 3 : 1;
  const productRows = db.prepare('SELECT id, margin_percent FROM products').all();
  const DEFAULT_MARGIN = 30.6;
  const marginMap = {};
  productRows.forEach(p => {
    marginMap[p.id] = p.margin_percent != null ? p.margin_percent : DEFAULT_MARGIN;
  });

  const labels = [];
  const salesArr = [];
  const netProfitArr = [];
  const now = new Date();

  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const start = d.toISOString().slice(0, 10);
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10);
    labels.push(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'));
    const rows = db.prepare(`
      SELECT items FROM orders
      WHERE status NOT IN ('cancelled') AND date(created_at) >= date(?) AND date(created_at) <= date(?)
    `).all(start, end);
    let monthSales = 0;
    let monthProfit = 0;
    rows.forEach(row => {
      try {
        const items = JSON.parse(row.items || '[]');
        items.forEach(it => {
          const pid = it.productId != null ? it.productId : it.product_id;
          const price = Number(it.price) || 0;
          const qty = Number(it.qty) || 1;
          const margin = (pid != null && marginMap[pid] != null) ? marginMap[pid] : DEFAULT_MARGIN;
          monthSales += price * qty;
          monthProfit += (price * qty) * (margin / 100);
        });
      } catch (_) {}
    });
    salesArr.push(monthSales);
    netProfitArr.push(Math.round(monthProfit));
  }

  res.json({ success: true, chart: { labels, sales: salesArr, netProfit: netProfitArr } });
});

module.exports = router;
