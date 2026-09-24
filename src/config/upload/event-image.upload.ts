import { BadRequestException } from '@nestjs/common';
import { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { randomUUID } from 'crypto';
import { existsSync } from 'fs';
import { mkdir, unlink, writeFile } from 'fs/promises';
import { memoryStorage } from 'multer';
import { extname, join } from 'path';

export const UPLOADS_ROOT = join(process.cwd(), 'uploads');
export const UPLOADS_PREFIX = '/uploads';
const EVENTS_DIR = join(UPLOADS_ROOT, 'events');

export const MAX_GALLERY_FILES = 10;
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export const eventImageMulterOptions: MulterOptions = {
  storage: memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    const extension = extname(file.originalname).toLowerCase();
    if (
      !ALLOWED_EXTENSIONS.includes(extension) ||
      !ALLOWED_MIME_TYPES.includes(file.mimetype)
    ) {
      return cb(
        new BadRequestException(
          'Faqat jpg, jpeg, png yoki webp rasm yuklash mumkin',
        ),
        false,
      );
    }
    cb(null, true);
  },
};

export async function saveEventImage(file: Express.Multer.File) {
  if (!existsSync(EVENTS_DIR)) {
    await mkdir(EVENTS_DIR, { recursive: true });
  }
  const fileName = `${randomUUID()}${extname(file.originalname).toLowerCase()}`;
  await writeFile(join(EVENTS_DIR, fileName), file.buffer);
  return `${UPLOADS_PREFIX}/events/${fileName}`;
}

export async function removeEventImage(url: string) {
  if (!url.startsWith(`${UPLOADS_PREFIX}/events/`)) {
    return;
  }
  const filePath = join(UPLOADS_ROOT, url.slice(UPLOADS_PREFIX.length));
  await unlink(filePath).catch(() => undefined);
}
