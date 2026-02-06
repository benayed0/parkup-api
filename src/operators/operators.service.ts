import {
  Injectable,
  NotFoundException,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { JwtService } from '@nestjs/jwt';
import {
  Operator,
  OperatorDocument,
  OperatorRole,
  ROLE_HIERARCHY,
} from './schemas/operator.schema';
import {
  CreateOperatorDto,
  UpdateOperatorDto,
  RequestOtpDto,
  VerifyOtpDto,
} from './dto';

@Injectable()
export class OperatorsService {
  // Hardcoded OTP for development (will be replaced with email sending later)
  private readonly DEV_OTP = '1234';
  // OTP expiration time in minutes
  private readonly OTP_EXPIRY_MINUTES = 10;

  constructor(
    @InjectModel(Operator.name)
    private operatorModel: Model<OperatorDocument>,
    private jwtService: JwtService,
  ) {}

  /**
   * Returns all roles strictly below the given role in the hierarchy.
   */
  private getRolesBelow(role: OperatorRole): OperatorRole[] {
    const callerLevel = ROLE_HIERARCHY[role];
    return Object.entries(ROLE_HIERARCHY)
      .filter(([, level]) => level < callerLevel)
      .map(([r]) => r as OperatorRole);
  }

  /**
   * Checks that the caller's role is strictly above the target role.
   * Throws ForbiddenException if not.
   */
  private assertRoleAbove(
    callerRole: OperatorRole,
    targetRole: OperatorRole,
    action: string,
  ): void {
    if (ROLE_HIERARCHY[callerRole] <= ROLE_HIERARCHY[targetRole]) {
      throw new ForbiddenException(
        `Accès refusé: vous ne pouvez pas ${action} un opérateur avec un rôle égal ou supérieur au vôtre`,
      );
    }
  }

  async create(
    createOperatorDto: CreateOperatorDto,
    caller: OperatorDocument,
  ): Promise<OperatorDocument> {
    const targetRole = createOperatorDto.role ?? OperatorRole.SUPERVISOR;
    this.assertRoleAbove(caller.role, targetRole, 'créer');

    const existing = await this.operatorModel.findOne({
      email: createOperatorDto.email.toLowerCase(),
    });

    if (existing) {
      throw new ConflictException('Un opérateur avec cet email existe déjà');
    }

    const operator = new this.operatorModel({
      ...createOperatorDto,
      email: createOperatorDto.email.toLowerCase(),
      role: targetRole,
      isActive: createOperatorDto.isActive ?? true,
    });

    return operator.save();
  }

  async findAll(
    caller: OperatorDocument,
    filters?: {
      isActive?: boolean;
      role?: OperatorRole;
      limit?: number;
      skip?: number;
    },
  ): Promise<OperatorDocument[]> {
    const query: Record<string, any> = {};

    if (filters?.isActive !== undefined) {
      query.isActive = filters.isActive;
    }

    // Non-super_admin operators can only see roles strictly below their own
    if (caller.role !== OperatorRole.SUPER_ADMIN) {
      const allowedRoles = this.getRolesBelow(caller.role);
      if (filters?.role) {
        // If a specific role filter was requested, intersect with allowed roles
        if (!allowedRoles.includes(filters.role)) {
          return [];
        }
        query.role = filters.role;
      } else {
        query.role = { $in: allowedRoles };
      }
    } else if (filters?.role) {
      query.role = filters.role;
    }

    return this.operatorModel
      .find(query)
      .populate('zoneIds')
      .select('-currentOtp -otpExpiresAt')
      .sort({ createdAt: -1 })
      .skip(filters?.skip || 0)
      .limit(filters?.limit || 50)
      .exec();
  }

  async findOne(
    id: string,
    caller: OperatorDocument,
  ): Promise<OperatorDocument> {
    const operator = await this.operatorModel
      .findById(id)
      .populate('zoneIds')
      .select('-currentOtp -otpExpiresAt')
      .exec();

    if (!operator) {
      throw new NotFoundException(`Opérateur #${id} non trouvé`);
    }

    // Non-super_admin can only view operators with strictly lower role
    if (caller.role !== OperatorRole.SUPER_ADMIN) {
      this.assertRoleAbove(caller.role, operator.role, 'consulter');
    }

    return operator;
  }

  async findByEmail(email: string): Promise<OperatorDocument | null> {
    return this.operatorModel.findOne({ email: email.toLowerCase() }).exec();
  }

  async update(
    id: string,
    updateOperatorDto: UpdateOperatorDto,
    caller?: OperatorDocument,
  ): Promise<OperatorDocument> {
    // If a caller is provided, enforce role hierarchy
    if (caller) {
      const target = await this.operatorModel.findById(id).exec();
      if (!target) {
        throw new NotFoundException(`Opérateur #${id} non trouvé`);
      }

      // Can't modify operators at or above your role
      if (caller.role !== OperatorRole.SUPER_ADMIN) {
        this.assertRoleAbove(caller.role, target.role, 'modifier');
      }

      // Can't promote an operator to a role >= your own
      if (updateOperatorDto.role) {
        this.assertRoleAbove(caller.role, updateOperatorDto.role, 'attribuer ce rôle à');
      }
    }

    if (updateOperatorDto.email) {
      const existing = await this.operatorModel.findOne({
        email: updateOperatorDto.email.toLowerCase(),
        _id: { $ne: id },
      });

      if (existing) {
        throw new ConflictException('Cet email est déjà utilisé');
      }
    }

    const operator = await this.operatorModel
      .findByIdAndUpdate(
        id,
        {
          ...updateOperatorDto,
          ...(updateOperatorDto.email && {
            email: updateOperatorDto.email.toLowerCase(),
          }),
        },
        { new: true },
      )
      .populate('zoneIds')
      .select('-currentOtp -otpExpiresAt')
      .exec();

    if (!operator) {
      throw new NotFoundException(`Opérateur #${id} non trouvé`);
    }

    return operator;
  }

  async remove(id: string, caller: OperatorDocument): Promise<void> {
    const target = await this.operatorModel.findById(id).exec();
    if (!target) {
      throw new NotFoundException(`Opérateur #${id} non trouvé`);
    }

    // Can't delete operators at or above your role
    if (caller.role !== OperatorRole.SUPER_ADMIN) {
      this.assertRoleAbove(caller.role, target.role, 'supprimer');
    }

    // Prevent self-deletion
    if (caller._id.toString() === id) {
      throw new ForbiddenException(
        'Vous ne pouvez pas supprimer votre propre compte',
      );
    }

    await this.operatorModel.findByIdAndDelete(id).exec();
  }

  async requestOtp(requestOtpDto: RequestOtpDto): Promise<{ message: string }> {
    const operator = await this.operatorModel.findOne({
      email: requestOtpDto.email.toLowerCase(),
    });

    if (!operator) {
      throw new NotFoundException('Aucun opérateur trouvé avec cet email');
    }

    if (!operator.isActive) {
      throw new UnauthorizedException('Ce compte est désactivé');
    }

    // Generate OTP (hardcoded for now)
    const otp = this.DEV_OTP;
    const otpExpiresAt = new Date(
      Date.now() + this.OTP_EXPIRY_MINUTES * 60 * 1000,
    );

    // Save OTP to operator
    await this.operatorModel.findByIdAndUpdate(operator._id, {
      currentOtp: otp,
      otpExpiresAt,
    });

    // TODO: Send OTP via email when email provider is configured
    // For now, log it to console for development
    console.log(`[DEV] OTP for ${operator.email}: ${otp}`);

    return {
      message: 'Code OTP envoyé à votre adresse email',
    };
  }

  async verifyOtp(
    verifyOtpDto: VerifyOtpDto,
  ): Promise<{ accessToken: string; operator: OperatorDocument }> {
    const operator = await this.operatorModel.findOne({
      email: verifyOtpDto.email.toLowerCase(),
    });

    if (!operator) {
      throw new NotFoundException('Aucun opérateur trouvé avec cet email');
    }

    if (!operator.isActive) {
      throw new UnauthorizedException('Ce compte est désactivé');
    }

    if (!operator.currentOtp || !operator.otpExpiresAt) {
      throw new BadRequestException(
        'Aucun code OTP en attente. Veuillez en demander un nouveau.',
      );
    }

    if (new Date() > operator.otpExpiresAt) {
      // Clear expired OTP
      await this.operatorModel.findByIdAndUpdate(operator._id, {
        currentOtp: null,
        otpExpiresAt: null,
      });
      throw new BadRequestException(
        'Le code OTP a expiré. Veuillez en demander un nouveau.',
      );
    }

    if (operator.currentOtp !== verifyOtpDto.otp) {
      throw new UnauthorizedException('Code OTP invalide');
    }

    // Clear OTP and update last login
    await this.operatorModel.findByIdAndUpdate(operator._id, {
      currentOtp: null,
      otpExpiresAt: null,
      lastLoginAt: new Date(),
    });

    // Generate JWT token
    const payload = {
      sub: operator._id.toString(),
      email: operator.email,
      role: operator.role,
      type: 'operator',
    };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: '7d',
    });

    // Fetch operator without sensitive fields
    const operatorData = await this.operatorModel
      .findById(operator._id)
      .populate('zoneIds')
      .select('-currentOtp -otpExpiresAt')
      .exec();

    return {
      accessToken,
      operator: operatorData!,
    };
  }

  async validateOperatorToken(payload: {
    sub: string;
    email: string;
    role: OperatorRole;
    type: string;
  }): Promise<OperatorDocument> {
    if (payload.type !== 'operator') {
      throw new UnauthorizedException('Token invalide');
    }

    const operator = await this.operatorModel
      .findById(payload.sub)
      .populate('zoneIds')
      .select('-currentOtp -otpExpiresAt')
      .exec();

    if (!operator) {
      throw new UnauthorizedException('Opérateur non trouvé');
    }

    if (!operator.isActive) {
      throw new UnauthorizedException('Ce compte est désactivé');
    }

    return operator;
  }
}
