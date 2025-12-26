# ParkUp API

<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

A smart parking management system API built with [NestJS](https://nestjs.com/) and MongoDB. ParkUp provides a comprehensive backend for parking zone management, real-time session tracking, ticket management, and payment processing.

## Table of Contents

1. [Overview](#overview)
2. [Quick Start](#quick-start)
3. [Architecture](#architecture)
4. [Authentication](#authentication)
5. [Database Schema](#database-schema)
6. [API Endpoints](#api-endpoints)
   - [Root Endpoint](#root-endpoint)
   - [Auth Endpoints](#auth-endpoints)
   - [User Endpoints](#user-endpoints)
   - [Vehicle Endpoints](#vehicle-endpoints)
   - [Parking Zone Endpoints](#parking-zone-endpoints)
   - [Parking Session Endpoints](#parking-session-endpoints)
   - [Ticket Endpoints](#ticket-endpoints)
   - [Agent Endpoints](#agent-endpoints)
   - [Operator Endpoints](#operator-endpoints)
   - [Street Endpoints](#street-endpoints)
   - [QR Code Endpoints](#qr-code-endpoints)
   - [Wallet Endpoints](#wallet-endpoints)
   - [Wallet Admin Endpoints](#wallet-admin-endpoints)
7. [Agents Module](#agents-module)
8. [Operators Module](#operators-module)
9. [Streets Module](#streets-module)
10. [Tickets Module](#tickets-module)
11. [Ticket Tokens Module](#ticket-tokens-module)
12. [Error Handling](#error-handling)
13. [Implementation Checklist](#implementation-checklist)
14. [Tech Stack](#tech-stack)
15. [Security](#security)
16. [License](#license)

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
# Development: Use localhost
# Production: Use MongoDB Atlas or your cloud provider
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

# Ticket Tokens (Secure QR Codes)
TICKET_TOKEN_SECRET=your_secure_random_secret_min_32_chars
APP_BASE_URL=https://api.parkup.tn
CLIENT_BASE_URL=https://app.parkup.tn

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
├── ticket-tokens/       # Secure QR code tokens for tickets
├── users/               # User profile and vehicle management
├── wallet/              # User wallet management
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

### Additional Collections

For a complete database implementation, you'll also need:

- **Parking Meters Collection**: Stores individual parking meters with location and zone references
- **Payment Methods Collection**: User's saved payment methods (cards, wallet)
- **OTP Codes Collection**: Temporary OTP storage with TTL index (15-minute expiration)
- **Refresh Tokens Collection**: JWT refresh tokens with TTL index (30-day expiration)

See the BACKEND_GUIDE or refer to Mongoose schema files in the codebase for detailed field definitions.

---

## API Endpoints

### Base URL

```
https://api.parkup.tn/api/v1
```

### Standard Headers

```
Authorization: Bearer <access_token>
Content-Type: application/json
Accept: application/json
```

---

### Root Endpoint

#### GET /

Get API welcome message.

**Response (200):**
```json
{
  "message": "Hello from ParkUp API!"
}
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

#### PATCH /auth/profile

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
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "phone": "+216 12 345 678",
    "is_email_verified": true,
    "vehicles": [...],
    "wallet_balance": 25.0,
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-15T00:00:00Z"
  }
}
```

---

### User Endpoints

#### POST /users

Create a new user.

**Request:**
```json
{
  "email": "user@example.com",
  "phone": "+216 12 345 678"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "email": "user@example.com",
    "phone": "+216 12 345 678",
    "vehicles": [],
    "isEmailVerified": false
  }
}
```

---

#### GET /users

Get all users with optional pagination.

**Query params:**
- `limit` (optional): Number of results per page
- `skip` (optional): Number of results to skip

**Response (200):**
```json
{
  "success": true,
  "data": [...],
  "count": 50
}
```

---

#### GET /users/:id

Get a user by ID.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "email": "user@example.com",
    "vehicles": [...]
  }
}
```

---

#### PATCH /users/:id

Update a user.

**Request:**
```json
{
  "phone": "+216 98 765 432"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": { ... }
}
```

---

#### DELETE /users/:id

Delete a user.

**Response (204):** No content

---

### Vehicle Endpoints

#### POST /users/:id/vehicles

Add a vehicle to user profile.

**Request:**
```json
{
  "licensePlate": "123 TUN 4567",
  "nickname": "Ma voiture",
  "isDefault": true
}
```

**Response (200):**
```json
{
  "success": true,
  "data": { ... }
}
```

---

#### PATCH /users/:id/vehicles/:licensePlate

Update a vehicle.

**Request:**
```json
{
  "nickname": "Nouveau nom",
  "isDefault": true
}
```

**Response (200):**
```json
{
  "success": true,
  "data": { ... }
}
```

---

#### DELETE /users/:id/vehicles/:licensePlate

Remove a vehicle.

**Response (200):**
```json
{
  "success": true,
  "data": { ... }
}
```

---

### Parking Zone Endpoints

### Parking Zone Endpoints

#### POST /zones

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
  "location": {
    "type": "Point",
    "coordinates": [10.3489, 36.8689]
  }
}
```

**Response (200):**
```json
{
  "success": true,
  "data": { ... }
}
```

---

#### GET /zones

Get all active parking zones.

**Query params:**
- `isActive` (optional): Filter by active status (true/false)
- `limit` (optional): Number of results
- `skip` (optional): Pagination offset

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "code": "SBS-001",
      "name": "Sidi Bou Said Centre",
      "hourlyRate": 1.5,
      "location": {
        "type": "Point",
        "coordinates": [10.3489, 36.8689]
      }
    }
  ],
  "count": 1
}
```

---

#### GET /zones/admin

Get zones filtered by operator's assigned zones (authenticated operators only).

**Headers:** Authorization required (Operator token)

**Query params:** Same as GET /zones

**Response (200):**
```json
{
  "success": true,
  "data": [...],
  "count": 5
}
```

---

#### GET /zones/code/:code

Get zone by code.

**Response (200):**
```json
{
  "success": true,
  "data": { ... }
}
```

---

#### GET /zones/:id

Get zone by ID.

**Response (200):**
```json
{
  "success": true,
  "data": { ... }
}
```

---

#### PUT /zones/:id

Update a parking zone.

**Request:**
```json
{
  "name": "Updated Name",
  "hourlyRate": 2.0
}
```

**Response (200):**
```json
{
  "success": true,
  "data": { ... }
}
```

---

#### DELETE /zones/:id

Delete a parking zone.

**Response (204):** No content

---

### Parking Session Endpoints

### Parking Session Endpoints

#### POST /parking-sessions

Start a parking session.

**Request:**
```json
{
  "userId": "uuid",
  "zoneId": "uuid",
  "licensePlate": "123 TUN 4567",
  "zoneName": "Sidi Bou Said Centre",
  "durationMinutes": 120,
  "amount": 3.0
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "startTime": "2024-01-01T10:00:00Z",
    "endTime": "2024-01-01T12:00:00Z",
    "status": "active",
    "amount": 3.0
  }
}
```

---

#### GET /parking-sessions

Get all sessions with optional filters.

**Query params:**
- `userId` (optional): Filter by user ID
- `status` (optional): Filter by status (active, completed, expired, cancelled)
- `licensePlate` (optional): Filter by license plate
- `limit` (optional): Number of results
- `skip` (optional): Pagination offset

**Response (200):**
```json
{
  "success": true,
  "data": [...],
  "count": 10
}
```

---

#### GET /parking-sessions/user/:userId/active

Get user's active session.

**Response (200):**
```json
{
  "success": true,
  "data": { ... }
}
```

---

#### GET /parking-sessions/user/:userId/history

Get user's parking history.

**Query params:**
- `limit` (optional): Number of results (default 20)
- `skip` (optional): Pagination offset (default 0)

**Response (200):**
```json
{
  "success": true,
  "data": [...],
  "count": 20
}
```

---

#### GET /parking-sessions/user/:userId

Get all sessions for a user.

**Query params:**
- `status` (optional): Filter by status
- `limit` (optional): Number of results

**Response (200):**
```json
{
  "success": true,
  "data": [...],
  "count": 15
}
```

---

#### POST /parking-sessions/check-vehicle

Check vehicle by license plate (structured request).

**Request:**
```json
{
  "plate": "123 TUN 4567",
  "zoneId": "uuid"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": [...],
  "count": 1
}
```

---

#### GET /parking-sessions/plate/:licensePlate/active

Get active sessions by license plate (legacy).

**Response (200):**
```json
{
  "success": true,
  "data": [...],
  "count": 1
}
```

---

#### GET /parking-sessions/:id

Get a single session by ID.

**Response (200):**
```json
{
  "success": true,
  "data": { ... }
}
```

---

#### PUT /parking-sessions/:id

Update a parking session.

**Request:**
```json
{
  "status": "completed"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": { ... }
}
```

---

#### PATCH /parking-sessions/:id/extend

#### PATCH /parking-sessions/:id/extend

Extend parking duration.

**Request:**
```json
{
  "additionalMinutes": 60,
  "additionalAmount": 1.5
}
```

**Response (200):**
```json
{
  "success": true,
  "data": { ... }
}
```

---

#### PATCH /parking-sessions/:id/end

End a parking session.

**Response (200):**
```json
{
  "success": true,
  "data": { ... }
}
```

---

#### PATCH /parking-sessions/:id/cancel

Cancel a parking session.

**Response (200):**
```json
{
  "success": true,
  "data": { ... }
}
```

---

#### DELETE /parking-sessions/:id

Delete a parking session.

**Response (204):** No content

---

#### POST /parking-sessions/admin/update-expired

Update expired sessions (admin/cron endpoint).

**Response (200):**
```json
{
  "success": true,
  "message": "Updated 5 expired sessions",
  "count": 5
}
```

---

### Ticket Endpoints

### Ticket Endpoints

#### POST /tickets

Create a new ticket.

**Request:**
```json
{
  "agentId": "uuid",
  "licensePlate": "123 TUN 4567",
  "reason": "car_sabot",
  "fineAmount": 50,
  "issuedAt": "2024-01-01T10:30:00Z",
  "dueDate": "2024-12-31T23:59:59Z",
  "notes": "Vehicle wheel-clamped"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": { ... }
}
```

---

#### POST /tickets/with-qr

Create a new ticket with QR code for printing.

**Request:** Same as POST /tickets

**Response (200):**
```json
{
  "success": true,
  "data": {
    "ticket": { ... },
    "qrCode": {
      "token": "Njk0YTM4...",
      "qrCodeDataUrl": "data:image/png;base64,...",
      "qrCodeContent": "https://api.parkup.tn/api/v1/tickets/token/verify/Njk0YTM4..."
    }
  }
}
```

---

#### GET /tickets

Get all tickets with optional filters.

**Query params:**
- `userId` (optional): Filter by user ID
- `agentId` (optional): Filter by agent ID
- `status` (optional): Filter by status (pending, paid, appealed, dismissed, overdue)
- `licensePlate` (optional): Filter by complete license plate
- `plateLeft` (optional): Filter by left part of license plate
- `plateRight` (optional): Filter by right part of license plate
- `plateType` (optional): Filter by plate type
- `reason` (optional): Filter by reason (car_sabot, pound)
- `limit` (optional): Number of results
- `skip` (optional): Pagination offset

**Response (200):**
```json
{
  "success": true,
  "data": [...],
  "count": 10
}
```

---

#### GET /tickets/check/:licensePlate

Check if a license plate has unpaid tickets.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "hasUnpaidTickets": true,
    "tickets": [...],
    "count": 2
  }
}
```

---

#### GET /tickets/user/:userId

Get user's tickets.

**Query params:**
- `status` (optional): Filter by status
- `limit` (optional): Number of results

**Response (200):**
```json
{
  "success": true,
  "data": [...],
  "count": 5
}
```

---

#### GET /tickets/user/:userId/stats

Get user's ticket statistics.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "totalTickets": 10,
    "pending": 2,
    "paid": 7,
    "appealed": 1,
    "totalFines": 500
  }
}
```

---

#### GET /tickets/agent/:agentId

Get tickets issued by an agent.

**Query params:**
- `status` (optional): Filter by status
- `limit` (optional): Number of results

**Response (200):**
```json
{
  "success": true,
  "data": [...],
  "count": 15
}
```

---

#### GET /tickets/plate/:licensePlate

Get tickets by license plate.

**Query params:**
- `status` (optional): Filter by status

**Response (200):**
```json
{
  "success": true,
  "data": [...],
  "count": 3
}
```

---

#### GET /tickets/session/:sessionId

Get tickets for a parking session.

**Response (200):**
```json
{
  "success": true,
  "data": [...],
  "count": 1
}
```

---

#### GET /tickets/number/:ticketNumber

Get ticket by ticket number.

**Response (200):**
```json
{
  "success": true,
  "data": { ... }
}
```

---

#### GET /tickets/:id/qr

Get QR code for a ticket (as JSON with data URL).

**Response (200):**
```json
{
  "success": true,
  "data": {
    "token": "Njk0YTM4...",
    "qrCodeDataUrl": "data:image/png;base64,...",
    "qrCodeContent": "https://api.parkup.tn/api/v1/tickets/token/verify/Njk0YTM4..."
  }
}
```

---

#### GET /tickets/:id/qr/image

Get QR code as PNG image (for printing).

**Query params:**
- `size` (optional): Image size in pixels (100-1000, default 300)

**Response:** PNG image with `Content-Type: image/png`

---

#### GET /tickets/:id

Get a single ticket by ID.

**Response (200):**
```json
{
  "success": true,
  "data": { ... }
}
```

---

#### PUT /tickets/:id

Update a ticket.

**Request:**
```json
{
  "status": "paid",
  "notes": "Updated notes"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": { ... }
}
```

---

#### PATCH /tickets/:id/pay

Pay a ticket.

**Request:**
```json
{
  "paymentMethod": "wallet"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": { ... }
}
```

---

#### PATCH /tickets/:id/appeal

Appeal a ticket.

**Request:**
```json
{
  "appealReason": "I had a valid parking session"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": { ... }
}
```

---

#### PATCH /tickets/:id/dismiss

Dismiss a ticket (admin action).

**Response (200):**
```json
{
  "success": true,
  "data": { ... }
}
```

---

#### PATCH /tickets/:id/sabot_removed

Mark sabot as removed.

**Response (200):**
```json
{
  "success": true,
  "data": { ... }
}
```

---

#### DELETE /tickets/:id

Delete a ticket.

**Response (204):** No content

---

#### POST /tickets/admin/update-overdue

Update overdue tickets (admin/cron endpoint).

**Response (200):**
```json
{
  "success": true,
  "message": "Updated 3 overdue tickets",
  "count": 3
}
```

---

#### POST /tickets/:id/token

Generate a secure token and QR code for a ticket.

**Headers:** Authorization required (Operator or Agent with zone access)

**Request:**
```json
{
  "expirationDays": 365
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "token": "Njk0YTM4...",
    "qrCodeDataUrl": "data:image/png;base64,...",
    "qrCodeContent": "https://api.parkup.tn/api/v1/tickets/token/verify/Njk0YTM4...",
    "expiresAt": "2025-12-25T00:00:00Z"
  }
}
```

---

#### GET /tickets/token/verify/:token

Verify a token and redirect to client (browser redirect).

**Response:** Redirects to client app

---

#### GET /tickets/token/verify/:token/json

Verify a token and return JSON (for API clients).

**Response (200) - Success:**
```json
{
  "success": true,
  "data": {
    "ticketId": "64abc123..."
  }
}
```

**Response (200) - Error:**
```json
{
  "success": false,
  "error": "Token has expired",
  "errorCode": "TOKEN_EXPIRED"
}
```

---

#### POST /tickets/:id/token/regenerate-qr

Regenerate QR code for an existing ticket token.

**Headers:** Authorization required

**Request:**
```json
{
  "size": 300
}
```

**Response (200):**
```json
{
  "success": true,
  "data": { ... }
}
```

---

#### GET /tickets/:id/token

Get token info for a ticket.

**Headers:** Authorization required

**Response (200):**
```json
{
  "success": true,
  "data": {
    "token": "Njk0YTM4...",
    "status": "active",
    "expiresAt": "2025-12-25T00:00:00Z",
    "createdAt": "2024-01-01T00:00:00Z"
  }
}
```

---

#### POST /tickets/:id/token/revoke

Revoke token for a ticket.

**Headers:** Authorization required

**Response (200):**
```json
{
  "success": true,
  "message": "Token revoked successfully"
}
```

---

#### POST /tickets/tokens/cleanup

Cleanup old tokens (super admin only).

**Headers:** Authorization required (Super Admin)

**Response (200):**
```json
{
  "success": true,
  "message": "Cleanup completed: 42 tokens deleted",
  "deletedCount": 42
}
```

---

### Agent Endpoints

#### POST /agents

Create a new agent.

**Request:**
```json
{
  "agentCode": "AGT-001",
  "name": "John Smith",
  "email": "john.smith@parkup.com",
  "phone": "+1234567890",
  "password": "securePassword123",
  "assignedZones": ["zoneId1", "zoneId2"]
}
```

**Response (200):**
```json
{
  "success": true,
  "data": { ... }
}
```

---

#### POST /agents/login

Agent login.

**Request:**
```json
{
  "email": "john.smith@parkup.com",
  "password": "securePassword123"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOi...",
    "agent": { ... }
  }
}
```

---

#### GET /agents/me

Get current agent from JWT token.

**Headers:** Authorization required

**Response (200):**
```json
{
  "success": true,
  "data": {
    "agent": { ... }
  }
}
```

---

#### GET /agents

Get all agents with optional filters.

**Query params:**
- `isActive` (optional): Filter by active status (true/false)
- `zoneId` (optional): Filter by assigned zone
- `limit` (optional): Number of results
- `skip` (optional): Pagination offset

**Response (200):**
```json
{
  "success": true,
  "data": [...],
  "count": 10
}
```

---

#### GET /agents/zone/:zoneId

Get agents by zone.

**Response (200):**
```json
{
  "success": true,
  "data": [...],
  "count": 5
}
```

---

#### GET /agents/:id

Get a single agent by ID.

**Response (200):**
```json
{
  "success": true,
  "data": { ... }
}
```

---

#### PUT /agents/:id

Update an agent.

**Request:**
```json
{
  "name": "Updated Name",
  "phone": "+9876543210"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": { ... }
}
```

---

#### PATCH /agents/:id/change-password

Change agent password.

**Request:**
```json
{
  "oldPassword": "currentPassword",
  "newPassword": "newSecurePassword"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Password changed successfully"
}
```

---

#### PATCH /agents/:id/reset-password

Reset agent password (admin action).

**Request:**
```json
{
  "newPassword": "resetPassword123"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Password reset successfully"
}
```

---

#### PATCH /agents/:id/activate

Activate an agent.

**Response (200):**
```json
{
  "success": true,
  "data": { ... }
}
```

---

#### PATCH /agents/:id/deactivate

Deactivate an agent.

**Response (200):**
```json
{
  "success": true,
  "data": { ... }
}
```

---

#### PATCH /agents/:id/zones

Assign zones to an agent.

**Request:**
```json
{
  "zoneIds": ["zoneId1", "zoneId2", "zoneId3"]
}
```

**Response (200):**
```json
{
  "success": true,
  "data": { ... }
}
```

---

#### DELETE /agents/:id

Delete an agent.

**Response (204):** No content

---

### Operator Endpoints

#### POST /operators/auth/request-otp

Request OTP for operator authentication.

**Request:**
```json
{
  "phoneNumber": "+216 12 345 678"
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

#### POST /operators/auth/verify-otp

Verify OTP and authenticate operator.

**Request:**
```json
{
  "phoneNumber": "+216 12 345 678",
  "otp": "123456"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOi...",
    "operator": { ... }
  }
}
```

---

#### GET /operators/me

Get current operator profile.

**Headers:** Authorization required (Operator token)

**Response (200):**
```json
{
  "success": true,
  "data": { ... }
}
```

---

#### POST /operators

Create a new operator (super admin only).

**Headers:** Authorization required (Super Admin)

**Request:**
```json
{
  "name": "Operator Name",
  "phoneNumber": "+216 12 345 678",
  "role": "admin",
  "zoneIds": ["zoneId1", "zoneId2"]
}
```

**Response (200):**
```json
{
  "success": true,
  "data": { ... }
}
```

---

#### GET /operators

Get all operators (admin only).

**Headers:** Authorization required (Admin)

**Query params:**
- `isActive` (optional): Filter by active status
- `role` (optional): Filter by role (super_admin, admin, operator)
- `limit` (optional): Number of results
- `skip` (optional): Pagination offset

**Response (200):**
```json
{
  "success": true,
  "data": [...],
  "count": 10
}
```

---

#### GET /operators/:id

Get operator by ID (admin only).

**Headers:** Authorization required (Admin)

**Response (200):**
```json
{
  "success": true,
  "data": { ... }
}
```

---

#### PUT /operators/:id

Update an operator (super admin only).

**Headers:** Authorization required (Super Admin)

**Request:**
```json
{
  "name": "Updated Name",
  "role": "admin"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": { ... }
}
```

---

#### DELETE /operators/:id

Delete an operator (super admin only).

**Headers:** Authorization required (Super Admin)

**Response (204):** No content

---

#### PUT /operators/:id/activate

Activate an operator (super admin only).

**Headers:** Authorization required (Super Admin)

**Response (200):**
```json
{
  "success": true,
  "data": { ... },
  "message": "Opérateur activé"
}
```

---

#### PUT /operators/:id/deactivate

Deactivate an operator (super admin only).

**Headers:** Authorization required (Super Admin)

**Response (200):**
```json
{
  "success": true,
  "data": { ... },
  "message": "Opérateur désactivé"
}
```

---

#### PUT /operators/:id/zones

Update zones for an operator (super admin only).

**Headers:** Authorization required (Super Admin)

**Request:**
```json
{
  "zoneIds": ["zoneId1", "zoneId2", "zoneId3"]
}
```

**Response (200):**
```json
{
  "success": true,
  "data": { ... },
  "message": "Zones mises à jour"
}
```

---

### Street Endpoints

#### POST /streets

Create a new street.

**Request:**
```json
{
  "name": "Avenue Habib Bourguiba",
  "zoneId": "uuid",
  "type": "payable",
  "points": [
    { "latitude": 36.869394, "longitude": 10.343393 },
    { "latitude": 36.867739, "longitude": 10.344717 }
  ]
}
```

**Response (200):**
```json
{
  "success": true,
  "data": { ... }
}
```

---

#### POST /streets/bulk

Create multiple streets.

**Request:**
```json
[
  {
    "name": "Street 1",
    "zoneId": "uuid",
    "type": "payable",
    "points": [...]
  },
  {
    "name": "Street 2",
    "zoneId": "uuid",
    "type": "free",
    "points": [...]
  }
]
```

**Response (200):**
```json
{
  "success": true,
  "data": [...],
  "count": 2
}
```

---

#### GET /streets

Get all streets with optional filters.

**Query params:**
- `zoneId` (optional): Filter by zone ID
- `type` (optional): Filter by type (payable, free, prohibited)
- `isActive` (optional): Filter by active status (true/false)
- `limit` (optional): Number of results
- `skip` (optional): Pagination offset

**Response (200):**
```json
{
  "success": true,
  "data": [...],
  "count": 10
}
```

---

#### GET /streets/admin

Get streets filtered by operator's assigned zones.

**Headers:** Authorization required (Operator token)

**Query params:** Same as GET /streets

**Response (200):**
```json
{
  "success": true,
  "data": [...],
  "count": 5
}
```

---

#### GET /streets/zone/:zoneId

Get streets by zone.

**Response (200):**
```json
{
  "success": true,
  "data": [...],
  "count": 8
}
```

---

#### GET /streets/:id

Get street by ID.

**Response (200):**
```json
{
  "success": true,
  "data": { ... }
}
```

---

#### PATCH /streets/:id

Update a street.

**Request:**
```json
{
  "name": "Updated Street Name",
  "type": "prohibited"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": { ... }
}
```

---

#### DELETE /streets/:id

Delete a street.

**Response (200):**
```json
{
  "success": true,
  "data": null
}
```

---

#### DELETE /streets/zone/:zoneId

Delete all streets in a zone.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "deletedCount": 5
  }
}
```

---

### QR Code Endpoints

#### GET /qr-codes/zone/:zoneId

Generate QR code for a zone (as JSON with data URL).

**Query params:**
- `size` (optional): QR code size in pixels (default 300)

**Response (200):**
```json
{
  "success": true,
  "data": {
    "zoneId": "uuid",
    "dataUrl": "data:image/png;base64,...",
    "content": "zoneId-content"
  }
}
```

---

#### GET /qr-codes/zone/:zoneId/image

Generate QR code as PNG image.

**Query params:**
- `size` (optional): Image size in pixels (default 300)

**Response:** PNG image with `Content-Type: image/png`

---

#### POST /qr-codes

Generate QR code (POST endpoint).

**Request:**
```json
{
  "zoneId": "uuid",
  "size": 300
}
```

**Response (200):**
```json
{
  "success": true,
  "data": { ... }
}
```

---

#### POST /qr-codes/bulk

Generate QR codes for multiple zones.

**Request:**
```json
{
  "zoneIds": ["uuid1", "uuid2", "uuid3"],
  "size": 300
}
```

**Response (200):**
```json
{
  "success": true,
  "data": [...],
  "count": 3
}
```

---

### Wallet Endpoints

#### GET /wallet

Get current wallet balance.

**Headers:** Authorization required (User token)

**Response (200):**
```json
{
  "success": true,
  "data": {
    "userId": "uuid",
    "balance": 25.0,
    "currency": "TND"
  }
}
```

---

#### GET /wallet/transactions

Get wallet transaction history.

**Headers:** Authorization required (User token)

**Query params:**
- `limit` (optional): Number of results (default 50)
- `skip` (optional): Pagination offset (default 0)

**Response (200):**
```json
{
  "success": true,
  "data": [...],
  "count": 20
}
```

---

#### POST /wallet/topup

Top up wallet (add funds).

**Headers:** Authorization required (User token)

**Request:**
```json
{
  "amount": 50.0,
  "referenceId": "payment_intent_id"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "newBalance": 75.0,
    "transaction": { ... }
  }
}
```

---

#### POST /wallet/pay

Pay from wallet (deduct funds).

**Headers:** Authorization required (User token)

**Request:**
```json
{
  "amount": 10.0,
  "reason": "parking_payment",
  "referenceId": "session_id"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "newBalance": 65.0,
    "transaction": { ... }
  }
}
```

---

### Wallet Admin Endpoints

#### GET /wallets

Get all wallets (admin only).

**Headers:** Authorization required (Admin token)

**Query params:**
- `limit` (optional): Number of results (default 50)
- `skip` (optional): Pagination offset (default 0)

**Response (200):**
```json
{
  "success": true,
  "data": [...],
  "count": 50,
  "total": 500
}
```

---

#### GET /wallets/user/:userId

Get wallet by user ID (admin only).

**Headers:** Authorization required (Admin token)

**Response (200):**
```json
{
  "success": true,
  "data": { ... }
}
```

---

#### GET /wallets/transactions

Get all transactions (admin only).

**Headers:** Authorization required (Admin token)

**Query params:**
- `limit` (optional): Number of results (default 50)
- `skip` (optional): Pagination offset (default 0)
- `userId` (optional): Filter by user ID
- `type` (optional): Filter by type (credit, debit)
- `reason` (optional): Filter by reason

**Response (200):**
```json
{
  "success": true,
  "data": [...],
  "count": 50,
  "total": 1000
}
```

---

#### GET /wallets/user/:userId/transactions

Get transactions for a specific user (admin only).

**Headers:** Authorization required (Admin token)

**Query params:**
- `limit` (optional): Number of results (default 50)
- `skip` (optional): Pagination offset (default 0)

**Response (200):**
```json
{
  "success": true,
  "data": [...],
  "count": 20
}
```

---

#### POST /wallets/user/:userId/credit

Credit a user's wallet (admin only).

**Headers:** Authorization required (Admin token)

**Request:**
```json
{
  "amount": 100.0,
  "reason": "adjustment"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "newBalance": 125.0,
    "transaction": { ... }
  }
}
```

---

#### POST /wallets/user/:userId/rebuild

Rebuild a user's wallet balance from ledger (super admin only).

**Headers:** Authorization required (Super Admin token)

**Response (200):**
```json
{
  "success": true,
  "data": {
    "oldBalance": 100.0,
    "newBalance": 125.5,
    "difference": 25.5
  },
  "message": "Wallet balance rebuilt from ledger"
}
```

---

## Operators Module

The Operators module manages administrative users who oversee parking operations.

### Overview

Operators authenticate with phone OTP and can:
- Manage parking zones and streets
- View tickets and sessions within their assigned zones
- Access administrative dashboards

### Operator Schema

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Operator's full name |
| `phoneNumber` | string | Unique phone number (login credential) |
| `role` | enum | super_admin, admin, or operator |
| `zoneIds` | ObjectId[] | References to ParkingZone |
| `isActive` | boolean | Whether operator can login |

### Role Hierarchy

- **super_admin**: Full system access, can manage all operators and zones
- **admin**: Can view all data, limited management capabilities
- **operator**: Can only access assigned zones and their data

### Key Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/operators/auth/request-otp` | Request OTP |
| `POST` | `/operators/auth/verify-otp` | Verify OTP and login |
| `GET` | `/operators/me` | Get current operator profile |
| `POST` | `/operators` | Create new operator (super admin) |
| `GET` | `/operators` | List all operators (admin) |
| `PUT` | `/operators/:id` | Update operator (super admin) |
| `PUT` | `/operators/:id/zones` | Assign zones to operator |

---

## Streets Module

The Streets module manages street data for parking zones, including polylines for map display.

### Overview

Streets define the actual roads within parking zones where parking is available, prohibited, or free.

### Street Schema

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Street name |
| `zoneId` | ObjectId | Reference to ParkingZone |
| `type` | enum | payable, free, or prohibited |
| `points` | GeoJSON[] | Array of lat/lng coordinates |
| `isActive` | boolean | Whether street is active |

### Street Types

- **payable**: Parking requires payment
- **free**: Free parking available
- **prohibited**: Parking not allowed

### Key Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/streets` | Create a new street |
| `POST` | `/streets/bulk` | Create multiple streets |
| `GET` | `/streets` | List all streets |
| `GET` | `/streets/admin` | List streets (filtered by operator zones) |
| `GET` | `/streets/zone/:zoneId` | Get streets by zone |
| `PATCH` | `/streets/:id` | Update a street |
| `DELETE` | `/streets/:id` | Delete a street |
| `DELETE` | `/streets/zone/:zoneId` | Delete all streets in a zone |

---

### Ticket-Token Endpoints (Deprecated - See Ticket Endpoints)

**Note:** Ticket token endpoints have been integrated into the Tickets controller. Use `/tickets/:id/token/*` endpoints instead of the standalone `/ticket-tokens/*` endpoints documented below.

### Ticket-Token Endpoints (Deprecated - See Ticket Endpoints)

**Note:** Ticket token endpoints have been integrated into the Tickets controller. Use `/tickets/:id/token/*` endpoints instead of the standalone `/ticket-tokens/*` endpoints.

For secure QR code token generation and verification, see the Ticket Endpoints section above.

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
| `phone` | string | Agent's phone number |
| `assignedZones` | ObjectId[] | References to ParkingZone |
| `isActive` | boolean | Whether agent can login |

### Key Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/agents/login` | Agent authentication |
| `POST` | `/agents` | Create new agent |
| `GET` | `/agents/me` | Get current agent profile |
| `GET` | `/agents` | List all agents |
| `GET` | `/agents/zone/:zoneId` | Get agents by zone |
| `GET` | `/agents/:id` | Get agent by ID |
| `PUT` | `/agents/:id` | Update agent |
| `PATCH` | `/agents/:id/zones` | Assign zones to agent |
| `PATCH` | `/agents/:id/change-password` | Change password |
| `PATCH` | `/agents/:id/reset-password` | Reset password (admin) |
| `PATCH` | `/agents/:id/activate` | Activate agent |
| `PATCH` | `/agents/:id/deactivate` | Deactivate agent |

### Agent Workflow

```
1. Agent logs in
   POST /agents/login { email, password }

2. Agent checks vehicle for active session
   POST /parking-sessions/check-vehicle { plate, zoneId }

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

## Ticket Tokens Module

The Ticket Tokens module provides secure, cryptographically-signed tokens for fine ticket QR codes. This prevents URL guessing attacks and ensures QR codes cannot be forged.

### Overview

When a ticket is issued, a secure token is generated that:
- Contains an HMAC-SHA256 signature for integrity verification
- Is stored in the database with expiration tracking
- Can be revoked when the ticket is paid or dismissed
- Is automatically cleaned up after 30 days of being expired/revoked

### Security Features

| Feature | Description |
|---------|-------------|
| **HMAC Signature** | Each token includes a cryptographic signature using SHA-256 |
| **No Raw IDs in URLs** | Ticket IDs are never exposed in QR code URLs |
| **Token Revocation** | Tokens are automatically revoked when tickets are paid/dismissed |
| **Expiration** | Tokens expire after 1 year by default |
| **Automatic Cleanup** | Daily cron job deletes old expired/revoked tokens |

### Token Schema

```javascript
{
  _id: ObjectId("..."),
  token: "Njk0YTM4MDM4OWUy...",       // Base64URL encoded token
  ticketId: ObjectId("..."),          // Reference to ticket
  status: "active",                    // active, expired, revoked
  expiresAt: ISODate("2025-12-25"),
  usedAt: ISODate("..."),             // Last scan time
  usedByIp: "192.168.1.1",            // Last scanner IP
  usedByUserAgent: "Mozilla/5.0...",
  revokedAt: ISODate("..."),
  createdAt: ISODate("..."),
  updatedAt: ISODate("...")
}
```

### Token Lifecycle

```
┌─────────────────┐
│   Token Created │◄──── When ticket is issued
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│     ACTIVE      │◄──── Can be scanned multiple times
└────────┬────────┘
         │
         ├───────────────────────────────┐
         ▼                               ▼
┌─────────────────┐            ┌─────────────────┐
│    REVOKED      │            │    EXPIRED      │
│  (ticket paid)  │            │ (after 1 year)  │
└────────┬────────┘            └────────┬────────┘
         │                              │
         └──────────────┬───────────────┘
                        ▼
              ┌─────────────────┐
              │    DELETED      │◄──── After 30 days (cleanup job)
              └─────────────────┘
```

### Automatic Cleanup

A scheduled cron job runs daily at 3:00 AM to clean up old tokens:

- **Retention Period**: 30 days after expiration/revocation
- **Schedule**: Every day at 3:00 AM (`EVERY_DAY_AT_3AM`)
- **Manual Trigger**: `POST /ticket-tokens/cleanup`

### Integration with Tickets

Tokens are automatically managed:

1. **On Ticket Creation**: Token is generated via `tickets.service.getQrCode()`
2. **On Ticket Payment**: Token is revoked via `tickets.service.pay()`
3. **On Ticket Dismissal**: Token is revoked via `tickets.service.dismiss()`

### QR Code Flow

```
1. Agent issues ticket
   └─► Token generated with HMAC signature
   └─► QR code contains: /api/v1/ticket-tokens/verify/{token}

2. User scans QR code
   └─► Browser hits verify endpoint
   └─► API validates signature + checks database
   └─► Redirects to: /tickets/t/{token} (not raw ticketId!)

3. Flutter app receives token
   └─► Calls /api/v1/ticket-tokens/verify/{token}/json
   └─► Gets ticketId from response
   └─► Fetches ticket details
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

### Reporting Issues

If you encounter a bug or have a feature request:
1. Check [existing issues](../../issues) to avoid duplicates
2. Create a [new issue](../../issues/new) with:
   - Clear description of the problem or feature
   - Steps to reproduce (for bugs)
   - Expected vs actual behavior
   - Environment details (Node version, OS, etc.)

### Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### External Resources

For framework and technology documentation:
- NestJS Documentation: [https://docs.nestjs.com](https://docs.nestjs.com)
- MongoDB Documentation: [https://docs.mongodb.com](https://docs.mongodb.com)
- Mongoose ODM: [https://mongoosejs.com](https://mongoosejs.com)
- Stripe API: [https://stripe.com/docs/api](https://stripe.com/docs/api)
