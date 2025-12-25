# Flutter App - Ticket API Documentation

This document provides detailed API documentation for ticket-related operations in the ParkUp Flutter application.

## Base URL

```
https://api.parkup.tn/api/v1
```

## Authentication

All ticket endpoints require JWT authentication via Bearer token in the Authorization header:

```
Authorization: Bearer <access_token>
```

---

## Get Ticket by ID

Retrieve detailed information about a specific ticket.

### Endpoint

```
GET /tickets/:id
```

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | MongoDB ObjectId of the ticket |

### Request Example

```bash
GET /tickets/6584f3e9a1234567890abcde
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Success Response (200 OK)

```json
{
  "success": true,
  "data": {
    "_id": "6584f3e9a1234567890abcde",
    "ticketNumber": "TKT-20241225-00001",
    "position": {
      "type": "Point",
      "coordinates": [10.1815, 36.8065]
    },
    "address": "Avenue Habib Bourguiba, Tunis",
    "parkingSessionId": "6584f2a8b9876543210fedcb",
    "userId": "6584e1b7c8765432109feabc",
    "agentId": {
      "_id": "6584d0c6d7654321098fedab",
      "firstName": "Ahmed",
      "lastName": "Ben Salem",
      "badgeNumber": "AGT-001",
      "email": "ahmed.salem@parkup.tn"
    },
    "parkingZoneId": "6584c9b5e6543210987edcba",
    "plate": {
      "type": "TUN",
      "left": "123",
      "right": "4567",
      "formatted": "123TUN4567"
    },
    "licensePlate": "123TUN4567",
    "reason": "car_sabot",
    "fineAmount": 50,
    "status": "pending",
    "issuedAt": "2024-12-25T10:30:00.000Z",
    "dueDate": "2025-01-10T23:59:59.000Z",
    "notes": "Vehicle wheel-clamped for parking violation",
    "evidencePhotos": [
      "https://storage.parkup.tn/tickets/20241225/photo1.jpg",
      "https://storage.parkup.tn/tickets/20241225/photo2.jpg"
    ],
    "createdAt": "2024-12-25T10:30:00.000Z",
    "updatedAt": "2024-12-25T10:30:00.000Z"
  }
}
```

### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `success` | boolean | Indicates if the request was successful |
| `data._id` | string | Unique MongoDB ObjectId of the ticket |
| `data.ticketNumber` | string | Human-readable ticket number (format: TKT-YYYYMMDD-XXXXX) |
| `data.position` | object | GeoJSON Point location where ticket was issued |
| `data.position.type` | string | Always "Point" for GeoJSON |
| `data.position.coordinates` | number[] | [longitude, latitude] coordinates |
| `data.address` | string | Human-readable address (optional) |
| `data.parkingSessionId` | string | Related parking session ID (optional) |
| `data.userId` | string | User who owns the vehicle (optional) |
| `data.agentId` | object | Agent who issued the ticket (populated) |
| `data.parkingZoneId` | string | Parking zone where violation occurred |
| `data.plate` | object | Structured license plate information |
| `data.plate.type` | string | Plate type (e.g., "TUN") |
| `data.plate.left` | string | Left part of the plate |
| `data.plate.right` | string | Right part of the plate |
| `data.plate.formatted` | string | Full formatted plate number |
| `data.licensePlate` | string | Formatted license plate (uppercase, no spaces) |
| `data.reason` | string | Reason for ticket: "car_sabot" or "pound" |
| `data.fineAmount` | number | Fine amount in TND (Tunisian Dinars) |
| `data.status` | string | Current status: "pending", "paid", "appealed", "dismissed", "overdue", "sabot_removed" |
| `data.issuedAt` | string | ISO 8601 timestamp when ticket was issued |
| `data.dueDate` | string | ISO 8601 timestamp of payment deadline |
| `data.paidAt` | string | ISO 8601 timestamp when paid (only if status is "paid") |
| `data.paymentMethod` | string | Payment method used: "wallet", "card", or "cash" (only if paid) |
| `data.notes` | string | Additional notes from enforcement officer (optional) |
| `data.evidencePhotos` | string[] | Array of photo URLs showing the violation (optional) |
| `data.appealReason` | string | Reason for appeal (only if appealed) |
| `data.appealedAt` | string | ISO 8601 timestamp when appeal was submitted (only if appealed) |
| `data.createdAt` | string | ISO 8601 timestamp when ticket was created |
| `data.updatedAt` | string | ISO 8601 timestamp when ticket was last updated |

### Error Responses

#### Ticket Not Found (404)

```json
{
  "statusCode": 404,
  "message": "Ticket #6584f3e9a1234567890abcde not found",
  "error": "Not Found"
}
```

#### Invalid Ticket ID (400)

```json
{
  "statusCode": 400,
  "message": "Invalid ticket ID format",
  "error": "Bad Request"
}
```

#### Unauthorized (401)

```json
{
  "statusCode": 401,
  "message": "Unauthorized",
  "error": "Unauthorized"
}
```

### Flutter Usage Example

```dart
import 'package:http/http.dart' as http;
import 'dart:convert';

Future<Map<String, dynamic>> getTicketById(String ticketId, String accessToken) async {
  final response = await http.get(
    Uri.parse('https://api.parkup.tn/api/v1/tickets/$ticketId'),
    headers: {
      'Authorization': 'Bearer $accessToken',
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
  );

  if (response.statusCode == 200) {
    final data = json.decode(response.body);
    return data['data']; // Returns the ticket object
  } else {
    throw Exception('Failed to load ticket: ${response.body}');
  }
}
```

---

## Pay a Ticket

Process payment for a pending or overdue ticket.

### Endpoint

```
PATCH /tickets/:id/pay
```

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | MongoDB ObjectId of the ticket to pay |

### Request Body

```json
{
  "paymentMethod": "wallet"
}
```

### Request Parameters

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `paymentMethod` | string | Yes | Payment method: "wallet", "card", or "cash" |
| `amount` | number | No | Payment amount (optional, for validation) |

### Request Example

```bash
PATCH /tickets/6584f3e9a1234567890abcde/pay
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "paymentMethod": "wallet"
}
```

### Success Response (200 OK)

```json
{
  "success": true,
  "data": {
    "_id": "6584f3e9a1234567890abcde",
    "ticketNumber": "TKT-20241225-00001",
    "position": {
      "type": "Point",
      "coordinates": [10.1815, 36.8065]
    },
    "address": "Avenue Habib Bourguiba, Tunis",
    "parkingSessionId": "6584f2a8b9876543210fedcb",
    "userId": "6584e1b7c8765432109feabc",
    "agentId": {
      "_id": "6584d0c6d7654321098fedab",
      "firstName": "Ahmed",
      "lastName": "Ben Salem",
      "badgeNumber": "AGT-001",
      "email": "ahmed.salem@parkup.tn"
    },
    "parkingZoneId": "6584c9b5e6543210987edcba",
    "plate": {
      "type": "TUN",
      "left": "123",
      "right": "4567",
      "formatted": "123TUN4567"
    },
    "licensePlate": "123TUN4567",
    "reason": "car_sabot",
    "fineAmount": 50,
    "status": "paid",
    "issuedAt": "2024-12-25T10:30:00.000Z",
    "dueDate": "2025-01-10T23:59:59.000Z",
    "paidAt": "2024-12-25T14:45:30.000Z",
    "paymentMethod": "wallet",
    "notes": "Vehicle wheel-clamped for parking violation",
    "evidencePhotos": [
      "https://storage.parkup.tn/tickets/20241225/photo1.jpg",
      "https://storage.parkup.tn/tickets/20241225/photo2.jpg"
    ],
    "createdAt": "2024-12-25T10:30:00.000Z",
    "updatedAt": "2024-12-25T14:45:30.000Z"
  }
}
```

### Response Fields

The response contains the same fields as "Get Ticket by ID", with the following changes after payment:

| Field | Type | Description |
|-------|------|-------------|
| `data.status` | string | Changed to "paid" |
| `data.paidAt` | string | ISO 8601 timestamp when payment was processed |
| `data.paymentMethod` | string | The payment method used: "wallet", "card", or "cash" |
| `data.updatedAt` | string | Updated to the payment timestamp |

### Error Responses

#### Ticket Not Found (404)

```json
{
  "statusCode": 404,
  "message": "Ticket #6584f3e9a1234567890abcde not found",
  "error": "Not Found"
}
```

#### Already Paid (400)

```json
{
  "statusCode": 400,
  "message": "Ticket is already paid",
  "error": "Bad Request"
}
```

#### Cannot Pay Dismissed Ticket (400)

```json
{
  "statusCode": 400,
  "message": "Cannot pay a dismissed ticket",
  "error": "Bad Request"
}
```

#### Invalid Payment Method (400)

```json
{
  "statusCode": 400,
  "message": "paymentMethod must be one of the following values: wallet, card, cash",
  "error": "Bad Request"
}
```

#### Insufficient Wallet Balance (402)

```json
{
  "statusCode": 402,
  "message": "Insufficient wallet balance",
  "error": "Payment Required"
}
```

#### Unauthorized (401)

```json
{
  "statusCode": 401,
  "message": "Unauthorized",
  "error": "Unauthorized"
}
```

### Flutter Usage Example

```dart
import 'package:http/http.dart' as http;
import 'dart:convert';

Future<Map<String, dynamic>> payTicket(
  String ticketId, 
  String paymentMethod, 
  String accessToken
) async {
  final response = await http.patch(
    Uri.parse('https://api.parkup.tn/api/v1/tickets/$ticketId/pay'),
    headers: {
      'Authorization': 'Bearer $accessToken',
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: json.encode({
      'paymentMethod': paymentMethod, // 'wallet', 'card', or 'cash'
    }),
  );

  if (response.statusCode == 200) {
    final data = json.decode(response.body);
    return data['data']; // Returns the updated ticket object
  } else {
    final error = json.decode(response.body);
    throw Exception('Payment failed: ${error['message']}');
  }
}
```

---

## Additional Ticket Endpoints

### Get Ticket by Ticket Number

```
GET /tickets/number/:ticketNumber
```

Example: `GET /tickets/number/TKT-20241225-00001`

Response format is identical to "Get Ticket by ID".

### Check License Plate for Unpaid Tickets

```
GET /tickets/check/:licensePlate
```

Example: `GET /tickets/check/123TUN4567`

**Response:**
```json
{
  "success": true,
  "data": {
    "hasUnpaidTickets": true,
    "tickets": [
      {
        "_id": "6584f3e9a1234567890abcde",
        "ticketNumber": "TKT-20241225-00001",
        "status": "pending",
        "fineAmount": 50,
        "dueDate": "2025-01-10T23:59:59.000Z",
        ...
      }
    ],
    "count": 1
  }
}
```

### Get User's Tickets

```
GET /tickets/user/:userId
```

Query parameters:
- `status` (optional): Filter by status ("pending", "paid", "overdue", etc.)
- `limit` (optional): Max number of results

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "6584f3e9a1234567890abcde",
      "ticketNumber": "TKT-20241225-00001",
      ...
    },
    {
      "_id": "6584f4a8b2345678901bcdef",
      "ticketNumber": "TKT-20241220-00042",
      ...
    }
  ],
  "count": 2
}
```

---

## Ticket Status Flow

```
PENDING ──────┬──────────┬──────────> PAID (payment processed)
              │          │
              │          └──────────> APPEALED (user contests)
              │                              │
              │                              ├──> DISMISSED (appeal accepted)
              │                              └──> PENDING (appeal rejected)
              │
              └─────────────────────> OVERDUE (past due date)
                                             │
                                             └──> PAID (late payment)
```

---

## Payment Methods

| Method | Value | Description |
|--------|-------|-------------|
| Wallet | `wallet` | Payment from user's ParkUp wallet balance |
| Card | `card` | Payment via credit/debit card |
| Cash | `cash` | Cash payment at authorized location |

---

## Ticket Reasons

| Reason | Value | Description | Typical Fine |
|--------|-------|-------------|--------------|
| Car Sabot | `car_sabot` | Vehicle wheel-clamped for violation | 50 TND |
| Pound | `pound` | Vehicle towed to impound lot | 100 TND |

---

## Notes for Flutter Developers

1. **Always handle authentication**: Include the Bearer token in all requests
2. **Handle all HTTP status codes**: Implement proper error handling for 400, 401, 402, 404, etc.
3. **Parse dates properly**: Use `DateTime.parse()` for ISO 8601 timestamps
4. **Show evidence photos**: Display the `evidencePhotos` array to users in the ticket detail view
5. **Check ticket status**: Before showing payment UI, verify the ticket status is "pending" or "overdue"
6. **Wallet balance**: When using wallet payment method, check user's wallet balance first
7. **Offline support**: Cache ticket data locally for offline viewing
8. **Push notifications**: Listen for payment confirmation notifications from the backend
9. **Agent information**: Display the agent's name and badge number from the populated `agentId` field
10. **Location display**: Use the `position.coordinates` to show the violation location on a map

---

## Testing

Use these test credentials and endpoints for development:

**Test API Base URL:**
```
https://api-dev.parkup.tn/api/v1
```

**Test Ticket IDs:**
- Pending ticket: `6584f3e9a1234567890abcde`
- Paid ticket: `6584f4a8b2345678901bcdef`
- Overdue ticket: `6584f5b9c3456789012cdefg`

---

## Support

For API issues or questions:
- Email: dev@parkup.tn
- Slack: #parkup-api channel
- Documentation: See [BACKEND_GUIDE.md](./BACKEND_GUIDE.md) for complete API reference
