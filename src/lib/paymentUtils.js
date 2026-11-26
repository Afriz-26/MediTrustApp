
// Payment & Subscription utilities — single source of truth for all payment flows.
// Phase 3: server-verified reliability with full audit trail via Payment entity.
//
// NOTE: This currently uses client-side payment verification (demo mode).
// When Builder+ is available, replace `verifyAndRecordPayment` with a backend
// function that verifies the Razorpay signature server-side and atomically
// updates the linked entity. The function signatures here are designed to
// drop directly into that backend function with no UI changes.
import { db } from '@/api/client';

// ── ID generators ────────────────────────────────────────────────────────────
export function generateOrderId() {
  return "order_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
}

export function generatePaymentId() {
  return "pay_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
}

export function generateTokenNumber() {
  return "MT-" + String(Math.floor(1000 + Math.random() * 9000));
}

// ── Date computation ─────────────────────────────────────────────────────────
export function computeSubscriptionDates(billingCycle) {
  const start = new Date();
  const end = new Date(start);
  if (billingCycle === "yearly") {
    end.setDate(end.getDate() + 365);
  } else {
    end.setDate(end.getDate() + 30);
  }
  return {
    start_date: start.toISOString().split("T")[0],
    end_date: end.toISOString().split("T")[0],
  };
}

export function computeBoosterDates(durationId) {
  const start = new Date();
  const end = new Date(start);
  const daysMap = { daily: 1, weekly: 7, monthly: 30, d7: 7, d14: 14, d30: 30 };
  end.setDate(end.getDate() + (daysMap[durationId] || 7));
  return {
    start_date: start.toISOString().split("T")[0],
    end_date: end.toISOString().split("T")[0],
  };
}

// ── Payment record creation (audit trail) ────────────────────────────────────
export async function recordPayment({
  userEmail,
  amount,
  paymentType,
  linkedEntityId,
  linkedEntityType,
  gatewayPaymentId,
  gatewayOrderId,
  status = "paid",
  description = "",
}) {
  try {
    const payment = await db.entities.Payment.create({
      user_email: userEmail,
      amount,
      currency: "INR",
      payment_type: paymentType,
      linked_entity_id: linkedEntityId || "",
      linked_entity_type: linkedEntityType || "",
      gateway: "razorpay",
      gateway_order_id: gatewayOrderId || generateOrderId(),
      gateway_payment_id: gatewayPaymentId || generatePaymentId(),
      status,
      description,
    });
    return payment;
  } catch (e) {
    return null;
  }
}

// ── Verify and record a payment (client-side demo — isolate for server upgrade)
// When Builder+ is available, this becomes a backend function that:
//   1. Verifies the Razorpay signature: HMAC_SHA256(order_id + "|" + payment_id, secret)
//   2. Atomically updates the linked entity and creates the Payment record
//   3. Returns the verified result
export async function verifyAndRecordPayment({
  userEmail,
  amount,
  paymentType,
  linkedEntityId,
  linkedEntityType,
  gatewayPaymentId,
  gatewayOrderId,
  description,
}) {
  // Client-side: simulate verification (always succeeds in demo mode)
  // Server-side: verify signature, then record
  const payment = await recordPayment({
    userEmail,
    amount,
    paymentType,
    linkedEntityId,
    linkedEntityType,
    gatewayPaymentId,
    gatewayOrderId,
    status: "paid",
    description,
  });
  return { verified: true, payment };
}

// ── Process a refund (client-side demo — isolate for server upgrade)
// When Builder+ is available, this calls the gateway refund API server-side.
export async function processRefund({ paymentId, linkedEntityId, linkedEntityType }) {
  try {
    // Update Payment to refunded
    if (paymentId) {
      await db.entities.Payment.update(paymentId, { status: "refunded" });
    }
    // Update linked entity
    if (linkedEntityType === "Appointment" && linkedEntityId) {
      await db.entities.Appointment.update(linkedEntityId, {
        payment_status: "refunded",
        status: "cancelled",
      });
    } else if (linkedEntityType === "Subscription" && linkedEntityId) {
      await db.entities.Subscription.update(linkedEntityId, { status: "cancelled" });
    } else if (linkedEntityType === "AdBooster" && linkedEntityId) {
      await db.entities.AdBooster.update(linkedEntityId, { status: "cancelled" });
    }
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// ── Notification helper ──────────────────────────────────────────────────────
export async function notifyPaymentSuccess(userEmail, title, message, link) {
  try {
    await db.entities.Notification.create({
      user_email: userEmail,
      title,
      message,
      type: "payment_success",
      link: link || "",
      is_read: false,
    });
  } catch (_) {}
}