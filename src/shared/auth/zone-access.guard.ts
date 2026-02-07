import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { TicketsService } from '../../tickets/tickets.service';
import { OperatorRole } from '../../operators/schemas/operator.schema';
import { Types } from 'mongoose';

/**
 * Guard that checks if the authenticated user has access to the ticket's parking zone.
 * - super_admin operators: full access
 * - Other operators: must have the zone in their zoneIds
 * - Agents: must have the zone in their assignedZones
 */
@Injectable()
export class ZoneAccessGuard implements CanActivate {
  constructor(
    @Inject(forwardRef(() => TicketsService))
    private ticketsService: TicketsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const userType = request.userType as 'operator' | 'agent';
    
    if (!user || !userType) {
      throw new ForbiddenException('Authentification requise');
    }

    // Get ticketId from params (handles both :id and :ticketId)
    const ticketId = request.params.id || request.params.ticketId;

    // For endpoints that get ticketId from body
    const bodyTicketId = request.body?.ticketId;

    const targetTicketId = ticketId || bodyTicketId;

    if (!targetTicketId) {
      // No ticket to check - allow (for non-ticket-specific endpoints like cleanup)
      return true;
    }

    // Validate ObjectId format
    if (!Types.ObjectId.isValid(targetTicketId)) {
      throw new ForbiddenException('Format de ticket invalide');
    }

    // Fetch ticket to get parkingZoneId
    const ticket = await this.ticketsService.findOne(targetTicketId);
    const ticketZoneId = ticket.parkingZoneId
    
    if (userType === 'operator') {
      return this.checkOperatorAccess(user, ticketZoneId);
    }

    if (userType === 'agent') {
      return this.checkAgentAccess(user, ticketZoneId);
    }

    throw new ForbiddenException('Type d\'utilisateur non reconnu');
  }

  private checkOperatorAccess(operator: any, ticketZoneId: any): boolean {
    // Super admin has full access
    if (operator.role === OperatorRole.SUPER_ADMIN) {
      return true;
    }

    // Check if operator's zoneIds includes the ticket's parkingZoneId
    const operatorZoneIds = (operator.zoneIds || []).map((z: Types.ObjectId | any) => {
      // Handle both populated and non-populated zoneIds
      if (typeof z === 'object' && z._id) {
        return z._id.toString();
      }
      return z.toString();
    });

    const  ticketZoneIdStr = typeof ticketZoneId=== 'object' && ticketZoneId._id ? ticketZoneId._id.toString() : ticketZoneId.toString();  
    
    if (operatorZoneIds.includes(ticketZoneIdStr)) {
      return true;
    }

    throw new ForbiddenException(
      'Vous n\'avez pas accès à cette zone de stationnement',
    );
  }

  private checkAgentAccess(agent: any, ticketZoneId: any): boolean {
    // Check if agent's assignedZones includes the ticket's parkingZoneId
    const agentZoneIds = (agent.assignedZones || []).map((z: Types.ObjectId | any) => {
      // Handle both populated and non-populated assignedZones
      if (typeof z === 'object' && z._id) {
        return z._id.toString();
      }
      return z.toString();
    });
    const ticketZoneIdStr = typeof ticketZoneId === 'object' && ticketZoneId._id ? ticketZoneId._id.toString() : ticketZoneId.toString();
    if (agentZoneIds.includes(ticketZoneIdStr)) {
      return true;
    }

    throw new ForbiddenException(
      'Vous n\'êtes pas assigné à cette zone de stationnement',
    );
  }
}
