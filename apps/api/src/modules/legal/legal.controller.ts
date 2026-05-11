import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { LegalService } from './legal.service';
import { UpdateLegalDocumentDto } from './dto/legal.dto';

@ApiTags('legal')
@Controller('legal')
export class LegalController {
  constructor(private readonly service: LegalService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Список юридических документов (метаданные)' })
  list() {
    return this.service.list();
  }

  @Public()
  @Get(':slug')
  @ApiOperation({ summary: 'Получить документ по slug (terms / personal-data / privacy)' })
  getOne(@Param('slug') slug: string) {
    return this.service.getBySlug(slug);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Patch(':slug')
  @ApiOperation({ summary: 'Обновить документ (только ADMIN)' })
  update(@Param('slug') slug: string, @Body() dto: UpdateLegalDocumentDto) {
    return this.service.update(slug, dto);
  }
}
