import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class ForgotPasswordDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail({}, { message: 'Некорректный email' })
  email!: string;
}

export class VerifyResetCodeDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: '123456', description: '6-значный код из письма' })
  @IsString()
  @Matches(/^\d{6}$/, { message: 'Код — 6 цифр' })
  code!: string;
}

export class ResetPasswordDto {
  @ApiProperty()
  @IsEmail()
  email!: string;

  // Код опциональный: если SMTP не настроен на платформе (см.
  // isEmailVerificationEnabled), backend пропускает проверку кода и просто
  // меняет пароль по email. Фронт в этом случае шлёт пустую строку или не
  // шлёт поле вовсе.
  @ApiPropertyOptional({ example: '123456', description: '6 цифр; не нужен если SMTP не настроен' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{6}$|^$/, { message: 'Код — 6 цифр или пусто' })
  code?: string;

  @ApiProperty()
  @IsString()
  @MinLength(6, { message: 'Пароль должен быть не короче 6 символов' })
  @MaxLength(200)
  newPassword!: string;
}
