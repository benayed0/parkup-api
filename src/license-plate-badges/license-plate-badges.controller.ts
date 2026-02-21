import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { LicensePlateBadgesService } from './license-plate-badges.service';
import { CreateBadgeDto } from './dto/create-badge.dto';
import { BadgeStatus } from './schemas/license-plate-badge.schema';
import { AgentJwtAuthGuard } from '../agents/guards/agent-jwt-auth.guard';
import { CombinedJwtAuthGuard } from '../shared/auth/combined-jwt-auth.guard';

@Controller('license-plate-badges')
export class LicensePlateBadgesController {
  constructor(
    private readonly licensePlateBadgesService: LicensePlateBadgesService,
  ) {}

  /**
   * Create a badge for a license plate (Agent only)
   * POST /license-plate-badges
   */
  @Post()
  @UseGuards(AgentJwtAuthGuard)
  async create(@Body() dto: CreateBadgeDto, @Req() req: Request) {
    const agent = req.user as any;
    const badge = await this.licensePlateBadgesService.create(
      agent._id.toString(),
      dto,
    );
    return { success: true, data: badge };
  }

  /**
   * List badges with optional filters (Agent or Operator)
   * GET /license-plate-badges?licensePlate=&zoneId=&year=&status=&limit=&skip=
   */
  @Get()
  @UseGuards(CombinedJwtAuthGuard)
  async findAll(
    @Query('licensePlate') licensePlate?: string,
    @Query('zoneId') zoneId?: string,
    @Query('year') year?: string,
    @Query('status') status?: BadgeStatus,
    @Query('limit') limit?: string,
    @Query('skip') skip?: string,
  ) {
    const badges = await this.licensePlateBadgesService.findAll({
      licensePlate,
      zoneId,
      year: year ? parseInt(year, 10) : undefined,
      status,
      limit: limit ? parseInt(limit, 10) : undefined,
      skip: skip ? parseInt(skip, 10) : undefined,
    });
    return { success: true, data: badges, count: badges.length };
  }

  /**
   * Get badge for a plate (defaults to current year) (Agent or Operator)
   * GET /license-plate-badges/plate/:licensePlate?year=2026
   */
  @Get('plate/:licensePlate')
  @UseGuards(CombinedJwtAuthGuard)
  async findByPlate(
    @Param('licensePlate') licensePlate: string,
    @Query('year') year?: string,
  ) {
    const badge = await this.licensePlateBadgesService.findByPlate(
      licensePlate,
      year ? parseInt(year, 10) : undefined,
    );
    return { success: true, data: badge };
  }

  /**
   * Soft-invalidate a badge (Agent only)
   * PATCH /license-plate-badges/:id/invalidate
   */
  @Patch(':id/invalidate')
  @UseGuards(AgentJwtAuthGuard)
  async invalidate(@Param('id') id: string, @Req() req: Request) {
    const agent = req.user as any;
    const badge = await this.licensePlateBadgesService.invalidate(
      id,
      agent._id.toString(),
    );
    return { success: true, data: badge };
  }
}
