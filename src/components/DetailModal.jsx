import React, { useState, useEffect, useMemo } from 'react';
import { Trash2, Copy, ArrowRight, Sparkles, Pencil } from 'lucide-react';
import { safeJSONParse, normalizeStage, parseDateStr, formatDateStr, isDue, ORDERED_STAGES } from '../lib/utils';
import { CustomDatePicker, OwnerAvatar } from './SharedUI';

export const DetailModal = ({ lead, companies, leads, owners, onClose, onSave, onAnalyze, onResearch, onDelete, onOpenLead, onToast }) => {
    const [companyData, setCompanyData] = useState(companies[lead.Company] || { Company: lead.Company });
    const otherLeads = leads.filter(l => l.Company === companyData.Company && l.id !== lead.id);

    const [history, setHistory] = useState(() => {
        let initialHistory = [];
        if (lead.History && lead.History.startsWith('[')) {
            initialHistory = safeJSONParse(lead.History);
        } else if (lead.Notes) {
            let legacyDate = new Date(0);
            if (lead.Date) { const parsed = parseDateStr(lead.Date); if (parsed) legacyDate = parsed; }
            initialHistory = [{ date: legacyDate.toISOString(), type: 'note', content: lead.Notes, isLegacy: true }];
        }
        return initialHistory.sort((a, b) => new Date(b.date) - new Date(a.date));
    });

    const [newMessage, setNewMessage] = useState("");
    const [messageType, setMessageType] = useState('user');
    const [details, setDetails] = useState({ ...lead });
    const [logDate, setLogDate] = useState(new Date());
    const [editingIndex, setEditingIndex] = useState(null);
    const [editDraft, setEditDraft] = useState({ content: '', type: 'note', date: new Date() });
    const [saveState, setSaveState] = useState('idle');
    const [empFocused, setEmpFocused] = useState(false);

    const formatEmployees = (v) => {
        const d = String(v ?? '').replace(/[^0-9]/g, '');
        if (!d) return '';
        return new Intl.NumberFormat('da-DK').format(Number(d));
    };

    const autosaveTimerRef = React.useRef(null);
    const initialRenderRef = React.useRef(true);
    const onSaveRef = React.useRef(onSave);
    useEffect(() => { onSaveRef.current = onSave; }, [onSave]);
    const detailsRef = React.useRef(details);
    const historyRef = React.useRef(history);
    const companyRef = React.useRef(companyData);

    useEffect(() => { detailsRef.current = details; }, [details]);
    useEffect(() => { historyRef.current = history; }, [history]);
    useEffect(() => { companyRef.current = companyData; }, [companyData]);

    useEffect(() => {
        if (initialRenderRef.current) { initialRenderRef.current = false; return; }
        if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = setTimeout(() => {
            setSaveState('saving');
            Promise.resolve(onSaveRef.current({ ...details, History: JSON.stringify(history) }, companyData))
                .then(() => { setSaveState('saved'); setTimeout(() => setSaveState('idle'), 1200); })
                .catch(() => setSaveState('idle'));
        }, 800);
        return () => clearTimeout(autosaveTimerRef.current);
    }, [details, companyData, history]);

    useEffect(() => {
        return () => {
            if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
            try {
                onSaveRef.current({ ...detailsRef.current, History: JSON.stringify(historyRef.current) }, companyRef.current, { silent: true });
            } catch { }
        };
    }, []);

    const handleSendMessage = () => {
        if (!newMessage.trim()) return;
        const newEntry = { date: logDate.toISOString(), type: messageType, content: newMessage };
        setHistory([...history, newEntry].sort((a, b) => new Date(b.date) - new Date(a.date)));
        setNewMessage("");
        setLogDate(new Date()); // Reset date to now after sending
    };

    const handleResearch = async () => {
        try {
            const result = await onResearch(companyData.Company, details.City || "");
            if (!result) { onToast && onToast('error', 'No data found'); return; }
            setCompanyData(prev => ({ ...prev, ...result }));
            onToast && onToast('success', 'Company data updated');
        } catch (e) { onToast && onToast('error', 'Auto-fill failed'); }
    };

    const handleLeadCompanyChange = (e) => {
        const newCompanyName = e.target.value;
        setDetails(prev => ({ ...prev, Company: newCompanyName }));
        const existingCompany = companies[newCompanyName];
        if (existingCompany) {
            setCompanyData(existingCompany);
        } else {
            setCompanyData({ Company: newCompanyName, Url: '', City: '', Country: '', Category: '', Employees: '', Software: '' });
        }
    };

    const handleCompanyRename = (e) => { setCompanyData({ ...companyData, Company: e.target.value }); };
    const startEdit = (idx) => { const entry = history[idx]; setEditingIndex(idx); setEditDraft({ content: entry.content, type: entry.type || 'note', date: new Date(entry.date) }); };
    const cancelEdit = () => setEditingIndex(null);
    const saveEdit = () => { if (editingIndex === null) return; const updated = { date: editDraft.date.toISOString(), type: editDraft.type, content: editDraft.content }; const next = history.map((h, i) => (i === editingIndex ? updated : h)).sort((a, b) => new Date(b.date) - new Date(a.date)); setHistory(next); setEditingIndex(null); };

    const getStageColor = (s) => {
        const stage = normalizeStage(s);
        if (['Won', 'Connected', 'Qualified', 'Offer'].includes(stage)) return 'bg-emerald-500 ring-emerald-200';
        if (['Disqualified'].includes(stage)) return 'bg-rose-500 ring-rose-200';
        return 'bg-slate-300 ring-slate-200';
    };

    const ghostInputTitle = "w-full bg-transparent border-none p-0 focus:ring-0 focus:outline-none placeholder:text-slate-300 font-bold text-slate-800 text-lg mb-0.5";
    const ghostInputSubtitle = "w-full bg-transparent border-none p-0 focus:ring-0 focus:outline-none placeholder:text-slate-300 text-sm text-slate-500 font-medium";
    const labelStyle = "text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5 block";
    const ghostInputMeta = "w-full bg-transparent border-b border-transparent hover:border-slate-200 focus:border-indigo-500 focus:outline-none transition-colors text-sm text-slate-700 py-0.5 placeholder:text-slate-300";

    return (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[80]" onClick={onClose}>
            <div className="bg-white w-[1100px] h-[85vh] rounded-2xl shadow-2xl flex overflow-hidden ring-1 ring-slate-900/5" onClick={e => e.stopPropagation()}>
                {/* COL 1: LEAD DETAILS */}
                <div className="w-80 bg-slate-50/50 border-r border-slate-200 flex flex-col overflow-y-auto">
                    <div className="p-6 pb-6 relative group/leftcol">
                        <button onClick={() => { if (confirm('Delete lead permanently?')) onDelete(lead.id); }} className="absolute top-4 right-4 text-slate-300 hover:text-rose-600 transition-colors p-1" title="Delete Lead"><Trash2 size={14} /></button>
                        <div className="mb-6 pr-6">
                            <input className={ghostInputTitle} placeholder="Lead Name" value={details.Name} onChange={e => setDetails({ ...details, Name: e.target.value })} />
                            <input className={ghostInputSubtitle} placeholder="Job Title" value={details.Title} onChange={e => setDetails({ ...details, Title: e.target.value })} />
                            <div className="mt-0.5">
                                <input className={ghostInputSubtitle} placeholder="Company Name" list="company-list-left" value={details.Company} onChange={handleLeadCompanyChange} />
                                <datalist id="company-list-left">{Object.keys(companies).map(c => <option key={c} value={c} />)}</datalist>
                            </div>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className={labelStyle}>Email</label>
                                <div className="flex items-center gap-2 group">
                                    <input className={ghostInputMeta} placeholder="email@address.com" value={details.Email} onChange={e => setDetails({ ...details, Email: e.target.value })} />
                                    {details.Email && (<button onClick={() => { navigator.clipboard.writeText(details.Email); }} className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-indigo-600 transition-all"><Copy size={12} /></button>)}
                                </div>
                            </div>
                            <div><label className={labelStyle}>Phone</label><input className={ghostInputMeta} placeholder="+45 00 00 00 00" value={details.Phone || ''} onChange={e => setDetails({ ...details, Phone: e.target.value })} /></div>
                            <div>
                                <label className={labelStyle}>LinkedIn</label>
                                <div className="flex items-center gap-2 group">
                                    <input className={ghostInputMeta} placeholder="linkedin.com/in/..." value={details.LinkedIn} onChange={e => setDetails({ ...details, LinkedIn: e.target.value })} />
                                    {details.LinkedIn && (<a href={details.LinkedIn} target="_blank" rel="noreferrer" className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-blue-600 transition-all"><ArrowRight size={12} className="-rotate-45" /></a>)}
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="px-6 py-4 pb-6 space-y-5 border-t border-slate-200 mt-auto bg-white">
                        <div>
                            <label className={labelStyle}>Pipeline Stage</label>
                            <select value={details.Stage} onChange={e => setDetails({ ...details, Stage: e.target.value })} className="w-full bg-transparent border-b border-slate-200 text-sm py-1 outline-none focus:border-indigo-500 text-slate-700 cursor-pointer">
                                {ORDERED_STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className={labelStyle}>Owner</label>
                            <div className="flex items-center gap-2 pt-1">
                                <OwnerAvatar name={details.Owner} size="w-6 h-6" textSize="text-[10px]" />
                                <div className="flex-1 relative">
                                    <input list="owners-list-detail" value={details.Owner || ''} onChange={e => setDetails({ ...details, Owner: e.target.value })} className={`${ghostInputMeta} py-0 border-b-0`} placeholder="Unassigned" />
                                    <datalist id="owners-list-detail">{owners.map(m => <option key={m} value={m} />)}</datalist>
                                </div>
                            </div>
                        </div>
                        <div className={`p-3 rounded-lg border transition-colors ${isDue(details['Next Date']) ? 'bg-rose-50 border-rose-100' : 'bg-slate-50 border-slate-100'}`}>
                            <div className="flex items-center justify-between mb-1">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">Next Action</label>
                                {(details['Next Date'] || details['Next Action']) && (<button type="button" onClick={() => setDetails({ ...details, 'Next Date': '', 'Next Action': '' })} className="text-[10px] text-slate-400 hover:text-rose-600">Clear</button>)}
                            </div>
                            <div className="mb-1"><CustomDatePicker selected={parseDateStr(details['Next Date'])} onChange={d => setDetails({ ...details, 'Next Date': formatDateStr(d) })} placeholderText="Set Date..." /></div>
                            <input className="w-full bg-transparent text-sm placeholder:text-slate-400 outline-none" placeholder="What needs to happen?" value={details['Next Action'] || ''} onChange={e => setDetails({ ...details, 'Next Action': e.target.value })} />
                        </div>
                    </div>
                </div>

                {/* COL 2: CHAT */}
                <div className="flex-1 flex flex-col bg-white">
                    <div className="p-4 border-b border-slate-100 flex justify-between items-center">
                        <h3 className="font-semibold text-slate-700 text-sm">Activity Log</h3>
                        <button onClick={() => onAnalyze(details, companyData, history)} className="flex items-center gap-1.5 px-3 py-1 bg-purple-50 text-purple-700 text-[10px] font-bold rounded-full hover:bg-purple-100 transition-colors"><Sparkles size={10} /> AI Insight</button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-6 bg-white flex flex-col-reverse gap-6">
                        {history.map((entry, idx) => {
                            const isMine = entry.type === 'user' || entry.type === 'note';
                            const isEditing = editingIndex === idx;
                            return (
                                <div key={idx} className={`flex flex-col ${isMine ? 'items-end' : 'items-start'} group/msg`}>
                                    {isEditing ? (
                                        <div className={`max-w-[85%] w-full p-3 rounded-xl border bg-white shadow-sm ring-2 ring-indigo-50/50`}>
                                            <div className="flex gap-2 mb-2">
                                                {['user', 'lead', 'note'].map(t => (<button key={t} onClick={() => setEditDraft(p => ({ ...p, type: t }))} className={`px-2 py-0.5 text-[10px] uppercase font-bold rounded tracking-wide ${editDraft.type === t ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-500'}`}>{t}</button>))}
                                                <div className="ml-auto w-32"><CustomDatePicker selected={editDraft.date} onChange={d => setEditDraft(p => ({ ...p, date: d }))} showTimeSelect placeholderText="Time" /></div>
                                            </div>
                                            <textarea className="w-full bg-slate-50 border-0 rounded p-2 text-sm outline-none resize-none" rows={3} value={editDraft.content} onChange={e => setEditDraft(p => ({ ...p, content: e.target.value }))} />
                                            <div className="flex justify-end gap-2 mt-2"><button onClick={cancelEdit} className="px-2 py-1 text-xs text-slate-500">Cancel</button><button onClick={saveEdit} className="px-3 py-1 text-xs rounded bg-indigo-600 text-white">Save</button></div>
                                        </div>
                                    ) : (
                                        <div className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${entry.type === 'user' ? 'bg-indigo-600 text-white rounded-tr-sm' : entry.type === 'note' ? 'bg-amber-50 text-slate-800 border border-amber-100' : 'bg-slate-100 text-slate-700 rounded-tl-sm'}`}>{entry.content}</div>
                                    )}
                                    {!isEditing && (
                                        <div className="mt-1 flex items-center gap-2 px-1 text-[10px] text-slate-300 opacity-0 group-hover/msg:opacity-100 transition-opacity">
                                            <span className="font-bold uppercase">{entry.type}</span><span>{new Date(entry.date).toLocaleString('da-DK', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })}</span>
                                            <button onClick={() => startEdit(idx)} className="hover:text-indigo-600 ml-2"><Pencil size={10} /></button>
                                            <button onClick={() => { const h = history.filter((_, i) => i !== idx); setHistory(h); }} className="hover:text-rose-600"><Trash2 size={10} /></button>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                    <div className="p-4 border-t border-slate-100 bg-white">
                        <div className="flex items-center justify-between mb-2">
                             <div className="flex gap-2">
                                {['user', 'lead', 'note'].map(t => (
                                    <button 
                                        key={t} 
                                        onClick={() => setMessageType(t)} 
                                        className={`px-3 py-1 text-[10px] uppercase font-bold rounded-full tracking-wide transition-colors ${messageType === t ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}
                                    >
                                        {t === 'user' ? 'Me' : t === 'lead' ? 'Them' : 'Note'}
                                    </button>
                                ))}
                            </div>
                            <div className="w-40">
                                <CustomDatePicker selected={logDate} onChange={setLogDate} showTimeSelect dateFormat="MMM d, HH:mm" />
                            </div>
                        </div>
                        <div className="relative">
                            <textarea className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 pr-12 text-sm outline-none focus:bg-white focus:ring-2 focus:ring-indigo-100 transition-all resize-none placeholder:text-slate-400" rows={2} placeholder="Log activity or note..." value={newMessage} onChange={e => setNewMessage(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }} />
                            <div className="absolute right-2 bottom-2">
                                <button onClick={handleSendMessage} className="p-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"><ArrowRight size={14} /></button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* COL 3: COMPANY INTEL */}
                <div className="w-80 bg-slate-50/50 border-l border-slate-200 flex flex-col overflow-y-auto">
                    <div className="p-6">
                        <div className="flex justify-between items-start mb-1">
                            <input className={ghostInputTitle} placeholder="Company Name" value={companyData.Company || ''} onChange={handleCompanyRename} />
                            <button onClick={handleResearch} className="text-slate-300 hover:text-indigo-600 transition-colors pt-1" title="Auto-Fill Data"><Sparkles size={14} /></button>
                        </div>
                        <div className="flex items-center gap-2 group mb-6">
                            <input className="w-full bg-transparent border-none p-0 focus:ring-0 focus:outline-none placeholder:text-slate-300 text-sm text-blue-600" placeholder="website.com" value={companyData.Url || ''} onChange={e => setCompanyData({ ...companyData, Url: e.target.value })} />
                            {companyData.Url && (<a href={companyData.Url.startsWith('http') ? companyData.Url : `https://${companyData.Url}`} target="_blank" rel="noreferrer" className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-blue-600 transition-all"><ArrowRight size={12} className="-rotate-45" /></a>)}
                        </div>
                        <div className="space-y-4">
                            <div><label className={labelStyle}>Location</label><div className="flex gap-2"><input className={ghostInputMeta} placeholder="City" value={companyData.City || ''} onChange={e => setCompanyData({ ...companyData, City: e.target.value })} /><input className={ghostInputMeta} placeholder="Country" value={companyData.Country || ''} onChange={e => setCompanyData({ ...companyData, Country: e.target.value })} /></div></div>
                            <div><label className={labelStyle}>Industry</label><input className={ghostInputMeta} placeholder="e.g. SaaS" value={companyData.Category || ''} onChange={e => setCompanyData({ ...companyData, Category: e.target.value })} /></div>
                            <div><label className={labelStyle}>Employees</label><input className={ghostInputMeta} placeholder="Count" value={empFocused ? String(companyData.Employees || '') : formatEmployees(companyData.Employees)} onFocus={() => setEmpFocused(true)} onBlur={() => setEmpFocused(false)} onChange={e => { const digits = e.target.value.replace(/[^0-9]/g, ''); setCompanyData({ ...companyData, Employees: digits }); }} /></div>
                            <div><label className={labelStyle}>Software Stack</label><input className={ghostInputMeta} placeholder="e.g. Hubspot, AWS" value={companyData.Software || ''} onChange={e => setCompanyData({ ...companyData, Software: e.target.value })} /></div>
                        </div>
                    </div>
                    {otherLeads.length > 0 && (
                        <div className="mt-auto border-t border-slate-200 p-6 bg-white">
                            <h4 className={labelStyle}>Also at {companyData.Company}</h4>
                            <div className="mt-3 space-y-1">
                                {otherLeads.map(l => (
                                    <div key={l.id} onClick={() => onOpenLead ? onOpenLead(l) : onClose()} className="flex justify-between items-center py-2 border-b border-slate-50 hover:bg-slate-50 cursor-pointer -mx-2 px-2 rounded group">
                                        <div className="flex items-center gap-2">
                                            <div className={`w-2 h-2 rounded-full ring-2 ${getStageColor(l.Stage)}`} title={l.Stage}></div>
                                            <div><div className="text-xs font-bold text-slate-700">{l.Name}</div><div className="text-[10px] text-slate-400">{l.Title}</div></div>
                                        </div>
                                        <OwnerAvatar name={l.Owner} size="w-5 h-5" textSize="text-[9px]" />
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};