# ParkUp NestJS API — Portfolio Audit Report

## 1. What's Impressive and Already There

### Parking Session Lifecycle (Full State Machine)
`src/parking-sessions/parking-sessions.service.ts` implements a complete session lifecycle: **ACTIVE -> COMPLETED | EXPIRED | CANCELLED**. Sessions track structured start/end times, duration, amount, and status transitions. A dedicated **cron scheduler** (`parking-sessions.scheduler.ts`) runs every minute to auto-expire sessions and emit warnings at 10-min and 5-min thresholds before expiry — with duplicate-warning prevention via in-memory tracking.

### Real-Time WebSocket Gateway
`src/parking-sessions/parking-sessions.gateway.ts` provides a full Socket.IO namespace (`/parking-sessions`) with **zone-based room architecture**. Clients join `zone-{zoneId}` rooms and receive live events: `SESSION_CREATED`, `SESSION_UPDATED`, `SESSION_ENDED`, `SESSION_EXPIRING`, plus `ZONE_SNAPSHOT` on join. The gateway is wired into the session service so every CRUD operation broadcasts to the relevant zone room in real time.

### Geospatial Logic
`src/shared/geo-utils.ts` implements a **ray-casting point-in-polygon algorithm** to validate whether a parked vehicle's GPS coordinates fall within a parking zone's polygon boundaries. Sessions store a GeoJSON Point (`location`) with a `locationWithinZone` boolean confidence flag and a `locationSource` enum (`gps_auto | user_pin | zone_centroid | unknown`) — solid provenance tracking for enforcement credibility.

### Enforcement Data Endpoint
The parking sessions controller exposes enforcement-specific queries returning expired violations (within a configurable window), soon-to-expire sessions, location confidence data, and zone boundary polygons — purpose-built for field agents using the mobile app.

### Multi-Actor Auth with Three JWT Strategies
Three independent auth flows coexist:
- **Users** — OTP email codes + Google OAuth (idToken for mobile, accessToken for web) + Facebook Graph API verification. Refresh tokens are HMAC-SHA256 hashed before storage (`src/auth/auth.service.ts`).
- **Operators** — OTP-based login with a 4-tier role hierarchy (SUPER_ADMIN:100, ADMIN:75, MANAGER:50, SUPERVISOR:25). Role enforcement ensures you can only create/modify users below your level (`src/operators/guards/roles.guard.ts`).
- **Agents** — Username/password with bcrypt, scoped to assigned zones.

A **CombinedJwtAuthGuard** (`src/shared/auth/combined-jwt-auth.guard.ts`) accepts both operator and agent tokens on shared endpoints, setting `request.userType` for downstream logic.

### Zone Access Guard
`src/shared/auth/zone-access.guard.ts` cross-references a ticket's `parkingZoneId` against the authenticated user's assigned zones — super_admins bypass, everyone else gets filtered. This works for both operators and agents.

### Role-Based Access Control
`src/operators/decorators/roles.decorator.ts` provides a `@Roles()` decorator used alongside `RolesGuard` to gate admin endpoints by operator role. The numeric hierarchy allows clean comparison logic.

### Wallet System with Idempotency
`src/wallet/wallet.service.ts` implements a **full double-entry-style wallet**: credits (TOPUP, REFUND) and debits (PARKING_PAYMENT, ADJUSTMENT) with `referenceId`-based idempotency to prevent duplicate charges. Every transaction records before/after balances. Wallets are lazily initialized and use MongoDB transactions for atomicity.

### Ticket System with Crypto-Secure QR Tokens
`src/tickets/tickets.service.ts` manages the full ticket lifecycle (PENDING -> PAID | APPEALED | SABOT_REMOVED | DISMISSED | OVERDUE). Ticket numbers use a 6-char alphanumeric code that excludes ambiguous characters (0/O, 1/I/L). `src/ticket-tokens/ticket-tokens.service.ts` generates **HMAC-SHA256 signed tokens** (`ticketId:timestamp:randomBytes:signature`) that can be verified without a database lookup — then rendered as QR codes via the `qrcode` library.

### Tunisian License Plate Domain Model
`src/shared/license-plate/` is a surprisingly rich domain model handling **9+ plate types**: regular Tunisian, government, Libyan, Algerian, EU, diplomatic (CMD, CD, MD, PAT), and consular (CC, MC). Each type has structured left/right fields, a `formatted` display string, Arabic label support for diplomatic plates, and normalization logic. This level of domain specificity shows real-world requirements handling.

### Seasonal Operating Hours
`src/parking-zones/schemas/parking-zone.schema.ts` supports **seasonal operating hour periods** with month/day ranges, 24h flags, and year-crossing support (e.g., Nov-Feb). Non-overlapping period validation is enforced. The mobile API computes `currentOperatingHours` dynamically.

### Street-Level Parking Rules
`src/streets/` models individual streets within zones, with **side-specific parking restrictions** (left/right: FREE | PAYABLE | PROHIBITED) and encoded polylines for map rendering. A `map-matching.service.ts` exists for route-matching logic.

---

## 2. Notable Packages and Integrations

| Package | What It Powers |
|---|---|
| `@nestjs/websockets` + `socket.io` | Real-time parking session broadcasts via zone-based rooms |
| `@nestjs/schedule` | Minute-by-minute cron jobs for session expiry and warnings |
| `@nestjs/passport` + `passport-jwt` | Three independent JWT strategies (user, operator, agent) |
| `@nestjs/mongoose` + `mongoose` | MongoDB ODM with 2dsphere indexes, TTL indexes, compound indexes, and transactions |
| `google-auth-library` | Dual-mode Google OAuth (idToken for Flutter, accessToken for Angular) |
| `node-mailjet` | OTP email delivery with HTML + text templates |
| `cloudinary` | Evidence photo upload for parking tickets |
| `qrcode` | QR code generation for zones and crypto-signed ticket tokens |
| `bcrypt` | Password hashing for agents and token hashing for refresh tokens |
| `class-validator` + `class-transformer` | DTO validation with whitelist mode and `forbidNonWhitelisted` |

---

## 3. Architecture Highlights

### Module Structure
11 feature modules with clean separation: `auth`, `users`, `parking-sessions`, `parking-zones`, `tickets`, `ticket-tokens`, `wallet`, `agents`, `operators`, `streets`, `qr-codes` — plus shared modules for `storage` (Cloudinary driver) and `license-plate` (domain model). The `StorageModule` is registered as a `@Global()` module.

### Guard and Interceptor Layering
Three JWT guard types (`JwtAuthGuard`, `OperatorJwtAuthGuard`, `AgentJwtAuthGuard`) plus a `CombinedJwtAuthGuard` for mixed endpoints. `RolesGuard` enforces hierarchy. `ZoneAccessGuard` filters by geographic assignment. These compose cleanly on endpoints.

### DTO Validation
Global `ValidationPipe` with `whitelist: true`, `forbidNonWhitelisted: true`, and `transform: true` — strips unknown fields and auto-transforms types. DTOs use `@ValidateNested()` for structured objects like `PlateInputDto`.

### Database Design
MongoDB with Mongoose schemas featuring:
- **2dsphere indexes** on GeoJSON Points for spatial queries
- **TTL indexes** for auto-expiring OTPs (15 min) and ticket tokens (30 days)
- **Compound indexes** on `userId+status`, `licensePlate+status`, `zoneId+status` for efficient enforcement queries
- **Unique indexes** on emails, usernames, zone codes, ticket numbers, and tokens
- **Optimistic locking** via version fields on wallets

### API Design Conventions
- Global prefix `/api/v1`
- Consistent response shape: `{ success, data, count? }`
- Snake_case response fields for Flutter compatibility
- Pagination via `limit`/`skip` query params
- Mobile vs admin response DTOs (mobile endpoints strip internal fields like `seasonalOperatingHours`)

### WebSocket Architecture
Socket.IO with the `IoAdapter`, room-based broadcasting scoped to zones, and tight integration with the service layer — every session mutation triggers a room broadcast. The scheduler also emits through the gateway for expiry warnings.

### Security Patterns
- HMAC-SHA256 ticket tokens verifiable without DB lookup (crypto-first design)
- Refresh tokens hashed before storage (no plaintext persistence)
- bcrypt for passwords
- CORS configured per environment with explicit origin allowlisting
- Evidence photos via multipart upload through Cloudinary (no local file storage)
