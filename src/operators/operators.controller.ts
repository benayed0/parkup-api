import {
  Controller,
  Get,
  Post,
  Body,
  Put,
  Param,
  Delete,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { OperatorsService } from './operators.service';
import {
  CreateOperatorDto,
  UpdateOperatorDto,
  RequestOtpDto,
  VerifyOtpDto,
} from './dto';
import { OperatorDocument, OperatorRole } from './schemas/operator.schema';
import { OperatorJwtAuthGuard } from './guards/operator-jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { Roles } from './decorators/roles.decorator';
import { CurrentOperator } from './decorators/current-operator.decorator';

@Controller('operators')
export class OperatorsController {
  constructor(private readonly operatorsService: OperatorsService) {}

  // ==================== AUTH ENDPOINTS (Public) ====================

  @Post('auth/request-otp')
  @HttpCode(HttpStatus.OK)
  async requestOtp(@Body() requestOtpDto: RequestOtpDto) {
    const result = await this.operatorsService.requestOtp(requestOtpDto);
    return {
      success: true,
      ...result,
    };
  }

  @Post('auth/verify-otp')
  @HttpCode(HttpStatus.OK)
  async verifyOtp(@Body() verifyOtpDto: VerifyOtpDto) {
    const result = await this.operatorsService.verifyOtp(verifyOtpDto);
    return {
      success: true,
      data: {
        accessToken: result.accessToken,
        operator: result.operator,
      },
    };
  }

  // ==================== PROFILE ENDPOINT ====================

  @Get('me')
  @UseGuards(OperatorJwtAuthGuard)
  async getProfile(@CurrentOperator() operator: OperatorDocument) {
    return {
      success: true,
      data: operator,
    };
  }

  // ==================== CRUD ENDPOINTS (Protected) ====================

  @Post()
  @UseGuards(OperatorJwtAuthGuard, RolesGuard)
  @Roles(OperatorRole.ADMIN)
  async create(
    @Body() createOperatorDto: CreateOperatorDto,
    @CurrentOperator() caller: OperatorDocument,
  ) {
    const operator = await this.operatorsService.create(
      createOperatorDto,
      caller,
    );
    return {
      success: true,
      data: operator,
    };
  }

  @Get()
  @UseGuards(OperatorJwtAuthGuard, RolesGuard)
  @Roles(OperatorRole.ADMIN)
  async findAll(
    @CurrentOperator() caller: OperatorDocument,
    @Query('isActive') isActive?: string,
    @Query('role') role?: OperatorRole,
    @Query('limit') limit?: string,
    @Query('skip') skip?: string,
  ) {
    const filters: any = {};

    if (isActive !== undefined) {
      filters.isActive = isActive === 'true';
    }
    if (role) {
      filters.role = role;
    }
    if (limit) {
      filters.limit = parseInt(limit, 10);
    }
    if (skip) {
      filters.skip = parseInt(skip, 10);
    }

    const operators = await this.operatorsService.findAll(caller, filters);
    return {
      success: true,
      data: operators,
      count: operators.length,
    };
  }

  @Get(':id')
  @UseGuards(OperatorJwtAuthGuard, RolesGuard)
  @Roles(OperatorRole.ADMIN)
  async findOne(
    @Param('id') id: string,
    @CurrentOperator() caller: OperatorDocument,
  ) {
    const operator = await this.operatorsService.findOne(id, caller);
    return {
      success: true,
      data: operator,
    };
  }

  @Put(':id')
  @UseGuards(OperatorJwtAuthGuard, RolesGuard)
  @Roles(OperatorRole.ADMIN)
  async update(
    @Param('id') id: string,
    @Body() updateOperatorDto: UpdateOperatorDto,
    @CurrentOperator() caller: OperatorDocument,
  ) {
    const operator = await this.operatorsService.update(
      id,
      updateOperatorDto,
      caller,
    );
    return {
      success: true,
      data: operator,
    };
  }

  @Delete(':id')
  @UseGuards(OperatorJwtAuthGuard, RolesGuard)
  @Roles(OperatorRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('id') id: string,
    @CurrentOperator() caller: OperatorDocument,
  ) {
    await this.operatorsService.remove(id, caller);
  }

  // ==================== ACTIVATION ENDPOINTS ====================

  @Put(':id/activate')
  @UseGuards(OperatorJwtAuthGuard, RolesGuard)
  @Roles(OperatorRole.ADMIN)
  async activate(
    @Param('id') id: string,
    @CurrentOperator() caller: OperatorDocument,
  ) {
    const operator = await this.operatorsService.update(
      id,
      { isActive: true },
      caller,
    );
    return {
      success: true,
      data: operator,
      message: 'Opérateur activé',
    };
  }

  @Put(':id/deactivate')
  @UseGuards(OperatorJwtAuthGuard, RolesGuard)
  @Roles(OperatorRole.ADMIN)
  async deactivate(
    @Param('id') id: string,
    @CurrentOperator() caller: OperatorDocument,
  ) {
    const operator = await this.operatorsService.update(
      id,
      { isActive: false },
      caller,
    );
    return {
      success: true,
      data: operator,
      message: 'Opérateur désactivé',
    };
  }

  // ==================== ZONE MANAGEMENT ====================

  @Put(':id/zones')
  @UseGuards(OperatorJwtAuthGuard, RolesGuard)
  @Roles(OperatorRole.ADMIN)
  async updateZones(
    @Param('id') id: string,
    @Body('zoneIds') zoneIds: string[],
    @CurrentOperator() caller: OperatorDocument,
  ) {
    const operator = await this.operatorsService.update(
      id,
      { zoneIds },
      caller,
    );
    return {
      success: true,
      data: operator,
      message: 'Zones mises à jour',
    };
  }
}
