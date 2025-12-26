import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { JwtService } from '@nestjs/jwt';
import { Model, Types } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { Agent, AgentDocument } from './schemas/agent.schema';
import {
  CreateAgentDto,
  UpdateAgentDto,
  LoginAgentDto,
  ChangePasswordDto,
} from './dto';

@Injectable()
export class AgentsService {
  constructor(
    @InjectModel(Agent.name)
    private agentModel: Model<AgentDocument>,
    private jwtService: JwtService,
  ) {}

  /**
   * Create a new agent
   */
  async create(createDto: CreateAgentDto): Promise<AgentDocument> {
    // Check if username already exists
    const existing = await this.agentModel.findOne({
      username: createDto.username.toLowerCase(),
    });

    if (existing) {
      throw new ConflictException('Username already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(createDto.password, 10);

    // Convert zone IDs to ObjectIds
    const assignedZones = createDto.assignedZones?.map(
      (id) => new Types.ObjectId(id),
    );

    const agent = new this.agentModel({
      ...createDto,
      username: createDto.username.toLowerCase(),
      password: hashedPassword,
      assignedZones,
      isActive: createDto.isActive ?? true,
    });

    const saved = await agent.save();
    // Return without password
    const result = saved.toObject();
    delete result.password;
    return result as AgentDocument;
  }

  /**
   * Agent login with username and password
   */
  async login(
    loginDto: LoginAgentDto,
  ): Promise<{ agent: AgentDocument; token: string }> {
    const agent = await this.agentModel
      .findOne({ username: loginDto.username })
      .select('+password')
      .populate('assignedZones')
      .exec();
    console.log(loginDto);

    if (!agent) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!agent.isActive) {
      throw new UnauthorizedException('Agent account is deactivated');
    }

    const isPasswordValid = await bcrypt.compare(
      loginDto.password,
      agent.password,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Return agent without password
    const result = agent.toObject();
    delete result.password;

    // Generate JWT token
    const payload = {
      sub: agent._id.toString(),
      username: agent.username,
      type: 'agent',
    };
    const token = this.jwtService.sign(payload);

    return { agent: result as AgentDocument, token };
  }

  /**
   * Validate agent from JWT payload
   */
  async validateFromToken(payload: {
    sub: string;
    type: string;
  }): Promise<AgentDocument> {
    if (payload.type !== 'agent') {
      throw new UnauthorizedException('Invalid token type');
    }

    const agent = await this.agentModel
      .findById(payload.sub)
      .populate('assignedZones')
      .exec();

    if (!agent) {
      throw new UnauthorizedException('Agent not found');
    }

    if (!agent.isActive) {
      throw new UnauthorizedException('Agent account is deactivated');
    }

    return agent;
  }

  /**
   * Find all agents with optional filters
   */
  async findAll(filters?: {
    isActive?: boolean;
    zoneId?: string;
    limit?: number;
    skip?: number;
  }): Promise<AgentDocument[]> {
    const query: Record<string, any> = {};

    if (filters?.isActive !== undefined) {
      query.isActive = filters.isActive;
    }
    if (filters?.zoneId) {
      query.assignedZones = new Types.ObjectId(filters.zoneId);
    }

    return this.agentModel
      .find(query)
      .populate('assignedZones')
      .sort({ name: 1 })
      .skip(filters?.skip || 0)
      .limit(filters?.limit || 50)
      .exec();
  }

  /**
   * Find agent by ID
   */
  async findOne(id: string): Promise<AgentDocument> {
    const agent = await this.agentModel
      .findById(id)
      .populate('assignedZones')
      .exec();

    if (!agent) {
      throw new NotFoundException(`Agent #${id} not found`);
    }
    return agent;
  }

  /**
   * Find agent by username
   */
  async findByUsername(username: string): Promise<AgentDocument | null> {
    return this.agentModel
      .findOne({ username: username.toLowerCase() })
      .populate('assignedZones')
      .exec();
  }

  /**
   * Update an agent
   */
  async update(id: string, updateDto: UpdateAgentDto): Promise<AgentDocument> {
    const updateData: Record<string, any> = { ...updateDto };

    // Normalize fields
    if (updateDto.username) {
      updateData.username = updateDto.username.toLowerCase();
    }
    if (updateDto.assignedZones) {
      updateData.assignedZones = updateDto.assignedZones.map(
        (zoneId) => new Types.ObjectId(zoneId),
      );
    }

    const agent = await this.agentModel
      .findByIdAndUpdate(id, updateData, { new: true })
      .populate('assignedZones')
      .exec();

    if (!agent) {
      throw new NotFoundException(`Agent #${id} not found`);
    }

    return agent;
  }

  /**
   * Change agent password
   */
  async changePassword(
    id: string,
    changePasswordDto: ChangePasswordDto,
  ): Promise<void> {
    const agent = await this.agentModel.findById(id).select('+password').exec();

    if (!agent) {
      throw new NotFoundException(`Agent #${id} not found`);
    }

    const isCurrentPasswordValid = await bcrypt.compare(
      changePasswordDto.currentPassword,
      agent.password,
    );

    if (!isCurrentPasswordValid) {
      throw new BadRequestException('Current password is incorrect');
    }

    const hashedPassword = await bcrypt.hash(changePasswordDto.newPassword, 10);
    await this.agentModel.findByIdAndUpdate(id, { password: hashedPassword });
  }

  /**
   * Reset agent password (admin action)
   */
  async resetPassword(id: string, newPassword: string): Promise<void> {
    const agent = await this.agentModel.findById(id).exec();

    if (!agent) {
      throw new NotFoundException(`Agent #${id} not found`);
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await this.agentModel.findByIdAndUpdate(id, { password: hashedPassword });
  }

  /**
   * Activate an agent
   */
  async activate(id: string): Promise<AgentDocument> {
    return this.update(id, { isActive: true });
  }

  /**
   * Deactivate an agent
   */
  async deactivate(id: string): Promise<AgentDocument> {
    return this.update(id, { isActive: false });
  }

  /**
   * Assign zones to an agent
   */
  async assignZones(id: string, zoneIds: string[]): Promise<AgentDocument> {
    const agent = await this.agentModel
      .findByIdAndUpdate(
        id,
        { assignedZones: zoneIds.map((zid) => new Types.ObjectId(zid)) },
        { new: true },
      )
      .populate('assignedZones')
      .exec();

    if (!agent) {
      throw new NotFoundException(`Agent #${id} not found`);
    }

    return agent;
  }

  /**
   * Delete an agent
   */
  async remove(id: string): Promise<void> {
    const result = await this.agentModel.findByIdAndDelete(id).exec();
    if (!result) {
      throw new NotFoundException(`Agent #${id} not found`);
    }
  }

  /**
   * Get agents assigned to a specific zone
   */
  async findByZone(zoneId: string): Promise<AgentDocument[]> {
    return this.agentModel
      .find({
        assignedZones: new Types.ObjectId(zoneId),
        isActive: true,
      })
      .exec();
  }
}
