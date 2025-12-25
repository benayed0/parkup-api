# ParkUp API

A NestJS-based backend API for the ParkUp parking management system. This API handles parking zone management, session tracking, ticketing, user authentication, and payment processing.

## Table of Contents

- [Installation](#installation)
- [Running the Application](#running-the-application)
- [Testing](#testing)
- [API Documentation](#api-documentation)
  - [Authentication](#authentication)
  - [Users & Vehicles](#users--vehicles)
  - [Parking Zones](#parking-zones)
  - [Streets](#streets)
  - [Parking Sessions](#parking-sessions)
  - [QR Codes](#qr-codes)
  - [Tickets](#tickets)
  - [Agents](#agents)
  - [Operators](#operators)
  - [Wallet](#wallet)
- [Database Schema](#database-schema)
- [Error Handling](#error-handling)

---

## Installation

```bash
$ npm install
```

## Running the Application

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Testing

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

---

## API Documentation

Base URL: `https://api.parkup.tn/v1` (or your configured base URL)

### Common Headers

```
Authorization: Bearer <access_token>
Content-Type: application/json
Accept: application/json
```

---

## Authentication

### POST /auth/otp/send
Send OTP to email for authentication.

**Request:**
```json
{
  "email": "user@example.com"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "OTP envoyé"
}
```

### POST /auth/otp/verify
Verify OTP code and authenticate user.

**Request:**
```json
{
  "email": "user@example.com",
  "code": "123456"
}
```

**Response (200):**
```json
{
  "access_token": "eyJhbGciOi...",
  "refresh_token": "eyJhbGciOi...",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "phone": "+216 12 345 678",
    "is_email_verified": true,
    "vehicles": [],
    "wallet_balance": 0,
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": null
  }
}
```

### POST /auth/google
Authenticate with Google OAuth.

**Request:**
```json
{
  "idToken": "google_id_token_here",
  "accessToken": "google_access_token_here"
}
```

**Response:** Same as OTP verify

### POST /auth/facebook
Authenticate with Facebook OAuth.

**Request:**
```json
{
  "accessToken": "facebook_access_token_here"
}
```

**Response:** Same as OTP verify

### POST /auth/refresh
Refresh access token using refresh token.

**Request:**
```json
{
  "refreshToken": "eyJhbGciOi..."
}
```

**Response (200):**
```json
{
  "access_token": "eyJhbGciOi...",
  "refresh_token": "eyJhbGciOi...",
  "user": { ... }
}
```

### POST /auth/logout
Invalidate user tokens.

**Headers:** Authorization required

**Request (optional):**
```json
{
  "refreshToken": "eyJhbGciOi..."
}
```

**Response (200):**
```json
{
  "success": true
}
```

### GET /auth/me
Get current authenticated user profile.

**Headers:** Authorization required

**Response (200):**
```json
{
  "user": { ... }
}
```

### PATCH /auth/profile
Update user profile.

**Headers:** Authorization required

**Request:**
```json
{
  "phone": "+216 12 345 678"
}
```

**Response (200):**
```json
{
  "user": { ... }
}
```

---

## Users & Vehicles

### POST /users
Create a new user.

**Request:**
```json
{
  "email": "user@example.com",
  "phone": "+216 12 345 678"
}
```

### GET /users
Get all users with optional pagination.

**Query Parameters:**
- `limit` (number): Maximum results to return
- `skip` (number): Number of results to skip

### GET /users/:id
Get user by ID.

### PATCH /users/:id
Update user information.

### DELETE /users/:id
Delete a user.

### POST /users/:id/vehicles
Add a vehicle to user's account.

**Request:**
```json
{
  "licensePlate": "123 TUN 4567",
  "nickname": "Ma voiture",
  "isDefault": true
}
```

### PATCH /users/:id/vehicles/:licensePlate
Update vehicle information.

### DELETE /users/:id/vehicles/:licensePlate
Remove a vehicle from user's account.

---

## Parking Zones

### POST /zones
Create a new parking zone.

**Request:**
```json
{
  "code": "SBS-001",
  "name": "Sidi Bou Said Centre",
  "description": "Zone centre-ville",
  "address": "Avenue Habib Bourguiba",
  "hourlyRate": 1.5,
  "dailyRate": 10.0,
  "maxDurationMinutes": 480,
  "isActive": true,
  "location": {
    "type": "Point",
    "coordinates": [10.3489, 36.8689]
  }
}
```

### GET /zones
Get all parking zones.

**Query Parameters:**
- `isActive` (boolean): Filter by active status
- `limit` (number): Maximum results
- `skip` (number): Pagination offset

### GET /zones/admin
Get zones filtered by operator's assigned zones (requires operator authentication).

### GET /zones/code/:code
Get zone by zone code.

### GET /zones/:id
Get zone by ID.

### PUT /zones/:id
Update parking zone.

### DELETE /zones/:id
Delete a parking zone.

---

## Streets

### POST /streets
Create a new street.

**Request:**
```json
{
  "zoneId": "zone_id_here",
  "type": "payable",
  "points": [
    { "latitude": 36.869394, "longitude": 10.343393 },
    { "latitude": 36.867739, "longitude": 10.344717 }
  ],
  "isActive": true
}
```

### POST /streets/bulk
Create multiple streets at once.

### GET /streets
Get all streets.

**Query Parameters:**
- `zoneId` (string): Filter by zone
- `type` (string): Filter by type (prohibited, payable, free)
- `isActive` (boolean): Filter by active status
- `limit`, `skip`: Pagination

### GET /streets/admin
Get streets filtered by operator's zones (requires operator authentication).

### GET /streets/zone/:zoneId
Get all streets in a specific zone.

### GET /streets/:id
Get street by ID.

### PATCH /streets/:id
Update street information.

### DELETE /streets/:id
Delete a street.

### DELETE /streets/zone/:zoneId
Delete all streets in a zone.

---

## Parking Sessions

### POST /parking-sessions
Create a new parking session.

**Request:**
```json
{
  "userId": "user_id",
  "zoneId": "zone_id",
  "licensePlate": "123 TUN 4567",
  "durationMinutes": 120,
  "amount": 3.0
}
```

### GET /parking-sessions
Get all parking sessions with filters.

**Query Parameters:**
- `userId`: Filter by user
- `status`: Filter by status (active, completed, expired, cancelled)
- `licensePlate`: Filter by license plate
- `limit`, `skip`: Pagination

### GET /parking-sessions/user/:userId/active
Get user's currently active parking session.

### GET /parking-sessions/user/:userId/history
Get user's parking history.

### GET /parking-sessions/user/:userId
Get all sessions for a user.

### POST /parking-sessions/check-vehicle
Check vehicle for active session (structured request).

**Request:**
```json
{
  "plate": "123 TUN 4567",
  "zoneId": "zone_id"
}
```

### GET /parking-sessions/plate/:licensePlate/active
Get active sessions by license plate (legacy endpoint).

### GET /parking-sessions/:id
Get session by ID.

### PUT /parking-sessions/:id
Update parking session.

### PATCH /parking-sessions/:id/extend
Extend parking session duration.

**Request:**
```json
{
  "additionalMinutes": 60,
  "additionalAmount": 1.5
}
```

### PATCH /parking-sessions/:id/end
End parking session early.

### PATCH /parking-sessions/:id/cancel
Cancel parking session.

### DELETE /parking-sessions/:id
Delete a parking session.

### POST /parking-sessions/admin/update-expired
Update expired sessions (admin/cron endpoint).

---

## QR Codes

### GET /qr-codes/zone/:zoneId
Generate QR code data for a zone.

**Query Parameters:**
- `size` (number): QR code size in pixels (default: 300)

### GET /qr-codes/zone/:zoneId/image
Generate QR code image (PNG) for a zone.

**Query Parameters:**
- `size` (number): Image size in pixels (default: 300)

### POST /qr-codes
Generate QR code for a zone.

**Request:**
```json
{
  "zoneId": "zone_id",
  "size": 300
}
```

### POST /qr-codes/bulk
Generate QR codes for multiple zones.

**Request:**
```json
{
  "zoneIds": ["zone1", "zone2"],
  "size": 300
}
```

---

## Tickets

Parking violation tickets issued by enforcement agents.

### POST /tickets
Create a new parking ticket.

**Request:**
```json
{
  "agentId": "agent_id",
  "licensePlate": "ABC 123",
  "reason": "car_sabot",
  "fineAmount": 50,
  "issuedAt": "2024-12-17T10:30:00Z",
  "dueDate": "2024-12-31T23:59:59Z",
  "notes": "Vehicle wheel-clamped"
}
```

### GET /tickets
Get all tickets with filters.

**Query Parameters:**
- `userId`: Filter by user
- `agentId`: Filter by agent
- `status`: Filter by status (pending, paid, appealed, dismissed, overdue)
- `licensePlate`: Filter by license plate
- `plateLeft`, `plateRight`, `plateType`: Partial plate matching
- `reason`: Filter by reason (car_sabot, pound)
- `limit`, `skip`: Pagination

### GET /tickets/check/:licensePlate
Check if license plate has unpaid tickets.

### GET /tickets/user/:userId
Get all tickets for a user.

### GET /tickets/user/:userId/stats
Get ticket statistics for a user.

### GET /tickets/agent/:agentId
Get tickets issued by an agent.

### GET /tickets/plate/:licensePlate
Get tickets by license plate.

### GET /tickets/session/:sessionId
Get tickets linked to a parking session.

### GET /tickets/number/:ticketNumber
Get ticket by ticket number.

### GET /tickets/:id
Get ticket by ID.

### PUT /tickets/:id
Update ticket information.

### PATCH /tickets/:id/pay
Process ticket payment.

**Request:**
```json
{
  "paymentMethod": "wallet"
}
```

### PATCH /tickets/:id/appeal
Submit ticket appeal.

**Request:**
```json
{
  "appealReason": "Meter was malfunctioning"
}
```

### PATCH /tickets/:id/dismiss
Dismiss ticket (admin action).

### PATCH /tickets/:id/sabot_removed
Mark car sabot as removed.

### DELETE /tickets/:id
Delete a ticket.

### POST /tickets/admin/update-overdue
Update overdue tickets (admin/cron endpoint).

---

## Agents

Enforcement agents who issue parking tickets.

### POST /agents
Create a new agent.

**Request:**
```json
{
  "agentCode": "AGT-001",
  "name": "John Smith",
  "email": "john.smith@parkup.com",
  "phone": "+1234567890",
  "password": "securePassword123",
  "assignedZones": ["zone1", "zone2"]
}
```

### POST /agents/login
Agent login with email and password.

**Request:**
```json
{
  "email": "john.smith@parkup.com",
  "password": "securePassword123"
}
```

### GET /agents/me
Get current authenticated agent profile.

**Headers:** Authorization required

### GET /agents
Get all agents with filters.

**Query Parameters:**
- `isActive` (boolean): Filter by active status
- `zoneId`: Filter by assigned zone
- `limit`, `skip`: Pagination

### GET /agents/zone/:zoneId
Get agents assigned to a specific zone.

### GET /agents/:id
Get agent by ID.

### PUT /agents/:id
Update agent information.

### PATCH /agents/:id/change-password
Change agent password.

**Request:**
```json
{
  "currentPassword": "oldPassword",
  "newPassword": "newPassword123"
}
```

### PATCH /agents/:id/reset-password
Reset agent password (admin action).

### PATCH /agents/:id/activate
Activate agent account.

### PATCH /agents/:id/deactivate
Deactivate agent account.

### PATCH /agents/:id/zones
Assign zones to agent.

**Request:**
```json
{
  "zoneIds": ["zone1", "zone2"]
}
```

### DELETE /agents/:id
Delete an agent.

---

## Operators

Administrative operators with role-based access.

### POST /operators/auth/request-otp
Request OTP for operator authentication.

**Request:**
```json
{
  "email": "operator@parkup.com"
}
```

### POST /operators/auth/verify-otp
Verify OTP and authenticate operator.

**Request:**
```json
{
  "email": "operator@parkup.com",
  "otp": "123456"
}
```

### GET /operators/me
Get current operator profile.

**Headers:** Authorization required

### POST /operators
Create a new operator (Super Admin only).

**Request:**
```json
{
  "email": "operator@parkup.com",
  "name": "Operator Name",
  "role": "admin",
  "zoneIds": ["zone1"],
  "isActive": true
}
```

### GET /operators
Get all operators (Admin only).

**Query Parameters:**
- `isActive` (boolean): Filter by active status
- `role`: Filter by role (super_admin, admin, agent)
- `limit`, `skip`: Pagination

### GET /operators/:id
Get operator by ID (Admin only).

### PUT /operators/:id
Update operator (Super Admin only).

### DELETE /operators/:id
Delete operator (Super Admin only).

### PUT /operators/:id/activate
Activate operator account (Super Admin only).

### PUT /operators/:id/deactivate
Deactivate operator account (Super Admin only).

### PUT /operators/:id/zones
Update operator's assigned zones (Super Admin only).

**Request:**
```json
{
  "zoneIds": ["zone1", "zone2"]
}
```

---

## Wallet

User wallet system for managing parking payments.

### GET /wallet
Get current user's wallet balance.

**Headers:** Authorization required

**Response:**
```json
{
  "success": true,
  "data": {
    "userId": "user_id",
    "balance": 25.0,
    "currency": "TND"
  }
}
```

### GET /wallet/transactions
Get wallet transaction history.

**Headers:** Authorization required

**Query Parameters:**
- `limit` (number): Max results (default: 50)
- `skip` (number): Pagination offset

### POST /wallet/topup
Add funds to wallet.

**Headers:** Authorization required

**Request:**
```json
{
  "amount": 50.0,
  "referenceId": "payment_reference"
}
```

### POST /wallet/pay
Pay from wallet (deduct funds).

**Headers:** Authorization required

**Request:**
```json
{
  "amount": 3.0,
  "reason": "parking_payment",
  "referenceId": "session_id"
}
```

---

## Database Schema

The API uses MongoDB with the following main collections:

- **users**: User accounts and vehicles
- **parkingZones**: Parking zone definitions
- **streets**: Street segments within zones
- **parkingSessions**: Active and historical parking sessions
- **tickets**: Parking violation tickets
- **agents**: Enforcement agents
- **operators**: Administrative operators
- **wallets**: User wallet balances
- **walletTransactions**: Wallet transaction history
- **otpCodes**: One-time password codes (with TTL)
- **refreshTokens**: Refresh tokens (with TTL)

For detailed schema information, refer to `BACKEND_GUIDE.md`.

---

## Error Handling

All endpoints return errors in a consistent format:

```json
{
  "error": "Human-readable error message",
  "code": "ERROR_CODE",
  "details": {}
}
```

### Common Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `INVALID_OTP` | 401 | OTP code invalid or expired |
| `UNAUTHORIZED` | 401 | Missing or invalid token |
| `TOKEN_EXPIRED` | 401 | Access token expired |
| `NOT_FOUND` | 404 | Resource not found |
| `DUPLICATE_VEHICLE` | 409 | Vehicle already exists |
| `ACTIVE_SESSION_EXISTS` | 409 | User already has active session |
| `INSUFFICIENT_FUNDS` | 402 | Insufficient wallet balance |

---

## License

Nest is [MIT licensed](LICENSE).
