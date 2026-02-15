export interface RecurrenceDetails {
  startTime: string;
  endTime: string;
  timeZone: string;
  recurrenceRange?: {
    scheduleStartDate: string;
    scheduleEndDate?: string;
  };
}

export interface ApiFilter {
  entityType?: string;
  entityId?: string;
  entityTags?: string[];
  managementZones?: string[];
}

export interface MaintenanceWindowRaw {
  objectId: string;
  scope?: string;
  schemaVersion?: string;
  created?: number;
  createdBy?: string;
  modified?: number;
  modifiedBy?: string;
  author?: string;
  updateToken?: string;
  summary?: string;
  value: {
    enabled: boolean;
    generalProperties: {
      name: string;
      description?: string;
      suppression: string;
      maintenanceType: string;
      disableSyntheticMonitorExecution?: boolean;
    };
    schedule: {
      scheduleType: string;
      onceRecurrence?: RecurrenceDetails;
      dailyRecurrence?: RecurrenceDetails;
      weeklyRecurrence?: RecurrenceDetails & { selectedWeekDays?: string[] };
      monthlyRecurrence?: RecurrenceDetails & { dayOfMonth?: number };
    };
    filters?: ApiFilter[];
  };
}

export interface MaintenanceWindow {
  objectId: string;
  name: string;
  description: string;
  author: string;
  enabled: boolean;
  suppression: string;
  scheduleType: string;
  startTime: string;
  endTime: string;
  utcOffset: string;
  city: string;
  rawData: MaintenanceWindowRaw;
}

export interface ManagementZone {
  id: string;
  name: string;
}

export interface EntityReference {
  entityId: string;
  entityType: string;
  displayName: string;
}

export interface UnderlyingOptions {
  includeProcesses: boolean;
  includeServices: boolean;
  includeHosts: boolean;
  includeProcessGroups: boolean;
}

export interface EntityFilter {
  id: string;
  managementZones: ManagementZone[];
  tags: { key: string; value?: string }[];
  entities: EntityReference[];
  underlyingOptions: UnderlyingOptions;
}

export interface EntityTypeOption {
  value: string;
  label: string;
}

export interface TimezoneEntry {
  id: string;
  offset: string;
  city: string;
  aliases?: string[];
  hidden?: boolean;
}

export interface AutoTagRule {
  type: string;
  enabled: boolean;
  entitySelector: string;
  valueFormat: string;
  valueNormalization: string;
}

export interface PreviewEntity {
  entityId: string;
  displayName: string;
  entityType: string;
}