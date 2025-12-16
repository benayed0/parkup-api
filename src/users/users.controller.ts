import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { AddVehicleDto } from './dto/add-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /**
   * Create a new user
   * POST /users
   */
  @Post()
  async create(@Body() createDto: CreateUserDto) {
    const user = await this.usersService.create(createDto);
    return {
      success: true,
      data: user,
    };
  }

  /**
   * Get all users with optional pagination
   * GET /users?limit=50&skip=0
   */
  @Get()
  async findAll(
    @Query('limit') limit?: string,
    @Query('skip') skip?: string,
  ) {
    const users = await this.usersService.findAll({
      limit: limit ? parseInt(limit, 10) : undefined,
      skip: skip ? parseInt(skip, 10) : undefined,
    });
    return {
      success: true,
      data: users,
      count: users.length,
    };
  }

  /**
   * Get a user by ID
   * GET /users/:id
   */
  @Get(':id')
  async findOne(@Param('id') id: string) {
    const user = await this.usersService.findOne(id);
    return {
      success: true,
      data: user,
    };
  }

  /**
   * Update a user
   * PATCH /users/:id
   */
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateDto: UpdateUserDto,
  ) {
    const user = await this.usersService.update(id, updateDto);
    return {
      success: true,
      data: user,
    };
  }

  /**
   * Delete a user
   * DELETE /users/:id
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string) {
    await this.usersService.remove(id);
  }

  /**
   * Add a vehicle to user
   * POST /users/:id/vehicles
   */
  @Post(':id/vehicles')
  async addVehicle(
    @Param('id') id: string,
    @Body() vehicleDto: AddVehicleDto,
  ) {
    const user = await this.usersService.addVehicle(id, vehicleDto);
    return {
      success: true,
      data: user,
    };
  }

  /**
   * Update a vehicle
   * PATCH /users/:id/vehicles/:licensePlate
   */
  @Patch(':id/vehicles/:licensePlate')
  async updateVehicle(
    @Param('id') id: string,
    @Param('licensePlate') licensePlate: string,
    @Body() updateDto: UpdateVehicleDto,
  ) {
    const user = await this.usersService.updateVehicle(id, licensePlate, updateDto);
    return {
      success: true,
      data: user,
    };
  }

  /**
   * Remove a vehicle
   * DELETE /users/:id/vehicles/:licensePlate
   */
  @Delete(':id/vehicles/:licensePlate')
  async removeVehicle(
    @Param('id') id: string,
    @Param('licensePlate') licensePlate: string,
  ) {
    const user = await this.usersService.removeVehicle(id, licensePlate);
    return {
      success: true,
      data: user,
    };
  }
}
