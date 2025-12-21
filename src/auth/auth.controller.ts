import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import {
  SendOtpDto,
  VerifyOtpDto,
  GoogleAuthDto,
  FacebookAuthDto,
  RefreshTokenDto,
  UpdateProfileDto,
} from './dto';
import { WalletService } from '../wallet/wallet.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly walletService: WalletService,
  ) {}

  /**
   * Send OTP to email
   * POST /auth/otp/send
   */
  @Post('otp/send')
  @HttpCode(HttpStatus.OK)
  async sendOtp(@Body() dto: SendOtpDto) {
    return this.authService.sendOtp(dto.email);
  }

  /**
   * Verify OTP and authenticate
   * POST /auth/otp/verify
   */
  @Post('otp/verify')
  @HttpCode(HttpStatus.OK)
  async verifyOtp(@Body() dto: VerifyOtpDto) {
    const result = await this.authService.verifyOtp(dto.email, dto.code);
    return {
      access_token: result.accessToken,
      refresh_token: result.refreshToken,
      user: await this.formatUser(result.user),
    };
  }

  /**
   * Authenticate with Google
   * POST /auth/google
   * Supports both idToken (mobile) and accessToken (web)
   */
  @Post('google')
  @HttpCode(HttpStatus.OK)
  async googleAuth(@Body() dto: GoogleAuthDto) {
    const result = await this.authService.googleAuth(
      dto.idToken,
      dto.accessToken,
    );
    return {
      access_token: result.accessToken,
      refresh_token: result.refreshToken,
      user: await this.formatUser(result.user),
    };
  }

  /**
   * Authenticate with Facebook
   * POST /auth/facebook
   */
  @Post('facebook')
  @HttpCode(HttpStatus.OK)
  async facebookAuth(@Body() dto: FacebookAuthDto) {
    const result = await this.authService.facebookAuth(dto.accessToken);
    return {
      access_token: result.accessToken,
      refresh_token: result.refreshToken,
      user: await this.formatUser(result.user),
    };
  }

  /**
   * Refresh access token
   * POST /auth/refresh
   */
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() dto: RefreshTokenDto) {
    const result = await this.authService.refreshToken(dto.refreshToken);
    return {
      access_token: result.accessToken,
      refresh_token: result.refreshToken,
      user: await this.formatUser(result.user),
    };
  }

  /**
   * Logout - invalidate tokens
   * POST /auth/logout
   */
  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async logout(@Request() req, @Body() body?: { refreshToken?: string }) {
    await this.authService.logout(req.user._id.toString(), body?.refreshToken);
    return {
      success: true,
    };
  }

  /**
   * Get current user profile
   * GET /auth/me
   */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getProfile(@Request() req) {
    const user = await this.authService.getProfile(req.user._id.toString());
    return {
      user: await this.formatUser(user),
    };
  }

  /**
   * Update user profile
   * PATCH /auth/profile
   */
  @Patch('profile')
  @UseGuards(JwtAuthGuard)
  async updateProfile(@Request() req, @Body() dto: UpdateProfileDto) {
    const user = await this.authService.updateProfile(
      req.user._id.toString(),
      dto,
    );
    return {
      user: await this.formatUser(user),
    };
  }

  /**
   * Format user for API response (snake_case for Flutter)
   */
  private async formatUser(user: any) {
    // Ensure wallet exists and fetch balance
    const userId = user._id.toString();
    let walletBalance = 0;

    try {
      // Try to get existing wallet
      const wallet = await this.walletService.getWallet(userId);
      walletBalance = wallet.balance;
    } catch {
      // Wallet doesn't exist, create it with default values
      try {
        await this.walletService.createWallet(userId);
        walletBalance = 0;
      } catch {
        // Creation failed (race condition or other error), default to 0
        walletBalance = 0;
      }
    }

    return {
      id: userId,
      email: user.email,
      phone: user.phone || null,
      is_email_verified: user.isEmailVerified,
      vehicles: user.vehicles.map((v: any) => ({
        license_plate: v.licensePlate,
        nickname: v.nickname || null,
        is_default: v.isDefault,
      })),
      wallet_balance: walletBalance,
      created_at: user.createdAt?.toISOString() || null,
      updated_at: user.updatedAt?.toISOString() || null,
    };
  }
}
