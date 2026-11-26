# MediTrust handoff v3 — changes since v2 (Nov 3, 2026)
Give HANDOFF_v2.md first, then this file. This file overrides v2 where they differ.

## Decision (Nov 3)
v1 is cut to: doctor booking + token queue + prescriptions + admin. Exams are on; work in short sessions (about 30 min, one task, only on days without an exam next morning). No new features until a free pilot with a few clinics has happened. The "5-6 first-year contacts" may not remember him and there is no names list, so demand is NOT validated yet: first real test = visit 3 clinics, show the 3 core screens, ask for a 2-week free trial.

## Task 1 — DONE in code, NOT yet run (no build/test possible from chat)
New flags in src/config/features.js, all false: aiAssistant, symptomChecker, medicineChecker, pharmacy, healthTracker.
- App.jsx routeFeatureFlags: ChatAssistant, SymptomChecker, VerifyMedicine, HealthTracker, OrderMedicines, Pharmacies, PatientReservations now redirect to the dashboard when their flag is off.
- PatientDashboard.jsx: AI/symptom/medicine/pharmacy/tracker cards and "My medicine orders" hidden by flag.
- BottomNav.jsx (patient): Home, Doctors, Visits, Prescriptions (Medicines/Assistant only when flags on).
- Welcome.jsx: pharmacy role hidden, "Pharmacy accounts: coming soon" shown.
- PatientPrescriptions.jsx: pharmacy badge, "Order medicines" button and "Find pharmacies" empty-state action hidden when pharmacy flag is off.
- NOT flagged on purpose: PharmacyDashboard/Inventory/Orders (flagging them would redirect-loop because PharmacyDashboard is the pharmacy home page). Existing test pharmacy account still works.
- To test (5 min): run `npm run dev`, hard refresh, check Welcome (2 roles), patient dashboard (Find doctors + demo video only), bottom nav (4 items), type /ChatAssistant in the URL (should bounce to dashboard). Report any console errors.

## Walk-in check result: DOES NOT EXIST
DoctorAppointments.jsx only lists patient-made bookings (pending -> accept -> token -> complete). There is no "Add walk-in patient", no "Call next / now serving", and patients cannot see a live queue position. The token-queue differentiator is therefore NOT built yet. Also: the "Download prescription" button in PatientPrescriptions.jsx has no handler (dead button).

## Redesign step 1 (Nov 4) — REVERTED at founder's request
Founder did not like the new patient home, so PatientDashboard.jsx was restored to its pre-redesign (task 1) version. The look is on hold: he will decide the design direction later (he does not know other apps beyond Practo / Tata 1mg style). Do NOT redesign again until he describes what he wants.
- Kept: FindDoctors.jsx reads ?q= from the URL (currently unused) and the search bug fix where "dental/dentist" matched ENT.
- Note: the old dashboard still shows the AI-disclaimer notice even though AI is off (wrong text); fix when design is decided.

## AI chat fixed and back ON (Nov 5)
Cause of failure: Google retired gemini-2.5-flash(-lite) names; the old function then only reached an overloaded alias and timed out; the app also turned plain timeouts into a misleading "no available model" message.
- Edge function `ai` is now v5: tries gemini-3.5-flash-lite first (answers in about 1.5-3 s when Google is quiet, up to ~20 s when busy), and if Google says "model not found" it lists the models the key can use and tries those. 40 requests/user/day (failed attempts count). Logs: `gemini_ok <model> <ms>`, `gemini_model_not_found`, `gemini_rate_limited`, `models_available`.
- supabaseClient.js now shows the function's own message instead of the old dev-style one.
- features.js: aiAssistant is true (founder switched it on). Chat messages save correctly (verified in chat_messages).
- Known limits: free-tier Gemini can be busy/rate-limited; a paid key is the real fix once the pilot starts. AI cannot see which doctors are on MediTrust, so it may over-promise availability.
- Security advisors (Nov 5): 7 *_public / v_* views are SECURITY DEFINER by design (caller-scoped) but must be proven with the two-account RLS test before real users; leaked-password protection is off (turn on before launch).

## Pharmacy back ON for testing (Nov 5)
Exams: 9 Nov - 21 Nov 2026 (no work in that window). Free days before: 5-8 Nov.
- features.js: pharmacy: true.
- Found: reserve_medicines never checked prescriptions (5 of 10 medicines are rx_only). Fixed by migration `reserve_medicines_require_prescription_for_rx`: rx_only items need a prescription that belongs to the patient and is under 30 days old. supabaseClient.js MedicinePreOrder.create now sends the patient's latest prescription id automatically (matching on medicine names is NOT done).
- Never tested end to end: 0 reservations exist. Only 10 medicines (no info fields), 1 test pharmacy (approved, 10 items in stock).
- Legal (not a lawyer): we only take pickup reservations, no sale, no delivery, no online payment. Still needed: legal pages, admin checking pharmacy licence, consent, no medicine advice from the AI; get a lawyer/pharmacist opinion on India's e-pharmacy rules before public launch.
- Test script: patient (+patient alias) reserves a NON-Rx medicine -> pharmacy account (+pharmacy alias) accepts -> preparing -> ready -> patient sees ready -> completed. Then try an Rx medicine WITHOUT a prescription (must be refused), then after a doctor writes a prescription (must work).

## Review of Nov 6 (founder improved Find Doctors/Pharmacies, request + directions)
- DB state: 1 appointment (pending, never confirmed by the doctor), 0 prescriptions, 0 reservations, 2 provider-request leads (the request form works). Pharmacy flow and booking-to-prescription flow STILL untested.
- Fixed: Pharmacies.jsx hid every pharmacy farther than 12 km or without coordinates (test pharmacy is ~198 km from Kanigiri, so it was invisible; real pharmacies without coordinates would never show). Now all verified pharmacies show, sorted by distance, with "Distance unknown" if no coordinates. Empty-state text on both pages no longer mentions external listings.
- Added: inventory rows carry rx_only (adapter reads it from medicines); OrderMedicines shows a "Prescription needed" badge and an explanation.
- Flag: supabaseClient.js invokeAi retries once on HTTP 503, but the ai function already tries several models and returns 503 when all fail, so a retry doubles quota use (40/day) and waiting time. Consider retrying only on network errors. The old no_model dev-style message is back in the adapter (harmless; the function now only returns no_model when the key has no usable model).
- Provider location = profile location (town-level from LocationSearch), not a clinic pin, so Directions may point to the town centre. Needs a "use my clinic's location" step.

## Review of Nov 10 (today per system clock; exams 9-21 Nov are running)
- Pharmacies visible in VS Code browser but not in Chrome: both fetch pharmacies_public with HTTP 200 (logs), so data arrives; the difference is Chrome-side state. Most likely cause: old service worker serving cached (stale) scripts cache-first, even in dev. Fix: public/sw.js rewritten as v2 (cache name meditrust-v2 deletes the old cache; scripts/styles are network-first; images/fonts cache-first). Chrome needs one normal reload, or DevTools > Application > Service workers > Unregister + Clear site data, or test in an Incognito window.
- Founder reports: wrote a prescription as a "sample doctor", patient saw a notification, downloaded it, saw it in health records. DB shows 0 prescriptions, 1 notification (Nov 3 appointment), appointment still pending, no write requests in today's API logs. So that test did NOT hit the real Supabase backend (suspect a second dev server in mock mode or local-only storage). Ask which URL/port and what the console prints for "MediTrust backend:". The real flow is still unproven.
- Gemini healthy: gemini-3.5-flash-lite answered in 6.2 s; 1 request used today.

## Pharmacy map empty in some places (Nov 10)
- features.js now has externalListings: true (founder re-enabled live OpenStreetMap listings). Those results come from free public services (Photon, Nominatim, now Overpass), not from the MediTrust database.
- Root cause of "works in some places, not others": Photon/Nominatim search matches by NAME words ("pharmacy", "medical store"), so shops called e.g. "Sri Sai Medicals" were missed; OSM coverage in small Indian towns is also thin; 4-5 s timeouts on busy public servers.
- Fixed: osm.js fetchOverpassPharmacies (tag search amenity=pharmacy / shop=chemist / healthcare=pharmacy, two mirrors, 8 s timeout) added to searchPharmacyRadius; cache key bumped to pharmacy_sources_v5. Pharmacies.jsx clears the search box on location change.
- NOT fixable in code: places where OpenStreetMap simply has no pharmacy mapped. Those show the "request a provider" card. Doctors search has the same name-matching weakness (not changed).
- Launch risk: public Nominatim/Photon/Overpass servers have usage policies and rate limits; heavy real-user traffic can be blocked. For launch rely on MediTrust-verified providers + request form, treat map listings as a bonus, or move to a paid/self-hosted source later.

## Map search v2 (Nov 10, later)
- src/lib/osm.js rewritten: Photon + Nominatim (pharmacy only) + Overpass tag search for BOTH pharmacies and doctors/hospitals/clinics; 8 s timeouts (Overpass 12 s, two mirrors), each source retried once; widening 12 km -> 20 km (if <5 pharmacies / <3 doctors) -> 40 km (Overpass only, if still 0); cache key osm_v6_*; if nothing is found AND Overpass never answered, it now throws a retry error instead of a false "no pharmacies"; every source logs to the console as "[MediTrust map] ..." (ok count or FAILED reason).
- ProviderMap.jsx: "found within X km" now uses the real farthest distance; clearer empty message.
- Chrome vs VS Code difference is probably Chrome extensions/ad-blockers blocking photon/overpass/nominatim; check the console lines and test in Incognito.
- Permanent fix for OSM gaps (not built): a MediTrust-owned directory table of unverified local providers (name, phone, address, lat/lng) entered by the founder/interns/admin and by approved requests, shown in the list as "Listed, not on MediTrust yet" with Call + Directions. Also: add missing pharmacies to openstreetmap.org (free); paid option Google Places via an Edge Function (check current pricing).

## Directory feature (Nov 17) — built, NOT yet run
Problem: OpenStreetMap has little/no pharmacy or clinic data in small towns (works in big cities). Fix: MediTrust-owned directory.
- DB: table directory_listings (kind doctor|pharmacy, name, phone, address, city, state, lat, lng, speciality, notes, is_active). RLS on: signed-in users read active rows; only admin (my_role()='admin') can insert/update/delete; anon has no access. Verified in pg_policies. 0 rows yet.
- supabaseClient.js: new DirectoryListing entity (registered).
- components/provider/DirectoryListings.jsx: "Local pharmacies/clinics near you" card (Call + Directions, badge "Not on MediTrust yet"), hidden when empty; rendered by ProviderMap.jsx above the map/request card on BOTH Find Doctors and Pharmacies (shows listings within 60 km, nearest first).
- components/admin/DirectoryManager.jsx + new "Directory" tab in AdminDashboard.jsx: add (type, name, phone, address, town, state, speciality, pin "lat, lng" from Google Maps right-click, or town search for a rough centre), hide/show, delete.
- osm.js was already refined by someone else (v7 cache, forceRefresh, separate pharmacy path); left untouched.
- To test: sign in as admin (skafriz26@gmail.com), Admin > Directory, add one REAL small-town pharmacy with a pin; then as patient (location set near it) open Pharmacies and Find Doctors.

## Launch blockers noticed (Nov 17)
- Auth session is stored in window.sessionStorage (supabaseClient.js): each tab has its own login and closing the tab signs the user out. Fine for testing different roles side by side, but patients on a phone PWA would have to sign in every visit. Switch to localStorage before real users (and keep role-testing in separate browsers/Incognito).
- Prescription/booking flow still unproven on the real backend (0 prescriptions in DB at last check).
- ai retry on 503 can double quota use.

## Pilot mechanics + prescription (Nov 17, later) — built, NOT yet exercised
- Founder confirmed the directory works (added a real pharmacy from his city). Pilot plan: Tirupati; meet doctors in person, send the PWA link, they sign up; first 10 providers get 28 days free; pharmacies uncertain; wants better admin/doctor/patient/pharmacy dashboards, a professional prescription + PDF, and online consultations.
- DB migration `pilot_free_trial_and_stacking_plans`: triggers grant_trial_doctor / grant_trial_pharmacy give a 28-day subscription (plan 'trial', payment_ref FREE-PILOT-TRIAL) when the admin changes a doctor/pharmacy to verification='approved', only if that user has no subscription yet and fewer than 10 trials exist (global count, doctors + pharmacies). Trial starts at APPROVAL, not sign-up (so fake accounts cannot burn the 10 slots, and the 28 days do not tick while waiting for verification). activate_subscription now starts a paid plan when the current plan ends (no lost trial days).
- DB migration `plan_expiry_reminders_cron`: pg_cron job notify-expiring-plans daily 03:30 UTC (9:00 IST): notification 'Plan ending soon' (3 days before) and 'Plan ended'. Paid renewal is still MANUAL (provider requests plan, pays by UPI, admin activates with the payment reference) until Razorpay.
- Existing TEST plans (test doctor/pharmacy) end 2026-11-29: after that they disappear from patient lists; re-activate them before demos.
- Prescription: v_prescriptions view now also returns doctor_qualification, doctor_clinic, doctor_clinic_address, doctor_city (adapter maps them). src/lib/prescriptionDownload.js rewritten: opens a professional A4 letterhead page (doctor + patient boxes, diagnosis, Rx table, notes, stamp with Rx number/verification code, signature block, footer) and opens the print dialog -> Save as PDF. No new library. NOT a legally certified digital signature: it prints the doctor's name and registration number only. Real signature image upload (Supabase Storage) and a public verify-by-code page are later options.
- Online consultations: NOT for the pilot (video/audio flags stay off; DB has video_enabled/fee_video columns already). Telemedicine in India has its own rules (RMP registration, consent, records); get advice before enabling.
- Dashboards/admin redesign: waiting for the founder's design direction (he disliked the first patient-home redesign). Ask for 2-3 screenshots he likes.

## Pilot operations plan + findings (Nov 17, evening)
Founder's scenario: onboard doctors in person; they sign up from a link (Netlify free domain or custom); founder sees them in Admin with all details, gets an alert sound, approves -> trial starts (already built, see above); first 10 free, 11th pays (subscription; ad boosters optional) - proof of first 10 shown to 11th; Razorpay keys pending (KYC) so build everything else first; small towns added via Admin > Directory; demo accounts must be hideable/retrievable; pharmacies cannot type hundreds of medicines.
Findings:
- Admin > Providers approval card shows only name, email, clinic/owner, city, specialization. It does NOT show phone, fee, registration number, address or map pin -> approving blind. No alert/sound anywhere in admin. Overview 'Pending Requests' counts provider requests only, not pending signups.
- BUG: PharmacyInventory 'Add medicine' uses src/lib/medicineCatalog.js (24 hardcoded string ids like 'paracetamol500') but pharmacy_inventory.medicine_id and medicines.id are uuid, and the DB medicines table holds only 10 rows -> adding a catalog medicine fails. The test pharmacy only works because it was stocked by SQL.
- Verification enum is pending/approved/rejected only; trial trigger counts doctors + pharmacies together (cap 10 total) - confirm whether pharmacies should have their own slots.
Planned build order after exams (21 Nov): S1 deploy (Netlify, env vars, Supabase Site URL/redirects) + sessionStorage->localStorage + phone PWA install test; S2 admin: full provider details on approval, new-signup/new-request badge + sound (+ optional Telegram bot alert), pilot stats per provider (bookings counts as proof), demo-data hide/show switch (flag + app setting; views exclude demo providers); S3 pharmacy: seed 300-500 common medicines into DB (pharmacist review, conservative rx flags), quick stock setup by category with untick, 'confirm availability' request flow with free-text medicines, medicine search -> pharmacies; S4 legal pages, consent box, password reset, SMTP/email; S5 two-account security test + real-backend end-to-end test; S6 Razorpay in test mode (Edge Functions create-order + webhook that verifies signature and activates the plan; keys: key id in env, secret in Supabase secrets; one-time payments for 1/3 months, not autopay); S7 pilot with 3 doctors, then up to 10.
Online consults and ad boosters stay off for the pilot.

## Nov 17 night: pricing + admin upgrade (built, NOT yet run)
- Pricing decided by founder: Basic 999 / Pro 5,999 / Elite 8,999 per month for BOTH doctors and pharmacies (pricing.js; plan ids basic/moderate/pro shown as Basic/Pro/Elite; tier map basic/pro/elite). New AVAILABLE_PLANS in pricing.js: only Basic is purchasable; Pro and Elite show 'Coming soon' (they promised features that do not exist: video consults, account manager, delivery priority, unlimited bookings). SubscriptionPlans.jsx rewritten with truthful benefits. Booster prices unchanged (feature off). Advice given: validate 999 with the first doctors at day 14; Pro/Elite only when features exist; ask a CA about GST; check NMC rules on doctor advertising before selling boosters to doctors; boosters stay off in the pilot.
- Admin > Providers (ProviderManagement.jsx rewritten): Pending/Approved/Rejected/All filters with counts (default Pending); each card shows speciality, qualification, registration/licence no., experience, clinic, fee, address, phone (tap to call), email, map pin link, plan status, signed-up age, and a 'Missing: ...' warning (registration no., fee, phone, pin); approve/reject ask for confirmation. Adapter now returns doctor phone for admin (doctors select profiles(email, phone)).
- Admin alerts (components/admin/AdminAlerts.jsx, rendered under the tab bar in AdminDashboard.jsx): polls every 20 s for new pending doctors, pharmacies, provider requests and new patients; chime (Web Audio, needs one click on the page / 'Turn sound on' button), highlighted lines, count in browser tab title. Only works while the admin page is open; a Telegram bot alert is the idea for when it is closed.
- STILL TO DO (next sessions): fix pharmacy Add-medicine bug + DB medicine catalog + quick stock setup + request flow; demo-data hide/show switch; deploy (Netlify) + localStorage session; legal pages; password reset/SMTP; 2-account security test; real-backend end-to-end test; Razorpay (test mode); provider notification sound + 'This week' card; pilot stats for the admin.
- Test plan: second doctor test account (e.g. skafriz26+doctor2@gmail.com) via Incognito -> admin chimes -> review details -> approve -> trial notification. This uses 1 of 10 trial slots; delete that subscriptions row (plan='trial') afterwards if it was only a test.

## Nov 18: prescription page, notifications, profile guard (built, NOT yet run)
- WritePrescription.jsx rewritten: doctor identity header, numbered cards (patient, diagnosis, medicines with quick-pick chips for frequency/duration/instructions and medicine-name suggestions, notes), Preview (opens the real A4 layout with a PREVIEW watermark; prescriptionDownload.js now takes {preview:true}), confirm before issuing, empty medicine rows are no longer saved, success screen with 'Save a PDF copy', warning if the doctor has no registration number. Old text claiming a 'digital signature' removed (it is not one).
- DB migration personal_notifications_and_profile_change_guard: notifications now carry names ('Dr. Rao, you have a new appointment request from Priya for 05 Nov at 05:00 PM. Open Appointments to confirm.'; patient: 'Hi Priya, Dr. Rao confirmed your visit on ... Your token is MT-003. Please arrive 10 minutes early.'; declined, cancelled, prescription ready, pickup request/accepted/ready/rejected, trial started, 'You are verified. Choose a plan' when the 10 free slots are used). book_appointment, update_appointment_status, reserve_medicines (keeps the Rx rule), update_reservation_status, on_prescription_created, grant_free_trial_on_approval re-created.
- Profile edits: protect_doctor/protect_pharmacy now send an APPROVED provider back to 'pending' if they change credentials (doctor: display_name, registration_number, qualification, specialization; pharmacy: name, owner_name, license_number); notify_doctor_changes/notify_pharmacy_changes notify all admins ('Re-verification needed' or 'Profile updated' for fee/clinic/address/location/phone/hours edits) and tell the provider. Other edits (fee, address, schedule, location, hours, phone) apply immediately without re-approval.
- NotificationListener.jsx (mounted in App.jsx): every signed-in role gets a chime (unlocked by any tap; mute button in the banner), vibration on phones and a top banner when a NEW notification arrives; polls every 20 s; works only while the app/PWA is open. Closed-app push needs Web Push (not built).
- FINDINGS (not changed): token_no = order the doctor CONFIRMS (max+1 per doctor per day), not slot order, so token and appointment time can disagree; there is no live queue, no 'now serving', no walk-in entry (doctors table has walk_in_reserve_pct but no UI). Commission: none built; the model is subscriptions; patients pay at the clinic/pharmacy so commission cannot be collected automatically without online payments.

## Nov 18 (later): medicines, MRP and price protection (built, NOT yet run)
- Test prices in the test pharmacy (25,30,35...) are PLACEHOLDERS, not real MRPs. Real prices must come from pharmacies.
- DB migration medicine_catalog_mrp_price_protection: medicines.source/reviewed + unique index (name+strength+form) + name length check; pantoprazole set to rx_only; ~40 common medicines seeded (names only, NO prices, source='seed', reviewed=false, conservative rx flags: NEEDS PHARMACIST REVIEW before launch); pharmacies can INSERT medicines (policy medicines_pharmacy_insert) but trigger medicine_guard forces source='pharmacy', reviewed=false, rx_only=true until an admin reviews (admin should review/flip OTC items and delete junk). pharmacy_inventory.mrp (NOT NULL, >0) + CHECK price <= mrp (existing 10 test rows: mrp=price); inventory_public now exposes mrp.
- Adapter: Medicine.create for pharmacies (friendly duplicate error), medicineFromRow, medInfo cache (strength, form, generic) added to inventory rows as medicine_strength/medicine_form/generic_name, PharmacyInventory.create requires MRP and rejects price > MRP, update accepts mrp and gives a friendly price error. (I briefly dropped the return/remove lines of PharmacyInventory.update while editing and restored them; verify the pharmacy inventory page loads.)
- PharmacyInventory.jsx rewritten: searches the DB medicine list (name, salt, strength), add flow with MRP + selling price (price <= MRP enforced in UI and DB), 'Medicine not in the list? Add it' form (saved as prescription-only until reviewed), editable MRP/price/stock/availability per item. The old hardcoded src/lib/medicineCatalog.js is no longer used by this page (it caused the uuid bug).
- OrderMedicines.jsx: search by name/salt/strength, filter chips (All / No prescription needed / Prescription needed), strength and form shown, MRP struck through with 'save Rs X', quantity capped at stock or 20, estimated total wording, prescription check at checkout (blocks Rx items if no MediTrust prescription in the last 30 days; DB also enforces).
- NOT built: 'report a price problem' button + price_reports table/RPC, patient-side medicine-first search across pharmacies, bulk/CSV stock upload, health-records storage with quotas, commission/platform-fee logic (needs Razorpay and a lawyer's opinion on fee-sharing for doctors), push notifications for closed apps, Today's queue/walk-in, slot-ordered tokens.

## Next tasks (one per session)
2. Build for clinics: "Add walk-in patient" (doctor/reception creates a token without a patient account), "Call next" + "now serving" counter visible to patients (30 s polling is OK for pilot). Needs a database RPC (RLS-safe), then UI.
3. End-to-end test: book -> accept -> token -> complete -> prescribe -> patient sees prescription.
4. Clinic location capture in onboarding; fix/remove dead "Download prescription" button.
5. Legal pages + consent checkbox; password-reset screen.
6. Deploy (GitHub -> Netlify).
Open question for the founder: how many clinics will pilot, and who is the receptionist-level contact?
