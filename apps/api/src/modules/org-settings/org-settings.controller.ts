import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { logoMulterOptions } from '../uploads/multer.options';
import { UpdateOrgSettingsDto } from './dto/org-settings.dto';
import { OrgSettingsService } from './org-settings.service';

class SendTestEmailDto {
  @IsEmail()
  to!: string;
}

@ApiTags('org-settings')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('org-settings')
export class OrgSettingsController {
  constructor(private readonly service: OrgSettingsService) {}

  // ADMIN-only: содержит SMTP-конфиг (хост, пользователя, флаг наличия пароля),
  // расписание cron-задач, email менеджеров. Раньше принимало MANAGER —
  // менеджер мог через прямой curl увидеть SMTP-настройки.
  // Публичные контакты для витрины (название, телефон, адрес) отдаются через
  // `/org-settings/contact` — отдельный @Public() endpoint без секретов.
  @Roles('ADMIN')
  @Get()
  @ApiOperation({ summary: 'Текущие настройки организации (расписание cron и т.п.)' })
  get() {
    return this.service.getPublic();
  }

  @Public()
  @Get('contact')
  @ApiOperation({
    summary: 'Публичные контактные реквизиты для витрины (название, телефон, email, адрес).',
  })
  contact() {
    return this.service.getContact();
  }

  @Public()
  @Get('rental-terms')
  @ApiOperation({
    summary: 'Контент страницы «Условия аренды» для витрины.',
  })
  rentalTerms() {
    return this.service.getRentalTerms();
  }

  @Roles('ADMIN')
  @Patch()
  @ApiOperation({ summary: 'Обновить настройки. Cron-задачи перерегистрируются автоматически.' })
  update(@Body() dto: UpdateOrgSettingsDto) {
    return this.service.update(dto);
  }

  @Roles('ADMIN')
  @Post('test-email')
  @ApiOperation({ summary: 'Отправить тестовое письмо для проверки SMTP-настроек.' })
  async testEmail(@Body() dto: SendTestEmailDto) {
    try {
      return await this.service.sendTestEmail(dto.to);
    } catch (err) {
      throw new BadRequestException(`Не удалось отправить: ${(err as Error).message}`);
    }
  }

  @Roles('ADMIN')
  @Post('logo')
  @ApiOperation({
    summary: 'Загрузить кастомный логотип. Заменяет встроенный SVG-логотип платформы.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @UseInterceptors(FileInterceptor('file', logoMulterOptions))
  uploadLogo(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Файл не передан');
    // Формат пути совпадает с equipment.controller.uploadPhoto — `/uploads/...`
    // от корня сайта. Vite proxy в dev и Nest ServeStatic в проде раздают его
    // напрямую без преобразования на фронте.
    const url = `/uploads/logos/${file.filename}`;
    return this.service.setLogo(url);
  }

  @Roles('ADMIN')
  @Delete('logo')
  @ApiOperation({ summary: 'Сбросить логотип на встроенный по умолчанию.' })
  removeLogo() {
    return this.service.clearLogo();
  }
}
