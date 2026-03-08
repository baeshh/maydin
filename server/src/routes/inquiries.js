const express = require('express');
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// GET /api/inquiries - 내 1:1 문의 목록
router.get('/', authMiddleware, (req, res) => {
  const rows = db.prepare('SELECT * FROM inquiries WHERE user_id = ? ORDER BY created_at DESC').all(req.user.userId);
  const list = rows.map(r => ({
    id: r.id, subject: r.subject, content: r.content, adminReply: r.admin_reply,
    status: r.status, createdAt: r.created_at, repliedAt: r.replied_at
  }));
  res.json({ success: true, inquiries: list });
});

// POST /api/inquiries - 1:1 문의 등록
router.post('/', authMiddleware, (req, res) => {
  const { subject, content } = req.body;
  if (!subject || !content) {
    return res.status(400).json({ success: false, message: '제목과 내용을 입력하세요.' });
  }
  db.prepare('INSERT INTO inquiries (user_id, subject, content, status) VALUES (?, ?, ?, ?)')
    .run(req.user.userId, String(subject).trim(), String(content).trim(), 'pending');
  res.json({ success: true, message: '문의가 등록되었습니다.' });
});

module.exports = router;
