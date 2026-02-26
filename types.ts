export enum ValidationSeverity {
  INFO = 'INFO',
  WARNING = 'WARNING',
  CRITICAL = 'CRITICAL',
}

export enum TableType {
  COLLAR = 'COLLAR',
  SURVEY = 'SURVEY',
  LITHOLOGY = 'LITHOLOGY',
  ASSAY = 'ASSAY',
  MINERALIZATION = 'MINERALIZATION',
  OXIDATION = 'OXIDATION',
  GEOTECH = 'GEOTECH',
  RQD = 'RQD',
  VEIN = 'VEIN',
  ALTERATION = 'ALTERATION',
  DENSITY = 'DENSITY',
}

// Data Row Interfaces - Uppercase Standardization
export interface CollarRow {
  id: string; // Unique ID (Internal)
  SITE_ID: string; 
  END_DEPTH: number;
  [key: string]: any;
}

export interface SurveyRow {
  id: string;
  SITE_ID: string;
  DEPTH: number;
  AZIMUTH: number;
  DIP: number;
  [key: string]: any;
}

export interface IntervalRow {
  id: string;
  SITE_ID: string;
  DEPTH_FROM: number;
  DEPTH_TO: number;
  [key: string]: any; 
}

// Configuration Interfaces
export interface RangeRule {
  min?: number;
  max?: number;
  strict: boolean; // if true, Reject. if false, Warning.
}

export interface LookupRule {
  libraryId: string;
  caseSensitive: boolean;
}

export interface ColumnConfig {
  columnName: string; // Stored in UPPERCASE
  label: string;
  isSchemaRequired: boolean; // NEW: Column Header must exist in file
  isMandatory: boolean;      // EXISTING: Values in row must not be null/empty
  type: 'string' | 'number' | 'float';
  validation?: {
    range?: RangeRule;
    lookup?: LookupRule;
    isKeyReference?: boolean; // Checks against Collar
  };
}

export interface TableConfig {
  tableType: TableType;
  columns: ColumnConfig[];
}

export interface LibraryItem {
  code: string;
  description: string;
}

export interface CodeLibrary {
  id: string;
  name: string;
  items: LibraryItem[];
}

// Error Reporting
export interface ValidationError {
  id: string;
  table: TableType;
  rowId: string;
  siteId: string;
  column?: string;
  message: string;
  severity: ValidationSeverity;
  type: 'INTEGRITY' | 'INTERVAL' | 'VALUE' | 'LOGIC' | 'STRUCTURE';
}

export interface ValidationSummary {
  totalErrors: number;
  totalWarnings: number;
  errors: ValidationError[];
}