const express = require('express');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// POST /api/orders - 주문 생성 (인증 필요)
router.post('/', (req, res) => {
  try {
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

    const body = req.body || {};
    const items = body.items;
    const total = body.total;
    const bodyEmail = body.userEmail;
    const deliveryAddress = body.deliveryAddress;
    const paymentMethod = body.paymentMethod;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: '주문 항목이 필요합니다.' });
    }

    const computedTotal = items.reduce((sum, i) => sum + (i.price || 0) * (i.qty || 1), 0);
    const orderTotal = typeof total === 'number' ? total : computedTotal;

    let finalAddress = deliveryAddress || null;
    if (userId && !finalAddress) {
      const user = db.prepare('SELECT address FROM users WHERE id = ?').get(userId);
      if (user && user.address) finalAddress = user.address;
    }

    const payment_method = paymentMethod || 'bank_transfer';

    const stmt = db.prepare(`
      INSERT INTO orders (user_id, user_license, user_email, items, total, status, delivery_address, payment_method)
      VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)
    `);

    const email = userEmail || bodyEmail || null;
    const result = stmt.run(userId || 0, userLicense || null, email, JSON.stringify(items), orderTotal, finalAddress, payment_method);
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(result.lastInsertRowid);

    return res.json({
      success: true,
      orderId: order.id,
      message: '주문이 접수되었습니다.'
    });
  } catch (e) {
    console.error('POST /api/orders', e);
    return res.status(500).json({ success: false, message: '서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' });
  }
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
    deliveryAddress: o.delivery_address,
    trackingCompany: o.tracking_company || null,
    trackingNumber: o.tracking_number || null,
    paidAt: o.paid_at || null,
    createdAt: o.created_at
  }));

  res.json({ success: true, orders: list });
});

module.exports = router;
