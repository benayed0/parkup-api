import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { StreetsService } from './streets.service';
import { CreateStreetDto } from './dto/create-street.dto';
import { UpdateStreetDto } from './dto/update-street.dto';
import { StreetType } from './schemas/street.schema';
import { OperatorJwtAuthGuard } from '../operators/guards/operator-jwt-auth.guard';
import { OperatorRole } from '../operators/schemas/operator.schema';

@Controller('streets')
export class StreetsController {
  constructor(private readonly streetsService: StreetsService) {}
  // _StreetData(
  //     id: 'street_1',
  //     type: StreetType.prohibited,
  //     points: [
  //       const LatLng(36.869394, 10.343393),
  //       const LatLng(36.867739, 10.344717),
  //     ],
  //   ),
  //   _StreetData(
  //     id: 'street_2',
  //     type: StreetType.payable,
  //     points: [
  //       const LatLng(36.869600, 10.343725),
  //       const LatLng(36.868226, 10.344816),
  //     ],
  //   ),
  //   _StreetData(
  //     id: 'street_3',
  //     type: StreetType.free,
  //     points: [
  //       const LatLng(36.869966, 10.344350),
  //       const LatLng(36.868599, 10.345378),
  //     ],
  //   ),
  @Post()
  async create(@Body() createStreetDto: CreateStreetDto) {
    const street = await this.streetsService.create(createStreetDto);
    return {
      success: true,
      data: street,
    };
  }

  @Post('bulk')
  async createBulk(@Body() createStreetDtos: CreateStreetDto[]) {
    const streets = await this.streetsService.createBulk(createStreetDtos);
    return {
      success: true,
      data: streets,
      count: streets.length,
    };
  }

  @Post('match-preview')
  @UseGuards(OperatorJwtAuthGuard)
  async matchPreview(@Body() body: { encodedPolyline: string }) {
    return this.streetsService.matchPreview(body.encodedPolyline);
  }

  @Get()
  async findAll(
    @Query('zoneId') zoneId?: string,
    @Query('type') type?: StreetType,
    @Query('leftType') leftType?: StreetType,
    @Query('rightType') rightType?: StreetType,
    @Query('isActive') isActive?: string,
    @Query('limit') limit?: string,
    @Query('skip') skip?: string,
  ) {
    const streets = await this.streetsService.findAll({
      zoneId,
      type,
      leftType,
      rightType,
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      skip: skip ? parseInt(skip, 10) : undefined,
    });
    return {
      success: true,
      data: streets,
      count: streets.length,
    };
  }

  // Admin endpoint - filtered by operator's assigned zones
  @Get('admin')
  @UseGuards(OperatorJwtAuthGuard)
  async findAllForAdmin(
    @Req() req: any,
    @Query('zoneId') zoneId?: string,
    @Query('type') type?: StreetType,
    @Query('leftType') leftType?: StreetType,
    @Query('rightType') rightType?: StreetType,
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

    const streets = await this.streetsService.findAll({
      zoneId: zoneIds ? undefined : zoneId,
      zoneIds,
      type,
      leftType,
      rightType,
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      skip: skip ? parseInt(skip, 10) : undefined,
    });
    return {
      success: true,
      data: streets,
      count: streets.length,
    };
  }

  @Get('zone/:zoneId')
  async findByZone(@Param('zoneId') zoneId: string) {
    const streets = await this.streetsService.findByZone(zoneId);
    return {
      success: true,
      data: streets,
      count: streets.length,
    };
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const street = await this.streetsService.findOne(id);
    return {
      success: true,
      data: street,
    };
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateStreetDto: UpdateStreetDto,
  ) {
    const street = await this.streetsService.update(id, updateStreetDto);
    return {
      success: true,
      data: street,
    };
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.streetsService.remove(id);
    return {
      success: true,
      data: null,
    };
  }

  @Delete('zone/:zoneId')
  async removeByZone(@Param('zoneId') zoneId: string) {
    const deletedCount = await this.streetsService.removeByZone(zoneId);
    return {
      success: true,
      data: { deletedCount },
    };
  }
}
