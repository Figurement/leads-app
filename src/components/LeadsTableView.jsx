import React, {
  memo,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { ArrowUpDown, CheckCircle2, Loader2, TriangleAlert } from 'lucide-react';
import { ORDERED_STAGES, generateId, normalizeLinkedInUrl, normalizeStage, toBool } from '../lib/utils';
import { COMPANY_FIELDS, LEAD_FIELDS, createEmptyCompany, createEmptyLead } from '../lib/schema';

const TABLE_DRAFT_STORAGE_KEY = 'leads-table-draft-v2';
const AUTO_SAVE_DELAY_MS = 1200;
const BLANK_APPEND_ROWS = 6;

const TABLE_FIELD_KEYS = [
  'Name',
  'Title',
  'Company',
  'Employees',
  'Stage',
  'Owner',
  'Email',
  'PersonalEmail',
  'LinkedIn',
  'Phone',
  'City',
  'Country',
  'Next Date',
  'Next Action',
  'Beta',
  'Trial',
];

const COLUMN_WIDTH_OVERRIDES = {
  Name: 'minmax(14rem, 1.3fr)',
  Title: 'minmax(14rem, 1.2fr)',
  Company: 'minmax(14rem, 1.25fr)',
  Employees: '7.5rem',
  Stage: '10rem',
  Owner: '10rem',
  Email: 'minmax(15rem, 1.4fr)',
  PersonalEmail: 'minmax(15rem, 1.4fr)',
  LinkedIn: 'minmax(16rem, 1.5fr)',
  Phone: '10rem',
  City: '10rem',
  Country: '10rem',
  'Next Date': '9rem',
  'Next Action': 'minmax(16rem, 1.6fr)',
  Beta: '5.5rem',
  Trial: '5.5rem',
};

const COLUMNS = TABLE_FIELD_KEYS.map((key) => {
  const companyDef = COMPANY_FIELDS[key];
  const leadDef = LEAD_FIELDS[key];
  const def = companyDef || leadDef;

  return {
    key,
    label: def?.label || key,
    type: def?.type || 'string',
    scope: companyDef ? 'company' : 'lead',
  };
});

const getDraftOwnerValue = (ownerFilter) => {
  if (ownerFilter === 'Unassigned') return '';
  return String(ownerFilter || '').trim();
};

const createDraftLead = (ownerFilter = '') => ({
  ...createEmptyLead(),
  id: generateId('sheet'),
  Stage: 'New',
  Beta: 'false',
  Trial: 'false',
  Owner: getDraftOwnerValue(ownerFilter),
  Notes: '',
  History: '',
});

const cloneLeadArray = (leads) => leads.map((lead) => ({ ...lead }));

const cloneCompanyMap = (companies) => {
  const next = {};
  Object.entries(companies || {}).forEach(([key, value]) => {
    next[key] = { ...value };
  });
  return next;
};

const getCompanyRecord = (companies, companyName) => {
  const safeName = String(companyName || '').trim();
  if (!safeName) return null;
  return companies[safeName] || createEmptyCompany(safeName);
};

const normalizeComparable = (value, type) => {
  if (type === 'number') {
    const parsed = Number(String(value || '').replace(/[^0-9.-]/g, ''));
    return Number.isFinite(parsed) ? parsed : -Infinity;
  }

  if (type === 'bool') return toBool(value) ? 1 : 0;

  return String(value || '').toLowerCase();
};

const normalizeStageInput = (value, fallback = 'New') => {
  const raw = normalizeStage(value);
  if (!raw) return fallback;
  return ORDERED_STAGES.find((stage) => stage.toLowerCase() === raw.toLowerCase()) || fallback;
};

const normalizeLinkedInInput = (value) => {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '';
  const normalized = normalizeLinkedInUrl(trimmed);
  return normalized || trimmed;
};

const normalizeCellValue = (column, value, fallbackStage = 'New') => {
  if (column.type === 'bool') return toBool(value) ? 'true' : 'false';
  if (column.type === 'number') return String(value || '').replace(/[^0-9]/g, '');
  if (column.key === 'Stage') return normalizeStageInput(value, fallbackStage);
  if (column.key === 'LinkedIn') return normalizeLinkedInInput(value);
  return String(value ?? '');
};

const hasRequiredLeadFields = (lead) => {
  return Boolean(
    String(lead?.Name || '').trim()
    && String(lead?.Company || '').trim()
  );
};

const isEffectivelyEmptyLead = (lead) => {
  if (!lead) return true;

  return TABLE_FIELD_KEYS.every((key) => {
    if (key === 'Stage') return normalizeStageInput(lead[key] || 'New') === 'New';
    if (key === 'Beta' || key === 'Trial') return !toBool(lead[key]);
    return String(lead[key] || '').trim() === '';
  });
};

const parseClipboardMatrix = (text) => {
  return String(text || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .filter((row, index, rows) => row.length > 0 || index < rows.length - 1)
    .map((row) => row.split('\t'));
};

const estimateColumnWidth = (column, leads, companies) => {
  if (COLUMN_WIDTH_OVERRIDES[column.key]) return COLUMN_WIDTH_OVERRIDES[column.key];

  const sample = leads.slice(0, 80);
  const longestValue = sample.reduce((longest, lead) => {
    const value = column.scope === 'company'
      ? companies[String(lead.Company || '').trim()]?.[column.key]
      : lead[column.key];
    return Math.max(longest, String(value || '').trim().length);
  }, column.label.length);

  const clamped = Math.max(8, Math.min(longestValue + 2, 28));
  return `minmax(${Math.max(8, Math.min(clamped, 16))}rem, ${clamped}ch)`;
};

const rowToneClass = (state) => {
  if (state === 'invalid-existing') return 'bg-amber-50/80';
  if (state === 'draft-new') return 'bg-sky-50/70';
  return 'bg-white';
};

const getMissingCriticalField = (lead, column) => {
  if (column.key === 'Name' || column.key === 'Company') {
    const value = String(lead?.[column.key] || '').trim();
    return !value;
  }
  return false;
};

const TableRow = memo(function TableRow({
  row,
  rowIndex,
  company,
  columns,
  gridTemplateColumns,
  invalidState,
  onTextChange,
  onBooleanChange,
  onCellPaste,
}) {
  const renderCell = (column) => {
    const rawValue = column.scope === 'company'
      ? (company?.[column.key] ?? '')
      : (row?.lead?.[column.key] ?? '');

    const isMissingCritical = row.lead && !row.lead.id?.startsWith('sheet') && getMissingCriticalField(row.lead, column);
    const inputClass = `w-full min-w-0 rounded-md border ${isMissingCritical ? 'border-amber-300 bg-amber-50/30' : 'border-transparent bg-transparent'} px-2 py-1.5 text-xs text-slate-700 outline-none transition focus:border-indigo-300 focus:bg-white focus:ring-2 focus:ring-indigo-100`;

    if (column.type === 'stage') {
      return (
        <select
          value={normalizeStageInput(rawValue, row?.lead?.Stage || 'New')}
          onChange={(event) => onTextChange(row, column, event.target.value)}
          className={`${inputClass} appearance-none pr-7`}
        >
          {ORDERED_STAGES.map((stage) => (
            <option key={stage} value={stage}>{stage}</option>
          ))}
        </select>
      );
    }

    if (column.type === 'bool') {
      return (
        <div className="flex h-full items-center justify-center">
          <input
            type="checkbox"
            checked={toBool(rawValue)}
            onChange={(event) => onBooleanChange(row, column, event.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
          />
        </div>
      );
    }

    return (
      <input
        value={rawValue}
        onChange={(event) => onTextChange(row, column, event.target.value)}
        className={inputClass}
        placeholder={row.kind === 'blank'
          ? (column.key === 'Name' ? 'Paste or type…' : '')
          : (column.key === 'Owner' ? 'Unassigned' : '')}
        list={column.key === 'Owner' ? 'owners-list-table' : undefined}
      />
    );
  };

  return (
    <div
      className={`grid min-w-max border-b border-slate-100 hover:bg-indigo-50/40 ${rowToneClass(invalidState)}`}
      style={{ gridTemplateColumns }}
    >
      {columns.map((column) => (
        <div
          key={`${row.key}-${column.key}`}
          className="min-w-0 px-2 py-1.5"
          onPaste={(event) => onCellPaste(event, rowIndex, column.key)}
        >
          {renderCell(column)}
        </div>
      ))}
    </div>
  );
});

export const LeadsTableView = ({
  leads,
  companies,
  searchQuery,
  ownerFilter,
  onSaveAll,
  onToast,
}) => {
  const [draftLeads, setDraftLeads] = useState(leads);
  const [draftCompanies, setDraftCompanies] = useState(companies);
  const [sortBy, setSortBy] = useState('Name');
  const [sortDir, setSortDir] = useState('asc');
  const [saveState, setSaveState] = useState('idle');
  const [statusText, setStatusText] = useState('');
  const [dirtyVersion, setDirtyVersion] = useState(0);
  const [restoredDraft, setRestoredDraft] = useState(false);

  const deferredSearchQuery = useDeferredValue(searchQuery);
  const saveInFlightRef = useRef(false);
  const pendingSaveRef = useRef(false);
  const latestVersionRef = useRef(0);
  const restoredOnceRef = useRef(false);

  const leadSourceMap = useMemo(() => {
    const source = new Map();
    leads.forEach((lead) => source.set(lead.id, lead));
    return source;
  }, [leads]);

  const ownerOptions = useMemo(() => {
    return [...new Set(draftLeads.map((lead) => String(lead?.Owner || '').trim()).filter(Boolean))].sort();
  }, [draftLeads]);

  useEffect(() => {
    latestVersionRef.current = dirtyVersion;
  }, [dirtyVersion]);

  useEffect(() => {
    if (saveState === 'saving' || saveState === 'dirty' || saveState === 'error') return;
    setDraftLeads(leads);
    setDraftCompanies(companies);
  }, [companies, leads, saveState]);

  useEffect(() => {
    if (restoredOnceRef.current) return;
    restoredOnceRef.current = true;

    try {
      const raw = localStorage.getItem(TABLE_DRAFT_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed?.draftLeads) || !parsed?.draftCompanies) return;

      if (JSON.stringify(parsed.draftLeads) === JSON.stringify(leads) && JSON.stringify(parsed.draftCompanies) === JSON.stringify(companies)) {
        localStorage.removeItem(TABLE_DRAFT_STORAGE_KEY);
        return;
      }

      if (window.confirm('Restore the unsaved spreadsheet draft from this browser session?')) {
        setDraftLeads(parsed.draftLeads);
        setDraftCompanies(parsed.draftCompanies);
        setRestoredDraft(true);
        setSaveState('dirty');
        setStatusText('Unsaved spreadsheet draft restored locally');
        setDirtyVersion((value) => value + 1);
      } else {
        localStorage.removeItem(TABLE_DRAFT_STORAGE_KEY);
      }
    } catch {
      localStorage.removeItem(TABLE_DRAFT_STORAGE_KEY);
    }
  }, [companies, leads]);

  const getCellValue = useCallback((lead, column, companyMap = draftCompanies) => {
    if (column.scope === 'company') {
      const companyName = String(lead?.Company || '').trim();
      return companyMap[companyName]?.[column.key] || '';
    }
    return lead?.[column.key] || '';
  }, [draftCompanies]);

  const filteredAndSortedLeads = useMemo(() => {
    const q = String(deferredSearchQuery || '').trim().toLowerCase();
    const ownerFiltered = !ownerFilter
      ? draftLeads
      : draftLeads.filter((lead) => (lead.Owner || 'Unassigned') === ownerFilter);

    const filtered = !q
      ? ownerFiltered
      : ownerFiltered.filter((lead) => COLUMNS.some((column) => String(getCellValue(lead, column) || '').toLowerCase().includes(q)));

    const sortColumn = COLUMNS.find((column) => column.key === sortBy);
    if (!sortColumn) return filtered;

    return [...filtered].sort((a, b) => {
      const aValue = normalizeComparable(getCellValue(a, sortColumn), sortColumn.type);
      const bValue = normalizeComparable(getCellValue(b, sortColumn), sortColumn.type);
      if (aValue < bValue) return sortDir === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [deferredSearchQuery, draftLeads, getCellValue, ownerFilter, sortBy, sortDir]);

  const invalidExistingLeadIds = useMemo(() => {
    const invalid = new Set();
    draftLeads.forEach((lead) => {
      if (!leadSourceMap.has(lead.id)) return;
      if (!hasRequiredLeadFields(lead)) invalid.add(lead.id);
    });
    return invalid;
  }, [draftLeads, leadSourceMap]);

  const incompleteCriticalCount = useMemo(() => {
    return draftLeads.filter((lead) => !isEffectivelyEmptyLead(lead) && !hasRequiredLeadFields(lead)).length;
  }, [draftLeads]);

  const visibleRows = useMemo(() => {
    const rows = filteredAndSortedLeads.map((lead) => ({ kind: 'lead', key: lead.id, lead }));
    if (String(deferredSearchQuery || '').trim()) return rows;

    for (let index = 0; index < BLANK_APPEND_ROWS; index += 1) {
      rows.push({ kind: 'blank', key: `blank-${index}`, lead: createDraftLead(ownerFilter) });
    }

    return rows;
  }, [deferredSearchQuery, filteredAndSortedLeads, ownerFilter]);

  const gridTemplateColumns = useMemo(() => {
    return COLUMNS.map((column) => estimateColumnWidth(column, filteredAndSortedLeads, draftCompanies)).join(' ');
  }, [draftCompanies, filteredAndSortedLeads]);

  const markDirty = useCallback((message) => {
    if (saveInFlightRef.current) pendingSaveRef.current = true;
    setSaveState('dirty');
    setStatusText(message);
    setDirtyVersion((value) => value + 1);
  }, []);

  const updateSingleCell = useCallback((row, column, value) => {
    const nextDraftCompanies = cloneCompanyMap(draftCompanies);

    setDraftLeads((currentLeads) => {
      const nextDraftLeads = cloneLeadArray(currentLeads);
      const rowIndex = row.kind === 'lead' ? nextDraftLeads.findIndex((lead) => lead.id === row.key) : -1;
      const targetLead = rowIndex >= 0 ? nextDraftLeads[rowIndex] : createDraftLead(ownerFilter);

      if (rowIndex < 0) nextDraftLeads.push(targetLead);

      const fallbackStage = targetLead.Stage || 'New';
      const normalizedValue = normalizeCellValue(column, value, fallbackStage);

      if (column.scope === 'company') {
        const companyName = String(targetLead.Company || '').trim();
        if (companyName) {
          nextDraftCompanies[companyName] = {
            ...getCompanyRecord(nextDraftCompanies, companyName),
            Company: companyName,
            [column.key]: normalizedValue,
          };
        }
      } else {
        targetLead[column.key] = normalizedValue;
        if (column.key === 'Company') {
          const companyName = String(normalizedValue || '').trim();
          if (companyName && !nextDraftCompanies[companyName]) {
            nextDraftCompanies[companyName] = createEmptyCompany(companyName);
          }
        }
      }

      return nextDraftLeads;
    });

    setDraftCompanies(nextDraftCompanies);
    markDirty(row.kind === 'blank' ? 'New spreadsheet row started locally' : 'Spreadsheet updated locally');
  }, [draftCompanies, markDirty, ownerFilter]);

  const handleTextChange = useCallback((row, column, value) => {
    updateSingleCell(row, column, value);
  }, [updateSingleCell]);

  const handleBooleanChange = useCallback((row, column, checked) => {
    updateSingleCell(row, column, checked ? 'true' : 'false');
  }, [updateSingleCell]);

  const handleCellPaste = useCallback((event, startRowIndex, columnKey) => {
    const clipboardText = event.clipboardData?.getData('text/plain') || '';
    const matrix = parseClipboardMatrix(clipboardText);
    if (!matrix.length) return;

    const isMultiCellPaste = matrix.length > 1 || matrix[0].length > 1;
    if (!isMultiCellPaste) return;

    event.preventDefault();

    const startColumnIndex = COLUMNS.findIndex((column) => column.key === columnKey);
    if (startColumnIndex === -1) return;

    const nextDraftLeads = cloneLeadArray(draftLeads);
    const nextDraftCompanies = cloneCompanyMap(draftCompanies);
    const leadIndexById = new Map(nextDraftLeads.map((lead, index) => [lead.id, index]));

    for (let rowOffset = 0; rowOffset < matrix.length; rowOffset += 1) {
      const visualRow = visibleRows[startRowIndex + rowOffset];
      let lead;

      if (visualRow?.kind === 'lead') {
        const targetIndex = leadIndexById.get(visualRow.key);
        if (targetIndex == null) continue;
        lead = nextDraftLeads[targetIndex];
      } else {
        lead = createDraftLead(ownerFilter);
        nextDraftLeads.push(lead);
        leadIndexById.set(lead.id, nextDraftLeads.length - 1);
      }

      for (let columnOffset = 0; columnOffset < matrix[rowOffset].length; columnOffset += 1) {
        const column = COLUMNS[startColumnIndex + columnOffset];
        if (!column) continue;

        const fallbackStage = lead.Stage || 'New';
        const normalizedValue = normalizeCellValue(column, matrix[rowOffset][columnOffset], fallbackStage);

        if (column.scope === 'company') {
          const companyName = String(lead.Company || '').trim();
          if (!companyName) continue;
          nextDraftCompanies[companyName] = {
            ...getCompanyRecord(nextDraftCompanies, companyName),
            Company: companyName,
            [column.key]: normalizedValue,
          };
        } else {
          lead[column.key] = normalizedValue;
          if (column.key === 'Company') {
            const companyName = String(normalizedValue || '').trim();
            if (companyName && !nextDraftCompanies[companyName]) {
              nextDraftCompanies[companyName] = createEmptyCompany(companyName);
            }
          }
        }
      }
    }

    setDraftLeads(nextDraftLeads);
    setDraftCompanies(nextDraftCompanies);
    markDirty('Spreadsheet paste applied locally');
  }, [draftCompanies, draftLeads, markDirty, ownerFilter, visibleRows]);

  const handleSort = useCallback((columnKey) => {
    if (sortBy === columnKey) {
      setSortDir((value) => (value === 'asc' ? 'desc' : 'asc'));
      return;
    }

    setSortBy(columnKey);
    setSortDir('asc');
  }, [sortBy]);

  const flushSave = useCallback(async (reason = 'Spreadsheet auto-saved') => {
    if (saveInFlightRef.current) {
      pendingSaveRef.current = true;
      return;
    }

    const versionAtStart = latestVersionRef.current;
    const persistableLeads = [];

    draftLeads.forEach((lead) => {
      if (hasRequiredLeadFields(lead)) {
        persistableLeads.push(lead);
        return;
      }

      const original = leadSourceMap.get(lead.id);
      if (original) persistableLeads.push(original);
    });

    const hasPersistableChanges = JSON.stringify(persistableLeads) !== JSON.stringify(leads)
      || JSON.stringify(draftCompanies) !== JSON.stringify(companies);

    if (!hasPersistableChanges) {
      setSaveState('idle');
      setStatusText('');
      localStorage.removeItem(TABLE_DRAFT_STORAGE_KEY);
      return;
    }

    saveInFlightRef.current = true;
    setSaveState('saving');
    setStatusText('Saving spreadsheet changes…');

    try {
      if (hasPersistableChanges) {
        await onSaveAll(persistableLeads, draftCompanies);
      }

      const changedDuringSave = latestVersionRef.current !== versionAtStart;

      if (!changedDuringSave) {
        setSaveState('saved');
        setStatusText(reason);
        localStorage.removeItem(TABLE_DRAFT_STORAGE_KEY);
      } else {
        setSaveState('dirty');
        setStatusText('More edits arrived during save; syncing again');
      }

      if (reason === 'Spreadsheet saved now') {
        onToast('success', 'Spreadsheet changes saved');
      }
    } catch (error) {
      console.error(error);
      setSaveState('error');
      setStatusText('Save failed. Local draft is still preserved in this browser');
      onToast('error', 'Spreadsheet save failed. Local draft kept in browser');
    } finally {
      saveInFlightRef.current = false;

      if (pendingSaveRef.current) {
        pendingSaveRef.current = false;
        void flushSave('Spreadsheet auto-saved');
      }
    }
  }, [companies, draftCompanies, draftLeads, leadSourceMap, leads, onSaveAll, onToast]);

  useEffect(() => {
    const hasAnyDifference = JSON.stringify(draftLeads) !== JSON.stringify(leads)
      || JSON.stringify(draftCompanies) !== JSON.stringify(companies);

    if (!hasAnyDifference) {
      if (saveState !== 'saving') {
        setSaveState('idle');
      }
      return undefined;
    }

    const timer = window.setTimeout(() => {
      void flushSave();
    }, AUTO_SAVE_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, [companies, draftCompanies, draftLeads, flushSave, leads, saveState]);

  useEffect(() => {
    const hasAnyDifference = JSON.stringify(draftLeads) !== JSON.stringify(leads)
      || JSON.stringify(draftCompanies) !== JSON.stringify(companies);

    if (!hasAnyDifference) {
      localStorage.removeItem(TABLE_DRAFT_STORAGE_KEY);
      return;
    }

    const timer = window.setTimeout(() => {
      try {
        localStorage.setItem(TABLE_DRAFT_STORAGE_KEY, JSON.stringify({
          savedAt: new Date().toISOString(),
          draftLeads,
          draftCompanies,
        }));
      } catch {
        // Ignore storage issues; in-memory draft still exists.
      }
    }, 200);

    return () => window.clearTimeout(timer);
  }, [companies, draftCompanies, draftLeads, leads]);

  useEffect(() => {
    const handleBeforeUnload = (event) => {
      const hasUnsavedState = saveState === 'saving'
        || saveState === 'dirty'
        || saveState === 'error';

      if (!hasUnsavedState) return;
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [saveState]);

  return (
    <div className="flex h-full flex-col gap-4 p-6">
      <datalist id="owners-list-table">
        {ownerOptions.map((owner) => <option key={owner} value={owner} />)}
      </datalist>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-700">Spreadsheet editor</div>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-500">
            <span>{filteredAndSortedLeads.length} synced row{filteredAndSortedLeads.length === 1 ? '' : 's'}</span>
            <span>Paste a full range into any cell. Extra rows append automatically.</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <div className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-semibold ${saveState === 'saving'
            ? 'bg-indigo-50 text-indigo-700'
            : saveState === 'saved'
              ? 'bg-emerald-50 text-emerald-700'
              : saveState === 'error'
                ? 'bg-rose-50 text-rose-700'
                : saveState === 'dirty'
                  ? 'bg-amber-50 text-amber-700'
                  : 'bg-slate-100 text-slate-600'
            }`}>
            {saveState === 'saving' ? <Loader2 size={12} className="animate-spin" /> : null}
            {saveState === 'saved' ? <CheckCircle2 size={12} /> : null}
            {saveState === 'error' ? <TriangleAlert size={12} /> : null}
            <span>{statusText || 'Autosave ready'}</span>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="min-w-max">
          <div className="sticky top-0 z-20 grid border-b border-slate-200 bg-slate-50" style={{ gridTemplateColumns }}>
            {COLUMNS.map((column) => (
              <div key={column.key} className="px-2 py-2">
                <button
                  onClick={() => handleSort(column.key)}
                  className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500 hover:bg-white"
                >
                  <span className="truncate">{column.label}</span>
                  <ArrowUpDown size={12} className={sortBy === column.key ? 'text-indigo-600' : 'text-slate-300'} />
                </button>
              </div>
            ))}
          </div>

          {visibleRows.map((row, rowIndex) => {
            const companyName = String(row.lead?.Company || '').trim();
            const company = draftCompanies[companyName] || null;
            const invalidState = row.kind === 'blank'
              ? 'draft-new'
              : invalidExistingLeadIds.has(row.key)
                ? 'invalid-existing'
                : (!leadSourceMap.has(row.key) && !hasRequiredLeadFields(row.lead) ? 'draft-new' : 'valid');

            return (
              <TableRow
                key={row.key}
                row={row}
                rowIndex={rowIndex}
                company={company}
                columns={COLUMNS}
                gridTemplateColumns={gridTemplateColumns}
                invalidState={invalidState}
                onTextChange={handleTextChange}
                onBooleanChange={handleBooleanChange}
                onCellPaste={handleCellPaste}
              />
            );
          })}

          {visibleRows.length === 0 && (
            <div className="py-16 text-center text-sm text-slate-400">
              No leads found for the current search.
            </div>
          )}
        </div>
      </div>

      {restoredDraft && (
        <div className="text-xs text-slate-500">
          A local browser draft was restored from your last session.
        </div>
      )}
    </div>
  );
};
