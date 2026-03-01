const express = require('express');
const db = require('../db');

const router = express.Router();

// GET /api/pharmacies
router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM pharmacies ORDER BY id').all();
  const list = rows.map(r => ({
    id: r.id,
    name: r.name,
    address: r.address,
    lat: r.lat,
    lng: r.lng,
    phone: r.phone,
    hours: r.hours
  }));
  res.json({ success: true, pharmacies: list });
});

module.exports = router;
