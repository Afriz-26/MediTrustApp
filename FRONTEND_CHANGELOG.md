# Frontend finishing pass (Oct 2026)

## Real data only
- Removed invented medicine price ranges (MRP) from medicine search and medicine checker
- Booking no longer invents appointment times: a doctor with no published schedule shows "has not published appointment times yet"
- Removed "demonstration prototype" and "Demo Mode" wording
- Mock seed emails now match the dev login (patient/doctor/pharmacy @meditrust.local), so dev dashboards show sample data

## Subscriptions and prices
- src/config/pricing.js is the single place for prices. Doctor plans 999 / 5,999 / 8,999 per month; boosters 299 / 999 / 1,999 (7/14/30 days); records premium 91 per month or 999 per year. Pharmacy plans 799 / 1,999 / 4,499 are PLACEHOLDERS to confirm
- Choosing a plan now creates a PENDING request (no more instant free activation). Yearly now stores the correct yearly amount
- Admin: Finance > Subscriptions has "payment ref + Activate". Activation sets dates, updates the provider profile, and notifies the provider
- src/lib/payments.js: Razorpay entry point. Inert until features.onlinePayments is true and the server functions createPaymentOrder / verifyPayment exist. Success is shown only after the server verifies
- features.providerPlans is now true (providers need it to get listed); adBoosters, onlinePayments, premiumHealth stay false

## Layout and states
- Patient quick actions now a 2x2 grid (no overflow); pharmacy third stat card spans full width
- Plan tiles say "My plan" while Ad Boosters is off
- Task 9 leftovers: swallowed errors are now logged; lint has 0 errors

## Verified in dev mock (headless browser)
- 17 screens load with no errors; full flow patient books -> doctor accepts -> token MT-001 -> patient sees Confirmed + token
- Doctor requests plan -> admin activates -> profile updated
- Production build contains no mock data; main bundle about 1.4 MB

## Still to do
- Real backend (replace src/api/stubClient.js), real login, server-side payments
- Redesign (Phase 3), admin leads pipeline screen, voice test on a phone
