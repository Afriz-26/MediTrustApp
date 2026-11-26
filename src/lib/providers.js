import { db } from '@/api/client';

export function isBookable(provider, type, now = Date.now()) {
  if (!provider) return false;
  const providerType = type || (
    provider.provider_type === 'doctor' || provider.consultation_fees || provider.specialization
      ? 'doctor'
      : 'pharmacy'
  );
  const isVerified = provider.is_verified === true || provider.verification_status === 'approved';
  const hasActiveSubscription = provider.subscription_status === 'active'
    || (provider.subscription_ends_at && new Date(provider.subscription_ends_at).getTime() > now);
  if (!isVerified || !hasActiveSubscription) return false;
  if (providerType !== 'doctor') return true;
  const fees = provider.consultation_fees;
  return Boolean(fees && Object.values(fees).some((fee) =>
    fee !== null && fee !== '' && Number.isFinite(Number(fee)) && Number(fee) >= 0
  ));
}

export async function getRequestedProviderIds(type, email) {
  if (!email) return new Set();
  const result = await db.entities.ProviderRequest.filter(
    { request_type: type, requested_by_email: email },
    { limit: 500 }
  );
  return new Set(result.flatMap((request) => [
    request.osm_id,
    request.linked_entity_id,
    request.external_provider_id,
  ].filter(Boolean).map(String)));
}

export function hasRequestedProvider(requestedIds, provider) {
  if (!provider) return false;
  const candidates = [
    provider.id,
    provider.osm_id,
    provider.profileId,
    provider.linked_entity_id,
    provider.externalId,
  ].filter(Boolean).map(String);
  return candidates.some((candidate) => requestedIds.has(candidate));
}
