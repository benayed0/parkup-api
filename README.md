# ParkUp API

<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

A smart parking management system API built with [NestJS](https://nestjs.com/) and MongoDB. ParkUp provides a comprehensive backend for parking zone management, real-time session tracking, ticket issuance, and payment processing.

## Table of Contents

1. [Overview](#overview)
2. [Quick Start](#quick-start)
3. [Architecture](#architecture)
4. [Authentication](#authentication)
5. [Database Schema](#database-schema)
6. [API Endpoints](#api-endpoints)
   - [Auth Endpoints](#auth-endpoints)
   - [Vehicle Endpoints](#vehicle-endpoints)
   - [Parking Endpoints](#parking-endpoints)
   - [Ticket Endpoints](#ticket-endpoints)
   - [Payment Endpoints](#payment-endpoints)
7. [Agents Module](#agents-module)
8. [Tickets Module](#tickets-module)
9. [Error Handling](#error-handling)
10. [Implementation Checklist](#implementation-checklist)
11. [Tech Stack](#tech-stack)
12. [Security](#security)
13. [License](#license)

---

## Overview

ParkUp is a comprehensive parking management platform that enables:

- **User Management**: OTP-based authentication, OAuth integration (Google/Facebook), and profile management
- **Vehicle Management**: Multiple vehicle registration with license plate tracking
- **Parking Zones**: Geolocation-based zone discovery with dynamic pricing
- **Parking Sessions**: Real-time session tracking with QR code ticket generation
- **Enforcement**: Agent-based ticket issuance for violations
- **Payments**: Multi-method payment support (wallet, card, cash) with Stripe integration
- **Analytics**: Comprehensive reporting and usage statistics

---

## Quick Start

### Installation

```bash
$ npm install
```

### Running the Application

```bash
# development mode
$ npm run start

# watch mode (auto-reload)
$ npm run start:dev

# production mode
$ npm run start:prod
```

### Testing

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

### Environment Setup

Create a `.env` file with the following variables:

```env
# Database
MONGODB_URI=mongodb://localhost:27017/parkup

# JWT
JWT_SECRET=your_jwt_secret
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_SECRET=your_refresh_secret
REFRESH_TOKEN_EXPIRES_IN=30d

# Email
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=noreply@parkup.tn
SMTP_PASS=your_smtp_password

# OAuth
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
FACEBOOK_APP_ID=your_facebook_app_id
FACEBOOK_APP_SECRET=your_facebook_app_secret

# Payment
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...

# App
BASE_URL=https://api.parkup.tn
API_VERSION=v1
```

---

## Architecture

### Service Layer Pattern

The application uses a modular architecture with clear separation of concerns:

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Controllers   │────▶│    Services      │────▶│   Repositories  │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                                                          │
                                                          ▼
                                                  ┌─────────────────┐
                                                  │    MongoDB      │
                                                  └─────────────────┘
```

### Module Structure

```
src/
├── agents/              # Enforcement agent management
├── auth/                # Authentication & authorization
├── parking-sessions/    # Active parking session tracking
├── parking-zones/       # Zone and meter management
├── payments/            # Payment processing
├── tickets/             # Violation ticket issuance
├── users/               # User profile and vehicle management
└── shared/              # Common utilities, guards, decorators
```

---

## Authentication

### Token-Based Auth (JWT)

The API uses JWT tokens with refresh capability:

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIs...",
  "user": { ... }
}
```

### OTP Flow

1. User enters email → `POST /auth/otp/send`
2. Backend sends 6-digit OTP via email
3. User enters OTP → `POST /auth/otp/verify`
4. Backend verifies and returns tokens + user profile

### OAuth Flow (Google/Facebook)

1. App handles OAuth redirect
2. App sends OAuth token to backend → `POST /auth/google` or `POST /auth/facebook`
3. Backend validates with provider
4. Backend creates/updates user and returns JWT tokens

---

## Database Schema

### Users Collection

```javascript
{
  _id: ObjectId("..."),
  email: "user@example.com",        // unique
  phone: "+216 12 345 678",
  isEmailVerified: true,
  vehicles: [                        // embedded array
    {
      licensePlate: "123 TUN 4567",
      nickname: "Ma voiture",
      isDefault: true
    }
  ],
  walletBalance: 25.000,
  createdAt: ISODate("2024-01-01T00:00:00Z"),
  updatedAt: ISODate("2024-01-15T00:00:00Z")
}

// Indexes
db.users.createIndex({ email: 1 }, { unique: true })
db.users.createIndex({ "vehicles.licensePlate": 1 })
```

### Parking Zones Collection

```javascript
{
  _id: ObjectId("..."),
  code: "SBS-001",                    // unique
  name: "Sidi Bou Said Centre",
  description: "Zone centre-ville",
  address: "Avenue Habib Bourguiba",
  hourlyRate: 1.500,
  dailyRate: 10.000,
  maxDurationMinutes: 480,
  isActive: true,
  location: {                         // GeoJSON
    type: "Point",
    coordinates: [10.3489, 36.8689]   // [longitude, latitude]
  },
  createdAt: ISODate("2024-01-01T00:00:00Z")
}

// Indexes
db.parkingZones.createIndex({ code: 1 }, { unique: true })
db.parkingZones.createIndex({ location: "2dsphere" })
db.parkingZones.createIndex({ isActive: 1 })
```

### Parking Sessions Collection

```javascript
{
  _id: ObjectId("..."),
  userId: ObjectId("..."),            // ref to users
  zoneId: ObjectId("..."),            // ref to parkingZones
  licensePlate: "123 TUN 4567",
  zoneName: "Sidi Bou Said Centre",   // denormalized
  startTime: ISODate("2024-01-01T10:00:00Z"),
  endTime: ISODate("2024-01-01T12:00:00Z"),
  durationMinutes: 120,
  amount: 3.000,
  status: "active",                   // active, completed, expired, cancelled
  ticketId: ObjectId("..."),          // ref to tickets
  createdAt: ISODate("2024-01-01T10:00:00Z"),
  updatedAt: ISODate("2024-01-01T10:00:00Z")
}

// Indexes
db.parkingSessions.createIndex({ userId: 1 })
db.parkingSessions.createIndex({ status: 1 })
db.parkingSessions.createIndex({ licensePlate: 1 })
db.parkingSessions.createIndex({ userId: 1, status: 1 })
db.parkingSessions.createIndex({ endTime: 1 })
```

### Tickets Collection

```javascript
{
  _id: ObjectId("..."),
  ticketNumber: "TKT-20241217-00001",  // unique
  meterId: ObjectId("..."),            // ref to parkingMeters
  parkingSessionId: ObjectId("..."),   // ref to parkingSessions (optional)
  userId: ObjectId("..."),             // ref to users (optional)
  agentId: ObjectId("..."),            // ref to agents (required)
  licensePlate: "123 TUN 4567",
  reason: "car_sabot",                 // car_sabot or pound
  fineAmount: 50,
  status: "pending",                   // pending, paid, appealed, dismissed, overdue
  issuedAt: ISODate("2024-01-01T10:30:00Z"),
  dueDate: ISODate("2024-12-31T23:59:59Z"),
  paidAt: ISODate("..."),
  paymentMethod: "wallet",             // wallet, card, cash
  notes: "Vehicle wheel-clamped",
  evidencePhotos: ["https://..."],
  appealReason: "...",
  appealedAt: ISODate("..."),
  createdAt: ISODate("2024-01-01T10:30:00Z"),
  updatedAt: ISODate("2024-01-01T10:30:00Z")
}

// Indexes
db.tickets.createIndex({ ticketNumber: 1 }, { unique: true })
db.tickets.createIndex({ userId: 1, status: 1 })
db.tickets.createIndex({ licensePlate: 1, status: 1 })
db.tickets.createIndex({ agentId: 1, issuedAt: -1 })
```

### Agents Collection

```javascript
{
  _id: ObjectId("..."),
  agentCode: "AGT-001",               // unique badge number
  name: "John Smith",
  email: "john.smith@parkup.com",     // unique
  phone: "+1234567890",
  password: "hashed_password",        // bcrypt hashed
  assignedZones: [ObjectId("..."), ObjectId("...")],
  isActive: true,
  createdAt: ISODate("2024-01-01T00:00:00Z"),
  updatedAt: ISODate("2024-01-01T00:00:00Z")
}

// Indexes
db.agents.createIndex({ agentCode: 1 }, { unique: true })
db.agents.createIndex({ email: 1 }, { unique: true })
db.agents.createIndex({ isActive: 1, agentCode: 1 })
```

### Payments Collection

```javascript
{
  _id: ObjectId("..."),
  userId: ObjectId("..."),
  sessionId: ObjectId("..."),         // optional
  paymentMethodId: ObjectId("..."),
  amount: 3.000,
  currency: "TND",
  status: "completed",                // pending, processing, completed, failed, refunded
  methodType: "card",                 // card, wallet, cash
  description: "Stationnement - Sidi Bou Said Centre",
  stripePaymentIntentId: "pi_...",
  createdAt: ISODate("2024-01-01T10:00:00Z"),
  completedAt: ISODate("2024-01-01T10:00:05Z")
}

// Indexes
db.payments.createIndex({ userId: 1 })
db.payments.createIndex({ sessionId: 1 })
db.payments.createIndex({ status: 1 })
db.payments.createIndex({ userId: 1, createdAt: -1 })
```

For complete schema details including all collections (Parking Meters, Payment Methods, OTP Codes, Refresh Tokens), see the inline documentation above.

---

## API Endpoints

### Base URL

```
https://api.parkup.tn/v1
```

### Standard Headers

```
Authorization: Bearer <access_token>
Content-Type: application/json
Accept: application/json
```

---

### Auth Endpoints

#### POST /auth/otp/send

Send OTP to email.

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

---

#### POST /auth/otp/verify

Verify OTP and authenticate.

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
    "vehicles": [...],
    "created_at": "2024-01-01T00:00:00Z"
  }
}
```

---

#### POST /auth/google

Authenticate with Google OAuth.

**Request:**
```json
{
  "id_token": "google_id_token_here"
}
```

**Response:** Same as OTP verify.

---

#### POST /auth/facebook

Authenticate with Facebook OAuth.

**Request:**
```json
{
  "access_token": "facebook_access_token_here"
}
```

**Response:** Same as OTP verify.

---

#### POST /auth/refresh

Refresh access token.

**Request:**
```json
{
  "refresh_token": "eyJhbGciOi..."
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

---

#### POST /auth/logout

Invalidate tokens.

**Headers:** Authorization required

**Response (200):**
```json
{
  "success": true
}
```

---

#### GET /auth/me

Get current user profile.

**Headers:** Authorization required

**Response (200):**
```json
{
  "user": { ... }
}
```

---

### Vehicle Endpoints

#### POST /users/me/vehicles

Add a vehicle to user profile.

**Request:**
```json
{
  "license_plate": "123 TUN 4567",
  "nickname": "Ma voiture",
  "is_default": true
}
```

**Response (200):**
```json
{
  "user": { ... }
}
```

---

#### PATCH /users/me/vehicles/{license_plate}

Update a vehicle.

**Request:**
```json
{
  "nickname": "Nouveau nom",
  "is_default": true
}
```

**Response (200):**
```json
{
  "user": { ... }
}
```

---

#### DELETE /users/me/vehicles/{license_plate}

Remove a vehicle.

**Response (200):**
```json
{
  "user": { ... }
}
```

---

### Parking Endpoints

#### GET /zones

Get all active parking zones.

**Response (200):**
```json
{
  "zones": [
    {
      "id": "uuid",
      "code": "SBS-001",
      "name": "Sidi Bou Said Centre",
      "hourly_rate": 1.5,
      "latitude": 36.8689,
      "longitude": 10.3489
    }
  ]
}
```

---

#### GET /meters

Get parking meters with geolocation filtering.

**Query params:**
- `latitude` (optional): Center latitude
- `longitude` (optional): Center longitude
- `radius` (optional): Search radius in meters (default 5000)

**Response (200):**
```json
{
  "meters": [
    {
      "id": "uuid",
      "zone_code": "SBS-001",
      "zone_name": "Sidi Bou Said Centre",
      "latitude": 36.8689,
      "longitude": 10.3489,
      "hourly_rate": 1.5,
      "available_spots": 15,
      "distance_meters": 250.5
    }
  ]
}
```

---

#### POST /parking/sessions

Start a parking session.

**Headers:** Authorization required

**Request:**
```json
{
  "license_plate": "123 TUN 4567",
  "zone_id": "uuid",
  "duration_minutes": 120,
  "amount": 3.0
}
```

**Response (201):**
```json
{
  "session": {
    "id": "uuid",
    "start_time": "2024-01-01T10:00:00Z",
    "end_time": "2024-01-01T12:00:00Z",
    "status": "active",
    "ticket_id": "uuid"
  },
  "ticket": {
    "id": "uuid",
    "qr_code": "PKP-ABC123XYZ"
  }
}
```

---

#### GET /parking/sessions/active

Get current active session for user.

**Headers:** Authorization required

**Response (200):**
```json
{
  "session": { ... } // or null
}
```

---

#### POST /parking/sessions/{session_id}/extend

Extend parking duration.

**Headers:** Authorization required

**Request:**
```json
{
  "additional_minutes": 60,
  "additional_amount": 1.5
}
```

**Response (200):**
```json
{
  "session": { ... }
}
```

---

### Ticket Endpoints

#### GET /tickets

Get user's parking tickets (for display).

**Headers:** Authorization required

**Query params:**
- `status` (optional): active, expired, verified

**Response (200):**
```json
{
  "tickets": [
    {
      "id": "uuid",
      "license_plate": "123 TUN 4567",
      "zone_name": "Sidi Bou Said Centre",
      "start_time": "2024-01-01T10:00:00Z",
      "end_time": "2024-01-01T12:00:00Z",
      "qr_code": "PKP-ABC123XYZ",
      "status": "active"
    }
  ]
}
```

---

#### GET /tickets/verify/{qr_code}

Verify ticket by QR code (for parking agents).

**Response (200):**
```json
{
  "is_valid": true,
  "message": "Ticket valide jusqu'à 12:00",
  "ticket": { ... },
  "verified_at": "2024-01-01T11:30:00Z"
}
```

---

### Payment Endpoints

#### GET /payments/methods

Get saved payment methods.

**Headers:** Authorization required

**Response (200):**
```json
{
  "methods": [
    {
      "id": "uuid",
      "type": "card",
      "display_name": "Visa ****4242",
      "is_default": true
    },
    {
      "id": "wallet",
      "type": "wallet",
      "display_name": "Portefeuille ParkUp"
    }
  ]
}
```

---

#### POST /payments

Process a payment.

**Headers:** Authorization required

**Request:**
```json
{
  "amount": 3.0,
  "description": "Stationnement - Sidi Bou Said Centre",
  "session_id": "uuid",
  "payment_method_id": "uuid",
  "method_type": "card"
}
```

**Response (200):**
```json
{
  "success": true,
  "payment": {
    "id": "uuid",
    "amount": 3.0,
    "status": "completed",
    "created_at": "2024-01-01T10:00:00Z"
  }
}
```

---

#### GET /wallet/balance

Get wallet balance.

**Headers:** Authorization required

**Response (200):**
```json
{
  "balance": 25.0,
  "currency": "TND"
}
```

---

#### POST /wallet/topup

Top up wallet balance.

**Headers:** Authorization required

**Request:**
```json
{
  "amount": 50.0,
  "payment_method_id": "uuid"
}
```

**Response (200):**
```json
{
  "success": true,
  "new_balance": 75.0
}
```

For complete API documentation including all endpoints, see the sections above.

---

## Agents Module

The Agents module manages enforcement officers who patrol parking zones and issue violation tickets.

### Overview

Agents authenticate with email/password and can:
- Patrol assigned parking zones
- Check vehicles for valid parking sessions
- Issue violation tickets
- View their enforcement history

### Agent Schema

| Field | Type | Description |
|-------|------|-------------|
| `agentCode` | string | Unique badge number (e.g., "AGT-001") |
| `name` | string | Agent's full name |
| `email` | string | Unique email (login credential) |
| `password` | string | Hashed with bcrypt |
| `assignedZones` | ObjectId[] | References to ParkingZone |
| `isActive` | boolean | Whether agent can login |

### Key Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/agents/login` | Agent authentication |
| `POST` | `/agents` | Create new agent |
| `GET` | `/agents` | List all agents |
| `GET` | `/agents/code/:agentCode` | Find by badge number |
| `PATCH` | `/agents/:id/zones` | Assign zones to agent |
| `PATCH` | `/agents/:id/change-password` | Change password |

### Agent Workflow

```
1. Agent logs in
   POST /agents/login { email, password }

2. Agent checks vehicle for active session
   GET /parking-sessions/plate/:licensePlate/active

3. If violation found, issue ticket
   POST /tickets {
     agentId, licensePlate, reason,
     fineAmount, issuedAt, dueDate
   }

4. Agent views issued tickets
   GET /tickets/agent/:agentId
```

---

## Tickets Module

The Tickets module handles parking violation tickets issued when vehicles are found without valid parking sessions.

### Overview

Tickets are issued for two types of violations:
- **Car Sabot** ($50): Vehicle wheel-clamped
- **Pound** ($100): Vehicle towed/impounded

### Ticket Schema

| Field | Type | Description |
|-------|------|-------------|
| `ticketNumber` | string | Auto-generated (TKT-YYYYMMDD-XXXXX) |
| `agentId` | ObjectId | Issuing agent (required) |
| `licensePlate` | string | Vehicle license plate |
| `reason` | enum | car_sabot or pound |
| `fineAmount` | number | Fine amount |
| `status` | enum | pending, paid, appealed, dismissed, overdue |
| `issuedAt` | Date | When ticket was issued |
| `dueDate` | Date | Payment deadline |
| `paidAt` | Date | Payment timestamp |

### Ticket Status Lifecycle

```
┌─────────────┐
│   PENDING   │◄──── Ticket issued
└──────┬──────┘
       │
       ├───────────────┬─────────────────┐
       ▼               ▼                 ▼
┌─────────────┐ ┌─────────────┐  ┌─────────────┐
│    PAID     │ │  APPEALED   │  │   OVERDUE   │
└─────────────┘ └──────┬──────┘  └─────────────┘
                       │
                       ▼
               ┌─────────────┐
               │  DISMISSED  │
               └─────────────┘
```

### Key Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/tickets` | Issue a new ticket |
| `GET` | `/tickets` | List tickets with filters |
| `GET` | `/tickets/number/:ticketNumber` | Find by ticket number |
| `GET` | `/tickets/check/:licensePlate` | Check unpaid tickets |
| `PATCH` | `/tickets/:id/pay` | Process payment |
| `PATCH` | `/tickets/:id/appeal` | Submit appeal |
| `GET` | `/tickets/user/:userId/stats` | Get user statistics |

### Issue a Ticket Example

```typescript
POST /api/v1/tickets
{
  "agentId": "64agent...",
  "licensePlate": "ABC 123",
  "reason": "car_sabot",
  "fineAmount": 50,
  "issuedAt": "2024-12-17T10:30:00Z",
  "dueDate": "2024-12-31T23:59:59Z",
  "notes": "Vehicle wheel-clamped"
}
```

---

## Error Handling

### Standard Error Response

```json
{
  "error": "Human-readable error message",
  "code": "ERROR_CODE",
  "details": {}
}
```

### Common Error Codes

| Code | HTTP | Description |
|------|------|-------------|
| `INVALID_OTP` | 401 | OTP code invalid or expired |
| `UNAUTHORIZED` | 401 | Missing or invalid token |
| `TOKEN_EXPIRED` | 401 | Access token expired |
| `NOT_FOUND` | 404 | Resource not found |
| `DUPLICATE_VEHICLE` | 409 | Vehicle already exists |
| `ACTIVE_SESSION_EXISTS` | 409 | User has active session |
| `CARD_DECLINED` | 402 | Payment card declined |
| `INSUFFICIENT_WALLET_BALANCE` | 402 | Wallet balance too low |

---

## Implementation Checklist

### Phase 1: Core Auth & User
- [ ] MongoDB setup with Mongoose models
- [ ] User registration/login with OTP
- [ ] JWT token generation & refresh
- [ ] User profile CRUD
- [ ] Vehicle management

### Phase 2: Parking
- [ ] Zones CRUD (admin)
- [ ] Meters CRUD (admin)
- [ ] Parking session lifecycle
- [ ] Ticket generation with QR codes
- [ ] Price calculation

### Phase 3: Payments
- [ ] Stripe/payment provider integration
- [ ] Payment methods management
- [ ] Payment processing
- [ ] Wallet system
- [ ] Refund handling

### Phase 4: Agent Features
- [ ] Ticket verification (QR + plate)
- [ ] Agent authentication
- [ ] Violation recording

### Phase 5: Admin & Analytics
- [ ] Admin dashboard
- [ ] Revenue reports
- [ ] Usage analytics
- [ ] Zone management UI

---

## Tech Stack

### Backend Framework
- **NestJS** with TypeScript
- **Express.js** HTTP server
- **Mongoose** ODM for MongoDB

### Database
- **MongoDB** - Document database
- **MongoDB Atlas** - Managed cloud hosting

### Authentication
- **JWT** - Token-based authentication
- **bcrypt** - Password hashing
- **Passport.js** - OAuth strategies

### Payment Processing
- **Stripe** - Payment gateway
- Consider **Flouci** or **Konnect** for Tunisia

### Development Tools
```
├── express / fastify    # HTTP framework
├── mongoose             # MongoDB ODM
├── jsonwebtoken         # JWT handling
├── bcrypt               # Password hashing
├── nodemailer           # Email OTP
├── stripe               # Payments
├── express-validator    # Input validation
├── helmet               # Security headers
└── cors                 # CORS handling
```

---

## Security

### Best Practices

1. **Never store plain card numbers** - use Stripe tokens
2. **Rate limit OTP endpoints** - prevent brute force attacks
3. **Validate license plates** - normalize format (uppercase, trim)
4. **Hash refresh tokens** - store hashed versions only
5. **HTTPS only** - no HTTP in production
6. **Input validation** - use class-validator in DTOs
7. **NoSQL injection prevention** - Mongoose sanitizes by default
8. **Helmet.js** - set security headers
9. **MongoDB user permissions** - use least privilege principle

### Environment Variables

Never commit sensitive data. Use environment variables for:
- Database connection strings
- JWT secrets
- API keys (Stripe, OAuth)
- SMTP credentials

---

## License

This project is [MIT licensed](LICENSE).

---

## Support

For questions or issues, please refer to:
- NestJS Documentation: [https://docs.nestjs.com](https://docs.nestjs.com)
- MongoDB Documentation: [https://docs.mongodb.com](https://docs.mongodb.com)
- Stripe API: [https://stripe.com/docs/api](https://stripe.com/docs/api)
