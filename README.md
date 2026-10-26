# Grocery backend

NestJS API using Prisma and PostgreSQL. All routes are under `/api/v1`.

## Run locally

1. Copy `.env.example` to `.env` (`copy .env.example .env` in Windows Command Prompt), then set strong, unique values of at least 32 characters for the JWT and webhook secrets. The example values are placeholders and intentionally rejected at startup. Do not paste the project outline or API list into the command prompt; those are documentation, not shell commands.
2. Start PostgreSQL and set `DATABASE_URL` to the database connection string.
3. Run `npm install`, `npm run prisma:generate`, `npm run prisma:deploy`, and `npm run start:dev`.
4. To create an administrator, set `ADMIN_EMAIL` and `ADMIN_PASSWORD` in `.env`, then run `npm run prisma:seed`. The seed script loads `.env`, including `DATABASE_URL`, automatically.

For a containerized run, use `docker compose up --build` after creating `.env` from `.env.example`. Compose overrides the database host to use its PostgreSQL service. NestJS loads `.env` automatically at startup; if required JWT settings are missing, startup reports how to create the file.

## API documentation

After starting the API, open Swagger UI at `http://localhost:3000/api/docs`. The OpenAPI document is available at `http://localhost:3000/api/docs-json`. Use the **Authorize** button to provide a bearer token for protected endpoints.

## API capabilities

- `POST /api/v1/auth/register`, `/login`, and `/refresh`
- `GET /api/v1/admin/dashboard`, `GET /api/v1/admin/vendors`, `PATCH /api/v1/admin/vendors/:id/approve`, `POST /api/v1/admin/admins`, `POST /api/v1/admin/delivery-agents`, `POST /api/v1/admin/categories`, and `POST /api/v1/admin/categories/:parentId/subcategories`
- `GET /api/v1/vendors/me`, `POST /api/v1/vendors/stores`
- `GET /api/v1/categories`; `GET /api/v1/products`, `POST /api/v1/vendor/products`, `POST /api/v1/vendor/products/upload-image`, `PATCH /api/v1/vendor/products/:id`
- `GET /api/v1/vendor/inventory`, `PATCH /api/v1/vendor/inventory/:id`
- `GET /api/v1/cart`, `POST /api/v1/cart/items`
- `GET` and `POST /api/v1/addresses`; `POST` and `GET /api/v1/orders`, `PATCH /api/v1/vendor/orders/:id/status`
- `POST /api/v1/payments/checkout`, `PATCH /api/v1/payments/orders/:orderId/cash-on-delivery/collect`, `POST /api/v1/payments/webhook`
- `POST /api/v1/vendor/orders/:id/delivery`, `PATCH /api/v1/delivery/orders/:id/status`

Protected endpoints require `Authorization: Bearer <accessToken>`. Registration accepts `role: "CUSTOMER"` or `role: "VENDOR"`; vendor registration also requires `businessName`, and vendors remain pending until approved. If `role` is omitted, registration retains the legacy behavior of creating a vendor when `businessName` is supplied and a customer otherwise. Admin accounts cannot be created through public registration; configure `ADMIN_EMAIL` and `ADMIN_PASSWORD` and run `npm run prisma:seed` to provision one.

After bootstrapping the first admin with `ADMIN_EMAIL`, `ADMIN_PASSWORD`, and `npm run prisma:seed`, authenticated admins can create additional admins through `POST /api/v1/admin/admins`.

Categories support one subcategory level. Create a top-level category through `POST /api/v1/admin/categories` with `name` and `slug`. Create a subcategory through `POST /api/v1/admin/categories/:parentId/subcategories` with `name` and `slug`; use the top-level category ID in the URL. Both write endpoints require an admin token. `GET /api/v1/categories` returns active top-level categories with their active children. Filtering products by a top-level `categoryId` includes products from its subcategories.

Approved vendors can upload product images through `POST /api/v1/vendor/products/upload-image` using `multipart/form-data` with the file field named `image` (JPEG, PNG, GIF, or WebP, up to 5 MB). The response contains an `imageUrl`; pass that value when creating or updating a product. Uploaded files are served from `/uploads/` and persisted in the `grocery-uploads` Docker volume when using Compose.

`GET /api/v1/orders` requires authentication and scopes results by role: admins see all orders, vendors see orders from their own stores, and customers see only their own orders.

Checkout accepts `paymentMethod: "ONLINE"` (default) or `"CASH_ON_DELIVERY"`. COD orders are confirmed for vendor processing while payment remains pending; the assigned delivery agent records cash collection after marking the delivery delivered through `PATCH /api/v1/payments/orders/:orderId/cash-on-delivery/collect`. Online checkout currently creates a pending payment reference, not a provider-hosted checkout session. Connect a payment provider before production. The webhook expects JSON with `eventId`, `providerRef`, and `status` (`succeeded` or `failed`), signed as a lowercase hexadecimal HMAC-SHA256 of the exact request body using `PAYMENT_WEBHOOK_SECRET` in the `x-payment-signature` header. Replayed event IDs are ignored.

Order creation reserves inventory; unsuccessful payment webhooks restore it. This starter does not implement payment-provider-specific refund or cancellation flows.
