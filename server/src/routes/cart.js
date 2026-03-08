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

function toCartItem(row) {
  return {
    id: row.id,
    productId: row.product_id,
    productName: row.product_name || '',
    optionLabel: row.option_label || '',
    price: Number(row.price || 0),
    qty: Number(row.qty || 1) > 0 ? Number(row.qty || 1) : 1
  };
}

function loadCartItems(userId) {
  const rows = db.prepare(`
    SELECT id, product_id, product_name, option_label, price, qty
    FROM cart
    WHERE user_id = ?
    ORDER BY id DESC
  `).all(userId);
  return rows.map(toCartItem);
}

function normalizeInt(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.trunc(parsed);
}

function cartError(res, action, error) {
  console.error(`[cart:${action}]`, error);
  return res.status(500).json({ success: false, message: '서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' });
}

// GET /api/cart - 내 장바구니
router.get('/', (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: '로그인이 필요합니다.' });
    }
    return res.json({ success: true, items: loadCartItems(userId) });
  } catch (e) {
    return cartError(res, 'get', e);
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
    const productId = normalizeInt(body.productId, null);
    const productName = body.productName ? String(body.productName).trim() : '';
    const optionLabel = body.optionLabel != null ? String(body.optionLabel).trim() : '';
    const price = normalizeInt(body.price, null);
    const qty = Math.max(1, normalizeInt(body.qty, 1));

    if (productId == null || price == null || price < 0) {
      return res.status(400).json({ success: false, message: '상품 정보가 필요합니다.' });
    }

    const existing = db.prepare(`
      SELECT id, qty
      FROM cart
      WHERE user_id = ? AND product_id = ? AND COALESCE(option_label, '') = ?
      LIMIT 1
    `).get(userId, productId, optionLabel);

    if (existing) {
      db.prepare(`
        UPDATE cart
        SET product_name = ?, price = ?, qty = ?, option_label = ?
        WHERE id = ?
      `).run(productName || null, price, Number(existing.qty || 0) + qty, optionLabel || null, existing.id);
    } else {
      db.prepare(`
        INSERT INTO cart (user_id, product_id, product_name, option_label, price, qty)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(userId, productId, productName || null, optionLabel || null, price, qty);
    }

    return res.json({ success: true, items: loadCartItems(userId) });
  } catch (e) {
    return cartError(res, 'post', e);
  }
});

// DELETE /api/cart/:id - 항목 삭제
router.delete('/:id', (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ success: false, message: '로그인이 필요합니다.' });
    const id = normalizeInt(req.params.id, null);
    if (id == null || id < 1) return res.status(400).json({ success: false, message: '잘못된 장바구니 항목입니다.' });
    const r = db.prepare('DELETE FROM cart WHERE id = ? AND user_id = ?').run(id, userId);
    if (r.changes === 0) return res.status(404).json({ success: false, message: '장바구니 항목을 찾을 수 없습니다.' });
    return res.json({ success: true, items: loadCartItems(userId) });
  } catch (e) {
    return cartError(res, 'delete', e);
  }
});

// PUT /api/cart/:id - 수량 변경
router.put('/:id', (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ success: false, message: '로그인이 필요합니다.' });
    const id = normalizeInt(req.params.id, null);
    const qty = normalizeInt(req.body && req.body.qty, null);
    if (id == null || id < 1 || qty == null || qty < 1) {
      return res.status(400).json({ success: false, message: '수량은 1 이상이어야 합니다.' });
    }
    const r = db.prepare('UPDATE cart SET qty = ? WHERE id = ? AND user_id = ?').run(qty, id, userId);
    if (r.changes === 0) return res.status(404).json({ success: false, message: '장바구니 항목을 찾을 수 없습니다.' });
    return res.json({ success: true, items: loadCartItems(userId) });
  } catch (e) {
    return cartError(res, 'put', e);
  }
});

module.exports = router;
