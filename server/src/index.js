require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const authRouter = require('./routes/auth');
const productsRouter = require('./routes/products');
const ordersRouter = require('./routes/orders');
const pharmaciesRouter = require('./routes/pharmacies');
const adminRouter = require('./routes/admin');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: true }));
app.use(express.json());

app.use('/api/auth', authRouter);
app.use('/api/products', productsRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/pharmacies', pharmaciesRouter);
app.use('/api/admin', adminRouter);

app.get('/api/posts', (req, res) => {
  const rows = db.prepare('SELECT id, title, content, type, created_at FROM posts WHERE is_published = 1 ORDER BY created_at DESC').all();
  res.json({ success: true, posts: rows });
});

app.get('/api/health', (req, res) => {
  res.json({ ok: true, message: 'MAYDIN API' });
});

app.listen(PORT, () => {
  console.log(`MAYDIN API running at http://localhost:${PORT}`);
});
