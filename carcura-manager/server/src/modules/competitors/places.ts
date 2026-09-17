import { type FetchFn, fetchJson } from '../../integrations/marketing/types.js';

export interface PlaceResult { placeId: string; name: string; address: string | null; website: string | null; phone: string | null; lat: number | null; lng: number | null; rating: number | null; ratingCount: number | null; businessStatus: string | null; priceLevel: string | null }

/** Google Places API (New) – Textsuche, ausschließlich öffentliche Daten über die offizielle API. */
export class PlacesAdapter {
  constructor(private readonly apiKey: string, private readonly fetchFn: FetchFn = fetch) {}
  async searchText(query: string, opts: { lat?: number | null; lng?: number | null; radiusMeters?: number; language?: string } = {}): Promise<PlaceResult[]> {
    const body: Record<string, unknown> = { textQuery: query, languageCode: opts.language ?? 'de', maxResultCount: 20 };
    if (opts.lat && opts.lng) body.locationBias = { circle: { center: { latitude: opts.lat, longitude: opts.lng }, radius: opts.radiusMeters ?? 30000 } };
    const res = await fetchJson<{ places?: Array<Record<string, unknown>> }>(this.fetchFn, 'https://places.googleapis.com/v1/places:searchText', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': this.apiKey, 'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.websiteUri,places.nationalPhoneNumber,places.location,places.rating,places.userRatingCount,places.businessStatus,places.priceLevel' }, body: JSON.stringify(body) });
    return (res.places ?? []).map((p) => ({ placeId: String(p.id), name: String((p.displayName as { text?: string })?.text ?? ''), address: (p.formattedAddress as string) ?? null, website: (p.websiteUri as string) ?? null, phone: (p.nationalPhoneNumber as string) ?? null, lat: (p.location as { latitude?: number })?.latitude ?? null, lng: (p.location as { longitude?: number })?.longitude ?? null, rating: typeof p.rating === 'number' ? p.rating : null, ratingCount: typeof p.userRatingCount === 'number' ? p.userRatingCount : null, businessStatus: (p.businessStatus as string) ?? null, priceLevel: (p.priceLevel as string) ?? null }));
  }
}
