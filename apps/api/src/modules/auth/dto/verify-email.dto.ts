import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Matches } from 'class-validator';

export class VerifyEmailDto {
  @ApiProperty({ example: 'ivan@example.com' })
  @IsEmail({}, { message: 'Некорректный email' })
  email!: string;

  /**
   * Ровно 6 цифр. На фронте input ограничен паттерном.
   * На бэке тоже валидируем — нельзя пустить пустоту или не-цифру.
   */
  @ApiProperty({ example: '482915', description: '6-значный код из письма' })
  @IsString()
  @Matches(/^\d{6}$/, { message: 'Код должен состоять из 6 цифр' })
  code!: string;
}

export class ResendVerificationDto {
  @ApiProperty({ example: 'ivan@example.com' })
  @IsEmail({}, { message: 'Некорректный email' })
  email!: string;
}
