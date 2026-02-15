import React, { useState } from 'react';
import { Divider, Flex } from '@dynatrace/strato-components/layouts';
import { ProgressCircle } from '@dynatrace/strato-components/content';
import { Button } from '@dynatrace/strato-components/buttons';
import { Text } from '@dynatrace/strato-components/typography';
import { Checkbox, Label, TextArea, TextInput } from '@dynatrace/strato-components-preview/forms';
import { Select } from '@dynatrace/strato-components-preview/forms';
import { Modal } from '@dynatrace/strato-components-preview/overlays';
import { PlusIcon } from '@dynatrace/strato-icons';
import { motion, AnimatePresence } from 'framer-motion';
import type { ManagementZone, EntityReference, EntityFilter } from '../types/types';
import { fadeScale, expandCollapse, chipCollapse } from '../constants/animations';
import { generateFilterId, getDefaultUnderlyingOptions } from '../utils/helpers';
import { resolveHostByName } from '../api/api';
import { Chip } from './Chip';

interface BulkHostsModalProps {
  show: boolean;
  managementZones: ManagementZone[];
  onClose: () => void;
  onAddFilters: (filters: EntityFilter[]) => void;
}

function parseHostsList(input: string): string[] {
  const hosts = input.split(/[,\s]+/).map(h => h.trim()).filter(h => h.length > 0);
  return [...new Set(hosts)];
}

export const BulkHostsModal: React.FC<BulkHostsModalProps> = ({
  show, managementZones, onClose, onAddFilters,
}) => {
  const [hostsInput, setHostsInput] = useState('');
  const [includeProcesses, setIncludeProcesses] = useState(false);
  const [includeServices, setIncludeServices] = useState(false);
  const [mzs, setMzs] = useState<ManagementZone[]>([]);
  const [tags, setTags] = useState<{ id: string; key: string; value?: string }[]>([]);
  const [pendingMZ, setPendingMZ] = useState('');
  const [pendingTagKey, setPendingTagKey] = useState('');
  const [pendingTagValue, setPendingTagValue] = useState('');
  const [isResolving, setIsResolving] = useState(false);
  const [error, setError] = useState('');
  const [validationResults, setValidationResults] = useState<{ valid: EntityReference[]; invalid: string[] } | null>(null);
  const [showValidation, setShowValidation] = useState(false);

  function reset() {
    setHostsInput(''); setIncludeProcesses(false); setIncludeServices(false);
    setMzs([]); setTags([]); setPendingMZ(''); setPendingTagKey('');
    setPendingTagValue(''); setError('');
  }

  function handleClose() { reset(); onClose(); }

  function addMZ() {
    if (!pendingMZ) return;
    const zone = managementZones.find(mz => mz.id === pendingMZ);
    if (!zone || mzs.some(mz => mz.id === pendingMZ)) return;
    setMzs(prev => [...prev, zone]);
    setPendingMZ('');
  }

  function addTag() {
    if (!pendingTagKey.trim()) return;
    setTags(prev => [...prev, { id: `tag-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, key: pendingTagKey.trim(), value: pendingTagValue.trim() || undefined }]);
    setPendingTagKey(''); setPendingTagValue('');
  }

  function buildFilters(hosts: EntityReference[]): EntityFilter[] {
    return hosts.map(host => ({
      id: generateFilterId(),
      managementZones: [...mzs],
      tags: tags.map(({ key, value }) => ({ key, value })),
      entities: [host],
      underlyingOptions: {
        ...getDefaultUnderlyingOptions(),
        includeProcesses,
        includeServices,
      },
    }));
  }

  async function processHosts() {
    const hostNames = parseHostsList(hostsInput);
    if (hostNames.length === 0) { setError('Please enter at least one host name.'); return; }
    if (hostNames.length > 1000) { setError(`Too many hosts. Maximum 1000 allowed. You entered ${hostNames.length}.`); return; }

    setIsResolving(true);
    setError('');

    const resolved: EntityReference[] = [];
    const unresolved: string[] = [];

    for (const name of hostNames) {
      const result = await resolveHostByName(name);
      if (result) resolved.push(result);
      else unresolved.push(name);
    }

    setIsResolving(false);

    if (resolved.length > 0 && unresolved.length > 0) {
      setValidationResults({ valid: resolved, invalid: unresolved });
      setShowValidation(true);
      return;
    }

    if (resolved.length === 0) {
      setError('Could not find any of the hosts entered.');
      return;
    }

    onAddFilters(buildFilters(resolved));
    handleClose();
  }

  function handleValidationRevise() {
    setShowValidation(false);
    setValidationResults(null);
  }

  function handleValidationSkip() {
    if (validationResults) onAddFilters(buildFilters(validationResults.valid));
    setShowValidation(false);
    setValidationResults(null);
    handleClose();
  }

  return (
    <>
      <Modal show={show} onDismiss={handleClose} title="Add hosts in bulk" size="medium" className="modal-bulk-with-footer">
        <Flex flexDirection="column" className="bulk-modal-content">
          <div className="bulk-modal-scroll">
            <Flex flexDirection="column" gap={20}>
              <div className="bulk-instructions">
                <Text className="bulk-instructions-text">
                  Enter host names below, separated by commas, spaces, or new lines.<br />
                  You can use either the host's name as it appears in Dynatrace or its fully qualified domain name.<br />
                  Each host will be added as its own entity filter with the management zones and tags you specify.
                </Text>
              </div>

              <div>
                <Label className="form-label">Host names</Label>
                <TextArea
                  className="bulk-textarea"
                  value={hostsInput}
                  resize="vertical"
                  onChange={setHostsInput}
                  placeholder={'Enter host names here...\nhost1.example.com\nhost2.example.com\nhost1, host2, host3'}
                  rows={6}
                />
              </div>

              <AnimatePresence>
                {error && (
                  <motion.div {...expandCollapse} className="bulk-error">
                    <Text className="bulk-error-text">{error}</Text>
                  </motion.div>
                )}
              </AnimatePresence>

              <div>
                <Label className="form-label">Processes and services</Label>
                <div className="bulk-checkbox-group">
                  <Checkbox name="bulk-include-processes" value={includeProcesses} onChange={setIncludeProcesses} className="bulk-checkbox">
                    Include processes running on these hosts
                  </Checkbox>
                  <Checkbox name="bulk-include-services" value={includeServices} onChange={setIncludeServices}>
                    Include services running on these hosts
                  </Checkbox>
                </div>
              </div>

              <Divider />

              <Flex gap={24} className="bulk-columns">
                {/* Management Zones column */}
                <div className="bulk-column">
                  <Label className="form-label">Management zones <span className="optional-text">(optional)</span></Label>
                  <Flex gap={6} alignItems="center" className="bulk-add-row">
                    <div className="bulk-select-container">
                      <Select value={pendingMZ} onChange={val => setPendingMZ(val as string)}>
                        <Select.Trigger placeholder="Select management zone" className="select-trigger-full" />
                        <Select.Content className="select-content-mz">
                          {managementZones.map(mz => (
                            <Select.Option key={mz.id} value={mz.id}>
                              <span className="select-option-truncate">{mz.name}</span>
                            </Select.Option>
                          ))}
                        </Select.Content>
                      </Select>
                    </div>
                    <AnimatePresence>
                      <motion.div {...fadeScale}>
                        <Button onClick={addMZ} variant="emphasized" color="primary" size="condensed" disabled={!pendingMZ} className="btn-inline">
                          <PlusIcon className="icon-adjust" size="small" />
                        </Button>
                      </motion.div>
                    </AnimatePresence>
                  </Flex>
                  <AnimatePresence>
                    {mzs.length > 0 && (
                      <motion.div {...expandCollapse} className="bulk-chips-area">
                        <AnimatePresence initial={false} mode="popLayout">
                          {mzs.map(mz => (
                            <motion.span key={mz.id} {...fadeScale} layout>
                              <Chip label={mz.name} onRemove={() => setMzs(prev => prev.filter(m => m.id !== mz.id))} />
                            </motion.span>
                          ))}
                        </AnimatePresence>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Tags column */}
                <div className="bulk-column">
                  <Label className="form-label">Tags <span className="optional-text">(optional)</span></Label>
                  <Flex gap={6} alignItems="center" className="bulk-add-row">
                    <div className="input-tag">
                      <TextInput value={pendingTagKey} onChange={setPendingTagKey} placeholder="Key" />
                    </div>
                    <div className="input-tag">
                      <TextInput value={pendingTagValue} onChange={setPendingTagValue} placeholder="Value" />
                    </div>
                    <AnimatePresence>
                      <motion.div {...fadeScale}>
                        <Button onClick={addTag} variant="emphasized" color="primary" size="condensed" disabled={!pendingTagKey} className="btn-inline">
                          <PlusIcon className="icon-adjust" size="small" />
                        </Button>
                      </motion.div>
                    </AnimatePresence>
                  </Flex>
                  <AnimatePresence>
                    {tags.length > 0 && (
                      <motion.div {...expandCollapse} className="bulk-chips-area" layout="position">
                        <AnimatePresence initial={false} mode="popLayout">
                          {tags.map((tag, idx) => (
                            <motion.span key={tag.id} {...chipCollapse} layout>
                              <Chip
                                label={tag.value ? `${tag.key}: ${tag.value}` : tag.key}
                                onRemove={() => setTags(prev => { const next = [...prev]; next.splice(idx, 1); return next; })}
                              />
                            </motion.span>
                          ))}
                        </AnimatePresence>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </Flex>
            </Flex>
          </div>

          <Flex justifyContent="flex-end" gap={12} className="bulk-modal-footer">
            <Button variant="emphasized" onClick={handleClose}>Cancel</Button>
            <Button variant="accent" color="primary" onClick={processHosts} disabled={isResolving}>
              {isResolving ? (
                <Flex gap={8} alignItems="center"><ProgressCircle size="small" /><Text>Resolving hosts...</Text></Flex>
              ) : 'Add hosts'}
            </Button>
          </Flex>
        </Flex>
      </Modal>

      {/* Validation Results Modal */}
      <Modal show={showValidation} onDismiss={() => setShowValidation(false)} title="Host validation results" size="medium">
        <Flex flexDirection="column" padding={16} gap={16}>
          <div className="bulk-validation-summary">
            <Text className="bulk-validation-text">
              Found <span className="text-error">{validationResults?.invalid.length ?? 0}</span> invalid host name{(validationResults?.invalid.length ?? 0) !== 1 && 's'} and{' '}
              <span className="text-success">{validationResults?.valid.length ?? 0}</span> valid host{(validationResults?.valid.length ?? 0) !== 1 && 's'}.
            </Text>
          </div>

          {validationResults?.invalid.length ? (
            <div className="bulk-validation-section">
              <Text className="bulk-validation-label">{validationResults.invalid.length} hosts not found:</Text>
              <div className="bulk-validation-list">
                {validationResults.invalid.map((name, idx) => (
                  <div key={idx} className="bulk-validation-item bulk-validation-item-error">{name}</div>
                ))}
              </div>
            </div>
          ) : null}

          {validationResults?.valid.length ? (
            <div className="bulk-validation-section">
              <Text className="bulk-validation-label">{validationResults.valid.length} hosts found:</Text>
              <div className="bulk-validation-list">
                {validationResults.valid.slice(0, 10).map((host, idx) => (
                  <div key={idx} className="bulk-validation-item text-success">{host.displayName}</div>
                ))}
                {validationResults.valid.length > 10 && (
                  <div className="bulk-validation-item bulk-validation-item-muted">
                    ... and {validationResults.valid.length - 10} more
                  </div>
                )}
              </div>
            </div>
          ) : null}

          <Flex justifyContent="flex-end" gap={12} className="bulk-validation-actions">
            <Button variant="emphasized" onClick={handleValidationRevise}>Revise input</Button>
            <Button variant="accent" color="primary" onClick={handleValidationSkip}>Skip invalid hosts and continue</Button>
          </Flex>
        </Flex>
      </Modal>
    </>
  );
};