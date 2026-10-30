import app from './app.js';
import { config } from './config/env.js';
import { initializeDatabase } from './database/db.js';

/**
 * 🎓 مقداردهی اولیه و راه‌اندازی سرور:
 * ابتدا جداول پایگاه‌داده و داده‌های پیش‌فرض را ایجاد می‌کنیم،
 * سپس وب‌سرور شروع به گوش دادن روی پورت می‌کند.
 */

try {
  // راه‌اندازی پایگاه داده محلی SQLite و جداول رابطه‌ای
  initializeDatabase();
  console.log('📦 پایگاه داده رابطه‌ای SQLite با موفقیت متصل و مقداردهی شد.');
} catch (dbError) {
  console.error('❌ خطا در اتصال یا مقداردهی اولیه پایگاه داده:', dbError);
}

const server = app.listen(config.port, () => {
  console.log('====================================================');
  console.log(`🚀 سرور CMS اختصاصی با موفقیت راه‌اندازی شد!`);
  console.log(`📡 آدرس سایت عمومی:      http://localhost:${config.port}`);
  console.log(`🛠️ پنل ادمین:            http://localhost:${config.port}/admin/dashboard`);
  console.log(`🔗 مستندات REST API:     http://localhost:${config.port}/api/v1/health`);
  console.log(`🌍 حالت محیط (Env):       ${config.nodeEnv}`);
  console.log('====================================================');
});

process.on('SIGTERM', () => {
  console.log('⚠️ دریافت سیگنال SIGTERM، در حال بستن اتصالات سرور...');
  server.close(() => {
    console.log('✅ سرور با موفقیت خاموش شد.');
    process.exit(0);
  });
});
