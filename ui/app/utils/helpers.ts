import type { EntityTypeOption, EntityFilter, EntityReference, UnderlyingOptions } from '../types/types';
import { DEFAULT_ENTITY_TYPES, ENTITY_TYPES_WITH_UNDERLYING } from '../constants/entityTypes';

// --- Formatting ---

export function formatDateTime(iso: string): string {
  if (!iso) return 'N/A';
  const match = iso.match(/(\d{4}-\d{2}-\d{2})T?(\d{2}:\d{2})/);
  return match ? `${match[1]} ${match[2]}` : iso;
}

export function toApiDateTime(dateString: string): string {
  if (!dateString) return '';
  const match = dateString.match(/(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})/);
  if (match) return match[1];
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

export function formatTimestamp(ts?: number): string {
  return ts ? new Date(ts).toLocaleString() : '—';
}

export function formatWeekDays(days?: string[]): string {
  if (!days?.length) return 'None';
  const order = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];
  const abbr: Record<string, string> = {
    MONDAY: 'Mon', TUESDAY: 'Tue', WEDNESDAY: 'Wed', THURSDAY: 'Thu',
    FRIDAY: 'Fri', SATURDAY: 'Sat', SUNDAY: 'Sun',
  };
  return days
    .sort((a, b) => order.indexOf(a) - order.indexOf(b))
    .map(d => abbr[d] || d)
    .join(', ');
}

// --- Labels ---

export function getEntityTypeLabel(value: string, types: EntityTypeOption[] = DEFAULT_ENTITY_TYPES): string {
  return types.find(t => t.value === value)?.label ?? value;
}

export function getSuppressionLabel(value: string): string {
  const map: Record<string, string> = {
    DONT_DETECT_PROBLEMS: 'Problem detection',
    DETECT_PROBLEMS_DONT_ALERT: 'Alerts only',
    DETECT_PROBLEMS_AND_ALERT: 'None',
  };
  return map[value] ?? value;
}

export function getSuppressionDescription(value: string): string {
  const map: Record<string, string> = {
    DONT_DETECT_PROBLEMS: "Don't detect problems",
    DETECT_PROBLEMS_DONT_ALERT: "Detect problems but don't alert",
    DETECT_PROBLEMS_AND_ALERT: 'Detect problems and alert',
  };
  return map[value] ?? value;
}

export function getScheduleTypeLabel(value: string): string {
  const map: Record<string, string> = { ONCE: 'Once', DAILY: 'Daily', WEEKLY: 'Weekly', MONTHLY: 'Monthly' };
  return map[value] ?? value;
}

export function getMaintenanceTypeLabel(value: string): string {
  const map: Record<string, string> = { PLANNED: 'Planned', UNPLANNED: 'Unplanned' };
  return map[value] ?? value;
}

// --- Parsing ---

export function parseDescription(description: string): { text: string; author: string } {
  if (!description) return { text: '', author: 'Unknown' };
  const match = description.match(/\[([^\]]+@[^\]]+)\]\s*$/);
  if (match) return { text: description.replace(/\s*\[[^\]]+@[^\]]+\]\s*$/, '').trim(), author: match[1] };
  return { text: description, author: 'Unknown' };
}

// --- ID generation ---

export function generateFilterId(): string {
  return `filter-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

// --- Underlying options ---

export function getDefaultUnderlyingOptions(): UnderlyingOptions {
  return { includeProcesses: false, includeServices: false, includeHosts: false, includeProcessGroups: false };
}

export function hasUnderlyingOptionsSelected(options: UnderlyingOptions): boolean {
  return options.includeProcesses || options.includeServices || options.includeHosts || options.includeProcessGroups;
}

// --- Auto-tag helpers ---

export function sanitizeTagName(name: string): string {
  return name.replace(/[^\w\s\-—]/g, '').trim();
}

export function generateMaintenanceTagKey(windowName: string): string {
  return `Maintenance — ${sanitizeTagName(windowName)}`;
}

// --- Entity selector builders ---

export function buildEntitySelectorsForUnderlying(
  entity: EntityReference,
  options: UnderlyingOptions,
): { entityType: string; selector: string }[] {
  const selectors: { entityType: string; selector: string }[] = [];
  const id = entity.entityId;

  selectors.push({
    entityType: entity.entityType,
    selector: `type(${entity.entityType}),entityId("${id}")`,
  });

  if (entity.entityType === 'HOST') {
    if (options.includeProcesses)
      selectors.push({ entityType: 'PROCESS_GROUP_INSTANCE', selector: `type(PROCESS_GROUP_INSTANCE),fromRelationships.isProcessOf(entityId("${id}"))` });
    if (options.includeServices)
      selectors.push({ entityType: 'SERVICE_INSTANCE', selector: `type("SERVICE"),fromRelationships.runsOnHost(entityId("${id}"))` });
  } else if (entity.entityType === 'HOST_GROUP') {
    if (options.includeHosts)
      selectors.push({ entityType: 'HOST', selector: `type(HOST),fromRelationships.isInstanceOf(entityId("${id}"))` });
    if (options.includeProcesses)
      selectors.push({ entityType: 'PROCESS_GROUP_INSTANCE', selector: `type(PROCESS_GROUP_INSTANCE),fromRelationships.isProcessOf(type(HOST),fromRelationships.isInstanceOf(entityId("${id}")))` });
    if (options.includeServices)
      selectors.push({ entityType: 'SERVICE_INSTANCE', selector: `type(SERVICE),fromRelationships.runsOnHost(type(HOST),fromRelationships.isInstanceOf(entityId("${id}")))` });
  } else if (entity.entityType === 'PROCESS_GROUP') {
    if (options.includeHosts)
      selectors.push({ entityType: 'HOST', selector: `type(HOST),toRelationships.runsOn(entityId("${id}"))` });
    if (options.includeServices)
      selectors.push({ entityType: 'SERVICE', selector: `type(SERVICE),fromRelationships.runsOn(entityId("${id}"))` });
  } else if (entity.entityType === 'SERVICE') {
    if (options.includeHosts)
      selectors.push({ entityType: 'HOST', selector: `type(HOST),toRelationships.runsOnHost(entityId("${id}"))` });
    if (options.includeProcessGroups)
      selectors.push({ entityType: 'PROCESS_GROUP', selector: `type(PROCESS_GROUP),toRelationships.runsOn(entityId("${id}"))` });
  }

  return selectors;
}

export function buildEntitySelectorForFilter(filter: EntityFilter): string[] {
  const selectors: string[] = [];
  const tagParts = filter.tags.map(t => t.value ? `tag("${t.key}:${t.value}")` : `tag("${t.key}")`);
  const mzParts = filter.managementZones.map(mz => `mzName("${mz.name}")`);

  if (filter.entities.length > 0) {
    filter.entities.forEach(entity => {
      if (ENTITY_TYPES_WITH_UNDERLYING.includes(entity.entityType) && hasUnderlyingOptionsSelected(filter.underlyingOptions)) {
        buildEntitySelectorsForUnderlying(entity, filter.underlyingOptions).forEach(({ selector }) => {
          selectors.push([selector, ...tagParts, ...mzParts].join(','));
        });
      } else {
        selectors.push([`type(${entity.entityType}),entityId("${entity.entityId}")`, ...tagParts, ...mzParts].join(','));
      }
    });
  } else if (tagParts.length > 0 || mzParts.length > 0) {
    // Entity selector requires a type() — query common types when no specific entity is set
    const commonTypes = ['HOST', 'SERVICE', 'PROCESS_GROUP', 'APPLICATION', 'SYNTHETIC_TEST', 'HTTP_CHECK'];
    commonTypes.forEach(type => {
      selectors.push([`type(${type})`, ...tagParts, ...mzParts].join(','));
    });
  }

  return selectors;
}

export function isFilterNonEmpty(filter: EntityFilter): boolean {
  return filter.entities.length > 0 || filter.managementZones.length > 0 || filter.tags.length > 0;
}

// Build entity selectors from raw API filter objects (used by DetailsModal)
export function buildSelectorsFromRawFilters(
  filters: { entityType?: string; entityId?: string; entityTags?: string[]; managementZones?: string[] }[],
  mzNameLookup: Record<string, string>,
): string[] {
  const selectors: string[] = [];

  for (const filter of filters) {
    const parts: string[] = [];
    if (filter.entityType) parts.push(`type(${filter.entityType})`);
    if (filter.entityId) parts.push(`entityId("${filter.entityId}")`);
    filter.entityTags?.forEach(tag => parts.push(`tag("${tag}")`));
    filter.managementZones?.forEach(mzId => {
      const name = mzNameLookup[mzId];
      if (name) parts.push(`mzName("${name}")`);
    });

    if (parts.length === 0) continue;

    // Entity selector requires type() — fan out across common types when none specified
    if (!filter.entityType && !filter.entityId) {
      ['HOST', 'SERVICE', 'PROCESS_GROUP', 'APPLICATION'].forEach(type => {
        selectors.push([`type(${type})`, ...parts].join(','));
      });
    } else {
      selectors.push(parts.join(','));
    }
  }

  return selectors;
}