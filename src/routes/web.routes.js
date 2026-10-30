import { Router } from 'express';
import { db } from '../database/db.js';

const router = Router();

/**
 * 🎓 روت‌های وب عمومی سایت:
 * تمام داده‌ها مستقیماً از جداول رابطه‌ای دیتابیس SQLite خوانده شده و با موتور EJS رندر می‌شوند.
 */

// ۱. صفحه اصلی سایت بر پایه چیدمان داینامیک بلوک‌ها (Drag & Drop Blocks)
router.get('/', (req, res, next) => {
  try {
    // خواندن بلوک‌های صفحه اصلی به ترتیبی که در پنل ادمین با Drag & Drop مرتب شده‌اند
    const blocks = db.prepare(`
      SELECT * FROM page_blocks 
      WHERE page_slug = 'home' 
      ORDER BY sort_order ASC
    `).all();

    // واکشی آخرین پست‌های منتشر شده برای بلوک شبکه مطالب
    const latestPosts = db.prepare(`
      SELECT p.*, pt.title as post_type, c.title as category, u.full_name as author_name
      FROM posts p
      LEFT JOIN post_types pt ON p.post_type_id = pt.id
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN users u ON p.author_id = u.id
      WHERE p.status = 'published'
      ORDER BY p.id DESC
      LIMIT 6
    `).all();

    res.render('pages/home', {
      title: 'صفحه اصلی - سیستم مدیریت محتوای مدرن',
      blocks,
      latestPosts
    });
  } catch (error) {
    next(error);
  }
});

// ۲. صفحه آرشیو و لیست تمامی مقالات و پست‌ها
router.get('/posts', (req, res, next) => {
  try {
    const posts = db.prepare(`
      SELECT p.*, pt.title as post_type, c.title as category, u.full_name as author_name
      FROM posts p
      LEFT JOIN post_types pt ON p.post_type_id = pt.id
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN users u ON p.author_id = u.id
      WHERE p.status = 'published'
      ORDER BY p.id DESC
    `).all();

    const categories = db.prepare('SELECT * FROM categories').all();
    const postTypes = db.prepare('SELECT * FROM post_types').all();

    res.render('pages/posts', {
      title: 'آرشیو مقالات و مطالب وب‌سایت',
      posts,
      categories,
      postTypes
    });
  } catch (error) {
    next(error);
  }
});

// ۳. مشاهده یک پست منفرد و اجرای کدهای خام HTML آن
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
      return res.status(404).render('pages/error', {
        title: 'مطلب یافت نشد (404)',
        statusCode: 404,
        message: 'مطلبی با این آدرس پیدا نشد.'
      });
    }

    res.render('pages/post-single', {
      title: post.title,
      post
    });
  } catch (error) {
    next(error);
  }
});

// ۴. صفحه درباره ما
router.get('/about', (req, res) => {
  res.render('pages/about', {
    title: 'درباره پروژه CMS اختصاصی'
  });
});

export default router;
