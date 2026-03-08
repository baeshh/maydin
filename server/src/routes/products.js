const express = require('express');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => cb(null, Date.now() + '-' + Math.random().toString(36).slice(2) + (path.extname(file.originalname) || '.jpg'))
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

function parseJsonArray(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

function rowToProduct(row) {
  if (!row) return null;
  const images = parseJsonArray(row.images);
  const detailImages = parseJsonArray(row.detail_images);
  const imageUrl = row.image_url || (images && images[0]) || null;
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    price: row.price,
    originalPrice: row.original_price,
    unit: row.unit || '/ 30일',
    tag: row.tag,
    category: row.category,
    desc: row.desc_short,
    isBest: !!row.is_best,
    isNew: !!row.is_new,
    rating: row.rating,
    imageUrl,
    images,
    detailImages,
    specs: row.specs ? JSON.parse(row.specs) : null,
    benefits: row.benefits ? JSON.parse(row.benefits) : null,
    options: row.options ? JSON.parse(row.options) : null
  };
}

function maskName(name) {
  const value = String(name || '익명').trim();
  if (value.length <= 1) return value + '*';
  return value[0] + '*'.repeat(Math.max(1, value.length - 1));
}

function getRequester(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return { userId: null, adminId: null };
  try {
    const payload = jwt.verify(authHeader.slice(7), JWT_SECRET);
    return { userId: payload.userId || null, adminId: payload.adminId || null };
  } catch (_) {
    return { userId: null, adminId: null };
  }
}

function getDeliveredReviewSlots(userId, productId) {
  const product = db.prepare('SELECT id, name FROM products WHERE id = ?').get(productId);
  const productName = product && product.name ? String(product.name).trim() : '';
  const rows = db.prepare(`
    SELECT id, items, created_at
    FROM orders
    WHERE user_id = ? AND status = 'delivered'
    ORDER BY created_at DESC
  `).all(userId);
  const usedRows = db.prepare(`
    SELECT order_id, order_item_key
    FROM product_reviews
    WHERE user_id = ? AND product_id = ?
  `).all(userId, productId);
  const usedKeys = new Set(usedRows.map((row) => `${row.order_id}:${row.order_item_key}`));
  const slots = [];

  rows.forEach((order) => {
    parseJsonArray(order.items).forEach((item, index) => {
      const itemProductId = item.productId != null ? Number(item.productId) : null;
      const itemName = String(item.name || item.productName || '').trim();
      const matchesProduct = itemProductId === Number(productId) || (productName && itemName.indexOf(productName) !== -1);
      if (!matchesProduct) return;
      const orderItemKey = `item-${index}`;
      if (usedKeys.has(`${order.id}:${orderItemKey}`)) return;
      slots.push({
        orderId: order.id,
        orderItemKey,
        optionLabel: item.optionLabel || '',
        productName: item.name || '',
        qty: Number(item.qty || 1),
        orderedAt: order.created_at
      });
    });
  });

  return slots;
}

function refreshProductRating(productId) {
  const row = db.prepare(`
    SELECT ROUND(AVG(rating), 1) AS avg_rating
    FROM product_reviews
    WHERE product_id = ? AND is_deleted = 0
  `).get(productId);
  db.prepare('UPDATE products SET rating = ? WHERE id = ?').run(row && row.avg_rating != null ? row.avg_rating : null, productId);
}

function toReviewResponse(row) {
  return {
    id: row.id,
    productId: row.product_id,
    userId: row.user_id,
    userName: maskName(row.user_name),
    rating: Number(row.rating || 0),
    title: row.title || '',
    content: row.content || '',
    images: parseJsonArray(row.images),
    orderId: row.order_id,
    optionLabel: row.option_label || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function toQnaResponse(row, requester) {
  const isAdmin = !!(requester && requester.adminId);
  const isOwner = !!(requester && requester.userId && Number(requester.userId) === Number(row.user_id));
  const canViewSecret = !row.is_secret || isAdmin || isOwner;
  return {
    id: row.id,
    productId: row.product_id,
    userId: row.user_id,
    userName: maskName(row.user_name),
    subject: canViewSecret ? (row.subject || '') : '비밀글입니다.',
    content: canViewSecret ? (row.content || '') : '비밀글입니다.',
    images: canViewSecret ? parseJsonArray(row.images) : [],
    isSecret: !!row.is_secret,
    status: row.status || 'pending',
    adminAnswer: canViewSecret ? (row.admin_answer || '') : '',
    answeredAt: row.answered_at || null,
    createdAt: row.created_at,
    canViewSecret,
    isOwner
  };
}

// POST /api/products/upload-image - 회원 리뷰/Q&A 이미지 업로드
router.post('/upload-image', authMiddleware, (req, res) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      const msg = err.code === 'LIMIT_FILE_SIZE' ? '파일 크기는 5MB 이하여야 합니다.' : (err.message || '업로드 실패');
      return res.status(400).json({ success: false, message: msg });
    }
    if (!req.file) return res.status(400).json({ success: false, message: '파일이 없습니다.' });
    return res.json({ success: true, url: '/api/uploads/' + req.file.filename });
  });
});

// GET /api/products/:id/reviews - 상품 리뷰 목록
router.get('/:id/reviews', (req, res) => {
  const productId = parseInt(req.params.id, 10);
  const product = db.prepare('SELECT id FROM products WHERE id = ?').get(productId);
  if (!product) return res.status(404).json({ success: false, message: '상품을 찾을 수 없습니다.' });

  const rows = db.prepare(`
    SELECT pr.*, u.name AS user_name
    FROM product_reviews pr
    LEFT JOIN users u ON u.id = pr.user_id
    WHERE pr.product_id = ? AND pr.is_deleted = 0
    ORDER BY pr.created_at DESC
  `).all(productId);
  const summary = db.prepare(`
    SELECT COUNT(*) AS count, ROUND(AVG(rating), 1) AS avg_rating
    FROM product_reviews
    WHERE product_id = ? AND is_deleted = 0
  `).get(productId);

  res.json({
    success: true,
    reviews: rows.map(toReviewResponse),
    summary: {
      count: Number(summary && summary.count ? summary.count : 0),
      avgRating: summary && summary.avg_rating != null ? Number(summary.avg_rating) : 0
    }
  });
});

// GET /api/products/:id/review-eligibility - 리뷰 작성 가능 주문 항목
router.get('/:id/review-eligibility', authMiddleware, (req, res) => {
  const productId = parseInt(req.params.id, 10);
  const product = db.prepare('SELECT id FROM products WHERE id = ?').get(productId);
  if (!product) return res.status(404).json({ success: false, message: '상품을 찾을 수 없습니다.' });
  const slots = getDeliveredReviewSlots(req.user.userId, productId);
  res.json({ success: true, eligibleItems: slots, canWrite: slots.length > 0 });
});

// POST /api/products/:id/reviews - 리뷰 작성
router.post('/:id/reviews', authMiddleware, (req, res) => {
  const productId = parseInt(req.params.id, 10);
  const { orderId, orderItemKey, rating, title, content, images } = req.body || {};
  const product = db.prepare('SELECT id FROM products WHERE id = ?').get(productId);
  if (!product) return res.status(404).json({ success: false, message: '상품을 찾을 수 없습니다.' });
  if (!orderId || !orderItemKey) return res.status(400).json({ success: false, message: '배송완료 주문을 선택하세요.' });
  if (!content || !String(content).trim()) return res.status(400).json({ success: false, message: '리뷰 내용을 입력하세요.' });

  const numericRating = Math.max(1, Math.min(5, parseInt(rating, 10) || 5));
  const eligible = getDeliveredReviewSlots(req.user.userId, productId).find((item) => Number(item.orderId) === Number(orderId) && item.orderItemKey === String(orderItemKey));
  if (!eligible) {
    return res.status(400).json({ success: false, message: '리뷰 작성 권한이 없는 주문입니다.' });
  }

  const imageList = Array.isArray(images) ? images.slice(0, 5) : [];
  try {
    db.prepare(`
      INSERT INTO product_reviews (product_id, user_id, order_id, order_item_key, option_label, rating, title, content, images, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).run(productId, req.user.userId, Number(orderId), String(orderItemKey), eligible.optionLabel || null, numericRating, title ? String(title).trim() : null, String(content).trim(), JSON.stringify(imageList));
    refreshProductRating(productId);
    return res.json({ success: true, message: '구매평이 등록되었습니다.' });
  } catch (e) {
    if (String(e && e.message || '').includes('UNIQUE')) {
      return res.status(400).json({ success: false, message: '이미 해당 주문건에 대한 구매평을 작성했습니다.' });
    }
    console.error('[products/reviews/post]', e);
    return res.status(500).json({ success: false, message: '리뷰 저장 중 오류가 발생했습니다.' });
  }
});

// GET /api/products/:id/qna - 상품 Q&A 목록
router.get('/:id/qna', (req, res) => {
  const productId = parseInt(req.params.id, 10);
  const product = db.prepare('SELECT id FROM products WHERE id = ?').get(productId);
  if (!product) return res.status(404).json({ success: false, message: '상품을 찾을 수 없습니다.' });
  const requester = getRequester(req);
  const rows = db.prepare(`
    SELECT q.*, u.name AS user_name
    FROM product_qna q
    LEFT JOIN users u ON u.id = q.user_id
    WHERE q.product_id = ?
    ORDER BY q.created_at DESC
  `).all(productId);
  res.json({
    success: true,
    qna: rows.map((row) => toQnaResponse(row, requester)),
    count: rows.length
  });
});

// POST /api/products/:id/qna - 상품 Q&A 작성
router.post('/:id/qna', authMiddleware, (req, res) => {
  const productId = parseInt(req.params.id, 10);
  const { subject, content, images, isSecret } = req.body || {};
  const product = db.prepare('SELECT id FROM products WHERE id = ?').get(productId);
  if (!product) return res.status(404).json({ success: false, message: '상품을 찾을 수 없습니다.' });
  if (!subject || !String(subject).trim()) return res.status(400).json({ success: false, message: '제목을 입력하세요.' });
  if (!content || !String(content).trim()) return res.status(400).json({ success: false, message: '내용을 입력하세요.' });

  const imageList = Array.isArray(images) ? images.slice(0, 5) : [];
  db.prepare(`
    INSERT INTO product_qna (product_id, user_id, subject, content, images, is_secret, status, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, 'pending', CURRENT_TIMESTAMP)
  `).run(productId, req.user.userId, String(subject).trim(), String(content).trim(), JSON.stringify(imageList), isSecret ? 1 : 0);
  res.json({ success: true, message: 'Q&A가 등록되었습니다.' });
});

// GET /api/products - 목록 (filter: best, new, category)
router.get('/', (req, res) => {
  const { filter, category } = req.query;
  let rows = db.prepare('SELECT * FROM products ORDER BY id').all();

  if (filter === 'best') {
    rows = rows.filter((r) => r.is_best);
  } else if (filter === 'new') {
    rows = rows.filter((r) => r.is_new);
  } else if (category) {
    rows = rows.filter((r) => r.category === category);
  }

  const list = rows.map(rowToProduct);
  res.json({ success: true, products: list });
});

// GET /api/products/:id - 상세
router.get('/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const row = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
  if (!row) {
    return res.status(404).json({ success: false, message: '상품을 찾을 수 없습니다.' });
  }
  res.json({ success: true, product: rowToProduct(row) });
});

module.exports = router;
