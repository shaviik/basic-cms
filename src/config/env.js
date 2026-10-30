import dotenv from 'dotenv';

// بارگذاری متغیرهای محیطی از فایل .env در process.env
// در نودجی‌اس متغیرهای حساس مثل کلیدهای رمزنrate و پورت سرور نباید مستقیم در کد نوشته شوند
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET || 'fallback_secret_key_change_me',
  isDev: (process.env.NODE_ENV || 'development') === 'development',
};
