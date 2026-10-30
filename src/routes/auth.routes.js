import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';
import { db } from '../database/db.js';

const router = Router();

/**
 * 🎓 سیستم احراز هویت واقعی متصل به دیتابیس SQLite:
 * ۱. بررسی اعتبار کاربر در جدول users
 * ۲. مقایسه هش رمزعبور با الگوریتم امن bcrypt
 * ۳. تولید توکن امضاشده JWT حاوی نقش کاربری (RBAC)
 * ۴. ذخیره در کوکی امن با ویژگی HttpOnly
 */

// ۱. نمایش صفحه فرم لاگین
router.get('/login', (req, res) => {
  if (req.user) {
    return res.redirect('/admin/dashboard');
  }
  res.render('pages/login', {
    title: 'ورود به حساب کاربری',
    error: req.query.error || null,
    success: req.query.success || null
  });
});

// ۲. پردازش فرم لاگین با دیتابیس
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).render('pages/login', {
        title: 'ورود به حساب کاربری',
        error: 'لطفاً هم ایمیل و هم کلمه عبور را وارد کنید.',
        success: null
      });
    }

    // واکشی کاربر به همراه نام نقش او با استفاده از رابطه JOIN
    const user = db.prepare(`
      SELECT u.id, u.email, u.password_hash, u.full_name, r.name as role
      FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.email = ?
    `).get(email.trim().toLowerCase());

    // بررسی وجود کاربر و تطابق هش رمز عبور
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).render('pages/login', {
        title: 'ورود به حساب کاربری',
        error: 'ایمیل یا کلمه عبور اشتباه است.',
        success: null
      });
    }

    // تولید امضای امن JWT
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        fullName: user.full_name
      },
      config.jwtSecret,
      { expiresIn: '7d' }
    );

    // 🍪 ذخیره توکن در کوکی امن
    res.cookie('cms_auth_token', token, {
      httpOnly: true,
      secure: config.nodeEnv === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000 // ۷ روز
    });

    if (req.headers.accept?.includes('application/json')) {
      return res.json({
        success: true,
        message: 'ورود موفقیت‌آمیز بود.',
        token,
        user: { id: user.id, email: user.email, fullName: user.full_name, role: user.role }
      });
    }

    // اگر کاربر ادمین یا سوپر ادمین باشد به پنل و در غیر این صورت به صفحه اصلی هدایت می‌شود
    if (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN') {
      return res.redirect('/admin/dashboard');
    }
    res.redirect('/');
  } catch (error) {
    next(error);
  }
});

// ۳. نمایش صفحه ثبت‌نام
router.get('/register', (req, res) => {
  if (req.user) {
    return res.redirect('/');
  }
  res.render('pages/register', {
    title: 'ایجاد حساب کاربری جدید',
    error: null
  });
});

// ۴. پردازش ثبت‌نام کاربر جدید در دیتابیس
router.post('/register', async (req, res, next) => {
  try {
    const { email, password, full_name } = req.body;

    if (!email || !password || !full_name) {
      return res.status(400).render('pages/register', {
        title: 'ایجاد حساب کاربری جدید',
        error: 'لطفاً تمامی فیلدها را با دقت پر کنید.'
      });
    }

    // بررسی تکراری نبودن ایمیل
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.trim().toLowerCase());
    if (existing) {
      return res.status(400).render('pages/register', {
        title: 'ایجاد حساب کاربری جدید',
        error: 'این ایمیل قبلاً در سامانه ثبت شده است.'
      });
    }

    // دریافت شناسه نقش پیش‌فرض کاربر عادی (USER)
    const userRole = db.prepare('SELECT id FROM roles WHERE name = ?').get('USER');
    const hash = bcrypt.hashSync(password, 10);

    const insertStmt = db.prepare(`
      INSERT INTO users (email, password_hash, full_name, role_id)
      VALUES (?, ?, ?, ?)
    `);
    insertStmt.run(email.trim().toLowerCase(), hash, full_name.trim(), userRole.id);

    res.redirect('/auth/login?success=' + encodeURIComponent('ثبت‌نام شما با موفقیت انجام شد! اکنون می‌توانید وارد شوید.'));
  } catch (error) {
    next(error);
  }
});

// ۵. خروج از حساب کاربری
router.get('/logout', (req, res) => {
  res.clearCookie('cms_auth_token');
  res.redirect('/auth/login?success=' + encodeURIComponent('با موفقیت از حساب کاربری خارج شدید.'));
});

export default router;
