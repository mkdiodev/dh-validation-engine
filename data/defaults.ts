import { TableConfig, TableType, CodeLibrary, CollarRow, SurveyRow, IntervalRow } from '../types';

export const defaultLibraries: CodeLibrary[] = [];

// Only keep system-critical columns (Keys & Depths) needed for core logic to work.
// Users will add their own value columns (e.g. Au, Lithology) via the UI or Import.
export const defaultConfigs: TableConfig[] = [
  {
    tableType: TableType.COLLAR,
    columns: [
      { columnName: 'site_id', label: 'Site ID', isMandatory: true, type: 'string' },
      { columnName: 'total_depth', label: 'Total Depth', isMandatory: true, type: 'float' },
    ],
  },
  {
    tableType: TableType.SURVEY,
    columns: [
      { columnName: 'site_id', label: 'Site ID', isMandatory: true, type: 'string' },
      { columnName: 'depth', label: 'Depth', isMandatory: true, type: 'float' },
      { columnName: 'azimuth', label: 'Azimuth', isMandatory: true, type: 'float' },
      { columnName: 'dip', label: 'Dip', isMandatory: true, type: 'float' },
    ],
  },
  {
    tableType: TableType.LITHOLOGY,
    columns: [
      { columnName: 'site_id', label: 'Site ID', isMandatory: true, type: 'string' },
      { columnName: 'depth_from', label: 'Depth From', isMandatory: true, type: 'float' },
      { columnName: 'depth_to', label: 'Depth To', isMandatory: true, type: 'float' },
    ],
  },
  {
    tableType: TableType.ASSAY,
    columns: [
      { columnName: 'site_id', label: 'Site ID', isMandatory: true, type: 'string' },
      { columnName: 'depth_from', label: 'Depth From', isMandatory: true, type: 'float' },
      { columnName: 'depth_to', label: 'Depth To', isMandatory: true, type: 'float' },
    ],
  },
  {
    tableType: TableType.MINERALIZATION,
    columns: [
      { columnName: 'site_id', label: 'Site ID', isMandatory: true, type: 'string' },
      { columnName: 'depth_from', label: 'Depth From', isMandatory: true, type: 'float' },
      { columnName: 'depth_to', label: 'Depth To', isMandatory: true, type: 'float' },
    ],
  },
  {
    tableType: TableType.OXIDATION,
    columns: [
      { columnName: 'site_id', label: 'Site ID', isMandatory: true, type: 'string' },
      { columnName: 'depth_from', label: 'Depth From', isMandatory: true, type: 'float' },
      { columnName: 'depth_to', label: 'Depth To', isMandatory: true, type: 'float' },
    ],
  },
  {
    tableType: TableType.GEOTECH,
    columns: [
      { columnName: 'site_id', label: 'Site ID', isMandatory: true, type: 'string' },
      { columnName: 'depth_from', label: 'Depth From', isMandatory: true, type: 'float' },
      { columnName: 'depth_to', label: 'Depth To', isMandatory: true, type: 'float' },
    ],
  },
  {
    tableType: TableType.RQD,
    columns: [
      { columnName: 'site_id', label: 'Site ID', isMandatory: true, type: 'string' },
      { columnName: 'depth_from', label: 'Depth From', isMandatory: true, type: 'float' },
      { columnName: 'depth_to', label: 'Depth To', isMandatory: true, type: 'float' },
    ],
  },
  {
    tableType: TableType.VEIN,
    columns: [
      { columnName: 'site_id', label: 'Site ID', isMandatory: true, type: 'string' },
      { columnName: 'depth_from', label: 'Depth From', isMandatory: true, type: 'float' },
      { columnName: 'depth_to', label: 'Depth To', isMandatory: true, type: 'float' },
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