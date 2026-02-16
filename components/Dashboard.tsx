import React, { useState, useRef, useMemo, useEffect } from 'react';
import { 
  TableType, 
  TableConfig, 
  CodeLibrary, 
  CollarRow, 
  SurveyRow, 
  IntervalRow,
  ValidationSummary,
  ValidationSeverity,
  ColumnConfig,
  LibraryItem
} from '../types';
import { runValidation } from '../services/validationEngine';
import { defaultConfigs, defaultLibraries, sampleAssay, sampleCollar, sampleLithology, sampleSurvey, sampleMineralization, sampleOxidation, sampleGeotech, sampleRQD, sampleVein } from '../data/defaults';
// Import the User Config from TS file
import { userConfig } from '../data/userConfig';

import { 
  LucideLayoutDashboard, 
  LucideSettings, 
  LucideUpload, 
  LucidePlayCircle, 
  LucideAlertTriangle, 
  LucideCheckCircle, 
  LucideFileText, 
  LucideFileSpreadsheet, 
  LucideDownload, 
  LucideTrash2, 
  LucideTable, 
  LucidePlus, 
  LucideX, 
  LucideSave, 
  LucideEdit3, 
  LucideBook, 
  LucideChevronDown, 
  LucideDatabase, 
  LucideChevronRight, 
  LucideLayers, 
  LucideActivity, 
  LucideMapPin, 
  LucideRotateCcw, 
  LucideInfo, 
  LucideBox, 
  LucideSearch,
  LucideFileJson,
  LucideRefreshCw
} from 'lucide-react';
import * as XLSX from 'xlsx';

// --- Constants ---

const defaultExpectedColumns: Record<string, string[]> = {
  [TableType.COLLAR]: ['site_id', 'total_depth', 'project_code', 'start_date', 'end_date', 'drill_type', 'x', 'y', 'z'],
  [TableType.SURVEY]: ['site_id', 'depth', 'azimuth', 'dip', 'survey_method', 'date'],
  [TableType.LITHOLOGY]: ['site_id', 'depth_from', 'depth_to', 'lith_code', 'description', 'texture', 'alteration', 'weathering'],
  [TableType.ASSAY]: ['site_id', 'depth_from', 'depth_to', 'sample_id', 'au_ppm', 'ag_ppm', 'cu_pct', 'density', 'lab_job_no', 'weight'],
  [TableType.MINERALIZATION]: ['site_id', 'depth_from', 'depth_to', 'min_code', 'percentage', 'style', 'intensity'],
  [TableType.OXIDATION]: ['site_id', 'depth_from', 'depth_to', 'ox_code', 'intensity', 'base_of_complete_ox'],
  [TableType.GEOTECH]: ['site_id', 'depth_from', 'depth_to', 'recovery', 'rock_strength', 'weathering', 'defect_count'],
  [TableType.RQD]: ['site_id', 'depth_from', 'depth_to', 'rqd_percent', 'fracture_frequency'],
  [TableType.VEIN]: ['site_id', 'depth_from', 'depth_to', 'vein_type', 'percentage', 'alpha_angle', 'beta_angle'],
};

// --- Helper Functions ---

const normalizeHeaders = (data: any[]): any[] => {
  if (data.length === 0) return [];
  
  // Standardize keys to lowercase snake_case for the app's internal logic
  // e.g., "Hole ID" -> "site_id", "Au (ppm)" -> "au_ppm"
  return data.map(row => {
    const newRow: any = {};
    Object.keys(row).forEach(key => {
      let newKey = key.toLowerCase().trim()
        .replace(/[\s\(\)\.]+/g, '_') // Replace spaces, brackets, dots with underscore
        .replace(/_+$/, ''); // Remove trailing underscores

      // Common mappings
      // Map common variations of Hole ID / Site ID to 'site_id'
      if (['holeid', 'hole_id', 'site_id', 'siteid', 'bh_id', 'bhid', 'borehole_id', 'hole'].includes(newKey)) {
        newKey = 'site_id';
      }
      
      // Map variations of From/To to depth_from/depth_to
      if (['from', 'depth_from', 'start', 'depth_start'].includes(newKey)) newKey = 'depth_from';
      if (['to', 'depth_to', 'end', 'depth_end'].includes(newKey)) newKey = 'depth_to';
      
      if (['id', 'record_id'].includes(newKey)) newKey = 'row_id'; // Avoid conflict if ID is reserved

      newRow[newKey] = row[key];
    });
    // Ensure every row has a unique ID for React keys and validation references
    if (!newRow.id) newRow.id = Math.random().toString(36).substr(2, 9);
    return newRow;
  });
};

// --- Subcomponents ---

const LibraryManager = ({ 
  libraries, 
  setLibraries 
}: { 
  libraries: CodeLibrary[], 
  setLibraries: (libs: CodeLibrary[]) => void 
}) => {
  // Initialize activeLibId safely based on props
  const [activeLibId, setActiveLibId] = useState<string>(() => libraries.length > 0 ? libraries[0].id : '');
  const [newLibName, setNewLibName] = useState('');
  
  // Code entry state
  const [newCode, setNewCode] = useState('');
  const [newDesc, setNewDesc] = useState('');
  
  // File Import Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importNewLibRef = useRef<HTMLInputElement>(null);

  // Critical: When the `libraries` prop changes completely (e.g. after Import), 
  // we must ensure activeLibId points to something valid.
  useEffect(() => {
    if (libraries.length === 0) {
      setActiveLibId('');
    } else {
      const exists = libraries.find(l => l.id === activeLibId);
      if (!exists) {
        setActiveLibId(libraries[0].id);
      }
    }
  }, [libraries, activeLibId]);

  const activeLib = libraries.find(l => l.id === activeLibId);

  const handleAddLibrary = () => {
    if (!newLibName.trim()) return;
    const newId = newLibName.toLowerCase().replace(/\s+/g, '_') + '_' + Math.random().toString(36).substr(2, 4);
    const newLib: CodeLibrary = { id: newId, name: newLibName, items: [] };
    setLibraries([...libraries, newLib]);
    setNewLibName('');
    setActiveLibId(newId);
  };

  const handleDeleteLibrary = (id: string) => {
    if (confirm('Are you sure you want to delete this library? rules using it will fail.')) {
      setLibraries(libraries.filter(l => l.id !== id));
      if (activeLibId === id) setActiveLibId(libraries[0]?.id || '');
    }
  };

  const handleAddCode = () => {
    if (!activeLib || !newCode.trim()) return;
    const updatedLib = {
      ...activeLib,
      items: [...activeLib.items, { code: newCode.trim(), description: newDesc.trim() }]
    };
    setLibraries(libraries.map(l => l.id === activeLibId ? updatedLib : l));
    setNewCode('');
    setNewDesc('');
  };

  const handleDeleteCode = (code: string) => {
    if (!activeLib) return;
    const updatedLib = {
      ...activeLib,
      items: activeLib.items.filter(i => i.code !== code)
    };
    setLibraries(libraries.map(l => l.id === activeLibId ? updatedLib : l));
  };

  const handleImportNewLibrary = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      if (bstr) {
        try {
          const wb = XLSX.read(bstr, { type: 'binary' });
          const wsname = wb.SheetNames[0];
          const ws = wb.Sheets[wsname];
          
          const rows = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
          
          if (rows.length === 0) {
             alert("File is empty");
             return;
          }

          const libsToCreate: Record<string, LibraryItem[]> = {};
          let count = 0;

          rows.forEach((row, index) => {
            if (index === 0) {
               const firstCell = String(row[0] || '').toLowerCase();
               if (firstCell.includes('library') || firstCell.includes('name')) return;
            }

            const libName = row[0] ? String(row[0]).trim() : '';
            const code = row[1] ? String(row[1]).trim() : '';
            const desc = row[2] ? String(row[2]).trim() : '';

            if (libName && code) {
               if (!libsToCreate[libName]) {
                 libsToCreate[libName] = [];
               }
               if (!libsToCreate[libName].some(i => i.code === code)) {
                 libsToCreate[libName].push({ code, description: desc });
                 count++;
               }
            }
          });

          if (count === 0) {
             alert("No valid data found. Ensure Column A=Library Name, B=Code, C=Description.");
             return;
          }

          const newLibraries = [...libraries];

          Object.entries(libsToCreate).forEach(([name, items]) => {
             const existingLibIndex = newLibraries.findIndex(l => l.name.toLowerCase() === name.toLowerCase());

             if (existingLibIndex >= 0) {
                const existingLib = newLibraries[existingLibIndex];
                const existingCodes = new Set(existingLib.items.map(i => i.code.toLowerCase()));
                const uniqueNewItems = items.filter(i => !existingCodes.has(i.code.toLowerCase()));
                
                if (uniqueNewItems.length > 0) {
                   newLibraries[existingLibIndex] = {
                      ...existingLib,
                      items: [...existingLib.items, ...uniqueNewItems]
                   };
                }
             } else {
                const newId = name.toLowerCase().replace(/\s+/g, '_') + '_' + Math.random().toString(36).substr(2, 4);
                newLibraries.push({
                   id: newId,
                   name: name,
                   items: items
                });
             }
          });
             
          setLibraries(newLibraries);
          
          const firstImportedName = Object.keys(libsToCreate)[0];
          const createdLib = newLibraries.find(l => l.name === firstImportedName);
          if (createdLib) setActiveLibId(createdLib.id);

          alert(`Successfully processed file. Found ${Object.keys(libsToCreate).length} libraries with ${count} total codes.`);

        } catch (error) {
          console.error(error);
          alert("Failed to parse file. Please ensure it is a valid Excel or CSV file.");
        }
      }
    };
    reader.readAsBinaryString(file);
    if (importNewLibRef.current) importNewLibRef.current.value = '';
  };

  const handleImportCodes = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeLib) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      if (bstr) {
        try {
          const wb = XLSX.read(bstr, { type: 'binary' });
          const wsname = wb.SheetNames[0];
          const ws = wb.Sheets[wsname];
          const jsonData = XLSX.utils.sheet_to_json(ws);
          
          if (jsonData.length === 0) {
             alert("File is empty");
             return;
          }

          const newItems: LibraryItem[] = [];
          
          jsonData.forEach((row: any) => {
            const keys = Object.keys(row);
            const codeKey = keys.find(k => ['code', 'id'].includes(k.toLowerCase())) || keys[0];
            const descKey = keys.find(k => ['description', 'desc', 'name', 'meaning'].includes(k.toLowerCase())) || keys[1];

            const code = row[codeKey] ? String(row[codeKey]).trim() : '';
            const description = (descKey && row[descKey]) ? String(row[descKey]).trim() : '';

            if (code) {
               newItems.push({ code, description });
            }
          });

          const existingCodes = new Set(activeLib.items.map(i => i.code.toLowerCase()));
          const uniqueItems = newItems.filter(i => !existingCodes.has(i.code.toLowerCase()));

          if (uniqueItems.length > 0) {
             const updatedLib = {
               ...activeLib,
               items: [...activeLib.items, ...uniqueItems]
             };
             setLibraries(libraries.map(l => l.id === activeLibId ? updatedLib : l));
             alert(`Successfully imported ${uniqueItems.length} new codes.`);
          } else {
             alert("No new unique codes found (duplicates skipped).");
          }

        } catch (error) {
          console.error(error);
          alert("Failed to parse file. Please ensure it is a valid Excel or CSV file.");
        }
      }
    };
    reader.readAsBinaryString(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200 h-[600px] flex flex-col">
      <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
        <LucideBook className="w-5 h-5 text-indigo-600" />
        Library Manager
      </h2>
      
      <div className="flex flex-1 gap-6 min-h-[400px]">
        {/* Sidebar: Library List */}
        <div className="w-1/3 border-r border-slate-100 pr-4 flex flex-col">
          <div className="flex gap-2 mb-2">
            <input 
              className="flex-1 px-3 py-2 bg-slate-700 border border-transparent text-white placeholder-slate-400 rounded-md text-sm outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="New Library Name..."
              value={newLibName}
              onChange={e => setNewLibName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddLibrary()}
            />
            <button 
              onClick={handleAddLibrary}
              className="p-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
            >
              <LucidePlus className="w-4 h-4" />
            </button>
          </div>
          
          {/* New Import Library Section */}
          <div className="mb-4 pb-4 border-b border-slate-100">
            <button 
              onClick={() => importNewLibRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-white border border-slate-300 text-slate-700 rounded-md hover:bg-slate-50 text-sm font-medium transition-colors"
            >
              <LucideUpload className="w-4 h-4" />
              Import Library File
            </button>
            <input 
              type="file" 
              ref={importNewLibRef} 
              onChange={handleImportNewLibrary} 
              className="hidden" 
              accept=".csv, .xlsx, .xls"
            />
            <p className="text-[10px] text-slate-400 mt-2 text-center flex flex-col items-center justify-center gap-1">
              <span className="flex items-center gap-1 font-bold"><LucideInfo className="w-3 h-3" /> Format Required:</span>
              <span>Col A: Library Name | Col B: Code | Col C: Desc</span>
            </p>
          </div>

          <div className="flex-1 overflow-y-auto space-y-1">
            {libraries.length === 0 && (
                <div className="text-xs text-slate-400 text-center py-4 italic">No libraries found.</div>
            )}
            {libraries.map(lib => (
              <div 
                key={lib.id}
                onClick={() => setActiveLibId(lib.id)}
                className={`flex items-center justify-between px-3 py-2 rounded-md cursor-pointer text-sm font-medium transition-colors ${activeLibId === lib.id ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' : 'text-slate-600 hover:bg-slate-50'}`}
              >
                <span>{lib.name}</span>
                <button 
                  onClick={(e) => { e.stopPropagation(); handleDeleteLibrary(lib.id); }}
                  className="text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100"
                >
                  <LucideTrash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Main: Codes List */}
        <div className="flex-1 flex flex-col">
          {activeLib ? (
            <>
              <div className="flex items-center justify-between mb-2">
                 <h3 className="font-semibold text-slate-800">{activeLib.name} <span className="text-slate-400 font-normal text-sm">({activeLib.items.length} codes)</span></h3>
                 <div className="flex gap-2">
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center gap-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-md transition-colors border border-indigo-100"
                    >
                      <LucideFileSpreadsheet className="w-3.5 h-3.5" />
                      Import CSV/Excel
                    </button>
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      onChange={handleImportCodes} 
                      className="hidden" 
                      accept=".csv, .xlsx, .xls"
                    />
                 </div>
              </div>
              <div className="flex items-start gap-2 mb-4 p-2 bg-slate-50 border border-slate-100 rounded text-xs text-slate-500">
                <LucideInfo className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
                <p>
                  <strong>Tip:</strong> You can upload a file with columns named <code className="bg-white border border-slate-200 px-1 rounded font-mono text-indigo-600">Code</code> and <code className="bg-white border border-slate-200 px-1 rounded font-mono text-indigo-600">Description</code>. If columns are not named, the first column will be used as Code.
                </p>
              </div>
              
              <div className="flex gap-2 mb-3 bg-slate-50 p-3 rounded-md border border-slate-100">
                <input 
                  className="w-1/4 px-3 py-1.5 border rounded text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="Code (e.g. QZ)"
                  value={newCode}
                  onChange={e => setNewCode(e.target.value)}
                />
                <input 
                  className="flex-1 px-3 py-1.5 border rounded text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="Description (e.g. Quartz)"
                  value={newDesc}
                  onChange={e => setNewDesc(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddCode()}
                />
                <button 
                  onClick={handleAddCode}
                  className="px-4 py-1.5 bg-emerald-600 text-white text-xs font-semibold rounded hover:bg-emerald-700"
                >
                  Add Code
                </button>
              </div>

              <div className="flex-1 overflow-y-auto border border-slate-200 rounded-md">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 text-slate-500 text-xs uppercase sticky top-0">
                    <tr>
                      <th className="px-4 py-2">Code</th>
                      <th className="px-4 py-2">Description</th>
                      <th className="px-4 py-2 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {activeLib.items.length === 0 ? (
                       <tr><td colSpan={3} className="px-4 py-8 text-center text-slate-400 italic">No codes defined yet.</td></tr>
                    ) : (
                      activeLib.items.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 group">
                          <td className="px-4 py-2 font-mono font-medium text-indigo-700">{item.code}</td>
                          <td className="px-4 py-2 text-slate-600">{item.description}</td>
                          <td className="px-4 py-2 text-right">
                             <button onClick={() => handleDeleteCode(item.code)} className="text-slate-300 hover:text-red-500">
                               <LucideX className="w-4 h-4" />
                             </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-full text-slate-400">
              Select or create a library to edit codes
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const ConfigPanel = ({ 
  configs, 
  libraries, 
  setConfigs,
  availableColumnsMap,
  hasDataMap
}: { 
  configs: TableConfig[], 
  libraries: CodeLibrary[], 
  setConfigs: (c: TableConfig[]) => void,
  availableColumnsMap: Record<string, string[]>,
  hasDataMap: Record<string, boolean>
}) => {
  const [activeTab, setActiveTab] = useState<TableType>(TableType.LITHOLOGY);
  const [newColName, setNewColName] = useState('');
  const [selectedColumnToAdd, setSelectedColumnToAdd] = useState('');

  const currentConfig = configs.find(c => c.tableType === activeTab);
  const detectedColumns = availableColumnsMap[activeTab] || [];
  const isUsingDefaults = !hasDataMap[activeTab];

  // Columns that exist in uploaded data (or defaults) but NOT in config
  const unconfiguredColumns = detectedColumns.filter(
    dc => !currentConfig?.columns.some(cc => cc.columnName === dc)
  );

  const updateColumn = (colName: string, changes: Partial<ColumnConfig>) => {
    setConfigs(configs.map(c => {
      if (c.tableType !== activeTab) return c;
      return {
        ...c,
        columns: c.columns.map(col => col.columnName === colName ? { ...col, ...changes } : col)
      };
    }));
  };

  const updateValidationType = (colName: string, type: 'none' | 'range' | 'lookup' | 'key') => {
    const changes: Partial<ColumnConfig> = {};
    
    // Reset validation options to ensure clean state
    changes.validation = {};

    if (type === 'none') {
       // already cleared
    } else if (type === 'range') {
       changes.type = 'float'; // Force Number type for numeric ranges
       changes.validation = { range: { min: 0, strict: false } };
    } else if (type === 'lookup') {
       changes.type = 'string'; // Force String type for Lookups
       changes.validation = { lookup: { libraryId: libraries[0]?.id || '', caseSensitive: false } };
    } else if (type === 'key') {
       changes.type = 'string'; // Usually Hole IDs are strings
       changes.validation = { isKeyReference: true };
    }
    updateColumn(colName, changes);
  };

  const updateRangeValue = (colName: string, field: 'min' | 'max', value: string) => {
    const numVal = value === '' ? undefined : parseFloat(value);
    const col = currentConfig?.columns.find(c => c.columnName === colName);
    if (!col || !col.validation?.range) return;

    const newRange = { ...col.validation.range, [field]: numVal };
    updateColumn(colName, { validation: { ...col.validation, range: newRange } });
  };

  const addColumn = (name: string) => {
    if (!name.trim()) return;
    const newCol: ColumnConfig = {
      columnName: name.trim(),
      label: name.trim().charAt(0).toUpperCase() + name.trim().slice(1).replace(/_/g, ' '),
      isMandatory: false,
      type: 'string', // Default
      validation: {}
    };
    
    setConfigs(configs.map(c => {
      if (c.tableType !== activeTab) return c;
      return { ...c, columns: [...c.columns, newCol] };
    }));
    setNewColName('');
  };

  const removeColumn = (name: string) => {
    setConfigs(configs.map(c => {
      if (c.tableType !== activeTab) return c;
      return { ...c, columns: c.columns.filter(col => col.columnName !== name) };
    }));
  };

  const allTableTypes = [
    TableType.COLLAR,
    TableType.SURVEY,
    TableType.LITHOLOGY, 
    TableType.ASSAY, 
    TableType.MINERALIZATION, 
    TableType.OXIDATION, 
    TableType.GEOTECH, 
    TableType.RQD, 
    TableType.VEIN
  ];

  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200">
      {/* Tab Navigation */}
      <div className="px-6 pt-6 flex gap-6 overflow-x-auto border-b border-slate-200">
        {allTableTypes.map(t => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className={`pb-3 text-xs font-bold uppercase tracking-wide transition-colors whitespace-nowrap ${
              activeTab === t 
              ? 'border-b-2 border-indigo-600 text-indigo-700' 
              : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {currentConfig ? (
        <div className="p-6">
          <div className="border rounded-lg border-slate-100 bg-white shadow-sm overflow-hidden mb-6">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-4 min-w-[200px]">Column</th>
                    <th className="px-6 py-4 text-center w-32">Mandatory</th>
                    <th className="px-6 py-4 w-40">Data Type</th>
                    <th className="px-6 py-4 w-56">Validation Mode</th>
                    <th className="px-6 py-4 min-w-[300px]">Rules Configuration</th>
                    <th className="px-4 py-4 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {currentConfig.columns.map(col => (
                    <tr key={col.columnName} className="hover:bg-slate-50/50 group transition-colors">
                      {/* Column Name */}
                      <td className="px-6 py-5 align-top">
                        <div className="flex flex-col">
                          <span className="font-semibold text-sm text-slate-800">{col.label}</span>
                          <span className="text-xs text-slate-400 font-mono mt-0.5">{col.columnName}</span>
                        </div>
                      </td>
                      
                      {/* Mandatory Checkbox */}
                      <td className="px-6 py-5 align-top text-center">
                         <input 
                           type="checkbox" 
                           className="w-5 h-5 text-indigo-600 rounded bg-slate-100 border-slate-300 focus:ring-indigo-500 cursor-pointer"
                           checked={col.isMandatory}
                           onChange={(e) => updateColumn(col.columnName, { isMandatory: e.target.checked })}
                         />
                      </td>
                      
                      {/* Data Type */}
                      <td className="px-6 py-5 align-top">
                        <div className="relative">
                          <select 
                            className="w-full appearance-none pl-3 pr-8 py-2 border border-slate-200 rounded-md text-xs bg-white text-slate-700 font-medium outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 cursor-pointer shadow-sm transition-shadow"
                            value={col.type}
                            onChange={(e) => updateColumn(col.columnName, { type: e.target.value as any })}
                          >
                            <option value="string">String</option>
                            <option value="float">Number</option>
                          </select>
                           <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-500">
                            <LucideChevronDown className="h-3 w-3" />
                          </div>
                        </div>
                      </td>
                      
                      {/* Validation Mode */}
                      <td className="px-6 py-5 align-top">
                        <div className="relative">
                          <select 
                            className="w-full appearance-none pl-3 pr-8 py-2 border border-slate-200 rounded-md text-xs bg-white text-slate-700 font-medium outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 cursor-pointer shadow-sm transition-shadow"
                            value={
                              col.validation?.lookup ? 'lookup' : 
                              col.validation?.range ? 'range' : 
                              col.validation?.isKeyReference ? 'key' : 'none'
                            }
                            onChange={(e) => updateValidationType(col.columnName, e.target.value as any)}
                          >
                            <option value="none" className="text-slate-400">No Validation</option>
                            <option value="range">Numeric Range</option>
                            <option value="lookup">Lookup Library</option>
                            <option value="key">Key Reference</option>
                          </select>
                          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-500">
                            <LucideChevronDown className="h-3 w-3" />
                          </div>
                        </div>
                      </td>
                      
                      {/* Rules Configuration */}
                      <td className="px-6 py-5 align-top">
                        {col.validation?.range && (
                          <div className="border border-slate-200 rounded-md p-3 bg-white flex items-center gap-3">
                            <div className="flex-1">
                              <label className="text-[10px] text-slate-500 font-semibold mb-1 block uppercase">Min</label>
                              <input 
                                type="number" 
                                className="w-full px-2 py-1.5 bg-slate-800 text-white rounded text-xs focus:ring-1 focus:ring-indigo-500 outline-none placeholder-slate-500"
                                placeholder="-"
                                value={col.validation.range.min ?? ''}
                                onChange={(e) => updateRangeValue(col.columnName, 'min', e.target.value)}
                              />
                            </div>
                            <span className="text-slate-300 mt-4 font-light text-xl">-</span>
                            <div className="flex-1">
                              <label className="text-[10px] text-slate-500 font-semibold mb-1 block uppercase">Max</label>
                              <input 
                                type="number" 
                                className="w-full px-2 py-1.5 bg-slate-800 text-white rounded text-xs focus:ring-1 focus:ring-indigo-500 outline-none placeholder-slate-500"
                                placeholder="-"
                                value={col.validation.range.max ?? ''}
                                onChange={(e) => updateRangeValue(col.columnName, 'max', e.target.value)}
                              />
                            </div>
                          </div>
                        )}
                        {col.validation?.lookup && (
                           <div className="relative">
                            <select 
                              className="w-full appearance-none pl-3 pr-8 py-2.5 border border-slate-200 rounded-md text-xs bg-white text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                              value={col.validation.lookup.libraryId}
                              onChange={(e) => updateColumn(col.columnName, { validation: { ...col.validation, lookup: { ...col.validation?.lookup!, libraryId: e.target.value } } })}
                            >
                              {libraries.length === 0 && <option value="">No libraries available</option>}
                              {libraries.map(lib => (
                                <option key={lib.id} value={lib.id}>{lib.name}</option>
                              ))}
                            </select>
                             <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-500">
                              <LucideChevronDown className="h-3 w-3" />
                            </div>
                            <p className="text-[10px] text-slate-400 mt-1.5 ml-0.5">Select the library containing valid codes.</p>
                          </div>
                        )}
                        {col.validation?.isKeyReference && (
                          <div className="w-full bg-indigo-50 border border-indigo-100 text-indigo-700 px-3 py-2.5 rounded-md text-xs flex items-center gap-2 font-medium">
                             <LucideCheckCircle className="w-4 h-4 flex-shrink-0" />
                             Validates existence in Collar
                          </div>
                        )}
                        {!col.validation?.range && !col.validation?.lookup && !col.validation?.isKeyReference && (
                          <div className="text-slate-300 text-xs italic py-2">
                            No additional rules needed.
                          </div>
                        )}
                      </td>
                      
                      {/* Delete Action */}
                      <td className="px-4 py-5 align-top text-right">
                         <button onClick={() => removeColumn(col.columnName)} className="text-slate-300 hover:text-red-500 transition-colors p-1 hover:bg-red-50 rounded">
                           <LucideTrash2 className="w-4 h-4" />
                         </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Add Column Section */}
          <div className="bg-slate-50 p-6 rounded-lg border border-slate-200 shadow-sm">
             <h4 className="text-sm font-bold text-slate-800 mb-6 flex items-center gap-2">
               <LucidePlus className="w-4 h-4 text-indigo-600" /> Add Column Validation Rule
             </h4>
             
             <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
               {/* Option A: Pick from Uploaded Data */}
               <div className="flex flex-col gap-3">
                 <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                   Option 1: {isUsingDefaults ? "Select Detected Column (Default)" : "Select Detected Column (From File)"}
                 </label>
                 <div className="flex gap-2">
                    <div className="relative flex-1">
                      <select
                        className="w-full appearance-none pl-3 pr-8 py-2.5 border border-slate-300 rounded-md text-sm bg-white text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer shadow-sm"
                        value={selectedColumnToAdd}
                        onChange={(e) => setSelectedColumnToAdd(e.target.value)}
                      >
                        <option value="">-- Select a column to configure --</option>
                        {unconfiguredColumns.length === 0 ? (
                           <option disabled>All detected columns are configured</option>
                        ) : (
                          unconfiguredColumns.map(col => (
                            <option key={col} value={col}>{col}</option>
                          ))
                        )}
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-500">
                        <LucideChevronDown className="h-4 w-4" />
                      </div>
                    </div>
                    <button 
                      onClick={() => { if(selectedColumnToAdd) { addColumn(selectedColumnToAdd); setSelectedColumnToAdd(''); } }}
                      disabled={!selectedColumnToAdd}
                      className="px-4 py-2 bg-slate-300 text-white text-sm font-bold rounded-md hover:bg-slate-400 disabled:opacity-50 shadow-sm transition-all uppercase tracking-wide"
                    >
                      Add
                    </button>
                 </div>
                 <p className="text-[10px] text-slate-400">
                   Listing columns detected from your uploaded file that don't have rules yet.
                 </p>
               </div>

               {/* Option B: Manual Entry */}
               <div className="flex flex-col gap-3 md:border-l md:border-slate-200 md:pl-10">
                 <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Option 2: Manually Add Column</label>
                 <div className="flex gap-2">
                   <input 
                     className="flex-1 px-3 py-2 bg-slate-700 border border-transparent text-white placeholder-slate-400 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm"
                     placeholder="e.g. alteration_zone"
                     value={newColName}
                     onChange={e => setNewColName(e.target.value)}
                     onKeyDown={e => e.key === 'Enter' && addColumn(newColName)}
                   />
                   <button 
                      onClick={() => addColumn(newColName)}
                      disabled={!newColName}
                      className="px-4 py-2 bg-white border border-slate-300 text-slate-500 text-sm font-bold rounded-md hover:bg-slate-50 disabled:opacity-50 transition-all shadow-sm uppercase tracking-wide"
                   >
                     Add
                   </button>
                 </div>
               </div>
             </div>
          </div>
        </div>
      ) : (
        <div className="text-center p-12 text-slate-400 border-2 border-dashed border-slate-200 rounded-lg m-6">
          No configuration available for this table type yet.
        </div>
      )}
    </div>
  );
};

const DataImportCard = ({
  title,
  data,
  setData,
  requiredColumns
}: {
  title: string,
  data: any[],
  setData: (data: any[]) => void,
  requiredColumns: string[]
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      if (bstr) {
        try {
          const wb = XLSX.read(bstr, { type: 'binary' });
          const wsname = wb.SheetNames[0];
          const ws = wb.Sheets[wsname];
          const jsonData = XLSX.utils.sheet_to_json(ws);
          
          if (jsonData.length === 0) {
             alert("File is empty");
             return;
          }
          
          const normalizedData = normalizeHeaders(jsonData);
          setData(normalizedData);
        } catch (error) {
          console.error(error);
          alert("Failed to parse file");
        }
      }
    };
    reader.readAsBinaryString(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleClear = () => {
    if (confirm(`Are you sure you want to clear all data from ${title}?`)) {
      setData([]);
      setSearchQuery('');
      // Ensure input is reset so if user clears and tries to upload same file, it works
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };
  
  const filteredData = useMemo(() => {
    if (!searchQuery.trim()) return data;
    const lowerQuery = searchQuery.toLowerCase();
    return data.filter(row => 
      Object.entries(row).some(([key, val]) => {
          // Skip internal ID fields if desired, but searching everything is usually fine
          if (key === 'id' || key === 'row_id') return false; 
          return val !== null && val !== undefined && String(val).toLowerCase().includes(lowerQuery);
      })
    );
  }, [data, searchQuery]);

  const currentColumns = data.length > 0 ? Object.keys(data[0]).filter(k => k !== 'id' && k !== 'row_id') : [];

  return (
    <div className="bg-white h-full rounded-lg shadow-sm border border-slate-200 flex flex-col">
      <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
        <div>
           <h3 className="font-bold text-lg text-slate-800">{title} Data</h3>
           <p className="text-xs text-slate-500">
             {filteredData.length !== data.length 
               ? `${filteredData.length} of ${data.length} records found` 
               : `${data.length} records loaded`}
           </p>
        </div>
        <div className="flex gap-2 items-center">
           {data.length > 0 && (
             <div className="relative mr-2">
                <LucideSearch className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
                <input 
                  type="text"
                  placeholder="Search..."
                  className="pl-9 pr-4 py-2 bg-slate-700 border border-transparent text-white placeholder-slate-400 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 outline-none w-48 transition-all"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
             </div>
           )}

           {data.length > 0 && (
             <button 
               onClick={handleClear}
               className="flex items-center gap-2 px-3 py-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors border border-transparent hover:border-red-100"
               title="Clear Data"
             >
               <LucideTrash2 className="w-4 h-4" />
               <span className="text-sm font-medium">Clear Table</span>
             </button>
           )}
           <button 
             onClick={() => fileInputRef.current?.click()}
             className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-md transition-colors shadow-sm"
           >
             <LucideUpload className="w-4 h-4" />
             Import {title}
           </button>
           <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileUpload} 
              className="hidden" 
              accept=".csv, .xlsx, .xls"
            />
        </div>
      </div>

      {data.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-400 bg-slate-50/50">
           <LucideFileSpreadsheet className="w-16 h-16 mb-4 text-slate-300" />
           <p className="font-medium">No data loaded.</p>
           <p className="text-sm">Upload a CSV or Excel file to get started.</p>
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
           <table className="w-full text-left text-sm whitespace-nowrap">
             <thead className="bg-slate-50 text-slate-500 font-bold text-xs uppercase tracking-wider sticky top-0 z-10 shadow-sm">
               <tr>
                 <th className="px-6 py-3 border-b border-slate-200 w-16 text-center">#</th>
                 {currentColumns.map(col => (
                   <th key={col} className={`px-6 py-3 border-b border-slate-200 ${requiredColumns.includes(col) ? 'text-indigo-600' : ''}`}>
                     {col}
                   </th>
                 ))}
               </tr>
             </thead>
             <tbody className="divide-y divide-slate-100">
               {filteredData.length === 0 ? (
                  <tr>
                    <td colSpan={currentColumns.length + 1} className="px-6 py-12 text-center text-slate-400 italic">
                      No matching records found for "{searchQuery}"
                    </td>
                  </tr>
               ) : (
                 <>
                   {filteredData.slice(0, 100).map((row, idx) => (
                     <tr key={row.id || idx} className="hover:bg-slate-50">
                       <td className="px-6 py-2 text-slate-400 font-mono text-xs text-center border-r border-slate-50">{idx + 1}</td>
                       {currentColumns.map(col => (
                         <td key={col} className="px-6 py-2 text-slate-700">
                           {row[col] !== undefined && row[col] !== null ? String(row[col]) : <span className="text-slate-300 italic">null</span>}
                         </td>
                       ))}
                     </tr>
                   ))}
                   {filteredData.length > 100 && (
                      <tr>
                        <td colSpan={currentColumns.length + 1} className="px-6 py-4 text-center text-slate-400 italic bg-slate-50">
                          ... {filteredData.length - 100} more rows ...
                        </td>
                      </tr>
                   )}
                 </>
               )}
             </tbody>
           </table>
        </div>
      )}
    </div>
  );
};

const Dashboard = () => {
  // Data State
  const [collarData, setCollarData] = useState<any[]>(sampleCollar);
  const [surveyData, setSurveyData] = useState<any[]>(sampleSurvey);
  const [lithologyData, setLithologyData] = useState<any[]>(sampleLithology);
  const [assayData, setAssayData] = useState<any[]>(sampleAssay);
  const [mineralizationData, setMineralizationData] = useState<any[]>(sampleMineralization);
  const [oxidationData, setOxidationData] = useState<any[]>(sampleOxidation);
  const [geotechData, setGeotechData] = useState<any[]>(sampleGeotech);
  const [rqdData, setRqdData] = useState<any[]>(sampleRQD);
  const [veinData, setVeinData] = useState<any[]>(sampleVein);

  // Config State with Persistence Logic:
  // 1. Try LocalStorage (Recent Edits)
  // 2. Try userConfig.ts (Project Baseline)
  // 3. Fallback to defaultConfigs (Minimal/Empty)
  const [configs, setConfigs] = useState<TableConfig[]>(() => {
    if (typeof window !== 'undefined') {
        const saved = localStorage.getItem('drillcore_configs');
        if (saved) {
            try {
                return JSON.parse(saved);
            } catch (e) {
                console.error("Error parsing saved configs", e);
            }
        }
    }
    // Type casting because importing JSON can sometimes infer narrower types
    return (userConfig.configs || defaultConfigs) as TableConfig[];
  });

  const [libraries, setLibraries] = useState<CodeLibrary[]>(() => {
    if (typeof window !== 'undefined') {
        const saved = localStorage.getItem('drillcore_libraries');
        if (saved) {
            try {
                return JSON.parse(saved);
            } catch (e) {
                 console.error("Error parsing saved libraries", e);
            }
        }
    }
    return (userConfig.libraries || defaultLibraries) as CodeLibrary[];
  });

  // UI Version State: Used to force remount of configuration components upon import/reset
  // This solves the issue where internal state (tabs, inputs) doesn't reset when parent props change.
  const [configUiVersion, setConfigUiVersion] = useState(0);
  const importConfigRef = useRef<HTMLInputElement>(null);

  // UI State
  const [activeSection, setActiveSection] = useState<'import' | 'config' | 'validate'>('import');
  const [activeImportType, setActiveImportType] = useState<TableType>(TableType.COLLAR);
  const [validationResult, setValidationResult] = useState<ValidationSummary | null>(null);

  // --- Auto-Save Effect ---
  // Automatically saves to localStorage whenever configs or libraries change.
  useEffect(() => {
    try {
      localStorage.setItem('drillcore_configs', JSON.stringify(configs));
      localStorage.setItem('drillcore_libraries', JSON.stringify(libraries));
    } catch (e) {
      console.error("Auto-save failed:", e);
    }
  }, [configs, libraries]);

  const handleExportConfig = () => {
    const payload = {
      timestamp: new Date().toISOString(),
      version: "1.0",
      libraries,
      configs
    };
    
    // Export specifically as JSON so users can overwrite the project file
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(payload, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `userConfig.json`); // Naming it exactly like the system file to hint at replacement
    document.body.appendChild(downloadAnchorNode); 
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const handleImportConfig = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const str = evt.target?.result as string;
        const payload = JSON.parse(str);
        
        // Robust check for payload structure
        if (payload.configs && Array.isArray(payload.configs)) {
           const libraryCount = payload.libraries ? payload.libraries.length : 0;
           const configCount = payload.configs.length;
           const dateStr = payload.timestamp ? new Date(payload.timestamp).toLocaleString() : 'unknown date';

           if(confirm(`Import configuration?\n\nDate: ${dateStr}\nRules: ${configCount} tables\nLibraries: ${libraryCount}\n\nThis will overwrite your current settings.`)) {
             // 1. Immediately Overwrite LocalStorage (Persistence)
             // This ensures that even if the page crashes or is reloaded manually, the new config is the source of truth.
             localStorage.setItem('drillcore_configs', JSON.stringify(payload.configs));
             localStorage.setItem('drillcore_libraries', JSON.stringify(payload.libraries || []));

             // 2. Update React State
             setConfigs(payload.configs);
             setLibraries(payload.libraries || []); 
             
             // 3. Force UI Refresh
             setConfigUiVersion(prev => prev + 1);

             alert("Configuration imported successfully! Click 'Reload System' if you encounter any UI sync issues.");
           }
        } else {
           alert("Error: Invalid configuration file. The JSON must contain a 'configs' array.");
        }
      } catch (err) {
        console.error(err);
        alert("Failed to parse the configuration file. Please ensure it is a valid JSON file exported from this application.");
      } finally {
        // Always reset input so the same file can be selected again if needed
        if (importConfigRef.current) importConfigRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  const handleResetConfig = () => {
    if (confirm("Reset configuration?\n\nThis will clear your local changes and revert to the 'userConfig' file stored in the project source.")) {
      // 1. Reset to User Config File (or defaults if missing)
      const resetConfigs = JSON.parse(JSON.stringify(userConfig.configs || defaultConfigs));
      const resetLibs = JSON.parse(JSON.stringify(userConfig.libraries || defaultLibraries));

      setConfigs(resetConfigs);
      setLibraries(resetLibs);
      
      // 2. Clear LocalStorage so the JSON file remains the source of truth
      localStorage.removeItem('drillcore_configs');
      localStorage.removeItem('drillcore_libraries');

      // 3. Force UI Refresh
      setConfigUiVersion(prev => prev + 1);
    }
  };

  const handleReloadApp = () => {
    if(confirm("Reload the application?\n\nThis will refresh the page and load the latest configuration from storage.")) {
      window.location.reload();
    }
  };

  // ... memoized helpers ...
  // Helper to get columns from data for ConfigPanel
  const getAvailableColumns = (data: any[]) => {
      if (data.length === 0) return [];
      return Object.keys(data[0]).filter(k => k !== 'id' && k !== 'row_id');
  };

  const availableColumnsMap = useMemo(() => ({
    [TableType.COLLAR]: getAvailableColumns(collarData),
    [TableType.SURVEY]: getAvailableColumns(surveyData),
    [TableType.LITHOLOGY]: getAvailableColumns(lithologyData),
    [TableType.ASSAY]: getAvailableColumns(assayData),
    [TableType.MINERALIZATION]: getAvailableColumns(mineralizationData),
    [TableType.OXIDATION]: getAvailableColumns(oxidationData),
    [TableType.GEOTECH]: getAvailableColumns(geotechData),
    [TableType.RQD]: getAvailableColumns(rqdData),
    [TableType.VEIN]: getAvailableColumns(veinData),
  }), [collarData, surveyData, lithologyData, assayData, mineralizationData, oxidationData, geotechData, rqdData, veinData]);

  const hasDataMap = useMemo(() => ({
    [TableType.COLLAR]: collarData.length > 0,
    [TableType.SURVEY]: surveyData.length > 0,
    [TableType.LITHOLOGY]: lithologyData.length > 0,
    [TableType.ASSAY]: assayData.length > 0,
    [TableType.MINERALIZATION]: mineralizationData.length > 0,
    [TableType.OXIDATION]: oxidationData.length > 0,
    [TableType.GEOTECH]: geotechData.length > 0,
    [TableType.RQD]: rqdData.length > 0,
    [TableType.VEIN]: veinData.length > 0,
  }), [collarData, surveyData, lithologyData, assayData, mineralizationData, oxidationData, geotechData, rqdData, veinData]);


  const handleRunValidation = () => {
    const summary = runValidation(
      collarData as CollarRow[],
      surveyData as SurveyRow[],
      lithologyData as IntervalRow[],
      assayData as IntervalRow[],
      mineralizationData as IntervalRow[],
      oxidationData as IntervalRow[],
      geotechData as IntervalRow[],
      rqdData as IntervalRow[],
      veinData as IntervalRow[],
      configs,
      libraries
    );
    setValidationResult(summary);
  };

  const getDataSetter = (type: TableType) => {
    switch (type) {
      case TableType.COLLAR: return setCollarData;
      case TableType.SURVEY: return setSurveyData;
      case TableType.LITHOLOGY: return setLithologyData;
      case TableType.ASSAY: return setAssayData;
      case TableType.MINERALIZATION: return setMineralizationData;
      case TableType.OXIDATION: return setOxidationData;
      case TableType.GEOTECH: return setGeotechData;
      case TableType.RQD: return setRqdData;
      case TableType.VEIN: return setVeinData;
      default: return () => {};
    }
  };

  const getData = (type: TableType) => {
    switch (type) {
      case TableType.COLLAR: return collarData;
      case TableType.SURVEY: return surveyData;
      case TableType.LITHOLOGY: return lithologyData;
      case TableType.ASSAY: return assayData;
      case TableType.MINERALIZATION: return mineralizationData;
      case TableType.OXIDATION: return oxidationData;
      case TableType.GEOTECH: return geotechData;
      case TableType.RQD: return rqdData;
      case TableType.VEIN: return veinData;
      default: return [];
    }
  };

  const renderContent = () => {
    if (activeSection === 'import') {
       return (
         <div className="flex h-full gap-6">
            <div className="w-64 flex-shrink-0 flex flex-col gap-2">
              <h3 className="font-bold text-slate-700 px-2 mb-2 uppercase tracking-wider text-xs">Data Tables</h3>
              {Object.values(TableType).map(type => (
                <button
                  key={type}
                  onClick={() => setActiveImportType(type)}
                  className={`flex items-center justify-between px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                    activeImportType === type 
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200' 
                    : 'bg-white text-slate-600 hover:bg-slate-50 border border-transparent hover:border-slate-200'
                  }`}
                >
                  {type.charAt(0) + type.slice(1).toLowerCase().replace('_', ' ')}
                  {hasDataMap[type] && <LucideCheckCircle className={`w-4 h-4 ${activeImportType === type ? 'text-indigo-200' : 'text-emerald-500'}`} />}
                </button>
              ))}
            </div>
            <div className="flex-1 h-full">
               <DataImportCard 
                 title={activeImportType.charAt(0) + activeImportType.slice(1).toLowerCase().replace('_', ' ')}
                 data={getData(activeImportType)}
                 setData={getDataSetter(activeImportType)}
                 requiredColumns={defaultExpectedColumns[activeImportType] || []}
               />
            </div>
         </div>
       );
    }

    if (activeSection === 'config') {
      return (
        <div className="flex flex-col gap-6 pb-8">
           <div className="flex justify-between items-end bg-white p-6 rounded-lg border border-slate-200 shadow-sm flex-shrink-0">
             <div>
               <h3 className="text-lg font-bold text-slate-800">System Configuration</h3>
               <p className="text-sm text-slate-500 mt-1 flex items-center gap-2">
                 <LucideCheckCircle className="w-3 h-3 text-emerald-500" />
                 All changes are auto-saved to your browser.
               </p>
             </div>
             <div className="flex gap-3">
                <input 
                  type="file" 
                  ref={importConfigRef} 
                  onChange={handleImportConfig} 
                  className="hidden" 
                  accept=".json"
                />
                
                <button 
                   onClick={handleReloadApp}
                   className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 text-amber-700 hover:bg-amber-100 rounded-md text-sm font-medium transition-all shadow-sm"
                   title="Reload Application to apply changes strictly"
                 >
                   <LucideRefreshCw className="w-4 h-4" />
                   Reload System
                 </button>

                 <div className="w-px h-8 bg-slate-200 mx-1"></div>

                <button 
                   onClick={() => importConfigRef.current?.click()}
                   className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-300 text-slate-600 hover:bg-slate-50 rounded-md text-sm font-medium transition-all shadow-sm"
                   title="Import Configuration from JSON"
                 >
                   <LucideUpload className="w-4 h-4" />
                   Import
                 </button>
                <div className="w-px h-8 bg-slate-200 mx-1"></div>
                <button 
                   onClick={handleResetConfig}
                   className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-300 text-slate-600 hover:bg-slate-50 rounded-md text-sm font-medium transition-all shadow-sm"
                 >
                   <LucideRotateCcw className="w-4 h-4" />
                   Reset to Defaults
                 </button>
                <button 
                   onClick={handleExportConfig}
                   className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-sm font-medium transition-all shadow-sm"
                   title="Download config to update the codebase"
                 >
                   <LucideFileJson className="w-4 h-4" />
                   Download Master Config
                 </button>
             </div>
           </div>

           <div className="flex flex-col gap-6">
             {/* Key Prop ensures component fully remounts on Import/Reset */}
             <ConfigPanel 
               key={`config-panel-${configUiVersion}`}
               configs={configs} 
               libraries={libraries} 
               setConfigs={setConfigs}
               availableColumnsMap={availableColumnsMap}
               hasDataMap={hasDataMap}
             />
             <LibraryManager 
               key={`lib-manager-${configUiVersion}`}
               libraries={libraries} 
               setLibraries={setLibraries} 
             />
           </div>
        </div>
      );
    }

    if (activeSection === 'validate') {
      return (
        <div className="h-full flex flex-col bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
           <div className="p-6 border-b border-slate-200 flex items-center justify-between bg-white">
             <div>
               <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                 <LucideActivity className="w-6 h-6 text-indigo-600" /> Validation Report
               </h2>
               <p className="text-slate-500 text-sm mt-1">Run all configured checks against imported data.</p>
             </div>
             <button 
               onClick={handleRunValidation}
               className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg shadow-lg hover:shadow-indigo-200 transition-all active:scale-95"
             >
               <LucidePlayCircle className="w-5 h-5" />
               Run Validation
             </button>
           </div>
           
           <div className="flex-1 overflow-auto bg-slate-50 p-6">
             {!validationResult ? (
               <div className="h-full flex flex-col items-center justify-center text-slate-400">
                  <LucideRotateCcw className="w-16 h-16 mb-4 text-slate-300" />
                  <p className="font-medium">No validation run yet.</p>
                  <p className="text-sm">Click the button above to start.</p>
               </div>
             ) : (
               <div className="space-y-6 max-w-5xl mx-auto">
                 {/* Summary Cards */}
                 <div className="grid grid-cols-3 gap-6">
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                       <div className="p-3 rounded-full bg-red-50 text-red-600">
                         <LucideX className="w-8 h-8" />
                       </div>
                       <div>
                         <div className="text-3xl font-bold text-slate-800">{validationResult.totalErrors}</div>
                         <div className="text-sm text-slate-500 font-medium uppercase tracking-wider">Critical Errors</div>
                       </div>
                    </div>
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                       <div className="p-3 rounded-full bg-amber-50 text-amber-500">
                         <LucideAlertTriangle className="w-8 h-8" />
                       </div>
                       <div>
                         <div className="text-3xl font-bold text-slate-800">{validationResult.totalWarnings}</div>
                         <div className="text-sm text-slate-500 font-medium uppercase tracking-wider">Warnings</div>
                       </div>
                    </div>
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                       <div className="p-3 rounded-full bg-emerald-50 text-emerald-600">
                         <LucideCheckCircle className="w-8 h-8" />
                       </div>
                       <div>
                         <div className="text-3xl font-bold text-slate-800">
                           {validationResult.errors.length === 0 ? 'Passed' : 'Completed'}
                         </div>
                         <div className="text-sm text-slate-500 font-medium uppercase tracking-wider">Status</div>
                       </div>
                    </div>
                 </div>

                 {/* Error List */}
                 <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                   <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                     <h3 className="font-bold text-slate-800">Detailed Issues</h3>
                     <span className="text-xs font-mono text-slate-400 bg-white px-2 py-1 rounded border border-slate-200">
                       {validationResult.errors.length} items
                     </span>
                   </div>
                   {validationResult.errors.length === 0 ? (
                      <div className="p-12 text-center text-slate-400 flex flex-col items-center">
                        <LucideCheckCircle className="w-16 h-16 text-emerald-100 mb-4" />
                        <p className="text-lg font-medium text-emerald-700">No issues found!</p>
                        <p className="text-sm text-emerald-600/70">Your data passed all validation checks.</p>
                      </div>
                   ) : (
                     <div className="divide-y divide-slate-100">
                       {validationResult.errors.map((err) => (
                         <div key={err.id} className="px-6 py-4 hover:bg-slate-50 transition-colors flex gap-4 group">
                           <div className={`mt-1 flex-shrink-0 w-2 h-2 rounded-full ${err.severity === ValidationSeverity.CRITICAL ? 'bg-red-500' : 'bg-amber-400'}`} />
                           <div className="flex-1">
                             <div className="flex items-center gap-2 mb-1">
                               <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                                 err.severity === ValidationSeverity.CRITICAL 
                                 ? 'bg-red-50 text-red-700 border-red-100' 
                                 : 'bg-amber-50 text-amber-700 border-amber-100'
                               }`}>
                                 {err.severity}
                               </span>
                               <span className="text-[10px] font-bold px-2 py-0.5 rounded border bg-slate-50 text-slate-600 border-slate-200">
                                 {err.table}
                               </span>
                               <span className="text-xs font-mono text-slate-500">
                                 SiteID: <span className="text-slate-900 font-bold">{err.siteId}</span>
                               </span>
                               {err.column && (
                                 <span className="text-xs text-slate-400">
                                   Column: {err.column}
                                 </span>
                               )}
                             </div>
                             <p className="text-sm text-slate-700 font-medium">{err.message}</p>
                             <p className="text-xs text-slate-400 mt-1">Error ID: {err.id}</p>
                           </div>
                         </div>
                       ))}
                     </div>
                   )}
                 </div>
               </div>
             )}
           </div>
        </div>
      );
    }
  };

  return (
    <div className="flex h-screen bg-slate-100 font-sans text-slate-900">
       {/* Main Navigation Sidebar */}
       <div className="w-20 bg-slate-900 flex flex-col items-center py-6 gap-8 shadow-xl z-20">
          <div className="w-10 h-10 bg-indigo-500 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/30">
             <LucideLayers className="text-white w-6 h-6" />
          </div>
          
          <nav className="flex flex-col gap-4 w-full px-2">
             <button 
               onClick={() => setActiveSection('import')}
               className={`flex flex-col items-center gap-1 p-3 rounded-lg transition-all group ${activeSection === 'import' ? 'bg-indigo-600/20 text-indigo-400' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`}
             >
               <LucideDatabase className="w-6 h-6" />
               <span className="text-[10px] font-medium">Data</span>
             </button>
             <button 
               onClick={() => setActiveSection('config')}
               className={`flex flex-col items-center gap-1 p-3 rounded-lg transition-all group ${activeSection === 'config' ? 'bg-indigo-600/20 text-indigo-400' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`}
             >
               <LucideSettings className="w-6 h-6" />
               <span className="text-[10px] font-medium">Config</span>
             </button>
             <button 
               onClick={() => setActiveSection('validate')}
               className={`flex flex-col items-center gap-1 p-3 rounded-lg transition-all group ${activeSection === 'validate' ? 'bg-indigo-600/20 text-indigo-400' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`}
             >
               <LucideActivity className="w-6 h-6" />
               <span className="text-[10px] font-medium">Validate</span>
             </button>
          </nav>
       </div>

       {/* Main Content Area */}
       <div className="flex-1 flex flex-col h-full overflow-hidden">
         <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 flex-shrink-0 shadow-sm z-10">
            <div>
              <h1 className="text-lg font-bold text-slate-800">Drillhole Validation Engine</h1>
              <p className="text-xs text-slate-500">
                {activeSection === 'import' && 'Manage and import your geological data tables.'}
                {activeSection === 'config' && 'Configure validation rules, libraries, and thresholds.'}
                {activeSection === 'validate' && 'Review validation results and identify data issues.'}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                 <div className="text-xs font-bold text-slate-700">Project: Demo_2024</div>
                 <div className="text-[10px] text-slate-400">Last saved: Just now</div>
              </div>
              <div className="w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center text-slate-500 font-bold text-xs border border-slate-300">
                 AD
              </div>
            </div>
         </header>

         <main className="flex-1 overflow-auto bg-slate-50 relative p-6">
            {renderContent()}
         </main>
       </div>
    </div>
  );
};

export default Dashboard;