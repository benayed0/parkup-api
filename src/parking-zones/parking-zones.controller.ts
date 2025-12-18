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
} from '@nestjs/common';
import { ParkingZonesService } from './parking-zones.service';
import { CreateParkingZoneDto, UpdateParkingZoneDto } from './dto';

@Controller('parking-zones')
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
