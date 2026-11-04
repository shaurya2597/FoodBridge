# FoodBridge: Food Delivery + Food Donation Platform

Full-stack project (React + Express + PostgreSQL/Prisma), built in phases.

| Phase | Scope | Status |
|---|---|---|
| 1 | Schema, auth + RBAC, restaurants & food APIs, seed data, sockets | Done; migrated, seeded and health-checked on the author's machine |
| 2 | Cart, checkout, orders, payments (demo/Razorpay), Socket.IO tracking, reviews | Done and tested by the author |
| 3 | Donations, NGO claiming (transactional), assistance requests | Done and tested by the author |
| 4 | Admin APIs (restaurant approve/reject/suspend, NGO verification, user block/unblock with socket disconnect, donation flagging), analytics, complaints, audit log, forgot-password, profile and session security | Implemented. Needs your migration and tests (see below) |
| 5 | Frontend (all pages and dashboards) | Not started |

## Prerequisites
Node 20+ and PostgreSQL 14+ running locally.

## Setup (exact commands)
```bash
# 1. Create the database (any ONE of these)
psql -U postgres -c "CREATE DATABASE foodbridge;"
#   or: createdb foodbridge     or: create it in pgAdmin

# 2. From the project root
cp .env.example backend/.env        # Windows: copy .env.example backend\.env
#    edit backend/.env: DATABASE_URL (your postgres password), JWT_SECRET, SEED_DEMO_PASSWORD

npm install
cd backend

# 3. Validate schema, generate client, type-check
npx prisma validate
npx prisma generate
npm run typecheck

# 4. Create tables (generates prisma/migrations/ on first run; commit that folder)
npx prisma migrate dev --name init

# 5. Seed demo data (refuses to run on a non-empty database)
npm run prisma:seed

# 6. Start the API
npm run dev                          # http://localhost:5000/api/health
```

Production-style run: `npm run build && npm run prisma:deploy && npm start`.

### Seeding safety
`npm run prisma:seed` only works on an **empty** database and aborts otherwise without changing anything.
The check counts rows in **all 18 tables**, not just users, and lists what it found. It never merges into or
duplicates existing data. To wipe **everything** in the target database and reseed, run `npm run prisma:seed:reset`
(sets `RESET_DEMO_DATA=true`); the wipe is a single transaction. It never runs when `NODE_ENV=production`.
Note: if `prisma migrate dev` offers to reset the database and you accept, Prisma runs the seed automatically.

## Phase 2 setup (cart, checkout, orders, payments, tracking, reviews)
Phase 2 adds columns/tables, so you need ONE new migration. It is additive and does not delete data.
```powershell
cd backend
npm install
npx prisma validate
npx prisma generate
npx prisma migrate dev --name phase2_orders_payments_reviews
npm run typecheck
npm run build
npm run test:unit
npm run dev
```
If `migrate dev` ever says it must **reset** the database (drift), answer **No** and send me the message.
Do NOT run `prisma:seed:reset` unless you want to wipe everything. The existing seed data keeps working;
existing coupons get `perUserLimit = 1`.

Full endpoint reference: [docs/API.md](docs/API.md). Manual walkthrough: [docs/MANUAL_TESTING.md](docs/MANUAL_TESTING.md).

### Payment modes
Without Razorpay keys the server runs in **demo mode** (clearly labelled, `isDemo: true`, no real money). With `rzp_test_` keys in
`backend/.env` it uses Razorpay's test mode and verifies signatures server-side. Live keys are rejected.

### Automated tests
- `npm run test:unit`: pure business rules (pricing, coupons, status transitions, order access, payment signatures, cart options, opening hours, review eligibility). No database needed.
- `npm run test:integration`: full API + Socket.IO flows against a real database. It **skips itself** unless `TEST_DATABASE_URL` is set. Use a separate database:
```powershell
psql -U postgres -c "CREATE DATABASE foodbridge_test;"
$env:DATABASE_URL = "postgresql://postgres:YOURPASSWORD@localhost:5432/foodbridge_test?schema=public"
npx prisma migrate deploy
$env:TEST_DATABASE_URL = $env:DATABASE_URL
npm run test:integration
```
The tests create their own users/restaurants (tagged) and delete them afterwards.

## Phase 3 setup (donations, NGO claiming, food assistance)
Phase 3 adds a few columns and one enum value, so you need ONE more additive migration:
```powershell
cd backend
npm install
npx prisma validate
npx prisma generate
npx prisma migrate dev --name phase3_donations_assistance
npm run typecheck
npm run build
npm run test:unit
npm run dev
```
If `migrate dev` says it must **reset** the database, answer **No** and send me the message. Do not run `prisma:seed:reset`.
Endpoints: [docs/API.md](docs/API.md) (Phase 3 section). Walkthrough: [docs/MANUAL_TESTING_PHASE3.md](docs/MANUAL_TESTING_PHASE3.md).
`npm run test:integration` now also runs the donation, NGO and assistance flows (same `TEST_DATABASE_URL` rules as Phase 2).
The expiry sweep starts automatically with the server and runs every minute.
Newly registered NGOs are unverified and cannot claim donations until an administrator verifies them (admin tools arrive in Phase 4).
The seeded NGO (`ngo@foodbridge.demo`) is already verified.

## Phase 4 setup (admin, moderation, complaints, account security)
Phase 4 adds columns, one table (`AuditLog`) and one npm package (`nodemailer`, for reset emails), so run:
```powershell
cd backend
npm install
npx prisma validate
npx prisma generate
npx prisma migrate dev --name phase4_admin_complaints_security
npm run typecheck
npm run build
npm run test:unit
npm run dev
```
If `migrate dev` says it must **reset** the database, answer **No** and send me the message. Do not run `prisma:seed:reset`.
Endpoints: [docs/API.md](docs/API.md) (Phase 4 section). Walkthrough: [docs/MANUAL_TESTING_PHASE4.md](docs/MANUAL_TESTING_PHASE4.md).
`npm run test:integration` also runs the admin, complaint, account and admin-socket flows (same `TEST_DATABASE_URL` rules as before).
Admin login (seeded): `admin@foodbridge.demo`. Existing logins keep working after the migration.
Reset emails use SMTP when `SMTP_HOST/USER/PASS` are set; otherwise the reset link is printed in the server console (demo mode).

## Demo accounts
Password = the `SEED_DEMO_PASSWORD` in your `backend/.env` (`Demo@1234` in `.env.example`).

| Role | Email |
|---|---|
| Admin | admin@foodbridge.demo |
| Customer | customer@foodbridge.demo |
| Restaurant owner | owner1@foodbridge.demo (3 restaurants), owner2@foodbridge.demo |
| NGO (verified) | ngo@foodbridge.demo |

Seed images are `placehold.co` placeholders; real photos arrive with Cloudinary uploads later.

## API (Phase 1)
Responses: `{ success, data, meta? }`; errors: `{ success: false, message, errors? }`. Send `Authorization: Bearer <token>`.

- `POST /api/auth/register | login | logout`, `GET /api/auth/me`
- `GET /api/health` (includes database status)
- `GET /api/restaurants?q=&cuisine=&veg=true&minRating=&maxPriceForTwo=&sort=popularity|rating|deliveryTime|price&page=&limit=`
- `GET /api/restaurants/:id` (menu by category), `POST/PUT/DELETE /api/restaurants` (owner/admin)
- `GET /api/foods?q=&restaurantId=&type=VEG|NON_VEG&includeUnavailable=true&page=&limit=`
- `GET /api/foods/:id`, `POST/PUT/DELETE /api/foods` (owner/admin)

`page` and `limit` must be positive integers; `limit` max 50. Unavailable dishes are hidden from the public
(list returns none, `GET /foods/:id` returns 404); only the restaurant's owner or an admin can see them
(`includeUnavailable=true` needs `restaurantId`).

## API testing (curl)
```bash
API=http://localhost:5000/api

# health + DB
curl $API/health

# login and keep the token
TOKEN=$(curl -s -X POST $API/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"owner1@foodbridge.demo","password":"Demo@1234"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['data']['token'])")

curl $API/auth/me -H "Authorization: Bearer $TOKEN"
curl "$API/restaurants?veg=true&sort=rating&limit=5"
curl "$API/restaurants?q=biryani"                    # finds restaurants by dish name too

# validation checks (all should be 400)
curl -i "$API/restaurants?limit=0"
curl -i "$API/restaurants?limit=51"
curl -i "$API/restaurants?page=-1"
curl -i -X POST $API/auth/login -H 'Content-Type: application/json' -d '{bad json'

# authorization checks
curl -i -X POST $API/restaurants -d '{}' -H 'Content-Type: application/json'            # 401 (no token)
CUST=$(curl -s -X POST $API/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"customer@foodbridge.demo","password":"Demo@1234"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['data']['token'])")
curl -i -X POST $API/foods -H "Authorization: Bearer $CUST" -H 'Content-Type: application/json' -d '{}'  # 403

# unavailable item is hidden: create one as owner, mark unavailable, then GET it publicly -> 404
```
Ownership check: log in as owner2 and `PUT /api/restaurants/<id of a Rajputana Rasoi>` should return 403.

## Phase 4 commitments (admin module)
- **Restaurant approval:** `PATCH /api/admin/restaurants/:id/status` with `APPROVED | REJECTED | SUSPENDED`
  (restaurants registered by owners start as `PENDING` and stay hidden from the public until approved). Plus list/add/edit.
- **Account blocking:** `PATCH /api/admin/users/:id/block` sets `isBlocked`, and in the same handler calls
  `disconnectUser(userId)` from `src/sockets` so any open Socket.IO sessions are closed immediately.
  HTTP requests are already rejected for blocked users because the database is checked on every request.
  Unblocking reverses the flag. Admins cannot block themselves or other admins.

## Password rules
Minimum 8 characters, at least one letter and one number, and at most **72 UTF-8 bytes** (bcrypt ignores anything
beyond that, so longer passwords are rejected instead of silently truncated). Non-English characters and emoji use
2 to 4 bytes each.

## Security notes
bcrypt (12 rounds, 72-char password cap); ADMIN cannot be self-registered; JWTs pinned to HS256 and the user's
role/blocked status re-read from the DB on every request and socket connection; Zod validation with unknown
fields stripped; http(s)-only image URLs; Helmet, CORS allow-list, global + per-route rate limits (failed-login
limiter); uniform login error plus dummy hash compare to blunt account enumeration; owner ids hidden from public responses.

## Verification status
This code was written and statically checked in a sandbox with no network or database. `prisma validate`,
`prisma generate`, `tsc`, migrations, the seed and API calls had **not been executed** when this ZIP was produced.
Treat Phase 1 as untested until the setup commands above complete without errors on your machine.
