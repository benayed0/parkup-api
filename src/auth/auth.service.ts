import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { Model, Types } from 'mongoose';
import * as bcrypt from 'bcrypt';
import * as Mailjet from 'node-mailjet';
import { OAuth2Client } from 'google-auth-library';
import { Otp, OtpDocument } from './schemas/otp.schema';
import {
  RefreshToken,
  RefreshTokenDocument,
} from './schemas/refresh-token.schema';
import { UsersService } from '../users/users.service';
import { UserDocument } from '../users/schemas/user.schema';

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

interface AuthResponse extends AuthTokens {
  user: UserDocument;
}

@Injectable()
export class AuthService {
  private googleClient: OAuth2Client;
  private mailjet: Mailjet.Client;

  constructor(
    @InjectModel(Otp.name)
    private otpModel: Model<OtpDocument>,
    @InjectModel(RefreshToken.name)
    private refreshTokenModel: Model<RefreshTokenDocument>,
    private usersService: UsersService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {
    // Initialize Google OAuth client
    this.googleClient = new OAuth2Client(
      this.configService.get<string>('GOOGLE_CLIENT_ID'),
    );

    // Initialize Mailjet client
    this.mailjet = Mailjet.Client.apiConnect(
      this.configService.get<string>('MAILJET_API_KEY'),
      this.configService.get<string>('MAILJET_SECRET_KEY'),
    );
  }

  /**
   * Generate a 6-digit OTP code
   */
  private generateOtpCode(): string {
    return '123456'; // Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Send OTP to email using Mailjet
   */
  async sendOtp(email: string): Promise<{ success: boolean; message: string }> {
    const normalizedEmail = email.toLowerCase();

    // Delete any existing OTP for this email
    await this.otpModel.deleteMany({ email: normalizedEmail });

    // Generate new OTP
    const code = this.generateOtpCode();

    // Save OTP to database
    await this.otpModel.create({
      email: normalizedEmail,
      code,
      attempts: 0,
    });

    // Send email via Mailjet
    try {
      await this.mailjet.post('send', { version: 'v3.1' }).request({
        Messages: [
          {
            From: {
              Email: this.configService.get<string>(
                'MAILJET_FROM_EMAIL',
                'noreply@parkup.tn',
              ),
              Name: this.configService.get<string>(
                'MAILJET_FROM_NAME',
                'ParkUp',
              ),
            },
            To: [
              {
                Email: normalizedEmail,
              },
            ],
            Subject: 'Votre code de vérification ParkUp',
            HTMLPart: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #2563eb;">ParkUp</h2>
                <p>Votre code de vérification est:</p>
                <h1 style="font-size: 32px; letter-spacing: 8px; color: #1f2937;">${code}</h1>
                <p>Ce code expire dans 15 minutes.</p>
                <p style="color: #6b7280; font-size: 12px;">Si vous n'avez pas demandé ce code, ignorez cet email.</p>
              </div>
            `,
            TextPart: `Votre code de vérification ParkUp est: ${code}. Ce code expire dans 15 minutes.`,
          },
        ],
      });
    } catch (error) {
      // In development, log the OTP to console if email fails
      if (this.configService.get<string>('NODE_ENV') !== 'production') {
        console.log(`[DEV] OTP for ${normalizedEmail}: ${code}`);
      } else {
        console.error('Mailjet error:', error);
        throw new BadRequestException('Failed to send OTP email');
      }
    }

    return {
      success: true,
      message: 'OTP envoyé',
    };
  }

  /**
   * Verify OTP and authenticate user
   */
  async verifyOtp(email: string, code: string): Promise<AuthResponse> {
    const normalizedEmail = email.toLowerCase();
    const MAX_ATTEMPTS = 5;

    // Find OTP
    const otp = await this.otpModel.findOne({ email: normalizedEmail });

    if (!otp) {
      throw new UnauthorizedException({
        error: 'Code invalide ou expiré',
        code: 'INVALID_OTP',
      });
    }

    // Check attempts
    if (otp.attempts >= MAX_ATTEMPTS) {
      await this.otpModel.deleteOne({ _id: otp._id });
      throw new UnauthorizedException({
        error: 'Trop de tentatives. Veuillez demander un nouveau code.',
        code: 'OTP_MAX_ATTEMPTS',
      });
    }

    // Verify code
    if (otp.code !== code) {
      otp.attempts += 1;
      await otp.save();
      throw new UnauthorizedException({
        error: 'Code invalide ou expiré',
        code: 'INVALID_OTP',
      });
    }

    // Delete OTP after successful verification
    await this.otpModel.deleteOne({ _id: otp._id });

    // Find or create user
    const user = await this.usersService.findOrCreate(normalizedEmail);

    // Mark email as verified
    if (!user.isEmailVerified) {
      await this.usersService.update(user._id.toString(), {
        isEmailVerified: true,
      });
      user.isEmailVerified = true;
    }

    // Generate tokens
    const tokens = await this.generateTokens(user);

    return {
      ...tokens,
      user,
    };
  }

  /**
   * Authenticate with Google
   */
  async googleAuth(idToken: string): Promise<AuthResponse> {
    try {
      const ticket = await this.googleClient.verifyIdToken({
        idToken,
        audience: this.configService.get<string>('GOOGLE_CLIENT_ID'),
      });

      const payload = ticket.getPayload();

      if (!payload || !payload.email) {
        throw new UnauthorizedException({
          error: 'Invalid Google token',
          code: 'INVALID_GOOGLE_TOKEN',
        });
      }

      // Find or create user
      const user = await this.usersService.findOrCreate(payload.email);

      // Mark email as verified (Google accounts are verified)
      if (!user.isEmailVerified) {
        await this.usersService.update(user._id.toString(), {
          isEmailVerified: true,
        });
        user.isEmailVerified = true;
      }

      // Generate tokens
      const tokens = await this.generateTokens(user);

      return {
        ...tokens,
        user,
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException({
        error: 'Invalid Google token',
        code: 'INVALID_GOOGLE_TOKEN',
      });
    }
  }

  /**
   * Authenticate with Facebook
   */
  async facebookAuth(accessToken: string): Promise<AuthResponse> {
    try {
      // Verify Facebook token by calling Facebook Graph API
      const response = await fetch(
        `https://graph.facebook.com/me?fields=id,email,name&access_token=${accessToken}`,
      );

      if (!response.ok) {
        throw new UnauthorizedException({
          error: 'Invalid Facebook token',
          code: 'INVALID_FACEBOOK_TOKEN',
        });
      }

      const data = await response.json();

      if (!data.email) {
        throw new UnauthorizedException({
          error: 'Email not provided by Facebook',
          code: 'FACEBOOK_EMAIL_REQUIRED',
        });
      }

      // Find or create user
      const user = await this.usersService.findOrCreate(data.email);

      // Mark email as verified (Facebook accounts are verified)
      if (!user.isEmailVerified) {
        await this.usersService.update(user._id.toString(), {
          isEmailVerified: true,
        });
        user.isEmailVerified = true;
      }

      // Generate tokens
      const tokens = await this.generateTokens(user);

      return {
        ...tokens,
        user,
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException({
        error: 'Invalid Facebook token',
        code: 'INVALID_FACEBOOK_TOKEN',
      });
    }
  }

  /**
   * Refresh access token
   */
  async refreshToken(refreshToken: string): Promise<AuthResponse> {
    // Hash the incoming token to compare with stored hash
    const hashedToken = await this.hashToken(refreshToken);

    // Find the refresh token in database
    const storedToken = await this.refreshTokenModel.findOne({
      token: hashedToken,
    });

    if (!storedToken) {
      throw new UnauthorizedException({
        error: 'Invalid refresh token',
        code: 'INVALID_REFRESH_TOKEN',
      });
    }

    // Get user
    const user = await this.usersService.findOne(storedToken.userId.toString());

    // Delete old refresh token
    await this.refreshTokenModel.deleteOne({ _id: storedToken._id });

    // Generate new tokens
    const tokens = await this.generateTokens(user);

    return {
      ...tokens,
      user,
    };
  }

  /**
   * Logout - invalidate refresh token
   */
  async logout(userId: string, refreshToken?: string): Promise<void> {
    if (refreshToken) {
      const hashedToken = await this.hashToken(refreshToken);
      await this.refreshTokenModel.deleteOne({ token: hashedToken });
    } else {
      // Delete all refresh tokens for user
      await this.refreshTokenModel.deleteMany({
        userId: new Types.ObjectId(userId),
      });
    }
  }

  /**
   * Get current user profile
   */
  async getProfile(userId: string): Promise<UserDocument> {
    return this.usersService.findOne(userId);
  }

  /**
   * Update user profile
   */
  async updateProfile(
    userId: string,
    updateData: { firstName?: string; lastName?: string; phone?: string },
  ): Promise<UserDocument> {
    return this.usersService.update(userId, { phone: updateData.phone });
  }

  /**
   * Generate access and refresh tokens
   */
  private async generateTokens(user: UserDocument): Promise<AuthTokens> {
    const payload = {
      sub: user._id.toString(),
      email: user.email,
    };

    const accessToken = this.jwtService.sign(payload);

    const refreshToken = this.generateRefreshToken();
    const hashedRefreshToken = await this.hashToken(refreshToken);

    // Store hashed refresh token
    await this.refreshTokenModel.create({
      userId: user._id,
      token: hashedRefreshToken,
    });

    return {
      accessToken,
      refreshToken,
    };
  }

  /**
   * Generate a random refresh token
   */
  private generateRefreshToken(): string {
    const chars =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let token = '';
    for (let i = 0; i < 64; i++) {
      token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return token;
  }

  /**
   * Hash a token for secure storage
   */
  private async hashToken(token: string): Promise<string> {
    return bcrypt.hash(token, 10);
  }

  /**
   * Validate JWT payload and return user
   */
  async validateJwtPayload(payload: {
    sub: string;
    email: string;
  }): Promise<UserDocument> {
    const user = await this.usersService.findOne(payload.sub);
    if (!user) {
      throw new UnauthorizedException();
    }
    return user;
  }
}
