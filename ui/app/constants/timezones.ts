import type { TimezoneEntry } from '../types/types';

export const TIMEZONES: TimezoneEntry[] = [
  { id: 'Pacific/Honolulu', offset: '−10:00', city: 'Honolulu', aliases: ['US/Hawaii'] },
  { id: 'America/Anchorage', offset: '−09:00/08:00', city: 'Anchorage', aliases: ['US/Alaska'] },
  { id: 'America/Los_Angeles', offset: '−08:00/07:00', city: 'Los Angeles', aliases: ['US/Pacific', 'PST8PDT', 'America/Vancouver', 'Canada/Pacific'] },
  { id: 'America/Phoenix', offset: '−07:00', city: 'Phoenix', aliases: ['US/Arizona'] },
  { id: 'America/Denver', offset: '−07:00/06:00', city: 'Denver', aliases: ['US/Mountain', 'MST7MDT', 'Canada/Mountain'] },
  { id: 'America/Mexico_City', offset: '−06:00', city: 'Mexico City' },
  { id: 'America/Chicago', offset: '−06:00/05:00', city: 'Chicago', aliases: ['US/Central', 'CST6CDT', 'Canada/Central'] },
  { id: 'America/Bogota', offset: '−05:00', city: 'Bogotá' },
  { id: 'America/Lima', offset: '−05:00', city: 'Lima', hidden: true },
  { id: 'America/New_York', offset: '−05:00/04:00', city: 'New York', aliases: ['US/Eastern', 'EST5EDT', 'America/Toronto', 'Canada/Eastern'] },
  { id: 'America/Caracas', offset: '−04:00', city: 'Caracas' },
  { id: 'America/Halifax', offset: '−04:00/03:00', city: 'Halifax', aliases: ['AST4ADT', 'Canada/Atlantic'], hidden: true },
  { id: 'America/Santiago', offset: '−04:00/03:00', city: 'Santiago' },
  { id: 'America/Sao_Paulo', offset: '−03:00', city: 'São Paulo' },
  { id: 'America/Buenos_Aires', offset: '−03:00', city: 'Buenos Aires', hidden: true },
  { id: 'UTC', offset: '+00:00', city: 'Accra', aliases: ['Etc/UTC', 'Etc/GMT'] },
  { id: 'Europe/London', offset: '+00:00/01:00', city: 'London', aliases: ['Europe/Dublin', 'Europe/Lisbon'] },
  { id: 'Africa/Lagos', offset: '+01:00', city: 'Lagos' },
  { id: 'Europe/Paris', offset: '+01:00/02:00', city: 'Paris', aliases: ['Europe/Amsterdam', 'Europe/Rome', 'Europe/Madrid', 'Europe/Stockholm', 'Europe/Warsaw'] },
  { id: 'Europe/Berlin', offset: '+01:00/02:00', city: 'Berlin', hidden: true },
  { id: 'Africa/Johannesburg', offset: '+02:00', city: 'Johannesburg', hidden: true },
  { id: 'Africa/Cairo', offset: '+02:00', city: 'Cairo' },
  { id: 'Europe/Athens', offset: '+02:00/03:00', city: 'Athens' },
  { id: 'Europe/Helsinki', offset: '+02:00/03:00', city: 'Helsinki', aliases: ['Europe/Bucharest'], hidden: true },
  { id: 'Asia/Jerusalem', offset: '+02:00/03:00', city: 'Jerusalem', hidden: true },
  { id: 'Europe/Moscow', offset: '+03:00', city: 'Moscow', hidden: true },
  { id: 'Europe/Istanbul', offset: '+03:00', city: 'Istanbul' },
  { id: 'Asia/Riyadh', offset: '+03:00', city: 'Riyadh', hidden: true },
  { id: 'Asia/Dubai', offset: '+04:00', city: 'Dubai' },
  { id: 'Asia/Karachi', offset: '+05:00', city: 'Karachi' },
  { id: 'Asia/Kolkata', offset: '+05:30', city: 'Kolkata', aliases: ['Asia/Calcutta', 'Asia/Mumbai', 'Asia/Delhi', 'Asia/Chennai', 'Asia/Bangalore'] },
  { id: 'Asia/Bangkok', offset: '+07:00', city: 'Bangkok', aliases: ['Asia/Ho_Chi_Minh'], hidden: true },
  { id: 'Asia/Jakarta', offset: '+07:00', city: 'Jakarta' },
  { id: 'Asia/Singapore', offset: '+08:00', city: 'Singapore', aliases: ['Asia/Kuala_Lumpur'], hidden: true },
  { id: 'Asia/Hong_Kong', offset: '+08:00', city: 'Hong Kong', hidden: true },
  { id: 'Asia/Shanghai', offset: '+08:00', city: 'Shanghai', aliases: ['Asia/Taipei'] },
  { id: 'Asia/Manila', offset: '+08:00', city: 'Manila', hidden: true },
  { id: 'Australia/Perth', offset: '+08:00', city: 'Perth', aliases: ['Australia/West'], hidden: true },
  { id: 'Asia/Seoul', offset: '+09:00', city: 'Seoul', hidden: true },
  { id: 'Asia/Tokyo', offset: '+09:00', city: 'Tokyo' },
  { id: 'Australia/Darwin', offset: '+09:30', city: 'Darwin', aliases: ['Australia/North'] },
  { id: 'Australia/Adelaide', offset: '+09:30/10:30', city: 'Adelaide', aliases: ['Australia/South'] },
  { id: 'Australia/Brisbane', offset: '+10:00', city: 'Brisbane', aliases: ['Australia/Queensland'] },
  { id: 'Australia/Sydney', offset: '+10:00/11:00', city: 'Sydney', aliases: ['Australia/Melbourne', 'Australia/Victoria', 'Australia/NSW'] },
  { id: 'Pacific/Auckland', offset: '+12:00/13:00', city: 'Auckland' },
];

// Build lookup map for timezone ID/alias → { offset, city, canonicalId }
const timezoneLookup: Record<string, { offset: string; city: string; canonicalId: string }> = {};
TIMEZONES.forEach(tz => {
  timezoneLookup[tz.id] = { offset: tz.offset, city: tz.city, canonicalId: tz.id };
  tz.aliases?.forEach(alias => {
    timezoneLookup[alias] = { offset: tz.offset, city: tz.city, canonicalId: tz.id };
  });
});

export const TIMEZONE_OPTIONS = TIMEZONES.filter(tz => !tz.hidden);

export function getTimezoneOffset(id: string): string {
  return timezoneLookup[id]?.offset ?? '?';
}

export function getTimezoneCity(id: string): string {
  return timezoneLookup[id]?.city ?? '?';
}

export function detectUserTimezone(): string {
  try {
    const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return timezoneLookup[browserTz]?.canonicalId ?? 'UTC';
  } catch {
    return 'UTC';
  }
}