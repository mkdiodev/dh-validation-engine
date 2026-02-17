export const userConfig = {
  "timestamp": "2024-01-01T00:00:00.000Z",
  "version": "1.0",
  "libraries": [],
  "configs": [
    {
      "tableType": "COLLAR",
      "columns": [
        { "columnName": "SITE_ID", "label": "Site ID", "isSchemaRequired": true, "isMandatory": true, "type": "string" },
        { "columnName": "TOTAL_DEPTH", "label": "Total Depth", "isSchemaRequired": true, "isMandatory": true, "type": "float", "validation": { "range": { "min": 0, "max": 2000, "strict": true } } }
      ]
    },
    {
      "tableType": "SURVEY",
      "columns": [
        { "columnName": "SITE_ID", "label": "Site ID", "isSchemaRequired": true, "isMandatory": true, "type": "string" },
        { "columnName": "DEPTH", "label": "Depth", "isSchemaRequired": true, "isMandatory": true, "type": "float" },
        { "columnName": "AZIMUTH", "label": "Azimuth", "isSchemaRequired": true, "isMandatory": true, "type": "float", "validation": { "range": { "min": 0, "max": 360, "strict": true } } },
        { "columnName": "DIP", "label": "Dip", "isSchemaRequired": true, "isMandatory": true, "type": "float", "validation": { "range": { "min": -90, "max": 90, "strict": true } } }
      ]
    },
    {
      "tableType": "LITHOLOGY",
      "columns": [
        { "columnName": "SITE_ID", "label": "Site ID", "isSchemaRequired": true, "isMandatory": true, "type": "string" },
        { "columnName": "DEPTH_FROM", "label": "Depth From", "isSchemaRequired": true, "isMandatory": true, "type": "float" },
        { "columnName": "DEPTH_TO", "label": "Depth To", "isSchemaRequired": true, "isMandatory": true, "type": "float" }
      ]
    },
    {
      "tableType": "ASSAY",
      "columns": [
        { "columnName": "SITE_ID", "label": "Site ID", "isSchemaRequired": true, "isMandatory": true, "type": "string" },
        { "columnName": "DEPTH_FROM", "label": "Depth From", "isSchemaRequired": true, "isMandatory": true, "type": "float" },
        { "columnName": "DEPTH_TO", "label": "Depth To", "isSchemaRequired": true, "isMandatory": true, "type": "float" }
      ]
    },
    {
      "tableType": "MINERALIZATION",
      "columns": [
        { "columnName": "SITE_ID", "label": "Site ID", "isSchemaRequired": true, "isMandatory": true, "type": "string" },
        { "columnName": "DEPTH_FROM", "label": "Depth From", "isSchemaRequired": true, "isMandatory": true, "type": "float" },
        { "columnName": "DEPTH_TO", "label": "Depth To", "isSchemaRequired": true, "isMandatory": true, "type": "float" }
      ]
    },
    {
      "tableType": "OXIDATION",
      "columns": [
        { "columnName": "SITE_ID", "label": "Site ID", "isSchemaRequired": true, "isMandatory": true, "type": "string" },
        { "columnName": "DEPTH_FROM", "label": "Depth From", "isSchemaRequired": true, "isMandatory": true, "type": "float" },
        { "columnName": "DEPTH_TO", "label": "Depth To", "isSchemaRequired": true, "isMandatory": true, "type": "float" }
      ]
    },
    {
      "tableType": "GEOTECH",
      "columns": [
        { "columnName": "SITE_ID", "label": "Site ID", "isSchemaRequired": true, "isMandatory": true, "type": "string" },
        { "columnName": "DEPTH_FROM", "label": "Depth From", "isSchemaRequired": true, "isMandatory": true, "type": "float" },
        { "columnName": "DEPTH_TO", "label": "Depth To", "isSchemaRequired": true, "isMandatory": true, "type": "float" }
      ]
    },
    {
      "tableType": "RQD",
      "columns": [
        { "columnName": "SITE_ID", "label": "Site ID", "isSchemaRequired": true, "isMandatory": true, "type": "string" },
        { "columnName": "DEPTH_FROM", "label": "Depth From", "isSchemaRequired": true, "isMandatory": true, "type": "float" },
        { "columnName": "DEPTH_TO", "label": "Depth To", "isSchemaRequired": true, "isMandatory": true, "type": "float" }
      ]
    },
    {
      "tableType": "VEIN",
      "columns": [
        { "columnName": "SITE_ID", "label": "Site ID", "isSchemaRequired": true, "isMandatory": true, "type": "string" },
        { "columnName": "DEPTH_FROM", "label": "Depth From", "isSchemaRequired": true, "isMandatory": true, "type": "float" },
        { "columnName": "DEPTH_TO", "label": "Depth To", "isSchemaRequired": true, "isMandatory": true, "type": "float" }
      ]
    }
  ]
};