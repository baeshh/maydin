const express = require('express');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// POST /api/orders - 주문 생성 (인증 필요)
router.post('/', (req, res) => {
  const authHeader = req.headers.authorization;
  let userId = null;
  let userLicense = null;
  let userEmail = null;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.slice(7);
      const payload = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret');
      const user = db.prepare('SELECT id, license, email FROM users WHERE id = ?').get(payload.userId);
      if (user) {
        userId = user.id;
        userLicense = user.license;
        userEmail = user.email;
      }
    } catch (e) {}
  }

  const { items, total, userEmail: bodyEmail } = req.body;
  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ success: false, message: '주문 항목이 필요합니다.' });
  }

  const computedTotal = items.reduce((sum, i) => sum + (i.price || 0) * (i.qty || 1), 0);
  const orderTotal = typeof total === 'number' ? total : computedTotal;

  const stmt = db.prepare(`
    INSERT INTO orders (user_id, user_license, user_email, items, total, status)
    VALUES (?, ?, ?, ?, ?, 'pending')
  `);

  const email = userEmail || bodyEmail || null;
  const result = stmt.run(userId || 0, userLicense || null, email, JSON.stringify(items), orderTotal);
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(result.lastInsertRowid);

  res.json({
    success: true,
    orderId: order.id,
    message: '주문이 접수되었습니다.'
  });
});

// GET /api/orders - 주문 목록 (인증 필요)
router.get('/', authMiddleware, (req, res) => {
  const orders = db.prepare(`
    SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC
  `).all(req.user.userId);

  const list = orders.map(o => ({
    id: o.id,
    items: JSON.parse(o.items || '[]'),
    total: o.total,
    status: o.status,
    createdAt: o.created_at
  }));

  res.json({ success: true, orders: list });
});

module.exports = router;
