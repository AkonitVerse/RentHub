import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { CartController } from './cart.controller';
import { CartService } from './cart.service';
import { CartStoreService } from './cart-store.service';
import { CartSessionMiddleware } from './cart-session.middleware';
import { PricingModule } from '../pricing/pricing.module';
import { ClientsModule } from '../clients/clients.module';

@Module({
  imports: [PricingModule, ClientsModule],
  controllers: [CartController],
  providers: [CartService, CartStoreService],
  exports: [CartService],
})
export class CartModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CartSessionMiddleware).forRoutes(CartController);
  }
}
