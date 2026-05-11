import { Module } from '@nestjs/common';
import { PricingService } from './pricing.service';
import { TiersService } from './tiers.service';
import { TiersController } from './tiers.controller';

@Module({
  controllers: [TiersController],
  providers: [PricingService, TiersService],
  exports: [PricingService, TiersService],
})
export class PricingModule {}
