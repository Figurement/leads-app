/* src/components/CompanyManager.jsx */
import React, { useState, useMemo } from 'react';
import {
    Building2, Globe, Users, Save, Trash2, Merge,
    AlertTriangle, CheckCircle2, Search, Sparkles, Loader2,
    X, ArrowRight, User, ArrowUp, ArrowDown, ArrowUpDown
} from 'lucide-react';

export const CompanyManager = ({
    companies,
    leads,
    searchQuery,
    onUpdateCompany,
    onRenameCompany,
    onDeleteCompany,
    onResearchCompany,
    onOpenLead
}) => {
    const [filter, setFilter] = useState('all');
    const [editingId, setEditingId] = useState(null);
    const [editForm, setEditForm] = useState({});
    const [isResearching, setIsResearching] = useState(false);
    
    // 1. SORTING STATE
    const [sortConfig, setSortConfig] = useState({ key: 'leadCount', direction: 'desc' });

    const [viewLeadsCompany, setViewLeadsCompany] = useState(null);

    // --- HELPER: Handle Sorting Clicks ---
    const handleSort = (key) => {
        setSortConfig(current => ({
            key,
            direction: current.key === key && current.direction === 'desc' ? 'asc' : 'desc'
        }));
    };

    // --- DERIVED DATA ---
    const companyList = useMemo(() => {
        let data = Object.entries(companies).map(([id, c]) => {
            const displayName = c.Company || "Unknown";
            const companyLeads = leads.filter(l => l.Company === c.Company);
            const leadCount = companyLeads.length;
            const hasIssues = !c.Company || !c.Url || !c.Employees || !c.City || !c.Category;

            return {
                ...c,
                id,
                displayName,
                leadCount,
                companyLeads,
                hasIssues
            };
        });

        // 2. FILTERING (Enhanced Search)
        data = data.filter(c => {
            if (searchQuery) {
                const q = searchQuery.toLowerCase();
                const match = (val) => String(val || '').toLowerCase().includes(q);
                
                // Search in Name, Category, URL, City, Country
                const matchesSearch = match(c.displayName) || 
                                      match(c.Category) || 
                                      match(c.Url) || 
                                      match(c.City) || 
                                      match(c.Country);
                
                if (!matchesSearch) return false;
            }
            if (filter === 'issues') return c.hasIssues;
            if (filter === 'empty') return c.leadCount === 0;
            return true;
        });

        // 3. DYNAMIC SORTING
        return data.sort((a, b) => {
            const { key, direction } = sortConfig;
            let comparison = 0;

            // Helper for numbers (Employees)
            const getEmp = (v) => Number(String(v || '0').replace(/[^0-9]/g, ''));

            switch (key) {
                case 'Employees':
                    comparison = getEmp(a.Employees) - getEmp(b.Employees);
                    break;
                case 'leadCount':
                    comparison = a.leadCount - b.leadCount;
                    break;
                case 'Location':
                    // Combine City+Country for sorting
                    const locA = `${a.City||''} ${a.Country||''}`;
                    const locB = `${b.City||''} ${b.Country||''}`;
                    comparison = locA.localeCompare(locB);
                    break;
                default:
                    // Default string sort (Name, Category, Url)
                    comparison = String(a[key] || '').localeCompare(String(b[key] || ''));
                    break;
            }

            return direction === 'asc' ? comparison : -comparison;
        });
    }, [companies, leads, searchQuery, filter, sortConfig]);

    // --- HANDLERS ---
    const startEdit = (c) => {
        setEditingId(c.id);
        setEditForm({ ...c });
    };

    const handleAutoFill = async () => {
        if (!editForm.Company || !onResearchCompany) return;
        setIsResearching(true);
        try {
            const result = await onResearchCompany(editForm.Company, editForm.City);
            if (result) {
                setEditForm(prev => ({
                    ...prev,
                    Category: result.Category || prev.Category,
                    Employees: result.Employees || prev.Employees,
                    Url: result.Url || prev.Url,
                    City: result.City || prev.City,
                    Country: result.Country || prev.Country,
                    Software: result.Software || prev.Software
                }));
            }
        } catch (error) {
            console.error("Research failed:", error);
        } finally {
            setIsResearching(false);
        }
    };

    const saveEdit = () => {
        const originalRawName = companies[editForm.id]?.Company;
        if (editForm.Company !== originalRawName) {
            const confirmMsg = `Rename "${editForm.displayName}" to "${editForm.Company}"?\n\nThis will update ${editForm.leadCount} leads.`;
            if (window.confirm(confirmMsg)) {
                onRenameCompany(editForm.id, editForm.Company);
            }
        } else {
            onUpdateCompany(editForm);
        }
        setEditingId(null);
    };

    const getStageBadgeColor = (stage) => {
        if (['Won', 'Connected', 'Qualified', 'Offer'].includes(stage)) return 'bg-emerald-100 text-emerald-700';
        if (['Disqualified'].includes(stage)) return 'bg-rose-100 text-rose-700';
        return 'bg-slate-100 text-slate-600';
    };

    // --- RENDER HELPER: Sortable Header ---
    const SortHeader = ({ label, sortKey, className = "" }) => {
        const isActive = sortConfig.key === sortKey;
        return (
            <th 
                className={`px-6 py-3 cursor-pointer hover:bg-slate-100 transition-colors group select-none ${className}`}
                onClick={() => handleSort(sortKey)}
            >
                <div className={`flex items-center gap-1.5 ${className.includes('text-right') ? 'justify-end' : className.includes('text-center') ? 'justify-center' : 'justify-start'}`}>
                    {label}
                    <span className="text-slate-400">
                        {isActive ? (
                            sortConfig.direction === 'asc' ? <ArrowUp size={12} className="text-indigo-600" /> : <ArrowDown size={12} className="text-indigo-600" />
                        ) : (
                            <ArrowUpDown size={12} className="opacity-0 group-hover:opacity-50" />
                        )}
                    </span>
                </div>
            </th>
        );
    };

    return (
        <div className="flex flex-col h-full bg-white relative"> 
            {/* Filter Toolbar */}
            <div className="border-b border-slate-200 px-6 py-3 flex items-center gap-4 text-sm bg-slate-50/50">
                <span className="text-slate-400 font-bold text-[10px] uppercase tracking-wider">Quick Filters:</span>
                <div className="flex gap-1">
                    {[
                        { id: 'all', label: 'All Companies' },
                        { id: 'issues', label: 'Missing Data', icon: <AlertTriangle size={12} /> },
                        { id: 'empty', label: 'Ghosts (0 Leads)', icon: <Users size={12} /> }
                    ].map(btn => (
                        <button
                            key={btn.id}
                            onClick={() => setFilter(btn.id)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all border ${filter === btn.id
                                ? 'bg-white text-indigo-600 border-slate-200 shadow-sm'
                                : 'bg-transparent text-slate-500 border-transparent hover:bg-slate-200/50'
                                }`}
                        >
                            {btn.icon} {btn.label}
                        </button>
                    ))}
                </div>
                <div className="ml-auto text-xs text-slate-400">
                    Showing <strong>{companyList.length}</strong> companies
                </div>
            </div>

            {/* Table Content */}
            <div className="flex-1 overflow-auto bg-slate-50 p-6">
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 text-xs font-bold text-slate-500 uppercase border-b border-slate-200 sticky top-0 z-10 shadow-sm">
                            <tr>
                                <SortHeader label="Company Name" sortKey="Company" className="w-1/5" />
                                <SortHeader label="Category" sortKey="Category" className="w-1/6" />
                                <SortHeader label="Website" sortKey="Url" className="w-1/5" />
                                <SortHeader label="Location" sortKey="Location" />
                                <SortHeader label="Empl." sortKey="Employees" className="w-32" />
                                <SortHeader label="Leads" sortKey="leadCount" className="text-center" />
                                <th className="px-6 py-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {companyList.map(c => {
                                const isEditing = editingId === c.id;
                                return (
                                    <tr key={c.id} className={`group hover:bg-slate-50 transition-colors ${isEditing ? 'bg-indigo-50/30' : ''}`}>

                                        {/* Name Input */}
                                        <td className="px-6 py-3">
                                            {isEditing ? (
                                                <div className="flex flex-col gap-1">
                                                    <input
                                                        className="w-full border border-indigo-300 rounded px-2 py-1 font-bold text-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                                        value={editForm.Company || ''}
                                                        onChange={e => setEditForm({ ...editForm, Company: e.target.value })}
                                                        placeholder="Company Name"
                                                    />
                                                    {editForm.Company !== c.Company && (
                                                        <div className="text-[10px] text-amber-600 flex items-center gap-1 font-bold">
                                                            <Merge size={10} /> Will Rename
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className={`font-bold ${!c.Company ? 'text-red-400 italic' : 'text-slate-700'}`}>
                                                    {c.displayName}
                                                </div>
                                            )}
                                        </td>

                                        {/* Category */}
                                        <td className="px-6 py-3">
                                            {isEditing ? (
                                                <input className="w-full input-clean py-1 px-2 text-xs" value={editForm.Category || ''} onChange={e => setEditForm({ ...editForm, Category: e.target.value })} placeholder="Industry" />
                                            ) : (
                                                <div className="text-slate-600 text-xs">{c.Category || <span className="text-slate-300">-</span>}</div>
                                            )}
                                        </td>

                                        {/* URL */}
                                        <td className="px-6 py-3">
                                            {isEditing ? (
                                                <input className="w-full input-clean py-1 px-2 text-xs" value={editForm.Url || ''} onChange={e => setEditForm({ ...editForm, Url: e.target.value })} placeholder="website.com" />
                                            ) : (
                                                c.Url ? (
                                                    <a href={c.Url.startsWith('http') ? c.Url : `https://${c.Url}`} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline flex items-center gap-1">
                                                        <Globe size={12} /> {c.Url}
                                                    </a>
                                                ) : <span className="text-slate-300 italic text-xs">Missing</span>
                                            )}
                                        </td>

                                        {/* Location */}
                                        <td className="px-6 py-3">
                                            {isEditing ? (
                                                <div className="flex gap-1">
                                                    <input className="w-1/2 input-clean py-1 px-2 text-xs" value={editForm.City || ''} onChange={e => setEditForm({ ...editForm, City: e.target.value })} placeholder="City" />
                                                    <input className="w-1/2 input-clean py-1 px-2 text-xs" value={editForm.Country || ''} onChange={e => setEditForm({ ...editForm, Country: e.target.value })} placeholder="Country" />
                                                </div>
                                            ) : (
                                                <div className="text-slate-600">{c.City ? `${c.City}, ${c.Country}` : <span className="text-slate-300">-</span>}</div>
                                            )}
                                        </td>

                                        {/* Employees */}
                                        <td className="px-6 py-3">
                                            {isEditing ? (
                                                <input type="text" className="w-full input-clean py-1 px-2 text-xs" value={editForm.Employees || ''} onChange={e => setEditForm({ ...editForm, Employees: e.target.value })} placeholder="Count" />
                                            ) : (
                                                <div className="text-slate-600">{c.Employees ? new Intl.NumberFormat('da-DK').format(Number(String(c.Employees).replace(/[^0-9]/g, ''))) : '-'}</div>
                                            )}
                                        </td>

                                        {/* Lead Count */}
                                        <td className="px-6 py-3 text-center">
                                            <button 
                                                onClick={() => c.leadCount > 0 && setViewLeadsCompany(c)}
                                                disabled={c.leadCount === 0}
                                                className={`inline-flex items-center justify-center px-2.5 py-1 rounded-full text-xs font-bold transition-transform active:scale-95 ${
                                                    c.leadCount > 0 
                                                        ? 'bg-slate-100 text-slate-600 hover:bg-indigo-100 hover:text-indigo-700 cursor-pointer shadow-sm' 
                                                        : 'bg-slate-50 text-slate-300 cursor-default'
                                                }`}
                                            >
                                                {c.leadCount}
                                            </button>
                                        </td>

                                        {/* Actions */}
                                        <td className="px-6 py-3 text-right">
                                            {isEditing ? (
                                                <div className="flex justify-end gap-2">
                                                    <button
                                                        onClick={handleAutoFill}
                                                        disabled={isResearching}
                                                        className="p-1.5 bg-indigo-600 text-white rounded shadow-sm hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                                                        title="Auto-fill data with AI"
                                                    >
                                                        {isResearching ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                                                    </button>
                                                    <button onClick={() => setEditingId(null)} className="px-2 py-1 text-xs text-slate-500 hover:bg-slate-200 rounded">Cancel</button>
                                                    <button onClick={saveEdit} className="px-3 py-1 text-xs bg-indigo-600 text-white rounded shadow-sm hover:bg-indigo-700 flex items-center gap-1"><Save size={12} /> Save</button>
                                                </div>
                                            ) : (
                                                <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button onClick={() => startEdit(c)} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors" title="Edit Company">
                                                        <Building2 size={14} />
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            const warning = c.leadCount > 0
                                                                ? `⚠️ WARNING: This company has ${c.leadCount} leads linked to it.\n\nDeleting the company entry will NOT delete the leads, but they will lose their company details (Location, URL, etc).\n\nAre you sure you want to delete "${c.displayName}"?`
                                                                : `Delete "${c.displayName}"?`;

                                                            if (confirm(warning)) {
                                                                onDeleteCompany(c.id);
                                                            }
                                                        }}
                                                        className="p-1.5 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                                                        title="Delete Company"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                )
                            })}
                            {companyList.length === 0 && (
                                <tr><td colSpan={7} className="p-8 text-center text-slate-400"><div className="flex flex-col items-center gap-2"><CheckCircle2 className="text-emerald-500/50" size={24} /><span>No companies found matching filters.</span></div></td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal: List of Leads */}
            {viewLeadsCompany && (
                <div className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setViewLeadsCompany(null)}>
                    <div className="bg-white rounded-2xl shadow-2xl w-[500px] overflow-hidden animate-in fade-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <div>
                                <h3 className="font-bold text-slate-800 text-lg">{viewLeadsCompany.displayName}</h3>
                                <div className="text-xs text-slate-400 font-medium">Linked Leads ({viewLeadsCompany.companyLeads.length})</div>
                            </div>
                            <button onClick={() => setViewLeadsCompany(null)} className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-full transition-colors"><X size={18} /></button>
                        </div>
                        <div className="p-2 max-h-[60vh] overflow-y-auto">
                            {viewLeadsCompany.companyLeads.map(lead => (
                                <div 
                                    key={lead.id}
                                    onClick={() => {
                                        if (onOpenLead) {
                                            setViewLeadsCompany(null);
                                            onOpenLead(lead);
                                        }
                                    }}
                                    className="flex items-center gap-3 p-3 hover:bg-indigo-50 rounded-xl cursor-pointer group transition-colors border border-transparent hover:border-indigo-100"
                                >
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${getStageBadgeColor(lead.Stage)}`}>
                                        <User size={14} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="font-bold text-slate-700 text-sm truncate">{lead.Name}</div>
                                        <div className="text-xs text-slate-400 truncate">{lead.Title || 'No Title'}</div>
                                    </div>
                                    <div className="text-right">
                                        <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${getStageBadgeColor(lead.Stage)}`}>
                                            {lead.Stage}
                                        </span>
                                    </div>
                                    <div className="text-slate-300 group-hover:text-indigo-600 pl-2">
                                        <ArrowRight size={16} />
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 text-center">
                            <span className="text-[10px] text-slate-400">Select a lead to view details</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};