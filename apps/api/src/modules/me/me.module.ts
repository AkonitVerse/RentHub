import { Module } from '@nestjs/common';
import { OrdersModule } from '../orders/orders.module';
import { MeController } from './me.controller';
import { MeService } from './me.service';

@Module({
  imports: [OrdersModule],
  controllers: [MeController],
  providers: [MeService],
})
export class MeModule {}
