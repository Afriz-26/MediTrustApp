// Single source of truth for prices (INR). Launch prices are ILLUSTRATIVE: confirm before going live.
// Change a price here and every screen follows.
// Plan ids are internal: basic = "Basic", moderate = "Pro", pro = "Elite" (shown to users under those names).
export const DOCTOR_PLAN_PRICES = { basic: 999, moderate: 5999, pro: 8999 };      // per month
export const PHARMACY_PLAN_PRICES = { basic: 999, moderate: 5999, pro: 8999 };    // per month (same tiers as doctors, decided Nov 2026)
export const YEARLY_DISCOUNT = 0.2;                                                // yearly = 12 months minus 20%
export const BOOSTER_PRICES = { d7: 299, d14: 999, d30: 1999 };                    // ad boosters (feature currently off)
export const RECORDS_PREMIUM = { monthly: 91, yearly: 999 };                       // health records premium (feature currently off)

// Which plans can actually be bought at launch. Only list a plan as available when everything it promises is built.
// Pro and Elite stay "Coming soon" until their features exist.
export const AVAILABLE_PLANS = { basic: true, moderate: false, pro: false };

// Pilot payment instructions shown to providers while online payments are off.
// Set VITE_UPI_ID in .env.local when you have a business UPI ID. Nothing is invented here.
export const MANUAL_PAYMENT = {
  payeeName: 'Medynex Solutions LLP',
  upiId: import.meta.env.VITE_UPI_ID || '',
};
