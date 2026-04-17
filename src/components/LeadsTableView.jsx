import React, { useEffect, useMemo, useState } from 'react';
import { ArrowUpDown, Save, RotateCcw, Loader2 } from 'lucide-react';
import { ORDERED_STAGES, normalizeLinkedInUrl, normalizeStage, toBool } from '../lib/utils';

const COLUMNS = [
  { key: 'Name', label: 'Name', type: 'text', scope: 'lead' },
  { key: 'Title', label: 'Title', type: 'text', scope: 'lead' },
  { key: 'Company', label: 'Company', type: 'text', scope: 'lead' },
  { key: 'Employees', label: 'Employees', type: 'number', scope: 'company' },
  { key: 'Stage', label: 'Stage', type: 'stage', scope: 'lead' },
  { key: 'Owner', label: 'Owner', type: 'owner', scope: 'lead' },
  { key: 'Email', label: 'Email', type: 'text', scope: 'lead' },
  { key: 'LinkedIn', label: 'LinkedIn', type: 'text', scope: 'lead' },
  { key: 'Phone', label: 'Phone', type: 'text', scope: 'lead' },
  { key: 'City', label: 'City', type: 'text', scope: 'lead' },
  { key: 'Country', label: 'Country', type: 'text', scope: 'lead' },
  { key: 'Next Date', label: 'Next Date', type: 'text', scope: 'lead' },
  { key: 'Next Action', label: 'Next Action', type: 'text', scope: 'lead' },
  { key: 'Beta', label: 'Beta', type: 'bool', scope: 'lead' },
  { key: 'Trial', label: 'Trial', type: 'bool', scope: 'lead' }
];

const normalizeComparable = (value, type) => {
  if (type === 'number') {
    const n = Number(String(value || '').replace(/[^0-9.-]/g, ''));
    return Number.isFinite(n) ? n : -Infinity;
  }
  if (type === 'bool') {
    return toBool(value) ? 1 : 0;
  }
  return String(value || '').toLowerCase();
};

export const LeadsTableView = ({ leads, companies, owners, searchQuery, onSaveAll, onToast }) => {
  const [draftLeads, setDraftLeads] = useState(leads);
  const [draftCompanies, setDraftCompanies] = useState(companies);
  const [sortBy, setSortBy] = useState('Name');
  const [sortDir, setSortDir] = useState('asc');
  const [isDirty, setIsDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isDirty) return;
    setDraftLeads(leads);
    setDraftCompanies(companies);
  }, [leads, companies, isDirty]);

  const getCellValue = (lead, column) => {
    if (column.scope === 'company') {
      const companyData = draftCompanies[lead.Company] || {};
      return companyData[column.key] || '';
    }
    return lead[column.key] || '';
  };

  const filteredAndSortedLeads = useMemo(() => {
    const q = String(searchQuery || '').trim().toLowerCase();
    const filtered = !q
      ? draftLeads
      : draftLeads.filter(lead => {
          return COLUMNS.some(col => String(getCellValue(lead, col) || '').toLowerCase().includes(q));
        });

    const sortColumn = COLUMNS.find(c => c.key === sortBy);
    if (!sortColumn) return filtered;

    return [...filtered].sort((a, b) => {
      const av = normalizeComparable(getCellValue(a, sortColumn), sortColumn.type);
      const bv = normalizeComparable(getCellValue(b, sortColumn), sortColumn.type);
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [draftLeads, draftCompanies, searchQuery, sortBy, sortDir]);

  const setLeadField = (leadId, key, value) => {
    setDraftLeads(prev => prev.map(lead => {
      if (lead.id !== leadId) return lead;
      if (key === 'Stage') return { ...lead, Stage: normalizeStage(value) };
      if (key === 'Beta' || key === 'Trial') return { ...lead, [key]: value ? 'true' : 'false' };
      return { ...lead, [key]: value };
    }));
    setIsDirty(true);
  };

  const setCompanyField = (companyName, key, value) => {
    const safeCompany = String(companyName || '').trim();
    if (!safeCompany) return;

    setDraftCompanies(prev => {
      const existing = prev[safeCompany] || { Company: safeCompany };
      const nextValue = key === 'Employees'
        ? String(value || '').replace(/[^0-9]/g, '')
        : value;
      return {
        ...prev,
        [safeCompany]: {
          ...existing,
          [key]: nextValue
        }
      };
    });
    setIsDirty(true);
  };

  const handleSort = (columnKey) => {
    if (sortBy === columnKey) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
      return;
    }
    setSortBy(columnKey);
    setSortDir('asc');
  };

  const handleReset = () => {
    setDraftLeads(leads);
    setDraftCompanies(companies);
    setIsDirty(false);
  };

  const handleSave = async () => {
    if (!isDirty || saving) return;
    setSaving(true);
    try {
      await onSaveAll(draftLeads, draftCompanies);
      setIsDirty(false);
      onToast('success', 'Spreadsheet changes saved');
    } catch (e) {
      console.error(e);
      onToast('error', 'Failed saving spreadsheet changes');
    } finally {
      setSaving(false);
    }
  };

  const renderCell = (lead, column) => {
    const rawValue = getCellValue(lead, column);

    if (column.type === 'stage') {
      return (
        <select
          value={normalizeStage(rawValue)}
          onChange={(e) => setLeadField(lead.id, column.key, e.target.value)}
          className="w-full bg-transparent text-xs outline-none"
        >
          {ORDERED_STAGES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      );
    }

    if (column.type === 'owner') {
      return (
        <>
          <input
            list="owners-list-table"
            value={rawValue}
            onChange={(e) => setLeadField(lead.id, column.key, e.target.value)}
            className="w-full bg-transparent text-xs outline-none"
            placeholder="Unassigned"
          />
          <datalist id="owners-list-table">
            {owners.map(owner => <option key={owner} value={owner} />)}
          </datalist>
        </>
      );
    }

    if (column.type === 'bool') {
      return (
        <input
          type="checkbox"
          checked={toBool(rawValue)}
          onChange={(e) => setLeadField(lead.id, column.key, e.target.checked)}
          className="w-4 h-4"
        />
      );
    }

    if (column.scope === 'company') {
      return (
        <input
          type={column.type === 'number' ? 'text' : 'text'}
          value={rawValue}
          onChange={(e) => setCompanyField(lead.Company, column.key, e.target.value)}
          className="w-full bg-transparent text-xs outline-none"
          placeholder={column.type === 'number' ? '0' : ''}
        />
      );
    }

    return (
      <input
        value={rawValue}
        onChange={(e) => setLeadField(lead.id, column.key, e.target.value)}
        onBlur={(e) => {
          if (column.key === 'LinkedIn') {
            setLeadField(lead.id, 'LinkedIn', normalizeLinkedInUrl(e.target.value));
          }
        }}
        className="w-full bg-transparent text-xs outline-none"
      />
    );
  };

  return (
    <div className="h-full flex flex-col p-6 gap-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-slate-500">
          Rows: <span className="font-semibold text-slate-700">{filteredAndSortedLeads.length}</span>
          {isDirty && <span className="ml-3 text-amber-600 font-semibold">Unsaved changes</span>}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleReset}
            disabled={!isDirty || saving}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-600 text-sm font-semibold disabled:opacity-40"
          >
            <RotateCcw size={14} /> Reset
          </button>
          <button
            onClick={handleSave}
            disabled={!isDirty || saving}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold disabled:opacity-40"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Save All
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto bg-white border border-slate-200 rounded-xl">
        <table className="min-w-[1600px] w-full border-collapse">
          <thead className="sticky top-0 bg-slate-50 z-10">
            <tr>
              {COLUMNS.map(col => (
                <th key={col.key} className="text-left px-3 py-2 border-b border-slate-200">
                  <button
                    onClick={() => handleSort(col.key)}
                    className="w-full flex items-center justify-between text-[11px] uppercase tracking-wider font-bold text-slate-500"
                  >
                    <span>{col.label}</span>
                    <ArrowUpDown size={12} className={sortBy === col.key ? 'text-indigo-600' : 'text-slate-300'} />
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredAndSortedLeads.map((lead) => (
              <tr key={lead.id} className="odd:bg-white even:bg-slate-50/40 hover:bg-indigo-50/40">
                {COLUMNS.map(col => (
                  <td key={`${lead.id}-${col.key}`} className="px-3 py-2 border-b border-slate-100 align-middle">
                    {renderCell(lead, col)}
                  </td>
                ))}
              </tr>
            ))}
            {filteredAndSortedLeads.length === 0 && (
              <tr>
                <td colSpan={COLUMNS.length} className="py-12 text-center text-slate-400 text-sm">
                  No leads found for the current search.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
