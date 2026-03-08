const express = require('express');
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// GET /api/coupons - 내 사용 가능 쿠폰 목록
router.get('/', authMiddleware, (req, res) => {
  const rows = db.prepare(`
    SELECT uc.id, uc.coupon_id, uc.used_at, uc.created_at,
           c.name, c.code, c.type, c.value, c.min_order, c.end_at
    FROM user_coupons uc
    JOIN coupons c ON c.id = uc.coupon_id
    WHERE uc.user_id = ? AND uc.used_at IS NULL
    ORDER BY uc.created_at DESC
  `).all(req.user.userId);
  const now = new Date().toISOString();
  const list = rows
    .filter(r => !r.end_at || r.end_at >= now)
    .map(r => ({
      id: r.id, couponId: r.coupon_id, name: r.name, code: r.code,
      type: r.type, value: r.value, minOrder: r.min_order, endAt: r.end_at,
      createdAt: r.created_at
    }));
  res.json({ success: true, coupons: list });
});

module.exports = router;
