import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// مسیر ذخیره‌سازی فایل پایگاه داده محلی SQLite در ریشه پروژه
const dbPath = path.join(__dirname, '../../cms.db');

/**
 * 🎓 مفهوم پایگاه‌داده محلی داخلی در Node.js 24:
 * در نسخه‌های جدید نودجی‌اس (v22.5 به بعد و v24)، ماژول فوق‌سریع و بومی `node:sqlite`
 * مستقیماً در هسته V8 نودجی‌اس تعبیه شده است!
 * بدون نیاز به نصب هیچ درایور خارجی، کامپایل C++، یا نصب MySQL/Postgres مجزا.
 */
export const db = new DatabaseSync(dbPath);

// فعال‌سازی حالت WAL برای سرعت فوق‌العاده بالا و پشتیبانی از خواندن/نوشتن همزمان
db.exec('PRAGMA journal_mode = WAL;');

// فعال‌سازی روابط کلید خارجی (Foreign Keys) در SQLite برای حفظ یکپارچگی داده‌ها
db.exec('PRAGMA foreign_keys = ON;');

/**
 * ایجاد جداول رابطه‌ای (Relational Schema)
 */
export function initializeDatabase() {
  db.exec(`
    -- ۱. جدول نقش‌های کاربری (RBAC)
    CREATE TABLE IF NOT EXISTS roles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      description TEXT
    );

    -- ۲. جدول کاربران (با کلید خارجی به جدول نقش‌ها)
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- ۳. جدول انواع پست (Post Types: مقاله، خبر، محصول)
    CREATE TABLE IF NOT EXISTS post_types (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      description TEXT
    );

    -- ۴. جدول دسته‌بندی‌ها (Categories)
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      description TEXT
    );

    -- ۵. جدول پست‌ها با فیلد اختصاصی کدهای HTML و روابط با نویسنده، نوع پست و دسته
    CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      content_html TEXT NOT NULL,
      excerpt TEXT,
      status TEXT DEFAULT 'published',
      post_type_id INTEGER NOT NULL REFERENCES post_types(id) ON DELETE CASCADE,
      category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
      author_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- ۶. جدول کتابخانه رسانه‌ها و فایل‌های آپلود شده
    CREATE TABLE IF NOT EXISTS media (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL,
      original_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size INTEGER NOT NULL,
      url TEXT NOT NULL,
      uploader_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- ۷. جدول چیدمان درگ اند دراپ و بلوک‌های صفحات
    CREATE TABLE IF NOT EXISTS page_blocks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      page_slug TEXT NOT NULL,
      title TEXT NOT NULL,
      type TEXT NOT NULL, -- HEADER | HERO | HTML_CODE | POSTS_GRID | FOOTER
      content_html TEXT,
      sort_order INTEGER NOT NULL DEFAULT 1,
      is_fixed INTEGER NOT NULL DEFAULT 0
    );
  `);

  seedDefaultData();
}

/**
 * تزریق داده‌های اولیه (Database Seeding) در صورت خالی بودن دیتابیس
 */
function seedDefaultData() {
  // ۱. ثبت نقش‌های کاربری پایه
  const countRoles = db.prepare('SELECT COUNT(*) as count FROM roles').get().count;
  if (countRoles === 0) {
    const insertRole = db.prepare('INSERT INTO roles (name, description) VALUES (?, ?)');
    insertRole.run('SUPER_ADMIN', 'مدیر ارشد با دسترسی کامل به کل سامانه');
    insertRole.run('ADMIN', 'مدیر محتوا با دسترسی به پست‌ها، رسانه‌ها و لایه‌اوت');
    insertRole.run('USER', 'کاربر عادی فرانت‌اند');
    console.log('✅ نقش‌های پیش‌فرض در دیتابیس ثبت شدند.');
  }

  // ۲. ساخت کاربر Super Admin پیش‌فرض
  const countUsers = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  if (countUsers === 0) {
    const superAdminRole = db.prepare('SELECT id FROM roles WHERE name = ?').get('SUPER_ADMIN');
    const hash = bcrypt.hashSync('admin123', 10);
    const insertUser = db.prepare(`
      INSERT INTO users (email, password_hash, full_name, role_id)
      VALUES (?, ?, ?, ?)
    `);
    insertUser.run('admin@cms.local', hash, 'مدیر کل سامانه (Super Admin)', superAdminRole.id);
    console.log('✅ کاربر سوپر ادمین (admin@cms.local / admin123) ساخته شد.');
  }

  // ۳. ثبت انواع پست (Post Types)
  const countPostTypes = db.prepare('SELECT COUNT(*) as count FROM post_types').get().count;
  if (countPostTypes === 0) {
    const insertPostType = db.prepare('INSERT INTO post_types (slug, title, description) VALUES (?, ?, ?)');
    insertPostType.run('article', 'مقاله', 'مقالات آموزشی و متنی');
    insertPostType.run('news', 'اخبار', 'اخبار و اطلاع‌رسانی‌ها');
    insertPostType.run('product', 'محصول', 'معرفی خدمات و محصولات');
    console.log('✅ انواع پست پیش‌فرض ثبت شدند.');
  }

  // ۴. ثبت دسته‌بندی‌های نمونه
  const countCats = db.prepare('SELECT COUNT(*) as count FROM categories').get().count;
  if (countCats === 0) {
    const insertCat = db.prepare('INSERT INTO categories (slug, title, description) VALUES (?, ?, ?)');
    insertCat.run('programming', 'آموزش برنامه‌نویسی', 'مباحث مرتبط با Node.js و وب');
    insertCat.run('web-dev', 'تکنولوژی و وب', 'اخبار و استانداردهای توسعه وب');
    insertCat.run('general', 'عمومی', 'مطالب متفرقه و عمومی');
    console.log('✅ دسته‌بندی‌های پایه ثبت شدند.');
  }

  // ۵. ثبت پست نمونه حاوی کدهای اجرایی HTML
  const countPosts = db.prepare('SELECT COUNT(*) as count FROM posts').get().count;
  if (countPosts === 0) {
    const adminUser = db.prepare('SELECT id FROM users LIMIT 1').get();
    const articleType = db.prepare('SELECT id FROM post_types WHERE slug = ?').get('article');
    const catProg = db.prepare('SELECT id FROM categories WHERE slug = ?').get('programming');

    const sampleHtml = `<div class="p-6 bg-gradient-to-r from-indigo-900 via-indigo-800 to-purple-900 text-white rounded-2xl shadow-xl my-4">
  <div class="flex items-center gap-3 mb-3">
    <span class="px-3 py-1 bg-white/20 rounded-full text-xs font-mono font-bold">HTML5 + CSS + JS RUNNER</span>
    <span class="text-xs text-indigo-200">کد ذخیره شده در پایگاه داده</span>
  </div>
  <h2 class="text-2xl font-bold mb-2">🚀 اجرای مستقیم کدهای تعاملی در دیتابیس</h2>
  <p class="text-indigo-100 text-sm mb-4 leading-relaxed">
    این بخش توسط کاربر درون فیلد content_html ذخیره شده و اکنون بدون Escape شدن مستقیماً در مرورگر رندر و اجرا می‌شود!
  </p>
  <button onclick="alert('رویداد تعاملی درون دیتابیس با موفقیت اجرا شد!')" class="bg-indigo-500 hover:bg-indigo-600 text-white font-medium px-4 py-2 rounded-xl text-sm transition shadow-md">
    برای تست اجرای جاوااسکریپت کلیک کنید
  </button>
</div>`;

    const insertPost = db.prepare(`
      INSERT INTO posts (title, slug, content_html, excerpt, status, post_type_id, category_id, author_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertPost.run(
      'آموزش جامع معماری CMS با Node.js و SQLite',
      'learn-nodejs-cms-architecture',
      sampleHtml,
      'در این مطلب بررسی می‌کنیم چگونه سیستم‌های مدیریت محتوا کدهای پویا و لایه‌بندی‌ها را مدیریت می‌کنند.',
      'published',
      articleType.id,
      catProg.id,
      adminUser.id
    );
    console.log('✅ پست نمونه با کدهای اجرایی HTML در دیتابیس ذخیره شد.');
  }

  // ۶. ثبت بلوک‌های اولیه چیدمان صفحه اصلی (Drag and Drop Layout)
  const countBlocks = db.prepare('SELECT COUNT(*) as count FROM page_blocks WHERE page_slug = ?').get('home').count;
  if (countBlocks === 0) {
    const insertBlock = db.prepare(`
      INSERT INTO page_blocks (page_slug, title, type, content_html, sort_order, is_fixed)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    insertBlock.run('home', 'هدر سایت و نوار ناوبری', 'HEADER', '', 1, 1);
    insertBlock.run('home', 'بخش معرفی اصلی (Hero Section)', 'HERO', '', 2, 0);
    insertBlock.run('home', 'بلوک اختصاصی کد HTML (بنر تبلیغاتی)', 'HTML_CODE', '<div class="p-4 bg-purple-100 text-purple-900 rounded-xl font-bold text-center">این یک بلوک دلخواه HTML چیدمان درگ اند دراپ است!</div>', 3, 0);
    insertBlock.run('home', 'شبکه آخرین مطالب (Posts Grid)', 'POSTS_GRID', '', 4, 0);
    insertBlock.run('home', 'فوتر سایت و کپی‌رایت', 'FOOTER', '', 5, 1);
    console.log('✅ بلوک‌های چیدمان Drag & Drop ثبت شدند.');
  }
}
