import * as Location from 'expo-location';

export class CrewRegionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CrewRegionError';
  }
}

function slugPart(value: string | null | undefined): string {
  if (!value) return '';
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Stable region key stored in the database, e.g. `vienna-at` or `san-francisco-us`. */
export function buildCrewRegionKey(place: Location.LocationGeocodedAddress): string {
  const country = slugPart(place.isoCountryCode || place.country);
  const city = slugPart(place.city || place.subregion || place.district);
  const admin = slugPart(place.region);

  if (city && country) {
    if (admin && admin !== city) {
      return `${city}-${admin}-${country}`;
    }
    return `${city}-${country}`;
  }

  if (admin && country) return `${admin}-${country}`;
  if (country) return country;
  return 'unknown';
}

export function regionLabel(regionKey: string | undefined): string {
  if (!regionKey || regionKey === 'unknown') return 'UNKNOWN AREA';
  return regionKey
    .split('-')
    .filter(Boolean)
    .map((part) => part.toUpperCase())
    .join(', ');
}

export async function resolveCurrentCrewRegion(): Promise<string> {
  const servicesEnabled = await Location.hasServicesEnabledAsync();
  if (!servicesEnabled) {
    throw new CrewRegionError(
      'Turn on location services so we can place your crew in your local area ranking.',
    );
  }

  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') {
    throw new CrewRegionError(
      'Location access is required to set your crew area. Enable it in Settings and try again.',
    );
  }

  const position = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });

  const places = await Location.reverseGeocodeAsync({
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
  });

  const place = places[0];
  if (!place) {
    throw new CrewRegionError('Could not determine your area. Try again in a moment.');
  }

  const regionKey = buildCrewRegionKey(place);
  if (regionKey === 'unknown') {
    throw new CrewRegionError('Could not determine your area. Try again in a moment.');
  }

  return regionKey;
}
