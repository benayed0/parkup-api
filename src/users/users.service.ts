import {
  Injectable,
  NotFoundException,
  ConflictException,
  Inject,
  forwardRef,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument, Vehicle } from './schemas/user.schema';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { AddVehicleDto } from './dto/add-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';
import { WalletService } from '../wallet/wallet.service';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectModel(User.name)
    private userModel: Model<UserDocument>,
    @Inject(forwardRef(() => WalletService))
    private walletService: WalletService,
  ) {}

  /**
   * Create a new user and initialize wallet
   */
  async create(createDto: CreateUserDto): Promise<UserDocument> {
    const existingUser = await this.userModel
      .findOne({ email: createDto.email.toLowerCase() })
      .exec();

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    const user = new this.userModel({
      ...createDto,
      email: createDto.email.toLowerCase(),
      vehicles:
        createDto.vehicles?.map((v) => ({
          ...v,
          licensePlate: v.licensePlate.toUpperCase().replace(/\s/g, ''),
        })) || [],
    });

    const savedUser = await user.save();

    // Create wallet for the new user (idempotent)
    try {
      await this.walletService.createWallet(savedUser._id.toString());
      this.logger.log(`Wallet created for user ${savedUser._id}`);
    } catch (error) {
      this.logger.error(
        `Failed to create wallet for user ${savedUser._id}: ${error}`,
      );
      // Don't fail user creation if wallet creation fails
      // Wallet can be created lazily on first access
    }

    return savedUser;
  }

  /**
   * Find all users with optional pagination
   */
  async findAll(options?: {
    limit?: number;
    skip?: number;
  }): Promise<UserDocument[]> {
    return this.userModel
      .find()
      .sort({ createdAt: -1 })
      .skip(options?.skip || 0)
      .limit(options?.limit || 50)
      .exec();
  }

  /**
   * Find a user by ID
   */
  async findOne(id: string): Promise<UserDocument> {
    const user = await this.userModel.findById(id).exec();
    if (!user) {
      throw new NotFoundException(`User #${id} not found`);
    }
    return user;
  }

  /**
   * Find a user by email
   */
  async findByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ email: email.toLowerCase() }).exec();
  }

  /**
   * Update a user
   */
  async update(id: string, updateDto: UpdateUserDto): Promise<UserDocument> {
    const updateData: Record<string, any> = { ...updateDto };

    if (updateDto.email) {
      updateData.email = updateDto.email.toLowerCase();

      const existingUser = await this.userModel
        .findOne({ email: updateData.email, _id: { $ne: id } })
        .exec();

      if (existingUser) {
        throw new ConflictException('Email already in use');
      }
    }

    const user = await this.userModel
      .findByIdAndUpdate(id, updateData, { new: true })
      .exec();

    if (!user) {
      throw new NotFoundException(`User #${id} not found`);
    }

    return user;
  }

  /**
   * Delete a user
   */
  async remove(id: string): Promise<void> {
    const result = await this.userModel.findByIdAndDelete(id).exec();
    if (!result) {
      throw new NotFoundException(`User #${id} not found`);
    }
  }

  /**
   * Add a vehicle to user
   */
  async addVehicle(
    userId: string,
    vehicleDto: AddVehicleDto,
  ): Promise<UserDocument> {
    const user = await this.findOne(userId);
    const normalizedPlate = vehicleDto.licensePlate
      .toUpperCase()
      .replace(/\s/g, '');

    const existingVehicle = user.vehicles.find(
      (v) => v.licensePlate === normalizedPlate,
    );

    if (existingVehicle) {
      throw new ConflictException(
        'Vehicle with this license plate already exists',
      );
    }

    const newVehicle: Vehicle = {
      licensePlate: normalizedPlate,
      nickname: vehicleDto.nickname || '',
      isDefault: vehicleDto.isDefault || false,
    };

    // If this is the first vehicle or marked as default, update other vehicles
    if (newVehicle.isDefault || user.vehicles.length === 0) {
      newVehicle.isDefault = true;
      user.vehicles.forEach((v) => (v.isDefault = false));
    }

    user.vehicles.push(newVehicle);
    return user.save();
  }

  /**
   * Update a vehicle
   */
  async updateVehicle(
    userId: string,
    licensePlate: string,
    updateDto: UpdateVehicleDto,
  ): Promise<UserDocument> {
    const user = await this.findOne(userId);
    const normalizedPlate = licensePlate.toUpperCase().replace(/\s/g, '');

    const vehicleIndex = user.vehicles.findIndex(
      (v) => v.licensePlate === normalizedPlate,
    );

    if (vehicleIndex === -1) {
      throw new NotFoundException('Vehicle not found');
    }

    // Check if new license plate already exists (if changing plate)
    if (updateDto.licensePlate) {
      const newNormalizedPlate = updateDto.licensePlate
        .toUpperCase()
        .replace(/\s/g, '');
      const duplicateVehicle = user.vehicles.find(
        (v, i) => v.licensePlate === newNormalizedPlate && i !== vehicleIndex,
      );

      if (duplicateVehicle) {
        throw new ConflictException(
          'Vehicle with this license plate already exists',
        );
      }

      user.vehicles[vehicleIndex].licensePlate = newNormalizedPlate;
    }

    if (updateDto.nickname !== undefined) {
      user.vehicles[vehicleIndex].nickname = updateDto.nickname;
    }

    if (updateDto.isDefault !== undefined) {
      if (updateDto.isDefault) {
        user.vehicles.forEach((v) => (v.isDefault = false));
      }
      user.vehicles[vehicleIndex].isDefault = updateDto.isDefault;
    }

    return user.save();
  }

  /**
   * Remove a vehicle
   */
  async removeVehicle(
    userId: string,
    licensePlate: string,
  ): Promise<UserDocument> {
    const user = await this.findOne(userId);
    const normalizedPlate = licensePlate.toUpperCase().replace(/\s/g, '');

    const vehicleIndex = user.vehicles.findIndex(
      (v) => v.licensePlate === normalizedPlate,
    );

    if (vehicleIndex === -1) {
      throw new NotFoundException('Vehicle not found');
    }

    const wasDefault = user.vehicles[vehicleIndex].isDefault;
    user.vehicles.splice(vehicleIndex, 1);

    // If removed vehicle was default, make first remaining vehicle default
    if (wasDefault && user.vehicles.length > 0) {
      user.vehicles[0].isDefault = true;
    }

    return user.save();
  }

  /**
   * Find or create user by email (useful for auth)
   */
  async findOrCreate(email: string): Promise<UserDocument> {
    const existingUser = await this.findByEmail(email);

    if (existingUser) {
      return existingUser;
    }

    return this.create({ email });
  }
}
