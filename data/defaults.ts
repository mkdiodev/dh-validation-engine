import { TableConfig, TableType, CodeLibrary, CollarRow, SurveyRow, IntervalRow } from '../types';

export const defaultLibraries: CodeLibrary[] = [];

// Only keep system-critical columns (Keys & Depths) needed for core logic to work.
// Users will add their own value columns (e.g. Au, Lithology) via the UI or Import.
export const defaultConfigs: TableConfig[] = [
  {
    tableType: TableType.COLLAR,
    columns: [
      { columnName: 'SITE_ID', label: 'Site ID', isSchemaRequired: true, isMandatory: true, type: 'string' },
      { columnName: 'TOTAL_DEPTH', label: 'Total Depth', isSchemaRequired: true, isMandatory: true, type: 'float' },
    ],
  },
  {
    tableType: TableType.SURVEY,
    columns: [
      { columnName: 'SITE_ID', label: 'Site ID', isSchemaRequired: true, isMandatory: true, type: 'string' },
      { columnName: 'DEPTH', label: 'Depth', isSchemaRequired: true, isMandatory: true, type: 'float' },
      { columnName: 'AZIMUTH', label: 'Azimuth', isSchemaRequired: true, isMandatory: true, type: 'float' },
      { columnName: 'DIP', label: 'Dip', isSchemaRequired: true, isMandatory: true, type: 'float' },
    ],
  },
  {
    tableType: TableType.LITHOLOGY,
    columns: [
      { columnName: 'SITE_ID', label: 'Site ID', isSchemaRequired: true, isMandatory: true, type: 'string' },
      { columnName: 'DEPTH_FROM', label: 'Depth From', isSchemaRequired: true, isMandatory: true, type: 'float' },
      { columnName: 'DEPTH_TO', label: 'Depth To', isSchemaRequired: true, isMandatory: true, type: 'float' },
    ],
  },
  {
    tableType: TableType.ASSAY,
    columns: [
      { columnName: 'SITE_ID', label: 'Site ID', isSchemaRequired: true, isMandatory: true, type: 'string' },
      { columnName: 'DEPTH_FROM', label: 'Depth From', isSchemaRequired: true, isMandatory: true, type: 'float' },
      { columnName: 'DEPTH_TO', label: 'Depth To', isSchemaRequired: true, isMandatory: true, type: 'float' },
    ],
  },
  {
    tableType: TableType.MINERALIZATION,
    columns: [
      { columnName: 'SITE_ID', label: 'Site ID', isSchemaRequired: true, isMandatory: true, type: 'string' },
      { columnName: 'DEPTH_FROM', label: 'Depth From', isSchemaRequired: true, isMandatory: true, type: 'float' },
      { columnName: 'DEPTH_TO', label: 'Depth To', isSchemaRequired: true, isMandatory: true, type: 'float' },
    ],
  },
  {
    tableType: TableType.OXIDATION,
    columns: [
      { columnName: 'SITE_ID', label: 'Site ID', isSchemaRequired: true, isMandatory: true, type: 'string' },
      { columnName: 'DEPTH_FROM', label: 'Depth From', isSchemaRequired: true, isMandatory: true, type: 'float' },
      { columnName: 'DEPTH_TO', label: 'Depth To', isSchemaRequired: true, isMandatory: true, type: 'float' },
    ],
  },
  {
    tableType: TableType.GEOTECH,
    columns: [
      { columnName: 'SITE_ID', label: 'Site ID', isSchemaRequired: true, isMandatory: true, type: 'string' },
      { columnName: 'DEPTH_FROM', label: 'Depth From', isSchemaRequired: true, isMandatory: true, type: 'float' },
      { columnName: 'DEPTH_TO', label: 'Depth To', isSchemaRequired: true, isMandatory: true, type: 'float' },
    ],
  },
  {
    tableType: TableType.RQD,
    columns: [
      { columnName: 'SITE_ID', label: 'Site ID', isSchemaRequired: true, isMandatory: true, type: 'string' },
      { columnName: 'DEPTH_FROM', label: 'Depth From', isSchemaRequired: true, isMandatory: true, type: 'float' },
      { columnName: 'DEPTH_TO', label: 'Depth To', isSchemaRequired: true, isMandatory: true, type: 'float' },
    ],
  },
  {
    tableType: TableType.VEIN,
    columns: [
      { columnName: 'SITE_ID', label: 'Site ID', isSchemaRequired: true, isMandatory: true, type: 'string' },
      { columnName: 'DEPTH_FROM', label: 'Depth From', isSchemaRequired: true, isMandatory: true, type: 'float' },
      { columnName: 'DEPTH_TO', label: 'Depth To', isSchemaRequired: true, isMandatory: true, type: 'float' },
    ],
  },
];

// Sample Data (Empty)
export const sampleCollar: CollarRow[] = [];
export const sampleSurvey: SurveyRow[] = [];
export const sampleLithology: IntervalRow[] = [];
export const sampleAssay: IntervalRow[] = [];
export const sampleMineralization: IntervalRow[] = [];
export const sampleOxidation: IntervalRow[] = [];
export const sampleGeotech: IntervalRow[] = [];
export const sampleRQD: IntervalRow[] = [];
export const sampleVein: IntervalRow[] = [];