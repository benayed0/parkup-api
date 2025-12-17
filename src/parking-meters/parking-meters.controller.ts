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
import { ParkingMetersService } from './parking-meters.service';
import { CreateParkingMeterDto, UpdateParkingMeterDto } from './dto';

@Controller('meters')
export class ParkingMetersController {
  constructor(private readonly parkingMetersService: ParkingMetersService) {}

  @Post()
  async create(@Body() createDto: CreateParkingMeterDto) {
    const meter = await this.parkingMetersService.create(createDto);
    return {
      success: true,
      data: meter,
    };
  }

  @Get()
  async findAll(
    @Query('latitude') latitude?: string,
    @Query('longitude') longitude?: string,
    @Query('radius') radius?: string,
    @Query('isActive') isActive?: string,
    @Query('limit') limit?: string,
    @Query('skip') skip?: string,
  ) {
    // If coordinates provided, do nearby search
    if (latitude && longitude) {
      const meters = await this.parkingMetersService.findNearby(
        parseFloat(longitude),
        parseFloat(latitude),
        radius ? parseInt(radius, 10) : 5000,
        limit ? parseInt(limit, 10) : 50,
      );
      return {
        success: true,
        data: meters,
        count: meters.length,
      };
    }

    // Otherwise, return all meters with filters
    const meters = await this.parkingMetersService.findAll({
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      skip: skip ? parseInt(skip, 10) : undefined,
    });
    return {
      success: true,
      data: meters,
      count: meters.length,
    };
  }

  @Get('zone/:zoneId')
  async findByZone(@Param('zoneId') zoneId: string) {
    const meters = await this.parkingMetersService.findByZone(zoneId);
    return {
      success: true,
      data: meters,
      count: meters.length,
    };
  }

  @Get('code/:parkingCode')
  async findByParkingCode(@Param('parkingCode') parkingCode: string) {
    const meter = await this.parkingMetersService.findByParkingCode(parkingCode);
    return {
      success: true,
      data: meter,
    };
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const meter = await this.parkingMetersService.findOne(id);
    return {
      success: true,
      data: meter,
    };
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() updateDto: UpdateParkingMeterDto,
  ) {
    const meter = await this.parkingMetersService.update(id, updateDto);
    return {
      success: true,
      data: meter,
    };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string) {
    await this.parkingMetersService.remove(id);
  }
}
