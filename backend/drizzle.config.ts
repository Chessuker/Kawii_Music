import { defineConfig } from 'drizzle-kit';
import { config } from 'dotenv';

// บังคับให้โหลด Environment Variables จากไฟล์ .dev.vars
config({ path: '.dev.vars' });

export default defineConfig({
  schema: './src/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});