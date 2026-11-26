// Online payment entry point (Razorpay). Inert until features.onlinePayments is true AND the backend exists.
// Rules: the browser NEVER decides a payment succeeded. Success = the server verified the Razorpay signature.
import { db } from '@/api/client';
import features from '@/config/features';

function loadCheckoutScript() {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) return resolve();
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Could not load the payment window. Check your internet and try again.'));
    document.body.appendChild(s);
  });
}

async function callServer(name, payload) {
  if (!db.functions || typeof db.functions.invoke !== 'function') {
    throw new Error('The payment server is not connected yet.');
  }
  return db.functions.invoke(name, payload);
}

/**
 * purpose: 'subscription' | 'ad_booster' | 'health_premium'
 * Resolves only after the SERVER confirms the payment. Rejects on cancel, failure or no server.
 */
export async function startOnlinePayment({ purpose, amount, description, linkedEntityType, linkedEntityId }) {
  if (!features.onlinePayments) throw new Error('Online payments are not enabled yet.');
  const keyId = import.meta.env.VITE_RAZORPAY_KEY_ID; // public key id only. The secret stays on the server.
  if (!keyId) throw new Error('Payment is not configured yet.');
  const order = await callServer('createPaymentOrder', { purpose, amount, linkedEntityType, linkedEntityId });
  await loadCheckoutScript();
  const paid = await new Promise((resolve, reject) => {
    const rz = new window.Razorpay({
      key: keyId, order_id: order.orderId, amount: Math.round(amount * 100), currency: 'INR',
      name: 'MediTrust', description,
      handler: (r) => resolve(r),
      modal: { ondismiss: () => reject(new Error('Payment cancelled.')) },
    });
    rz.on('payment.failed', () => reject(new Error('Payment failed. You were not charged, or the amount will be refunded.')));
    rz.open();
  });
  const result = await callServer('verifyPayment', {
    orderId: paid.razorpay_order_id, paymentId: paid.razorpay_payment_id, signature: paid.razorpay_signature,
  });
  if (!result || result.verified !== true) throw new Error('We could not confirm your payment yet. If money was deducted, it will be reconciled.');
  return result;
}
