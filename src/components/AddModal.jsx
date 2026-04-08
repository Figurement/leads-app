import React, { useState, useMemo } from 'react';
import { Loader2, Sparkles, AlertCircle, X } from 'lucide-react';
import Papa from 'papaparse';

const BULK_COLUMNS = ['Name', 'Title', 'Company', 'Email', 'Phone', 'LinkedIn', 'City', 'Country', 'Owner', 'Stage', 'Notes', 'Beta', 'Trial', 'id'];
const BULK_FALLBACK_ORDER = ['Name', 'Title', 'Company', 'Email', 'Phone', 'LinkedIn', 'City', 'Country', 'Owner', 'Stage', 'Notes', 'Beta', 'Trial', 'id'];

const HEADER_ALIASES = {
    name: 'Name',
    full_name: 'Name',
    fullname: 'Name',
    title: 'Title',
    role: 'Title',
    company: 'Company',
    organization: 'Company',
    email: 'Email',
    phone: 'Phone',
    linkedin: 'LinkedIn',
    linkedin_url: 'LinkedIn',
    city: 'City',
    country: 'Country',
    owner: 'Owner',
    stage: 'Stage',
    notes: 'Notes',
    note: 'Notes',
    comments: 'Notes',
    comment: 'Notes',
    beta: 'Beta',
    trial: 'Trial',
    id: 'id'
};

const normalizeHeader = (header) => {
    const key = String(header || '').trim().toLowerCase().replace(/\s+/g, '_');
    return HEADER_ALIASES[key] || null;
};

const detectDelimiter = (text) => {
    const sample = String(text || '').split(/\r?\n/).find(line => line.trim()) || '';
    const tabCount = (sample.match(/\t/g) || []).length;
    const commaCount = (sample.match(/,/g) || []).length;
    const semiCount = (sample.match(/;/g) || []).length;
    if (tabCount >= commaCount && tabCount >= semiCount && tabCount > 0) return '\t';
    if (commaCount >= semiCount && commaCount > 0) return ',';
    if (semiCount > 0) return ';';
    return '\t';
};

export const AddModal = ({ companies, leads, owners, onClose, onSave, onResearchLead, onResearchCompany }) => {
    const [type, setType] = useState('lead');
    const [formData, setFormData] = useState({ Name: '', Title: '', Company: '', Email: '', Phone: '', LinkedIn: '', Category: '', Employees: '', City: '', Country: '', Url: '', Software: '', Notes: '', Owner: '' });
    const [loading, setLoading] = useState(false);
    const [bulkText, setBulkText] = useState('');
    const [bulkHasHeader, setBulkHasHeader] = useState(true);
    const [bulkDelimiter, setBulkDelimiter] = useState('auto');
    const [bulkMode, setBulkMode] = useState('upsert');
    const [bulkDefaultOwner, setBulkDefaultOwner] = useState('');
    const [bulkDefaultStage, setBulkDefaultStage] = useState('New');

    const existingCompanyLeads = useMemo(() => {
        if (type !== 'lead' || !formData.Company) return [];
        return leads.filter(l => l.Company.toLowerCase() === formData.Company.toLowerCase().trim());
    }, [formData.Company, leads, type]);

    const bulkParsed = useMemo(() => {
        const text = bulkText.trim();
        if (!text) return { rows: [], errors: [], validCount: 0, updateCount: 0, insertCount: 0 };

        const options = {
            skipEmptyLines: true,
            header: bulkHasHeader
        };
        if (bulkDelimiter !== 'auto') {
            options.delimiter = bulkDelimiter;
        } else {
            options.delimiter = detectDelimiter(text);
        }

        const result = Papa.parse(text, options);
        const rawRows = Array.isArray(result.data) ? result.data : [];

        const mappedRows = rawRows.map((row) => {
            if (bulkHasHeader) {
                const mapped = {};
                Object.keys(row || {}).forEach((key) => {
                    const canonical = normalizeHeader(key);
                    if (!canonical) return;
                    const value = row[key];
                    mapped[canonical] = typeof value === 'string' ? value.trim() : value;
                });
                return mapped;
            }

            const arr = Array.isArray(row) ? row : [];
            const mapped = {};
            BULK_FALLBACK_ORDER.forEach((col, idx) => {
                const value = arr[idx];
                mapped[col] = typeof value === 'string' ? value.trim() : value;
            });
            return mapped;
        });

        const rows = mappedRows
            .filter(r => Object.values(r).some(v => String(v || '').trim() !== ''))
            .map(r => {
                const out = {};
                BULK_COLUMNS.forEach(col => {
                    out[col] = String(r[col] || '').trim();
                });
                return out;
            });

        const byId = new Set(leads.map(l => String(l.id || '').trim()).filter(Boolean));
        const byEmail = new Set(leads.map(l => String(l.Email || '').trim().toLowerCase()).filter(Boolean));
        const byLinkedIn = new Set(leads.map(l => String(l.LinkedIn || '').trim().toLowerCase()).filter(Boolean));
        const byNameCompany = new Set(leads.map(l => `${String(l.Name || '').trim().toLowerCase()}|${String(l.Company || '').trim().toLowerCase()}`).filter(k => k !== '|'));

        let validCount = 0;
        let updateCount = 0;
        let insertCount = 0;

        rows.forEach(r => {
            if (!r.Name || !r.Company) return;
            validCount += 1;
            const idKey = String(r.id || '').trim();
            const emailKey = String(r.Email || '').trim().toLowerCase();
            const linkedInKey = String(r.LinkedIn || '').trim().toLowerCase();
            const nameCompanyKey = `${String(r.Name || '').trim().toLowerCase()}|${String(r.Company || '').trim().toLowerCase()}`;
            const isExisting = !!(
                (idKey && byId.has(idKey)) ||
                (emailKey && byEmail.has(emailKey)) ||
                (linkedInKey && byLinkedIn.has(linkedInKey)) ||
                byNameCompany.has(nameCompanyKey)
            );
            if (isExisting) updateCount += 1; else insertCount += 1;
        });

        return {
            rows,
            errors: result.errors || [],
            validCount,
            updateCount,
            insertCount
        };
    }, [bulkText, bulkHasHeader, bulkDelimiter, leads]);

    const handleAutoFill = async () => {
        setLoading(true);
        if (type === 'lead') {
            if (!formData.Name || !formData.Company) { alert("Enter Name & Company"); setLoading(false); return; }
            const res = await onResearchLead(formData.Name, formData.Company);
            if (res) setFormData(p => ({ ...p, ...res }));
        } else {
            if (!formData.Company) { alert("Enter Company"); setLoading(false); return; }
            const res = await onResearchCompany(formData.Company);
            if (res) setFormData(p => ({ ...p, ...res }));
        }
        setLoading(false);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (type === 'bulk') {
            onSave('bulkLeads', {
                rows: bulkParsed.rows,
                mode: bulkMode,
                defaultOwner: bulkDefaultOwner,
                defaultStage: bulkDefaultStage
            });
            return;
        }
        onSave(type, formData);
    };

    return (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[70] animate-in fade-in duration-200">
            <div className={`bg-white rounded-2xl shadow-2xl w-full overflow-hidden border border-slate-100 scale-100 ${type === 'bulk' ? 'max-w-5xl' : 'max-w-md'}`}>
                <div className="bg-white px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                    <h3 className="font-semibold text-slate-800 text-lg">Add New Entry</h3>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"><X size={20} /></button>
                </div>
                <div className="p-6 max-h-[85vh] overflow-y-auto">
                    <div className="flex bg-slate-100 rounded-lg p-1 mb-6">
                        {['lead', 'company', 'bulk'].map(t => (
                            <button key={t} onClick={() => setType(t)} className={`flex-1 py-1.5 text-sm font-medium rounded-md capitalize transition-all ${type === t ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}>{t}</button>
                        ))}
                    </div>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {type === 'lead' ? (
                            <>
                                {existingCompanyLeads.length > 0 && (
                                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm">
                                        <div className="flex items-center gap-2 text-amber-700 font-bold mb-1"><AlertCircle size={16} />Lead Info</div>
                                        <p className="text-amber-600 text-xs mb-2">We have other leads at {formData.Company}:</p>
                                        <ul className="space-y-1">
                                            {existingCompanyLeads.map(l => (
                                                <li key={l.id} className="text-xs flex justify-between bg-white/50 p-1.5 rounded">
                                                    <span className="font-medium text-slate-700">{l.Name}</span>
                                                    <span className="text-slate-500">Owner: <strong>{l.Owner || 'Unassigned'}</strong></span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                                <div className="flex gap-2">
                                    <input required placeholder="Full Name" className="flex-1 input-clean" value={formData.Name} onChange={e => setFormData({ ...formData, Name: e.target.value })} />
                                    <button type="button" onClick={handleAutoFill} className="btn-icon-secondary">
                                        {loading ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} />}
                                    </button>
                                </div>
                                <input required placeholder="Company" list="co-list" className="input-clean" value={formData.Company} onChange={e => setFormData({ ...formData, Company: e.target.value })} />
                                <datalist id="co-list">{Object.keys(companies).map(c => <option key={c} value={c} />)}</datalist>
                                <div className="flex gap-2">
                                    <input placeholder="Job Title" className="flex-1 input-clean" value={formData.Title} onChange={e => setFormData({ ...formData, Title: e.target.value })} />
                                    <div className="w-1/3 relative">
                                        <input list="owners-list" placeholder="Owner" className="input-clean bg-white" value={formData.Owner} onChange={e => setFormData({ ...formData, Owner: e.target.value })} />
                                        <datalist id="owners-list">{owners.map(m => <option key={m} value={m} />)}</datalist>
                                    </div>
                                </div>
                                <input placeholder="Email" className="input-clean" value={formData.Email} onChange={e => setFormData({ ...formData, Email: e.target.value })} />
                                <input placeholder="Phone" className="input-clean" value={formData.Phone} onChange={e => setFormData({ ...formData, Phone: e.target.value })} />
                                <input placeholder="LinkedIn URL" className="input-clean" value={formData.LinkedIn} onChange={e => setFormData({ ...formData, LinkedIn: e.target.value })} />
                                <div className="flex gap-2">
                                    <input placeholder="City" className="flex-1 input-clean" value={formData.City} onChange={e => setFormData({ ...formData, City: e.target.value })} />
                                    <input placeholder="Country" className="flex-1 input-clean" value={formData.Country} onChange={e => setFormData({ ...formData, Country: e.target.value })} />
                                </div>
                                <textarea placeholder="Initial Notes..." className="input-clean h-24" value={formData.Notes} onChange={e => setFormData({ ...formData, Notes: e.target.value })} />
                            </>
                        ) : type === 'company' ? (
                            <>
                                <input required placeholder="Company Name" className="input-clean" value={formData.Company} onChange={e => setFormData({ ...formData, Company: e.target.value })} />
                                <div className="flex gap-2">
                                    <input placeholder="Website" className="flex-1 input-clean" value={formData.Url} onChange={e => setFormData({ ...formData, Url: e.target.value })} />
                                    <input placeholder="Employees" className="flex-1 input-clean" value={formData.Employees} onChange={e => setFormData({ ...formData, Employees: e.target.value })} />
                                </div>
                                <input placeholder="Industry" className="input-clean" value={formData.Category} onChange={e => setFormData({ ...formData, Category: e.target.value })} />
                                <button type="button" onClick={handleAutoFill} className="w-full btn-icon-secondary flex items-center justify-center gap-2">
                                    {loading ? <Loader2 className="animate-spin" size={14} /> : <Sparkles size={14} />} Auto-Fill Company Data
                                </button>
                            </>
                        ) : (
                            <>
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                                    <label className="flex items-center gap-2 text-xs text-slate-600 font-medium bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                                        <input type="checkbox" checked={bulkHasHeader} onChange={e => setBulkHasHeader(e.target.checked)} />
                                        First row is header
                                    </label>

                                    <select className="input-clean" value={bulkDelimiter} onChange={e => setBulkDelimiter(e.target.value)}>
                                        <option value="auto">Auto delimiter</option>
                                        <option value="\t">Tab</option>
                                        <option value=",">Comma</option>
                                        <option value=";">Semicolon</option>
                                    </select>

                                    <select className="input-clean" value={bulkMode} onChange={e => setBulkMode(e.target.value)}>
                                        <option value="upsert">Upsert (update + insert)</option>
                                        <option value="insert">Insert only</option>
                                    </select>

                                    <select className="input-clean" value={bulkDefaultStage} onChange={e => setBulkDefaultStage(e.target.value)}>
                                        {['New', 'Attempting', 'Connected', 'Nurture', 'Qualified', 'Offer', 'Disqualified', 'Won'].map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3">
                                    <input list="owners-list" placeholder="Default owner for blank rows (optional)" className="input-clean" value={bulkDefaultOwner} onChange={e => setBulkDefaultOwner(e.target.value)} />
                                    <div className="text-[11px] text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 flex items-center">
                                        Columns: Name, Company required
                                    </div>
                                </div>
                                <datalist id="owners-list">{owners.map(m => <option key={m} value={m} />)}</datalist>

                                <textarea
                                    placeholder="Paste rows directly from Excel/Google Sheets (single row, multi-row, or full range)..."
                                    className="input-clean h-44 font-mono text-xs"
                                    value={bulkText}
                                    onChange={e => setBulkText(e.target.value)}
                                />

                                <div className="rounded-xl border border-slate-200 overflow-hidden">
                                    <div className="bg-slate-50 px-3 py-2 text-xs text-slate-600 flex flex-wrap items-center gap-3">
                                        <span className="font-semibold text-slate-700">Preview</span>
                                        <span>Rows: <strong>{bulkParsed.rows.length}</strong></span>
                                        <span>Valid: <strong>{bulkParsed.validCount}</strong></span>
                                        <span>Would update: <strong>{bulkParsed.updateCount}</strong></span>
                                        <span>Would insert: <strong>{bulkParsed.insertCount}</strong></span>
                                        {!!bulkParsed.errors.length && <span className="text-rose-600">Parse warnings: {bulkParsed.errors.length}</span>}
                                    </div>

                                    <div className="max-h-56 overflow-auto">
                                        <table className="w-full text-xs">
                                            <thead className="bg-white border-b border-slate-100 sticky top-0">
                                                <tr>
                                                    {['Name', 'Title', 'Company', 'Email', 'Owner', 'Stage', 'Notes'].map(col => (
                                                        <th key={col} className="text-left px-3 py-2 font-semibold text-slate-500">{col}</th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {bulkParsed.rows.slice(0, 12).map((row, idx) => (
                                                    <tr key={idx} className="border-b border-slate-50">
                                                        <td className="px-3 py-2 text-slate-700">{row.Name}</td>
                                                        <td className="px-3 py-2 text-slate-600">{row.Title}</td>
                                                        <td className="px-3 py-2 text-slate-700">{row.Company}</td>
                                                        <td className="px-3 py-2 text-slate-600">{row.Email}</td>
                                                        <td className="px-3 py-2 text-slate-600">{row.Owner}</td>
                                                        <td className="px-3 py-2 text-slate-600">{row.Stage || bulkDefaultStage}</td>
                                                        <td className="px-3 py-2 text-slate-500 max-w-[220px] truncate">{row.Notes}</td>
                                                    </tr>
                                                ))}
                                                {bulkParsed.rows.length === 0 && (
                                                    <tr>
                                                        <td colSpan={7} className="px-3 py-8 text-center text-slate-400">Paste a spreadsheet range to preview imported rows</td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </>
                        )}
                        <div className="flex gap-2 mt-2">
                            <button type="button" className="w-1/2 btn-icon-secondary py-2.5" onClick={onClose}>Cancel</button>
                            <button
                                type="submit"
                                className="w-1/2 btn-primary py-2.5"
                                disabled={type === 'bulk' && bulkParsed.validCount === 0}
                            >
                                {type === 'lead' ? 'Create Lead' : type === 'company' ? 'Create Company' : `Import ${bulkParsed.validCount} Leads`}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};