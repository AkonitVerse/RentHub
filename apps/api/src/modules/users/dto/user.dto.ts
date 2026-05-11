import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsOptional, IsString, Matches, MinLength } from 'class-validator';
import { UserRole } from '@prisma/client';
import { NormalizeName } from '../../../common/transform/normalize-name';

const PHONE_REGEX = /^\+7\d{10}$/;
const PHONE_MESSAGE = 'Телефон в формате +7XXXXXXXXXX (11 цифр)';

export class CreateUserDto {
  @ApiProperty()
  @IsEmail()
  email!: string;

  // Имя/фамилия нормализуются (trim + капитализация) до валидаторов — то же
  // правило что в register.dto.ts / me.dto.ts.
  @ApiProperty()
  @NormalizeName()
  @IsString()
  @MinLength(2)
  @Matches(/^[^\d]+$/u, { message: 'Имя не должно содержать цифр' })
  firstName!: string;

  @ApiProperty()
  @NormalizeName()
  @IsString()
  @MinLength(2)
  @Matches(/^[^\d]+$/u, { message: 'Фамилия не должна содержать цифр' })
  lastName!: string;

  @ApiProperty({ example: '+79991234567' })
  @IsString()
  @Matches(PHONE_REGEX, { message: PHONE_MESSAGE })
  phone!: string;

  @ApiProperty()
  @IsString()
  @MinLength(6, { message: 'Пароль должен быть не короче 6 символов' })
  // Латиница/цифры/спец-символы без пробелов и кириллицы — синхронно с
  // регистрацией и формой смены пароля в ЛК.
  @Matches(/^[\x21-\x7E]+$/, {
    message: 'Только английские буквы, цифры и спец-символы (без кириллицы и пробелов)',
  })
  password!: string;

  @ApiProperty({ enum: UserRole })
  @IsEnum(UserRole)
  role!: UserRole;
}

export class UpdateUserDto {
  @ApiPropertyOptional()
  @IsOptional()
  @NormalizeName()
  @IsString()
  @MinLength(2)
  @Matches(/^[^\d]+$/u, { message: 'Имя не должно содержать цифр' })
  firstName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @NormalizeName()
  @IsString()
  @MinLength(2)
  @Matches(/^[^\d]+$/u, { message: 'Фамилия не должна содержать цифр' })
  lastName?: string;

  @ApiPropertyOptional({ example: '+79991234567' })
  @IsOptional()
  @IsString()
  @Matches(PHONE_REGEX, { message: PHONE_MESSAGE })
  phone?: string;

  @ApiPropertyOptional({ enum: UserRole })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @ApiPropertyOptional({ description: 'Если задан — сменит пароль' })
  @IsOptional()
  @IsString()
  @MinLength(6, { message: 'Пароль должен быть не короче 6 символов' })
  @Matches(/^[\x21-\x7E]+$/, {
    message: 'Только английские буквы, цифры и спец-символы (без кириллицы и пробелов)',
  })
  password?: string;
}
