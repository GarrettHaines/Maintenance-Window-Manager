import { settingsObjectsClient, monitoredEntitiesClient } from '@dynatrace-sdk/client-classic-environment-v2';
import type {
  MaintenanceWindow, MaintenanceWindowRaw, ManagementZone,
  EntityTypeOption, EntityReference, EntityFilter, PreviewEntity, AutoTagRule,
} from '../types/types';
import { DEFAULT_ENTITY_TYPES } from '../constants/entityTypes';
import { getTimezoneOffset, getTimezoneCity } from '../constants/timezones';
import { formatDateTime, parseDescription, buildEntitySelectorForFilter } from '../utils/helpers';

// --- Transform raw API items into our display model ---

function transformApiItems(items: any[]): MaintenanceWindow[] {
  return items.map(item => {
    const props = item.value?.generalProperties;
    const schedule = item.value?.schedule;
    const enabled = item.value?.enabled ?? false;
    const { text: description, author } = parseDescription(props?.description ?? '');
    const recurrence = schedule?.onceRecurrence ?? schedule?.dailyRecurrence
      ?? schedule?.weeklyRecurrence ?? schedule?.monthlyRecurrence;
    const tzId = recurrence?.timeZone ?? '';
    const name = props?.name ?? 'Unnamed';

    return {
      objectId: item.objectId,
      name: enabled ? name : `[Disabled] ${name}`,
      description,
      author,
      enabled,
      suppression: props?.suppression ?? '',
      scheduleType: schedule?.scheduleType ?? '',
      startTime: formatDateTime(recurrence?.startTime ?? ''),
      endTime: formatDateTime(recurrence?.endTime ?? ''),
      utcOffset: getTimezoneOffset(tzId),
      city: getTimezoneCity(tzId),
      rawData: item as MaintenanceWindowRaw,
    };
  });
}

// --- Maintenance windows ---

export async function fetchMaintenanceWindows(): Promise<MaintenanceWindow[]> {
  const results: MaintenanceWindow[] = [];

  async function fetchPage(pageKey?: string): Promise<void> {
    const response = await settingsObjectsClient.getSettingsObjects({
      schemaIds: 'builtin:alerting.maintenance-window',
      pageSize: 500,
      fields: 'objectId,value,created,modified,createdBy,modifiedBy,author,schemaVersion',
      ...(pageKey && { nextPageKey: pageKey }),
    });
    results.push(...transformApiItems(response.items ?? []));
    if (response.nextPageKey) await fetchPage(response.nextPageKey);
  }

  try {
    await fetchPage();
  } catch (err) {
    console.error('Failed to fetch maintenance windows:', err);
  }
  return results;
}

// --- Management Zones ---

export async function fetchManagementZones(): Promise<ManagementZone[]> {
  try {
    const response = await settingsObjectsClient.getSettingsObjects({
      schemaIds: 'builtin:management-zones',
      pageSize: 500,
    });
    return (response.items ?? [])
      .map((item: any) => ({ id: item.objectId, name: item.value?.name ?? 'Unknown' }))
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch (err) {
    console.error('Failed to fetch management zones:', err);
    return [];
  }
}

// --- Entity Types ---

export async function fetchEntityTypes(): Promise<EntityTypeOption[]> {
  try {
    const response = await monitoredEntitiesClient.getEntityTypes({ pageSize: 500 });
    return (response.types ?? [])
      .map((t: any) => ({
        value: t.type,
        label: t.displayName || t.type.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  } catch (err) {
    console.error('Failed to fetch entity types:', err);
    return DEFAULT_ENTITY_TYPES;
  }
}

// --- Entity Search ---

export async function searchEntities(entityType: string, term: string): Promise<EntityReference[]> {
  if (!entityType || !term || term.length < 1) return [];
  try {
    const response = await monitoredEntitiesClient.getEntities({
      entitySelector: `type("${entityType}"),entityName.contains("${term}")`,
      from: 'now-30d',
      pageSize: 20,
    });
    return (response.entities ?? []).map((e: any) => ({
      entityId: e.entityId,
      entityType,
      displayName: e.displayName ?? e.entityId,
    }));
  } catch (err) {
    console.error('Failed to search entities:', err);
    return [];
  }
}

// --- Host Resolution (for bulk operations) ---

export async function resolveHostByName(hostName: string): Promise<EntityReference | null> {
  const makeRef = (e: any): EntityReference => ({
    entityId: e.entityId ?? 'HOST',
    entityType: 'HOST',
    displayName: e.displayName ?? e.entityId ?? 'HOST',
  });

  try {
    // Try exact match first
    let response = await monitoredEntitiesClient.getEntities({
      entitySelector: `type("HOST"),entityName.equals("${hostName}")`,
      from: 'now-30d',
      pageSize: 1,
    });
    if (response.entities?.length) return makeRef(response.entities[0]);

    // Try detected name
    response = await monitoredEntitiesClient.getEntities({
      entitySelector: `type("HOST"),detectedName.equals("${hostName}")`,
      from: 'now-30d',
      pageSize: 1,
    });
    if (response.entities?.length) return makeRef(response.entities[0]);

    // Try contains (only if single result)
    response = await monitoredEntitiesClient.getEntities({
      entitySelector: `type("HOST"),entityName.contains("${hostName}")`,
      from: 'now-30d',
      pageSize: 5,
    });
    if (response.entities?.length === 1) return makeRef(response.entities[0]);

    return null;
  } catch (err) {
    console.error(`Failed to resolve host: ${hostName}`, err);
    return null;
  }
}

// --- Entity Name Resolution ---

export async function resolveEntityNames(entityIds: string[]): Promise<Record<string, string>> {
  const map: Record<string, string> = {};
  if (entityIds.length === 0) return map;

  await Promise.all(entityIds.map(async id => {
    try {
      const response = await monitoredEntitiesClient.getEntities({
        entitySelector: `entityId("${id}")`,
        from: 'now-30d',
        pageSize: 1,
      });
      map[id] = response.entities?.[0]?.displayName ?? id;
    } catch {
      map[id] = id;
    }
  }));

  return map;
}

// --- Auto-Tagging ---

export async function createAutoTagWithRules(
  tagName: string,
  tagValue: string,
  rules: AutoTagRule[],
): Promise<string | null> {
  try {
    const payload = {
      schemaId: 'builtin:tags.auto-tagging',
      scope: 'environment',
      value: {
        name: tagName,
        description: `Auto-generated tag for maintenance window. Value: ${tagValue}. This tag can be safely deleted after the maintenance window expires.`,
        rules: rules.map(rule => ({
          type: rule.type,
          enabled: rule.enabled,
          valueFormat: rule.valueFormat,
          valueNormalization: rule.valueNormalization,
          entitySelector: rule.entitySelector,
        })),
      },
    };
    const response = await settingsObjectsClient.postSettingsObjects({ body: [payload] });
    return response?.[0]?.objectId ?? null;
  } catch (err) {
    console.error('Failed to create auto-tag:', err);
    throw err;
  }
}

export async function cleanupExpiredAutoTags(): Promise<void> {
  try {
    const response = await settingsObjectsClient.getSettingsObjects({
      schemaIds: 'builtin:tags.auto-tagging',
      pageSize: 500,
      fields: 'objectId,value',
    });

    const now = new Date();
    const tagsToDelete: string[] = [];

    (response.items ?? []).forEach((item: any) => {
      const tagName = item.value?.name ?? '';
      if (!tagName.startsWith('Maintenance — ')) return;

      (item.value?.rules ?? []).forEach((rule: any) => {
        const dateMatch = (rule.valueFormat ?? '').match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}:\d{2})/);
        if (dateMatch) {
          const expiration = new Date(`${dateMatch[1]}T${dateMatch[2]}Z`);
          if (!isNaN(expiration.getTime()) && expiration < now) {
            tagsToDelete.push(item.objectId);
          }
        }
      });
    });

    for (const objectId of tagsToDelete) {
      try {
        await settingsObjectsClient.deleteSettingsObjectByObjectId({ objectId });
        console.log(`Deleted expired auto-tag: ${objectId}`);
      } catch (err) {
        console.error(`Failed to delete auto-tag ${objectId}:`, err);
      }
    }

    if (tagsToDelete.length > 0) {
      console.log(`Cleaned up ${tagsToDelete.length} expired auto-tagging rule(s)`);
    }
  } catch (err) {
    console.error('Failed to cleanup expired auto-tags:', err);
  }
}

// --- Entity Preview ---

export async function fetchEntitiesBySelector(selector: string): Promise<PreviewEntity[]> {
  const results: PreviewEntity[] = [];
  try {
    let pageKey: string | undefined;
    do {
      const response = await monitoredEntitiesClient.getEntities({
        entitySelector: selector,
        from: 'now-30d',
        pageSize: 500,
        ...(pageKey && { nextPageKey: pageKey }),
      });
      (response.entities ?? []).forEach((e: any) => {
        results.push({
          entityId: e.entityId,
          displayName: e.displayName ?? e.entityId,
          entityType: e.type ?? e.entityId?.split('-')[0] ?? 'UNKNOWN',
        });
      });
      pageKey = response.nextPageKey;
    } while (pageKey);
  } catch (err) {
    console.error('Failed to fetch entities by selector:', err);
  }
  return results;
}

export async function fetchEntitiesForFilter(filter: EntityFilter): Promise<PreviewEntity[]> {
  const selectors = buildEntitySelectorForFilter(filter);
  if (selectors.length === 0) return [];

  const results = await Promise.all(selectors.map(s => fetchEntitiesBySelector(s).catch(() => [])));
  return dedupeEntities(results.flat());
}

export async function fetchEntitiesForAllFilters(filters: EntityFilter[]): Promise<PreviewEntity[]> {
  const results = await Promise.all(filters.map(f => fetchEntitiesForFilter(f).catch(() => [])));
  return dedupeEntities(results.flat());
}

export function dedupeEntities(entities: PreviewEntity[]): PreviewEntity[] {
  const seen = new Set<string>();
  return entities.filter(e => {
    if (seen.has(e.entityId)) return false;
    seen.add(e.entityId);
    return true;
  });
}

// --- Save Maintenance Window ---

export async function createMaintenanceWindow(payload: any): Promise<void> {
  await settingsObjectsClient.postSettingsObjects({ body: [payload] });
}