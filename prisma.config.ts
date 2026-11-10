import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  // Faqat process.env dan o'qiymiz: serverda (prod) src/ kodi bo'lmasa ham
  // `prisma migrate deploy` ishlashi kerak.
  datasource: {
    url: String(process.env.DB_URI),
  },
});
