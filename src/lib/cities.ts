/** The cities KL Now can show. Add another by giving it coordinates, a timezone and a skyline. */
export interface City {
  id: 'kl' | 'melbourne';
  name: string; // shown on the card
  short: string; // shown in the switcher + app name
  flag: string;
  tz: string; // IANA timezone
  lat: number;
  lon: number;
}

export const CITIES: City[] = [
  { id: 'kl', name: 'Kuala Lumpur', short: 'KL', flag: '🇲🇾', tz: 'Asia/Kuala_Lumpur', lat: 3.139, lon: 101.6869 },
  { id: 'melbourne', name: 'Melbourne', short: 'Melb', flag: '🇦🇺', tz: 'Australia/Melbourne', lat: -37.8136, lon: 144.9631 },
];

export const cityById = (id: string | null | undefined): City | undefined => CITIES.find((c) => c.id === id);
