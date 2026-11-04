# Phase 3 manual testing guide (Windows PowerShell)

Prerequisites: backend running, Phase 3 migration applied. Seeded password = your `SEED_DEMO_PASSWORD` (examples use `Demo@1234`).
The seeded demo donations expire a few hours after seeding, so this guide creates fresh ones.

## 0. Helpers (paste once per window)
```powershell
$api = "http://localhost:5000/api"; $pw = "Demo@1234"
function Call($method, $path, $token, $body) {
  $p = @{ Method = $method; Uri = "$api$path"; ContentType = "application/json" }
  if ($token) { $p.Headers = @{ Authorization = "Bearer $token" } }
  if ($body)  { $p.Body = ($body | ConvertTo-Json -Depth 8) }
  Invoke-RestMethod @p
}
function Attempt($method, $path, $token, $body) {   # prints status + error instead of throwing
  try { Call $method $path $token $body } catch { "HTTP $($_.Exception.Response.StatusCode.value__): $($_.ErrorDetails.Message)" }
}
function Login($email) { (Call Post "/auth/login" $null @{ email = $email; password = $pw }).data.token }
$cust = Login "customer@foodbridge.demo"; $owner1 = Login "owner1@foodbridge.demo"
$ngo = Login "ngo@foodbridge.demo"; $admin = Login "admin@foodbridge.demo"
function Iso($minutes) { (Get-Date).AddMinutes($minutes).ToUniversalTime().ToString("o") }
function NewDonation($extra) {
  $b = @{ foodName = "Veg biryani (surplus)"; category = "Cooked meal"; quantity = "12 boxes"; servings = 12; foodType = "VEG";
          preparedAt = (Iso -30); expiresAt = (Iso 180); pickupAddress = "12 Shastri Circle, Jodhpur"; city = "Jodhpur";
          contactPhone = "9000000002"; safetyConfirmed = $true }
  if ($extra) { $extra.GetEnumerator() | ForEach-Object { $b[$_.Key] = $_.Value } }
  $b
}
```

## 1. Post a donation and see the food-safety checks
```powershell
$d = (Call Post "/donations" $cust (NewDonation @{})).data
$d.status; $d.donorType                                              # POSTED, INDIVIDUAL
Attempt Post "/donations" $cust (NewDonation @{ safetyConfirmed = $false })     # EXPECT 400 (must confirm food is safe)
Attempt Post "/donations" $cust (NewDonation @{ expiresAt = (Iso -10) })        # EXPECT 400 (already expired)
Attempt Post "/donations" $cust (NewDonation @{ expiresAt = (Iso 10) })         # EXPECT 400 (needs 30+ minutes)
Attempt Post "/donations" $cust (NewDonation @{ expiresAt = (Iso 900) })        # EXPECT 400 (cooked food: max 12 hours)
Attempt Post "/donations" $ngo (NewDonation @{})                                # EXPECT 403 (NGOs do not donate)
# restaurant donation (owner1 owns Rajputana Rasoi)
$rr = (Call Get "/restaurants?q=Rajputana" $null $null).data[0]
$rd = (Call Post "/donations" $owner1 (NewDonation @{ restaurantId = $rr.id; foodName = "Dal baati (surplus)"; servings = 30 })).data
$rd.donorType; $rd.donorName                                         # RESTAURANT, Rajputana Rasoi
Attempt Post "/donations" $owner1 (NewDonation @{})                              # EXPECT 400 (owner must name a restaurant)
```

## 2. Privacy: what each person can see
```powershell
(Call Get "/donations?limit=50" $null $null).data | Format-Table foodName, donorName, city, status
# EXPECT no pickupAddress/contactPhone columns, and "Individual donor" for the customer's donation
(Call Get "/donations/$($d.id)" $null $null).data | ConvertTo-Json | Select-String "Shastri|9000000002"   # EXPECT nothing
(Call Get "/donations/$($d.id)" $ngo $null).data.pickupAddress        # the verified NGO sees the address
(Call Get "/donations/$($d.id)" $ngo $null).data.contactPhone         # EXPECT empty (no phone before acceptance)
(Call Get "/donations?mine=true" $cust $null).data.Count              # the donor's own donations
Attempt Get "/donations?limit=51" $null $null                         # EXPECT 400
```

## 3. NGO claims, donor accepts, collection, distribution
```powershell
Attempt Post "/donations/$($d.id)/request" $cust @{}                   # EXPECT 403 (not an NGO)
(Call Post "/donations/$($d.id)/request" $ngo @{ message = "We can collect within an hour" }).data.status   # NGO_REQUESTED
Attempt Get "/donations/$($d.id)" $null $null                          # EXPECT 404 (no longer open to the public)
(Call Get "/donations/$($d.id)" $cust $null).data | Select-Object status, @{n="ngo";e={$_.claimedBy.orgName}}   # donor sees who asked
Attempt Patch "/donations/$($d.id)/status" $ngo @{ status = "ACCEPTED" }       # EXPECT 403 (only the donor can accept)
(Call Patch "/donations/$($d.id)/status" $cust @{ status = "ACCEPTED" }).data.status     # ACCEPTED
(Call Get "/donations/$($d.id)" $ngo $null).data.contactPhone          # NOW the NGO sees 9000000002
Attempt Patch "/donations/$($d.id)/status" $ngo @{ status = "PICKUP_SCHEDULED" }                       # EXPECT 400 (pickupAt needed)
Attempt Patch "/donations/$($d.id)/status" $ngo @{ status = "PICKUP_SCHEDULED"; pickupAt = (Iso 240) }  # EXPECT 400 (after expiry)
(Call Patch "/donations/$($d.id)/status" $ngo @{ status = "PICKUP_SCHEDULED"; pickupAt = (Iso 45) }).data.pickupScheduledAt
Attempt Patch "/donations/$($d.id)/status" $ngo @{ status = "DISTRIBUTED" }    # EXPECT 409 (must be collected first)
(Call Patch "/donations/$($d.id)/status" $ngo @{ status = "COLLECTED" }).data.status
Attempt Patch "/donations/$($d.id)/status" $cust @{ status = "CANCELLED" }     # EXPECT 409 (already collected)
(Call Patch "/donations/$($d.id)/status" $ngo @{ status = "DISTRIBUTED" }).data.status
(Call Get "/donations/$($d.id)" $cust $null).data.statusHistory | Format-Table status, by, at
(Call Get "/ngo/summary" $ngo $null).data | Format-List servingsCollected, donationsByStatus
```

## 4. Reject, withdraw, cancel
```powershell
$d2 = (Call Post "/donations" $cust (NewDonation @{})).data
Call Post "/donations/$($d2.id)/request" $ngo @{} | Out-Null
(Call Patch "/donations/$($d2.id)/status" $cust @{ status = "POSTED" }).data.status    # donor rejects: back to POSTED
Attempt Post "/donations/$($d2.id)/request" $ngo @{}                   # EXPECT 409 (that NGO was declined)
$d3 = (Call Post "/donations" $cust (NewDonation @{})).data
Call Post "/donations/$($d3.id)/request" $ngo @{} | Out-Null
Call Patch "/donations/$($d3.id)/status" $cust @{ status = "ACCEPTED" } | Out-Null
(Call Patch "/donations/$($d3.id)/status" $ngo @{ status = "POSTED"; reason = "Vehicle broke down" }).data.status   # NGO withdraws
(Call Patch "/donations/$($d3.id)/status" $cust @{ status = "CANCELLED"; reason = "Plans changed" }).data.status    # donor cancels
```

## 5. Two NGOs racing for one donation
You need a second verified NGO. Verification is an admin feature that arrives in Phase 4, so for this test only, verify it directly in the database:
```powershell
$ngo2Body = @{ name = "Second NGO"; email = "ngo2@foodbridge.demo"; password = "Demo@1234"; role = "NGO";
               ngo = @{ orgName = "Second Seva Trust"; contactPhone = "9111111112"; serviceCity = "Jodhpur" } }
Attempt Post "/auth/register" $null $ngo2Body
psql -U postgres -d foodbridge -c "UPDATE ""NGOProfile"" SET ""isVerified"" = true WHERE ""orgName"" = 'Second Seva Trust';"
$ngo2 = Login "ngo2@foodbridge.demo"
$d4 = (Call Post "/donations" $cust (NewDonation @{})).data
$jobs = @($ngo, $ngo2) | ForEach-Object { Start-Job -ArgumentList $api, $_, $d4.id -ScriptBlock {
  param($api, $token, $id)
  try { Invoke-RestMethod -Method Post "$api/donations/$id/request" -Headers @{ Authorization = "Bearer $token" } -ContentType "application/json" -Body "{}" | Out-Null; "201" }
  catch { [string]$_.Exception.Response.StatusCode.value__ } } }
$jobs | Wait-Job | Receive-Job                                        # EXPECT exactly one 201 and one 409
```

## 6. Expiry
Post a donation with the shortest allowed window, then wait about 31 minutes, or shorten it in the database:
```powershell
$d5 = (Call Post "/donations" $cust (NewDonation @{})).data
psql -U postgres -d foodbridge -c "UPDATE ""Donation"" SET ""expiresAt"" = now() - interval '1 minute' WHERE id = '$($d5.id)';"
Attempt Get "/donations/$($d5.id)" $null $null                          # EXPECT 404 (hidden from the public immediately)
Attempt Post "/donations/$($d5.id)/request" $ngo @{}                    # EXPECT 409 (expired)
Start-Sleep 65                                                          # the sweep runs every minute
(Call Get "/donations/$($d5.id)" $cust $null).data.status               # EXPECT EXPIRED
```

## 7. NGO profile
```powershell
(Call Get "/ngo/profile" $ngo $null).data | Format-List orgName, serviceCity, isVerified
(Call Put "/ngo/profile" $ngo @{ serviceArea = "Old City and Sardarpura"; isVerified = $false; registrationNo = "X" }).data | Format-List serviceArea, isVerified, registrationNo
# isVerified and registrationNo are ignored by design
Attempt Get "/ngo/profile" $cust $null                                  # EXPECT 403
```

## 8. Food assistance
```powershell
$body = @{ name = "Ramesh Kumar"; phone = "9123450001"; people = 6; requirements = @("Cooked meal","Drinking water"); location = "Near Clock Tower"; city = "Jodhpur"; notes = "Family of six" }
$a = (Call Post "/assistance" $null $body).data                          # no login needed
$a.id; $a.status                                                         # keep the id: it is the tracking link
(Call Get "/assistance/$($a.id)" $null $null).data | ConvertTo-Json      # anonymous tracking: status only, no name/phone/location
$bad = $body.Clone(); $bad.people = 0
Attempt Post "/assistance" $null $bad                                    # EXPECT 400
(Call Get "/assistance" $ngo $null).data | Format-Table people, requirements, city   # NGO sees needs, not names or phones
(Call Patch "/assistance/$($a.id)/status" $ngo @{ status = "ASSIGNED" }).data | Format-List status, name, phone     # now the NGO sees contact details
(Call Get "/assistance?mine=true" $ngo $null).data.Count                 # the NGO's assigned requests
(Call Patch "/assistance/$($a.id)/status" $ngo @{ status = "FULFILLED" }).data.status
(Call Get "/assistance/$($a.id)" $null $null).data.statusHistory | Format-Table status, at   # public tracking shows progress
```

## 9. Live updates
Open two more PowerShell windows in the `backend` folder and run `node scripts/watch-order.js <token>` (it prints every event your account may receive,
including the new `donation:*` and `assistance:*` events). Use the NGO token in one window and the customer token in the other, then repeat steps 1 and 3
and watch the events arrive. A customer who is neither donor nor requester receives nothing.
