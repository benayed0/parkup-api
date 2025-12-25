import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import * as QRCode from 'qrcode';
import {
  TicketToken,
  TicketTokenDocument,
  TokenStatus,
} from './schemas/ticket-token.schema';

export interface TokenVerificationResult {
  valid: boolean;
  ticketId?: string;
  error?: string;
  errorCode?: string;
}

export interface GeneratedTokenResult {
  token: string;
  qrCodeDataUrl: string;
  qrCodeContent: string;
  expiresAt: Date;
}

@Injectable()
export class TicketTokensService {
  private readonly tokenSecret: string;
  private readonly baseUrl: string;
  private readonly defaultExpirationDays: number = 365; // Tokens valid for 1 year by default

  constructor(
    @InjectModel(TicketToken.name)
    private ticketTokenModel: Model<TicketTokenDocument>,
    private configService: ConfigService,
  ) {
    this.tokenSecret =
      this.configService.get<string>('TICKET_TOKEN_SECRET') ||
      this.configService.get<string>('JWT_SECRET') ||
      'default-secret-change-in-production';
    this.baseUrl =
      this.configService.get<string>('APP_BASE_URL') || 'http://localhost:3000';
  }

  /**
   * Generate a cryptographically secure token for a ticket
   */
  private generateSecureToken(ticketId: string): string {
    const timestamp = Date.now().toString(36);
    const randomBytes = crypto.randomBytes(16).toString('hex');
    const payload = `${ticketId}:${timestamp}:${randomBytes}`;

    // Create HMAC signature for integrity verification
    const signature = crypto
      .createHmac('sha256', this.tokenSecret)
      .update(payload)
      .digest('hex')
      .substring(0, 16);

    // Combine into a URL-safe token
    const token = Buffer.from(`${payload}:${signature}`).toString('base64url');

    return token;
  }

  /**
   * Verify token signature integrity (without database lookup)
   */
  private verifyTokenSignature(token: string): {
    valid: boolean;
    ticketId?: string;
  } {
    try {
      const decoded = Buffer.from(token, 'base64url').toString('utf-8');
      const parts = decoded.split(':');

      if (parts.length !== 4) {
        return { valid: false };
      }

      const [ticketId, timestamp, randomBytes, providedSignature] = parts;
      const payload = `${ticketId}:${timestamp}:${randomBytes}`;

      const expectedSignature = crypto
        .createHmac('sha256', this.tokenSecret)
        .update(payload)
        .digest('hex')
        .substring(0, 16);

      if (providedSignature !== expectedSignature) {
        return { valid: false };
      }

      return { valid: true, ticketId };
    } catch {
      return { valid: false };
    }
  }

  /**
   * Generate a secure token and QR code for a ticket
   */
  async generateTokenForTicket(
    ticketId: string,
    expirationDays?: number,
  ): Promise<GeneratedTokenResult> {
    // Validate ticketId format
    if (!Types.ObjectId.isValid(ticketId)) {
      throw new BadRequestException('Invalid ticket ID format');
    }

    // Check if an active token already exists for this ticket
    const existingToken = await this.ticketTokenModel.findOne({
      ticketId: new Types.ObjectId(ticketId),
      status: TokenStatus.ACTIVE,
      expiresAt: { $gt: new Date() },
    });

    if (existingToken) {
      // Return existing active token with regenerated QR code
      const qrContent = this.buildQrContent(existingToken.token);
      const qrCodeDataUrl = await this.generateQrDataUrl(qrContent);

      return {
        token: existingToken.token,
        qrCodeDataUrl,
        qrCodeContent: qrContent,
        expiresAt: existingToken.expiresAt,
      };
    }

    // Generate new token
    const token = this.generateSecureToken(ticketId);
    const expiresAt = new Date();
    expiresAt.setDate(
      expiresAt.getDate() + (expirationDays || this.defaultExpirationDays),
    );

    // Save token to database
    await this.ticketTokenModel.create({
      token,
      ticketId: new Types.ObjectId(ticketId),
      status: TokenStatus.ACTIVE,
      expiresAt,
    });

    // Generate QR code
    const qrContent = this.buildQrContent(token);
    const qrCodeDataUrl = await this.generateQrDataUrl(qrContent);

    return {
      token,
      qrCodeDataUrl,
      qrCodeContent: qrContent,
      expiresAt,
    };
  }

  /**
   * Verify a token and return the associated ticket ID
   */
  async verifyToken(
    token: string,
    clientIp?: string,
    userAgent?: string,
  ): Promise<TokenVerificationResult> {
    // First, verify token signature integrity
    const signatureCheck = this.verifyTokenSignature(token);
    if (!signatureCheck.valid) {
      return {
        valid: false,
        error: 'Invalid token signature',
        errorCode: 'INVALID_SIGNATURE',
      };
    }

    // Look up token in database
    const tokenDoc = await this.ticketTokenModel.findOne({ token });

    if (!tokenDoc) {
      return {
        valid: false,
        error: 'Token not found',
        errorCode: 'TOKEN_NOT_FOUND',
      };
    }

    // Check token status
    if (tokenDoc.status === TokenStatus.REVOKED) {
      return {
        valid: false,
        error: 'Token has been revoked',
        errorCode: 'TOKEN_REVOKED',
      };
    }

    if (tokenDoc.status === TokenStatus.EXPIRED) {
      return {
        valid: false,
        error: 'Token has expired',
        errorCode: 'TOKEN_EXPIRED',
      };
    }

    // Check expiration
    if (tokenDoc.expiresAt < new Date()) {
      // Update status to expired
      await this.ticketTokenModel.updateOne(
        { _id: tokenDoc._id },
        { status: TokenStatus.EXPIRED },
      );

      return {
        valid: false,
        error: 'Token has expired',
        errorCode: 'TOKEN_EXPIRED',
      };
    }

    // Token is valid - update usage info (but don't mark as used, allow multiple scans)
    await this.ticketTokenModel.updateOne(
      { _id: tokenDoc._id },
      {
        usedAt: new Date(),
        usedByIp: clientIp,
        usedByUserAgent: userAgent,
      },
    );

    return {
      valid: true,
      ticketId: tokenDoc.ticketId.toString(),
    };
  }

  /**
   * Revoke a token (e.g., when ticket is paid or dismissed)
   */
  async revokeToken(ticketId: string): Promise<void> {
    if (!Types.ObjectId.isValid(ticketId)) {
      throw new BadRequestException('Invalid ticket ID format');
    }

    await this.ticketTokenModel.updateMany(
      {
        ticketId: new Types.ObjectId(ticketId),
        status: TokenStatus.ACTIVE,
      },
      {
        status: TokenStatus.REVOKED,
        revokedAt: new Date(),
      },
    );
  }

  /**
   * Get token info for a ticket
   */
  async getTokenForTicket(
    ticketId: string,
  ): Promise<TicketTokenDocument | null> {
    if (!Types.ObjectId.isValid(ticketId)) {
      throw new BadRequestException('Invalid ticket ID format');
    }

    return this.ticketTokenModel.findOne({
      ticketId: new Types.ObjectId(ticketId),
      status: TokenStatus.ACTIVE,
      expiresAt: { $gt: new Date() },
    });
  }

  /**
   * Regenerate QR code for an existing token
   */
  async regenerateQrCode(
    ticketId: string,
    size: number = 300,
  ): Promise<{ qrCodeDataUrl: string; qrCodeContent: string }> {
    const tokenDoc = await this.getTokenForTicket(ticketId);

    if (!tokenDoc) {
      throw new NotFoundException('No active token found for this ticket');
    }

    const qrContent = this.buildQrContent(tokenDoc.token);
    const qrCodeDataUrl = await this.generateQrDataUrl(qrContent, size);

    return {
      qrCodeDataUrl,
      qrCodeContent: qrContent,
    };
  }

  /**
   * Get QR code as image buffer for printing
   */
  async getQrCodeBuffer(
    ticketId: string,
    size: number = 300,
  ): Promise<{ buffer: Buffer; content: string }> {
    const tokenDoc = await this.getTokenForTicket(ticketId);

    if (!tokenDoc) {
      throw new NotFoundException('No active token found for this ticket');
    }

    const qrContent = this.buildQrContent(tokenDoc.token);
    const buffer = await QRCode.toBuffer(qrContent, {
      width: size,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
    });

    return { buffer, content: qrContent };
  }

  /**
   * Build the URL content for the QR code
   */
  private buildQrContent(token: string): string {
    return `${this.baseUrl}/api/v1/ticket-tokens/verify/${token}`;
  }

  /**
   * Generate QR code as data URL
   */
  private async generateQrDataUrl(
    content: string,
    size: number = 300,
  ): Promise<string> {
    return QRCode.toDataURL(content, {
      width: size,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
    });
  }
}
