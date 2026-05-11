import { Module } from '@nestjs/common';
import { ClientsController } from './clients.controller';
import { ClientsService } from './clients.service';
import { ClientLinkingService } from './client-linking.service';

@Module({
  controllers: [ClientsController],
  providers: [ClientsService, ClientLinkingService],
  exports: [ClientsService, ClientLinkingService],
})
export class ClientsModule {}
