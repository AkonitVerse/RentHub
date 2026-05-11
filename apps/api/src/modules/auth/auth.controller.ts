import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { AuthService, AuthTokens } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ForgotPasswordDto, ResetPasswordDto, VerifyResetCodeDto } from './dto/password-reset.dto';
import { VerifyEmailDto, ResendVerificationDto } from './dto/verify-email.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { JwtRefreshGuard } from '../../common/guards/jwt-refresh.guard';
import { CurrentUser, JwtUserPayload } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { RefreshPayload } from './strategies/jwt-refresh.strategy';

@ApiTags('Авторизация')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @Throttle({ auth: { limit: 5, ttl: 60_000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Вход в систему' })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ id: number; email: string; name: string; role: string }> {
    const { user, tokens } = await this.auth.login(dto.email, dto.password);
    this.setAuthCookies(res, tokens);
    return { id: user.id, email: user.email, name: user.name, role: user.role };
  }

  @Public()
  @Throttle({ auth: { limit: 3, ttl: 3_600_000 } })
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Регистрация — создаёт pending-запись и шлёт код подтверждения на email',
    description:
      'Реальный User в БД НЕ создаётся до подтверждения кода через /verify-email. ' +
      'Возвращает {requiresVerification: true, email}.',
  })
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<
    | { requiresVerification: true; email: string }
    | { requiresVerification: false; id: number; email: string; name: string; role: string }
  > {
    const result = await this.auth.register(dto.email, dto.firstName, dto.lastName, dto.password, {
      phone: dto.phone,
    });

    // Если SMTP настроен → требуется ввод кода подтверждения. Фронт ведёт
    // юзера на /verify-email.
    if (result.requiresVerification) {
      return { requiresVerification: true, email: result.email };
    }

    // SMTP не настроен → User создан сразу, выдаём cookies и логиним.
    // Фронт по requiresVerification:false делает редирект на landing-страницу.
    this.setAuthCookies(res, result.tokens);
    return {
      requiresVerification: false,
      id: result.user.id,
      email: result.user.email,
      name: result.user.name,
      role: result.user.role,
    };
  }

  // Per-endpoint @Throttle тут не нужен: код имеет TTL 15 мин и max 5 попыток
  // на pending — bruteforce и так бесполезен. Глобальный auth-throttle ловит
  // общий флуд. Лишний слой только мешал бы реальному юзеру.
  @Public()
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Подтверждение email кодом из письма — создаёт User и логинит',
  })
  async verifyEmail(
    @Body() dto: VerifyEmailDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ id: number; email: string; name: string; role: string }> {
    const { user, tokens } = await this.auth.verifyEmail(dto.email, dto.code);
    this.setAuthCookies(res, tokens);
    return { id: user.id, email: user.email, name: user.name, role: user.role };
  }

  // Cooldown 60 сек уже зашит в сервисе через lastIssuedAt — этого достаточно,
  // чтобы не дать спамить письмами на один pending.
  @Public()
  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Переотправка кода подтверждения email (cooldown 60 сек на pending в сервисе)',
  })
  async resendVerification(@Body() dto: ResendVerificationDto): Promise<{ ok: true }> {
    await this.auth.resendVerification(dto.email);
    return { ok: true };
  }

  @Public()
  @UseGuards(JwtRefreshGuard)
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Обновление пары токенов' })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ ok: true }> {
    const payload = req.user as RefreshPayload & { token: string };
    const tokens = await this.auth.refresh(payload, payload.token);
    this.setAuthCookies(res, tokens);
    return { ok: true };
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Выход из системы' })
  async logout(
    @CurrentUser() user: JwtUserPayload,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ ok: true }> {
    await this.auth.logout(user.sub);
    this.clearAuthCookies(res);
    return { ok: true };
  }

  @SkipThrottle()
  @UseGuards(JwtAuthGuard)
  @Get('me')
  @ApiOperation({ summary: 'Информация о текущем пользователе' })
  async me(@CurrentUser() user: JwtUserPayload) {
    return this.auth.me(user.sub);
  }

  @Public()
  @Throttle({ auth: { limit: 3, ttl: 3_600_000 } })
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Запрос кода восстановления пароля (отправка на email)',
    description:
      'Всегда возвращает ok. Если пользователь существует, отправляет 6-значный код на указанный email (TTL 15 мин, rate-limit 1/мин).',
  })
  async forgotPassword(@Body() dto: ForgotPasswordDto): Promise<{ ok: true }> {
    await this.auth.forgotPassword(dto.email);
    return { ok: true };
  }

  // verify-reset-code и reset-password защищены тем же кодом с TTL и max
  // attempts — per-endpoint throttle тут лишний.
  @Public()
  @Post('verify-reset-code')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Проверка кода без сброса пароля' })
  async verifyResetCode(@Body() dto: VerifyResetCodeDto): Promise<{ ok: true }> {
    return this.auth.verifyResetCode(dto.email, dto.code);
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Установить новый пароль по коду' })
  async resetPassword(@Body() dto: ResetPasswordDto): Promise<{ ok: true }> {
    return this.auth.resetPassword(dto.email, dto.code ?? '', dto.newPassword);
  }

  private setAuthCookies(res: Response, tokens: AuthTokens): void {
    const secure = this.config.get<string>('COOKIE_SECURE') === 'true';
    const accessTtlMs = Number(this.config.get<number>('JWT_ACCESS_TTL', 900)) * 1000;
    const refreshTtlMs = Number(this.config.get<number>('JWT_REFRESH_TTL', 604_800)) * 1000;
    const domain = this.config.get<string>('COOKIE_DOMAIN') || undefined;

    res.cookie('access_token', tokens.accessToken, {
      httpOnly: true,
      secure,
      sameSite: 'strict',
      maxAge: accessTtlMs,
      domain,
      path: '/',
    });
    res.cookie('refresh_token', tokens.refreshToken, {
      httpOnly: true,
      secure,
      sameSite: 'strict',
      maxAge: refreshTtlMs,
      domain,
      path: '/api/v1/auth',
    });
  }

  private clearAuthCookies(res: Response): void {
    res.clearCookie('access_token', { path: '/' });
    res.clearCookie('refresh_token', { path: '/api/v1/auth' });
  }
}
