const express = require('express');
const jwt = require('jsonwebtoken');
const db = require('../db');
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

const router = express.Router();

function getUserId(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  try {
    const payload = jwt.verify(authHeader.slice(7), JWT_SECRET);
    return payload.userId;
  } catch (e) { return null; }
}

// GET /api/cart - 내 장바구니
router.get('/', (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: '로그인이 필요합니다.' });
    }
    const rows = db.prepare('SELECT * FROM cart WHERE user_id = ? ORDER BY created_at DESC').all(userId);
    const items = rows.map(r => ({
      id: r.id,
      productId: r.product_id,
      productName: r.product_name,
      optionLabel: r.option_label,
      price: r.price,
      qty: r.qty
    }));
    return res.json({ success: true, items });
  } catch (e) {
    console.error('GET /api/cart', e);
    return res.status(500).json({ success: false, message: '서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' });
  }
});

// POST /api/cart - 장바구니 담기
router.post('/', (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: '로그인이 필요합니다.' });
    }
    const body = req.body || {};
    const productId = body.productId;
    const productName = body.productName;
    const optionLabel = body.optionLabel;
    const price = body.price;
    const qty = body.qty;
    if (productId == null || price == null) {
      return res.status(400).json({ success: false, message: '상품 정보가 필요합니다.' });
    }
    const opt = optionLabel != null ? String(optionLabel) : '';
    const existing = db.prepare('SELECT id, qty FROM cart WHERE user_id = ? AND product_id = ? AND (option_label = ? OR (option_label IS NULL AND ? = ""))')
      .get(userId, productId, opt, opt);
    if (existing) {
      db.prepare('UPDATE cart SET qty = qty + ? WHERE id = ?').run(qty || 1, existing.id);
    } else {
      db.prepare('INSERT INTO cart (user_id, product_id, product_name, option_label, price, qty) VALUES (?, ?, ?, ?, ?, ?)')
        .run(userId, productId, productName || null, opt, price, qty || 1);
    }
    const rows = db.prepare('SELECT * FROM cart WHERE user_id = ? ORDER BY created_at DESC').all(userId);
    return res.json({ success: true, items: rows.map(r => ({ id: r.id, productId: r.product_id, productName: r.product_name, optionLabel: r.option_label, price: r.price, qty: r.qty })) });
  } catch (e) {
    console.error('POST /api/cart', e);
    return res.status(500).json({ success: false, message: '서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' });
  }
});

// DELETE /api/cart/:id - 항목 삭제
router.delete('/:id', (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ success: false });
  const id = parseInt(req.params.id, 10);
  const r = db.prepare('DELETE FROM cart WHERE id = ? AND user_id = ?').run(id, userId);
  if (r.changes === 0) return res.status(404).json({ success: false });
  res.json({ success: true });
});

// PUT /api/cart/:id - 수량 변경
router.put('/:id', (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ success: false });
  const id = parseInt(req.params.id, 10);
  const { qty } = req.body;
  if (qty == null || qty < 1) return res.status(400).json({ success: false });
  const r = db.prepare('UPDATE cart SET qty = ? WHERE id = ? AND user_id = ?').run(qty, id, userId);
  if (r.changes === 0) return res.status(404).json({ success: false });
  res.json({ success: true });
});

module.exports = router;
