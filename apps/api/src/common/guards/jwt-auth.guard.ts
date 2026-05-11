import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      // На публичных эндпоинтах не требуем авторизации, но если JWT-cookie всё-таки
      // прислана (юзер залогинен) — разбираем её и кладём user в request, чтобы
      // эндпоинт мог опционально его использовать (например, привязать заказ к юзеру).
      try {
        await (super.canActivate(context) as Promise<boolean>);
      } catch {
        // токен отсутствует или просрочен — это нормально для публичного эндпоинта
      }
      return true;
    }
    return (await (super.canActivate(context) as Promise<boolean>)) === true;
  }

  // Для @Public() endpoint-ов passport бросает 401 если токена нет — перехватываем
  // и не считаем это ошибкой, чтобы публичный поток не ломался.
  handleRequest<TUser = unknown>(
    err: unknown,
    user: TUser,
    _info: unknown,
    context: ExecutionContext,
  ): TUser {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return user as TUser; // может быть undefined, это ок
    }
    if (err || !user) {
      // Возвращаем 401 (UnauthorizedException), а не голый Error — иначе клиент
      // получает 500 вместо корректного 401 и не может правильно обработать
      // (например, перенаправить на /login).
      if (err instanceof Error) throw err;
      throw new UnauthorizedException('Не авторизован');
    }
    return user;
  }
}
