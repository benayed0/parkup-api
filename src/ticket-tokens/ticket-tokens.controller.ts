import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Res,
  Req,
  HttpStatus,
  Query,
} from '@nestjs/common';
import { Response, Request } from 'express';
import { TicketTokensService } from './ticket-tokens.service';
import {
  GenerateTicketTokenDto,
  RegenerateQrCodeDto,
} from './dto/generate-ticket-token.dto';
import { ConfigService } from '@nestjs/config';

@Controller('ticket-tokens')
export class TicketTokensController {
  private readonly clientBaseUrl: string;

  constructor(
    private readonly ticketTokensService: TicketTokensService,
    private readonly configService: ConfigService,
  ) {
    this.clientBaseUrl =
      this.configService.get<string>('CLIENT_BASE_URL') ||
      'http://localhost:3001';
  }

  /**
   * Generate a secure token and QR code for a ticket
   * This is called when an agent creates a ticket
   */
  @Post('generate')
  async generateToken(@Body() generateDto: GenerateTicketTokenDto) {
    const result = await this.ticketTokensService.generateTokenForTicket(
      generateDto.ticketId,
      generateDto.expirationDays,
    );

    return {
      success: true,
      data: {
        token: result.token,
        qrCodeDataUrl: result.qrCodeDataUrl,
        qrCodeContent: result.qrCodeContent,
        expiresAt: result.expiresAt,
      },
    };
  }

  /**
   * Verify a token and redirect to client with ticket info
   * This is the endpoint that gets called when a user scans the QR code
   */
  @Get('verify/:token')
  async verifyToken(
    @Param('token') token: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const clientIp =
      req.headers['x-forwarded-for']?.toString() ||
      req.socket.remoteAddress ||
      'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';

    const result = await this.ticketTokensService.verifyToken(
      token,
      clientIp,
      userAgent,
    );

    if (!result.valid) {
      // Redirect to client error page
      const errorUrl = `${this.clientBaseUrl}/ticket/error?code=${result.errorCode}&message=${encodeURIComponent(result.error || 'Unknown error')}`;
      return res.redirect(HttpStatus.FOUND, errorUrl);
    }

    // Redirect to client ticket page with the ticket ID
    const successUrl = `${this.clientBaseUrl}/ticket/${result.ticketId}`;
    return res.redirect(HttpStatus.FOUND, successUrl);
  }

  /**
   * Verify a token and return JSON response (for API clients)
   */
  @Get('verify/:token/json')
  async verifyTokenJson(@Param('token') token: string, @Req() req: Request) {
    const clientIp =
      req.headers['x-forwarded-for']?.toString() ||
      req.socket.remoteAddress ||
      'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';

    const result = await this.ticketTokensService.verifyToken(
      token,
      clientIp,
      userAgent,
    );

    if (!result.valid) {
      return {
        success: false,
        error: result.error,
        errorCode: result.errorCode,
      };
    }

    return {
      success: true,
      data: {
        ticketId: result.ticketId,
      },
    };
  }

  /**
   * Regenerate QR code for an existing ticket token
   */
  @Post('regenerate-qr')
  async regenerateQrCode(@Body() regenerateDto: RegenerateQrCodeDto) {
    const result = await this.ticketTokensService.regenerateQrCode(
      regenerateDto.ticketId,
      regenerateDto.size,
    );

    return {
      success: true,
      data: result,
    };
  }

  /**
   * Get QR code as PNG image for a ticket (for printing)
   */
  @Get('qr/:ticketId/image')
  async getQrCodeImage(
    @Param('ticketId') ticketId: string,
    @Query('size') size: string,
    @Res() res: Response,
  ) {
    const qrSize = size ? parseInt(size, 10) : 300;
    const validSize = Math.min(Math.max(qrSize, 100), 1000);

    const result = await this.ticketTokensService.getQrCodeBuffer(
      ticketId,
      validSize,
    );

    res.set({
      'Content-Type': 'image/png',
      'Content-Length': result.buffer.length,
      'Cache-Control': 'public, max-age=3600',
    });

    return res.send(result.buffer);
  }

  /**
   * Get token info for a ticket
   */
  @Get('ticket/:ticketId')
  async getTokenForTicket(@Param('ticketId') ticketId: string) {
    const token = await this.ticketTokensService.getTokenForTicket(ticketId);

    if (!token) {
      return {
        success: false,
        error: 'No active token found for this ticket',
      };
    }

    return {
      success: true,
      data: {
        token: token.token,
        status: token.status,
        expiresAt: token.expiresAt,
        createdAt: token.createdAt,
        usedAt: token.usedAt,
      },
    };
  }

  /**
   * Revoke token for a ticket (when ticket is paid/dismissed)
   */
  @Post('revoke/:ticketId')
  async revokeToken(@Param('ticketId') ticketId: string) {
    await this.ticketTokensService.revokeToken(ticketId);

    return {
      success: true,
      message: 'Token revoked successfully',
    };
  }
}
