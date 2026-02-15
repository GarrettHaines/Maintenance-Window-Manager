import React, { useMemo, useState, useEffect } from 'react';
import { Divider, Flex, Container } from '@dynatrace/strato-components/layouts';
import { ProgressCircle } from '@dynatrace/strato-components/content';
import { Text } from '@dynatrace/strato-components/typography';
import { Accordion } from '@dynatrace/strato-components-preview/content';
import { Modal } from '@dynatrace/strato-components-preview/overlays';
import { DataTable } from '@dynatrace/strato-components-preview/tables';
import type { DataTableColumnDef } from '@dynatrace/strato-components-preview/tables';
import type { MaintenanceWindow, ManagementZone, EntityTypeOption, PreviewEntity } from '../types/types';
import {
  formatDateTime, formatTimestamp, formatWeekDays,
  getMaintenanceTypeLabel, getSuppressionDescription,
  getScheduleTypeLabel, getEntityTypeLabel,
  buildSelectorsFromRawFilters,
} from '../utils/helpers';
import { getTimezoneOffset, getTimezoneCity } from '../constants/timezones';
import { fetchEntitiesBySelector, resolveEntityNames, dedupeEntities } from '../api/api';

interface DetailsModalProps {
  window: MaintenanceWindow | null;
  managementZones: ManagementZone[];
  entityTypes: EntityTypeOption[];
  onClose: () => void;
}

const Field = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <Flex gap={8} className="details-field">
    <Text className="details-field-label">{label}</Text>
    <Text>{value || '—'}</Text>
  </Flex>
);

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="details-section">
    <Text className="details-section-title">{title}</Text>
    {children}
  </div>
);

const ChipGroup = ({ label, items }: { label: string; items: React.ReactNode[] }) => (
  <div className="details-filter-section">
    <Text className="details-filter-label">{label}</Text>
    <Flex flexWrap="wrap" gap={6}>{items}</Flex>
  </div>
);

const DetailChip = ({ text }: { text: string }) => (
  <span className="chip-no-buttons"><Text className="chip-text">{text}</Text></span>
);

export const DetailsModal: React.FC<DetailsModalProps> = ({
  window: mw, managementZones, entityTypes, onClose,
}) => {
  if (!mw) return null;

  const raw = mw.rawData;
  const props = raw.value?.generalProperties;
  const schedule = raw.value?.schedule;
  const filters = raw.value?.filters ?? [];
  const recurrence = schedule?.onceRecurrence ?? schedule?.dailyRecurrence
    ?? schedule?.weeklyRecurrence ?? schedule?.monthlyRecurrence;
  const tzId = recurrence?.timeZone ?? 'UTC';
  const recurrenceRange = recurrence?.recurrenceRange;

  const mzLookup = useMemo(() => {
    const map: Record<string, string> = {};
    managementZones.forEach(mz => { map[mz.id] = mz.name; });
    return map;
  }, [managementZones]);

  const displayAuthor = (() => {
    const rawAuthor = raw.author ?? '';
    if (rawAuthor.startsWith('Dynatrace support user'))
      return mw.author !== 'Unknown' ? mw.author : rawAuthor;
    return rawAuthor || mw.author || 'Unknown';
  })();

  // Entity name resolution for filter chips
  const [entityNameMap, setEntityNameMap] = useState<Record<string, string>>({});

  useEffect(() => {
    const entityIds = filters.map(f => f.entityId).filter((id): id is string => !!id);
    if (entityIds.length === 0) return;
    resolveEntityNames(entityIds).then(setEntityNameMap);
  }, [filters]);

  // Matched entities (loaded on first expand)
  const [allEntities, setAllEntities] = useState<PreviewEntity[]>([]);
  const [isLoadingEntities, setIsLoadingEntities] = useState(false);
  const [hasLoadedEntities, setHasLoadedEntities] = useState(false);

  async function loadAllEntities() {
    if (hasLoadedEntities) return;
    setIsLoadingEntities(true);
    try {
      const selectors = buildSelectorsFromRawFilters(filters, mzLookup);
      const results = await Promise.all(selectors.map(s => fetchEntitiesBySelector(s).catch(() => [])));
      setAllEntities(dedupeEntities(results.flat()));
    } catch (err) {
      console.error('Failed to load entities:', err);
      setAllEntities([]);
    } finally {
      setIsLoadingEntities(false);
      setHasLoadedEntities(true);
    }
  }

  function handleAccordionChange(expanded: (string | number)[]) {
    if (expanded.includes('entities') && !hasLoadedEntities) {
      loadAllEntities();
    }
  }

  const entityColumns: DataTableColumnDef<PreviewEntity>[] = useMemo(() => [
    { id: 'displayName', header: 'Name', accessor: 'displayName', minWidth: 200, width: '3fr' },
    { id: 'entityType', header: 'Entity type', accessor: row => getEntityTypeLabel(row.entityType, entityTypes), minWidth: 150, width: '2fr' },
    { id: 'entityId', header: 'Entity ID', accessor: 'entityId', minWidth: 200, width: '2fr' },
  ], [entityTypes]);

  return (
    <Modal show onDismiss={onClose} title="Maintenance window details" size="medium">
      <Flex flexDirection="column" className="details-modal-content">
        <Section title="General">
          <Field label="Name" value={props?.name} />
          <Field label="Description" value={mw.description || '—'} />
          <Field label="Maintenance type" value={getMaintenanceTypeLabel(props?.maintenanceType ?? '')} />
          <Field label="Suppression" value={getSuppressionDescription(props?.suppression ?? '')} />
          <Field label="Disable synthetics" value={props?.disableSyntheticMonitorExecution ? 'Yes' : 'No'} />
          <Field label="Author" value={displayAuthor} />
          <Field label="Created" value={formatTimestamp(raw.created)} />
          <Field label="Last modified" value={formatTimestamp(raw.modified)} />
          <Field label="Status" value={mw.enabled ? 'Enabled' : 'Disabled'} />
        </Section>

        <Divider />

        <Section title="Schedule">
          <Field label="Recurrence" value={getScheduleTypeLabel(schedule?.scheduleType ?? '')} />
          <Field label="Start time" value={formatDateTime(recurrence?.startTime ?? '')} />
          <Field label="End time" value={formatDateTime(recurrence?.endTime ?? '')} />
          <Field label="Timezone" value={`UTC ${getTimezoneOffset(tzId)}`} />
          <Field label="Region" value={getTimezoneCity(tzId)} />
          {schedule?.scheduleType === 'WEEKLY' && schedule.weeklyRecurrence?.selectedWeekDays && (
            <Field label="Repeats on" value={formatWeekDays(schedule.weeklyRecurrence.selectedWeekDays)} />
          )}
          {schedule?.scheduleType === 'MONTHLY' && schedule.monthlyRecurrence?.dayOfMonth && (
            <Field label="Day of month" value={schedule.monthlyRecurrence.dayOfMonth.toString()} />
          )}
          {recurrenceRange && (
            <>
              <Field label="Schedule starts" value={recurrenceRange.scheduleStartDate || '—'} />
              <Field label="Schedule ends" value={recurrenceRange.scheduleEndDate || 'Never'} />
            </>
          )}
        </Section>

        <Divider />

        <Section title="Entities">
          <Accordion multiple triggerPosition="start" showDividers={false} onExpandChange={handleAccordionChange} className="accordion">
            <Accordion.Section id="entities" as={Container}>
              <Accordion.SectionLabel className="accordion-label">Included entities</Accordion.SectionLabel>
              <Accordion.SectionContent>
                {isLoadingEntities ? (
                  <Flex justifyContent="center" alignItems="center" className="details-entities-loading">
                    <ProgressCircle />
                  </Flex>
                ) : !hasLoadedEntities ? null : allEntities.length === 0 ? (
                  <Text className="text-secondary">No entities matched, or no filters defined.</Text>
                ) : (
                  <>
                    <div className="entity-preview-count" style={{ marginBottom: 8 }}>
                      <Text className="entity-preview-count-text">
                        {allEntities.length} {allEntities.length === 1 ? 'entity' : 'entities'} are currently included in this maintenance window.
                      </Text>
                    </div>
                    <div className="details-entities-table">
                      <DataTable
                        data={allEntities}
                        columns={entityColumns}
                        variant={{ verticalDividers: true, verticalAlignment: { header: 'center', body: 'center' } }}
                        sortable
                        resizable
                      />
                    </div>
                  </>
                )}
              </Accordion.SectionContent>
            </Accordion.Section>

            <Accordion.Section id="filters" as={Container} className="accordion-filters">
              <Accordion.SectionLabel className="accordion-label">Entity filters</Accordion.SectionLabel>
              <Accordion.SectionContent>
                {filters.length === 0 ? (
                  <Text className="text-secondary">No filters defined. Applies to entire environment.</Text>
                ) : (
                  <Flex flexDirection="column" gap={12}>
                    {filters.map((filter, idx) => (
                      <div key={idx} className="details-filter-card" style={{ position: 'relative' }}>
                        <span className="details-filter-index">{idx + 1}</span>
                        {filter.entityId && (
                          <span className="details-filter-section">
                            <ChipGroup
                              label={filter.entityType ? getEntityTypeLabel(filter.entityType, entityTypes) : 'Entity'}
                              items={[<DetailChip key="e" text={entityNameMap[filter.entityId] ?? filter.entityId} />]}
                            />
                          </span>
                        )}
                        {filter.entityType && !filter.entityId && (
                          <span className="details-filter-section">
                            <ChipGroup
                              label={getEntityTypeLabel(filter.entityType, entityTypes)}
                              items={[<DetailChip key="et" text={getEntityTypeLabel(filter.entityType, entityTypes)} />]}
                            />
                          </span>
                        )}
                        {(filter.managementZones?.length ?? 0) > 0 && (
                          <span className="details-filter-section">
                            <ChipGroup
                              label="Management zones"
                              items={filter.managementZones!.map((mzId, i) => (
                                <DetailChip key={i} text={mzLookup[mzId] || mzId} />
                              ))}
                            />
                          </span>
                        )}
                        {(filter.entityTags?.length ?? 0) > 0 && (
                          <span className="details-filter-section">
                            <ChipGroup
                              label="Tags"
                              items={filter.entityTags!.map((tag, i) => <DetailChip key={i} text={tag.replace(':', ': ')} />)}
                            />
                          </span>
                        )}
                      </div>
                    ))}
                  </Flex>
                )}
              </Accordion.SectionContent>
            </Accordion.Section>
          </Accordion>
        </Section>

        <Divider />

        <Section title="API details">
          {raw.createdBy && <Field label="Author UUID" value={<span className="text-mono">{raw.createdBy}</span>} />}
          {raw.modifiedBy && <Field label="Last modifier UUID" value={<span className="text-mono">{raw.modifiedBy}</span>} />}
          <Field label="Timezone ID" value={<span className="text-mono">{tzId}</span>} />
          <Field label="Schema ID" value={<span className="text-mono">builtin:alerting.maintenance-window</span>} />
          {raw.schemaVersion && <Field label="Schema version" value={<span className="text-mono">{raw.schemaVersion}</span>} />}
          <Field label="Object ID" value={<span className="text-mono">{mw.objectId}</span>} />
        </Section>
      </Flex>
    </Modal>
  );
};