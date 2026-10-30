import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import { config } from './config/env.js';

// ایمپورت روت‌های ماژولار مختلف
import webRoutes from './routes/web.routes.js';
import authRoutes from './routes/auth.routes.js';
import adminRoutes from './routes/admin.routes.js';
import apiRoutes from './routes/api.routes.js';
import { errorHandler, notFoundHandler } from './middlewares/error.middleware.js';

/**
 * 🎓 بازآموزی مفاهیم Node.js:
 * در استاندارد جدید ES Modules متغیرهای __dirname و __filename به صورت پیش‌فرض وجود ندارند.
 * با دو خط زیر مسیر دایرکتوری فعلی را به دست می‌آوریم:
 */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ساخت نمونه اصلی برنامه اکسپرس
const app = express();

/**
 * 🎓 تنظیم View Engine (موتور رندر قالب سرور):
 * EJS به ما اجازه می‌دهد کدهای HTML داینامیک بنویسیم، هدر و فوتر مشترک داشته باشیم
 * و داده‌های دیتابیس را مستقیماً در سمت سرور درون HTML تزریق کنیم.
 */
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

/**
 * 🎓 میدل‌ورهای پایه (Built-in Middlewares):
 * هر درخواست HTTP که به سرور می‌رسد به صورت یک جریان داده خام (Stream) است.
 * میدل‌ورهای زیر این داده‌ها را به شیء‌های قابل فهم تبدیل می‌کنند:
 */

// ۱. پارس کردن داده‌های JSON (برای درخواست‌های API و آینده با فریم‌ورک‌هایی مثل React)
app.use(express.json());

// ۲. پارس کردن داده‌های ارسالی فرم‌های HTML معمولی
app.use(express.urlencoded({ extended: true }));

// ۳. پارس کردن هدر Cookie مرورگر و قرار دادن کوکی‌ها در req.cookies
app.use(cookieParser());

// ۴. فعال‌سازی CORS برای پذیرش درخواست‌ها از فرانت‌اند در دامنه یا پورت دیگر
app.use(cors());

// ۵. سرو فایل‌های استاتیک (CSS, تصاویر، اسکریپت‌ها و فایل‌های آپلود شده)
// هر فایلی در پوشه public قرار بگیرد مستقیماً با آدرس دامنه در دسترس است: مثلا /uploads/image.png
app.use(express.static(path.join(__dirname, '../public')));

/**
 * 🎓 میدل‌ور سراسری برای تشخیص وضعیت لاگین کاربر در تمام صفحات:
 * اگر کاربر کوکی ورود داشته باشد، اطلاعات کاربر در res.locals.currentUser ذخیره می‌شود
 * تا در تمامی فایل‌های EJS (مثل هدر، منوها و داشبورد) به راحتی در دسترس باشد.
 */
app.use((req, res, next) => {
  const token = req.cookies?.cms_auth_token;
  if (token) {
    try {
      const decoded = jwt.verify(token, config.jwtSecret);
      req.user = decoded;
      res.locals.currentUser = decoded;
    } catch (err) {
      // توکن نامعتبر یا منقضی شده
      res.clearCookie('cms_auth_token');
      req.user = null;
      res.locals.currentUser = null;
    }
  } else {
    req.user = null;
    res.locals.currentUser = null;
  }
  next();
});

// اتصال مسیرها (Routes) به برنامه
app.use('/auth', authRoutes);
app.use('/admin', adminRoutes);
app.use('/api/v1', apiRoutes);
app.use('/', webRoutes);

// میدل‌ورهای خطایابی
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
