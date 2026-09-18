import { config } from 'dotenv';
config();

export const env = {
  PORT: Number(process.env.PORT),
  DB_URI: String(process.env.DB_URI),

  SUPERADMIN: {
    EMAIL: String(process.env.SUPERADMIN_EMAIL),
    PASSWORD: String(process.env.SUPERADMIN_PASSWORD),
  },

  TELEGRAM: {
    TOKEN: String(process.env.BOT_TOKEN),
    ID: Number(process.env.CHAT_ID),
  }
};
