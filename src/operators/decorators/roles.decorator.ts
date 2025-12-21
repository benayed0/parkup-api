import { SetMetadata } from '@nestjs/common';
import { OperatorRole } from '../schemas/operator.schema';

export const ROLES_KEY = 'roles';

/**
 * Decorator to specify required roles for an endpoint.
 * Access is granted if the operator's role hierarchy level is >= any of the specified roles.
 *
 * Role hierarchy (higher = more privileges):
 * - super_admin: 100 (full access)
 * - admin: 75
 * - manager: 50
 * - supervisor: 25
 *
 * @example
 * // Only super_admin can access
 * @Roles(OperatorRole.SUPER_ADMIN)
 *
 * // Admin or higher (super_admin) can access
 * @Roles(OperatorRole.ADMIN)
 *
 * // Manager or higher can access
 * @Roles(OperatorRole.MANAGER)
 */
export const Roles = (...roles: OperatorRole[]) =>
  SetMetadata(ROLES_KEY, roles);
