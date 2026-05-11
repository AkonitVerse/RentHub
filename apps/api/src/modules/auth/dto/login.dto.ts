import { IsEmail, IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'admin@renthub.com' })
  @IsEmail({}, { message: 'Некорректный email' })
  email!: string;

  @ApiProperty({ example: 'admin' })
  @IsString()
  // На логине НЕ проверяем длину пароля — это форма входа, не регистрации.
  // Если у юзера в БД пароль короче текущего минимума (например, seed-админ с
  // паролем "admin"), он всё равно должен мочь войти. Подсказка «слишком
  // короткий пароль» на форме входа — лишняя утечка инфы для атакующего.
  @IsNotEmpty({ message: 'Введите пароль' })
  password!: string;
}
