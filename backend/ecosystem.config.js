/**
 * PM2 тохиргоо — production-д ажиллуулах:
 *   pm2 start ecosystem.config.js
 *   pm2 save && pm2 startup   (реboot дараа автоматаар асаах)
 * Лог: pm2 logs ocirrf-api
 */
module.exports = {
  apps: [
    {
      name: 'ocirrf-api',
      cwd: __dirname,
      script: 'dist/main.js',
      instances: 1,
      autorestart: true,
      max_memory_restart: '300M',
      env: {
        NODE_ENV: 'production',
        // Өдрийн хил/дугаарын огноо УБ цагаар (main.ts default-тай ижил)
        TZ: 'Asia/Ulaanbaatar',
      },
      // .env-ийг main.ts дотор dotenv уншдаг тул энд давхардуулах хэрэггүй
      out_file: './logs/pm2-out.log',
      error_file: './logs/pm2-error.log',
      merge_logs: true,
      time: true,
    },
  ],
};
