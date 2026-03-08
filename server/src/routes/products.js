const express = require('express');
const db = require('../db');

const router = express.Router();

function rowToProduct(row) {
  if (!row) return null;
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
    imageUrl: row.image_url,
    images: row.images ? (typeof row.images === 'string' ? JSON.parse(row.images) : row.images) : [],
    detailImages: row.detail_images ? (typeof row.detail_images === 'string' ? JSON.parse(row.detail_images) : row.detail_images) : [],
    specs: row.specs ? JSON.parse(row.specs) : null,
    benefits: row.benefits ? JSON.parse(row.benefits) : null,
    options: row.options ? JSON.parse(row.options) : null
  };
}

// GET /api/products - 목록 (filter: best, new, category)
router.get('/', (req, res) => {
  const { filter, category } = req.query;
  let rows = db.prepare('SELECT * FROM products ORDER BY id').all();

  if (filter === 'best') {
    rows = rows.filter(r => r.is_best);
  } else if (filter === 'new') {
    rows = rows.filter(r => r.is_new);
  } else if (category) {
    rows = rows.filter(r => r.category === category);
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
