import React, { useState, useMemo } from 'react';
import { Flex } from '@dynatrace/strato-components/layouts';
import { ProgressCircle } from '@dynatrace/strato-components/content';
import { Button } from '@dynatrace/strato-components/buttons';
import { Paragraph, Text } from '@dynatrace/strato-components/typography';
import { Checkbox, Select, TextInput } from '@dynatrace/strato-components-preview/forms';
import { CheckmarkIcon, DeleteIcon, EditIcon, ChartTooltipGroupedIcon, PlusIcon, XmarkIcon } from '@dynatrace/strato-icons';
import { motion, AnimatePresence } from 'framer-motion';
import type { EntityFilter, EntityReference, EntityTypeOption, ManagementZone, UnderlyingOptions } from '../types/types';
import { QUICK_ENTITY_TYPES, ENTITY_TYPES_WITH_UNDERLYING } from '../constants/entityTypes';
import { fadeIn, fadeElement, chipCollapse, ANIM_DURATION, ANIM_EASING } from '../constants/animations';
import { getEntityTypeLabel } from '../utils/helpers';
import { useAnimatedRemove, useEntitySearch } from '../hooks/hooks';
import { Chip } from './Chip';

interface FilterCardProps {
  filter: EntityFilter;
  index: number;
  entityTypes: EntityTypeOption[];
  managementZones: ManagementZone[];
  onRemove: () => void;
  onUpdate: (updated: EntityFilter) => void;
  onPreview: () => void;
}

export const FilterCard: React.FC<FilterCardProps> = ({
  filter, index, entityTypes, managementZones, onRemove, onUpdate, onPreview,
}) => {
  const { exitingIds, triggerRemove } = useAnimatedRemove(ANIM_DURATION * 1000);

  // Which editor is open (only one at a time)
  const [activeEditor, setActiveEditor] = useState<'mz' | 'tag' | 'entity' | null>(null);

  // MZ editor state
  const [pendingMZ, setPendingMZ] = useState('');

  // Tag editor state
  const [pendingTagKey, setPendingTagKey] = useState('');
  const [pendingTagValue, setPendingTagValue] = useState('');

  // Entity editor state
  const [entityQuickSelect, setEntityQuickSelect] = useState<string | null>(null);
  const [pendingEntityType, setPendingEntityType] = useState('');
  const [entityTypeSearchTerm, setEntityTypeSearchTerm] = useState('');
  const [pendingEntitySearch, setPendingEntitySearch] = useState('');
  const [selectedEntity, setSelectedEntity] = useState<EntityReference | null>(null);

  const { results: entitySearchResults, isSearching, setResults: setEntitySearchResults } = useEntitySearch(pendingEntityType, pendingEntitySearch);

  const filteredEntityTypes = useMemo(() => {
    if (!entityTypeSearchTerm) return entityTypes;
    const term = entityTypeSearchTerm.toLowerCase();
    return entityTypes.filter(et => et.label.toLowerCase().includes(term) || et.value.toLowerCase().includes(term));
  }, [entityTypes, entityTypeSearchTerm]);

  const primaryEntityType = filter.entities.length > 0 ? filter.entities[0].entityType : null;

  // --- Editor open/close ---

  function openEditor(type: 'mz' | 'tag' | 'entity') {
    setActiveEditor(type);
    if (type === 'entity') {
      setEntityQuickSelect(null);
      setPendingEntityType('');
      setEntityTypeSearchTerm('');
      setPendingEntitySearch('');
      setEntitySearchResults([]);
      setSelectedEntity(null);
    }
  }

  function closeEditorAnimated(editorKey: string, cleanup: () => void) {
    triggerRemove(editorKey, () => { cleanup(); setActiveEditor(null); });
  }

  function closeMZEditor() { closeEditorAnimated(`mz-editor-${filter.id}`, () => setPendingMZ('')); }
  function closeTagEditor() { closeEditorAnimated(`tag-editor-${filter.id}`, () => { setPendingTagKey(''); setPendingTagValue(''); }); }
  function closeEntityEditor() { closeEditorAnimated(`entity-editor-${filter.id}`, () => clearEntityState()); }

  function clearEntityState() {
    setSelectedEntity(null);
    setPendingEntityType('');
    setPendingEntitySearch('');
    setEntitySearchResults([]);
    setEntityTypeSearchTerm('');
    setEntityQuickSelect(null);
  }

  // --- Filter mutations (call onUpdate to push changes up) ---

  function addMZ() {
    if (!pendingMZ) return;
    const zone = managementZones.find(mz => mz.id === pendingMZ);
    if (!zone || filter.managementZones.some(mz => mz.id === pendingMZ)) return;
    onUpdate({ ...filter, managementZones: [...filter.managementZones, zone] });
    setPendingMZ('');
    setActiveEditor(null);
  }

  function addTag() {
    if (!pendingTagKey.trim()) return;
    onUpdate({ ...filter, tags: [...filter.tags, { key: pendingTagKey.trim(), value: pendingTagValue.trim() || undefined }] });
    setPendingTagKey('');
    setPendingTagValue('');
    setActiveEditor(null);
  }

  function addEntity() {
    if (!selectedEntity || filter.entities.some(e => e.entityId === selectedEntity.entityId)) return;
    onUpdate({ ...filter, entities: [...filter.entities, selectedEntity] });
    clearEntityState();
    setActiveEditor(null);
  }

  function removeEntity(entityId: string) {
    const remaining = filter.entities.filter(e => e.entityId !== entityId);
    onUpdate({
      ...filter,
      entities: remaining,
      underlyingOptions: remaining.length === 0
        ? { includeProcesses: false, includeServices: false, includeHosts: false, includeProcessGroups: false }
        : filter.underlyingOptions,
    });
  }

  function updateUnderlying(option: keyof UnderlyingOptions, value: boolean) {
    onUpdate({ ...filter, underlyingOptions: { ...filter.underlyingOptions, [option]: value } });
  }

  // --- Animation helpers ---

  function getEditorAnimProps(id: string) {
    const isExiting = exitingIds.has(id);
    return {
      ...fadeElement,
      animate: isExiting
        ? { opacity: 0, height: 0, padding: 0, transition: { duration: ANIM_DURATION, ease: ANIM_EASING } }
        : fadeElement.animate,
    };
  }

  function handleEntityQuickSelect(value: string) {
    setEntityQuickSelect(value);
    if (value !== 'OTHER') {
      setPendingEntityType(value);
      setEntityTypeSearchTerm(getEntityTypeLabel(value, entityTypes));
      setPendingEntitySearch('');
      setEntitySearchResults([]);
      setSelectedEntity(null);
    } else {
      setPendingEntityType('');
      setEntityTypeSearchTerm('');
      setPendingEntitySearch('');
      setEntitySearchResults([]);
      setSelectedEntity(null);
    }
  }

  // --- Underlying options checkboxes ---

  function renderUnderlyingOptions(entityType: string) {
    if (!ENTITY_TYPES_WITH_UNDERLYING.includes(entityType)) return null;
    const opts = filter.underlyingOptions;

    const checkboxes: Record<string, React.ReactNode> = {
      HOST: (
        <>
          <Checkbox name={`${filter.id}-proc`} value={opts.includeProcesses} onChange={v => updateUnderlying('includeProcesses', v)} className="entity-checkbox-1">Include its processes</Checkbox>
          <Checkbox name={`${filter.id}-svc`} value={opts.includeServices} onChange={v => updateUnderlying('includeServices', v)} className="entity-checkbox-2">Include its services</Checkbox>
        </>
      ),
      HOST_GROUP: (
        <>
          <Checkbox name={`${filter.id}-host`} value={opts.includeHosts} onChange={v => updateUnderlying('includeHosts', v)} className="entity-checkbox-1">Include its hosts</Checkbox>
          <Checkbox name={`${filter.id}-proc`} value={opts.includeProcesses} onChange={v => updateUnderlying('includeProcesses', v)} className="entity-checkbox-2">Include its processes</Checkbox>
          <Checkbox name={`${filter.id}-svc`} value={opts.includeServices} onChange={v => updateUnderlying('includeServices', v)} className="entity-checkbox-2">Include its services</Checkbox>
        </>
      ),
      PROCESS_GROUP: (
        <>
          <Checkbox name={`${filter.id}-host`} value={opts.includeHosts} onChange={v => updateUnderlying('includeHosts', v)} className="entity-checkbox-1">Include its hosts</Checkbox>
          <Checkbox name={`${filter.id}-svc`} value={opts.includeServices} onChange={v => updateUnderlying('includeServices', v)} className="entity-checkbox-2">Include its services</Checkbox>
        </>
      ),
      SERVICE: (
        <>
          <Checkbox name={`${filter.id}-host`} value={opts.includeHosts} onChange={v => updateUnderlying('includeHosts', v)} className="entity-checkbox-1">Include its hosts</Checkbox>
          <Checkbox name={`${filter.id}-pg`} value={opts.includeProcessGroups} onChange={v => updateUnderlying('includeProcessGroups', v)} className="entity-checkbox-2">Include its process groups</Checkbox>
        </>
      ),
    };

    return <div className="underlying-options-container">{checkboxes[entityType]}</div>;
  }

  // --- Render ---

  const isEditingMZ = activeEditor === 'mz';
  const isEditingTag = activeEditor === 'tag';
  const isEditingEntity = activeEditor === 'entity';
  const mzEditorId = `mz-editor-${filter.id}`;
  const tagEditorId = `tag-editor-${filter.id}`;
  const entityEditorId = `entity-editor-${filter.id}`;

  return (
    <motion.div className="filter-card-outer" layout="position" transition={{ layout: { duration: 0.2, ease: [0.4, 0, 0.2, 1] } }}>
      {/* Sidebar */}
      <motion.div className="filter-card-sidebar" layout="position">
        <Button onClick={onPreview} className="filter-card-sidebar-button" aria-label="View matched entities" variant="emphasized">
          <ChartTooltipGroupedIcon size="small" />
        </Button>
        <Button onClick={onRemove} className="filter-card-sidebar-button" variant="emphasized">
          <DeleteIcon size="small" />
        </Button>
      </motion.div>

      <motion.div className="filter-card-wrapper" layout="position">
        {/* Column headers */}
        <motion.div className="filter-cards-header" layout="position">
          <Text className="filter-cards-header-label">Entity</Text>
          <Text className="filter-cards-header-label">Management zones</Text>
          <Flex justifyContent="space-between">
            <Text className="filter-cards-header-label">Tags</Text>
            <div className="filter-card-index">{index + 1}</div>
          </Flex>
        </motion.div>

        <motion.div className="filter-card" layout="position">
          {/* ── Entity column ── */}
          <motion.div className="filter-card-column" layout="position">
            <AnimatePresence initial={false} mode="popLayout">
              <motion.div className="filter-chip-container-vertical" {...fadeElement} layout="position">
                <AnimatePresence mode="popLayout" initial={false}>
                  {/* Add button (no entities yet, not editing) */}
                  {!isEditingEntity && filter.entities.length === 0 && (
                    <motion.div key="entity-add-btn" {...fadeElement} className="filter-chips-wrap" layout="position">
                      <Button variant="emphasized" color="primary" className="btn-inline" onClick={() => openEditor('entity')}>
                        <PlusIcon size="small" />
                      </Button>
                      <Text className="filter-inline-text">Filter by entity</Text>
                    </motion.div>
                  )}

                  {/* Entity chips */}
                  {filter.entities.length > 0 && (
                    <motion.div key="entity-chips" {...fadeIn} className="filter-chips-wrap-vertical" layout>
                      <AnimatePresence mode="popLayout">
                        {filter.entities.map(entity => (
                          <motion.div key={entity.entityId} {...chipCollapse} className="entity-chip-container" layout>
                            <Chip
                              label={`${getEntityTypeLabel(entity.entityType, entityTypes)}: ${entity.displayName}`}
                              onRemove={() => removeEntity(entity.entityId)}
                            />
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </motion.div>
                  )}

                  {/* Entity editor */}
                  {filter.entities.length === 0 && isEditingEntity && (
                    <motion.div key="entity-editor" {...getEditorAnimProps(entityEditorId)} className="entity-type-editor" layout="position">
                      <AnimatePresence mode="popLayout">
                        {/* Quick select dropdown */}
                        {!entityQuickSelect && (
                          <motion.div key="quick-select" {...fadeElement} layout="position">
                            <Flex gap={6} alignItems="center">
                              <div className="input-entity-quick-select">
                                <Select value={entityQuickSelect ?? ''} onChange={val => handleEntityQuickSelect(val as string)}>
                                  <Select.Trigger placeholder="Select entity type" className="select-trigger-full" />
                                  <Select.Content className="select-content-entity-quick">
                                    {QUICK_ENTITY_TYPES.map(et => (
                                      <Select.Option key={et.value} value={et.value}><Paragraph>{et.label}</Paragraph></Select.Option>
                                    ))}
                                  </Select.Content>
                                </Select>
                              </div>
                              <Button onClick={closeEntityEditor} variant="emphasized" color="critical" size="condensed" className="btn-inline">
                                <XmarkIcon className="icon-adjust" size="small" />
                              </Button>
                            </Flex>
                          </motion.div>
                        )}

                        {/* "Other" type search */}
                        {entityQuickSelect === 'OTHER' && !pendingEntityType && (
                          <motion.div key="other-search" {...fadeElement} className="entity-type-search-container" layout="position">
                            <AnimatePresence mode="popLayout">
                              <motion.div className="entity-type-search-row" {...fadeElement} layout="position">
                                <TextInput value={entityTypeSearchTerm} onChange={setEntityTypeSearchTerm} placeholder="Search entity types..." className="text-input-flex" />
                                <Button onClick={closeEntityEditor} variant="emphasized" color="critical" size="condensed" className="btn-inline">
                                  <XmarkIcon className="icon-adjust" size="small" />
                                </Button>
                              </motion.div>
                              <motion.div className="entity-type-dropdown" {...fadeElement} layout="position">
                                {filteredEntityTypes.length > 0 ? (
                                  filteredEntityTypes.map(et => (
                                    <div key={et.value} className="entity-type-option" onClick={() => {
                                      setPendingEntityType(et.value);
                                      setEntityTypeSearchTerm(et.label);
                                      setPendingEntitySearch('');
                                      setEntitySearchResults([]);
                                      setSelectedEntity(null);
                                    }}>
                                      <span className="entity-type-option-label">{et.label}</span>
                                      <span className="entity-type-option-id">{et.value}</span>
                                    </div>
                                  ))
                                ) : (
                                  <div className="no-results-message">No matching entity types.</div>
                                )}
                              </motion.div>
                            </AnimatePresence>
                          </motion.div>
                        )}

                        {/* Entity name search (type selected) */}
                        {pendingEntityType && (
                          <motion.div key="entity-search" {...fadeElement} layout="position">
                            <AnimatePresence mode="popLayout">
                              {!selectedEntity && (
                                <motion.div {...fadeElement} layout="position">
                                  <Flex flexDirection="column" gap={6} className="entity-search-wrapper">
                                    <Flex gap={6} alignItems="center" className="entity-search-wrapper" flex={1}>
                                      <span className="chip-editing">
                                        <Flex justifyContent="space-between" gap={12} flex={1}>
                                          <Flex><span className="chip-text-entity-type">{entityTypeSearchTerm}</span></Flex>
                                          <Flex justifyContent="flex-end">
                                            <Button onClick={() => {
                                              setPendingEntityType('');
                                              setEntityTypeSearchTerm('');
                                              setPendingEntitySearch('');
                                              setEntitySearchResults([]);
                                              setSelectedEntity(null);
                                              if (entityQuickSelect !== 'OTHER') setEntityQuickSelect(null);
                                            }} size="condensed" className="chip-edit">
                                              <EditIcon size="small" />
                                            </Button>
                                          </Flex>
                                        </Flex>
                                      </span>
                                      <Button onClick={closeEntityEditor} variant="emphasized" color="critical" size="condensed" className="btn-inline">
                                        <XmarkIcon className="icon-adjust" size="small" />
                                      </Button>
                                    </Flex>
                                    <div className="input-entity-search">
                                      <TextInput value={pendingEntitySearch} onChange={val => { setPendingEntitySearch(val); setSelectedEntity(null); }} placeholder="Search by name..." />
                                      {isSearching && <div className="spinner-overlay"><ProgressCircle size="small" /></div>}
                                    </div>
                                  </Flex>
                                </motion.div>
                              )}

                              {entitySearchResults.length > 0 && !selectedEntity && (
                                <motion.div className="entity-search-dropdown" {...fadeElement} layout="position">
                                  {entitySearchResults.map(entity => (
                                    <div key={entity.entityId} className="entity-search-option" onClick={() => setSelectedEntity(entity)}>
                                      <span className="entity-search-name">{entity.displayName}</span>
                                      <span className="entity-search-id">{entity.entityId}</span>
                                    </div>
                                  ))}
                                </motion.div>
                              )}

                              {pendingEntitySearch.length >= 1 && !isSearching && entitySearchResults.length === 0 && !selectedEntity && (
                                <motion.div {...fadeElement} layout="position" className="entity-not-found">
                                  <Text className="text-small-secondary">No entities found.</Text>
                                </motion.div>
                              )}

                              {selectedEntity && (
                                <motion.div {...fadeElement} layout="position">
                                  <Flex gap={6} alignItems="center">
                                      <div className="chip-no-buttons-wide">
                                        <Text className="chip-text">
                                          {getEntityTypeLabel(selectedEntity.entityType, entityTypes)}: {selectedEntity.displayName}
                                        </Text>
                                      </div>
                                    <Button onClick={addEntity} variant="emphasized" color="success" size="condensed" className="btn-inline">
                                      <CheckmarkIcon className="icon-adjust" size="small" />
                                    </Button>
                                    <Button onClick={() => { setSelectedEntity(null); setPendingEntitySearch(''); }} variant="emphasized" color="critical" size="condensed" className="btn-inline">
                                      <XmarkIcon className="icon-adjust" size="small" />
                                    </Button>
                                  </Flex>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  )}
                </AnimatePresence>

                {filter.entities.length > 0 && primaryEntityType && renderUnderlyingOptions(primaryEntityType)}
              </motion.div>
            </AnimatePresence>
          </motion.div>

          {/* ── Management Zones column ── */}
          <motion.div className="filter-card-column" layout="position">
            <AnimatePresence initial={false} mode="popLayout">
              <motion.div className="filter-chip-container-vertical" {...fadeElement} layout="position">
                <AnimatePresence mode="popLayout">
                  {filter.managementZones.length > 0 && (
                    <motion.div className="filter-chips-wrap" {...fadeElement} layout="position">
                      <AnimatePresence initial={false} mode="popLayout">
                        {filter.managementZones.map(mz => (
                          <motion.span key={mz.id} {...chipCollapse} layout>
                            <Chip label={mz.name} onRemove={() => onUpdate({ ...filter, managementZones: filter.managementZones.filter(m => m.id !== mz.id) })} />
                          </motion.span>
                        ))}
                        {!isEditingMZ && (
                          <motion.span key="mz-inline-plus" {...fadeIn} layout>
                            <Button variant="emphasized" color="primary" className="btn-inline" onClick={() => openEditor('mz')}>
                              <PlusIcon size="small" />
                            </Button>
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  )}

                  {!isEditingMZ && filter.managementZones.length === 0 && (
                    <motion.div key="mz-add-btn" {...fadeElement} layout="position" className="filter-chips-wrap">
                      <Button variant="emphasized" color="primary" className="btn-inline" onClick={() => openEditor('mz')}>
                        <PlusIcon size="small" />
                      </Button>
                      <Text className="filter-inline-text">Filter by management zone</Text>
                    </motion.div>
                  )}

                  {isEditingMZ && (
                    <motion.div key="mz-editor" {...getEditorAnimProps(mzEditorId)} layout="position" className={filter.managementZones.length > 0 ? 'mz-editor' : 'mz-editor-first'}>
                      <Flex gap={6} alignItems="center" className="filter-add-row">
                        <div className="input-mz">
                          <Select value={pendingMZ} onChange={val => setPendingMZ(val as string)}>
                            <Select.Trigger placeholder="Select a zone" className="select-trigger-truncate" />
                            <Select.Content className="select-content-mz">
                              {managementZones.map(mz => (
                                <Select.Option key={mz.id} value={mz.id}>
                                  <span className="select-option-truncate">{mz.name}</span>
                                </Select.Option>
                              ))}
                            </Select.Content>
                          </Select>
                        </div>
                        <Button onClick={addMZ} variant="emphasized" color="success" size="condensed" className="btn-inline">
                          <CheckmarkIcon className="icon-adjust" size="small" />
                        </Button>
                        <Button onClick={closeMZEditor} variant="emphasized" color="critical" size="condensed" className="btn-inline">
                          <XmarkIcon className="icon-adjust" size="small" />
                        </Button>
                      </Flex>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            </AnimatePresence>
          </motion.div>

          {/* ── Tags column ── */}
          <motion.div className="filter-card-column" layout="position">
            <AnimatePresence initial={false} mode="popLayout">
              <motion.div className="filter-chip-container-vertical" {...fadeElement} layout="position">
                {filter.tags.length > 0 && (
                  <motion.div className="filter-chips-wrap" layout>
                    <AnimatePresence initial={false} mode="popLayout">
                      {filter.tags.map((tag, idx) => (
                        <motion.span key={`${tag.key}-${idx}`} {...chipCollapse} layout>
                          <Chip
                            label={tag.value ? `${tag.key}: ${tag.value}` : tag.key}
                            onRemove={() => onUpdate({ ...filter, tags: filter.tags.filter((_, i) => i !== idx) })}
                          />
                        </motion.span>
                      ))}
                    </AnimatePresence>
                    <AnimatePresence initial={false} mode="popLayout">
                      {!isEditingTag && (
                        <motion.span key="tag-inline-plus" {...fadeIn} layout>
                          <Button variant="emphasized" color="primary" className="btn-inline" onClick={() => openEditor('tag')}>
                            <PlusIcon size="small" />
                          </Button>
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </motion.div>
                )}

                <AnimatePresence initial={false} mode="popLayout">
                  {!isEditingTag && filter.tags.length === 0 && (
                    <motion.div key="tag-add-btn" {...fadeElement} className="filter-chips-wrap" layout="position">
                      <Button variant="emphasized" color="primary" className="btn-inline" onClick={() => openEditor('tag')}>
                        <PlusIcon size="small" />
                      </Button>
                      <Text className="filter-inline-text">Filter by tag</Text>
                    </motion.div>
                  )}

                  {isEditingTag && (
                    <motion.div key="tag-editor" {...getEditorAnimProps(tagEditorId)} layout="position" className={filter.tags.length > 0 ? 'tag-editor' : undefined}>
                      <Flex gap={6} alignItems="center" className="filter-add-row">
                        <div className="input-tag">
                          <TextInput value={pendingTagKey} onChange={setPendingTagKey} placeholder="Key" />
                        </div>
                        <div className="input-tag">
                          <TextInput value={pendingTagValue} onChange={setPendingTagValue} placeholder="Value" />
                        </div>
                        <Button onClick={addTag} variant="emphasized" color="success" size="condensed" className="btn-inline">
                          <CheckmarkIcon className="icon-adjust" size="small" />
                        </Button>
                        <Button onClick={closeTagEditor} variant="emphasized" color="critical" size="condensed" className="btn-inline">
                          <XmarkIcon className="icon-adjust" size="small" />
                        </Button>
                      </Flex>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            </AnimatePresence>
          </motion.div>
        </motion.div>
      </motion.div>
    </motion.div>
  );
};