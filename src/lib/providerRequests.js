

import { db } from '@/api/client';

export const EXTERNAL_SOURCE_OSM = "osm";

export function buildExternalId(osmId, source = EXTERNAL_SOURCE_OSM) {
  return `${source}:${osmId}`;
}

// Best-effort upsert of the demand aggregate for an external provider.
// One row per (external_provider_id + source); increments request_count.
export async function upsertProviderSource({
  type, osmId, name, address, lat, lng, state, city, pincode,
}) {
  const externalId = buildExternalId(osmId);
  try {
    const page = await db.entities.ProviderExternalSource.filter(
      { external_provider_id: externalId, source: EXTERNAL_SOURCE_OSM },
      { limit: 1 }
    );
    const now = new Date().toISOString();
    if (page.length) {
      const row = page[0];
      await db.entities.ProviderExternalSource.update(row.id, {
        request_count: (row.request_count || 1) + 1,
        latest_request_date: now,
      });
      return row;
    }
    return await db.entities.ProviderExternalSource.create({
      external_provider_id: externalId,
      source: EXTERNAL_SOURCE_OSM,
      provider_type: type,
      name,
      address,
      lat,
      lng,
      state,
      city,
      pincode,
      request_count: 1,
      first_requested_date: now,
      latest_request_date: now,
      status: "pending",
    });
  } catch (e) {
    return null;
  }
}

// Create a provider onboarding request + demand aggregate + patient notification.
export async function createProviderRequest({
  type, osmId, name, address, lat, lng, tags, requesterEmail, requesterName, phone = "",
  linkedEntityType = "none", linkedEntityId = "", reason = "", state = "", city = "", pincode = "",
}) {
  const externalId = buildExternalId(osmId);
  const req = await db.entities.ProviderRequest.create({
    request_type: type,
    osm_id: osmId,
    osm_name: name,
    phone,
    osm_address: address,
    osm_lat: lat,
    osm_lng: lng,
    osm_tags: tags,
    external_source: EXTERNAL_SOURCE_OSM,
    external_provider_id: externalId,
    requested_by_email: requesterEmail,
    requested_by_name: requesterName,
    reason,
    state,
    city,
    pincode,
    linked_entity_type: linkedEntityType,
    linked_entity_id: linkedEntityId,
    status: "pending",
  });

  await upsertProviderSource({ type, osmId, name, address, lat, lng, state, city, pincode });

  try {
    await db.entities.Notification.create({
      user_email: requesterEmail,
      title: type === "doctor" ? "Doctor request received" : "Pharmacy request received",
      message: `We've received your request for ${name}. We'll onboard them and notify you when they're available on MediTrust.`,
      type: "general",
      is_read: false,
    });
  } catch (e) { console.error(e); }

  return req;
}

// Notify every patient who requested a provider that it is now MediTrust Verified.
export async function notifyRequestersOfOnboarding({ externalId, providerType, providerName, link = "" }) {
  try {
    const reqPage = await db.entities.ProviderRequest.filter(
      { external_provider_id: externalId, request_type: providerType },
      { limit: 200 }
    );
    const reqs = reqPage;
    const emails = [...new Set(reqs.map((r) => r.requested_by_email).filter(Boolean))];
    for (const email of emails) {
      await db.entities.Notification.create({
        user_email: email,
        title: providerType === "doctor" ? "Doctor joined MediTrust" : "Pharmacy joined MediTrust",
        message: `${providerName} is now MediTrust Verified. You can ${providerType === "doctor" ? "book an appointment" : "order medicines"} with them.`,
        type: "provider_onboarded",
        link,
        is_read: false,
      });
    }
    return emails.length;
  } catch (e) {
    return 0;
  }
}