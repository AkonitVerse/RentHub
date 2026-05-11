import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { randomBytes } from 'crypto';

export const CART_COOKIE = 'cart_sid';

function generateSessionId(): string {
  return randomBytes(18).toString('base64url');
}

@Injectable()
export class CartSessionMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const cookies = (req as Request & { cookies?: Record<string, string> }).cookies ?? {};
    let sid = cookies[CART_COOKIE];
    if (!sid || sid.length < 16) {
      sid = generateSessionId();
      const isProd = process.env.NODE_ENV === 'production';
      res.cookie(CART_COOKIE, sid, {
        httpOnly: true,
        sameSite: 'lax',
        secure: isProd,
        maxAge: 1000 * 60 * 60 * 24 * 7,
        path: '/',
      });
    }
    (req as Request & { cartSessionId?: string }).cartSessionId = sid;
    next();
  }
}
