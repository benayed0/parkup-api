import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { VehiclesService } from './vehicles.service';
import { CheckVehicleDto } from './dto/check-vehicle.dto';
import { CombinedJwtAuthGuard } from '../shared/auth/combined-jwt-auth.guard';

@Controller('vehicles')
export class VehiclesController {
  constructor(private readonly vehiclesService: VehiclesService) {}

  /**
   * Check vehicle status: active parking session + current-year badge (Agent or Operator)
   * POST /vehicles/check
   */
  @Post('check')
  @UseGuards(CombinedJwtAuthGuard)
  async checkVehicle(@Body() dto: CheckVehicleDto) {
    const result = await this.vehiclesService.checkVehicle(dto);
    return { success: true, data: result };
  }
}
