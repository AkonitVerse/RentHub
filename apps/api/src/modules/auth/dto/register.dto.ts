import { IsEmail, IsString, Matches, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { NormalizeName } from '../../../common/transform/normalize-name';

export class RegisterDto {
  @ApiProperty({ example: 'ivan@example.com' })
  @IsEmail({}, { message: 'Некорректный email' })
  email!: string;

  // Имя/фамилия нормализуются ДО валидаторов: триммятся и капитализируются
  // первые буквы. В БД и в письмо подтверждения попадает уже "Иван", даже если
  // юзер ввёл "иван" в обход UI-капитализации.
  @ApiProperty({ example: 'Иван' })
  @NormalizeName()
  @IsString()
  @MinLength(2, { message: 'Имя слишком короткое' })
  // Имя не должно содержать цифр. Допустимы любые буквы (включая кириллицу),
  // дефис и апостроф (Жан-Пьер, O'Connor), пробел (составные имена), точка.
  @Matches(/^[^\d]+$/u, { message: 'Имя не должно содержать цифр' })
  firstName!: string;

  @ApiProperty({ example: 'Иванов' })
  @NormalizeName()
  @IsString()
  @MinLength(2, { message: 'Фамилия слишком короткая' })
  @Matches(/^[^\d]+$/u, { message: 'Фамилия не должна содержать цифр' })
  lastName!: string;

  @ApiProperty({ example: 'qwerty123' })
  @IsString()
  @MinLength(6, { message: 'Пароль должен содержать минимум 6 символов' })
  @Matches(/^[\x21-\x7E]+$/, {
    message: 'Только английские буквы, цифры и спец-символы (без кириллицы и пробелов)',
  })
  password!: string;

  @ApiProperty({
    example: '+79234567890',
    description: 'Контактный телефон. Используется для связи карточки клиента с аккаунтом.',
  })
  @IsString()
  @Matches(/^\+7\d{10}$/, { message: 'Телефон в формате +7XXXXXXXXXX (11 цифр)' })
  phone!: string;
}
