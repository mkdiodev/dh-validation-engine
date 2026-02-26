import {
  CollarRow,
  IntervalRow,
  SurveyRow,
  TableType,
  ValidationError,
  ValidationSeverity,
  TableConfig,
  CodeLibrary,
  ValidationSummary
} from '../types';

/**
 * Helper: Parse number safely
 */
const safeFloat = (val: any): number => {
  const parsed = parseFloat(val);
  return isNaN(parsed) ? 0 : parsed;
};

/**
 * Helper: Safe Site ID extraction
 * Ensures we always get a string for reporting, using UPPERCASE keys
 */
const safeSiteId = (row: any): string => {
  return row.SITE_ID || row.HOLE_ID || row.HOLEID || row.id || 'Unknown';
};

/**
 * 0. Structure Validation
 * Check if the uploaded data contains all columns marked as isSchemaRequired
 */
const validateStructure = (
  rows: any[],
  config: TableConfig
): ValidationError[] => {
  const errors: ValidationError[] = [];
  
  if (!rows || rows.length === 0) return errors;

  // Keys should already be uppercase from Dashboard.tsx normalization
  const availableKeys = new Set(Object.keys(rows[0]));

  config.columns.forEach((col) => {
    // Only check if Schema Required is true
    if (col.isSchemaRequired && !availableKeys.has(col.columnName)) {
      errors.push({
        id: `struct-${config.tableType}-${col.columnName}`,
        table: config.tableType,
        rowId: 'HEADER',
        siteId: 'SYSTEM',
        column: col.columnName,
        message: `Missing Column Header: Required column '${col.columnName}' was not found in the file.`,
        severity: ValidationSeverity.CRITICAL,
        type: 'STRUCTURE',
      });
    }
  });

  return errors;
};

/**
 * 1. Geometric & Relational Validation
 * Check if SiteIDs in child tables exist in Collar
 */
const validateIntegrity = (
  collars: CollarRow[],
  rows: (IntervalRow | SurveyRow)[],
  tableType: TableType
): ValidationError[] => {
  const errors: ValidationError[] = [];
  const validSiteIds = new Set(collars.map((c) => c.SITE_ID));

  rows.forEach((row) => {
    if (!validSiteIds.has(row.SITE_ID)) {
      const sId = safeSiteId(row);
      errors.push({
        id: `int-${tableType}-${row.id}`,
        table: tableType,
        rowId: row.id,
        siteId: sId,
        column: 'SITE_ID',
        message: `Orphan Record: Site ID '${sId}' does not exist in Collar table.`,
        severity: ValidationSeverity.CRITICAL,
        type: 'INTEGRITY',
      });
    }
  });

  return errors;
};

/**
 * 2. EOH Consistency
 * Max(To) <= Collar.END_DEPTH (critical error per row)
 * plus bottom‑of‑hole coverage – deepest interval should reach total depth
 * (warning unless the hole already has an over‑EOH error, in which case
 * it stays critical to avoid hiding the original problem).
 */
const validateEOH = (
  collars: CollarRow[],
  rows: IntervalRow[],
  tableType: TableType
): ValidationError[] => {
  const errors: ValidationError[] = [];

  // build lookup of collar total depths
  const collarMap = new Map(collars.map((c) => [c.SITE_ID, safeFloat(c.END_DEPTH)]));
  // track the deepest "to" value seen for each hole
  const maxToBySite = new Map<string, number>();
  // mark sites that already had an over‑EOH row
  const overSites = new Set<string>();

  const TOLERANCE = 0.01; // allow small floating point variance, generous to avoid false positives

  rows.forEach((row) => {
    const siteId = row.SITE_ID;
    const toVal = safeFloat(row.DEPTH_TO);

    // remember largest to for bottom‑of‑hole check later
    const prevMax = maxToBySite.get(siteId);
    if (prevMax === undefined || toVal > prevMax) {
      maxToBySite.set(siteId, toVal);
    }

    const maxDepth = collarMap.get(siteId);
    if (maxDepth !== undefined && maxDepth > 0) {
      // individual row exceeding end‑of‑hole is always critical
      if (toVal > maxDepth + TOLERANCE) {
        overSites.add(siteId);
        errors.push({
          id: `eoh-${tableType}-${row.id}`,
          table: tableType,
          rowId: row.id,
          siteId: safeSiteId(row),
          column: 'DEPTH_TO',
          message: `Depth Exceeded: 'DEPTH_TO' (${row.DEPTH_TO}) exceeds Collar END_DEPTH (${maxDepth}).`, 
          severity: ValidationSeverity.CRITICAL,
          type: 'LOGIC',
        });
      }
    }
  });

  // bottom‑of‑hole coverage: ensure the deepest interval reaches the collar depth
  maxToBySite.forEach((deepest, siteId) => {
    const total = collarMap.get(siteId);
    if (total !== undefined && deepest < total - TOLERANCE) {
      errors.push({
        id: `eohbot-${tableType}-${siteId}`,
        table: tableType,
        rowId: '',
        siteId,
        column: 'DEPTH_TO',
        message: `Bottom coverage: deepest sample (${deepest}) is shallower than Collar END_DEPTH (${total}).`, 
        severity: overSites.has(siteId) ? ValidationSeverity.WARNING : ValidationSeverity.CRITICAL,
        type: 'LOGIC',
      });
    }
  });

  return errors;
};

/**
 * 3. Interval Logic (Overlaps, Gaps, Zero Length)
 */
const validateIntervals = (
  rows: IntervalRow[],
  tableType: TableType
): ValidationError[] => {
  const errors: ValidationError[] = [];
  
  // Group by Site ID
  const grouped: Record<string, IntervalRow[]> = {};
  rows.forEach((r) => {
    const sId = safeSiteId(r);
    if (!grouped[sId]) grouped[sId] = [];
    grouped[sId].push(r);
  });

  Object.entries(grouped).forEach(([siteId, siteRows]) => {
    // Sort by Depth From
    siteRows.sort((a, b) => safeFloat(a.DEPTH_FROM) - safeFloat(b.DEPTH_FROM));

    for (let i = 0; i < siteRows.length; i++) {
      const current = siteRows[i];
      const from = safeFloat(current.DEPTH_FROM);
      const to = safeFloat(current.DEPTH_TO);

      // Zero Length
      if (from === to) {
        errors.push({
          id: `zero-${tableType}-${current.id}`,
          table: tableType,
          rowId: current.id,
          siteId: siteId,
          column: 'DEPTH_TO',
          message: `Zero Length: Interval ${from} to ${to} has no length.`,
          severity: ValidationSeverity.WARNING,
          type: 'INTERVAL',
        });
      }

      // Inverse
      if (from > to) {
        errors.push({
          id: `inv-${tableType}-${current.id}`,
          table: tableType,
          rowId: current.id,
          siteId: siteId,
          column: 'DEPTH_FROM',
          message: `Inverted Interval: DEPTH_FROM (${from}) is greater than DEPTH_TO (${to}).`,
          severity: ValidationSeverity.CRITICAL,
          type: 'INTERVAL',
        });
      }

      // Compare with previous for Overlap/Gap
      if (i > 0) {
        const prev = siteRows[i - 1];
        const prevTo = safeFloat(prev.DEPTH_TO);

        if (from < prevTo) {
          errors.push({
            id: `ovl-${tableType}-${current.id}`,
            table: tableType,
            rowId: current.id,
            siteId: siteId,
            column: 'DEPTH_FROM',
            message: `Overlap: Starts at ${from} but previous ended at ${prevTo}.`,
            severity: ValidationSeverity.CRITICAL,
            type: 'INTERVAL',
          });
        } else if (from > prevTo) {
          errors.push({
            id: `gap-${tableType}-${current.id}`,
            table: tableType,
            rowId: current.id,
            siteId: siteId,
            column: 'DEPTH_FROM',
            message: `Gap: Gap detected between ${prevTo} and ${from}.`,
            severity: ValidationSeverity.WARNING,
            type: 'INTERVAL',
          });
        }
      }
    }
  });

  return errors;
};

/**
 * 4. Value & Library Validation
 * Checks ranges and lookup codes based on Configuration
 */
const validateValues = (
  rows: any[],
  config: TableConfig,
  libraries: CodeLibrary[]
): ValidationError[] => {
  const errors: ValidationError[] = [];

  rows.forEach((row) => {
    const sId = safeSiteId(row);

    config.columns.forEach((colConfig) => {
      const value = row[colConfig.columnName];
      
      // Mandatory Value Check (Null/Empty Check)
      if (colConfig.isMandatory && (value === undefined || value === '' || value === null)) {
        errors.push({
          id: `req-${config.tableType}-${row.id}-${colConfig.columnName}`,
          table: config.tableType,
          rowId: row.id,
          siteId: sId,
          column: colConfig.columnName,
          message: `Missing Value: Data in '${colConfig.columnName}' cannot be empty.`,
          severity: ValidationSeverity.CRITICAL,
          type: 'VALUE',
        });
        return; // Skip further checks if missing
      }

      if (value === undefined || value === '') return; // Skip logic for empty optional fields

      // Range Validation
      if (colConfig.validation?.range && colConfig.type !== 'string') {
        const numVal = safeFloat(value);
        const { min, max, strict } = colConfig.validation.range;

        if (min !== undefined && numVal < min) {
          errors.push({
            id: `min-${config.tableType}-${row.id}-${colConfig.columnName}`,
            table: config.tableType,
            rowId: row.id,
            siteId: sId,
            column: colConfig.columnName,
            message: `Value Too Low: ${numVal} is below minimum ${min}.`,
            severity: strict ? ValidationSeverity.CRITICAL : ValidationSeverity.WARNING,
            type: 'VALUE',
          });
        }
        if (max !== undefined && numVal > max) {
          errors.push({
            id: `max-${config.tableType}-${row.id}-${colConfig.columnName}`,
            table: config.tableType,
            rowId: row.id,
            siteId: sId,
            column: colConfig.columnName,
            message: `Value Too High: ${numVal} is above maximum ${max}.`,
            severity: strict ? ValidationSeverity.CRITICAL : ValidationSeverity.WARNING,
            type: 'VALUE',
          });
        }
      }

      // Lookup Validation
      if (colConfig.validation?.lookup && colConfig.type === 'string') {
        const { libraryId, caseSensitive } = colConfig.validation.lookup;
        const library = libraries.find((l) => l.id === libraryId);
        
        if (library) {
          const validCodes = new Set(
            library.items.map((i) => (caseSensitive ? i.code : i.code.toUpperCase()))
          );
          const checkVal = caseSensitive ? String(value) : String(value).toUpperCase();

          if (!validCodes.has(checkVal)) {
             errors.push({
              id: `lookup-${config.tableType}-${row.id}-${colConfig.columnName}`,
              table: config.tableType,
              rowId: row.id,
              siteId: sId,
              column: colConfig.columnName,
              message: `Invalid Code: '${value}' not found in library '${library.name}'.`,
              severity: ValidationSeverity.CRITICAL,
              type: 'VALUE',
            });
          }
        }
      }
    });
  });

  return errors;
};

/**
 * Main Validation Runner
 */

/**
 * Ensure collars have a reasonable END_DEPTH > 0
 */
const validateCollarDepths = (collars: CollarRow[]): ValidationError[] => {
  return collars
    .map(c => {
      const depth = safeFloat(c.END_DEPTH);
      if (depth <= 0) {
        return {
          id: `collar-depth-${c.id}`,
          table: TableType.COLLAR,
          rowId: c.id,
          siteId: c.SITE_ID,
          column: 'END_DEPTH',
          message: `Invalid Collar depth (${c.END_DEPTH}). Must be greater than zero.`,
          severity: ValidationSeverity.CRITICAL,
          type: 'VALUE',
        } as ValidationError;
      }
      return null;
    })
    .filter((e): e is ValidationError => e !== null);
};

export const runValidation = (
  collarData: CollarRow[],
  surveyData: SurveyRow[],
  lithologyData: IntervalRow[],
  assayData: IntervalRow[],
  mineralizationData: IntervalRow[],
  oxidationData: IntervalRow[],
  geotechData: IntervalRow[],
  rqdData: IntervalRow[],
  veinData: IntervalRow[],
  alterationData: IntervalRow[],
  densityData: IntervalRow[],
  configs: TableConfig[],
  libraries: CodeLibrary[]
): ValidationSummary => {
  let allErrors: ValidationError[] = [];

  // --- 1. COLLAR CHECKS ---
  const collarConfig = configs.find(c => c.tableType === TableType.COLLAR);
  if (collarConfig) {
      allErrors = [...allErrors, ...validateStructure(collarData, collarConfig)];
      allErrors = [...allErrors, ...validateValues(collarData, collarConfig, libraries)];
      // explicit check for valid total depth
      allErrors = [...allErrors, ...validateCollarDepths(collarData)];
  }

  // --- 2. SURVEY CHECKS ---
  const surveyConfig = configs.find(c => c.tableType === TableType.SURVEY);
  if (surveyConfig) {
     allErrors = [...allErrors, ...validateStructure(surveyData, surveyConfig)];
     allErrors = [...allErrors, ...validateValues(surveyData, surveyConfig, libraries)];
  }
  
  // Integrity & Logic for Survey
  allErrors = [...allErrors, ...validateIntegrity(collarData, surveyData, TableType.SURVEY)];
  const collarMap = new Map(collarData.map((c) => [c.SITE_ID, safeFloat(c.END_DEPTH)]));
  
  surveyData.forEach(row => {
    const max = collarMap.get(row.SITE_ID);
    if(max !== undefined && row.DEPTH > max) {
       allErrors.push({
          id: `eoh-surv-${row.id}`,
          table: TableType.SURVEY,
          rowId: row.id,
          siteId: safeSiteId(row),
          column: 'DEPTH',
          message: `Survey Depth ${row.DEPTH} exceeds EOH ${max}.`,
          severity: ValidationSeverity.CRITICAL,
          type: 'LOGIC'
       })
    }
  });

  // Helper to run all standard interval checks for a table
  const validateGenericInterval = (data: IntervalRow[], type: TableType) => {
    const config = configs.find(c => c.tableType === type);
    if (config) {
      // 0. Structure
      allErrors = [...allErrors, ...validateStructure(data, config)];
      // 1. Integrity (Orphan checks)
      allErrors = [...allErrors, ...validateIntegrity(collarData, data, type)];
      // 2. EOH Checks
      allErrors = [...allErrors, ...validateEOH(collarData, data, type)];
      // 3. Interval Logic (Overlaps, Gaps)
      allErrors = [...allErrors, ...validateIntervals(data, type)];
      // 4. Value / Library Checks
      allErrors = [...allErrors, ...validateValues(data, config, libraries)];
    }
  };

  // --- 3. RUN INTERVAL CHECKS ---
  validateGenericInterval(lithologyData, TableType.LITHOLOGY);
  validateGenericInterval(assayData, TableType.ASSAY);
  validateGenericInterval(mineralizationData, TableType.MINERALIZATION);
  validateGenericInterval(oxidationData, TableType.OXIDATION);
  validateGenericInterval(geotechData, TableType.GEOTECH);
  validateGenericInterval(rqdData, TableType.RQD);
  validateGenericInterval(veinData, TableType.VEIN);
  validateGenericInterval(alterationData, TableType.ALTERATION);
  validateGenericInterval(densityData, TableType.DENSITY);

  // --- Summary Calculation ---
  
  // collapse repeated errors into grouped entries so the log isn’t flooded by
  // the same problem occurring many times for the same hole/column.
  const groupErrors = (errors: ValidationError[]): ValidationError[] => {
    const map = new Map<string, { base: ValidationError; count: number; rowIds: string[] }>();
    errors.forEach(err => {
      // include first part of id (error category) to avoid merging over‑ and under‑EOH
      const category = err.id.split('-')[0];
      const key = [err.table, err.siteId, err.column || '', err.type, err.severity, category].join('|');
      const existing = map.get(key);
      if (existing) {
        existing.count += 1;
        existing.rowIds.push(err.rowId);
      } else {
        map.set(key, { base: { ...err }, count: 1, rowIds: [err.rowId] });
      }
    });

    const result: ValidationError[] = [];
    map.forEach(({ base, count, rowIds }) => {
      if (count > 1) {
        const grouped = { ...base };
        grouped.rowId = rowIds.join(',');
        // generic message based on category
        if (base.id.startsWith('eohbot')) {
          grouped.message = `${count} bottom‑of‑hole coverage issues on site ${base.siteId}.`;
        } else if (base.id.startsWith('eoh')) {
          grouped.message = `${count} intervals exceeded EOH on site ${base.siteId}.`;
        } else {
          grouped.message = `Multiple similar errors on site ${base.siteId}.`;
        }
        result.push(grouped);
      } else {
        result.push(base);
      }
    });
    return result;
  };

  const finalErrors = groupErrors(allErrors);

  const totalErrors = finalErrors.filter((e) => e.severity === ValidationSeverity.CRITICAL).length;
  const totalWarnings = finalErrors.filter((e) => e.severity === ValidationSeverity.WARNING).length;

  return {
    totalErrors,
    totalWarnings,
    errors: finalErrors,
  };
};