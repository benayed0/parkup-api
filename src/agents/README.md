# Agents Module

This module handles enforcement agents who patrol parking zones and issue tickets for parking violations.

## Overview

An agent is an enforcement officer who:
- Authenticates with email/password
- Patrols assigned parking zones
- Checks vehicles for valid parking sessions
- Issues tickets when violations are found

## Structure

```
src/agents/
├── schemas/
│   └── agent.schema.ts        # Mongoose schema
├── dto/
│   ├── create-agent.dto.ts    # Validation for creating agents
│   ├── update-agent.dto.ts    # Validation for updating agents
│   ├── login-agent.dto.ts     # Validation for login
│   ├── change-password.dto.ts # Validation for password change
│   └── index.ts               # Barrel exports
├── agents.controller.ts       # REST API endpoints
├── agents.service.ts          # Business logic
├── agents.module.ts           # NestJS module configuration
├── index.ts                   # Module barrel exports
└── README.md                  # This file
```

## Schema

### Agent Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `agentCode` | string | Yes | Unique badge number (e.g., "AGT-001"), uppercase |
| `name` | string | Yes | Agent's full name |
| `email` | string | Yes | Unique email address, lowercase |
| `phone` | string | No | Phone number |
| `password` | string | Yes | Hashed password (excluded from queries by default) |
| `assignedZones` | ObjectId[] | No | References to ParkingZone |
| `isActive` | boolean | Yes | Whether agent can login/work (default: true) |
| `createdAt` | Date | Auto | Mongoose timestamp |
| `updatedAt` | Date | Auto | Mongoose timestamp |

## API Endpoints

Base path: `/api/v1/agents`

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/login` | Agent login with email/password |

### CRUD Operations

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/` | Create a new agent |
| `GET` | `/` | List agents with filters |
| `GET` | `/:id` | Get agent by MongoDB ID |
| `PUT` | `/:id` | Update agent |
| `DELETE` | `/:id` | Delete agent |

### Lookup Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/code/:agentCode` | Find by agent code (badge number) |
| `GET` | `/zone/:zoneId` | Get agents assigned to a zone |

### Account Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| `PATCH` | `/:id/change-password` | Agent changes own password |
| `PATCH` | `/:id/reset-password` | Admin resets agent password |
| `PATCH` | `/:id/activate` | Activate agent account |
| `PATCH` | `/:id/deactivate` | Deactivate agent account |
| `PATCH` | `/:id/zones` | Assign zones to agent |

## Query Parameters

The `GET /` endpoint supports these filters:

| Parameter | Type | Description |
|-----------|------|-------------|
| `isActive` | boolean | Filter by active status |
| `zoneId` | string | Filter by assigned zone |
| `limit` | number | Max results (default: 50) |
| `skip` | number | Pagination offset (default: 0) |

## Usage Examples

### Create an Agent

```typescript
// POST /api/v1/agents
{
  "agentCode": "AGT-001",
  "name": "John Smith",
  "email": "john.smith@parkup.com",
  "phone": "+1234567890",
  "password": "securePassword123",
  "assignedZones": ["64abc123...", "64def456..."]
}

// Response
{
  "success": true,
  "data": {
    "_id": "64xyz...",
    "agentCode": "AGT-001",
    "name": "John Smith",
    "email": "john.smith@parkup.com",
    "phone": "+1234567890",
    "assignedZones": [...],
    "isActive": true,
    "createdAt": "2024-12-17T10:00:00Z",
    "updatedAt": "2024-12-17T10:00:00Z"
  }
}
```

### Agent Login

```typescript
// POST /api/v1/agents/login
{
  "email": "john.smith@parkup.com",
  "password": "securePassword123"
}

// Response
{
  "success": true,
  "data": {
    "agent": {
      "_id": "64xyz...",
      "agentCode": "AGT-001",
      "name": "John Smith",
      "email": "john.smith@parkup.com",
      ...
    }
  }
}
```

### Assign Zones to Agent

```typescript
// PATCH /api/v1/agents/:id/zones
{
  "zoneIds": ["64abc123...", "64def456...", "64ghi789..."]
}

// Response
{
  "success": true,
  "data": {
    "_id": "64xyz...",
    "agentCode": "AGT-001",
    "assignedZones": [
      { "_id": "64abc123...", "code": "ZONE-A", "name": "Downtown" },
      { "_id": "64def456...", "code": "ZONE-B", "name": "Uptown" },
      { "_id": "64ghi789...", "code": "ZONE-C", "name": "Midtown" }
    ],
    ...
  }
}
```

### Change Password

```typescript
// PATCH /api/v1/agents/:id/change-password
{
  "currentPassword": "oldPassword123",
  "newPassword": "newSecurePassword456"
}

// Response
{
  "success": true,
  "message": "Password changed successfully"
}
```

### Get Agents by Zone

```typescript
// GET /api/v1/agents/zone/:zoneId

// Response
{
  "success": true,
  "data": [
    { "_id": "...", "agentCode": "AGT-001", "name": "John Smith", ... },
    { "_id": "...", "agentCode": "AGT-002", "name": "Jane Doe", ... }
  ],
  "count": 2
}
```

## Service Methods

The `AgentsService` provides these methods:

| Method | Description |
|--------|-------------|
| `create(dto)` | Create new agent with hashed password |
| `login(dto)` | Validate credentials and return agent |
| `findAll(filters)` | Query agents with filters |
| `findOne(id)` | Get single agent by ID |
| `findByAgentCode(code)` | Get by badge number |
| `findByEmail(email)` | Get by email address |
| `findByZone(zoneId)` | Get active agents in zone |
| `update(id, dto)` | Update agent fields |
| `changePassword(id, dto)` | Change password (requires current) |
| `resetPassword(id, newPwd)` | Admin reset password |
| `activate(id)` | Set isActive to true |
| `deactivate(id)` | Set isActive to false |
| `assignZones(id, zoneIds)` | Update assigned zones |
| `remove(id)` | Delete agent |

## Database Indexes

```typescript
// Single field indexes
agentCode: unique
email: unique

// Compound indexes
{ isActive: 1, agentCode: 1 }
```

## Security Notes

- Passwords are hashed using bcrypt with salt rounds of 10
- Password field is excluded from queries by default (`select: false`)
- Login checks both credentials and `isActive` status
- Deactivated agents cannot log in

## Integration with Tickets

When an agent issues a ticket, their `_id` is stored as `agentId` in the Ticket document:

```typescript
// Creating a ticket as an agent
POST /api/v1/tickets
{
  "agentId": "64agent...",  // Required - the issuing agent
  "licensePlate": "ABC 123",
  "reason": "car_sabot",    // car_sabot ($50) or pound ($100)
  "fineAmount": 50,
  "issuedAt": "2024-12-17T10:30:00Z",
  "dueDate": "2024-12-31T23:59:59Z",
  "position": { "type": "Point", "coordinates": [10.1234, 36.5678] }
}
```

### Querying Tickets by Agent

```typescript
// Get all tickets issued by an agent
GET /api/v1/tickets/agent/:agentId

// Filter tickets by agent
GET /api/v1/tickets?agentId=64agent...
```

## Typical Enforcement Flow

```
1. Agent logs in
   POST /agents/login { email, password }

2. Agent checks a vehicle's license plate
   GET /parking-sessions/plate/:licensePlate/active

3. If violation found, issue ticket:
   POST /tickets {
     agentId, licensePlate, position,
     reason: "car_sabot" or "pound",
     fineAmount, issuedAt, dueDate
   }

4. Agent can view their issued tickets
   GET /tickets/agent/:agentId
```
