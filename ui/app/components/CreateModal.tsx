import React, { useState, useMemo, useCallback } from 'react';
import { Divider, Flex } from '@dynatrace/strato-components/layouts';
import { ProgressCircle } from '@dynatrace/strato-components/content';
import { Button } from '@dynatrace/strato-components/buttons';
import { ExternalLink, Paragraph, Text } from '@dynatrace/strato-components/typography';
import { DateTimePicker, FormField, Label, Radio, RadioGroup, Select, TextInput } from '@dynatrace/strato-components-preview/forms';
import { Modal } from '@dynatrace/strato-components-preview/overlays';
import { ChartTooltipGroupedIcon, DeleteIcon, PlusIcon, SaveIcon } from '@dynatrace/strato-icons';
import { motion, AnimatePresence } from 'framer-motion';
import { getCurrentUserDetails } from '@dynatrace-sdk/app-environment';

import type { EntityFilter, EntityTypeOption, ManagementZone, ApiFilter, AutoTagRule, PreviewEntity } from '../types/types';
import { SUPPRESSION_OPTIONS, ENTITY_TYPES_WITH_UNDERLYING } from '../constants/entityTypes';
import { TIMEZONE_OPTIONS, detectUserTimezone } from '../constants/timezones';
import { fadeElement, fadeScale } from '../constants/animations';
import {
  toApiDateTime, generateFilterId, getDefaultUnderlyingOptions,
  isFilterNonEmpty, hasUnderlyingOptionsSelected,
  buildEntitySelectorsForUnderlying, generateMaintenanceTagKey,
} from '../utils/helpers';
import {
  createAutoTagWithRules, createMaintenanceWindow,
  fetchEntitiesForFilter, fetchEntitiesForAllFilters,
  cleanupExpiredAutoTags,
} from '../api/api';

import { FilterCard } from './FilterCard';
import { BulkHostsModal } from './BulkHostsModal';
import { EntityPreviewModal } from './EntityPreviewModal';

interface CreateModalProps {
  show: boolean;
  managementZones: ManagementZone[];
  entityTypes: EntityTypeOption[];
  onClose: () => void;
  onSaved: () => void;
}

export const CreateModal: React.FC<CreateModalProps> = ({
  show, managementZones, entityTypes, onClose, onSaved,
}) => {
  const userDetails = getCurrentUserDetails();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [startDateTime, setStartDateTime] = useState<string | null>(null);
  const [endDateTime, setEndDateTime] = useState<string | null>(null);
  const [timezone, setTimezone] = useState(detectUserTimezone);
  const [suppression, setSuppression] = useState('DETECT_PROBLEMS_AND_ALERT');
  const [disableSynthetics, setDisableSynthetics] = useState('no');
  const [filters, setFilters] = useState<EntityFilter[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const [isBulkOpen, setIsBulkOpen] = useState(false);
  const [isSuccessOpen, setIsSuccessOpen] = useState(false);
  const [isErrorOpen, setIsErrorOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewTitle, setPreviewTitle] = useState('');
  const [previewNumber, setPreviewNumber] = useState(0);
  const [previewEntities, setPreviewEntities] = useState<PreviewEntity[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewEmpty, setPreviewEmpty] = useState(false);

  const hasAnyNonEmptyFilter = useMemo(() => filters.some(isFilterNonEmpty), [filters]);

  function resetForm() {
    setName(''); setDescription(''); setStartDateTime(null); setEndDateTime(null);
    setTimezone(detectUserTimezone()); setSuppression('DETECT_PROBLEMS_AND_ALERT');
    setDisableSynthetics('no'); setFilters([]);
  }

  function handleClose() { onClose(); resetForm(); }

  function validate(): string | null {
    if (!name.trim()) return 'Name is required.';
    if (!startDateTime) return 'Start time is required.';
    if (!endDateTime) return 'End time is required.';
    if (new Date(endDateTime) <= new Date(startDateTime)) return 'End time must be after start time.';
    if (filters.length === 0)
      return 'You must add at least one entity filter.<br>Without an entity filter, the maintenance window would apply to the entire environment.';
    if (filters.some(f => !isFilterNonEmpty(f)))
      return 'Each entity filter must contain at least one management zone, tag, or entity.';
    return null;
  }

  function needsAutoTagging(): boolean {
    return filters.some(f =>
      f.entities.some(e => ENTITY_TYPES_WITH_UNDERLYING.includes(e.entityType) && hasUnderlyingOptionsSelected(f.underlyingOptions))
    );
  }

  function buildAutoTagRules(tagKey: string): AutoTagRule[] {
    const rules: AutoTagRule[] = [];
    const tagValue = new Date(endDateTime!).toISOString().slice(0, 19).replace('T', ' ') + ' UTC';
    filters.forEach(filter => {
      filter.entities.forEach(entity => {
        if (ENTITY_TYPES_WITH_UNDERLYING.includes(entity.entityType) && hasUnderlyingOptionsSelected(filter.underlyingOptions)) {
          buildEntitySelectorsForUnderlying(entity, filter.underlyingOptions).forEach(({ selector }) => {
            rules.push({ type: 'SELECTOR', enabled: true, entitySelector: selector, valueFormat: tagValue, valueNormalization: 'Leave text as-is' });
          });
        }
      });
    });
    return rules;
  }

  function buildPayload(tagKey?: string) {
    const apiFilters: ApiFilter[] = [];
    const tagValue = endDateTime ? new Date(endDateTime).toISOString().slice(0, 19).replace('T', ' ') + ' UTC' : undefined;

    filters.forEach(f => {
      const baseTags = f.tags.map(t => t.value ? `${t.key}:${t.value}` : t.key);
      const baseMZs = f.managementZones.map(mz => mz.id);

      if (f.entities.length > 0) {
        f.entities.forEach(entity => {
          const needsTag = ENTITY_TYPES_WITH_UNDERLYING.includes(entity.entityType) && hasUnderlyingOptionsSelected(f.underlyingOptions);
          if (needsTag && tagKey && tagValue) {
            const uniqueTypes = [...new Set(buildEntitySelectorsForUnderlying(entity, f.underlyingOptions).map(s => s.entityType))];
            uniqueTypes.forEach(entityType => {
              apiFilters.push({ entityType, entityTags: [...baseTags, `${tagKey}:${tagValue}`], managementZones: baseMZs });
            });
          } else {
            apiFilters.push({ entityType: entity.entityType, entityId: entity.entityId, entityTags: baseTags, managementZones: baseMZs });
          }
        });
      } else {
        apiFilters.push({ entityTags: baseTags, managementZones: baseMZs });
      }
    });

    return {
      schemaId: 'builtin:alerting.maintenance-window',
      scope: 'environment',
      value: {
        enabled: true,
        generalProperties: {
          name: name.trim(),
          description: description.trim() ? `${description.trim()} [${userDetails.email}]` : `[${userDetails.email}]`,
          maintenanceType: 'PLANNED',
          suppression,
          disableSyntheticMonitorExecution: disableSynthetics === 'yes',
        },
        schedule: {
          scheduleType: 'ONCE',
          onceRecurrence: { startTime: toApiDateTime(startDateTime!), endTime: toApiDateTime(endDateTime!), timeZone: timezone },
        },
        filters: apiFilters,
      },
    };
  }

  async function handleSave() {
    const error = validate();
    if (error) { setErrorMessage(error); setIsErrorOpen(true); return; }

    setIsSaving(true);
    try {
      let tagKey: string | undefined;
      if (needsAutoTagging()) {
        tagKey = generateMaintenanceTagKey(name.trim());
        const rules = buildAutoTagRules(tagKey);
        if (rules.length > 0) {
          const tagValue = new Date(endDateTime!).toISOString().slice(0, 19).replace('T', ' ') + ' UTC';
          const autoTagId = await createAutoTagWithRules(tagKey, tagValue, rules);
          if (!autoTagId) throw new Error('Failed to create auto-tagging rule. The maintenance window was not created.');
        }
      }
      await createMaintenanceWindow(buildPayload(tagKey));
      setIsSuccessOpen(true);
      onSaved();
      await cleanupExpiredAutoTags();
    } catch (err: any) {
      setErrorMessage(err?.body?.message ?? err?.message ?? 'Failed to create maintenance window.');
      setIsErrorOpen(true);
    } finally {
      setIsSaving(false);
    }
  }

  const addFilter = useCallback(() => {
    setFilters(prev => [...prev, {
      id: generateFilterId(), managementZones: [], tags: [], entities: [],
      underlyingOptions: getDefaultUnderlyingOptions(),
    }]);
  }, []);

  const updateFilter = useCallback((updated: EntityFilter) => {
    setFilters(prev => prev.map(f => f.id === updated.id ? updated : f));
  }, []);

  const removeFilter = useCallback((id: string) => {
    setFilters(prev => prev.filter(f => f.id !== id));
  }, []);

  async function openFilterPreview(filter: EntityFilter, idx: number) {
    setPreviewTitle(`Matched entities`);
    setPreviewNumber(idx + 1);
    setPreviewEmpty(!isFilterNonEmpty(filter));
    setPreviewEntities([]);
    setPreviewOpen(true);
    if (!isFilterNonEmpty(filter)) { setPreviewLoading(false); return; }
    setPreviewLoading(true);
    try { setPreviewEntities(await fetchEntitiesForFilter(filter)); }
    catch { setPreviewEntities([]); }
    finally { setPreviewLoading(false); }
  }

  async function openAllEntitiesPreview() {
    setPreviewTitle('All matched entities');
    setPreviewNumber(-1);
    setPreviewEmpty(false);
    setPreviewEntities([]);
    setPreviewOpen(true);
    setPreviewLoading(true);
    try {
      const entities = await fetchEntitiesForAllFilters(filters.filter(isFilterNonEmpty));
      setPreviewEntities(entities);
      setPreviewEmpty(entities.length === 0);
    } catch {
      setPreviewEntities([]);
      setPreviewEmpty(true);
    } finally {
      setPreviewLoading(false);
    }
  }

  function handleDateTimeChange(setter: (v: string | null) => void) {
    return (val: any) => setter(val === null ? null : typeof val === 'string' ? val : val?.value ?? null);
  }

  return (
    <>
      <Modal show={show} onDismiss={handleClose} title="New maintenance window" size="large" className="modal-with-footer">
        <Flex flexDirection="column" className="modal-body">
          <motion.div className="modal-scroll-area" layoutScroll>
            <Flex flexDirection="column" gap={24}>
              <Flex gap={16} className="form-row-offset">
                <FormField className="form-field-half">
                  <Label className="form-label">Name</Label>
                  <TextInput value={name} onChange={setName} placeholder="Enter a name" />
                </FormField>
                <FormField className="form-field-half">
                  <Label className="form-label">Description <span className="optional-text">(optional)</span></Label>
                  <TextInput value={description} onChange={setDescription} placeholder="Enter any details" />
                </FormField>
              </Flex>

              <Flex gap={16}>
                <FormField className="form-field-date">
                  <Label className="form-label">Start</Label>
                  <DateTimePicker value={startDateTime} onChange={handleDateTimeChange(setStartDateTime)} />
                </FormField>
                <FormField className="form-field-date">
                  <Label className="form-label">End</Label>
                  <DateTimePicker value={endDateTime} onChange={handleDateTimeChange(setEndDateTime)} />
                </FormField>
                <FormField className="form-field-tz">
                  <Label className="form-label">Time zone</Label>
                  <Select value={timezone} onChange={val => setTimezone(val as string)}>
                    <Select.Trigger className="select-trigger-full" />
                    <Select.Content className="select-content-tz">
                      {TIMEZONE_OPTIONS.map(tz => (
                        <Select.Option key={tz.id} value={tz.id}>
                          <Flex justifyContent="space-between" alignContent="center" className="tz-option-content">
                            <Paragraph>UTC {tz.offset}</Paragraph><Paragraph>{tz.city}</Paragraph>
                          </Flex>
                        </Select.Option>
                      ))}
                    </Select.Content>
                  </Select>
                </FormField>
                <FormField className="form-field-recurrence">
                  <Label className="form-label">Recurrence</Label>
                  <Select value="once">
                    <Select.Trigger className="select-trigger-full" />
                    <Select.Content className="select-content-recurrence">
                      <Select.Option value="once"><Paragraph>Once</Paragraph></Select.Option>
                      <Select.Option value="daily" disabled><Paragraph>Daily</Paragraph></Select.Option>
                      <Select.Option value="weekly" disabled><Paragraph>Weekly</Paragraph></Select.Option>
                      <Select.Option value="monthly" disabled><Paragraph>Monthly</Paragraph></Select.Option>
                    </Select.Content>
                  </Select>
                </FormField>
              </Flex>

              <div className="suppression-row">
                <FormField className="form-field-suppression">
                  <Label className="form-label">Problem detection and alerting</Label>
                  <RadioGroup value={suppression} onChange={setSuppression}>
                    <Flex gap={24}>{SUPPRESSION_OPTIONS.map(opt => <Radio key={opt.value} value={opt.value}>{opt.label}</Radio>)}</Flex>
                  </RadioGroup>
                </FormField>
                <FormField className="form-field-synthetics">
                  <Label className="form-label">Disable synthetic monitors</Label>
                  <RadioGroup value={disableSynthetics} onChange={setDisableSynthetics}>
                    <Flex gap={24}><Radio value="no">No</Radio><Radio value="yes">Yes</Radio></Flex>
                  </RadioGroup>
                </FormField>
              </div>

              <Divider />

              <div>
                <Text className="form-label">Entities</Text>
                <span className="filter-section-hint">
                  Add monitored entities to your maintenance window using filters. A filter can include a specific entity, or it can include groups of entities using management zones, tags, or both. Entities must meet all conditions of a filter to be included in your maintenance window.
                </span>
                <div className="filter-cards-container">
                  <AnimatePresence initial={false}>
                    {filters.length === 0 && (
                      <motion.div key="empty-placeholder" {...fadeElement}>
                        <div className="empty-filter-placeholder">
                          <Text className="text-hint">No entities added. Add entity filters to specify which entities will be included in your maintenance window.</Text>
                        </div>
                      </motion.div>
                    )}
                    {filters.map((filter, index) => (
                      <motion.div key={filter.id} {...fadeElement}>
                        <motion.div className="filter-card-anim-inner" layout="position" {...fadeElement}>
                          <FilterCard
                            filter={filter}
                            index={index}
                            entityTypes={entityTypes}
                            managementZones={managementZones}
                            onRemove={() => removeFilter(filter.id)}
                            onUpdate={updateFilter}
                            onPreview={() => openFilterPreview(filter, index)}
                          />
                        </motion.div>
                      </motion.div>
                    ))}
                  </AnimatePresence>

                  <Flex gap={8}>
                    <Button variant="emphasized" size="condensed" color="primary" onClick={addFilter} className="btn-add-group">
                      <PlusIcon size="small" className="icon-btn-small" /><Text> Add entity filter</Text>
                    </Button>
                    <Button variant="emphasized" size="condensed" color="primary" onClick={() => setIsBulkOpen(true)} className="btn-add-group">
                      <PlusIcon size="small" className="icon-btn-small" /><Text> Add hosts in bulk</Text>
                    </Button>
                    <AnimatePresence>
                      {hasAnyNonEmptyFilter && (
                        <motion.div {...fadeScale}>
                          <Button variant="emphasized" size="condensed" onClick={openAllEntitiesPreview} className="btn-add-group">
                            <ChartTooltipGroupedIcon size="small" className="icon-btn-small" /><Text> View all matched entities</Text>
                          </Button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </Flex>
                </div>
              </div>
            </Flex>
          </motion.div>

          <Flex justifyContent="space-between" alignItems="center" className="modal-footer">
            <Flex className="modal-footer-link">
              <ExternalLink className="footer-link-text" href="https://docs.dynatrace.com/docs/analyze-explore-automate/notifications-and-alerting/maintenance-windows">
                Learn more about maintenance windows
              </ExternalLink>
            </Flex>
            <Flex justifyContent="flex-end" gap={12} className="modal-footer-buttons">
              <Button variant="emphasized" onClick={handleClose}>
                <Flex gap={4}><DeleteIcon className="icon-btn-large" /><Text textStyle="base-emphasized" className="btn-large-text">Discard</Text></Flex>
              </Button>
              <Button variant="accent" color="primary" onClick={handleSave} disabled={isSaving}>
                <Flex gap={4}>
                  <SaveIcon className="icon-btn-large" />
                  <Text textStyle="base-emphasized" className="btn-large-text">{isSaving ? <ProgressCircle size="small" /> : 'Save'}</Text>
                </Flex>
              </Button>
            </Flex>
          </Flex>
        </Flex>
      </Modal>

      {/* Success Modal */}
      <Modal show={isSuccessOpen} onDismiss={() => setIsSuccessOpen(false)} title="Success">
        <Flex flexDirection="column" padding={16} gap={16}>
          <Paragraph>Maintenance window created successfully!</Paragraph>
          <Flex justifyContent="flex-end" gap={8}>
            <Button variant="default" onClick={() => { setIsSuccessOpen(false); resetForm(); }}>Create Another</Button>
            <Button variant="accent" color="primary" onClick={() => { setIsSuccessOpen(false); handleClose(); }}>Done</Button>
          </Flex>
        </Flex>
      </Modal>

      {/* Error Modal */}
      <Modal show={isErrorOpen} onDismiss={() => setIsErrorOpen(false)} title="Error">
        <Flex flexDirection="column" padding={16} gap={16}>
          <Text><div dangerouslySetInnerHTML={{ __html: errorMessage }} /></Text>
          <Flex justifyContent="flex-end"><Button variant="accent" color="primary" onClick={() => setIsErrorOpen(false)}>OK</Button></Flex>
        </Flex>
      </Modal>

      {/* Bulk Hosts Modal */}
      <BulkHostsModal
        show={isBulkOpen}
        managementZones={managementZones}
        onClose={() => setIsBulkOpen(false)}
        onAddFilters={newFilters => setFilters(prev => [...prev, ...newFilters])}
      />

      {/* Entity Preview Modal */}
      <EntityPreviewModal
        show={previewOpen}
        title={previewTitle}
        filterNumber={previewNumber}
        entities={previewEntities}
        isLoading={previewLoading}
        isEmpty={previewEmpty}
        entityTypes={entityTypes}
        onClose={() => { setPreviewOpen(false); setPreviewEntities([]); setPreviewLoading(false); setPreviewEmpty(false); }}
      />
    </>
  );
};