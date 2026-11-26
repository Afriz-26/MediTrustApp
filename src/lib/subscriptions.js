// Subscription activation used by the admin during the pilot (manual payment).
// Once online payments are on, the payment server does this instead.
import { db } from '@/api/client';
import { computeSubscriptionDates } from '@/lib/paymentUtils';

export async function activateSubscription(sub, paymentRef) {
  const ref = (paymentRef || '').trim();
  if (!ref) throw new Error('Enter the payment reference (for example the UPI transaction ID) first.');
  const { start_date, end_date } = computeSubscriptionDates(sub.billing_cycle);
  await db.entities.Subscription.update(sub.id, { status: 'active', start_date, end_date, payment_id: `manual:${ref}` });
  const entity = sub.provider_type === 'doctor' ? 'DoctorProfile' : 'PharmacyProfile';
  const profiles = await db.entities[entity].filter({ email: sub.provider_email }, { limit: 1 });
  if (profiles[0]) {
    await db.entities[entity].update(profiles[0].id, {
      subscription_tier: sub.tier, subscription_status: 'active', subscription_ends_at: end_date,
    });
  }
  await db.entities.Notification.create({
    user_email: sub.provider_email, title: 'Plan activated',
    message: `Your plan is active until ${end_date}.`, type: 'general', is_read: false,
  });
  return { start_date, end_date };
}
