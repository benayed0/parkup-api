# ParkUp Backend Implementation Guide

This guide documents the API contracts required to implement the ParkUp backend. The Flutter app uses mock services that simulate these APIs - replace them with real implementations when ready.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Authentication](#authentication)
3. [Database Schema](#database-schema)
4. [API Endpoints](#api-endpoints)
5. [Error Handling](#error-handling)
6. [Implementation Checklist](#implementation-checklist)

---

## Architecture Overview

### Service Layer Pattern

The app uses a service interface pattern for easy backend swapping:

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   UI Widgets    │────▶│    Providers     │────▶│    Services     │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                                                         │
                                    ┌────────────────────┼────────────────────┐
                                    ▼                    ▼                    ▼
                            ┌─────────────┐      ┌─────────────┐      ┌─────────────┐
                            │MockService  │      │RealService  │      │TestService  │
                            │(Current)    │      │(Implement)  │      │(Future)     │
                            └─────────────┘      └─────────────┘      └─────────────┘
```

### Switching to Real Backend

In each provider file, replace the mock service:

```dart
// lib/shared/providers/auth_provider.dart
final authServiceProvider = Provider<AuthService>((ref) {
  // return MockAuthService();  // Development
  return RealAuthService(baseUrl: 'https://api.parkup.tn');  // Production
});
```

---

## Authentication

### Token-Based Auth (JWT)

The app expects JWT tokens with refresh capability:

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIs...",
  "user": { ... }
}
```

### OTP Flow

1. User enters email
2. Backend sends 6-digit OTP via email
3. User enters OTP
4. Backend verifies and returns tokens + user

### OAuth Flow (Google/Facebook)

1. App handles OAuth redirect
2. App sends OAuth token to backend
3. Backend validates with provider
4. Backend creates/updates user
5. Backend returns JWT tokens + user

---

## Database Schema (MongoDB)

### Users Collection

```javascript
// Collection: users
{
  _id: ObjectId("..."),
  email: "user@example.com",        // unique index
  phone: "+216 12 345 678",
  isEmailVerified: true,
  vehicles: [                        // embedded array
    {
      licensePlate: "123 TUN 4567",  // unique within user's array
      nickname: "Ma voiture",
      isDefault: true
    },
    {
      licensePlate: "789 TUN 0123",
      nickname: null,
      isDefault: false
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
// Collection: parkingZones
{
  _id: ObjectId("..."),
  code: "SBS-001",                    // unique index
  name: "Sidi Bou Said Centre",
  description: "Zone centre-ville",
  address: "Avenue Habib Bourguiba",
  hourlyRate: 1.500,
  dailyRate: 10.000,
  maxDurationMinutes: 480,
  isActive: true,
  location: {                         // GeoJSON for geospatial queries
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

### Parking Meters Collection

```javascript
// Collection: parkingMeters
{
  _id: ObjectId("..."),
  zoneId: ObjectId("..."),            // ref to parkingZones
  zoneCode: "SBS-001",                // denormalized for quick access
  zoneName: "Sidi Bou Said Centre",   // denormalized
  hourlyRate: 1.500,                  // denormalized
  location: {                         // GeoJSON
    type: "Point",
    coordinates: [10.3489, 36.8689]
  },
  operatingHours: "8h - 20h",
  availableSpots: 15,
  createdAt: ISODate("2024-01-01T00:00:00Z")
}

// Indexes
db.parkingMeters.createIndex({ location: "2dsphere" })
db.parkingMeters.createIndex({ zoneId: 1 })
db.parkingMeters.createIndex({ zoneCode: 1 })
```

### Parking Sessions Collection

```javascript
// Collection: parkingSessions
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
db.parkingSessions.createIndex({ endTime: 1 })  // for expiration queries
```

### Tickets Collection

```javascript
// Collection: tickets
{
  _id: ObjectId("..."),
  sessionId: ObjectId("..."),         // ref to parkingSessions
  licensePlate: "123 TUN 4567",
  zoneName: "Sidi Bou Said Centre",
  zoneCode: "SBS-001",
  startTime: ISODate("2024-01-01T10:00:00Z"),
  endTime: ISODate("2024-01-01T12:00:00Z"),
  amount: 3.000,
  status: "active",                   // active, expired, verified
  qrCode: "PKP-ABC123XYZ",            // unique
  createdAt: ISODate("2024-01-01T10:00:00Z")
}

// Indexes
db.tickets.createIndex({ qrCode: 1 }, { unique: true })
db.tickets.createIndex({ sessionId: 1 })
db.tickets.createIndex({ licensePlate: 1, zoneCode: 1 })
db.tickets.createIndex({ status: 1 })
db.tickets.createIndex({ endTime: 1 })  // for expiration queries
```

### Payment Methods Collection

```javascript
// Collection: paymentMethods
{
  _id: ObjectId("..."),
  userId: ObjectId("..."),            // ref to users
  type: "card",                       // card, wallet
  displayName: "Visa ****4242",
  last4Digits: "4242",
  cardBrand: "Visa",
  isDefault: true,
  stripePaymentMethodId: "pm_...",    // Stripe token
  createdAt: ISODate("2024-01-01T00:00:00Z")
}

// Indexes
db.paymentMethods.createIndex({ userId: 1 })
db.paymentMethods.createIndex({ userId: 1, isDefault: 1 })
```

### Payments Collection

```javascript
// Collection: payments
{
  _id: ObjectId("..."),
  userId: ObjectId("..."),            // ref to users
  sessionId: ObjectId("..."),         // ref to parkingSessions (optional)
  paymentMethodId: ObjectId("..."),   // ref to paymentMethods
  amount: 3.000,
  currency: "TND",
  status: "completed",                // pending, processing, completed, failed, refunded, cancelled
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
db.payments.createIndex({ userId: 1, createdAt: -1 })  // for history queries
```

### OTP Collection (with TTL)

```javascript
// Collection: otpCodes
{
  _id: ObjectId("..."),
  email: "user@example.com",
  code: "123456",
  attempts: 0,                        // track failed attempts
  createdAt: ISODate("2024-01-01T10:00:00Z")
}

// Indexes - TTL index auto-deletes after 15 minutes
db.otpCodes.createIndex({ createdAt: 1 }, { expireAfterSeconds: 900 })
db.otpCodes.createIndex({ email: 1 })
```

### Refresh Tokens Collection (with TTL)

```javascript
// Collection: refreshTokens
{
  _id: ObjectId("..."),
  userId: ObjectId("..."),
  token: "hashed_refresh_token",
  createdAt: ISODate("2024-01-01T10:00:00Z")
}

// Indexes - TTL index auto-deletes after 30 days
db.refreshTokens.createIndex({ createdAt: 1 }, { expireAfterSeconds: 2592000 })
db.refreshTokens.createIndex({ token: 1 })
db.refreshTokens.createIndex({ userId: 1 })
```

---

### Mongoose Schema Examples (Node.js)

```javascript
// models/User.js
const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true },
    phone: { type: String, required: false },
    isEmailVerified: { type: Boolean, default: false },
    vehicles: [
      {
        licensePlate: { type: String, required: true },
        nickname: String,
        isDefault: { type: Boolean, default: false },
      },
    ],
    walletBalance: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// Ensure unique license plates within user's vehicles
userSchema.index({ "vehicles.licensePlate": 1 });

// models/ParkingZone.js
const parkingZoneSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    description: String,
    address: String,
    hourlyRate: { type: Number, required: true },
    dailyRate: Number,
    maxDurationMinutes: Number,
    isActive: { type: Boolean, default: true },
    location: {
      type: { type: String, enum: ["Point"], default: "Point" },
      coordinates: { type: [Number] }, // [lng, lat]
    },
  },
  { timestamps: true }
);

parkingZoneSchema.index({ location: "2dsphere" });

// models/ParkingSession.js
const parkingSessionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    zoneId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ParkingZone",
      required: true,
    },
    licensePlate: { type: String, required: true },
    zoneName: { type: String, required: true },
    startTime: { type: Date, required: true },
    endTime: { type: Date, required: true },
    durationMinutes: { type: Number, required: true },
    amount: { type: Number, required: true },
    status: {
      type: String,
      enum: ["active", "completed", "expired", "cancelled"],
      default: "active",
    },
    ticketId: { type: mongoose.Schema.Types.ObjectId, ref: "Ticket" },
  },
  { timestamps: true }
);

parkingSessionSchema.index({ userId: 1, status: 1 });
parkingSessionSchema.index({ endTime: 1 });
```

---

## API Endpoints

### Base URL

```
https://api.parkup.tn/v1
```

### Headers

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
    "phone": "+216 12 345 678",
    "is_email_verified": true,
    "vehicles": [
      {
        "license_plate": "123 TUN 4567",
        "nickname": "Ma voiture",
        "is_default": true
      }
    ],
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": null
  }
}
```

**Error (401):**

```json
{
  "error": "Code invalide ou expiré",
  "code": "INVALID_OTP"
}
```

---

#### POST /auth/google

Authenticate with Google.

**Request:**

```json
{
  "id_token": "google_id_token_here"
}
```

**Response:** Same as OTP verify.

---

#### POST /auth/facebook

Authenticate with Facebook.

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
  "first_name": "John",
  "last_name": "Doe",
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

### Vehicle Endpoints

Vehicles are stored in user profile, so these endpoints return the updated user.

#### POST /users/me/vehicles

Add a vehicle.

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

**Error (409):**

```json
{
  "error": "Ce véhicule existe déjà",
  "code": "DUPLICATE_VEHICLE"
}
```

---

#### PATCH /users/me/vehicles/{license_plate}

Update a vehicle.

**Request:**

```json
{
  "license_plate": "999 TUN 0000",
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

Get all parking zones.

**Response (200):**

```json
{
  "zones": [
    {
      "id": "uuid",
      "code": "SBS-001",
      "name": "Sidi Bou Said Centre",
      "description": "Zone centre-ville",
      "address": "Avenue Habib Bourguiba",
      "hourly_rate": 1.5,
      "daily_rate": 10.0,
      "max_duration_minutes": 480,
      "is_active": true,
      "latitude": 36.8689,
      "longitude": 10.3489
    }
  ]
}
```

---

#### GET /zones/{zone_id}

Get specific zone.

**Response (200):**

```json
{
  "zone": { ... }
}
```

---

#### GET /meters

Get parking meters for map display.

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
      "operating_hours": "8h - 20h",
      "available_spots": 15,
      "distance_meters": 250.5
    }
  ]
}
```

---

#### POST /zones/{zone_id}/calculate-price

Calculate price for duration.

**Request:**

```json
{
  "duration_minutes": 120
}
```

**Response (200):**

```json
{
  "price": 3.0,
  "currency": "TND"
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
    "user_id": "uuid",
    "zone_id": "uuid",
    "license_plate": "123 TUN 4567",
    "zone_name": "Sidi Bou Said Centre",
    "start_time": "2024-01-01T10:00:00Z",
    "end_time": "2024-01-01T12:00:00Z",
    "duration_minutes": 120,
    "amount": 3.0,
    "status": "active",
    "ticket_id": "uuid",
    "created_at": "2024-01-01T10:00:00Z"
  },
  "ticket": {
    "id": "uuid",
    "qr_code": "PKP-ABC123XYZ"
  }
}
```

---

#### GET /parking/sessions

Get user's parking sessions.

**Headers:** Authorization required

**Query params:**

- `status` (optional): active, completed, expired, cancelled
- `limit` (optional): Number of results

**Response (200):**

```json
{
  "sessions": [ ... ]
}
```

---

#### GET /parking/sessions/active

Get current active session.

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

#### POST /parking/sessions/{session_id}/end

End session early.

**Headers:** Authorization required

**Response (200):**

```json
{
  "session": { ... }
}
```

---

#### DELETE /parking/sessions/{session_id}

Cancel session.

**Headers:** Authorization required

**Response (204):** No content

---

### Ticket Endpoints

#### GET /tickets

Get user's tickets.

**Headers:** Authorization required

**Query params:**

- `status` (optional): active, expired, verified
- `limit` (optional)

**Response (200):**

```json
{
  "tickets": [
    {
      "id": "uuid",
      "session_id": "uuid",
      "license_plate": "123 TUN 4567",
      "zone_name": "Sidi Bou Said Centre",
      "zone_code": "SBS-001",
      "start_time": "2024-01-01T10:00:00Z",
      "end_time": "2024-01-01T12:00:00Z",
      "amount": 3.0,
      "status": "active",
      "qr_code": "PKP-ABC123XYZ",
      "created_at": "2024-01-01T10:00:00Z"
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

**Response (200) - Invalid:**

```json
{
  "is_valid": false,
  "message": "Ticket expiré depuis 30 minutes",
  "ticket": { ... },
  "verified_at": "2024-01-01T12:30:00Z"
}
```

---

#### POST /tickets/verify-by-plate

Verify by license plate and zone (for agents).

**Request:**

```json
{
  "license_plate": "123 TUN 4567",
  "zone_code": "SBS-001"
}
```

**Response:** Same as QR verification.

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
      "last_4_digits": "4242",
      "card_brand": "Visa",
      "is_default": true,
      "created_at": "2024-01-01T00:00:00Z"
    },
    {
      "id": "wallet",
      "type": "wallet",
      "display_name": "Portefeuille ParkUp",
      "is_default": false,
      "created_at": "2024-01-01T00:00:00Z"
    }
  ]
}
```

---

#### POST /payments/methods

Add payment method.

**Headers:** Authorization required

**Request:**

```json
{
  "type": "card",
  "card_number": "4242424242424242",
  "expiry_date": "12/25",
  "cvv": "123",
  "set_as_default": true
}
```

**Response (201):**

```json
{
  "method": { ... }
}
```

---

#### DELETE /payments/methods/{method_id}

Remove payment method.

**Headers:** Authorization required

**Response (204):** No content

---

#### POST /payments/methods/{method_id}/default

Set as default.

**Headers:** Authorization required

**Response (200):**

```json
{
  "method": { ... }
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
    "user_id": "uuid",
    "session_id": "uuid",
    "amount": 3.0,
    "currency": "TND",
    "status": "completed",
    "method_type": "card",
    "payment_method_id": "uuid",
    "description": "Stationnement - Sidi Bou Said Centre",
    "receipt_url": "https://parkup.tn/receipts/uuid",
    "created_at": "2024-01-01T10:00:00Z",
    "completed_at": "2024-01-01T10:00:05Z"
  }
}
```

**Error (402):**

```json
{
  "success": false,
  "error_message": "Carte refusée",
  "error_code": "CARD_DECLINED"
}
```

---

#### GET /payments

Get payment history.

**Headers:** Authorization required

**Query params:**

- `status` (optional): pending, completed, refunded, etc.
- `limit` (optional)

**Response (200):**

```json
{
  "payments": [ ... ]
}
```

---

#### POST /payments/{payment_id}/refund

Request refund (within 24h).

**Headers:** Authorization required

**Request:**

```json
{
  "reason": "Session annulée"
}
```

**Response (200):**

```json
{
  "success": true,
  "payment": { ... }
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

Top up wallet.

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
  "payment": { ... },
  "new_balance": 75.000
}
```

---

## Error Handling

### Standard Error Response

```json
{
  "error": "Human-readable error message in French",
  "code": "ERROR_CODE",
  "details": {} // Optional additional info
}
```

### Error Codes

| Code                          | HTTP | Description                     |
| ----------------------------- | ---- | ------------------------------- |
| `INVALID_OTP`                 | 401  | OTP code invalid or expired     |
| `OTP_EXPIRED`                 | 401  | OTP has expired (15 min)        |
| `UNAUTHORIZED`                | 401  | Missing or invalid token        |
| `TOKEN_EXPIRED`               | 401  | Access token expired            |
| `NOT_FOUND`                   | 404  | Resource not found              |
| `DUPLICATE_VEHICLE`           | 409  | Vehicle plate already exists    |
| `VEHICLE_NOT_FOUND`           | 404  | Vehicle not in user's list      |
| `ZONE_NOT_FOUND`              | 404  | Parking zone not found          |
| `SESSION_NOT_FOUND`           | 404  | Parking session not found       |
| `ACTIVE_SESSION_EXISTS`       | 409  | User already has active session |
| `SESSION_EXPIRED`             | 400  | Cannot modify expired session   |
| `INVALID_CARD_NUMBER`         | 400  | Card validation failed          |
| `CARD_DECLINED`               | 402  | Card was declined               |
| `INSUFFICIENT_FUNDS`          | 402  | Card has insufficient funds     |
| `INSUFFICIENT_WALLET_BALANCE` | 402  | Wallet balance too low          |
| `METHOD_NOT_FOUND`            | 404  | Payment method not found        |
| `PAYMENT_NOT_FOUND`           | 404  | Payment not found               |
| `REFUND_PERIOD_EXPIRED`       | 400  | 24h refund window passed        |
| `TICKET_NOT_FOUND`            | 404  | Ticket not found                |

---

## Implementation Checklist

### Phase 1: Core Auth & User

- [ ] MongoDB setup with Mongoose models
- [ ] User registration/login with OTP
- [ ] JWT token generation & refresh
- [ ] User profile CRUD
- [ ] Vehicle management (embedded in user.vehicles array)

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
- [ ] Violation recording (future)

### Phase 5: Admin & Analytics

- [ ] Admin dashboard
- [ ] Revenue reports
- [ ] Usage analytics
- [ ] Zone management UI

---

## Tech Stack Recommendations

### Backend Framework

- **Node.js + Express/Fastify + TypeScript** (recommended for MongoDB)
- **NestJS** - great with Mongoose, built-in validation
- **Python**: FastAPI with Motor (async MongoDB driver)

### Database

- **MongoDB** - document database
- **MongoDB Atlas** - managed cloud hosting (free tier available)
- Use **Mongoose** ODM for Node.js

### Cache (Optional with MongoDB)

- MongoDB TTL indexes handle OTP/token expiration natively
- **Redis** if you need additional caching layer

### Payment Provider

- **Stripe** (recommended) or local provider
- Consider **Flouci** or **Konnect** for Tunisia

### Push Notifications

- **Firebase Cloud Messaging**

### Hosting (Tunisia)

- **MongoDB Atlas** - closest region: France/Europe
- Backend: Render, Railway, or local VPS
- Consider latency for TND payment processing

### Recommended Node.js Stack

```
├── express / fastify    # HTTP framework
├── mongoose             # MongoDB ODM
├── jsonwebtoken         # JWT handling
├── bcrypt               # Password/token hashing
├── nodemailer           # Email OTP
├── stripe               # Payments
├── express-validator    # Input validation
├── helmet               # Security headers
└── cors                 # CORS handling
```

---

## Security Considerations

1. **Never store plain card numbers** - use Stripe tokens
2. **Rate limit OTP endpoints** - prevent brute force (use express-rate-limit)
3. **Validate license plates** - normalize format (uppercase, trim)
4. **Hash refresh tokens** - store hashed, compare with bcrypt
5. **HTTPS only** - no HTTP in production
6. **Input validation** - use express-validator or Joi
7. **NoSQL injection prevention** - use Mongoose (sanitizes by default)
8. **Helmet.js** - set security headers
9. **MongoDB user permissions** - use least privilege principle

---

## Contact

For questions about this API spec, refer to the mock service implementations in:

- `lib/core/services/mock_auth_service.dart`
- `lib/core/services/mock_vehicle_service.dart`
- `lib/core/services/mock_parking_service.dart`
- `lib/core/services/mock_ticket_service.dart`
- `lib/core/services/mock_payment_service.dart`
