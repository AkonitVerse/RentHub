import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PrismaService } from '../../common/prisma/prisma.service';
import { EmailTemplatesService } from './email-templates.service';
import { PreviewEmailTemplateDto, UpdateEmailTemplateDto } from './dto/email-template.dto';

/**
 * Дефолтные значения для превью шаблонов (один набор на каждый тип).
 * Используется, когда фронт не присылает свои значения.
 */
const SAMPLE_VALUES: Record<string, Record<string, unknown>> = {
  INQUIRY_RECEIVED: {
    orderNumber: 'RH-2841',
    contactName: 'Иванов Иван',
    contactPhone: '+7 (923) 456-78-90',
    contactEmail: 'ivanov@example.com',
    equipmentName: 'Перфоратор Bosch GBH 2-26',
    inquiryNote: 'Нужно на выходные, можно ли с доставкой?',
  },
  ORDER_CREATED: {
    orderNumber: 'RH-2842',
    source: 'WEB_CART',
    clientName: 'Иванов Иван',
    totalAmount: 4500,
    fromDate: '2026-05-10',
    toDate: '2026-05-15',
  },
  ORDER_STATUS_CHANGED: {
    orderNumber: 'RH-2842',
    fromStatus: 'PENDING',
    toStatus: 'CONFIRMED',
    clientName: 'Иванов Иван',
  },
  ORDER_OVERDUE: {
    orderNumber: 'RH-2842',
    clientName: 'Иванов Иван',
    toDate: '2026-05-15',
  },
  ORDER_RETURN_REMINDER: {
    orderNumber: 'RH-2842',
    clientName: 'Иванов Иван',
    toDate: '2026-05-16',
    daysLeft: 1,
  },
  ORDER_EXTENDED: {
    orderNumber: 'RH-2842',
    clientName: 'Иванов Иван',
    addedDays: 3,
    addedAmount: 1500,
    newToDate: '2026-05-19',
  },
  PASSWORD_RESET_CODE: {
    clientName: 'Иванов Иван',
    code: '482915',
    ttlMinutes: 15,
  },
  EMAIL_VERIFICATION_CODE: {
    clientName: 'Иванов Иван',
    code: '731942',
    ttlMinutes: 15,
  },
  DAILY_OPS_BRIEF: {
    date: '2026-05-10',
    pickupsCount: 3,
    returnsCount: 2,
    overdueCount: 1,
  },
};

@ApiTags('email-templates')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('email-templates')
// Шаблоны писем — это административные настройки. Менеджер не должен ни читать
// содержимое (там корпоративные тексты), ни тем более править/превьюить.
// UI и так доступен только админу, теперь и API строго ADMIN.
@Roles('ADMIN')
export class EmailTemplatesController {
  constructor(
    private readonly service: EmailTemplatesService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Список всех шаблонов писем' })
  list() {
    return this.service.list();
  }

  @Get(':eventType')
  @ApiOperation({ summary: 'Шаблон по типу события' })
  get(@Param('eventType') eventType: string) {
    return this.service.getByEventTypeOrThrow(eventType);
  }

  @Patch(':eventType')
  @ApiOperation({ summary: 'Обновить шаблон (тема / тело / включён)' })
  update(@Param('eventType') eventType: string, @Body() dto: UpdateEmailTemplateDto) {
    return this.service.update(eventType, dto);
  }

  @Post(':eventType/preview')
  @ApiOperation({ summary: 'Превью шаблона с подстановкой переменных' })
  async preview(@Param('eventType') eventType: string, @Body() dto: PreviewEmailTemplateDto) {
    // Подмешиваем brandName из OrgSettings — синхронно с email.provider, чтобы
    // превью отражало то же самое, что увидит реальный получатель.
    const orgRow = await this.prisma.orgSettings.findUnique({
      where: { id: 1 },
      select: { orgShortName: true },
    });
    const brandName = orgRow?.orgShortName?.trim() || 'RentHub';
    const values = { brandName, ...(dto.values ?? SAMPLE_VALUES[eventType] ?? {}) };
    return this.service.preview(eventType, values);
  }
}
