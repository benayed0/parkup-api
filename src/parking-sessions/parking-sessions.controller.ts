import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ParkingSessionsService } from './parking-sessions.service';
import {
  CreateParkingSessionDto,
  UpdateParkingSessionDto,
  ExtendParkingSessionDto,
  CheckVehicleDto,
} from './dto';
import { ParkingSessionStatus } from './schemas/parking-session.schema';

@Controller('parking-sessions')
export class ParkingSessionsController {
  constructor(
    private readonly parkingSessionsService: ParkingSessionsService,
  ) {}

  /**
   * Create a new parking session
   * POST /parking-sessions
   */
  @Post()
  async create(@Body() createDto: CreateParkingSessionDto) {
    const session = await this.parkingSessionsService.create(createDto);
    return {
      success: true,
      data: session,
    };
  }

  /**
   * Get all sessions (with optional filters)
   * GET /parking-sessions?userId=xxx&status=active&limit=10
   */
  @Get()
  async findAll(
    @Query('userId') userId?: string,
    @Query('status') status?: ParkingSessionStatus,
    @Query('licensePlate') licensePlate?: string,
    @Query('limit') limit?: string,
    @Query('skip') skip?: string,
  ) {
    const sessions = await this.parkingSessionsService.findAll({
      userId,
      status,
      licensePlate,
      limit: limit ? parseInt(limit, 10) : undefined,
      skip: skip ? parseInt(skip, 10) : undefined,
    });
    return {
      success: true,
      data: sessions,
      count: sessions.length,
    };
  }

  /**
   * Get active sessions by zone
   * GET /parking-sessions/zone/:zoneId/active
   */
  @Get('zone/:zoneId/active')
  async findActiveByZone(
    @Param('zoneId') zoneId: string,
    @Query('limit') limit?: string,
    @Query('skip') skip?: string,
  ) {
    const sessions = await this.parkingSessionsService.findAll({
      zoneId,
      status: ParkingSessionStatus.ACTIVE,
      limit: limit ? parseInt(limit, 10) : undefined,
      skip: skip ? parseInt(skip, 10) : undefined,
    });
    return {
      success: true,
      data: sessions,
      count: sessions.length,
    };
  }

  /**
   * Get enforcement data for agents
   * Returns expired sessions (violations) and soon-to-expire sessions
   * By default, excludes expired sessions that already have tickets
   * GET /parking-sessions/agent/enforcement?zoneId=xxx&expiringThresholdMinutes=15&includeTicketed=true
   */
  @Get('agent/enforcement')
  async getEnforcementData(
    @Query('zoneId') zoneId?: string,
    @Query('expiringThresholdMinutes') expiringThresholdMinutes?: string,
    @Query('maxExpiredHours') maxExpiredHours?: string,
    @Query('limit') limit?: string,
    @Query('includeTicketed') includeTicketed?: string,
  ) {
    const data = await this.parkingSessionsService.getEnforcementData({
      zoneId,
      expiringThresholdMinutes: expiringThresholdMinutes
        ? parseInt(expiringThresholdMinutes, 10)
        : undefined,
      maxExpiredHours: maxExpiredHours
        ? parseFloat(maxExpiredHours)
        : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      includeTicketed: includeTicketed === 'true',
    });

    return {
      success: true,
      data,
      summary: data.summary,
    };
  }

  /**
   * Get user's active session
   * GET /parking-sessions/user/:userId/active
   */
  @Get('user/:userId/active')
  async findActiveByUser(@Param('userId') userId: string) {
    const session =
      await this.parkingSessionsService.findActiveByUserId(userId);
    return {
      success: true,
      data: session,
    };
  }

  /**
   * Get user's parking history
   * GET /parking-sessions/user/:userId/history?limit=20&skip=0
   */
  @Get('user/:userId/history')
  async getHistory(
    @Param('userId') userId: string,
    @Query('limit') limit?: string,
    @Query('skip') skip?: string,
  ) {
    const sessions = await this.parkingSessionsService.getHistory(
      userId,
      limit ? parseInt(limit, 10) : 20,
      skip ? parseInt(skip, 10) : 0,
    );
    return {
      success: true,
      data: sessions,
      count: sessions.length,
    };
  }

  /**
   * Get user's all sessions
   * GET /parking-sessions/user/:userId
   */
  @Get('user/:userId')
  async findByUser(
    @Param('userId') userId: string,
    @Query('status') status?: ParkingSessionStatus,
    @Query('limit') limit?: string,
  ) {
    const sessions = await this.parkingSessionsService.findByUserId(userId, {
      status,
      limit: limit ? parseInt(limit, 10) : undefined,
    });

    return {
      success: true,
      data: sessions,
      count: sessions.length,
    };
  }

  /**
   * Check vehicle by structured license plate (POST with JSON body)
   * POST /parking-sessions/check-vehicle
   */
  @Post('check-vehicle')
  async checkVehicle(@Body() checkDto: CheckVehicleDto) {
    const sessions = await this.parkingSessionsService.findActiveByPlate(
      checkDto.plate,
      checkDto.zoneId,
    );
    return {
      success: true,
      data: sessions,
      count: sessions.length,
    };
  }

  /**
   * Get active sessions by license plate (legacy - uses URL param)
   * GET /parking-sessions/plate/:licensePlate/active
   * @deprecated Use POST /parking-sessions/check-vehicle instead
   */
  @Get('plate/:licensePlate/active')
  async findActiveByPlate(@Param('licensePlate') licensePlate: string) {
    const sessions =
      await this.parkingSessionsService.findActiveByLicensePlate(licensePlate);
    return {
      success: true,
      data: sessions,
      count: sessions.length,
    };
  }

  /**
   * Get a single session by ID
   * GET /parking-sessions/:id
   */
  @Get(':id')
  async findOne(@Param('id') id: string) {
    const session = await this.parkingSessionsService.findOne(id);
    return {
      success: true,
      data: session,
    };
  }

  /**
   * Update a parking session
   * PUT /parking-sessions/:id
   */
  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() updateDto: UpdateParkingSessionDto,
  ) {
    const session = await this.parkingSessionsService.update(id, updateDto);
    return {
      success: true,
      data: session,
    };
  }

  /**
   * Extend a parking session
   * PATCH /parking-sessions/:id/extend
   */
  @Patch(':id/extend')
  async extend(
    @Param('id') id: string,
    @Body() extendDto: ExtendParkingSessionDto,
  ) {
    const session = await this.parkingSessionsService.extend(id, extendDto);
    return {
      success: true,
      data: session,
    };
  }

  /**
   * End a parking session
   * PATCH /parking-sessions/:id/end
   */
  @Patch(':id/end')
  async end(@Param('id') id: string) {
    const session = await this.parkingSessionsService.end(id);
    return {
      success: true,
      data: session,
    };
  }

  /**
   * Cancel a parking session
   * PATCH /parking-sessions/:id/cancel
   */
  @Patch(':id/cancel')
  async cancel(@Param('id') id: string) {
    const session = await this.parkingSessionsService.cancel(id);
    return {
      success: true,
      data: session,
    };
  }

  /**
   * Delete a parking session
   * DELETE /parking-sessions/:id
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string) {
    await this.parkingSessionsService.remove(id);
  }

  /**
   * Update expired sessions (admin/cron endpoint)
   * POST /parking-sessions/admin/update-expired
   */
  @Post('admin/update-expired')
  async updateExpired() {
    const count = await this.parkingSessionsService.updateExpiredSessions();
    return {
      success: true,
      message: `Updated ${count} expired sessions`,
      count,
    };
  }
}
