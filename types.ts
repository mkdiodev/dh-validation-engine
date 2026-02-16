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
}

// Data Row Interfaces
export interface CollarRow {
  id: string; // Unique ID
  site_id: string; // Changed from hole_id
  total_depth: number;
  [key: string]: any;
}

export interface SurveyRow {
  id: string;
  site_id: string; // Changed from hole_id
  depth: number;
  azimuth: number;
  dip: number;
  [key: string]: any;
}

export interface IntervalRow {
  id: string;
  site_id: string; // Changed from hole_id
  depth_from: number; // Changed from from
  depth_to: number; // Changed from to
  [key: string]: any; // Allows for lith_code, Au_ppm, etc.
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
  columnName: string;
  label: string;
  isMandatory: boolean;
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
  siteId: string; // Changed from holeId
  column?: string;
  message: string;
  severity: ValidationSeverity;
  type: 'INTEGRITY' | 'INTERVAL' | 'VALUE' | 'LOGIC';
}

export interface ValidationSummary {
  totalErrors: number;
  totalWarnings: number;
  errors: ValidationError[];
}