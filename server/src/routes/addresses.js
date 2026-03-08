const express = require('express');
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// GET /api/addresses - 내 배송지 목록
router.get('/', authMiddleware, (req, res) => {
  const rows = db.prepare('SELECT * FROM delivery_addresses WHERE user_id = ? ORDER BY is_default DESC, id').all(req.user.userId);
  const list = rows.map(r => ({
    id: r.id, label: r.label, recipient: r.recipient, phone: r.phone,
    address: r.address, isDefault: !!r.is_default, createdAt: r.created_at
  }));
  res.json({ success: true, addresses: list });
});

// POST /api/addresses - 배송지 추가
router.post('/', authMiddleware, (req, res) => {
  const { label, recipient, phone, address, isDefault } = req.body;
  if (!recipient || !phone || !address) {
    return res.status(400).json({ success: false, message: '수령인, 연락처, 주소를 입력하세요.' });
  }
  if (isDefault) {
    db.prepare('UPDATE delivery_addresses SET is_default = 0 WHERE user_id = ?').run(req.user.userId);
  }
  db.prepare('INSERT INTO delivery_addresses (user_id, label, recipient, phone, address, is_default) VALUES (?, ?, ?, ?, ?, ?)')
    .run(req.user.userId, (label || '').trim(), String(recipient).trim(), String(phone).trim(), String(address).trim(), isDefault ? 1 : 0);
  res.json({ success: true, message: '배송지가 추가되었습니다.' });
});

// PATCH /api/addresses/:id - 배송지 수정
router.patch('/:id', authMiddleware, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const row = db.prepare('SELECT id FROM delivery_addresses WHERE id = ? AND user_id = ?').get(id, req.user.userId);
  if (!row) return res.status(404).json({ success: false, message: '배송지를 찾을 수 없습니다.' });

  const { label, recipient, phone, address, isDefault } = req.body;
  if (isDefault) {
    db.prepare('UPDATE delivery_addresses SET is_default = 0 WHERE user_id = ?').run(req.user.userId);
  }
  const updates = [];
  const values = [];
  if (label !== undefined) { updates.push('label = ?'); values.push(String(label).trim()); }
  if (recipient !== undefined) { updates.push('recipient = ?'); values.push(String(recipient).trim()); }
  if (phone !== undefined) { updates.push('phone = ?'); values.push(String(phone).trim()); }
  if (address !== undefined) { updates.push('address = ?'); values.push(String(address).trim()); }
  if (isDefault !== undefined) { updates.push('is_default = ?'); values.push(isDefault ? 1 : 0); }
  if (updates.length) {
    values.push(id);
    db.prepare('UPDATE delivery_addresses SET ' + updates.join(', ') + ' WHERE id = ?').run(...values);
  }
  res.json({ success: true });
});

// DELETE /api/addresses/:id - 배송지 삭제
router.delete('/:id', authMiddleware, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const r = db.prepare('DELETE FROM delivery_addresses WHERE id = ? AND user_id = ?').run(id, req.user.userId);
  if (r.changes === 0) return res.status(404).json({ success: false, message: '배송지를 찾을 수 없습니다.' });
  res.json({ success: true });
});

module.exports = router;
