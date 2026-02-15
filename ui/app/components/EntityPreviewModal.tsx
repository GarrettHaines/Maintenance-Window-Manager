import React, { useMemo } from 'react';
import { Flex } from '@dynatrace/strato-components/layouts';
import { ProgressCircle } from '@dynatrace/strato-components/content';
import { Text } from '@dynatrace/strato-components/typography';
import { Modal } from '@dynatrace/strato-components-preview/overlays';
import { DataTable } from '@dynatrace/strato-components-preview/tables';
import type { DataTableColumnDef } from '@dynatrace/strato-components-preview/tables';
import type { PreviewEntity, EntityTypeOption } from '../types/types';
import { getEntityTypeLabel } from '../utils/helpers';

interface EntityPreviewModalProps {
  show: boolean;
  title: string;
  filterNumber: number;
  entities: PreviewEntity[];
  isLoading: boolean;
  isEmpty: boolean;
  entityTypes: EntityTypeOption[];
  onClose: () => void;
}

export const EntityPreviewModal: React.FC<EntityPreviewModalProps> = ({
  show, title, filterNumber, entities, isLoading, isEmpty, entityTypes, onClose,
}) => {
  const columns: DataTableColumnDef<PreviewEntity>[] = useMemo(() => [
    { id: 'displayName', header: 'Name', accessor: 'displayName', minWidth: 200, width: '3fr' },
    { id: 'entityType', header: 'Entity type', accessor: row => getEntityTypeLabel(row.entityType, entityTypes), minWidth: 150, width: '1fr' },
    { id: 'entityId', header: 'Entity ID', accessor: 'entityId', minWidth: 200, width: '2fr' },
  ], [entityTypes]);

  return (
    <Modal show={show} onDismiss={onClose} title={title} size="medium">
      <Flex flexDirection="column" className="entity-preview-modal-content">
        {isLoading ? (
          <Flex justifyContent="center" alignItems="center" className="entity-preview-loading">
            <ProgressCircle />
          </Flex>
        ) : isEmpty ? (
          <div className="entity-preview-empty">
            <Text className="text-secondary">
              This entity filter is empty. Please add an entity, a management zone, or a tag.
            </Text>
          </div>
        ) : (
          <>
            <div className="entity-preview-count">
              <Text className="entity-preview-count-text">
                {entities.length} {entities.length === 1 ? 'entity' : 'entities'} are currently included in{' '} {filterNumber >= 0 ? `entity filter #${filterNumber}.` : 'your maintenance window.'}
              </Text>
            </div>
            <div className="entity-preview-table">
              <DataTable
                data={entities}
                columns={columns}
                variant={{ verticalDividers: true, verticalAlignment: { header: 'center', body: 'center' } }}
                sortable
                resizable
              />
            </div>
          </>
        )}
      </Flex>
    </Modal>
  );
};