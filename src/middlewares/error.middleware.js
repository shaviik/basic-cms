/**
 * 🎓 مفهوم Error Handling Middleware در اکسپرس:
 * هرگاه تابعی با ۴ آرگومان (err, req, res, next) تعریف شود، اکسپرس آن را به عنوان گیرنده خطاهای سراسری می‌شناسد.
 * هر زمان در هر جای پروژه تابعی خطا تولید کند یا `next(error)` صدا زده شود،
 * اکسپرس تمام میدل‌ورهای بعدی را نادیده گرفته و مستقیماً کنترل را به این تابع می‌دهد.
 */
export const errorHandler = (err, req, res, next) => {
  console.error('❌ خطای رخ داده در سیستم:', err);

  const statusCode = err.statusCode || err.status || 500;
  const message = err.message || 'خطای غیرمنتظره‌ای در سرور رخ داده است.';

  if (req.path.startsWith('/api/') || req.headers.accept?.includes('application/json')) {
    return res.status(statusCode).json({
      success: false,
      statusCode,
      message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }

  // در حالت صفحات سرور، قالب خطا رندر می‌شود
  res.status(statusCode).render('pages/error', {
    title: `خطا ${statusCode}`,
    statusCode,
    message,
    error: process.env.NODE_ENV === 'development' ? err : {}
  });
};

/**
 * مدیریت خطای صفحات یافت نشده (404 Not Found)
 */
export const notFoundHandler = (req, res, next) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({
      success: false,
      statusCode: 404,
      message: `مسیر ${req.originalUrl} در سرور وجود ندارد.`
    });
  }

  res.status(404).render('pages/error', {
    title: 'صفحه پیدا نشد (404)',
    statusCode: 404,
    message: `صفحه‌ای که به دنبال آن هستید یافت نشد: ${req.originalUrl}`
  });
};
