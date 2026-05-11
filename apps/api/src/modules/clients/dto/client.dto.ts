import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ClientType } from '@prisma/client';
import { NormalizeName } from '../../../common/transform/normalize-name';
import { IsValidInn } from '../../../common/validators/inn.validator';

/** Канонический формат телефона: +7XXXXXXXXXX (11 цифр после +). */
const PHONE_REGEX = /^\+7\d{10}$/;
const PHONE_MESSAGE = 'Телефон в формате +7XXXXXXXXXX (11 цифр)';

export class ListClientsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: ClientType })
  @IsOptional()
  @IsEnum(ClientType)
  clientType?: ClientType;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ default: 25 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit = 25;
}

export class CreateClientDto {
  @ApiPropertyOptional({ enum: ClientType, default: ClientType.INDIVIDUAL })
  @IsOptional()
  @IsEnum(ClientType)
  clientType?: ClientType;

  // Имя клиента (для физлиц «Иван Иванов», для юрлиц — название организации).
  // Запрет цифр — только для физлиц; у компаний допустимо (напр. «Строй-2000»).
  @ApiProperty()
  @NormalizeName()
  @IsString()
  @MinLength(2)
  @ValidateIf((o) => o.clientType !== ClientType.COMPANY)
  @Matches(/^[^\d]+$/u, { message: 'Имя не должно содержать цифр' })
  name!: string;

  @ApiProperty({ example: '+79234567890' })
  @IsString()
  @Matches(PHONE_REGEX, { message: PHONE_MESSAGE })
  phone!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  // === Реквизиты юрлица (актуальны только при clientType = COMPANY) ===

  @ApiPropertyOptional({ description: 'ИНН: 10 цифр (юрлицо) или 12 цифр (ИП)' })
  @ValidateIf((o) => o.clientType === ClientType.COMPANY)
  @IsNotEmpty({ message: 'ИНН обязателен для юрлица' })
  @Matches(/^\d{10}$|^\d{12}$/, { message: 'ИНН: 10 цифр (юрлицо) или 12 цифр (ИП)' })
  @IsValidInn()
  inn?: string;

  @ApiPropertyOptional({ description: 'КПП: 9 цифр' })
  @IsOptional()
  @ValidateIf((o) => o.inn && o.inn.length === 10)
  @Matches(/^\d{9}$/, { message: 'КПП: 9 цифр' })
  kpp?: string;

  @ApiPropertyOptional({ description: 'ОГРН (13 цифр) или ОГРНИП (15 цифр)' })
  @IsOptional()
  @Matches(/^\d{13}$|^\d{15}$/, { message: 'ОГРН: 13 цифр (юрлицо) или 15 цифр (ИП)' })
  ogrn?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  legalAddress?: string;

  @ApiPropertyOptional({ description: 'ФИО контактного лица' })
  @ValidateIf((o) => o.clientType === ClientType.COMPANY)
  @IsNotEmpty({ message: 'Укажите контактное лицо' })
  @IsString()
  contactPerson?: string;

  @ApiPropertyOptional({ description: 'Должность контактного лица' })
  @IsOptional()
  @IsString()
  contactPosition?: string;

  @ApiPropertyOptional({ description: 'Телефон контактного лица' })
  @IsOptional()
  @Matches(PHONE_REGEX, { message: PHONE_MESSAGE })
  contactPhone?: string;

  @ApiPropertyOptional({ description: 'Расчётный счёт (20 цифр)' })
  @IsOptional()
  @Matches(/^\d{20}$/, { message: 'Расчётный счёт: 20 цифр' })
  bankAccount?: string;

  @ApiPropertyOptional({ description: 'БИК банка (9 цифр)' })
  @IsOptional()
  @Matches(/^\d{9}$/, { message: 'БИК: 9 цифр' })
  bankBik?: string;

  @ApiPropertyOptional({ description: 'Наименование банка' })
  @IsOptional()
  @IsString()
  bankName?: string;
}

export class UpdateClientDto extends PartialType(CreateClientDto) {}
