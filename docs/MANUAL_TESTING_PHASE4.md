# Phase 4 manual testing guide (Windows PowerShell)

Prerequisites: backend running, Phase 4 migration applied. Seeded password = your `SEED_DEMO_PASSWORD` (examples use `Demo@1234`).
For the password-reset demo add `DEMO_RETURN_RESET_TOKEN=true` to `backend/.env` and restart (never in production).

## 0. Helpers (paste once per window)
```powershell
$api = "http://localhost:5000/api"; $pw = "Demo@1234"
function Call($method, $path, $token, $body) {
  $p = @{ Method = $method; Uri = "$api$path"; ContentType = "application/json" }
  if ($token) { $p.Headers = @{ Authorization = "Bearer $token" } }
  if ($body)  { $p.Body = ($body | ConvertTo-Json -Depth 8) }
  Invoke-RestMethod @p
}
function Attempt($method, $path, $token, $body) {
  try { Call $method $path $token $body } catch { "HTTP $($_.Exception.Response.StatusCode.value__): $($_.ErrorDetails.Message)" }
}
function Login($email, $password = $pw) { (Call Post "/auth/login" $null @{ email = $email; password = $password }).data.token }
$cust = Login "customer@foodbridge.demo"; $owner1 = Login "owner1@foodbridge.demo"; $owner2 = Login "owner2@foodbridge.demo"
$ngo = Login "ngo@foodbridge.demo"; $admin = Login "admin@foodbridge.demo"
function Iso($minutes) { (Get-Date).AddMinutes($minutes).ToUniversalTime().ToString("o") }
```

## 1. Only admins get in
```powershell
Attempt Get "/admin/dashboard" $null $null        # EXPECT 401
Attempt Get "/admin/dashboard" $cust $null        # EXPECT 403
Attempt Get "/admin/users" $owner1 $null          # EXPECT 403
(Call Get "/admin/dashboard" $admin $null).data | ConvertTo-Json -Depth 5
```

## 2. Dashboard and analytics
```powershell
$d = (Call Get "/admin/dashboard" $admin $null).data
$d.users.total; $d.restaurants.pendingApproval; $d.orders.total; $d.revenue.total; $d.donations.active; $d.donations.servingsDonated; $d.complaints.pending
$a = (Call Get "/admin/analytics?days=7" $admin $null).data
$a.ordersOverTime | Format-Table date, orders, cancelled, revenue          # 7 rows, one per day (India time)
$a.popularRestaurants | Format-Table name, orders, revenue
$a.topFoodItems | Format-Table name, restaurant, quantitySold
$a.donations.servingsSavedAllTime; $a.activeUsers.count
Attempt Get "/admin/analytics?days=15" $admin $null                        # EXPECT 400 (7, 30 or 90 only)
```
Place and deliver an order (Phase 2 guide, steps 3-4) and run the dashboard again: orders and revenue go up.

## 3. Users: search, block, unblock
```powershell
(Call Get "/admin/users?q=foodbridge&limit=20" $admin $null).data | Format-Table name, email, role, isBlocked
(Call Get "/admin/users?role=NGO" $admin $null).data | Format-Table name, email, @{n="NGO";e={$_.ngoProfile.orgName}}, @{n="verified";e={$_.ngoProfile.isVerified}}
# make a throwaway customer to block
$tmp = Call Post "/auth/register" $null @{ name = "Temp User"; email = "temp.user@foodbridge.demo"; password = "Demo@1234" }
$tmpId = $tmp.data.user.id; $tmpToken = $tmp.data.token
(Call Get "/auth/me" $tmpToken $null).data.email                          # works
Attempt Patch "/admin/users/$tmpId/block" $admin @{ blocked = $true }                         # EXPECT 400 (reason required)
(Call Patch "/admin/users/$tmpId/block" $admin @{ blocked = $true; reason = "Fraudulent orders" }).data | Format-List isBlocked, blockedReason
Attempt Get "/auth/me" $tmpToken $null                                    # EXPECT 403 (same token, blocked immediately)
Attempt Post "/auth/login" $null @{ email = "temp.user@foodbridge.demo"; password = "Demo@1234" }   # EXPECT 403
(Call Patch "/admin/users/$tmpId/block" $admin @{ blocked = $false }).data.isBlocked        # False
(Call Get "/auth/me" $tmpToken $null).data.email                          # works again
$adminId = (Call Get "/auth/me" $admin $null).data.id
Attempt Patch "/admin/users/$adminId/block" $admin @{ blocked = $true; reason = "test test" }   # EXPECT 400 (not yourself)
```
Live check: run `node scripts/watch-order.js <tmpToken>` in another window, block the user again, and watch the connection drop immediately.

## 4. Restaurant approval
```powershell
$new = (Call Post "/restaurants" $owner1 @{ name = "Chaat Corner Demo"; description = "Street-style chaat and sweets"; cuisines = @("Street Food"); imageUrl = "https://placehold.co/800x600/eab308/ffffff?text=Chaat"; address = "Clock Tower, Jodhpur"; city = "Jodhpur" }).data
$new.status                                                               # PENDING
Attempt Get "/restaurants/$($new.id)" $null $null                          # EXPECT 404 (hidden from the public)
(Call Get "/admin/restaurants?status=PENDING" $admin $null).data | Format-Table name, status, @{n="owner";e={$_.owner.email}}
Attempt Patch "/admin/restaurants/$($new.id)/status" $admin @{ status = "REJECTED" }          # EXPECT 400 (reason needed)
Attempt Patch "/admin/restaurants/$($new.id)/status" $admin @{ status = "SUSPENDED"; reason = "not yet" }   # EXPECT 409 (pending cannot be suspended)
(Call Patch "/admin/restaurants/$($new.id)/status" $admin @{ status = "APPROVED" }).data.status   # APPROVED
(Call Get "/restaurants/$($new.id)" $null $null).data.name                # now public
(Call Patch "/admin/restaurants/$($new.id)/status" $admin @{ status = "SUSPENDED"; reason = "Hygiene inspection failed" }).data | Format-List status, moderationNote
Attempt Get "/restaurants/$($new.id)" $null $null                          # EXPECT 404 again
(Call Get "/restaurants/$($new.id)" $owner1 $null).data.moderationNote    # the owner sees the reason
Attempt Patch "/admin/restaurants/$($new.id)/status" $owner1 @{ status = "APPROVED" }         # EXPECT 403 (owners cannot approve themselves)
```

## 5. Verifying an NGO
```powershell
Call Post "/auth/register" $null @{ name = "Hope NGO"; email = "hope.ngo@foodbridge.demo"; password = "Demo@1234"; role = "NGO"; ngo = @{ orgName = "Hope Foundation"; contactPhone = "9111111113"; serviceCity = "Jodhpur"; registrationNo = "NGO-RJ-2026-0001" } } | Out-Null
$hope = Login "hope.ngo@foodbridge.demo"
$cust2 = Call Post "/donations" $cust @{ foodName = "Veg pulao"; category = "Cooked meal"; quantity = "8 boxes"; servings = 8; foodType = "VEG"; preparedAt = (Iso -20); expiresAt = (Iso 180); pickupAddress = "12 Shastri Circle, Jodhpur"; city = "Jodhpur"; contactPhone = "9000000002"; safetyConfirmed = $true }
$donationId = $cust2.data.id
Attempt Post "/donations/$donationId/request" $hope @{}                    # EXPECT 403 (not verified yet)
$hopeNgo = ((Call Get "/admin/ngos?verified=false" $admin $null).data | Where-Object orgName -eq "Hope Foundation")
$hopeNgo | Format-List orgName, registrationNo, isVerified
(Call Patch "/admin/ngos/$($hopeNgo.id)/verification" $admin @{ verified = $true; note = "Documents checked" }).isVerified   # True
(Call Post "/donations/$donationId/request" $hope @{}).data.status        # NGO_REQUESTED: works straight away
```

## 6. Donation monitoring and flagging unsafe food
```powershell
(Call Get "/admin/donations?limit=20" $admin $null).data | Format-Table foodName, donorName, status, city, requestCount
(Call Get "/admin/donations/$donationId" $admin $null).data | Format-List status, contactPhone, @{n="requests";e={$_.requests.Count}}
(Call Get "/admin/donation-requests?status=PENDING" $admin $null).data | Format-Table @{n="ngo";e={$_.ngo.orgName}}, @{n="food";e={$_.donation.foodName}}, status
Attempt Post "/admin/donations/$donationId/flag" $admin @{}                # EXPECT 400 (reason needed)
(Call Post "/admin/donations/$donationId/flag" $admin @{ reason = "Reported as spoiled" }).data | Format-List status, flagReason
Attempt Get "/donations/$donationId" $null $null                           # EXPECT 404 (out of circulation)
Attempt Patch "/donations/$donationId/status" $cust @{ status = "ACCEPTED" }   # EXPECT 409 (frozen)
(Call Post "/admin/donations/$donationId/unflag" $admin @{ reason = "Inspected: fine" }).data.status   # POSTED (the NGO claim is released)
(Call Get "/admin/donations?status=FLAGGED" $admin $null).data.Count
```

## 7. Complaints
```powershell
$orders = (Call Get "/orders?limit=5" $cust $null).data
$c1 = (Call Post "/complaints" $cust @{ category = "FOOD_QUALITY"; subject = "Food arrived cold"; details = "The curry was cold and the box was leaking."; orderId = $orders[0].id }).data
$c1.status                                                                 # OPEN
Attempt Post "/complaints" $cust @{ category = "ORDER"; subject = "Not my order"; details = "I never placed this one at all."; orderId = "nope" }   # EXPECT 404
(Call Get "/complaints" $cust $null).data | Format-Table subject, status
Attempt Get "/complaints/$($c1.id)" $owner2 $null                           # EXPECT 404 (not yours)
(Call Get "/admin/complaints?status=OPEN" $admin $null).data | Format-Table subject, category, @{n="by";e={$_.user.email}}, @{n="order";e={$_.order.orderNumber}}
(Call Get "/admin/dashboard" $admin $null).data.complaints.pending
Attempt Patch "/admin/complaints/$($c1.id)" $admin @{ status = "RESOLVED" }  # EXPECT 400 (resolution needed)
(Call Patch "/admin/complaints/$($c1.id)" $admin @{ status = "IN_REVIEW" }).data.status
(Call Patch "/admin/complaints/$($c1.id)" $admin @{ status = "RESOLVED"; resolution = "Refund of 100 rupees issued." }).data | Format-List status, resolution, resolvedAt
Attempt Patch "/admin/complaints/$($c1.id)" $admin @{ status = "REJECTED"; resolution = "changed my mind" }   # EXPECT 409 (frozen)
(Call Get "/complaints/$($c1.id)" $cust $null).data.resolution              # the customer reads the answer
```

## 8. Accounts: profile, forgot/reset/change password, sessions, addresses
```powershell
(Call Put "/auth/me" $tmpToken @{ name = "Temp Renamed"; phone = "9876500000" }).data | Format-List name, phone
Attempt Put "/auth/me" $tmpToken @{ phone = "123" }                           # EXPECT 400

# forgot password (needs DEMO_RETURN_RESET_TOKEN=true, otherwise copy the link from the server console)
$r = Call Post "/auth/forgot-password" $null @{ email = "temp.user@foodbridge.demo" }
$r.message                                                                   # the same text for unknown emails
(Call Post "/auth/forgot-password" $null @{ email = "nobody@foodbridge.demo" }).message
$token = $r.demoResetToken
Attempt Post "/auth/reset-password" $null @{ token = $token; password = "short" }               # EXPECT 400
(Call Post "/auth/reset-password" $null @{ token = $token; password = "Brand-new1" }).message
Attempt Post "/auth/reset-password" $null @{ token = $token; password = "Another-pass2" }       # EXPECT 400 (single use)
Attempt Get "/auth/me" $tmpToken $null                                        # EXPECT 401 (old session ended)
$t2 = Login "temp.user@foodbridge.demo" "Brand-new1"

# change password returns a fresh token
$ch = Call Post "/auth/change-password" $t2 @{ currentPassword = "Brand-new1"; newPassword = "Even-newer2" }
Attempt Get "/auth/me" $t2 $null                                              # EXPECT 401
(Call Get "/auth/me" $ch.data.token $null).data.email                        # works

# log out everywhere
$other = Login "temp.user@foodbridge.demo" "Even-newer2"
Call Post "/auth/logout-all" $ch.data.token $null | Out-Null
Attempt Get "/auth/me" $other $null                                           # EXPECT 401

# addresses
$t3 = Login "temp.user@foodbridge.demo" "Even-newer2"
$ad = (Call Post "/addresses" $t3 @{ line1 = "12 Test Street"; city = "Jodhpur"; state = "Rajasthan"; pincode = "342001" }).data
(Call Put "/addresses/$($ad.id)" $t3 @{ line2 = "Near the temple"; isDefault = $true }).data | Format-List line2, isDefault
Attempt Delete "/addresses/$($ad.id)" $cust $null                              # EXPECT 404 (someone else's)
(Call Delete "/addresses/$($ad.id)" $t3 $null).message
```

## 9. Audit trail
```powershell
(Call Get "/admin/audit-logs?limit=15" $admin $null).data | Format-Table createdAt, action, entityType, @{n="admin";e={$_.admin.name}}
(Call Get "/admin/audit-logs?entityType=RESTAURANT" $admin $null).data.Count
```

## 10. Live effects
With `node scripts/watch-order.js <token>` windows open: owner1 sees `restaurant:status` when you approve their restaurant; the customer sees
`complaint:status` when you change a complaint; the `hope.ngo` account starts receiving `donation:posted` the moment you verify it, without reconnecting.
