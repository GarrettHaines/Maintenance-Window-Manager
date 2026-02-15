import React from 'react';
import { Button } from '@dynatrace/strato-components/buttons';
import { Text } from '@dynatrace/strato-components/typography';
import { DeleteIcon } from '@dynatrace/strato-icons';

interface ChipProps {
  label: string;
  onRemove: () => void;
}

export const Chip: React.FC<ChipProps> = ({ label, onRemove }) => (
  <span className="chip">
    <Text className="chip-text">{label}</Text>
    <Button size="condensed" color="neutral" variant="emphasized" onClick={onRemove} className="chip-remove">
      <DeleteIcon size="small" className="chip-delete"/>
    </Button>
  </span>
);