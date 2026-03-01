const jwt = require('jsonwebtoken');
const db = require('../db');
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

function adminAuthMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: '관리자 인증이 필요합니다.' });
  }
  try {
    const token = authHeader.slice(7);
    const payload = jwt.verify(token, JWT_SECRET);
    if (payload.role !== 'admin') {
      return res.status(403).json({ success: false, message: '관리자만 접근할 수 있습니다.' });
    }
    const admin = db.prepare('SELECT * FROM admin_users WHERE id = ?').get(payload.adminId);
    if (!admin) {
      return res.status(401).json({ success: false, message: '유효하지 않은 관리자입니다.' });
    }
    req.admin = admin;
    next();
  } catch (e) {
    return res.status(401).json({ success: false, message: '유효하지 않은 토큰입니다.' });
  }
}

module.exports = { adminAuthMiddleware };
