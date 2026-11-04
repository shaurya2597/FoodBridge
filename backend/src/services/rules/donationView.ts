/**
 * Decides exactly which fields each kind of viewer may see. Pure and unit-tested, because leaking a donor's
 * phone number or an anonymous requester's identity is the worst bug this feature could have.
 */
export type DonationViewer = 'PUBLIC' | 'NGO' | 'CLAIMANT' | 'DONOR' | 'ADMIN';

export interface DonationLike {
  id: string; donorId: string; restaurantId: string | null; donorName: string; donorType: 'INDIVIDUAL' | 'RESTAURANT';
  foodName: string; category: string; quantity: string; servings: number; foodType: 'VEG' | 'NON_VEG';
  preparedAt: Date; expiresAt: Date; pickupAddress: string; city: string; latitude: number | null; longitude: number | null;
  contactPhone: string; imageUrl: string | null; instructions: string | null; status: string;
  pickupScheduledAt: Date | null; statusHistory: unknown; claimedByNgoId: string | null; createdAt: Date; updatedAt: Date;
}

const PHONE_VISIBLE_TO_CLAIMANT = ['ACCEPTED', 'PICKUP_SCHEDULED', 'COLLECTED', 'DISTRIBUTED'];

export function toDonationView(d: DonationLike, viewer: DonationViewer, now: Date, extras?: Record<string, unknown>) {
  const base = {
    id: d.id, foodName: d.foodName, category: d.category, quantity: d.quantity, servings: d.servings, foodType: d.foodType,
    donorType: d.donorType,
    // Private individuals stay anonymous to the public; restaurants are named.
    donorName: viewer === 'PUBLIC' && d.donorType === 'INDIVIDUAL' ? 'Individual donor' : d.donorName,
    city: d.city, imageUrl: d.imageUrl, preparedAt: d.preparedAt, availableUntil: d.expiresAt,
    isExpired: d.expiresAt.getTime() <= now.getTime(), status: d.status, createdAt: d.createdAt,
  };
  if (viewer === 'PUBLIC') return base;

  const withLocation = { ...base, pickupAddress: d.pickupAddress, latitude: d.latitude, longitude: d.longitude, instructions: d.instructions };
  if (viewer === 'NGO') return withLocation;

  if (viewer === 'CLAIMANT') {
    return {
      ...withLocation, pickupScheduledAt: d.pickupScheduledAt, statusHistory: d.statusHistory,
      contactPhone: PHONE_VISIBLE_TO_CLAIMANT.includes(d.status) ? d.contactPhone : undefined,
    };
  }
  // DONOR and ADMIN see everything
  return { ...withLocation, contactPhone: d.contactPhone, pickupScheduledAt: d.pickupScheduledAt, statusHistory: d.statusHistory, claimedByNgoId: d.claimedByNgoId, updatedAt: d.updatedAt, ...extras };
}

// ---------- food assistance requests ----------
export type AssistanceViewer = 'OWNER' | 'ASSIGNED_NGO' | 'ADMIN' | 'NGO_BROWSE' | 'TRACKER';

export interface AssistanceLike {
  id: string; userId: string | null; name: string; phone: string; people: number; requirement: string;
  foodType: 'VEG' | 'NON_VEG' | null; location: string; city: string; notes: string | null; status: string;
  assignedNgoId: string | null; statusHistory: unknown; createdAt: Date; updatedAt: Date;
}

const splitReq = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean);

export function toAssistanceView(a: AssistanceLike, viewer: AssistanceViewer, ngoName?: string | null) {
  const core = {
    id: a.id, status: a.status, people: a.people, requirements: splitReq(a.requirement), foodType: a.foodType,
    city: a.city, createdAt: a.createdAt,
  };
  if (viewer === 'TRACKER') {
    // Anyone holding the (unguessable) id can follow progress, but learns nothing about who asked.
    const history = Array.isArray(a.statusHistory) ? (a.statusHistory as { status: string; at: string }[]).map((h) => ({ status: h.status, at: h.at })) : [];
    return { ...core, statusHistory: history, assignedNgo: ngoName ?? null };
  }
  if (viewer === 'NGO_BROWSE') return { ...core, location: a.location, notes: a.notes }; // no name, no phone until assigned
  return { ...core, name: a.name, phone: a.phone, location: a.location, notes: a.notes, statusHistory: a.statusHistory, assignedNgoId: a.assignedNgoId, assignedNgo: ngoName ?? null, updatedAt: a.updatedAt };
}
