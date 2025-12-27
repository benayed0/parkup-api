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
  Res,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Response, Request } from 'express';
import { ConfigService } from '@nestjs/config';
import { TicketsService } from './tickets.service';
import { TicketTokensService } from '../ticket-tokens/ticket-tokens.service';
import { CombinedJwtAuthGuard } from '../shared/auth/combined-jwt-auth.guard';
import { ZoneAccessGuard } from '../shared/auth/zone-access.guard';
import { OperatorJwtAuthGuard } from '../operators/guards/operator-jwt-auth.guard';
import { RolesGuard } from '../operators/guards/roles.guard';
import { Roles } from '../operators/decorators/roles.decorator';
import { OperatorRole } from '../operators/schemas/operator.schema';
import {
  CreateTicketDto,
  UpdateTicketDto,
  PayTicketDto,
  AppealTicketDto,
} from './dto';
import { TicketStatus, TicketReason } from './schemas/ticket.schema';

@Controller('tickets')
export class TicketsController {
  private readonly clientBaseUrl: string;

  constructor(
    private readonly ticketsService: TicketsService,
    private readonly ticketTokensService: TicketTokensService,
    private readonly configService: ConfigService,
  ) {
    this.clientBaseUrl =
      this.configService.get<string>('CLIENT_BASE_URL') ||
      'http://localhost:64372';
  }

  /**
   * Create a new ticket
   * POST /tickets
   */
  @Post()
  async create(@Body() createDto: CreateTicketDto) {
    const ticket = await this.ticketsService.create(createDto);
    return {
      success: true,
      data: ticket,
    };
  }

  /**
   * Create a new ticket with QR code for printing
   * POST /tickets/with-qr
   */
  @Post('with-qr')
  async createWithQrCode(@Body() createDto: CreateTicketDto) {
    const result = await this.ticketsService.createWithQrCode(createDto);
    return {
      success: true,
      data: {
        ticket: result.ticket,
        qrCode: result.qrCode,
      },
    };
  }

  /**
   * Get all tickets (with optional filters)
   * GET /tickets?userId=xxx&agentId=xxx&status=pending&licensePlate=ABC123&limit=10
   * Plate search: plateLeft, plateRight, plateType for partial matching
   */
  @Get()
  async findAll(
    @Query('userId') userId?: string,
    @Query('agentId') agentId?: string,
    @Query('status') status?: TicketStatus,
    @Query('licensePlate') licensePlate?: string,
    @Query('plateLeft') plateLeft?: string,
    @Query('plateRight') plateRight?: string,
    @Query('plateType') plateType?: string,
    @Query('reason') reason?: TicketReason,
    @Query('limit') limit?: string,
    @Query('skip') skip?: string,
  ) {
    const tickets = await this.ticketsService.findAll({
      userId,
      agentId,
      status,
      licensePlate,
      plateLeft,
      plateRight,
      plateType,
      reason,
      limit: limit ? parseInt(limit, 10) : undefined,
      skip: skip ? parseInt(skip, 10) : undefined,
    });
    return {
      success: true,
      data: tickets,
      count: tickets.length,
    };
  }

  /**
   * Check if a license plate has unpaid tickets
   * GET /tickets/check/:licensePlate
   */
  @Get('check/:licensePlate')
  async checkUnpaidTickets(@Param('licensePlate') licensePlate: string) {
    const hasUnpaid = await this.ticketsService.hasUnpaidTickets(licensePlate);
    const unpaidTickets = hasUnpaid
      ? await this.ticketsService.findUnpaidByLicensePlate(licensePlate)
      : [];
    return {
      success: true,
      data: {
        hasUnpaidTickets: hasUnpaid,
        tickets: unpaidTickets,
        count: unpaidTickets.length,
      },
    };
  }

  /**
   * Get user's tickets
   * GET /tickets/user/:userId
   */
  @Get('user/:userId')
  async findByUser(
    @Param('userId') userId: string,
    @Query('status') status?: TicketStatus,
    @Query('limit') limit?: string,
  ) {
    const tickets = await this.ticketsService.findByUserId(userId, {
      status,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
    return {
      success: true,
      data: tickets,
      count: tickets.length,
    };
  }

  /**
   * Get user's ticket statistics
   * GET /tickets/user/:userId/stats
   */
  @Get('user/:userId/stats')
  async getUserStats(@Param('userId') userId: string) {
    const stats = await this.ticketsService.getUserStats(userId);
    return {
      success: true,
      data: stats,
    };
  }

  /**
   * Get tickets issued by an agent
   * GET /tickets/agent/:agentId
   */
  @Get('agent/:agentId')
  async findByAgent(
    @Param('agentId') agentId: string,
    @Query('status') status?: TicketStatus,
    @Query('limit') limit?: string,
  ) {
    const tickets = await this.ticketsService.findByAgentId(agentId, {
      status,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
    return {
      success: true,
      data: tickets,
      count: tickets.length,
    };
  }

  /**
   * Get tickets by license plate
   * GET /tickets/plate/:licensePlate
   */
  @Get('plate/:licensePlate')
  async findByPlate(
    @Param('licensePlate') licensePlate: string,
    @Query('status') status?: TicketStatus,
  ) {
    const tickets = await this.ticketsService.findByLicensePlate(licensePlate, {
      status,
    });
    return {
      success: true,
      data: tickets,
      count: tickets.length,
    };
  }

  /**
   * Get tickets for a parking session
   * GET /tickets/session/:sessionId
   */
  @Get('session/:sessionId')
  async findBySession(@Param('sessionId') sessionId: string) {
    const tickets = await this.ticketsService.findBySessionId(sessionId);
    return {
      success: true,
      data: tickets,
      count: tickets.length,
    };
  }

  /**
   * Get ticket by ticket number (6-char code for manual entry)
   * GET /tickets/number/:ticketNumber
   */
  @Get('number/:ticketNumber')
  async findByTicketNumber(@Param('ticketNumber') ticketNumber: string) {
    const ticket = await this.ticketsService.findByTicketNumber(ticketNumber);
    return {
      success: true,
      data: ticket,
    };
  }

  /**
   * Get QR code for a ticket (as JSON with data URL)
   * GET /tickets/:id/qr
   */
  @Get(':id/qr')
  async getQrCode(@Param('id') id: string) {
    const qrCode = await this.ticketsService.getQrCode(id);
    return {
      success: true,
      data: qrCode,
    };
  }

  /**
   * Get QR code for a ticket as PNG image (for printing)
   * GET /tickets/:id/qr/image?size=300
   */
  @Get(':id/qr/image')
  async getQrCodeImage(
    @Param('id') id: string,
    @Query('size') size: string,
    @Res() res: Response,
  ) {
    const qrSize = size ? parseInt(size, 10) : 300;
    const validSize = Math.min(Math.max(qrSize, 100), 1000);

    const result = await this.ticketsService.getQrCodeImage(id, validSize);

    res.set({
      'Content-Type': 'image/png',
      'Content-Length': result.buffer.length,
      'Cache-Control': 'public, max-age=3600',
    });

    return res.send(result.buffer);
  }

  /**
   * Get print-ready ticket data with structured lines and QR code
   * GET /tickets/:id/print
   */
  @Get(':id/print')
  async getPrintData(@Param('id') id: string) {
    const result = await this.ticketsService.getPrintData(id);
    return {
      success: true,
      data: result,
    };
  }

  /**
   * Get a single ticket by ID
   * GET /tickets/:id
   */
  @Get(':id')
  async findOne(@Param('id') id: string) {
    const ticket = await this.ticketsService.findOne(id);
    return {
      success: true,
      data: ticket,
    };
  }

  /**
   * Update a ticket
   * PUT /tickets/:id
   */
  @Put(':id')
  async update(@Param('id') id: string, @Body() updateDto: UpdateTicketDto) {
    const ticket = await this.ticketsService.update(id, updateDto);
    return {
      success: true,
      data: ticket,
    };
  }

  /**
   * Pay a ticket
   * PATCH /tickets/:id/pay
   */
  @Patch(':id/pay')
  async pay(@Param('id') id: string, @Body() payDto: PayTicketDto) {
    const ticket = await this.ticketsService.pay(id, payDto);
    return {
      success: true,
      data: ticket,
    };
  }

  /**
   * Appeal a ticket
   * PATCH /tickets/:id/appeal
   */
  @Patch(':id/appeal')
  async appeal(@Param('id') id: string, @Body() appealDto: AppealTicketDto) {
    const ticket = await this.ticketsService.appeal(id, appealDto);
    return {
      success: true,
      data: ticket,
    };
  }

  /**
   * Dismiss a ticket (admin action)
   * PATCH /tickets/:id/dismiss
   */
  @Patch(':id/dismiss')
  async dismiss(@Param('id') id: string) {
    const ticket = await this.ticketsService.dismiss(id);
    return {
      success: true,
      data: ticket,
    };
  } /**
   * Dismiss a ticket (admin action)
   * PATCH /tickets/:id/sabot_removed
   */
  @Patch(':id/sabot_removed')
  async sabotRemove(@Param('id') id: string) {
    const ticket = await this.ticketsService.sabotRemove(id);
    return {
      success: true,
      data: ticket,
    };
  }

  /**
   * Delete a ticket
   * DELETE /tickets/:id
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string) {
    await this.ticketsService.remove(id);
  }

  /**
   * Update overdue tickets (admin/cron endpoint)
   * POST /tickets/admin/update-overdue
   */
  @Post('admin/update-overdue')
  async updateOverdue() {
    const count = await this.ticketsService.updateOverdueTickets();
    return {
      success: true,
      message: `Updated ${count} overdue tickets`,
      count,
    };
  }

  // ========================
  // TOKEN ENDPOINTS (merged from ticket-tokens)
  // ========================

  /**
   * Generate a secure token and QR code for a ticket
   * POST /tickets/:id/token
   * Auth: Operator OR Agent with zone access
   */
  @Post(':id/token')
  @UseGuards(CombinedJwtAuthGuard, ZoneAccessGuard)
  async generateToken(
    @Param('id') id: string,
    @Body() body: { expirationDays?: number },
  ) {
    const result = await this.ticketTokensService.generateTokenForTicket(
      id,
      body.expirationDays,
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
   * GET /tickets/token/verify/:token
   * PUBLIC - for QR code scanning
   */
  @Get('token/verify/:token')
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
      const errorUrl = `${this.clientBaseUrl}/tickets/error?code=${result.errorCode}&message=${encodeURIComponent(result.error || 'Unknown error')}`;
      return res.redirect(HttpStatus.FOUND, errorUrl);
    }

    const successUrl = `${this.clientBaseUrl}/tickets/t/${token}`;
    return res.redirect(HttpStatus.FOUND, successUrl);
  }

  /**
   * Verify a token and return JSON response
   * GET /tickets/token/verify/:token/json
   * PUBLIC - for API clients
   */
  @Get('token/verify/:token/json')
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
   * POST /tickets/:id/token/regenerate-qr
   * Auth: Operator OR Agent with zone access
   */
  @Post(':id/token/regenerate-qr')
  @UseGuards(CombinedJwtAuthGuard, ZoneAccessGuard)
  async regenerateQrCode(
    @Param('id') id: string,
    @Body() body: { size?: number },
  ) {
    const result = await this.ticketTokensService.regenerateQrCode(
      id,
      body.size,
    );

    return {
      success: true,
      data: result,
    };
  }

  /**
   * Get token info for a ticket
   * GET /tickets/:id/token
   * Auth: Operator OR Agent with zone access
   */
  @Get(':id/token')
  @UseGuards(CombinedJwtAuthGuard, ZoneAccessGuard)
  async getTokenForTicket(@Param('id') id: string) {
    const token = await this.ticketTokensService.getTokenForTicket(id);

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
   * Revoke token for a ticket
   * POST /tickets/:id/token/revoke
   * Auth: Operator OR Agent with zone access
   */
  @Post(':id/token/revoke')
  @UseGuards(CombinedJwtAuthGuard, ZoneAccessGuard)
  async revokeToken(@Param('id') id: string) {
    await this.ticketTokensService.revokeToken(id);

    return {
      success: true,
      message: 'Token revoked successfully',
    };
  }

  /**
   * Cleanup old tokens (admin only)
   * POST /tickets/tokens/cleanup
   * Auth: Operator (super_admin only)
   */
  @Post('tokens/cleanup')
  @UseGuards(OperatorJwtAuthGuard, RolesGuard)
  @Roles(OperatorRole.SUPER_ADMIN)
  async cleanupTokens() {
    const result = await this.ticketTokensService.manualCleanup();

    return {
      success: true,
      message: `Cleanup completed: ${result.deletedCount} tokens deleted`,
      deletedCount: result.deletedCount,
    };
  }
}
