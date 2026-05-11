import { Module } from '@nestjs/common';
import { EquipmentController } from './equipment.controller';
import { EquipmentService } from './equipment.service';
import { PricingModule } from '../pricing/pricing.module';
import { UploadsModule } from '../uploads/uploads.module';
import { CategoriesModule } from '../categories/categories.module';

@Module({
  imports: [PricingModule, UploadsModule, CategoriesModule],
  controllers: [EquipmentController],
  providers: [EquipmentService],
  exports: [EquipmentService],
})
export class EquipmentModule {}
