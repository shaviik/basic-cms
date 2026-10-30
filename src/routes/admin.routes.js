import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { db } from '../database/db.js';
import { authenticateToken, requireRoles } from '../middlewares/auth.middleware.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = Router();

// اطمینان از وجود پوشه آپلودها
const uploadsDir = path.join(__dirname, '../../public/uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

/**
 * 🎓 پیکربندی Multer برای آپلود فایل‌ها (رسانه‌ها):
 * دیسک‌استوریج به ما اجازه می‌دهد نام فایل‌ها را یکتا کنیم تا فایل‌های همنام روی هم بازنویسی نشوند.
 */
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    // جلوگیری از تداخل نام: افزودن زمان جاری و پسوند امن
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, 'media-' + uniqueSuffix + ext);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // حداکثر ۱۰ مگابایت
  fileFilter: (req, file, cb) => {
    // فرمت‌های مجاز
    const allowedTypes = /jpeg|jpg|png|gif|webp|svg|pdf|mp4/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
      return cb(null, true);
    }
    cb(new Error('فقط فایل‌های تصویری، ویدئویی و اسناد مجاز هستند!'));
  }
});

/**
 * تمامی روت‌های این کنترلر نیازمند احراز هویت با کوکی و داشتن نقش مدیر هستند
 */
router.use(authenticateToken);
router.use(requireRoles(['SUPER_ADMIN', 'ADMIN']));

// ۱. داشبورد مدیریت با آمار زنده از دیتابیس
router.get('/dashboard', (req, res) => {
  const totalPosts = db.prepare('SELECT COUNT(*) as count FROM posts').get().count;
  const totalPages = db.prepare('SELECT COUNT(DISTINCT page_slug) as count FROM page_blocks').get().count;
  const totalMedia = db.prepare('SELECT COUNT(*) as count FROM media').get().count;
  const totalUsers = db.prepare('SELECT COUNT(*) as count FROM users').get().count;

  const recentPosts = db.prepare(`
    SELECT p.id, p.title, p.slug, p.status, p.created_at, pt.title as post_type, c.title as category
    FROM posts p
    LEFT JOIN post_types pt ON p.post_type_id = pt.id
    LEFT JOIN categories c ON p.category_id = c.id
    ORDER BY p.id DESC
    LIMIT 5
  `).all();

  res.render('admin/dashboard', {
    title: 'داشبورد مدیریت CMS',
    user: req.user,
    stats: { totalPosts, totalPages, totalMedia, totalUsers },
    recentPosts
  });
});

// ==========================================
// ۲. مدیریت پست‌ها (مطالب، مقالات، کد HTML)
// ==========================================

// مشاهده لیست تمام پست‌ها
router.get('/posts', (req, res) => {
  const posts = db.prepare(`
    SELECT p.*, pt.title as post_type_title, c.title as category_title, u.full_name as author_name
    FROM posts p
    LEFT JOIN post_types pt ON p.post_type_id = pt.id
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN users u ON p.author_id = u.id
    ORDER BY p.id DESC
  `).all();

  res.render('admin/posts-list', {
    title: 'لیست پست‌ها و مطالب',
    posts,
    success: req.query.success || null,
    error: req.query.error || null
  });
});

// فرم ایجاد پست جدید
router.get('/posts/create', (req, res) => {
  const postTypes = db.prepare('SELECT * FROM post_types ORDER BY id ASC').all();
  const categories = db.prepare('SELECT * FROM categories ORDER BY id ASC').all();

  res.render('admin/post-form', {
    title: 'ایجاد پست جدید با پشتیبانی از کدهای HTML',
    post: null,
    postTypes,
    categories,
    error: null
  });
});

// ذخیره پست جدید در دیتابیس (با فیلد اختصاصی کدهای خام HTML)
router.post('/posts/create', (req, res, next) => {
  try {
    const { title, slug, content_html, excerpt, status, post_type_id, category_id } = req.body;

    if (!title || !slug || !content_html || !post_type_id) {
      const postTypes = db.prepare('SELECT * FROM post_types').all();
      const categories = db.prepare('SELECT * FROM categories').all();
      return res.status(400).render('admin/post-form', {
        title: 'ایجاد پست جدید',
        post: req.body,
        postTypes,
        categories,
        error: 'لطفاً فیلدهای اجباری (عنوان، نامک، نوع پست و محتوای HTML) را وارد کنید.'
      });
    }

    // نرمال‌سازی اسلاگ (Slug)
    let cleanSlug = slug.trim().toLowerCase().replace(/[\s\W-]+/g, '-');
    
    // بررسی تکراری نبودن اسلاگ
    const existing = db.prepare('SELECT id FROM posts WHERE slug = ?').get(cleanSlug);
    if (existing) {
      cleanSlug = cleanSlug + '-' + Date.now();
    }

    const insertStmt = db.prepare(`
      INSERT INTO posts (title, slug, content_html, excerpt, status, post_type_id, category_id, author_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertStmt.run(
      title.trim(),
      cleanSlug,
      content_html,
      excerpt ? excerpt.trim() : title.trim(),
      status || 'published',
      parseInt(post_type_id, 10),
      category_id ? parseInt(category_id, 10) : null,
      req.user.id
    );

    res.redirect('/admin/posts?success=' + encodeURIComponent('پست جدید با موفقیت در دیتابیس ذخیره شد!'));
  } catch (error) {
    next(error);
  }
});

// فرم ویرایش پست موجود
router.get('/posts/edit/:id', (req, res) => {
  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id);
  if (!post) {
    return res.redirect('/admin/posts?error=' + encodeURIComponent('پست مورد نظر یافت نشد.'));
  }

  const postTypes = db.prepare('SELECT * FROM post_types ORDER BY id ASC').all();
  const categories = db.prepare('SELECT * FROM categories ORDER BY id ASC').all();

  res.render('admin/post-form', {
    title: `ویرایش پست: ${post.title}`,
    post,
    postTypes,
    categories,
    error: null
  });
});

// اعمال ویرایش پست در دیتابیس
router.post('/posts/edit/:id', (req, res, next) => {
  try {
    const { title, slug, content_html, excerpt, status, post_type_id, category_id } = req.body;
    const postId = req.params.id;

    let cleanSlug = slug.trim().toLowerCase().replace(/[\s\W-]+/g, '-');
    const existing = db.prepare('SELECT id FROM posts WHERE slug = ? AND id != ?').get(cleanSlug, postId);
    if (existing) {
      cleanSlug = cleanSlug + '-' + Date.now();
    }

    const updateStmt = db.prepare(`
      UPDATE posts
      SET title = ?, slug = ?, content_html = ?, excerpt = ?, status = ?, post_type_id = ?, category_id = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    updateStmt.run(
      title.trim(),
      cleanSlug,
      content_html,
      excerpt ? excerpt.trim() : '',
      status || 'published',
      parseInt(post_type_id, 10),
      category_id ? parseInt(category_id, 10) : null,
      postId
    );

    res.redirect('/admin/posts?success=' + encodeURIComponent('تغییرات پست با موفقیت به‌روزرسانی شد!'));
  } catch (error) {
    next(error);
  }
});

// حذف پست
router.post('/posts/delete/:id', (req, res, next) => {
  try {
    db.prepare('DELETE FROM posts WHERE id = ?').run(req.params.id);
    res.redirect('/admin/posts?success=' + encodeURIComponent('پست با موفقیت حذف شد.'));
  } catch (error) {
    next(error);
  }
});

// ==========================================
// ۳. مدیریت چیدمان Drag & Drop (هدر، فوتر، بلوک‌ها)
// ==========================================

// مشاهده چیدمان صفحه اصلی و بلوک‌ها
router.get('/layouts', (req, res) => {
  const blocks = db.prepare(`
    SELECT * FROM page_blocks 
    WHERE page_slug = 'home' 
    ORDER BY sort_order ASC
  `).all();

  res.render('admin/layouts', {
    title: 'مدیریت چیدمان صفحات (Drag & Drop Layouts)',
    pageTitle: 'صفحه اصلی (Home Page)',
    blocks,
    success: req.query.success || null
  });
});

// ذخیره ترتیب جدید بلوک‌ها پس از درگ اند دراپ
router.post('/layouts/reorder', (req, res) => {
  try {
    const { orderList } = req.body; // آرایه‌ای از { id: 1, order: 1 }

    if (!Array.isArray(orderList)) {
      return res.status(400).json({ success: false, message: 'داده‌های ترتیب نامعتبر است.' });
    }

    // به‌روزرسانی تک‌تک بلوک‌ها در یک تراکنش هماهنگ
    const updateStmt = db.prepare('UPDATE page_blocks SET sort_order = ? WHERE id = ?');
    for (const item of orderList) {
      updateStmt.run(item.order, item.id);
    }

    res.json({
      success: true,
      message: 'ترتیب جدید لایه‌اوت با موفقیت در دیتابیس ذخیره شد!'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// افزودن بلوک جدید کد خام HTML به لایه‌اوت
router.post('/layouts/blocks/create', (req, res) => {
  try {
    const { title, content_html } = req.body;
    const maxOrder = db.prepare("SELECT MAX(sort_order) as maxOrder FROM page_blocks WHERE page_slug = 'home'").get().maxOrder || 1;

    const insertBlock = db.prepare(`
      INSERT INTO page_blocks (page_slug, title, type, content_html, sort_order, is_fixed)
      VALUES ('home', ?, 'HTML_CODE', ?, ?, 0)
    `);

    insertBlock.run(
      title || 'بلوک HTML سفارشی',
      content_html || '<div class="p-4 bg-gray-100 rounded-xl">محتوای جدید HTML</div>',
      maxOrder + 1
    );

    res.redirect('/admin/layouts?success=' + encodeURIComponent('بلوک جدید به چیدمان صفحه اضافه شد!'));
  } catch (error) {
    res.redirect('/admin/layouts?error=' + encodeURIComponent(error.message));
  }
});

// حذف یک بلوک از لایه‌اوت
router.post('/layouts/blocks/delete/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM page_blocks WHERE id = ? AND is_fixed = 0').run(req.params.id);
    res.redirect('/admin/layouts?success=' + encodeURIComponent('بلوک با موفقیت حذف شد.'));
  } catch (error) {
    res.redirect('/admin/layouts?error=' + encodeURIComponent(error.message));
  }
});

// ==========================================
// ۴. کتابخانه متمرکز رسانه‌ها و آپلود فایل با Multer
// ==========================================

// مشاهده لیست فایل‌های رسانه‌ای
router.get('/media', (req, res) => {
  const mediaFiles = db.prepare(`
    SELECT m.*, u.full_name as uploader_name
    FROM media m
    LEFT JOIN users u ON m.uploader_id = u.id
    ORDER BY m.id DESC
  `).all();

  res.render('admin/media-library', {
    title: 'کتابخانه رسانه‌ها و مدیریت فایل‌ها',
    mediaFiles,
    success: req.query.success || null,
    error: req.query.error || null
  });
});

// دریافت و ذخیره فایل آپلود شده با Multer
router.post('/media/upload', upload.single('file'), (req, res, next) => {
  try {
    if (!req.file) {
      return res.redirect('/admin/media?error=' + encodeURIComponent('هیچ فایلی برای آپلود انتخاب نشده است.'));
    }

    const fileUrl = '/uploads/' + req.file.filename;

    const insertMedia = db.prepare(`
      INSERT INTO media (filename, original_name, mime_type, size, url, uploader_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    insertMedia.run(
      req.file.filename,
      req.file.originalname,
      req.file.mimetype,
      req.file.size,
      fileUrl,
      req.user.id
    );

    res.redirect('/admin/media?success=' + encodeURIComponent('فایل با موفقیت آپلود و در کتابخانه ثبت شد!'));
  } catch (error) {
    next(error);
  }
});

// حذف فایل از دیسک و دیتابیس
router.post('/media/delete/:id', (req, res, next) => {
  try {
    const file = db.prepare('SELECT * FROM media WHERE id = ?').get(req.params.id);
    if (file) {
      const diskPath = path.join(uploadsDir, file.filename);
      if (fs.existsSync(diskPath)) {
        fs.unlinkSync(diskPath);
      }
      db.prepare('DELETE FROM media WHERE id = ?').run(req.params.id);
    }
    res.redirect('/admin/media?success=' + encodeURIComponent('فایل با موفقیت حذف شد.'));
  } catch (error) {
    next(error);
  }
});

// ==========================================
// ۵. مدیریت کاربران و نقش‌ها (RBAC) - فقط Super Admin
// ==========================================

router.get('/users', requireRoles(['SUPER_ADMIN']), (req, res) => {
  const users = db.prepare(`
    SELECT u.id, u.email, u.full_name, u.created_at, r.name as role
    FROM users u
    JOIN roles r ON u.role_id = r.id
    ORDER BY u.id ASC
  `).all();

  const roles = db.prepare('SELECT * FROM roles ORDER BY id ASC').all();

  res.render('admin/users-list', {
    title: 'مدیریت کاربران و تعیین سطوح دسترسی (RBAC)',
    users,
    roles,
    success: req.query.success || null,
    error: req.query.error || null
  });
});

// تغییر نقش کاربر توسط سوپر ادمین
router.post('/users/:id/role', requireRoles(['SUPER_ADMIN']), (req, res) => {
  try {
    const { role_name } = req.body;
    const userId = req.params.id;

    const role = db.prepare('SELECT id FROM roles WHERE name = ?').get(role_name);
    if (!role) {
      return res.status(400).json({ success: false, message: 'نقش انتخاب شده نامعتبر است.' });
    }

    db.prepare('UPDATE users SET role_id = ? WHERE id = ?').run(role.id, userId);

    if (req.headers.accept?.includes('application/json')) {
      return res.json({ success: true, message: 'نقش کاربر با موفقیت تغییر یافت.' });
    }

    res.redirect('/admin/users?success=' + encodeURIComponent('نقش کاربر با موفقیت تغییر کرد!'));
  } catch (error) {
    res.redirect('/admin/users?error=' + encodeURIComponent(error.message));
  }
});

export default router;
