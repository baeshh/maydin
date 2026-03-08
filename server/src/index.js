require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const authRouter = require('./routes/auth');
const productsRouter = require('./routes/products');
const ordersRouter = require('./routes/orders');
const pharmaciesRouter = require('./routes/pharmacies');
const adminRouter = require('./routes/admin');
const cartRouter = require('./routes/cart');
const refundsRouter = require('./routes/refunds');
const couponsRouter = require('./routes/coupons');
const inquiriesRouter = require('./routes/inquiries');
const addressesRouter = require('./routes/addresses');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3001;

// CORS: AWS(EC2)에서는 프론트/API 같은 origin. 로컬 개발 시에만 cross-origin
app.use(cors({ origin: true }));
app.use(express.json());

app.use('/api/auth', authRouter);
app.use('/api/products', productsRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/pharmacies', pharmaciesRouter);
app.use('/api/admin', adminRouter);
app.use('/api/cart', cartRouter);
app.use('/api/refunds', refundsRouter);
app.use('/api/coupons', couponsRouter);
app.use('/api/inquiries', inquiriesRouter);
app.use('/api/addresses', addressesRouter);
app.use('/uploads', express.static(uploadsDir));

app.get('/api/posts', (req, res) => {
  const rows = db.prepare('SELECT id, title, content, type, created_at FROM posts WHERE is_published = 1 ORDER BY created_at DESC').all();
  res.json({ success: true, posts: rows });
});

app.get('/api/health', (req, res) => {
  res.json({ ok: true, message: 'MAYDIN API' });
});

// 에러 시에도 HTML 대신 JSON 반환 (프론트에서 "연결 실패"로 오해 방지)
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ success: false, message: '서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' });
});

app.listen(PORT, () => {
  console.log(`MAYDIN API running at http://localhost:${PORT}`);
});
