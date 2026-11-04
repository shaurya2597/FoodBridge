# Phase 2 manual testing guide (Windows PowerShell)

Prerequisites: backend running (`npm run dev` in `backend`), database seeded, Phase 2 migration applied.
Seeded password is your `SEED_DEMO_PASSWORD` (the examples use `Demo@1234`). Open PowerShell in any folder.

## 0. Helpers (paste once per PowerShell window)
```powershell
$api = "http://localhost:5000/api"
$pw  = "Demo@1234"
function Call($method, $path, $token, $body) {
  $p = @{ Method = $method; Uri = "$api$path"; ContentType = "application/json" }
  if ($token) { $p.Headers = @{ Authorization = "Bearer $token" } }
  if ($body)  { $p.Body = ($body | ConvertTo-Json -Depth 8) }
  Invoke-RestMethod @p
}
# Like Call, but prints the HTTP status and error body instead of throwing (for testing failures)
function Attempt($method, $path, $token, $body) {
  try { Call $method $path $token $body }
  catch { "HTTP $($_.Exception.Response.StatusCode.value__): $($_.ErrorDetails.Message)" }
}
function Login($email) { (Call Post "/auth/login" $null @{ email = $email; password = $pw }).data.token }
$cust   = Login "customer@foodbridge.demo"
$owner1 = Login "owner1@foodbridge.demo"     # owns Rajputana Rasoi, Biryani Junction, Pizza Piazza
$owner2 = Login "owner2@foodbridge.demo"     # owns Dosa Darbar, Wok & Roll, Burger Barn
$admin  = Login "admin@foodbridge.demo"
(Call Get "/health" $null $null)             # database should be "up"; payments run in demo mode without Razorpay keys
```

## 1. Find dishes
```powershell
$rr = (Call Get "/restaurants?q=Rajputana" $null $null).data[0]
$menu = (Call Get "/restaurants/$($rr.id)" $null $null).data
$paneer = ($menu.categories.foods | Where-Object name -eq "Paneer Butter Masala").id
$naan   = ($menu.categories.foods | Where-Object name -eq "Butter Naan").id
$dosaRest = (Call Get "/restaurants?q=Dosa Darbar" $null $null).data[0]
$dosa = ((Call Get "/restaurants/$($dosaRest.id)" $null $null).data.categories.foods | Where-Object name -eq "Masala Dosa").id
```

## 2. Cart
```powershell
(Call Post "/cart/items" $cust @{ foodItemId = $paneer; quantity = 2 }).data.breakdown   # subtotal 520
Attempt Post "/cart/items" $cust @{ foodItemId = $dosa }              # EXPECT 409 CART_RESTAURANT_CONFLICT (different restaurant)
$cart = (Call Get "/cart" $cust $null).data
Call Patch "/cart/items/$($cart.items[0].id)" $cust @{ quantity = 3 } | Out-Null
Attempt Post "/cart/items" $cust @{ foodItemId = $paneer; quantity = 0 }   # EXPECT 400
Attempt Get "/cart" $owner1 $null                                        # EXPECT 403 (owners cannot use the cart)
```

## 3. Checkout preview and coupons
```powershell
Call Patch "/cart/items/$($cart.items[0].id)" $cust @{ quantity = 2 } | Out-Null    # back to 2 x 260 = 520
$addr = (Call Get "/addresses" $cust $null).data[0]                  # the seeded Jodhpur address
(Call Post "/checkout/preview" $cust @{ addressId = $addr.id }).data.breakdown
#   EXPECT subtotal 520, discount 0, tax 26, deliveryFee 30, platformFee 5, total 581
(Call Post "/checkout/preview" $cust @{ addressId = $addr.id; couponCode = "WELCOME50" }).data.breakdown
#   EXPECT discount 100 (50% capped at 100), tax 21, total 476
(Call Post "/checkout/preview" $cust @{ couponCode = "NOPE" }).data.coupon       # applied False, error NOT_FOUND
```

## 4. Place a Cash-on-Delivery order and walk it through the restaurant
```powershell
$order = (Call Post "/orders" $cust @{ addressId = $addr.id; contactName = "Aarav Sharma"; contactPhone = "9000000002"; paymentMethod = "COD"; couponCode = "WELCOME50" }).data
$order.orderNumber; $order.total; $order.status                      # FB-..., 476, PLACED
(Call Get "/cart" $cust $null).data.items.Count                      # 0, cart was cleared
Attempt Post "/orders" $cust @{ addressId = $addr.id; contactName = "A B"; contactPhone = "9000000002"; paymentMethod = "COD" }  # EXPECT 400 empty cart

# Access control
Attempt Get "/orders/$($order.id)" $owner2 $null                         # EXPECT 404 (another restaurant's owner)
Attempt Patch "/orders/$($order.id)/status" $owner2 @{ status = "ACCEPTED" }   # EXPECT 404
Attempt Patch "/orders/$($order.id)/status" $cust @{ status = "ACCEPTED" }     # EXPECT 403 (customers cannot advance orders)
(Call Get "/orders?active=true" $owner1 $null).data.Count            # incoming orders for owner1's restaurants

# Status flow (owner1)
Attempt Patch "/orders/$($order.id)/status" $owner1 @{ status = "PREPARING" }  # EXPECT 409 (cannot skip ACCEPTED)
foreach ($s in "ACCEPTED","PREPARING","READY","OUT_FOR_DELIVERY","DELIVERED") {
  "{0} -> {1}" -f $s, (Call Patch "/orders/$($order.id)/status" $owner1 @{ status = $s }).data.status
}
$done = (Call Get "/orders/$($order.id)" $cust $null).data
$done.payment.status                                                 # PAID (cash collected)
$done.statusHistory | Format-Table status, at, by
Attempt Post "/orders/$($order.id)/cancel" $cust @{}                     # EXPECT 409 (already delivered)
```

## 5. Cancellation and coupon restore
```powershell
Call Post "/cart/items" $cust @{ foodItemId = $paneer; quantity = 2 } | Out-Null
$o2 = (Call Post "/orders" $cust @{ addressId = $addr.id; contactName = "Aarav Sharma"; contactPhone = "9000000002"; paymentMethod = "COD" }).data
(Call Post "/orders/$($o2.id)/cancel" $cust @{ reason = "Changed my mind" }).data.status    # CANCELLED
```

## 6. Online payment (demo mode)
```powershell
Call Post "/cart/items" $cust @{ foodItemId = $paneer; quantity = 2 } | Out-Null
$o3 = (Call Post "/orders" $cust @{ addressId = $addr.id; contactName = "Aarav Sharma"; contactPhone = "9000000002"; paymentMethod = "RAZORPAY" }).data
$pay = (Call Post "/payments/orders/$($o3.id)/create" $cust $null).data
$pay.mode; $pay.notice                                               # "demo" and a DEMO MODE notice
Attempt Patch "/orders/$($o3.id)/status" $owner1 @{ status = "ACCEPTED" }       # EXPECT 409 (payment not confirmed)
(Call Post "/payments/orders/$($o3.id)/verify" $cust @{ provider = "demo"; outcome = "failure" }).data.payment.status   # FAILED
Call Post "/payments/orders/$($o3.id)/create" $cust $null | Out-Null         # retry
(Call Post "/payments/orders/$($o3.id)/verify" $cust @{ provider = "demo"; outcome = "success" }).data.payment | Format-List status, isDemo, paidAt
Attempt Post "/payments/orders/$($o3.id)/verify" $owner1 @{ provider = "demo"; outcome = "success" }  # EXPECT 403 (owners cannot pay)
(Call Patch "/orders/$($o3.id)/status" $owner1 @{ status = "ACCEPTED" }).data.status              # ACCEPTED now
(Call Post "/orders/$($o3.id)/cancel" $cust @{ reason = "test refund" }).data.payment.status      # REFUNDED (demo refund)
```
With real `rzp_test_` keys in `.env`, `create` returns `razorpay: { keyId, razorpayOrderId }` for Razorpay Checkout and `verify` needs the
`razorpay_order_id`, `razorpay_payment_id` and `razorpay_signature` Razorpay hands back after payment.

## 7. Reviews
```powershell
Call Post "/cart/items" $cust @{ foodItemId = $paneer; quantity = 2 } | Out-Null
$o4 = (Call Post "/orders" $cust @{ addressId = $addr.id; contactName = "Aarav Sharma"; contactPhone = "9000000002"; paymentMethod = "COD" }).data
Attempt Post "/reviews/restaurants" $cust @{ orderId = $o4.id; rating = 5 }      # EXPECT 409 (not delivered yet)
foreach ($s in "ACCEPTED","PREPARING","READY","OUT_FOR_DELIVERY","DELIVERED") { Call Patch "/orders/$($o4.id)/status" $owner1 @{ status = $s } | Out-Null }
Attempt Post "/reviews/restaurants" $cust @{ orderId = $o4.id; rating = 6 }      # EXPECT 400
$rev = (Call Post "/reviews/restaurants" $cust @{ orderId = $o4.id; rating = 5; comment = "Great paneer!" }).data
Attempt Post "/reviews/restaurants" $cust @{ orderId = $o4.id; rating = 4 }      # EXPECT 409 (duplicate)
$item = (Call Get "/orders/$($o4.id)" $cust $null).data.items[0].id
Call Post "/reviews/foods" $cust @{ orderItemId = $item; rating = 4; comment = "Rich gravy" } | Out-Null
(Call Get "/reviews/restaurants/$($rr.id)?limit=5" $null $null).data | Format-Table rating, comment
Attempt Put "/reviews/restaurants/$($rev.id)" $owner1 @{ rating = 1 }            # EXPECT 403 (only customers write reviews)
(Call Put "/reviews/restaurants/$($rev.id)" $cust @{ rating = 4 }).data.rating
(Call Get "/restaurants/$($rr.id)" $null $null).data | Format-List rating, ratingCount
```

## 8. Live tracking with Socket.IO
Open two more PowerShell windows in the `backend` folder. Use your tokens from step 0 (`$cust`, `$owner1`, `$admin` hold the JWTs; copy with `$cust | Set-Clipboard`).
```powershell
# Window A (customer): watch your own orders
node scripts/watch-order.js <customer-token>
# Window B (owner1): watch incoming orders
node scripts/watch-order.js <owner1-token>
```
Back in the main window place a new order (step 4), then advance it as owner1: `Patch /orders/<id>/status`. Windows A and B print `order:placed` / `order:status`.
Negative check: `node scripts/watch-order.js <owner2-token> <that-order-id>` prints `subscribe -> { ok: false, error: 'Order not found' }`
and receives nothing. An admin token sees every order's events.
