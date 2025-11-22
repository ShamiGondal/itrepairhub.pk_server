# Booking API Documentation

This document provides examples for the Service Booking API endpoints. The booking system supports both **logged-in users** and **guest users** (no authentication required).

## Base URL
```
http://localhost:5000/api/v1/bookings
```

---

## Endpoints Overview

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/bookings` | Optional | Create a new booking (supports both logged-in and guest users) |
| GET | `/bookings/me` | Required | Get all bookings for authenticated user |
| GET | `/bookings/addresses` | Required | Get saved addresses for authenticated user |
| GET | `/bookings/:id` | Required | Get a single booking by ID |

---

## 1. Create Booking (POST /bookings)

**Public endpoint** - Works for both logged-in users and guests.

### Flow:
1. **Logged-in User**: Can use existing `address_id` or provide `new_address`
2. **Guest User**: Must provide `guest_details` (name, email, phone, address)
3. System validates service exists and checks `price_type`
4. If `price_type = 'fixed'`: Payment is automatically created with `pending` status
5. If `price_type = 'variable'`: No payment created (handled by admin later)

### Request Headers (Optional for logged-in users)
```http
Authorization: Bearer <jwt_token>
```

### Request Body for Logged-in User (Using Existing Address)

```json
{
  "service_id": 1,
  "booking_date": "2024-03-25",
  "booking_time": "14:30:00",
  "address_id": 5
}
```

### Request Body for Logged-in User (Creating New Address)

```json
{
  "service_id": 1,
  "booking_date": "2024-03-25",
  "booking_time": "14:30:00",
  "new_address": {
    "label": "Home",
    "line_1": "123 Main Street",
    "line_2": "Apartment 4B",
    "city": "Lahore",
    "state": "Punjab",
    "postal_code": "54000"
  }
}
```

### Request Body for Guest User

```json
{
  "service_id": 1,
  "booking_date": "2024-03-25",
  "booking_time": "14:30:00",
  "guest_details": {
    "full_name": "John Doe",
    "email": "john.doe@example.com",
    "phone_number": "+92 300 1234567",
    "address_line_1": "456 Park Avenue",
    "address_line_2": "Suite 200",
    "city": "Karachi",
    "state": "Sindh",
    "postal_code": "75500"
  }
}
```

### cURL Examples

#### Logged-in User (Using Existing Address)
```bash
curl -X POST http://localhost:5000/api/v1/bookings \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "service_id": 1,
    "booking_date": "2024-03-25",
    "booking_time": "14:30:00",
    "address_id": 5
  }'
```

#### Logged-in User (Creating New Address)
```bash
curl -X POST http://localhost:5000/api/v1/bookings \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "service_id": 1,
    "booking_date": "2024-03-25",
    "booking_time": "14:30:00",
    "new_address": {
      "label": "Home",
      "line_1": "123 Main Street",
      "line_2": "Apartment 4B",
      "city": "Lahore",
      "state": "Punjab",
      "postal_code": "54000"
    }
  }'
```

#### Guest User (No Authentication)
```bash
curl -X POST http://localhost:5000/api/v1/bookings \
  -H "Content-Type: application/json" \
  -d '{
    "service_id": 1,
    "booking_date": "2024-03-25",
    "booking_time": "14:30:00",
    "guest_details": {
      "full_name": "John Doe",
      "email": "john.doe@example.com",
      "phone_number": "+92 300 1234567",
      "address_line_1": "456 Park Avenue",
      "address_line_2": "Suite 200",
      "city": "Karachi",
      "state": "Sindh",
      "postal_code": "75500"
    }
  }'
```

### Response (Fixed Price Service)

```json
{
  "success": true,
  "data": {
    "booking": {
      "id": 1,
      "user_id": 5,
      "guest_id": null,
      "service_id": 1,
      "address_id": 5,
      "technician_id": null,
      "booking_date": "2024-03-25",
      "booking_time": "14:30:00",
      "status": "pending",
      "admin_notes": null,
      "created_at": "2024-03-20T10:30:00.000Z",
      "service_name": "Laptop Screen Replacement",
      "price_type": "fixed",
      "service_price": "5000.00"
    },
    "payment": {
      "id": 1,
      "user_id": 5,
      "guest_id": null,
      "booking_id": 1,
      "amount": "5000.00",
      "gateway": "local_gateway",
      "transaction_id": null,
      "status": "pending",
      "created_at": "2024-03-20T10:30:00.000Z"
    }
  },
  "message": "Booking created successfully"
}
```

### Response (Variable Price Service)

```json
{
  "success": true,
  "data": {
    "booking": {
      "id": 2,
      "user_id": null,
      "guest_id": 3,
      "service_id": 2,
      "address_id": null,
      "technician_id": null,
      "booking_date": "2024-03-26",
      "booking_time": "15:00:00",
      "status": "pending",
      "admin_notes": null,
      "created_at": "2024-03-20T10:35:00.000Z",
      "service_name": "Custom PC Build Consultation",
      "price_type": "variable",
      "service_price": null
    },
    "payment": null
  },
  "message": "Booking created successfully"
}
```

### Error Responses

#### Missing Required Fields
```json
{
  "success": false,
  "message": "service_id, booking_date, and booking_time are required"
}
```

#### Invalid Service
```json
{
  "success": false,
  "message": "Service not found"
}
```

#### Invalid Address (Logged-in User)
```json
{
  "success": false,
  "message": "Invalid address_id or address does not belong to user"
}
```

#### Missing Guest Details (Guest User)
```json
{
  "success": false,
  "message": "guest_details is required for guest bookings"
}
```

#### Past Booking Date
```json
{
  "success": false,
  "message": "Booking date and time must be in the future"
}
```

---

## 2. Get My Bookings (GET /bookings/me)

**Authenticated endpoint** - Returns all bookings for the logged-in user.

### Request Headers
```http
Authorization: Bearer <jwt_token>
```

### cURL Example
```bash
curl -X GET http://localhost:5000/api/v1/bookings/me \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Response
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "user_id": 5,
      "guest_id": null,
      "service_id": 1,
      "address_id": 5,
      "technician_id": null,
      "booking_date": "2024-03-25",
      "booking_time": "14:30:00",
      "status": "pending",
      "admin_notes": null,
      "created_at": "2024-03-20T10:30:00.000Z",
      "service_name": "Laptop Screen Replacement",
      "price_type": "fixed",
      "service_price": "5000.00",
      "service_slug": "laptop-screen-replacement"
    }
  ]
}
```

---

## 3. Get My Addresses (GET /bookings/addresses)

**Authenticated endpoint** - Returns all saved addresses for the logged-in user.

### Request Headers
```http
Authorization: Bearer <jwt_token>
```

### cURL Example
```bash
curl -X GET http://localhost:5000/api/v1/bookings/addresses \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Response
```json
{
  "success": true,
  "data": [
    {
      "id": 5,
      "label": "Home",
      "line_1": "123 Main Street",
      "line_2": "Apartment 4B",
      "city": "Lahore",
      "state": "Punjab",
      "postal_code": "54000",
      "created_at": "2024-03-15T08:00:00.000Z"
    },
    {
      "id": 6,
      "label": "Work",
      "line_1": "789 Business Park",
      "line_2": null,
      "city": "Lahore",
      "state": "Punjab",
      "postal_code": "54000",
      "created_at": "2024-03-18T12:00:00.000Z"
    }
  ]
}
```

---

## 4. Get Booking by ID (GET /bookings/:id)

**Authenticated endpoint** - Returns a single booking with payment details (if applicable).

### Request Headers
```http
Authorization: Bearer <jwt_token>
```

### cURL Example
```bash
curl -X GET http://localhost:5000/api/v1/bookings/1 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Response (Fixed Price Service with Payment)
```json
{
  "success": true,
  "data": {
    "booking": {
      "id": 1,
      "user_id": 5,
      "guest_id": null,
      "service_id": 1,
      "address_id": 5,
      "technician_id": null,
      "booking_date": "2024-03-25",
      "booking_time": "14:30:00",
      "status": "pending",
      "admin_notes": null,
      "created_at": "2024-03-20T10:30:00.000Z",
      "service_name": "Laptop Screen Replacement",
      "price_type": "fixed",
      "service_price": "5000.00",
      "service_slug": "laptop-screen-replacement"
    },
    "payment": {
      "id": 1,
      "user_id": 5,
      "guest_id": null,
      "booking_id": 1,
      "amount": "5000.00",
      "gateway": "local_gateway",
      "transaction_id": null,
      "status": "pending",
      "created_at": "2024-03-20T10:30:00.000Z"
    }
  }
}
```

### Response (Variable Price Service - No Payment)
```json
{
  "success": true,
  "data": {
    "booking": {
      "id": 2,
      "user_id": null,
      "guest_id": 3,
      "service_id": 2,
      "address_id": null,
      "technician_id": null,
      "booking_date": "2024-03-26",
      "booking_time": "15:00:00",
      "status": "pending",
      "admin_notes": null,
      "created_at": "2024-03-20T10:35:00.000Z",
      "service_name": "Custom PC Build Consultation",
      "price_type": "variable",
      "service_price": null,
      "service_slug": "custom-pc-build-consultation"
    },
    "payment": null
  }
}
```

### Error Responses

#### Booking Not Found
```json
{
  "success": false,
  "message": "Booking not found"
}
```

#### Access Denied (Not Owner)
```json
{
  "success": false,
  "message": "Access denied"
}
```

---

## Important Notes

### 1. **Transaction Safety**
All booking creation operations use database transactions to ensure data integrity. If any step fails, the entire operation is rolled back.

### 2. **Price Type Handling**
- **Fixed Price**: Payment is automatically created with `pending` status
- **Variable Price**: No payment is created (admin will handle pricing later)

### 3. **Address Handling**
- **Logged-in users**: Can use existing `address_id` or create new address via `new_address`
- **Guest users**: Must provide complete `guest_details` including address fields

### 4. **Authentication**
- Booking creation (`POST /bookings`) uses `optionalAuth` - works for both logged-in and guest users
- All other endpoints require authentication (`isAuth`)

### 5. **Date/Time Validation**
- Booking date and time must be in the future
- Format: `booking_date` (YYYY-MM-DD), `booking_time` (HH:MM:SS)

### 6. **SEO Optimization**
- Single-trip data aggregation (all data fetched in minimal queries)
- Transaction-based operations for data integrity
- Fast response times (<200ms TTFB target)

---

## Complete Booking Flow Example

### Step 1: Get Service Details (to check price_type)
```bash
curl -X GET http://localhost:5000/api/v1/services/1
```

### Step 2: Create Booking
```bash
# For logged-in user
curl -X POST http://localhost:5000/api/v1/bookings \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "service_id": 1,
    "booking_date": "2024-03-25",
    "booking_time": "14:30:00",
    "address_id": 5
  }'

# For guest user
curl -X POST http://localhost:5000/api/v1/bookings \
  -H "Content-Type: application/json" \
  -d '{
    "service_id": 1,
    "booking_date": "2024-03-25",
    "booking_time": "14:30:00",
    "guest_details": {
      "full_name": "John Doe",
      "email": "john.doe@example.com",
      "phone_number": "+92 300 1234567",
      "address_line_1": "456 Park Avenue",
      "city": "Karachi",
      "state": "Sindh",
      "postal_code": "75500"
    }
  }'
```

### Step 3: If Fixed Price - Process Payment
```bash
# Payment is automatically created with pending status
# Frontend can now redirect to payment gateway
# After payment succeeds, update payment status via webhook or admin panel
```

### Step 4: View Booking
```bash
curl -X GET http://localhost:5000/api/v1/bookings/1 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## Testing Checklist

- [ ] Create booking as logged-in user with existing address
- [ ] Create booking as logged-in user with new address
- [ ] Create booking as guest user
- [ ] Create booking with fixed price service (verify payment created)
- [ ] Create booking with variable price service (verify no payment)
- [ ] Get all bookings for authenticated user
- [ ] Get single booking by ID
- [ ] Get saved addresses
- [ ] Test validation errors (missing fields, invalid dates, etc.)
- [ ] Test access control (users can only view their own bookings)

