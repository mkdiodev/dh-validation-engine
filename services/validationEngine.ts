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
 * Ensures we always get a string for reporting, even if 'site_id' key is missing or named differently in raw data.
 */
const safeSiteId = (row: any): string => {
  // Try common keys if normalized site_id is empty/undefined
  return row.site_id || row.hole_id || row['Site ID'] || row['Hole ID'] || row['HOLEID'] || row.id || 'Unknown';
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
  const validSiteIds = new Set(collars.map((c) => c.site_id));

  rows.forEach((row) => {
    if (!validSiteIds.has(row.site_id)) {
      const sId = safeSiteId(row);
      errors.push({
        id: `int-${tableType}-${row.id}`,
        table: tableType,
        rowId: row.id,
        siteId: sId,
        column: 'site_id',
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
 * Max(To) <= Collar.Total_Depth
 */
const validateEOH = (
  collars: CollarRow[],
  rows: IntervalRow[],
  tableType: TableType
): ValidationError[] => {
  const errors: ValidationError[] = [];
  const collarMap = new Map(collars.map((c) => [c.site_id, safeFloat(c.total_depth)]));

  rows.forEach((row) => {
    const maxDepth = collarMap.get(row.site_id);
    if (maxDepth !== undefined) {
      if (safeFloat(row.depth_to) > maxDepth) {
        errors.push({
          id: `eoh-${tableType}-${row.id}`,
          table: tableType,
          rowId: row.id,
          siteId: safeSiteId(row),
          column: 'depth_to',
          message: `Depth Exceeded: 'Depth To' (${row.depth_to}) exceeds Collar Total Depth (${maxDepth}).`,
          severity: ValidationSeverity.CRITICAL,
          type: 'LOGIC',
        });
      }
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
  
  // Group by Site ID using safe ID
  const grouped: Record<string, IntervalRow[]> = {};
  rows.forEach((r) => {
    const sId = safeSiteId(r);
    if (!grouped[sId]) grouped[sId] = [];
    grouped[sId].push(r);
  });

  Object.entries(grouped).forEach(([siteId, siteRows]) => {
    // Sort by Depth From
    siteRows.sort((a, b) => safeFloat(a.depth_from) - safeFloat(b.depth_from));

    for (let i = 0; i < siteRows.length; i++) {
      const current = siteRows[i];
      const from = safeFloat(current.depth_from);
      const to = safeFloat(current.depth_to);

      // Zero Length
      if (from === to) {
        errors.push({
          id: `zero-${tableType}-${current.id}`,
          table: tableType,
          rowId: current.id,
          siteId: siteId,
          column: 'depth_to',
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
          column: 'depth_from',
          message: `Inverted Interval: Depth From (${from}) is greater than Depth To (${to}).`,
          severity: ValidationSeverity.CRITICAL,
          type: 'INTERVAL',
        });
      }

      // Compare with previous for Overlap/Gap
      if (i > 0) {
        const prev = siteRows[i - 1];
        const prevTo = safeFloat(prev.depth_to);

        if (from < prevTo) {
          errors.push({
            id: `ovl-${tableType}-${current.id}`,
            table: tableType,
            rowId: current.id,
            siteId: siteId,
            column: 'depth_from',
            message: `Overlap: Starts at ${from} but previous ended at ${prevTo}.`,
            severity: ValidationSeverity.CRITICAL,
            type: 'INTERVAL',
          });
        } else if (from > prevTo) {
          // Gaps are often just warnings/info in some systems, strictly enforcing here as warning
          errors.push({
            id: `gap-${tableType}-${current.id}`,
            table: tableType,
            rowId: current.id,
            siteId: siteId,
            column: 'depth_from',
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
      
      // Mandatory Check
      if (colConfig.isMandatory && (value === undefined || value === '' || value === null)) {
        errors.push({
          id: `req-${config.tableType}-${row.id}-${colConfig.columnName}`,
          table: config.tableType,
          rowId: row.id,
          siteId: sId,
          column: colConfig.columnName,
          message: `Missing Value: ${colConfig.label} is mandatory.`,
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
  configs: TableConfig[],
  libraries: CodeLibrary[]
): ValidationSummary => {
  let allErrors: ValidationError[] = [];

  // --- 1. COLLAR CHECKS ---
  // Basic value checks for Collar
  const collarConfig = configs.find(c => c.tableType === TableType.COLLAR);
  if (collarConfig) {
      allErrors = [...allErrors, ...validateValues(collarData, collarConfig, libraries)];
  }

  // --- 2. SURVEY CHECKS ---
  // Integrity
  allErrors = [...allErrors, ...validateIntegrity(collarData, surveyData, TableType.SURVEY)];
  // Point Depth Check (Survey is point data, not interval, but must be within EOH)
  const collarMap = new Map(collarData.map((c) => [c.site_id, safeFloat(c.total_depth)]));
  surveyData.forEach(row => {
    const max = collarMap.get(row.site_id);
    if(max !== undefined && row.depth > max) {
       allErrors.push({
          id: `eoh-surv-${row.id}`,
          table: TableType.SURVEY,
          rowId: row.id,
          siteId: safeSiteId(row),
          column: 'depth',
          message: `Survey Depth ${row.depth} exceeds EOH ${max}.`,
          severity: ValidationSeverity.CRITICAL,
          type: 'LOGIC'
       })
    }
  });
  // Values for Survey
  const surveyConfig = configs.find(c => c.tableType === TableType.SURVEY);
  if (surveyConfig) {
     allErrors = [...allErrors, ...validateValues(surveyData, surveyConfig, libraries)];
  }

  // Helper to run all standard interval checks for a table
  const validateGenericInterval = (data: IntervalRow[], type: TableType) => {
    const config = configs.find(c => c.tableType === type);
    if (config) {
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

  // --- Summary Calculation ---
  const totalErrors = allErrors.filter((e) => e.severity === ValidationSeverity.CRITICAL).length;
  const totalWarnings = allErrors.filter((e) => e.severity === ValidationSeverity.WARNING).length;

  return {
    totalErrors,
    totalWarnings,
    errors: allErrors,
  };
};