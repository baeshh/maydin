const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

function userToResponse(row) {
  if (!row) return null;
  const { password, ...rest } = row;
  return {
    id: rest.id,
    license: rest.license,
    name: rest.name,
    email: rest.email,
    phone: rest.phone,
    pharmacyName: rest.pharmacy_name,
    bizNo: rest.biz_no,
    pharmacyCode: rest.pharmacy_code,
    pharmacyUniv: rest.pharmacy_univ,
    taxEmail: rest.tax_email
  };
}

// POST /api/auth/login
router.post('/login', (req, res) => {
  try {
    const license = (req.body && req.body.license) ? String(req.body.license).trim() : '';
    const password = (req.body && req.body.password) ? String(req.body.password) : '';
    if (!license || !password) {
      return res.status(400).json({ success: false, message: '면허번호와 비밀번호를 입력하세요.' });
    }

    const user = db.prepare('SELECT * FROM users WHERE license = ?').get(license);
    if (!user) {
      return res.status(401).json({ success: false, message: '존재하지 않는 면허번호입니다.' });
    }

    const ok = bcrypt.compareSync(password, user.password);
    if (!ok) {
      return res.status(401).json({ success: false, message: '비밀번호가 일치하지 않습니다.' });
    }

    const token = jwt.sign({ userId: user.id, license: user.license }, JWT_SECRET, { expiresIn: '7d' });
    return res.json({
      success: true,
      user: userToResponse(user),
      token
    });
  } catch (e) {
    console.error('[auth/login]', e);
    return res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
});

// POST /api/auth/validate-business — 국세청 사업자등록 진위확인 (OD Cloud)
router.post('/validate-business', async (req, res) => {
  const serviceKey = process.env.ODCLOUD_SERVICE_KEY;
  if (!serviceKey) {
    return res.status(503).json({ success: false, message: '사업자 정보 조회 서비스가 설정되지 않았습니다.' });
  }

  const body = req.body || {};
  const bNo = String(body.b_no || body.bizNo || '').replace(/\D/g, '');
  const startDt = String(body.start_dt || body.openDate || '').replace(/\D/g, '').slice(0, 8);
  const pNm = (body.p_nm || body.representativeName || '').trim();
  const bNm = (body.b_nm || body.businessName || '').trim() || undefined;

  if (bNo.length !== 10) {
    return res.status(400).json({ success: false, message: '사업자등록번호 10자리를 입력하세요.' });
  }
  if (startDt.length !== 8) {
    return res.status(400).json({ success: false, message: '개업일자를 YYYYMMDD 형식으로 입력하세요.' });
  }
  if (!pNm) {
    return res.status(400).json({ success: false, message: '대표자성명을 입력하세요.' });
  }

  try {
    const businesses = [{ b_no: bNo, start_dt: startDt, p_nm: pNm }];
    if (bNm) businesses[0].b_nm = bNm;

    const url = `https://api.odcloud.kr/api/nts-businessman/v1/validate?serviceKey=${encodeURIComponent(serviceKey)}&returnType=JSON`;
    const apiRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ businesses })
    });
    const data = await apiRes.json();

    if (data.status_code && data.status_code !== 'OK') {
      return res.json({
        success: false,
        valid: false,
        message: data.status_code === 'REQUEST_DATA_MALFORMED' ? '필수 정보가 올바르지 않습니다.' : (data.message || '조회에 실패했습니다.')
      });
    }

    const item = (data.data && data.data[0]) || {};
    const valid = item.valid === '01';
    return res.json({
      success: true,
      valid,
      message: valid ? '사업자 정보가 확인되었습니다.' : (item.valid_msg || '확인할 수 없습니다. 사업자번호·개업일자·대표자성명을 확인해 주세요.'),
      status: item.status || null
    });
  } catch (e) {
    console.error('[auth/validate-business]', e);
    return res.status(500).json({ success: false, message: '사업자 정보 조회 중 오류가 발생했습니다.' });
  }
});

// POST /api/auth/register
router.post('/register', (req, res) => {
  try {
    const body = req.body || {};
    const license = body.license ? String(body.license).trim() : '';
    const password = body.password ? String(body.password) : '';
    const name = body.name ? String(body.name).trim() : '';
    const email = body.email ? String(body.email).trim() : null;
    const phone = body.phone ? String(body.phone).trim() : null;
    const pharmacyName = body.pharmacyName ? String(body.pharmacyName).trim() : null;
    const bizNo = body.bizNo ? String(body.bizNo).trim() : null;
    const pharmacyCode = body.pharmacyCode ? String(body.pharmacyCode).trim() : null;
    const pharmacyUniv = body.pharmacyUniv ? String(body.pharmacyUniv).trim() : null;
    const taxEmail = body.taxEmail ? String(body.taxEmail).trim() : null;

    if (!license || !password || !name) {
      return res.status(400).json({ success: false, message: '면허번호, 비밀번호, 성명은 필수입니다.' });
    }

    const existing = db.prepare('SELECT id FROM users WHERE license = ?').get(license);
    if (existing) {
      return res.status(400).json({ success: false, message: '이미 가입된 면허번호입니다.' });
    }

    const hash = bcrypt.hashSync(password, 10);
    const stmt = db.prepare(`
      INSERT INTO users (license, password, name, email, phone, pharmacy_name, biz_no, pharmacy_code, pharmacy_univ, tax_email)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(license, hash, name, email, phone, pharmacyName, bizNo, pharmacyCode, pharmacyUniv, taxEmail);

    const user = db.prepare('SELECT * FROM users WHERE license = ?').get(license);
    const token = jwt.sign({ userId: user.id, license: user.license }, JWT_SECRET, { expiresIn: '7d' });
    return res.json({ success: true, user: userToResponse(user), token });
  } catch (e) {
    console.error('[auth/register]', e);
    return res.status(500).json({ success: false, message: e.message || '회원가입 처리 중 오류가 발생했습니다.' });
  }
});

// POST /api/auth/kakao - 카카오 인가코드로 로그인/회원가입
router.post('/kakao', async (req, res) => {
  const { code } = req.body;
  if (!code) {
    return res.status(400).json({ success: false, message: 'code가 필요합니다.' });
  }

  const clientId = process.env.KAKAO_CLIENT_ID;
  const clientSecret = process.env.KAKAO_CLIENT_SECRET;
  const redirectUri = process.env.KAKAO_REDIRECT_URI || 'http://localhost:3001/api/auth/kakao/callback';

  if (!clientId) {
    return res.status(500).json({ success: false, message: '카카오 설정이 되지 않았습니다.' });
  }

  try {
    const tokenRes = await fetch('https://kauth.kakao.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: clientId,
        redirect_uri: redirectUri,
        code
      }).toString()
    });
    const tokenData = await tokenRes.json();
    if (tokenData.error) {
      return res.status(400).json({ success: false, message: tokenData.error_description || '카카오 토큰 실패' });
    }

    const meRes = await fetch('https://kapi.kakao.com/v2/user/me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });
    const meData = await meRes.json();
    const kakaoId = String(meData.id);
    const nickname = meData.kakao_account?.profile?.nickname || '약사';
    const email = meData.kakao_account?.email || null;

    let user = db.prepare('SELECT * FROM users WHERE kakao_id = ?').get(kakaoId);
    if (!user) {
      const license = `K${kakaoId.slice(-8)}`;
      const hash = bcrypt.hashSync(kakaoId + JWT_SECRET, 10);
      db.prepare('INSERT INTO users (license, password, name, email, kakao_id) VALUES (?, ?, ?, ?, ?)').run(license, hash, nickname, email, kakaoId);
      user = db.prepare('SELECT * FROM users WHERE kakao_id = ?').get(kakaoId);
    }

    const token = jwt.sign({ userId: user.id, license: user.license }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ success: true, user: userToResponse(user), token });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// GET /api/auth/me - 토큰 검증 및 사용자 정보
router.get('/me', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false });
  }
  try {
    const token = authHeader.slice(7);
    const payload = jwt.verify(token, JWT_SECRET);
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.userId);
    if (!user) return res.status(404).json({ success: false });
    res.json({ success: true, user: userToResponse(user) });
  } catch (e) {
    res.status(401).json({ success: false });
  }
});

module.exports = router;
