import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { NormalizeName } from '../../../common/transform/normalize-name';

export class UpdateProfileDto {
  // Имя/фамилия нормализуются (trim + капитализация) до валидаторов — данные
  // в БД хранятся в каноническом виде вне зависимости от того, как ввёл юзер.
  @ApiPropertyOptional()
  @IsOptional()
  @NormalizeName()
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  // Цифры в имени запрещены — синхронно с register.dto.ts.
  @Matches(/^[^\d]+$/u, { message: 'Имя не должно содержать цифр' })
  firstName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @NormalizeName()
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  @Matches(/^[^\d]+$/u, { message: 'Фамилия не должна содержать цифр' })
  lastName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  @MaxLength(160)
  email?: string;

  @ApiPropertyOptional({ example: '+79234567890' })
  @IsOptional()
  @IsString()
  @Matches(/^\+7\d{10}$/, { message: 'Телефон в формате +7XXXXXXXXXX (11 цифр)' })
  phone?: string;
}

export class ChangePasswordDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  currentPassword!: string;

  @ApiProperty()
  @IsString()
  @MinLength(6, { message: 'Пароль должен быть не короче 6 символов' })
  @MaxLength(200)
  // Те же правила что в register.dto.ts password — латиница/цифры/спец-символы,
  // БЕЗ пробелов и кириллицы. Хеш bcrypt не различает пробелы трейлинговые,
  // что приводит к UX-сюрпризам, поэтому пробелы запрещены явно.
  @Matches(/^[\x21-\x7E]+$/, {
    message: 'Только английские буквы, цифры и спец-символы (без кириллицы и пробелов)',
  })
  newPassword!: string;
}
