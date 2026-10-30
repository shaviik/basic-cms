import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';

/**
 * 🎓 مفهوم میدل‌ور (Middleware) در Express:
 * در نودجی‌اس و اکسپرس، درخواست کاربر (Request) شبیه بسته‌ای است که از روی یک تسمه‌نقاله عبور می‌کند.
 * هر تابعی که سه پارامتر (req, res, next) داشته باشد یک Middleware است.
 * - req: اطلاعات ارسالی کلاینت (کوکی‌ها، هدرها، بدنه فرم و...)
 * - res: متدهایی برای ساخت و ارسال پاسخ به کلاینت
 * - next: فراخوانی میدل‌ور بعدی در تسمه‌نقاله. اگر next() را صدا نزنیم، درخواست در همان نقطه معلق می‌ماند!
 */

export const authenticateToken = (req, res, next) => {
  const token = req.cookies?.cms_auth_token || req.headers.authorization?.split(' ')[1];

  if (!token) {
    console.log(`[AUTH] No token found for path: ${req.method} ${req.path}. Cookies:`, req.cookies);
    if (req.path.startsWith('/api/') || req.headers.accept?.includes('application/json')) {
      return res.status(401).json({
        success: false,
        message: 'برای دسترسی به این بخش باید وارد حساب کاربری خود شوید (توکن یافت نشد).'
      });
    }
    return res.redirect('/auth/login?error=unauthorized');
  }

  try {
    const decodedUser = jwt.verify(token, config.jwtSecret);
    req.user = decodedUser;
    res.locals.currentUser = decodedUser;
    next();
  } catch (error) {
    console.log('[AUTH] Token verification error:', error.message);
    res.clearCookie('cms_auth_token');


    if (req.path.startsWith('/api/') || req.headers.accept?.includes('application/json')) {
      return res.status(403).json({
        success: false,
        message: 'توکن نامعتبر است یا منقضی شده است.'
      });
    }

    return res.redirect('/auth/login?error=expired');
  }
};

/**
 * میدل‌ور تفکیک سطوح دسترسی بر اساس نقش‌ها (RBAC)
 * نقش‌ها: SUPER_ADMIN | ADMIN | USER
 * نحوه استفاده: requireRoles(['SUPER_ADMIN', 'ADMIN'])
 */
export const requireRoles = (allowedRoles = []) => {
  return (req, res, next) => {
    // اول مطمئن می‌شویم کاربر احراز هویت شده است
    if (!req.user) {
      return res.status(401).send('عدم احراز هویت');
    }

    // بررسی اینکه آیا نقش کاربر در لیست مجازها هست یا نه
    const userRole = req.user.role;
    if (!allowedRoles.includes(userRole)) {
      if (req.path.startsWith('/api/')) {
        return res.status(403).json({
          success: false,
          message: 'شما اجازه دسترسی به این منبع را ندارید (عدم کفایت سطح دسترسی).'
        });
      }
      return res.status(403).render('pages/error', {
        title: 'دسترسی غیرمجاز',
        statusCode: 403,
        message: 'سطح دسترسی شما برای این بخش کافی نیست.'
      });
    }

    next();
  };
};
