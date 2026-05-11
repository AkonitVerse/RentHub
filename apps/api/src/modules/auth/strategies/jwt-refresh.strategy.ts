import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';

export interface RefreshPayload {
  sub: number;
  jti: string;
  email: string;
}

const refreshExtractor = (req: Request): string | null => {
  if (!req || !req.cookies) return null;
  return (req.cookies['refresh_token'] as string | undefined) ?? null;
};

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(config: ConfigService) {
    const secret = config.get<string>('JWT_REFRESH_SECRET');
    if (!secret) throw new Error('JWT_REFRESH_SECRET не задан');
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([refreshExtractor]),
      secretOrKey: secret,
      ignoreExpiration: false,
      passReqToCallback: true,
    });
  }

  validate(req: Request, payload: RefreshPayload): RefreshPayload & { token: string } {
    const token = (req.cookies?.['refresh_token'] as string | undefined) ?? '';
    if (!payload?.sub || !token) throw new UnauthorizedException();
    return { ...payload, token };
  }
}
