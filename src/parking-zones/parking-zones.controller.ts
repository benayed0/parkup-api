import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ParkingZonesService } from './parking-zones.service';
import { CreateParkingZoneDto, UpdateParkingZoneDto } from './dto';
import { OperatorJwtAuthGuard } from '../operators/guards/operator-jwt-auth.guard';
import { OperatorRole } from '../operators/schemas/operator.schema';

@Controller('zones')
export class ParkingZonesController {
  constructor(private readonly parkingZonesService: ParkingZonesService) {}

  @Post()
  async create(@Body() createDto: CreateParkingZoneDto) {
    const zone = await this.parkingZonesService.create(createDto);
    return {
      success: true,
      data: zone,
    };
  }

  @Get()
  async findAll(
    @Query('isActive') isActive?: string,
    @Query('limit') limit?: string,
    @Query('skip') skip?: string,
  ) {
    const zones = await this.parkingZonesService.findAll({
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      skip: skip ? parseInt(skip, 10) : undefined,
    });
    return {
      success: true,
      data: zones,
      count: zones.length,
    };
  }

  // Admin endpoint - filtered by operator's assigned zones
  @Get('admin')
  @UseGuards(OperatorJwtAuthGuard)
  async findAllForAdmin(
    @Req() req: any,
    @Query('isActive') isActive?: string,
    @Query('limit') limit?: string,
    @Query('skip') skip?: string,
  ) {
    const operator = req.user;

    // For non-super_admin, filter by their assigned zones
    let zoneIds: string[] | undefined;
    if (operator.role !== OperatorRole.SUPER_ADMIN) {
      // Get zone IDs from the operator (may be populated or just IDs)
      zoneIds = (operator.zoneIds || []).map((zone: any) => {
        if (typeof zone === 'object' && zone._id) {
          return zone._id.toString();
        }
        return zone.toString();
      });

      // If operator has no zones assigned, return empty result
      if (zoneIds.length === 0) {
        return {
          success: true,
          data: [],
          count: 0,
        };
      }
    }

    const zones = await this.parkingZonesService.findAll({
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
      zoneIds,
      limit: limit ? parseInt(limit, 10) : undefined,
      skip: skip ? parseInt(skip, 10) : undefined,
    });
    return {
      success: true,
      data: zones,
      count: zones.length,
    };
  }

  @Get('code/:code')
  async findByCode(@Param('code') code: string) {
    const zone = await this.parkingZonesService.findByCode(code);
    return {
      success: true,
      data: zone,
    };
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const zone = await this.parkingZonesService.findOne(id);
    return {
      success: true,
      data: zone,
    };
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() updateDto: UpdateParkingZoneDto,
  ) {
    const zone = await this.parkingZonesService.update(id, updateDto);
    return {
      success: true,
      data: zone,
    };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string) {
    await this.parkingZonesService.remove(id);
  }
}
