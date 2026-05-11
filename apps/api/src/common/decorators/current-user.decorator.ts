import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface JwtUserPayload {
  sub: number;
  email: string;
  role: 'ADMIN' | 'MANAGER' | 'USER';
}

export const CurrentUser = createParamDecorator(
  (data: keyof JwtUserPayload | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as JwtUserPayload | undefined;
    if (!user) return undefined;
    return data ? user[data] : user;
  },
);
