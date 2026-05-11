import { BadRequestException } from '@nestjs/common';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { randomBytes } from 'crypto';

const allowed = ['.png', '.jpg', '.jpeg', '.webp'];
const logoAllowed = ['.png', '.jpg', '.jpeg', '.webp', '.svg'];

const ensureDir = (path: string) => {
  if (!existsSync(path)) mkdirSync(path, { recursive: true });
};

export const equipmentMulterOptions = {
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req: any, file: any, cb: any) => {
    const ext = extname(file.originalname).toLowerCase();
    if (!allowed.includes(ext)) {
      return cb(new BadRequestException(`Допустимы только файлы: ${allowed.join(', ')}`), false);
    }
    cb(null, true);
  },
  storage: diskStorage({
    destination: (_req: any, _file: any, cb: any) => {
      const dir = join(process.cwd(), 'uploads', 'equipment');
      ensureDir(dir);
      cb(null, dir);
    },
    filename: (_req: any, file: any, cb: any) => {
      const ext = extname(file.originalname).toLowerCase();
      const random = randomBytes(8).toString('hex');
      cb(null, `${Date.now()}-${random}${ext}`);
    },
  }),
};

/**
 * Multer-опции для логотипа платформы.
 * Меньший лимит размера (2 МБ — логотип не должен быть тяжёлым) и
 * разрешён SVG (часто используется для адаптивных логотипов).
 */
export const logoMulterOptions = {
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req: any, file: any, cb: any) => {
    const ext = extname(file.originalname).toLowerCase();
    if (!logoAllowed.includes(ext)) {
      return cb(
        new BadRequestException(`Допустимы только файлы: ${logoAllowed.join(', ')}`),
        false,
      );
    }
    cb(null, true);
  },
  storage: diskStorage({
    destination: (_req: any, _file: any, cb: any) => {
      const dir = join(process.cwd(), 'uploads', 'logos');
      ensureDir(dir);
      cb(null, dir);
    },
    filename: (_req: any, file: any, cb: any) => {
      const ext = extname(file.originalname).toLowerCase();
      const random = randomBytes(8).toString('hex');
      cb(null, `${Date.now()}-${random}${ext}`);
    },
  }),
};
