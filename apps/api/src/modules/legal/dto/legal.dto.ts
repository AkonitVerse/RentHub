import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateLegalDocumentDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  title!: string;

  @ApiProperty({ description: 'HTML-содержимое из WYSIWYG-редактора' })
  @IsString()
  @MaxLength(200_000)
  content!: string;
}
