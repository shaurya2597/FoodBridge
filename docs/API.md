# FoodBridge API (Phases 1-2)

Base URL: `http://localhost:5000/api`. JSON in, JSON out. Authenticated endpoints need `Authorization: Bearer <token>`.

**Success:** `{ "success": true, "data": ..., "meta"?: { total, page, limit, totalPages } }`
**Error:** `{ "success": false, "message": "...", "errors"?: [{ field, message }], "details"?: {...} }`
Common errors: `400` validation, `401` missing/invalid token, `403` wrong role, `404` not found **or not yours** (ids are never confirmed to strangers), `409` conflict, `429` rate limited.
Pagination: `page` (positive int) and `limit` (positive int, max 50) on every list. Money is in rupees (INR), 2 decimals.

## Phase 1 (unchanged)
`POST /auth/register|login|logout`, `GET /auth/me`, `GET /health`, `GET|POST|PUT|DELETE /restaurants`, `GET|POST|PUT|DELETE /foods`. See README.

## Addresses (supporting checkout) Role: CUSTOMER
| Method | Path | Body | Notes |
|---|---|---|---|
| GET | `/addresses` | | Your saved addresses |
| POST | `/addresses` | `{label?, line1, line2?, city, state, pincode (6 digits), isDefault?}` | 201 |

## Cart. Role: CUSTOMER (all endpoints return the full cart view)
Cart view: `{ restaurant, items[{id, foodItemId, name, quantity, selections, instructions, unitPrice, lineTotal}], itemCount, issues[], meetsMinOrder, coupon, breakdown }`
| Method | Path | Body | Errors |
|---|---|---|---|
| GET | `/cart` | | |
| POST | `/cart/items` | `{foodItemId, quantity 1-20 (default 1), selections?: [{group, option}], instructions?, replaceCart?: bool}` | 404 dish missing/unavailable; 409 `CART_RESTAURANT_CONFLICT` (other restaurant's items; send `replaceCart:true` to swap) or restaurant closed; 400 bad option |
| PATCH | `/cart/items/:itemId` | `{quantity 1-20}` | 404 if not in your cart |
| DELETE | `/cart/items/:itemId` | | 404 if not in your cart |
| DELETE | `/cart` | | Empties the cart |

Identical dish + options + note merge into one line. Prices always come from the database; any `price` sent by a client is ignored.

## Checkout. Role: CUSTOMER
**POST `/checkout/preview`**. Body: `{couponCode?, addressId? | address?}` (not both).
Returns the cart view plus `deliverable?`, `minOrderMessage?`, `canCheckout`. A bad coupon is *reported* in `coupon.error` (`NOT_FOUND|INACTIVE|EXPIRED|EXHAUSTED|USER_LIMIT|MIN_ORDER`) instead of failing the request.
`breakdown = { subtotal, discount, tax, deliveryFee, platformFee, total }`. Tax (default 5% GST) applies to subtotal minus discount; delivery fee comes from the restaurant; platform fee default ₹5 (`TAX_RATE_PERCENT`, `PLATFORM_FEE` in `.env`).

## Orders
| Method | Path | Role | Body / Query |
|---|---|---|---|
| POST | `/orders` | CUSTOMER | `{addressId \| address, saveAddress?, contactName, contactPhone, instructions?, couponCode?, paymentMethod: COD\|UPI\|RAZORPAY}`. Places the order from your server-side cart in one transaction. 201 `{data: order, next: {action: PAY_ONLINE\|NONE, endpoint?}}` |
| GET | `/orders` | CUSTOMER / RESTAURANT_OWNER / ADMIN | `?status=&active=true\|false&restaurantId=&page=&limit=`. Customers see their orders, owners their restaurants' orders, admins all. `active=true` = current orders |
| GET | `/orders/:id` | same | 404 unless it is yours / your restaurant's / you are admin |
| PATCH | `/orders/:id/status` | RESTAURANT_OWNER, ADMIN | `{status: ACCEPTED\|PREPARING\|READY\|OUT_FOR_DELIVERY\|DELIVERED\|CANCELLED, reason?}`. `reason` (3-200 chars) is required for CANCELLED |
| POST | `/orders/:id/cancel` | CUSTOMER, RESTAURANT_OWNER, ADMIN | `{reason?}` (required for owner/admin) |

Order: `{id, orderNumber (FB-YYMMDD-XXXXXX), status, subtotal, deliveryFee, tax, platformFee, discount, total, estimatedAt, deliveryAddress, contactName, contactPhone, instructions, cancelReason, statusHistory[{status, at, by, note?}], items[], payment{method, status, amount, isDemo, paidAt, note}, restaurant{...}, coupon?}`

**Status rules:** `PLACED → ACCEPTED → PREPARING → READY → OUT_FOR_DELIVERY → DELIVERED`, no skipping, no going back, nothing after `DELIVERED`/`CANCELLED`.
Customers may only cancel (while `PLACED` or `ACCEPTED`). Owners/admins may cancel until `READY`. Nobody can cancel once `OUT_FOR_DELIVERY`.
`PLACED → ACCEPTED` needs COD or a confirmed (`PAID`) online payment. COD becomes `PAID` when the order is `DELIVERED`.
Errors: 400 reason missing, 403 customer tried a forward step, 404 not your order, 409 invalid transition / concurrent change.
Cancelling restores the coupon use. A paid **demo** payment is marked `REFUNDED`; a paid Razorpay-test payment is left `PAID` with a note (refund is manual, see limitations).

## Payments. Role: CUSTOMER (own orders only; others get 404)
| Method | Path | Body | What it does |
|---|---|---|---|
| POST | `/payments/orders/:orderId/create` | | Creates (or reuses) the provider order for the amount stored on the order. Returns `mode: "demo"\|"razorpay_test"`, a `notice`, and for Razorpay `{keyId, razorpayOrderId}` for the checkout widget. UPI in demo mode returns a labelled `demoUpi` intent. 400 for COD; 409 if cancelled/already paid |
| POST | `/payments/orders/:orderId/verify` | Razorpay: `{provider:"razorpay", razorpay_order_id, razorpay_payment_id, razorpay_signature}`. Demo: `{provider:"demo", outcome:"success"\|"failure"}` | The **only** way a payment becomes `PAID`. Razorpay: HMAC-SHA256 signature checked on the server with the secret, and the provider order id must match this order. Demo outcomes are accepted only for demo payments. Idempotent |
| POST | `/payments/orders/:orderId/failed` | `{reason?: FAILED\|CANCELLED_BY_USER, description?}` | Records a failed/cancelled attempt. Never downgrades a `PAID` payment. Response `canRetry` |

Modes: with no Razorpay keys the server runs in **demo mode** (no money, no provider contact; `payment.isDemo = true`). With `rzp_test_` keys it uses Razorpay's test mode. `rzp_live_` keys are rejected at startup. Demo mode is allowed outside production unless `ALLOW_DEMO_PAYMENTS=false`. Card details never touch this server.

## Reviews
| Method | Path | Role | Body |
|---|---|---|---|
| POST | `/reviews/restaurants` | CUSTOMER | `{orderId, rating 1-5 (int), comment?}`. Order must be yours and `DELIVERED`; one per order (409 on duplicate) |
| POST | `/reviews/foods` | CUSTOMER | `{orderItemId, rating, comment?}`. One per ordered line |
| GET | `/reviews/restaurants/:restaurantId` | public | `?page&limit` |
| GET | `/reviews/foods/:foodItemId` | public | `?page&limit` |
| PUT | `/reviews/restaurants/:id`, `/reviews/foods/:id` | author (CUSTOMER) | `{rating?, comment?}` |
| DELETE | same | author or ADMIN | |

Restaurant and dish average ratings update atomically (running average, so seeded demo ratings blend with real ones).

## Socket.IO
Connect with `io(URL, { auth: { token } })`. Same JWT rules as HTTP (valid token, user exists, not blocked).
Auto-joined rooms: `user:<yourId>` and, for admins, `admin:orders`.
| Direction | Event | Payload |
|---|---|---|
| client → server | `order:subscribe` `{orderId}` (ack `{ok, error?}`) | Joins `order:<id>` only if you are its customer, its restaurant's owner, or admin |
| client → server | `order:unsubscribe` `{orderId}` | |
| server → client | `order:placed` | new order → restaurant owner + admins |
| server → client | `order:status` | `{orderId, orderNumber, status, previousStatus, paymentStatus, reason, estimatedAt, at}` → customer, owner, admins, order room |
| server → client | `order:payment` | `{orderId, orderNumber, status, paymentStatus, at}` → same audience |
Events are sent only after the database change is committed.

---

# Phase 3: donations, NGOs and food assistance

Same conventions as above. Privacy rule of thumb: **addresses and phone numbers are shown only to the people who need them.**

## Donations
Roles that can post: `CUSTOMER` (individual donor) and `RESTAURANT_OWNER` (donating for their own approved restaurant). Roles that can claim: **verified** `NGO`s.

| Method | Path | Auth | Body / Query |
|---|---|---|---|
| POST | `/donations` | CUSTOMER, RESTAURANT_OWNER | `{restaurantId? (owners only, required for them), foodName, category, quantity, servings, foodType VEG\|NON_VEG, preparedAt, expiresAt, pickupAddress, city, latitude?, longitude?, contactPhone, imageUrl?, instructions?, safetyConfirmed: true}` |
| GET | `/donations` | public (optional token) | `?city=&foodType=&q=&sort=expiry\|newest&page=&limit=` plus `status=` and `mine=true` for logged-in users |
| GET | `/donations/:id` | public (optional token) | |
| POST | `/donations/:id/request` | verified NGO | `{message?}`: claims the donation (atomic, first NGO wins) |
| PATCH | `/donations/:id/status` | donor or the claiming NGO | `{status: POSTED\|ACCEPTED\|PICKUP_SCHEDULED\|COLLECTED\|DISTRIBUTED\|CANCELLED, pickupAt?, reason?}` |

**Categories:** Cooked meal, Bakery, Packaged food, Fruits & vegetables, Beverages, Other.

**Food-safety validation (400 with `details.errors`):** `safetyConfirmed` must be `true`; the food must not be expired and must stay collectable for at least 30 more minutes; preparation time cannot be in the future (5 min clock tolerance); consume-before must be after preparation; maximum hours from preparation to consume-before: cooked meals 12, bakery and beverages 48, everything else 7 days. A donor may have at most 20 active donations. `imageUrl` must be http(s).

**What each caller sees**
| Caller | Fields |
|---|---|
| Public / unverified NGO | food, quantity, servings, veg type, city, availability time, status. Individuals appear as "Individual donor". **No address, no phone.** Only open (`POSTED`, not expired) donations are visible. |
| Verified NGO browsing | the above plus pickup address, coordinates and instructions. No phone. |
| NGO holding the donation | the above plus status history and pickup time; **phone only once the donor has accepted**. |
| Donor / admin | everything, plus `claimedBy` (NGO) and the list of `requests`. |
Anyone who is not allowed to see a donation gets `404`.

**Status flow** (who may do each step):
`POSTED` → `NGO_REQUESTED` (NGO, via `/request`) → `ACCEPTED` (donor) → `PICKUP_SCHEDULED` (NGO, needs `pickupAt` in the future and before expiry) → `COLLECTED` (NGO) → `DISTRIBUTED` (NGO).
- Donor **rejects** a request: `status: "POSTED"` from `NGO_REQUESTED`. The NGO cannot re-request that donation.
- NGO **withdraws** (before collection): `status: "POSTED"`. It may request again later.
- Donor **cancels** (before collection): `status: "CANCELLED"`.
- `ACCEPTED`, `PICKUP_SCHEDULED` and `COLLECTED` are refused once the food has expired (`409`). Expired donations become `EXPIRED` automatically (checked on every action, and swept every minute).
- Wrong person for a step: `403`. Invalid jump: `409`. Not a participant: `404`. Someone else changed it at the same moment: `409`.
- Admins can view all donations in Phase 3 but cannot change them (flagging/moderation arrive in Phase 4).

**Simultaneous claims:** the claim is a single conditional database update (`status = POSTED`, unclaimed, not expired, same version). Only one NGO can win; the rest receive `409`.

## NGO profile. Role: NGO
| Method | Path | Body |
|---|---|---|
| GET | `/ngo/profile` | |
| PUT | `/ngo/profile` | any of `{orgName, contactPhone, serviceCity, serviceArea, description}`. `isVerified` and `registrationNo` cannot be changed here |
| GET | `/ngo/summary` | donation counts by status and servings collected |
NGO registration is `POST /auth/register` with `role: "NGO"` and an `ngo` object. New NGOs are **unverified**; an administrator verifies them (Phase 4).

## Food assistance
| Method | Path | Auth | Body / Query |
|---|---|---|---|
| POST | `/assistance` | public (token optional, 10/hour per IP) | `{name, phone, people 1-500, requirements[] (Cooked meal, Dry ration, Baby food, Drinking water, Any food), foodType?, location, city, notes?}`. Max 3 open requests per phone number (`429`) |
| GET | `/assistance` | CUSTOMER, RESTAURANT_OWNER, NGO, ADMIN | `?status=&mine=true&city=&page=&limit=`. People see their own requests; verified NGOs see **open** requests in their service city (or `city=`) without name or phone, or their assigned ones with `mine=true`; admins see all |
| GET | `/assistance/:id` | public | Anyone with the (unguessable) id can follow status; they see no name, phone or location. The requester, the assigned NGO and admins see full details |
| PATCH | `/assistance/:id/status` | requester or verified NGO | `{status: OPEN\|ASSIGNED\|FULFILLED\|CLOSED, note?}` |
Flow: `OPEN` → `ASSIGNED` (any verified NGO; first one wins, atomic) → `FULFILLED`. The assigned NGO may release it back to `OPEN` or close it; the requester may close it while open or assigned. Finished requests are frozen.

## Socket.IO additions
Room membership: verified NGOs auto-join `ngo:available` when they connect (so an NGO verified later gets live updates from its next connection); admins join `admin:donations`.
| Event | Sent to | Payload (never includes addresses or phones) |
|---|---|---|
| `donation:posted` | verified NGOs, admins | `{donationId, foodName, status, available, at}` |
| `donation:status` | the donor, the claiming NGO, admins | `{donationId, foodName, status, previousStatus, pickupScheduledAt, at}` |
| `donation:availability` | verified NGOs, admins | `{donationId, status, available, at}`: `false` when a donation is claimed, cancelled or expired, `true` when released back to the pool |
| `assistance:new` | verified NGOs, admins, the requester | `{requestId, status, city, at}` |
| `assistance:status` | requester, assigned NGO, admins (and NGOs when it re-opens or closes) | `{requestId, status, city, at}` |

---

# Phase 4: admin, moderation, complaints and account security

## Admin API. Role: ADMIN only
Every route under `/api/admin` needs a valid token **and** the `ADMIN` role (`401` without a token, `403` for any other role). Lists share the usual `?page=&limit=` (positive integers, `limit` max 50) and return `{data, meta}`. Every state-changing admin action is recorded in the audit log.

| Method | Path | Query / Body | Purpose |
|---|---|---|---|
| GET | `/admin/dashboard` | | Totals: users (by role, blocked), restaurants (by status, pending approval), orders (by status, last 24h), revenue, active donations, servings donated, NGOs awaiting verification, open assistance requests, pending complaints |
| GET | `/admin/analytics` | `?days=7\|30\|90` (default 30) | `ordersOverTime` (orders, cancelled, revenue per day, India time), `revenueTrend`, `popularRestaurants` (top 5), `topFoodItems` (top 10), `donations` (per day, by status, servings saved in range and all time), `assistance.byStatus`, `activeUsers` |
| GET | `/admin/users` | `?q=&role=&blocked=true\|false` | Search name/email. Never returns password or reset data |
| PATCH | `/admin/users/:id/block` | `{blocked: bool, reason (required when blocking)}` | Blocks or unblocks. A blocked user's token stops working immediately and their open Socket.IO connections are closed. Admins cannot block themselves or other admins |
| GET | `/admin/restaurants` | `?q=&status=&city=` | All restaurants with owner and order counts |
| PATCH | `/admin/restaurants/:id/status` | `{status: APPROVED\|REJECTED\|SUSPENDED, reason}` | Approve, reject or suspend. Reason required for REJECTED and SUSPENDED |
| GET | `/admin/orders` | `?q=(order number or customer name)&status=&paymentStatus=&paymentMethod=&restaurantId=&userId=&from=&to=` | Monitor all orders and payments |
| GET | `/admin/orders/:id` | | Full order with customer details |
| GET | `/admin/ngos` | `?q=&verified=true\|false` | NGOs, unverified first |
| PATCH | `/admin/ngos/:id/verification` | `{verified: bool, note?}` | Verify or un-verify. Takes effect on live connections at once |
| GET | `/admin/donations` | `?q=&status=&city=&donorType=&ngoId=&expired=true\|false` | Everything, including contact details and request counts |
| GET | `/admin/donations/:id` | | Details plus every NGO request |
| POST | `/admin/donations/:id/flag` | `{reason}` | Flag unsafe food. Allowed while POSTED, NGO_REQUESTED, ACCEPTED, PICKUP_SCHEDULED or COLLECTED. Pending/approved NGO requests are rejected and the donation leaves circulation |
| POST | `/admin/donations/:id/unflag` | `{reason?}` | Restores it: COLLECTED if it was flagged after collection, otherwise back to POSTED (NGO released) or EXPIRED if time ran out |
| GET | `/admin/donation-requests` | `?status=&ngoId=` | Monitor collection requests |
| GET | `/admin/complaints` | `?q=&status=&category=` | Support queue, oldest unresolved first |
| GET | `/admin/complaints/:id` | | With the linked order/donation and the complainant |
| PATCH | `/admin/complaints/:id` | `{status: IN_REVIEW\|RESOLVED\|REJECTED, resolution (min 5 chars, required to close)}` | Closed complaints are frozen |
| GET | `/admin/audit-logs` | `?entityType=USER\|RESTAURANT\|NGO\|DONATION\|COMPLAINT&adminId=` | Who did what, when |

Order status changes by an admin use the existing `PATCH /orders/:id/status`. Adding or editing restaurants uses the existing `POST/PUT /restaurants` (admin-created restaurants go live immediately; owner-created ones start `PENDING` and stay hidden until approved).

**Restaurant status rules:** `PENDING → APPROVED|REJECTED`, `APPROVED → SUSPENDED`, `SUSPENDED → APPROVED`, `REJECTED → APPROVED` (reconsideration). Anything else is `409`. The owner sees the reason in `moderationNote`. Suspending blocks new orders; orders already in progress continue.

## Complaints (any logged-in user)
| Method | Path | Body / Query |
|---|---|---|
| POST | `/complaints` | `{category: ORDER\|DELIVERY\|FOOD_QUALITY\|PAYMENT\|DONATION\|OTHER, subject (5-120), details (10-1000), orderId? \| donationId?}` (not both). The order/donation must be one you can see, else `404`. Max 10 open complaints per person, 10 new per hour |
| GET | `/complaints` | `?status=&page=&limit=` your own |
| GET | `/complaints/:id` | yours only (`404` otherwise); includes the admin's resolution message |

## Account security (new in `/auth`)
| Method | Path | Auth | Body |
|---|---|---|---|
| PUT | `/auth/me` | token | `{name?, phone? (null clears)}`. Role can never be changed |
| POST | `/auth/forgot-password` | public (5/hour per IP) | `{email}`. Always answers `200` with the same message, whether or not the email exists |
| POST | `/auth/reset-password` | public (10/hour per IP) | `{token, password}`. The 64-character token from the email link; valid 30 minutes, single use; a newer request replaces the older link |
| POST | `/auth/change-password` | token | `{currentPassword, newPassword}`. Returns `{data: {token}}`, a fresh token for this session |
| POST | `/auth/logout-all` | token | Ends every session on every device |

Password rules are the same as registration (8+ characters, a letter and a number, at most 72 bytes).
**Session revocation:** each token carries the user's `tokenVersion`. Changing/resetting a password and `logout-all` raise it, so all older tokens (and their live sockets) stop working. Tokens issued before Phase 4 keep working until then.
**Reset email:** with `SMTP_HOST/USER/PASS` set, the link is emailed. Without SMTP it runs in **demo mode**: the link is printed in the server console. `DEMO_RETURN_RESET_TOKEN=true` additionally returns `demoResetToken` in the API response so the flow can be demonstrated without email. That switch is refused when `NODE_ENV=production`. Only a SHA-256 hash of the token is stored.

## Addresses (completes Phase 2)
`PUT /addresses/:id` (any address field, `isDefault`) and `DELETE /addresses/:id`: yours only (`404` otherwise). Past orders keep their own copy of the address text.

## Socket.IO additions
| Event | Sent to | Payload |
|---|---|---|
| `restaurant:status` | the restaurant's owner | `{restaurantId, name, status, reason, at}` |
| `ngo:verification` | the NGO's user | `{verified, note, at}` |
| `complaint:status` | the complainant | `{complaintId, status, resolution, at}` |
Blocking a user, changing a password, resetting a password and `logout-all` **disconnect** the user's live sockets. Verifying or un-verifying an NGO adds/removes its open sockets from the live donation-alert room immediately.
