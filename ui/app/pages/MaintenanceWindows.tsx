import React, { useState, useMemo, useEffect } from 'react';
import { Flex } from '@dynatrace/strato-components/layouts';
import { ProgressCircle } from '@dynatrace/strato-components/content';
import { Button } from '@dynatrace/strato-components/buttons';
import { Paragraph, Text } from '@dynatrace/strato-components/typography';
import { Switch, TextInput } from '@dynatrace/strato-components-preview/forms';
import { DataTable } from '@dynatrace/strato-components-preview/tables';
import type { DataTableColumnDef } from '@dynatrace/strato-components-preview/tables';
import { InformationIcon, PlusIcon } from '@dynatrace/strato-icons';
import '../../assets/styles/index.css';

import type { MaintenanceWindow, ManagementZone, EntityTypeOption } from '../types/types';
import { PAGE_SIZE, DEFAULT_ENTITY_TYPES } from '../constants/entityTypes';
import { getSuppressionLabel } from '../utils/helpers';
import { fetchMaintenanceWindows, fetchManagementZones, fetchEntityTypes, cleanupExpiredAutoTags } from '../api/api';
import { DetailsModal } from '../components/DetailsModal';
import { CreateModal } from '../components/CreateModal';

export const MaintenanceWindows = () => {
  const [windows, setWindows] = useState<MaintenanceWindow[]>([]);
  const [managementZones, setManagementZones] = useState<ManagementZone[]>([]);
  const [entityTypes, setEntityTypes] = useState<EntityTypeOption[]>(DEFAULT_ENTITY_TYPES);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showDisabled, setShowDisabled] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [detailsWindow, setDetailsWindow] = useState<MaintenanceWindow | null>(null);

  // Initial data fetch
  useEffect(() => {
    (async () => { setIsLoading(true); setWindows(await fetchMaintenanceWindows()); setIsLoading(false); })();
  }, []);
  useEffect(() => { fetchManagementZones().then(setManagementZones); }, []);
  useEffect(() => { fetchEntityTypes().then(setEntityTypes); }, []);
  useEffect(() => { cleanupExpiredAutoTags(); }, []);
  useEffect(() => { setCurrentPage(0); }, [searchTerm, showDisabled]);

  const filteredWindows = useMemo(() => {
    let result = windows;
    if (!showDisabled) result = result.filter(w => w.enabled);
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(w => w.name.toLowerCase().includes(term));
    }
    return result;
  }, [windows, showDisabled, searchTerm]);

  const pageData = useMemo(() => {
    const start = currentPage * PAGE_SIZE;
    return filteredWindows.slice(start, start + PAGE_SIZE);
  }, [filteredWindows, currentPage]);

  const columns: DataTableColumnDef<MaintenanceWindow>[] = useMemo(() => [
    { id: 'name', header: 'Name', accessor: 'name', minWidth: 175, maxWidth: 500, width: '3fr' },
    { id: 'startTime', header: 'Start time', accessor: 'startTime', minWidth: 142, maxWidth: 142 },
    { id: 'endTime', header: 'End time', accessor: 'endTime', minWidth: 142, maxWidth: 142 },
    { id: 'utcOffset', header: 'UTC offset', accessor: 'utcOffset', minWidth: 110, maxWidth: 110 },
    { id: 'city', header: 'Region', accessor: 'city', minWidth: 100 },
    { id: 'suppression', header: 'Suppressing', accessor: row => getSuppressionLabel(row.suppression), minWidth: 140, maxWidth: 140 },
    {
      id: 'info', header: 'Info', accessor: row => row, minWidth: 51, maxWidth: 51,
      cell: ({ value }) => (
        <Flex flex={1} justifyContent="center">
          <Button variant="default" size="condensed" onClick={e => { e.stopPropagation(); setDetailsWindow(value as MaintenanceWindow); }} aria-label="View details">
            <InformationIcon />
          </Button>
        </Flex>
      ),
    },
  ], []);

  async function handleSaved() {
    setIsCreateOpen(false);
    setIsLoading(true);
    setWindows(await fetchMaintenanceWindows());
    setIsLoading(false);
  }

  return (
    <Flex flexDirection="column" gap={8} padding={12} className="page-container">
      <Flex justifyContent="space-between" alignItems="center">
        <Flex alignItems="center" className="search-container" gap={16}>
          <TextInput placeholder="Search by name..." value={searchTerm} onChange={setSearchTerm} className="search-input" />
        </Flex>
        <Button color="primary" variant="accent" onClick={() => setIsCreateOpen(true)} className="btn-unshrinkable">
          <PlusIcon className="icon-btn-giant" />
          <Text textStyle="base-emphasized" className="btn-large-text"> New maintenance window</Text>
        </Button>
      </Flex>

      {isLoading ? (
        <Flex justifyContent="center" alignItems="center" className="table-loading"><ProgressCircle /></Flex>
      ) : (
        <DataTable
          data={pageData}
          columns={columns}
          className="table-container"
          variant={{ verticalDividers: true, verticalAlignment: { header: 'center', body: 'center' } }}
          fullWidth
          sortable
          resizable
        />
      )}

      <Flex justifyContent="space-between" alignItems="center">
        <Switch value={showDisabled} onChange={setShowDisabled}>Show disabled maintenance windows</Switch>
        <Paragraph className="text-count">{filteredWindows.length} of {windows.length} maintenance windows</Paragraph>
      </Flex>

      <CreateModal
        show={isCreateOpen}
        managementZones={managementZones}
        entityTypes={entityTypes}
        onClose={() => setIsCreateOpen(false)}
        onSaved={handleSaved}
      />

      <DetailsModal
        window={detailsWindow}
        managementZones={managementZones}
        entityTypes={entityTypes}
        onClose={() => setDetailsWindow(null)}
      />
    </Flex>
  );
};