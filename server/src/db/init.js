const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
const dbPath = path.join(dataDir, 'maydin.db');
const db = new Database(dbPath);

// 테이블 생성
db.exec(`
  -- 사용자 (약사)
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    license TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    pharmacy_name TEXT,
    biz_no TEXT,
    pharmacy_code TEXT,
    pharmacy_univ TEXT,
    tax_email TEXT,
    kakao_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- 상품
  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    price INTEGER NOT NULL,
    original_price INTEGER,
    unit TEXT DEFAULT '/ 30일',
    tag TEXT,
    category TEXT,
    desc_short TEXT,
    is_best INTEGER DEFAULT 0,
    is_new INTEGER DEFAULT 0,
    rating REAL,
    image_url TEXT,
    specs TEXT,
    benefits TEXT,
    options TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- 주문
  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    user_license TEXT,
    user_email TEXT,
    items TEXT NOT NULL,
    total INTEGER NOT NULL,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  -- 관리자 (어드민 전용)
  CREATE TABLE IF NOT EXISTS admin_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    name TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- 블로그/소식 게시글
  CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    content TEXT,
    type TEXT DEFAULT 'news',
    is_published INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_posts_type ON posts(type);
  CREATE INDEX IF NOT EXISTS idx_posts_published ON posts(is_published);

  -- 장바구니 (회원별)
  CREATE TABLE IF NOT EXISTS cart (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    product_name TEXT,
    option_label TEXT,
    price INTEGER NOT NULL,
    qty INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    UNIQUE(user_id, product_id, option_label)
  );
  CREATE INDEX IF NOT EXISTS idx_cart_user ON cart(user_id);

  -- 제휴 약국
  CREATE TABLE IF NOT EXISTS pharmacies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    address TEXT,
    lat REAL,
    lng REAL,
    phone TEXT,
    hours TEXT
  );

  -- 취소/교환/반품
  CREATE TABLE IF NOT EXISTS refunds (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    reason TEXT,
    status TEXT DEFAULT 'pending',
    admin_comment TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
  -- 쿠폰
  CREATE TABLE IF NOT EXISTS coupons (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    code TEXT,
    type TEXT DEFAULT 'fixed',
    value INTEGER NOT NULL,
    min_order INTEGER DEFAULT 0,
    start_at DATETIME,
    end_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  -- 회원별 쿠폰 지급
  CREATE TABLE IF NOT EXISTS user_coupons (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    coupon_id INTEGER NOT NULL,
    used_at DATETIME,
    order_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (coupon_id) REFERENCES coupons(id)
  );
  -- 1:1 문의
  CREATE TABLE IF NOT EXISTS inquiries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    subject TEXT NOT NULL,
    content TEXT NOT NULL,
    admin_reply TEXT,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    replied_at DATETIME,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
  -- 배송지 (회원별 여러 개)
  CREATE TABLE IF NOT EXISTS delivery_addresses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    label TEXT,
    recipient TEXT NOT NULL,
    phone TEXT NOT NULL,
    address TEXT NOT NULL,
    is_default INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  -- 상품 구매평
  CREATE TABLE IF NOT EXISTS product_reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    order_id INTEGER NOT NULL,
    order_item_key TEXT NOT NULL,
    option_label TEXT,
    rating INTEGER NOT NULL DEFAULT 5,
    title TEXT,
    content TEXT NOT NULL,
    images TEXT,
    is_deleted INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (order_id) REFERENCES orders(id),
    UNIQUE(order_id, order_item_key)
  );

  -- 상품 Q&A
  CREATE TABLE IF NOT EXISTS product_qna (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    subject TEXT NOT NULL,
    content TEXT NOT NULL,
    images TEXT,
    is_secret INTEGER DEFAULT 0,
    status TEXT DEFAULT 'pending',
    admin_answer TEXT,
    answered_at DATETIME,
    answered_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (answered_by) REFERENCES admin_users(id)
  );

  CREATE INDEX IF NOT EXISTS idx_users_license ON users(license);
  CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
  CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
  CREATE INDEX IF NOT EXISTS idx_refunds_user ON refunds(user_id);
  CREATE INDEX IF NOT EXISTS idx_inquiries_user ON inquiries(user_id);
  CREATE INDEX IF NOT EXISTS idx_delivery_addresses_user ON delivery_addresses(user_id);
  CREATE INDEX IF NOT EXISTS idx_product_reviews_product ON product_reviews(product_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_product_reviews_user ON product_reviews(user_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_product_qna_product ON product_qna(product_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_product_qna_user ON product_qna(user_id, created_at DESC);
`);

// 기존 DB에 컬럼 추가 (이미 있으면 무시)
const userCols = db.prepare('PRAGMA table_info(users)').all().map(c => c.name);
const ordersCols = db.prepare('PRAGMA table_info(orders)').all().map(c => c.name);
const cartCols = db.prepare('PRAGMA table_info(cart)').all().map(c => c.name);
const productCols = db.prepare('PRAGMA table_info(products)').all().map(c => c.name);
const reviewCols = db.prepare('PRAGMA table_info(product_reviews)').all().map(c => c.name);
const qnaCols = db.prepare('PRAGMA table_info(product_qna)').all().map(c => c.name);
if (!productCols.includes('margin_percent')) db.exec('ALTER TABLE products ADD COLUMN margin_percent REAL');
if (!productCols.includes('images')) db.exec('ALTER TABLE products ADD COLUMN images TEXT');
if (!productCols.includes('detail_images')) db.exec('ALTER TABLE products ADD COLUMN detail_images TEXT');
if (!userCols.includes('address')) db.exec('ALTER TABLE users ADD COLUMN address TEXT');
if (!userCols.includes('status')) db.exec('ALTER TABLE users ADD COLUMN status TEXT DEFAULT \'pending\'');
if (!userCols.includes('open_date')) db.exec('ALTER TABLE users ADD COLUMN open_date TEXT');
if (!userCols.includes('approved_at')) db.exec('ALTER TABLE users ADD COLUMN approved_at DATETIME');
if (!userCols.includes('approved_by')) db.exec('ALTER TABLE users ADD COLUMN approved_by INTEGER');
if (!userCols.includes('points_balance')) db.exec('ALTER TABLE users ADD COLUMN points_balance INTEGER DEFAULT 0');
if (!userCols.includes('member_no')) db.exec('ALTER TABLE users ADD COLUMN member_no TEXT');
if (!ordersCols.includes('delivery_address')) db.exec('ALTER TABLE orders ADD COLUMN delivery_address TEXT');
if (!ordersCols.includes('payment_method')) db.exec("ALTER TABLE orders ADD COLUMN payment_method TEXT DEFAULT 'bank_transfer'");
if (!ordersCols.includes('tracking_company')) db.exec('ALTER TABLE orders ADD COLUMN tracking_company TEXT');
if (!ordersCols.includes('tracking_number')) db.exec('ALTER TABLE orders ADD COLUMN tracking_number TEXT');
if (!ordersCols.includes('paid_at')) db.exec('ALTER TABLE orders ADD COLUMN paid_at DATETIME');
if (!cartCols.includes('product_id')) db.exec('ALTER TABLE cart ADD COLUMN product_id INTEGER');
if (!cartCols.includes('product_name')) db.exec('ALTER TABLE cart ADD COLUMN product_name TEXT');
if (!cartCols.includes('option_label')) db.exec('ALTER TABLE cart ADD COLUMN option_label TEXT');
if (!cartCols.includes('price')) db.exec('ALTER TABLE cart ADD COLUMN price INTEGER');
if (!cartCols.includes('qty')) db.exec('ALTER TABLE cart ADD COLUMN qty INTEGER DEFAULT 1');
if (!cartCols.includes('created_at')) db.exec('ALTER TABLE cart ADD COLUMN created_at DATETIME');
if (!cartCols.includes('image_url')) db.exec('ALTER TABLE cart ADD COLUMN image_url TEXT');
if (reviewCols.length && !reviewCols.includes('option_label')) db.exec('ALTER TABLE product_reviews ADD COLUMN option_label TEXT');
if (reviewCols.length && !reviewCols.includes('title')) db.exec('ALTER TABLE product_reviews ADD COLUMN title TEXT');
if (reviewCols.length && !reviewCols.includes('images')) db.exec('ALTER TABLE product_reviews ADD COLUMN images TEXT');
if (reviewCols.length && !reviewCols.includes('is_deleted')) db.exec('ALTER TABLE product_reviews ADD COLUMN is_deleted INTEGER DEFAULT 0');
if (reviewCols.length && !reviewCols.includes('updated_at')) db.exec('ALTER TABLE product_reviews ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP');
if (qnaCols.length && !qnaCols.includes('images')) db.exec('ALTER TABLE product_qna ADD COLUMN images TEXT');
if (qnaCols.length && !qnaCols.includes('is_secret')) db.exec('ALTER TABLE product_qna ADD COLUMN is_secret INTEGER DEFAULT 0');
if (qnaCols.length && !qnaCols.includes('status')) db.exec("ALTER TABLE product_qna ADD COLUMN status TEXT DEFAULT 'pending'");
if (qnaCols.length && !qnaCols.includes('admin_answer')) db.exec('ALTER TABLE product_qna ADD COLUMN admin_answer TEXT');
if (qnaCols.length && !qnaCols.includes('answered_at')) db.exec('ALTER TABLE product_qna ADD COLUMN answered_at DATETIME');
if (qnaCols.length && !qnaCols.includes('answered_by')) db.exec('ALTER TABLE product_qna ADD COLUMN answered_by INTEGER');
if (qnaCols.length && !qnaCols.includes('updated_at')) db.exec('ALTER TABLE product_qna ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP');
try { db.exec('CREATE INDEX IF NOT EXISTS idx_users_status ON users(status)'); } catch (_) {}
try { db.exec('CREATE INDEX IF NOT EXISTS idx_cart_user ON cart(user_id)'); } catch (_) {}
try { db.exec('CREATE INDEX IF NOT EXISTS idx_product_reviews_product ON product_reviews(product_id, created_at DESC)'); } catch (_) {}
try { db.exec('CREATE INDEX IF NOT EXISTS idx_product_reviews_user ON product_reviews(user_id, created_at DESC)'); } catch (_) {}
try { db.exec('CREATE INDEX IF NOT EXISTS idx_product_qna_product ON product_qna(product_id, created_at DESC)'); } catch (_) {}
try { db.exec('CREATE INDEX IF NOT EXISTS idx_product_qna_user ON product_qna(user_id, created_at DESC)'); } catch (_) {}

// 시드 데이터
const productCount = db.prepare('SELECT COUNT(*) as cnt FROM products').get();
if (productCount.cnt === 0) {
  const insertProduct = db.prepare(`
    INSERT INTO products (name, description, price, original_price, unit, tag, category, desc_short, is_best, is_new, rating, options) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const products = [
    ['센시비 (SENSIBI)', '민감한 현대인을 위한 자연 유래 성분 영양제', 89000, 99000, '/ 30일', '면역 밸런스', '면역', '민감한 현대인을 위한', 1, 0, 4.9, JSON.stringify([{ label: '1개월분 (1박스)', value: 1, price: 89000 }, { label: '3개월분 (3박스) - 5% 추가할인', value: 3, price: 253650 }, { label: '6개월분 (6박스) - 10% 추가할인', value: 6, price: 480600 }])],
    ['프리미엄 프로바이오틱스', '고농도 유산균', 129000, 149000, '/ 30일', '장 건강', '장', '고농도 유산균', 0, 1, 4.8, JSON.stringify([{ label: '1개월분 (1박스)', value: 1, price: 129000 }, { label: '3개월분 (3박스)', value: 3, price: 387000 }])],
    ['오메가-3 프리미엄', '고농도 오메가-3', 149000, 169000, '/ 30일', '순수 어유', '오메가3', '고농도 오메가-3', 0, 0, 4.9, JSON.stringify([{ label: '1개월분 (1박스)', value: 1, price: 149000 }, { label: '3개월분 (3박스) - 5% 할인', value: 3, price: 424650 }])],
    ['비타민 D3+K2', '뼈 건강', 69000, 79000, '/ 30일', '칼슘 흡수', '비타민', '뼈 건강', 0, 0, 4.7, JSON.stringify([{ label: '1개월분 (1박스)', value: 1, price: 69000 }])],
    ['rTG 오메가-3 600mg', '단일 복용', 6900, 9900, '/ 30일', '단일 복용 1위', '오메가3', '', 1, 1, 4.9, JSON.stringify([{ label: '1개월분', value: 1, price: 6900 }, { label: '3개월분 - 5% 할인', value: 3, price: 19665 }, { label: '6개월분 - 10% 할인', value: 6, price: 37260 }])]
  ];

  for (const p of products) {
    insertProduct.run(...p);
  }
}

const pharmacyCount = db.prepare('SELECT COUNT(*) as cnt FROM pharmacies').get();
if (pharmacyCount.cnt === 0) {
  const insertPharmacy = db.prepare(`
    INSERT INTO pharmacies (name, address, lat, lng, phone, hours) VALUES (?, ?, ?, ?, ?, ?)
  `);
  const pharmacies = [
    ['건강약국', '서울특별시 강남구 테헤란로 123', 37.5665, 127.0780, '02-1234-5678', '09:00 - 21:00'],
    ['메이딘 약국', '서울특별시 서초구 서초대로 456', 37.4837, 127.0324, '02-2345-6789', '09:00 - 20:00'],
    ['프리미엄 약국', '서울특별시 송파구 올림픽로 789', 37.5145, 127.1050, '02-3456-7890', '08:30 - 21:30'],
    ['자연약국', '경기도 성남시 분당구 정자동 101', 37.3595, 127.1086, '031-1234-5678', '09:00 - 20:00'],
    ['센시비 약국', '인천광역시 연수구 송도동 202', 37.3886, 126.6588, '032-1234-5678', '09:00 - 21:00']
  ];
  for (const p of pharmacies) {
    insertPharmacy.run(...p);
  }
}

const bcrypt = require('bcryptjs');
const adminCount = db.prepare('SELECT COUNT(*) as cnt FROM admin_users').get();
if (adminCount.cnt === 0) {
  const hash = bcrypt.hashSync('admin123', 10);
  db.prepare('INSERT INTO admin_users (email, password, name) VALUES (?, ?, ?)').run('admin@maydin.kr', hash, '관리자');
}

// 테스트 약사 계정 (로그인: 면허번호 TEST001 / 비밀번호 test1234)
const testUser = db.prepare('SELECT id FROM users WHERE license = ?').get('TEST001');
if (!testUser) {
  const hash = bcrypt.hashSync('test1234', 10);
  db.prepare(`
    INSERT INTO users (license, password, name, email, phone, pharmacy_name, biz_no, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'approved')
  `).run('TEST001', hash, '테스트 약사', 'test@maydin.kr', '010-0000-0000', '메이딘 테스트약국', '123-45-67890');
  console.log('테스트 약사 계정 생성: 면허번호 TEST001 / 비밀번호 test1234');
}

const postCount = db.prepare('SELECT COUNT(*) as cnt FROM posts').get();
if (postCount.cnt === 0) {
  db.prepare('INSERT INTO posts (title, content, type) VALUES (?, ?, ?)').run('메이딘 홈페이지 오픈', '프리미엄 건강기능식품 브랜드 메이딘의 공식 홈페이지가 오픈되었습니다.', 'news');
}

db.close();
console.log('DB 초기화 완료:', dbPath);
