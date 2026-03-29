const express = require('express');
const https = require('https');
const http = require('http');
const { URL } = require('url');

const router = express.Router();

const RSS_URL = 'https://rss.blog.naver.com/romsplatform.xml';
const BLOG_HOME = 'https://blog.naver.com/romsplatform';
const CACHE_TTL_MS = 10 * 60 * 1000;
const MAX_POSTS = 20;

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
    let thumbnail = firstImgSrc(description);
    if (thumbnail && !/^https?:\/\//i.test(thumbnail)) thumbnail = null;
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
