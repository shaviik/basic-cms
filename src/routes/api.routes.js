import { Router } from 'express';
import { db } from '../database/db.js';

const router = Router();

/**
 * 🎓 روت‌های REST API برای فریم‌ورک‌های آینده (React, Vue, Next.js):
 */

// بررسی سلامت سرور
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'سرویس بک‌اند با موفقیت در حال اجراست.',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()) + ' ثانیه',
    nodeVersion: process.version,
    database: 'SQLite (Native node:sqlite)'
  });
});

// دریافت لیست پست‌ها با فرمت JSON
router.get('/posts', (req, res, next) => {
  try {
    const posts = db.prepare(`
      SELECT p.id, p.title, p.slug, p.excerpt, p.content_html, p.status, p.created_at,
             pt.title as post_type, c.title as category, u.full_name as author_name
      FROM posts p
      LEFT JOIN post_types pt ON p.post_type_id = pt.id
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN users u ON p.author_id = u.id
      WHERE p.status = 'published'
      ORDER BY p.id DESC
    `).all();

    res.json({
      success: true,
      count: posts.length,
      data: posts
    });
  } catch (error) {
    next(error);
  }
});

// دریافت جزئیات یک پست به همراه کدهای خام HTML
router.get('/posts/:slug', (req, res, next) => {
  try {
    const post = db.prepare(`
      SELECT p.*, pt.title as post_type, c.title as category, u.full_name as author_name
      FROM posts p
      LEFT JOIN post_types pt ON p.post_type_id = pt.id
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN users u ON p.author_id = u.id
      WHERE p.slug = ?
    `).get(req.params.slug);

    if (!post) {
      return res.status(404).json({ success: false, message: 'پست یافت نشد.' });
    }

    res.json({ success: true, data: post });
  } catch (error) {
    next(error);
  }
});

// دریافت چیدمان و بلوک‌های صفحه
router.get('/layouts/:pageSlug', (req, res, next) => {
  try {
    const blocks = db.prepare(`
      SELECT * FROM page_blocks 
      WHERE page_slug = ? 
      ORDER BY sort_order ASC
    `).all(req.params.pageSlug);

    res.json({ success: true, count: blocks.length, data: blocks });
  } catch (error) {
    next(error);
  }
});

export default router;
