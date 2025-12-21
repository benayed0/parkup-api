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
import { AgentsService } from './agents.service';
import {
  CreateAgentDto,
  UpdateAgentDto,
  LoginAgentDto,
  ChangePasswordDto,
} from './dto';

@Controller('agents')
export class AgentsController {
  constructor(private readonly agentsService: AgentsService) {}

  /**
   * Create a new agent
   * POST /agents
   */
  @Post()
  async create(@Body() createDto: CreateAgentDto) {
    const agent = await this.agentsService.create(createDto);
    return {
      success: true,
      data: agent,
    };
  }

  /**
   * Agent login
   * POST /agents/login
   */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginAgentDto) {
    const result = await this.agentsService.login(loginDto);
    return {
      success: true,
      data: result,
    };
  }

  /**
   * Get all agents (with optional filters)
   * GET /agents?isActive=true&zoneId=xxx&limit=10
   */
  @Get()
  async findAll(
    @Query('isActive') isActive?: string,
    @Query('zoneId') zoneId?: string,
    @Query('limit') limit?: string,
    @Query('skip') skip?: string,
  ) {
    const agents = await this.agentsService.findAll({
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
      zoneId,
      limit: limit ? parseInt(limit, 10) : undefined,
      skip: skip ? parseInt(skip, 10) : undefined,
    });
    return {
      success: true,
      data: agents,
      count: agents.length,
    };
  }

  /**
   * Get agents by zone
   * GET /agents/zone/:zoneId
   */
  @Get('zone/:zoneId')
  async findByZone(@Param('zoneId') zoneId: string) {
    const agents = await this.agentsService.findByZone(zoneId);
    return {
      success: true,
      data: agents,
      count: agents.length,
    };
  }

  /**
   * Get a single agent by ID
   * GET /agents/:id
   */
  @Get(':id')
  async findOne(@Param('id') id: string) {
    const agent = await this.agentsService.findOne(id);
    return {
      success: true,
      data: agent,
    };
  }

  /**
   * Update an agent
   * PUT /agents/:id
   */
  @Put(':id')
  async update(@Param('id') id: string, @Body() updateDto: UpdateAgentDto) {
    const agent = await this.agentsService.update(id, updateDto);
    return {
      success: true,
      data: agent,
    };
  }

  /**
   * Change agent password
   * PATCH /agents/:id/change-password
   */
  @Patch(':id/change-password')
  async changePassword(
    @Param('id') id: string,
    @Body() changePasswordDto: ChangePasswordDto,
  ) {
    await this.agentsService.changePassword(id, changePasswordDto);
    return {
      success: true,
      message: 'Password changed successfully',
    };
  }

  /**
   * Reset agent password (admin action)
   * PATCH /agents/:id/reset-password
   */
  @Patch(':id/reset-password')
  async resetPassword(
    @Param('id') id: string,
    @Body('newPassword') newPassword: string,
  ) {
    await this.agentsService.resetPassword(id, newPassword);
    return {
      success: true,
      message: 'Password reset successfully',
    };
  }

  /**
   * Activate an agent
   * PATCH /agents/:id/activate
   */
  @Patch(':id/activate')
  async activate(@Param('id') id: string) {
    const agent = await this.agentsService.activate(id);
    return {
      success: true,
      data: agent,
    };
  }

  /**
   * Deactivate an agent
   * PATCH /agents/:id/deactivate
   */
  @Patch(':id/deactivate')
  async deactivate(@Param('id') id: string) {
    const agent = await this.agentsService.deactivate(id);
    return {
      success: true,
      data: agent,
    };
  }

  /**
   * Assign zones to an agent
   * PATCH /agents/:id/zones
   */
  @Patch(':id/zones')
  async assignZones(
    @Param('id') id: string,
    @Body('zoneIds') zoneIds: string[],
  ) {
    const agent = await this.agentsService.assignZones(id, zoneIds);
    return {
      success: true,
      data: agent,
    };
  }

  /**
   * Delete an agent
   * DELETE /agents/:id
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string) {
    await this.agentsService.remove(id);
  }
}
