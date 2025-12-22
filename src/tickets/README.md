# Tickets Module

This module handles parking violation tickets issued when a vehicle is found parked without an active session or with an expired session.

## Overview

A ticket is issued by enforcement when:
- **Car Sabot**: Vehicle wheel-clamped for violation
- **Pound**: Vehicle towed/impounded

## Structure

```
src/tickets/
├── schemas/
│   └── ticket.schema.ts       # Mongoose schema & enums
├── dto/
│   ├── create-ticket.dto.ts   # Validation for creating tickets
│   ├── update-ticket.dto.ts   # Validation for updating tickets
│   ├── pay-ticket.dto.ts      # Validation for payment
│   ├── appeal-ticket.dto.ts   # Validation for appeals
│   └── index.ts               # Barrel exports
├── tickets.controller.ts      # REST API endpoints
├── tickets.service.ts         # Business logic
├── tickets.module.ts          # NestJS module configuration
├── index.ts                   # Module barrel exports
└── README.md                  # This file
```

## Schema

### Ticket Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `ticketNumber` | string | Yes | Auto-generated unique ID (TKT-YYYYMMDD-XXXXX) |
| `meterId` | ObjectId | Yes | Reference to ParkingMeter where violation occurred |
| `parkingSessionId` | ObjectId | No | Reference to expired/related ParkingSession |
| `userId` | ObjectId | No | Reference to User (if vehicle is linked) |
| `agentId` | ObjectId | Yes | Reference to Agent who issued the ticket |
| `licensePlate` | string | Yes | Vehicle license plate (uppercase, no spaces) |
| `reason` | TicketReason | Yes | Reason for the ticket |
| `fineAmount` | number | Yes | Fine amount in currency units |
| `status` | TicketStatus | Yes | Current ticket status (default: pending) |
| `issuedAt` | Date | Yes | When the ticket was issued |
| `dueDate` | Date | Yes | Payment deadline |
| `paidAt` | Date | No | When payment was made |
| `paymentMethod` | PaymentMethod | No | How the ticket was paid |
| `notes` | string | No | Additional notes from enforcement |
| `evidencePhotos` | string[] | No | URLs to evidence photos |
| `appealReason` | string | No | Reason provided when appealing |
| `appealedAt` | Date | No | When appeal was submitted |
| `createdAt` | Date | Auto | Mongoose timestamp |
| `updatedAt` | Date | Auto | Mongoose timestamp |

### Enums

```typescript
// Reason why ticket was issued
enum TicketReason {
  CAR_SABOT = 'car_sabot',
  POUND = 'pound',
}

// Current ticket status
enum TicketStatus {
  PENDING = 'pending',     // Awaiting payment
  PAID = 'paid',           // Payment received
  APPEALED = 'appealed',   // Under review
  DISMISSED = 'dismissed', // Appeal accepted, no payment required
  OVERDUE = 'overdue',     // Past due date, unpaid
}

// Payment methods
enum PaymentMethod {
  WALLET = 'wallet',
  CARD = 'card',
  CASH = 'cash',
}
```

## API Endpoints

Base path: `/api/v1/tickets`

### CRUD Operations

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/` | Create a new ticket |
| `GET` | `/` | List tickets with filters |
| `GET` | `/:id` | Get ticket by MongoDB ID |
| `PUT` | `/:id` | Update ticket |
| `DELETE` | `/:id` | Delete ticket |

### Lookup Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/number/:ticketNumber` | Find by ticket number (TKT-...) |
| `GET` | `/check/:licensePlate` | Check if plate has unpaid tickets |
| `GET` | `/user/:userId` | Get all tickets for a user |
| `GET` | `/user/:userId/stats` | Get ticket statistics for user |
| `GET` | `/agent/:agentId` | Get tickets issued by an agent |
| `GET` | `/plate/:licensePlate` | Get tickets by license plate |
| `GET` | `/session/:sessionId` | Get tickets linked to a session |

### Action Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `PATCH` | `/:id/pay` | Process ticket payment |
| `PATCH` | `/:id/appeal` | Submit an appeal |
| `PATCH` | `/:id/dismiss` | Dismiss ticket (admin) |
| `POST` | `/admin/update-overdue` | Mark past-due tickets as overdue |

## Query Parameters

The `GET /` endpoint supports these filters:

| Parameter | Type | Description |
|-----------|------|-------------|
| `userId` | string | Filter by user ID |
| `agentId` | string | Filter by agent ID |
| `status` | TicketStatus | Filter by status |
| `licensePlate` | string | Filter by license plate |
| `meterId` | string | Filter by meter ID |
| `reason` | TicketReason | Filter by reason |
| `limit` | number | Max results (default: 50) |
| `skip` | number | Pagination offset (default: 0) |

## Usage Examples

### Issue a Ticket

```typescript
// POST /api/v1/tickets
{
  "agentId": "64agent...",            // required - issuing agent
  "licensePlate": "ABC 123",
  "reason": "car_sabot",              // car_sabot ($50) or pound ($100)
  "fineAmount": 50,
  "issuedAt": "2024-12-17T10:30:00Z",
  "dueDate": "2024-12-31T23:59:59Z",
  "position": {
    "type": "Point",
    "coordinates": [10.1234, 36.5678]
  },
  "notes": "Vehicle wheel-clamped"    // optional
}

// Response
{
  "success": true,
  "data": {
    "_id": "64xyz...",
    "ticketNumber": "TKT-20241217-00001",
    ...
  }
}
```

### Check for Unpaid Tickets

```typescript
// GET /api/v1/tickets/check/ABC123

// Response
{
  "success": true,
  "data": {
    "hasUnpaidTickets": true,
    "tickets": [...],
    "count": 2
  }
}
```

### Pay a Ticket

```typescript
// PATCH /api/v1/tickets/:id/pay
{
  "paymentMethod": "wallet"
}

// Response
{
  "success": true,
  "data": {
    "status": "paid",
    "paidAt": "2024-12-17T15:00:00Z",
    "paymentMethod": "wallet",
    ...
  }
}
```

### Appeal a Ticket

```typescript
// PATCH /api/v1/tickets/:id/appeal
{
  "appealReason": "Meter was malfunctioning, session did not register"
}

// Response
{
  "success": true,
  "data": {
    "status": "appealed",
    "appealReason": "...",
    "appealedAt": "2024-12-17T16:00:00Z",
    ...
  }
}
```

### Get User Statistics

```typescript
// GET /api/v1/tickets/user/:userId/stats

// Response
{
  "success": true,
  "data": {
    "total": 5,
    "pending": 1,
    "paid": 3,
    "overdue": 1,
    "totalFines": 250,
    "unpaidFines": 100
  }
}
```

## Service Methods

The `TicketsService` provides these methods:

| Method | Description |
|--------|-------------|
| `create(dto)` | Create ticket with auto-generated number |
| `findAll(filters)` | Query tickets with filters |
| `findOne(id)` | Get single ticket by ID |
| `findByTicketNumber(num)` | Get by ticket number |
| `findByUserId(userId, opts)` | Get user's tickets |
| `findByAgentId(agentId, opts)` | Get agent's issued tickets |
| `findByLicensePlate(plate, opts)` | Get tickets by plate |
| `findUnpaidByLicensePlate(plate)` | Get unpaid tickets for plate |
| `findBySessionId(sessionId)` | Get tickets for a session |
| `hasUnpaidTickets(plate)` | Boolean check for unpaid |
| `update(id, dto)` | Update ticket fields |
| `pay(id, dto)` | Process payment |
| `appeal(id, dto)` | Submit appeal |
| `dismiss(id)` | Dismiss ticket (admin) |
| `remove(id)` | Delete ticket |
| `updateOverdueTickets()` | Bulk update overdue status |
| `getUserStats(userId)` | Aggregate statistics |

## Database Indexes

Optimized for common query patterns:

```typescript
// Single field indexes
ticketNumber: unique
meterId: 1
parkingSessionId: 1
userId: 1
agentId: 1
licensePlate: 1
status: 1

// Compound indexes
{ userId: 1, status: 1 }
{ licensePlate: 1, status: 1 }
{ meterId: 1, status: 1 }
{ agentId: 1, issuedAt: -1 }
{ issuedAt: -1 }
{ dueDate: 1, status: 1 }
```

## Integration Points

### With Agents
- Every ticket must have an `agentId` - the enforcement officer who issued it
- Query tickets by agent: `GET /tickets/agent/:agentId`
- Agent details populated in ticket responses

### With ParkingSessions
- Link ticket to expired session via `parkingSessionId`
- Query tickets for a specific session

### With Users
- Link ticket to user via `userId` (when vehicle is registered)
- Query all tickets for a user
- Deduct from wallet balance when paying

### With ParkingMeters
- Record where violation occurred via `meterId`
- Populate meter details in responses

## Ticket Lifecycle

```
┌─────────────┐
│   PENDING   │◄──── Ticket issued
└──────┬──────┘
       │
       ├───────────────┬─────────────────┐
       ▼               ▼                 ▼
┌─────────────┐ ┌─────────────┐  ┌─────────────┐
│    PAID     │ │  APPEALED   │  │   OVERDUE   │
└─────────────┘ └──────┬──────┘  └──────┬──────┘
                       │                │
                       ▼                │
               ┌─────────────┐          │
               │  DISMISSED  │          │
               └─────────────┘          │
                       ▲                │
                       └────────────────┘
                       (can also dismiss overdue)
```

## Cron Job Integration

Call `POST /api/v1/tickets/admin/update-overdue` periodically to mark pending tickets as overdue when past their due date.

```typescript
// Example cron setup (in a scheduler service)
@Cron('0 0 * * *') // Daily at midnight
async handleOverdueTickets() {
  await this.ticketsService.updateOverdueTickets();
}
```
