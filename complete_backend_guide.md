Here is a complete backend design document for the IT Repair Hub.

This document details the project's business logic, its SEO-first technical philosophy, a scalable file structure, and a comprehensive API endpoint map.

Project Brief: IT Repair Hub Backend
1. Business Overview
IT Repair Hub is a multi-faceted technology service and e-commerce platform. The business operates on five key modules:

Service Bookings: On-site and B2B repair services for a wide range of electronics (PCs, mobiles, CCTV, etc.).

E-Commerce (New): A standard storefront for selling new electronics, accessories, and gadgets.

Procurement & Used Market: A unique flow where the company buys used items from users (after inspection) and then lists those refurbished items for sale on its own "Used Market" storefront.

PC Builder: A tool for users to configure and order custom-built PCs from a list of components.

Price Check: A public-facing tool for users to get an estimated market value for their used hardware, which also functions as a lead-generation tool for the procurement module.

2. Core Technical Philosophy: SEO-First by Design
This backend is being built to support a Server-Side Rendered (SSR) or Static Site Generated (SSG) frontend (e.g., using Next.js, Nuxt.js, or a similar framework).

The Problem: Standard Client-Side Rendered (CSR) applications (like a basic React app) serve an empty HTML shell, which is detrimental to SEO.

The Solution: The backend must provide all necessary data for the frontend server to pre-render full, content-rich HTML pages. This is the primary design consideration.

This is achieved in three ways:

Clean URLs: All public-facing content (services, products) will be retrieved using a unique, human-readable slug.

Dedicated SEO Fields: The database schema includes seo_title and meta_description for all key models, which this API will expose.

Structured Data: The API will provide data in a way that is easily translated into structured data (like JSON-LD) for rich search results.

File & Folder Structure (Node.js/Express)
This structure promotes Separation of Concerns (SoC) and is highly scalable.

/it-repair-hub-backend
├── src/
│   ├── app.js                 # Main Express app initialization
│   ├── server.js              # Server entry point
│   │
│   ├── config/
│   │   ├── db.config.js       # Database connection (MySQL)
│   │   ├── passport.config.js # Auth strategy (local, Google)
│   │   └── env.config.js      # Environment variable loader
│   │
│   ├── models/
│   │   ├── user.model.js
│   │   ├── address.model.js
│   │   ├── service.model.js
│   │   ├── booking.model.js
│   │   ├── product.model.js
│   │   ├── order.model.js
│   │   ├── sellRequest.model.js
│   │   └── component.model.js
│   │
│   ├── controllers/
│   │   ├── auth.controller.js
│   │   ├── user.controller.js
│   │   ├── service.controller.js
│   │   ├── product.controller.js
│   │   ├── order.controller.js
│   │   ├── booking.controller.js
│   │   ├── pcBuilder.controller.js
│   │   ├── sell.controller.js
│   │   └── admin.controller.js      # Controller for admin-specific tasks
│   │
│   ├── routes/
│   │   ├── index.js               # Main API router
│   │   ├── auth.routes.js
│   │   ├── user.routes.js
│   │   ├── service.routes.js      # SEO Critical
│   │   ├── product.routes.js      # SEO Critical
│   │   ├── order.routes.js
│   │   ├── booking.routes.js
│   │   ├── pcBuilder.routes.js
│   │   ├── sell.routes.js
│   │   └── admin.routes.js          # Routes for admin panel
│   │
│   ├── middleware/
│   │   ├── auth.middleware.js     # (isAuth) - Checks for valid JWT
│   │   ├── admin.middleware.js    # (isAdmin) - Checks for 'admin' role
│   │   └── validate.middleware.js # Schema validation (Joi, express-validator)
│   │
│   ├── services/
│   │   ├── stripe.service.js      # Logic for Stripe payments
│   │   ├── google.service.js      # Google OAuth logic
│   │   └── priceModel.service.js  # Stub for your price prediction logic
│   │
│   └── utils/
│       ├── ApiError.js
│       ├── ApiResponse.js
│       ├── slugify.js
│       └── errorHandler.js
│
├── .env
└── package.json
API Endpoint Map
(All routes are prefixed with /api)

Module 1: Auth & User Management
[Public] POST /auth/register - Creates a new user (minimal info).

[Public] POST /auth/login - Logs in a user, returns JWT.

[Public] GET /auth/google - Initiates Google OAuth flow.

[Public] GET /auth/google/callback - Callback for Google OAuth.

[Auth] GET /users/me - Gets the profile of the currently logged-in user.

[Auth] PUT /users/me - Updates the user's profile (e.g., adding a phone number).

[Auth] GET /users/me/addresses - Gets all saved addresses for the user.

[Auth] POST /users/me/addresses - Adds a new address for the user.

[Auth] DELETE /users/me/addresses/:id - Removes an address.

Module 2: Services & Bookings
SEO & Public-Facing Routes:
[Public] GET /services

Purpose: Gets a list of all active services for the main "Services" page.

Data: id, name, slug, image_url, short_description.

[Public] GET /services/categories

Purpose: Gets all service categories for navigation and filtering.

[Public] GET /services/:slug

SEO-CRITICAL: This is the primary endpoint for Server-Side Rendering (SSR) a single service page.

Purpose: Fetches one service by its unique slug.

Data: All service data: name, long_description, image_url, price_type, price, warranty_info, and seo_title, meta_description.

Functional Routes:
[Public] POST /consultations

Purpose: Submits the "Free Consultation" form (for guest users).

[Auth] GET /bookings/me

Purpose: Gets the logged-in user's booking history.

[Auth] POST /bookings

Purpose: Creates a new service booking.

Body: { "service_id", "address_id", "booking_date", "booking_time" }

Module 3: E-Commerce (New & Used)
SEO & Public-Facing Routes:
[Public] GET /products

Purpose: Gets all products. Supports filtering.

Query Params: ?category=used-market, ?condition=new, ?search=...

Data: id, name, slug, price, condition, image_urls (primary image).

[Public] GET /products/categories

Purpose: Gets all product categories ("Used Market", "Accessories", etc.) for navigation.

[Public] GET /products/:slug

SEO-CRITICAL: The endpoint for SSR-ing a single product page.

Purpose: Fetches one product by its slug.

Data: All product data: name, description, price, stock_quantity, condition, warranty_info, specifications (JSON), image_urls (full gallery), and seo_title, meta_description.

Module 4: PC Builder
[Public] GET /components

Purpose: Gets all available PC components for the builder UI.

Response: A grouped object: { "CPU": [...], "GPU": [...], "RAM": [...] }

[Auth] GET /builds/me

Purpose: Gets all custom builds saved by the user.

[Auth] POST /builds

Purpose: Saves a new custom PC build configuration.

Body: { "configuration_data": [...], "total_estimated_price": ... }

Module 5: Orders & Payments
[Auth] POST /orders

Purpose: Creates a new order from a user's cart.

Body: { "address_id", "items": [{"product_id", "quantity"}, {"custom_build_id", "quantity"}] }

[Auth] GET /orders/me

Purpose: Gets the logged-in user's order history.

[Auth] POST /payments/create-intent

Purpose: Creates a payment intent with Stripe for a specific order.

Body: { "order_id" }

Returns: { "client_secret" }

[Public] POST /payments/webhook

Purpose: A public webhook for Stripe to send payment.succeeded events. This triggers updating orders.payment_status to 'paid' and adjusting product stock.

Module 6: Procurement & Price Check
[Auth] POST /sell-requests

Purpose: A user submits their device for a price check or to sell.

Body: { "request_type": "check_price" | "sell_item", "device_type", "specifications": {...} }

Note: If request_type is 'check_price', the priceModel.service.js is triggered to provide an estimated_price.

[Auth] GET /sell-requests/me

Purpose: Gets the user's history of submissions, showing status, estimated_price, and final_offer_price.

Module 7: Admin Panel Routes
All routes here are protected by both [isAuth] and [isAdmin] middleware.

Prefix: /api/admin

GET /admin/bookings - Gets all bookings, with user and service data (JOIN).

PUT /admin/bookings/:id - Updates a booking. Body: { "status": "confirmed" | "completed", "technician_id": ... }

GET /admin/orders - Gets all orders with user and item data.

PUT /admin/orders/:id - Updates an order's status. Body: { "order_status": "processing" | "shipped" }

GET /admin/sell-requests - Gets all user submissions.

PUT /admin/sell-requests/:id - Updates a sell request (e.g., sets final_offer_price and status).

Admin SEO & Content Management (CRUD):
POST /admin/services - Creates a new service (with all SEO fields).

PUT /admin/services/:id - Updates a service.

POST /admin/products - Creates a new product. This is how a "purchased" sell_request becomes a "Used Market" item.

PUT /admin/products/:id - Updates a product (stock, price, SEO fields).

POST /admin/components - Adds a new PC component to the builder.

PUT /admin/components/:id - Updates a component's price or stock.