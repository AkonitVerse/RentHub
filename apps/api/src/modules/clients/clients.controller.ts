import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ClientsService } from './clients.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { CreateClientDto, ListClientsDto, UpdateClientDto } from './dto/client.dto';

@ApiTags('Клиенты')
@Controller('clients')
export class ClientsController {
  constructor(private readonly service: ClientsService) {}

  @Roles('ADMIN', 'MANAGER')
  @Get()
  list(@Query() query: ListClientsDto) {
    return this.service.list(query);
  }

  @Roles('ADMIN', 'MANAGER')
  @Get(':id')
  byId(@Param('id', ParseIntPipe) id: number) {
    return this.service.getById(id);
  }

  @Roles('ADMIN', 'MANAGER')
  @Post()
  create(@Body() dto: CreateClientDto) {
    return this.service.create(dto);
  }

  @Roles('ADMIN', 'MANAGER')
  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateClientDto) {
    return this.service.update(id, dto);
  }

  @Roles('ADMIN')
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
