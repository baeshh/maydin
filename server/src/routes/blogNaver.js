const express = require('express');
const https = require('https');
const http = require('http');
const { URL } = require('url');

const router = express.Router();

const RSS_URL = 'https://rss.blog.naver.com/romsplatform.xml';
const BLOG_HOME = 'https://blog.naver.com/romsplatform';
const CACHE_TTL_MS = 10 * 60 * 1000;
const MAX_POSTS = 20;
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

/** 네이버 블로그 RSS/본문 썸네일 호스트만 허용 (오픈 프록시 방지) */
const ALLOWED_THUMB_HOSTS = new Set([
  'blogthumb.pstatic.net',
  'mblogthumb-phinf.pstatic.net',
  'blogpfthumb.phinf.naver.net',
  'postfiles.pstatic.net',
  'ssl.pstatic.net',
]);

let cache = { at: 0, posts: [] };

function fetchText(urlStr) {
  return new Promise((resolve, reject) => {
    let url;
    try {
      url = new URL(urlStr);
    } catch (e) {
      return reject(e);
    }
    const lib = url.protocol === 'https:' ? https : http;
    const req = lib.get(
      urlStr,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; MAYDIN-Homepage/1.0; +https://maydin.co.kr)',
          Accept: 'application/rss+xml, application/xml, text/xml, */*',
        },
      },
      (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const next = new URL(res.headers.location, urlStr).href;
          res.resume();
          return fetchText(next).then(resolve).catch(reject);
        }
        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error('HTTP ' + res.statusCode));
        }
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      }
    );
    req.on('error', reject);
    req.setTimeout(15000, () => {
      req.destroy();
      reject(new Error('timeout'));
    });
  });
}

function extractTag(block, tag) {
  const cdata = new RegExp(
    `<${tag}[^>]*>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*</${tag}>`,
    'i'
  );
  let m = block.match(cdata);
  if (m) return m[1].trim();
  const plain = new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`, 'i');
  m = block.match(plain);
  return m ? m[1].trim() : '';
}

function firstImgSrc(html) {
  if (!html) return null;
  const m = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  return m ? m[1] : null;
}

function sanitizeThumbUrl(url) {
  if (!url || typeof url !== 'string') return null;
  let u = url.trim().replace(/&amp;/g, '&');
  if (u.startsWith('//')) u = 'https:' + u;
  if (!/^https?:\/\//i.test(u)) return null;
  try {
    const parsed = new URL(u);
    if (!ALLOWED_THUMB_HOSTS.has(parsed.hostname)) return null;
    return u;
  } catch (e) {
    return null;
  }
}

function thumbProxyQueryPath(originalUrl) {
  const u = sanitizeThumbUrl(originalUrl);
  if (!u) return null;
  return '/api/blog/naver/thumb?u=' + encodeURIComponent(u);
}

function fetchBinary(urlStr, redirectsLeft = 5) {
  return new Promise((resolve, reject) => {
    if (redirectsLeft < 0) return reject(new Error('too many redirects'));
    let url;
    try {
      url = new URL(urlStr);
    } catch (e) {
      return reject(e);
    }
    if (!ALLOWED_THUMB_HOSTS.has(url.hostname)) {
      return reject(new Error('host not allowed'));
    }
    const lib = url.protocol === 'https:' ? https : http;
    const req = lib.get(
      urlStr,
      {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
          Referer: 'https://blog.naver.com/',
        },
      },
      (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const next = new URL(res.headers.location, urlStr).href;
          res.resume();
          return fetchBinary(next, redirectsLeft - 1).then(resolve).catch(reject);
        }
        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error('HTTP ' + res.statusCode));
        }
        const chunks = [];
        let total = 0;
        res.on('data', (c) => {
          total += c.length;
          if (total > MAX_IMAGE_BYTES) {
            req.destroy();
            reject(new Error('too large'));
            return;
          }
          chunks.push(c);
        });
        res.on('end', () => {
          const buf = Buffer.concat(chunks);
          const rawType = res.headers['content-type'] || 'image/png';
          const type = rawType.split(';')[0].trim();
          resolve({ buf, type });
        });
      }
    );
    req.on('error', reject);
    req.setTimeout(20000, () => {
      req.destroy();
      reject(new Error('timeout'));
    });
  });
}

router.get('/thumb', async (req, res) => {
  const enc = req.query.u;
  if (!enc || typeof enc !== 'string') {
    return res.status(400).send('missing u');
  }
  // Express query parser already decodes the outer querystring once.
  // Decoding again breaks Naver thumbnail URLs that contain percent-encoded bytes.
  const clean = sanitizeThumbUrl(enc);
  if (!clean) {
    return res.status(403).send('forbidden');
  }
  try {
    const { buf, type } = await fetchBinary(clean);
    if (!/^image\//i.test(type)) {
      return res.status(502).send('not image');
    }
    res.setHeader('Content-Type', type);
    res.setHeader('Cache-Control', 'public, max-age=7200');
    res.send(buf);
  } catch (e) {
    console.error('[blog/naver/thumb]', e.message);
    res.status(502).end();
  }
});

function parseRss(xml) {
  const items = [];
  const re = /<item>([\s\S]*?)<\/item>/gi;
  let m;
  while ((m = re.exec(xml)) !== null) {
    const block = m[1];
    const title = extractTag(block, 'title');
    const link = extractTag(block, 'link');
    const pubDate = extractTag(block, 'pubDate');
    const description = extractTag(block, 'description');
    const category = extractTag(block, 'category');
    if (!title || !link) continue;
    const thumbRaw = firstImgSrc(description);
    const thumbnail = thumbProxyQueryPath(thumbRaw);
    items.push({
      title,
      url: link,
      pubDate: pubDate || null,
      thumbnail,
      category: category || '공식 블로그',
    });
  }
  return items.slice(0, MAX_POSTS);
}

router.get('/', async (req, res) => {
  const now = Date.now();
  if (cache.posts.length && now - cache.at < CACHE_TTL_MS) {
    return res.json({
      success: true,
      blogHome: BLOG_HOME,
      posts: cache.posts,
      cached: true,
    });
  }
  try {
    const xml = await fetchText(RSS_URL);
    const posts = parseRss(xml);
    cache = { at: now, posts };
    return res.json({
      success: true,
      blogHome: BLOG_HOME,
      posts,
      cached: false,
    });
  } catch (err) {
    console.error('[blog/naver] RSS fetch failed:', err.message);
    if (cache.posts.length) {
      return res.json({
        success: true,
        blogHome: BLOG_HOME,
        posts: cache.posts,
        stale: true,
      });
    }
    return res.status(502).json({
      success: false,
      message: '네이버 블로그 글을 불러오지 못했습니다.',
      blogHome: BLOG_HOME,
      posts: [],
    });
  }
});

module.exports = router;
