const express = require('express');
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// GET /api/refunds - 내 취소/교환/반품 내역
router.get('/', authMiddleware, (req, res) => {
  const rows = db.prepare(`
    SELECT r.*, o.total as order_total, o.items as order_items
    FROM refunds r
    LEFT JOIN orders o ON o.id = r.order_id
    WHERE r.user_id = ? ORDER BY r.created_at DESC
  `).all(req.user.userId);
  const list = rows.map(r => ({
    id: r.id, orderId: r.order_id, type: r.type, reason: r.reason,
    status: r.status, adminComment: r.admin_comment,
    orderTotal: r.order_total, orderItems: r.order_items ? JSON.parse(r.order_items) : [],
    createdAt: r.created_at, updatedAt: r.updated_at
  }));
  res.json({ success: true, refunds: list });
});

// POST /api/refunds - 취소/교환/반품 신청
router.post('/', authMiddleware, (req, res) => {
  const { orderId, type, reason } = req.body;
  if (!orderId || !type || !['cancel', 'exchange', 'return'].includes(type)) {
    return res.status(400).json({ success: false, message: '주문번호와 유형(취소/교환/반품)을 확인하세요.' });
  }
  const order = db.prepare('SELECT id, user_id FROM orders WHERE id = ?').get(orderId);
  if (!order || order.user_id !== req.user.userId) {
    return res.status(404).json({ success: false, message: '주문을 찾을 수 없습니다.' });
  }
  const existing = db.prepare('SELECT id FROM refunds WHERE order_id = ?').get(orderId);
  if (existing) {
    return res.status(400).json({ success: false, message: '이미 신청된 주문입니다.' });
  }
  db.prepare('INSERT INTO refunds (order_id, user_id, type, reason, status) VALUES (?, ?, ?, ?, ?)')
    .run(orderId, req.user.userId, type, (reason || '').trim(), 'pending');
  res.json({ success: true, message: '신청이 접수되었습니다.' });
});

module.exports = router;
