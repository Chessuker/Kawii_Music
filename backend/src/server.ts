import { serve } from '@hono/node-server';
import app from './index';
import { config } from 'dotenv';

// 1. โหลดค่าจากไฟล์ .dev.vars เข้าสู่ process.env ของระบบ
config({ path: '.dev.vars' });

const port = 8787;
console.log(`🚀 System Online: Backend is running on http://127.0.0.1:${port}`);

// 2. จำลองสภาพแวดล้อม (Inject) ตัว process.env เข้าไปใน c.env ของ Hono
serve({
  fetch: (request) => app.fetch(request, process.env),
  port
});