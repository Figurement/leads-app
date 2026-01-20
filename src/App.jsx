/* src/App.jsx */
import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  DndContext, useDraggable, useDroppable, DragOverlay, closestCorners,
  useSensor, useSensors, MouseSensor, TouchSensor
} from '@dnd-kit/core';
import {
  Settings, Sparkles, X, Loader2, Search, Mail, Calendar,
  Edit3, Save, Plus, Linkedin, Clock, Building2, UserPlus, MessageSquare,
  Globe, CheckCircle2, AlertCircle, MapPin, Trophy, Ban, Trash2, Filter,
  Eye, EyeOff, ArrowUpDown, Check, ChevronDown, MoreHorizontal, Pencil, Copy,
  User, Users, BadgeCheck
} from 'lucide-react';
import { fetchCSV, saveCSV } from './lib/github';
import { useGemini } from './hooks/useGemini';

// --- DATE PICKER IMPORTS ---
import DatePicker, { registerLocale } from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { da } from 'date-fns/locale/da';
registerLocale('da', da);

// --- GLOBAL STYLES (Font & Reset) ---
const GlobalStyles = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
    body, button, input, textarea, select { font-family: 'Inter', sans-serif !important; }
    
    .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
    .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
    .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
    .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }

    .react-datepicker-wrapper { width: 100%; }
    .react-datepicker-popper { z-index: 1000; }
    .react-datepicker { border: 0 !important; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05) !important; font-family: 'Inter', sans-serif !important; }
    .react-datepicker__header { background: #f8fafc !important; border-bottom: 1px solid #e2e8f0 !important; }
    .react-datepicker__day--selected { background-color: #4f46e5 !important; border-radius: 6px !important; }
    .react-datepicker__day:hover { background-color: #eef2ff !important; border-radius: 6px !important; }
    .react-datepicker__triangle { display: none; }

    .btn-primary { background-color: #4f46e5; color: white; font-weight: 500; padding: 0.5rem 1rem; border-radius: 0.5rem; transition: background-color 0.2s; }
    .btn-primary:hover { background-color: #4338ca; }
    .btn-icon-secondary { padding: 0.5rem; color: #4f46e5; background-color: #eef2ff; border-radius: 0.5rem; transition: background-color 0.2s; }
    .btn-icon-secondary:hover { background-color: #e0e7ff; }
    .input-clean { width: 100%; border: 1px solid #e2e8f0; border-radius: 0.5rem; padding: 0.5rem 0.75rem; font-size: 0.875rem; outline: none; transition: all 0.2s; }
    .input-clean:focus { ring: 2px; ring-color: #4f46e5; border-color: #4f46e5; }
  `}</style>
);

// --- CONFIGURATION ---
const REPO_OWNER = "figurement";
const REPO_NAME = "leads-data";
const LEADS_PATH = "leads.csv";
const COMPANIES_PATH = "companies.csv";

const ORDERED_STAGES = [
  'New', 'Attempting', 'Connected', 'Nurture', 'Qualified', 'Offer', 'Disqualified', 'Won'
];

const SORT_STRATEGIES = {
  momentum: { label: 'Momentum', icon: '🔥', desc: 'Newest interactions' },
  revival: { label: 'Revival', icon: '⛏️', desc: 'Oldest interactions' },
  size: { label: 'Size', icon: '💎', desc: 'Highest employee count' },
  alpha: { label: 'Alpha', icon: 'Aa', desc: 'Alphabetical' }
};

const DEFAULT_SORTS = {
  'New': 'momentum', 'Attempting': 'revival', 'Connected': 'momentum',
  'Qualified': 'size', 'Offer': 'size', 'Nurture': 'revival',
  'Disqualified': 'revival', 'Won': 'size'
};

// Per-column collapse (multiple leads per company). Default ON for Nurture.
const DEFAULT_COLLAPSE = {
  'New': false, 'Attempting': false, 'Connected': false,
  'Nurture': true, 'Qualified': false, 'Offer': false,
  'Disqualified': false, 'Won': false
};

// --- HELPERS ---
const generateId = (name) => `lead-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
const safeJSONParse = (str) => { try { return JSON.parse(str); } catch { return []; } };
const normalizeStage = (s) => (s || '').trim().replace(/^\d+\.?\s*/, '');
const parseDateStr = (str) => {
  if (!str) return null;
  const [d, m, y] = str.split('/');
  const date = new Date(y, m - 1, d);
  return isNaN(date) ? null : date;
};
const formatDateStr = (date) => {
  if (!date) return "";
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
};
const toBool = (v) => {
  const s = String(v || '').trim().toLowerCase();
  return s === 'true' || s === '1' || s === 'yes' || s === 'y';
};
const isDue = (dateStr) => {
  if (!dateStr) return false;
  const d = parseDateStr(dateStr);
  return d && d <= new Date().setHours(0, 0, 0, 0);
};
// Unified status badge component
const StatusBadge = ({ type, label }) => {
  const base = "ml-auto flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border";
  let cls = "";
  let icon = null;
  switch (type) {
    case 'due':
      cls = "text-rose-600 bg-rose-50 border-rose-100";
      icon = <Clock size={10} />;
      break;
    case 'cold':
      cls = "text-amber-600 bg-amber-50 border-amber-100";
      break;
    case 'stalled':
      cls = "text-slate-600 bg-slate-100 border-slate-200";
      break;
    case 'active':
      cls = "text-emerald-600 bg-emerald-50 border-emerald-100";
      break;
    default:
      cls = "text-slate-600 bg-slate-100 border-slate-200";
  }
  return (
    <div className={`${base} ${cls}`}>
      {icon}
      {label}
    </div>
  );
};

// Updated Enterprise Marker: "Verified" Badge style
const EnterpriseMark = () => (
  // Visual adjustment: 'text-indigo-500' is slightly sharper for small icons
  // size={10} matches the text-[10px] height exactly
  <BadgeCheck
    size={10}
    className=" text-indigo-500 shrink-0"
    fill="#e0e7ff" // Light indigo fill
    aria-label="Enterprise Verified"
  />
);
const getDaysSinceInteraction = (historyStr) => {
  if (!historyStr) return null;
  try {
    const history = JSON.parse(historyStr);
    if (!Array.isArray(history) || history.length === 0) return null;
    const dates = history.map(h => new Date(h.date).getTime());
    const diffTime = new Date().getTime() - Math.max(...dates);
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return diffDays < 0 ? 0 : diffDays;
  } catch { return null; }
};

// LocalStorage helpers
const VISIBLE_STAGES_LS_KEY = 'visibleStages';
const OWNER_FILTER_LS_KEY = 'ownerFilter';
const defaultVisibleStages = () => Object.fromEntries(ORDERED_STAGES.map(s => [s, true]));
const loadVisibleStages = () => {
  try {
    const raw = localStorage.getItem(VISIBLE_STAGES_LS_KEY);
    return raw ? JSON.parse(raw) : defaultVisibleStages();
  } catch { return defaultVisibleStages(); }
};

// --- CUSTOM DATE PICKER ---
const CustomDatePicker = ({ selected, onChange, showTimeSelect, placeholderText }) => (
  <div className="relative w-full">
    <DatePicker
      selected={selected} onChange={onChange} locale="da"
      dateFormat={showTimeSelect ? "dd/MM/yyyy HH:mm" : "dd/MM/yyyy"}
      showTimeSelect={showTimeSelect} timeFormat="HH:mm" timeIntervals={15}
      placeholderText={placeholderText || "Select Date"}
      className="w-full bg-slate-50 border border-slate-200 rounded-md p-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all hover:bg-white"
    />
  </div>
);

// --- COMPONENT: Modal Wrapper ---
const ModalWrapper = ({ title, children, onClose }) => (
  <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[70] animate-in fade-in duration-200" onClick={onClose}>
    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-100 scale-100" onClick={e => e.stopPropagation()}>
      <div className="bg-white px-6 py-4 border-b border-slate-100 flex justify-between items-center">
        <h3 className="font-semibold text-slate-800 text-lg">{title}</h3>
        <button onClick={onClose} className="p-1 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"><X size={20} /></button>
      </div>
      <div className="p-6 max-h-[85vh] overflow-y-auto">{children}</div>
    </div>
  </div>
);

// --- COMPONENT: Add Modal ---
const AddModal = ({ companies, leads, owners, onClose, onSave, onResearchLead, onResearchCompany }) => {
  const [type, setType] = useState('lead');
  const [formData, setFormData] = useState({ Name: '', Title: '', Company: '', Email: '', LinkedIn: '', Category: '', Employees: '', City: '', Country: '', Url: '', Software: '', Notes: '', Owner: '' });
  const [loading, setLoading] = useState(false);

  const existingCompanyLeads = useMemo(() => {
    if (type !== 'lead' || !formData.Company) return [];
    return leads.filter(l => l.Company.toLowerCase() === formData.Company.toLowerCase().trim());
  }, [formData.Company, leads, type]);

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

  return (
    <ModalWrapper title="Add New Entry" onClose={onClose}>
      <div className="flex bg-slate-100 rounded-lg p-1 mb-6">
        {['lead', 'company'].map(t => (
          <button key={t} onClick={() => setType(t)} className={`flex-1 py-1.5 text-sm font-medium rounded-md capitalize transition-all ${type === t ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}>{t}</button>
        ))}
      </div>
      <form onSubmit={e => { e.preventDefault(); onSave(type, formData); }} className="space-y-4">
        {type === 'lead' ? (
          <>
            {existingCompanyLeads.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm">
                <div className="flex items-center gap-2 text-amber-700 font-bold mb-1"><AlertCircle size={16} /> Lead Conflict</div>
                <p className="text-amber-600 text-xs mb-2">We already have leads at {formData.Company}:</p>
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
            <input placeholder="LinkedIn URL" className="input-clean" value={formData.LinkedIn} onChange={e => setFormData({ ...formData, LinkedIn: e.target.value })} />
            <div className="flex gap-2">
              <input placeholder="City" className="flex-1 input-clean" value={formData.City} onChange={e => setFormData({ ...formData, City: e.target.value })} />
              <input placeholder="Country" className="flex-1 input-clean" value={formData.Country} onChange={e => setFormData({ ...formData, Country: e.target.value })} />
            </div>
            <textarea placeholder="Initial Notes..." className="input-clean h-24" value={formData.Notes} onChange={e => setFormData({ ...formData, Notes: e.target.value })} />
          </>
        ) : (
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
        )}
        <button type="submit" className="w-full btn-primary py-2.5 mt-2">Create {type === 'lead' ? 'Lead' : 'Company'}</button>
      </form>
    </ModalWrapper>
  );
};

// --- COMPONENT: Detail Modal (Expanded) ---
const DetailModal = ({ lead, companies, leads, owners, onClose, onSave, onAnalyze, onResearch, onDelete, onOpenLead }) => {
  const [companyData, setCompanyData] = useState(companies[lead.Company] || { Company: lead.Company });
  const otherLeads = leads.filter(l => l.Company === lead.Company && l.id !== lead.id);

  const [isEditing, setIsEditing] = useState(false);

  const [history, setHistory] = useState(() => {
    let initialHistory = [];
    if (lead.History && lead.History.startsWith('[')) {
      initialHistory = safeJSONParse(lead.History);
    } else if (lead.Notes) {
      let legacyDate = new Date(0);
      if (lead.Date) {
        const parsed = parseDateStr(lead.Date);
        if (parsed) legacyDate = parsed;
      }
      initialHistory = [{
        date: legacyDate.toISOString(),
        type: 'note',
        content: lead.Notes,
        isLegacy: true
      }];
    }
    return initialHistory.sort((a, b) => new Date(b.date) - new Date(a.date));
  });

  const [newMessage, setNewMessage] = useState("");
  const [messageType, setMessageType] = useState('user');
  const [details, setDetails] = useState({ ...lead });
  const [logDate, setLogDate] = useState(new Date());
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [editingIndex, setEditingIndex] = useState(null);
  const [editDraft, setEditDraft] = useState({ content: '', type: 'note', date: new Date() });
  const [saveState, setSaveState] = useState('idle');

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
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }
      try {
        onSaveRef.current(
          { ...detailsRef.current, History: JSON.stringify(historyRef.current) },
          companyRef.current,
          { silent: true }
        );
      } catch { }
    };
  }, []);

  const handleSendMessage = () => {
    if (!newMessage.trim()) return;
    const newEntry = { date: logDate.toISOString(), type: messageType, content: newMessage };
    setHistory([...history, newEntry].sort((a, b) => new Date(b.date) - new Date(a.date)));
    setNewMessage("");
  };

  const handleResearch = async () => {
    const result = await onResearch(companyData.Company, details.City || "");
    if (result) setCompanyData(prev => ({ ...prev, ...result }));
  };

  const startEdit = (idx) => {
    const entry = history[idx];
    setEditingIndex(idx);
    setEditDraft({ content: entry.content, type: entry.type || 'note', date: new Date(entry.date) });
  };
  const cancelEdit = () => { setEditingIndex(null); };
  const saveEdit = () => {
    if (editingIndex === null) return;
    const updated = { date: editDraft.date.toISOString(), type: editDraft.type, content: editDraft.content };
    const next = history.map((h, i) => (i === editingIndex ? updated : h)).sort((a, b) => new Date(b.date) - new Date(a.date));
    setHistory(next);
    setEditingIndex(null);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-md flex items-center justify-center z-[80]" onClick={onClose}>
      <div className="bg-white w-[1152px] h-[85vh] rounded-2xl shadow-2xl flex overflow-hidden ring-1 ring-slate-900/5" onClick={e => e.stopPropagation()}>

        {/* COL 1: Details */}
        <div className="w-80 bg-slate-50 border-r border-slate-200 flex flex-col overflow-y-auto">

          {isEditing ? (
            <div className="p-4 m-3 bg-white border border-indigo-100 shadow-sm rounded-xl space-y-3 animate-in fade-in zoom-in-95 duration-200">
              <div className="text-xs font-bold text-indigo-600 uppercase tracking-wider mb-2">Edit Basic Info</div>
              <div>
                <label className="text-[10px] text-slate-400 font-bold">Full Name</label>
                <input className="input-clean py-1 text-sm font-semibold text-slate-800" value={details.Name} onChange={e => setDetails({ ...details, Name: e.target.value })} />
              </div>
              <div>
                <label className="text-[10px] text-slate-400 font-bold">Job Title</label>
                <input className="input-clean py-1 text-sm" value={details.Title} onChange={e => setDetails({ ...details, Title: e.target.value })} />
              </div>
              <div>
                <label className="text-[10px] text-slate-400 font-bold">Email</label>
                <input className="input-clean py-1 text-sm" value={details.Email} onChange={e => setDetails({ ...details, Email: e.target.value })} />
              </div>
              <div>
                <label className="text-[10px] text-slate-400 font-bold">LinkedIn URL</label>
                <input className="input-clean py-1 text-sm" value={details.LinkedIn} onChange={e => setDetails({ ...details, LinkedIn: e.target.value })} />
              </div>
              <button onClick={() => setIsEditing(false)} className="w-full btn-primary text-xs py-1.5 mt-2">Done</button>
            </div>
          ) : (
            <div className="p-6 text-center">
              <div className="w-20 h-20 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl font-bold text-indigo-600 shadow-inner">
                {lead.Name.charAt(0)}
              </div>
              <h2 className="font-bold text-xl text-slate-800 mb-1 leading-tight">{details.Name}</h2>
              <p className="text-sm text-slate-500">{details.Title || 'No Title'}</p>
              {details.Email && (
                <div className="mt-2 mb-4 flex items-center justify-center gap-2">
                  <span className="text-xs text-slate-600">{details.Email}</span>
                  <button onClick={() => { if (details.Email) { navigator.clipboard.writeText(details.Email); setCopiedEmail(true); setTimeout(() => setCopiedEmail(false), 1200); } }} className={`p-1.5 rounded-full transition-colors hover:bg-slate-100 ${copiedEmail ? 'text-emerald-600' : 'text-slate-400 hover:text-slate-600'}`} title="Copy email">
                    {copiedEmail ? <CheckCircle2 size={14} /> : <Copy size={14} />}
                  </button>
                </div>
              )}
              <div className="flex gap-2 justify-center">
                {details.LinkedIn && (
                  <a href={details.LinkedIn} target="_blank" rel="noreferrer" className="p-2 bg-white border border-slate-200 rounded-full text-slate-400 hover:text-blue-600 hover:border-blue-300 transition-colors" title="Open LinkedIn">
                    <Linkedin size={14} />
                  </a>
                )}
                <button onClick={() => setIsEditing(true)} className="p-2 bg-white border border-slate-200 rounded-full text-slate-400 hover:text-indigo-600 hover:border-indigo-300 transition-colors" title="Edit Basic Info">
                  <Pencil size={14} />
                </button>
                <button onClick={() => { if (confirm('Delete this lead permanently?')) onDelete(lead.id); }} className="p-2 bg-white border border-slate-200 rounded-full text-slate-400 hover:text-red-600 hover:border-red-300 transition-colors" title="Delete Lead">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          )}

          <div className="px-6 py-4 space-y-5 border-t border-slate-200">
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Stage</label>
              <select value={details.Stage} onChange={e => setDetails({ ...details, Stage: e.target.value })} className="w-full bg-white border border-slate-200 text-sm rounded-md p-2 outline-none focus:border-indigo-500">
                {ORDERED_STAGES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            {/* OWNER FIELD */}
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Owner</label>
              <input
                list="owners-list-detail"
                value={details.Owner || ''}
                onChange={e => setDetails({ ...details, Owner: e.target.value })}
                className="w-full bg-white border border-slate-200 text-sm rounded-md p-2 outline-none focus:border-indigo-500"
                placeholder="Unassigned"
              />
              <datalist id="owners-list-detail">
                {owners.map(m => <option key={m} value={m} />)}
              </datalist>
            </div>

            <div className={`p-3 rounded-lg border ${isDue(details['Next Date']) ? 'bg-rose-50 border-rose-200' : 'bg-white border-slate-200'}`}>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  Next Action {isDue(details['Next Date']) && <AlertCircle size={10} className="text-rose-500" />}
                </label>
                {(details['Next Date'] || details['Next Action']) && (
                  <button type="button" onClick={() => setDetails({ ...details, 'Next Date': '', 'Next Action': '' })} className="text-[10px] font-bold text-slate-500 hover:text-rose-600 transition-colors">
                    Clear
                  </button>
                )}
              </div>
              <div className="mb-2"><CustomDatePicker selected={parseDateStr(details['Next Date'])} onChange={d => setDetails({ ...details, 'Next Date': formatDateStr(d) })} /></div>
              <input className="w-full bg-transparent border-b border-slate-200 text-sm py-1 focus:border-indigo-500 outline-none" placeholder="Action description..." value={details['Next Action'] || ''} onChange={e => setDetails({ ...details, 'Next Action': e.target.value })} />
            </div>

            <div className="flex gap-4">
              {['Beta', 'Trial'].map(k => (
                <label key={k} className="flex items-center gap-2 text-xs font-medium text-slate-600 cursor-pointer">
                  <input type="checkbox" checked={toBool(details[k])} onChange={e => setDetails({ ...details, [k]: e.target.checked ? 'true' : 'false' })} className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" /> {k}
                </label>
              ))}
            </div>
          </div>
          <div className="mt-auto p-4 text-[10px] text-slate-400 text-center border-t border-slate-200 flex justify-center items-center gap-2 h-10">
            {saveState === 'saving' && <><Loader2 size={10} className="animate-spin" /> Saving...</>}
            {saveState === 'saved' && <><CheckCircle2 size={10} className="text-emerald-500" /> Saved</>}
          </div>
        </div>

        {/* COL 2: Chat Log */}
        <div className="flex-1 flex flex-col bg-white">
          <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <h3 className="font-semibold text-slate-700 flex items-center gap-2"><MessageSquare size={16} /> Activity Log</h3>
            <button onClick={() => onAnalyze(details, companyData, history)} className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 text-purple-700 text-xs font-bold rounded-full hover:bg-purple-100 transition-colors">
              <Sparkles size={12} /> Analyze with AI
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/30">
            {history.map((entry, idx) => {
              const isMine = entry.type === 'user' || entry.type === 'note';
              const isEditing = editingIndex === idx;
              return (
                <div key={idx} className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
                  <div className="flex items-center gap-2 mb-1 px-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{entry.type === 'user' ? 'Me' : entry.type === 'note' ? 'Note' : 'Lead'}</span>
                    <span className="text-[10px] text-slate-300">•</span>
                    <span className="text-[10px] text-slate-400">{entry.isLegacy ? <span className="italic">Legacy Import</span> : new Date(entry.date).toLocaleString('da-DK')}</span>
                  </div>
                  {isEditing ? (
                    <div className={`max-w-[85%] w-full p-3.5 rounded-2xl border bg-white shadow-sm ${isMine ? 'rounded-tr-sm' : 'rounded-tl-sm'}`}>
                      <div className="flex gap-2 mb-2">
                        {['user', 'lead', 'note'].map(t => (
                          <button key={t} onClick={() => setEditDraft(p => ({ ...p, type: t }))} className={`px-3 py-1 text-xs font-medium rounded-full border transition-all ${editDraft.type === t ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'}`}>{t.charAt(0).toUpperCase() + t.slice(1)}</button>
                        ))}
                        <div className="ml-auto w-40"><CustomDatePicker selected={editDraft.date} onChange={d => setEditDraft(p => ({ ...p, date: d }))} showTimeSelect placeholderText="Time" /></div>
                      </div>
                      <textarea className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all resize-none" rows={3} value={editDraft.content} onChange={e => setEditDraft(p => ({ ...p, content: e.target.value }))} />
                      <div className="flex justify-end gap-2 mt-2">
                        <button onClick={cancelEdit} className="px-3 py-1.5 text-xs rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50">Cancel</button>
                        <button onClick={saveEdit} className="px-3 py-1.5 text-xs rounded-md bg-indigo-600 text-white hover:bg-indigo-700">Save</button>
                      </div>
                    </div>
                  ) : (
                    <div className={`max-w-[85%] p-3.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap shadow-sm ${entry.type === 'user' ? 'bg-indigo-600 text-white rounded-tr-sm' : entry.type === 'note' ? 'bg-amber-50 text-slate-800 border border-amber-100' : 'bg-white border border-slate-200 text-slate-700 rounded-tl-sm'}`}>
                      {entry.content}
                    </div>
                  )}
                  <div className="mt-1 flex items-center gap-2 text-[10px] text-slate-400">
                    {!isEditing && (
                      <>
                        <button onClick={() => startEdit(idx)} className="hover:text-indigo-600 transition-colors">Edit</button>
                        <span>•</span>
                        <button onClick={() => { const h = history.filter((_, i) => i !== idx); setHistory(h); }} className="hover:text-red-500 transition-colors flex items-center gap-1"><Trash2 size={10} /> Delete</button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="p-4 border-t border-slate-100 bg-white">
            <div className="flex gap-2 mb-2">
              {['user', 'lead', 'note'].map(t => (
                <button key={t} onClick={() => setMessageType(t)} className={`px-3 py-1 text-xs font-medium rounded-full border transition-all ${messageType === t ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'}`}>{t.charAt(0).toUpperCase() + t.slice(1)}</button>
              ))}
              <div className="ml-auto w-32"><CustomDatePicker selected={logDate} onChange={setLogDate} showTimeSelect placeholderText="Time" /></div>
            </div>
            <div className="relative">
              <textarea className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 pr-12 text-sm outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all resize-none" rows={3} placeholder="Type a note or log an email..." value={newMessage} onChange={e => setNewMessage(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }} />
              <button onClick={handleSendMessage} className="absolute right-2 bottom-2 p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"><Edit3 size={14} /></button>
            </div>
          </div>
        </div>

        {/* COL 3: Company Intel */}
        <div className="w-72 bg-slate-50 border-l border-slate-200 p-6 overflow-y-auto">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold text-slate-700 text-sm flex items-center gap-2"><Building2 size={14} /> Company Intel</h3>
            <button onClick={handleResearch} className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded hover:bg-indigo-200 transition-colors flex items-center gap-1"><Globe size={10} /> Auto-Fill</button>
          </div>

          <div className="space-y-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
              <div><label className="text-[10px] font-bold text-slate-400 uppercase">Name</label><input className="w-full text-sm font-semibold border-b border-transparent focus:border-indigo-500 outline-none" value={companyData.Company || ''} onChange={e => setCompanyData({ ...companyData, Company: e.target.value })} /></div>
              <div><label className="text-[10px] font-bold text-slate-400 uppercase">Website</label><input className="w-full text-xs text-blue-600 border-b border-transparent focus:border-indigo-500 outline-none" value={companyData.Url || ''} onChange={e => setCompanyData({ ...companyData, Url: e.target.value })} /></div>
              <div><label className="text-[10px] font-bold text-slate-400 uppercase">Employees</label><input className="w-full text-xs border-b border-transparent focus:border-indigo-500 outline-none" value={companyData.Employees || ''} onChange={e => setCompanyData({ ...companyData, Employees: e.target.value })} /></div>
              {companyData.Reasoning && <div className="bg-slate-50 p-3 rounded-lg text-[10px] text-slate-600 leading-relaxed border border-slate-100">{companyData.Reasoning}</div>}
            </div>

            {otherLeads.length > 0 && (
              <div>
                <h4 className="font-bold text-slate-400 text-[10px] uppercase mb-2">Other Contacts ({otherLeads.length})</h4>
                <div className="space-y-2">
                  {otherLeads.map(l => (
                    <div
                      key={l.id}
                      className="bg-white p-2 rounded-lg border border-slate-200 text-xs hover:border-indigo-300 cursor-pointer transition-colors"
                      onClick={() => onOpenLead ? onOpenLead(l) : onClose()}
                    >
                      <div className="font-bold text-slate-700">{l.Name}</div>
                      <div className="text-slate-500">{l.Title}</div>
                      {/* Show Owner in other contacts list */}
                      <div className="mt-1 flex items-center gap-1 text-[10px] text-slate-400">
                        <User size={10} /> Owned by {l.Owner || 'Unassigned'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// --- COMPONENT: Board Card (Updated with Dynamic Owner Visibility) ---
const LeadCardUI = React.forwardRef(({ lead, company, onOpen, style, listeners, attributes, isOverlay, duplicatesSet, showOwnerAvatar }, ref) => {
  const stage = normalizeStage(lead.Stage);
  const daysSince = lead.calculatedDays || 0;
  const isDueToday = isDue(lead['Next Date']);
  const isDuplicate = duplicatesSet?.has(lead.id);
  const isEnterprise = (typeof company?.Employees === 'number') && company.Employees >= 500;

  const ownerName = lead.Owner || 'Unassigned';
  const ownerInitial = ownerName === 'Unassigned' ? '?' : ownerName.charAt(0).toUpperCase();

  // --- HEADER BADGE LOGIC (top-right) ---
  let headerBadge = null;
  if (isDueToday) {
    headerBadge = <StatusBadge type="due" label="Due Today" />;
  } else if (stage === 'New' && daysSince > 3) {
    headerBadge = <StatusBadge type="cold" label={`Cold (${daysSince}d)`} />;
  } else if (stage === 'Connected' && daysSince > 10) {
    headerBadge = <StatusBadge type="stalled" label={`Stalled (${daysSince}d)`} />;
  } else if (stage === 'Qualified') {
    headerBadge = <StatusBadge type="active" label="Active" />;
  }

  return (
    <div
      ref={ref} style={style} {...listeners} {...attributes}
      onClick={() => !isOverlay && onOpen(lead)}
      className={`
        bg-white p-4 mb-3 rounded-xl shadow-sm border border-slate-200 
        cursor-grab hover:shadow-md hover:border-indigo-300 transition-all duration-200 group relative
        ${isOverlay ? 'shadow-2xl scale-105 rotate-1 z-50 ring-2 ring-indigo-500' : ''}
        ${isDueToday ? 'ring-1 ring-rose-200' : ''}
      `}
    >
      {/* --- HEADER: COMPANY INFO (icon removed, elegant enterprise tag) --- */}
      <div className="flex items-center gap-1.5 mb-2 overflow-hidden">
        <span className="text-[10px] font-bold uppercase tracking-wider truncate text-slate-600">
          {lead.Company}
        </span>
        {isEnterprise && (<EnterpriseMark />)}
        {isDuplicate && <span className="text-[9px] font-bold text-white bg-red-500 px-1 rounded-[3px]">DUP</span>}
        {headerBadge}
      </div>

      {/* --- BODY: LEAD DETAILS + Owner Avatar (compact) --- */}
      <div className="space-y-1">
        <div>
          <h4 className="font-bold text-slate-800 text-sm leading-snug">{lead.Name}</h4>
        </div>
        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-500 truncate min-w-0">{lead.Title || 'No Title'}</p>
          {showOwnerAvatar && (
            <div
              className={`ml-2 w-5 h-5 rounded-full border flex items-center justify-center text-[9px] font-bold shadow-sm ${ownerName === 'Unassigned' ? 'bg-slate-50 text-slate-300 border-dashed border-slate-300' : 'bg-indigo-50 text-indigo-600 border-indigo-200'}`}
              title={`Owner: ${ownerName}`}
            >
              {ownerInitial}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

const DraggableLeadCard = (props) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: props.lead.id, data: { ...props.lead, company: props.company }
  });
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, opacity: isDragging ? 0 : 1 } : undefined;
  return <LeadCardUI ref={setNodeRef} style={style} listeners={listeners} attributes={attributes} {...props} />;
};

// --- COMPONENT: Column ---
const Column = ({ id, title, leads, companies, onOpen, duplicatesSet, onToggleHide, onFocusToggle, isFocused, currentSort, onChangeSort, showOwnerAvatar, collapseMulti, onToggleCollapse }) => {
  const { setNodeRef } = useDroppable({ id });
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const [expandedCompanies, setExpandedCompanies] = useState(() => new Set());

  useEffect(() => {
    const handleClick = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false); };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const sortedLeads = useMemo(() => {
    return [...leads].sort((a, b) => {
      const dueA = isDue(a['Next Date']) ? 1 : 0;
      const dueB = isDue(b['Next Date']) ? 1 : 0;
      if (dueA !== dueB) return dueB - dueA;
      switch (currentSort) {
        case 'alpha': return a.Name.localeCompare(b.Name);
        case 'size': {
          const sA = companies[a.Company]?.Employees || 0;
          const sB = companies[b.Company]?.Employees || 0;
          return sA === sB ? (a.calculatedDays || 0) - (b.calculatedDays || 0) : sB - sA;
        }
        case 'revival': return (b.calculatedDays || 0) - (a.calculatedDays || 0);
        default: return (a.calculatedDays || 0) - (b.calculatedDays || 0);
      }
    });
  }, [leads, companies, currentSort]);

  const groupedByCompany = useMemo(() => {
    const map = new Map();
    const order = [];
    sortedLeads.forEach(l => {
      if (!map.has(l.Company)) { map.set(l.Company, []); order.push(l.Company); }
      map.get(l.Company).push(l);
    });
    return order.map(c => ({ company: c, items: map.get(c) }));
  }, [sortedLeads]);

  const toggleCompanyExpand = (company) => {
    setExpandedCompanies(prev => {
      const next = new Set(prev);
      if (next.has(company)) next.delete(company); else next.add(company);
      return next;
    });
  };

  return (
    <div ref={setNodeRef} className="flex-shrink-0 w-80 h-full flex flex-col mr-4">
      {/* --- COLUMN HEADER --- */}
      <div className={`group flex justify-between items-center mb-3 px-3 py-2 rounded-lg transition-colors ${isFocused ? 'bg-indigo-50 border border-indigo-100' : 'hover:bg-gray-200/50'}`}>
        <div className="flex items-center gap-2 overflow-hidden cursor-pointer" onClick={() => onFocusToggle(id)}>
          <span className={`text-xs font-bold uppercase tracking-wider ${isFocused ? 'text-indigo-700' : 'text-slate-500'}`}>{title}</span>
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${isFocused ? 'bg-white text-indigo-600 shadow-sm' : 'bg-slate-200 text-slate-600'}`}>{leads.length}</span>
        </div>
        <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity" ref={menuRef}>
          <div className="relative">
            <button onClick={() => setMenuOpen(!menuOpen)} className={`p-1.5 rounded-md hover:bg-white hover:shadow-sm transition-all text-slate-400 hover:text-indigo-600 ${menuOpen ? 'bg-white text-indigo-600 shadow-sm' : ''}`}><MoreHorizontal size={14} /></button>
            {menuOpen && (
              <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-xl border border-slate-100 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100 origin-top-right">
                <div className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50 border-b border-slate-50">Sort By</div>
                <div className="p-1">
                  {Object.entries(SORT_STRATEGIES).map(([key, meta]) => (
                    <button key={key} onClick={() => { onChangeSort(id, key); setMenuOpen(false); }} className={`w-full flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition-colors ${currentSort === key ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}>
                      <span className="text-base">{meta.icon}</span>
                      <div className="flex-1 text-left"><div className="font-medium">{meta.label}</div><div className="text-[10px] opacity-70">{meta.desc}</div></div>
                      {currentSort === key && <Check size={14} />}
                    </button>
                  ))}
                </div>
                <div className="border-t border-slate-100 p-1">
                  <button onClick={() => { onToggleCollapse(id); setMenuOpen(false); }} className={`w-full flex items-center gap-2 px-3 py-2 text-xs rounded-lg transition-colors ${collapseMulti ? 'text-indigo-700 bg-indigo-50' : 'text-slate-600 hover:bg-slate-50'}`}>
                    <Building2 size={14} /> {collapseMulti ? 'Collapse by Company: On' : 'Collapse by Company: Off'}
                  </button>
                </div>
                <div className="border-t border-slate-100 p-1"><button onClick={() => onToggleHide(id)} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"><EyeOff size={14} /> Hide Column</button></div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* --- COLUMN BODY --- */}
      <div className={`flex-1 overflow-y-auto px-1 pb-4 custom-scrollbar rounded-xl transition-colors ${isFocused ? 'bg-indigo-50/30' : 'bg-slate-100/50'}`}>
        <div className="h-2" />

        {/* NON-COLLAPSED MODE */}
        {!collapseMulti && (
          sortedLeads.map(lead => (
            <DraggableLeadCard key={lead.id} lead={lead} company={companies[lead.Company]} onOpen={onOpen} duplicatesSet={duplicatesSet} showOwnerAvatar={showOwnerAvatar} />
          ))
        )}

        {/* COLLAPSED MODE */}
        {collapseMulti && (
          groupedByCompany.map(group => {
            // Case 1: Single Item (Render exactly like a normal card)
            if (group.items.length <= 1) {
              const lead = group.items[0];
              return <DraggableLeadCard key={lead.id} lead={lead} company={companies[lead.Company]} onOpen={onOpen} duplicatesSet={duplicatesSet} showOwnerAvatar={showOwnerAvatar} />;
            }

            const expanded = expandedCompanies.has(group.company);
            // Calculate Enterprise status for the group header (matches LeadCardUI logic)
            const compData = companies[group.company];
            const isEnterprise = (typeof compData?.Employees === 'number') && compData.Employees >= 500;
            const groupDue = group.items.some(i => isDue(i['Next Date']));
            const groupCold = group.items.some(i => normalizeStage(i.Stage) === 'New' && (i.calculatedDays || 0) > 3);
            const groupStalled = group.items.some(i => normalizeStage(i.Stage) === 'Connected' && (i.calculatedDays || 0) > 10);
            const groupActive = group.items.some(i => normalizeStage(i.Stage) === 'Qualified');
            const groupHeaderBadge = groupDue
              ? <StatusBadge type="due" label="Due Today" />
              : groupCold
                ? <StatusBadge type="cold" label="Cold" />
                : groupStalled
                  ? <StatusBadge type="stalled" label="Stalled" />
                  : groupActive
                    ? <StatusBadge type="active" label="Active" />
                    : null;

            return (
              <div key={`group-${group.company}`} className="mb-3">
                <button
                  onClick={() => toggleCompanyExpand(group.company)}
                  className={`
                    w-full text-left relative
                    bg-white p-4 rounded-xl shadow-sm border border-slate-200 
                    hover:shadow-md hover:border-indigo-300 transition-all duration-200
                    ${expanded ? 'ring-2 ring-indigo-500/20 border-indigo-300' : ''}
                  `}
                >
                  {/* HEADER: Company name with elegant enterprise tag */}
                  <div className="flex items-center gap-1.5 mb-2 overflow-hidden">
                    <span className="text-[10px] font-bold uppercase tracking-wider truncate text-slate-600">
                      {group.company}
                    </span>
                    {isEnterprise && (<EnterpriseMark />)}
                    {groupHeaderBadge}
                  </div>

                  {/* BODY: Simulates Name/Title structure */}
                  <div className="flex justify-between items-start">
                    <div className="flex-1 min-w-0 pr-2">
                      {/* "Name" slot -> Shows Count */}
                      <h4 className="font-bold text-slate-800 text-sm leading-snug mb-0.5">
                        {group.items.length} Contacts
                      </h4>
                      {/* "Title" slot -> Shows Names */}
                      <p className="text-xs text-slate-500 truncate">
                        {group.items.map(i => i.Name).join(', ')}
                      </p>
                    </div>

                    {/* FOOTER: Chevron in the action slot */}
                    <div className={`text-slate-400 transition-transform mt-1 ${expanded ? 'rotate-180' : ''}`}>
                      <ChevronDown size={16} />
                    </div>
                  </div>
                </button>

                {/* EXPANDED ITEMS */}
                {expanded && (
                  <div className="mt-2 ml-4 pl-3 border-l-2 border-indigo-100 animate-in fade-in slide-in-from-top-1 duration-200">
                    {group.items.map(lead => (
                      <DraggableLeadCard
                        key={lead.id}
                        lead={lead}
                        company={companies[lead.Company]}
                        onOpen={onOpen}
                        duplicatesSet={duplicatesSet}
                        showOwnerAvatar={showOwnerAvatar}
                      // Optional: hideHeader={true} if you updated LeadCardUI to support it
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
        {sortedLeads.length === 0 && (<div className="h-32 flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 rounded-xl m-2"><span className="text-xs">Empty</span></div>)}
      </div>
    </div>
  );
};
// --- MAIN APP ---
export default function App() {
  const [leads, setLeads] = useState([]);
  const [companies, setCompanies] = useState({});
  const [sha, setSha] = useState({ leads: null, companies: null });
  const [keys, setKeys] = useState({ github: localStorage.getItem('gh_token') || '', gemini: localStorage.getItem('gemini_key') || '' });
  const [loading, setLoading] = useState(false);

  // UI State
  const [activeId, setActiveId] = useState(null);
  const [detailLead, setDetailLead] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showSettings, setShowSettings] = useState(!keys.github);
  const [searchQuery, setSearchQuery] = useState("");
  const [visibleStages, setVisibleStages] = useState(() => loadVisibleStages());
  const [focusedStage, setFocusedStage] = useState(null);
  const [columnSorts, setColumnSorts] = useState(DEFAULT_SORTS);
  const [columnCollapse, setColumnCollapse] = useState(DEFAULT_COLLAPSE);
  const [filters, setFilters] = useState({ due: false, dup: false, beta: false, trial: false, focus: false });
  const [ownerFilter, setOwnerFilter] = useState(() => {
    try {
      const saved = localStorage.getItem(OWNER_FILTER_LS_KEY);
      return saved ?? '';
    } catch { return ''; }
  });
  const [copiedEmail, setCopiedEmail] = useState(false);

  const toggleFilter = (k) => setFilters(p => ({ ...p, [k]: !p[k] }));

  const { askGemini, researchCompany, researchLead, advice, setAdvice, loading: geminiLoading } = useGemini(keys.gemini);
  const sensors = useSensors(useSensor(MouseSensor, { activationConstraint: { distance: 5 } }), useSensor(TouchSensor));

  const uniqueOwners = useMemo(() => {
    return [...new Set(leads.map(l => l.Owner).filter(Boolean))].sort();
  }, [leads]);

  useEffect(() => {
    if (!keys.github) return;
    setTimeout(() => setLoading(true), 0);
    Promise.all([fetchCSV(keys.github, REPO_OWNER, REPO_NAME, LEADS_PATH), fetchCSV(keys.github, REPO_OWNER, REPO_NAME, COMPANIES_PATH)])
      .then(([leadsRes, companiesRes]) => {
        const compMap = {};
        companiesRes.data.forEach(c => { if (c.Employees !== undefined && typeof c.Employees !== 'number') return; compMap[c.Company] = { ...c }; });

        const validLeads = leadsRes.data.filter(l => l.Name && l.Stage).map(l => {
          const normStage = normalizeStage(l.Stage);
          const rawDays = getDaysSinceInteraction(l.History);
          let finalDays = 999;
          if (rawDays !== null) finalDays = rawDays;
          else if (normStage === 'New') finalDays = 0;
          return { ...l, Stage: normStage, id: l.id || generateId(l.Name), Beta: toBool(l.Beta) ? 'true' : 'false', Trial: toBool(l.Trial) ? 'true' : 'false', calculatedDays: finalDays };
        });

        const idsSeen = new Set();
        const uniqueLeads = validLeads.map(l => { let id = l.id; while (idsSeen.has(id)) id = generateId(l.Name); idsSeen.add(id); return { ...l, id }; });

        setCompanies(compMap);
        setLeads(uniqueLeads);
        setSha({ leads: leadsRes.sha, companies: companiesRes.sha });
      }).catch(e => { console.error(e); alert("Error loading data"); }).finally(() => setLoading(false));
  }, [keys.github]);

  useEffect(() => { try { localStorage.setItem(VISIBLE_STAGES_LS_KEY, JSON.stringify(visibleStages)); } catch { } }, [visibleStages]);
  useEffect(() => { try { localStorage.setItem(OWNER_FILTER_LS_KEY, ownerFilter); } catch { } }, [ownerFilter]);

  const saveLeadsToGithub = (newLeads) => {
    setLeads(newLeads);
    return saveCSV(keys.github, REPO_OWNER, REPO_NAME, LEADS_PATH, newLeads, sha.leads).then(r => setSha(p => ({ ...p, leads: r.content.sha }))).catch(() => alert("Save failed"));
  };
  const saveCompaniesToGithub = (newComp) => {
    setCompanies(newComp);
    return saveCSV(keys.github, REPO_OWNER, REPO_NAME, COMPANIES_PATH, Object.values(newComp), sha.companies).then(r => setSha(p => ({ ...p, companies: r.content.sha })));
  };

  const handleDragEnd = ({ active, over }) => {
    setActiveId(null);
    if (!over || active.id === over.id) return;
    const newStage = over.id;
    saveLeadsToGithub(leads.map(l => l.id === active.id ? { ...l, Stage: newStage, 'Is Customer': newStage === 'Won' ? 'TRUE' : l['Is Customer'] } : l));
  };

  const handleAdd = (type, data) => {
    if (type === 'lead') {
      const now = new Date();
      const hasInitialNote = (data.Notes || '').trim().length > 0;
      const history = hasInitialNote ? [{ date: now.toISOString(), type: 'note', content: data.Notes }] : [];
      const newLead = {
        ...data,
        History: history.length ? JSON.stringify(history) : '',
        Notes: hasInitialNote ? '' : (data.Notes || ''),
        Stage: 'New',
        calculatedDays: 0,
        id: generateId(data.Name),
        Beta: 'false',
        Trial: 'false',
        Owner: data.Owner || ''
      };
      saveLeadsToGithub([newLead, ...leads]);
      setDetailLead(newLead);
    }
    else saveCompaniesToGithub({ ...companies, [data.Company]: data });
    setShowAddModal(false);
  };

  const handleUpdateLead = (updLead, updComp, opts) => {
    const enriched = { ...updLead, calculatedDays: getDaysSinceInteraction(updLead.History) };
    const p = [];
    if (JSON.stringify(leads.find(l => l.id === updLead.id)) !== JSON.stringify(enriched)) p.push(saveLeadsToGithub(leads.map(l => l.id === updLead.id ? enriched : l)));
    if (updComp && JSON.stringify(companies[updComp.Company]) !== JSON.stringify(updComp)) p.push(saveCompaniesToGithub({ ...companies, [updComp.Company]: updComp }));
    if (!opts?.silent) setDetailLead(enriched);
    return Promise.all(p);
  };

  const duplicatesSet = useMemo(() => {
    const map = new Map(), dup = new Set();
    leads.forEach(l => [l.Email, l.LinkedIn, l.Name].forEach(k => {
      if (!k) return;
      const key = k.trim().toLowerCase();
      if (map.has(key)) { dup.add(l.id); dup.add(map.get(key)); } else map.set(key, l.id);
    }));
    return dup;
  }, [leads]);

  const processedLeads = useMemo(() => {
    return leads.filter(l => {
      if (ownerFilter && (l.Owner || 'Unassigned') !== ownerFilter) return false; // OWNER FILTER
      if (filters.due && !isDue(l['Next Date'])) return false;
      if (filters.dup && !duplicatesSet.has(l.id)) return false;
      if (filters.beta && !toBool(l.Beta)) return false;
      if (filters.trial && !toBool(l.Trial)) return false;
      if (filters.focus) {
        if (!isDue(l['Next Date']) && (l.calculatedDays || 0) >= 30 && !['Connected', 'Qualified', 'Offer'].includes(l.Stage)) return false;
      }
      if (!searchQuery) return true;
      return l.Name.toLowerCase().includes(searchQuery.toLowerCase()) || l.Company.toLowerCase().includes(searchQuery.toLowerCase());
    });
  }, [leads, searchQuery, filters, duplicatesSet, ownerFilter]);

  const activeLead = activeId ? leads.find(l => l.id === activeId) : null;

  return (
    <>
      <GlobalStyles />
      <div className="h-screen flex flex-col bg-slate-50 text-slate-900 overflow-hidden">
        <header className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center shadow-sm z-20">
          <div className="flex items-center gap-6">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-indigo-200">F</div>
            <div className="relative w-64 group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={16} />
              <input type="text" placeholder="Search pipeline..." className="w-full pl-10 pr-4 py-2 bg-slate-100 border-transparent rounded-lg text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
              {searchQuery && <button onClick={() => setSearchQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600"><X size={14} /></button>}
            </div>

            <div className="flex items-center gap-2 border-l border-slate-200 pl-6">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-slate-200 bg-white hover:border-slate-300">
                <Users size={14} className="text-slate-400" />
                <select className="text-xs font-semibold text-slate-600 outline-none bg-transparent cursor-pointer" value={ownerFilter} onChange={e => setOwnerFilter(e.target.value)}>
                  <option value="">All Owners</option>
                  {uniqueOwners.map(m => <option key={m} value={m}>{m}</option>)}
                  <option value="Unassigned">Unassigned</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2 border-l border-slate-200 pl-6">
              {[{ k: 'due', l: 'Tasks', i: <Clock size={14} />, c: 'text-rose-600 bg-rose-50 border-rose-200' }, { k: 'focus', l: 'Focus', i: <Filter size={14} />, c: 'text-indigo-600 bg-indigo-50 border-indigo-200' }, { k: 'beta', l: 'Beta', i: <Sparkles size={14} />, c: 'text-purple-600 bg-purple-50 border-purple-200' }].map(f => (
                <button key={f.k} onClick={() => toggleFilter(f.k)} className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold transition-all border ${filters[f.k] ? f.c : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'}`}>{f.i} {f.l}</button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setShowAddModal(true)} className="btn-primary flex items-center gap-2 px-4 py-2 rounded-lg text-sm shadow-md shadow-indigo-200"><Plus size={16} /> <span className="hidden sm:inline">Add Lead</span></button>
            {(focusedStage || Object.values(visibleStages).some(v => !v)) && <button onClick={() => { setVisibleStages(defaultVisibleStages()); setFocusedStage(null) }} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-colors" title="Show All"><Eye size={20} /></button>}
            <button onClick={() => setShowSettings(true)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"><Settings size={20} /></button>
          </div>
        </header>

        <main className="flex-1 overflow-x-auto overflow-y-hidden p-6">
          {loading ? (
            <div className="flex flex-col justify-center items-center h-full text-slate-400 gap-3"><Loader2 className="animate-spin text-indigo-500" size={32} /> <span className="text-sm font-medium">Loading Pipeline...</span></div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd} onDragStart={e => setActiveId(e.active.id)}>
              <div className="flex h-full w-max">
                {(focusedStage ? [focusedStage] : ORDERED_STAGES.filter(s => visibleStages[s])).map(stage => (
                  <Column
                    key={stage} id={stage} title={stage}
                    leads={processedLeads.filter(l => l.Stage === stage)}
                    companies={companies} onOpen={setDetailLead}
                    duplicatesSet={duplicatesSet} onToggleHide={() => { setVisibleStages(p => ({ ...p, [stage]: false })); if (focusedStage === stage) setFocusedStage(null); }}
                    onFocusToggle={s => setFocusedStage(prev => prev === s ? null : s)}
                    isFocused={focusedStage === stage} currentSort={columnSorts[stage]}
                    onChangeSort={(s, k) => setColumnSorts(p => ({ ...p, [s]: k }))}
                    showOwnerAvatar={ownerFilter === ''}
                    collapseMulti={!!columnCollapse[stage]}
                    onToggleCollapse={(s) => setColumnCollapse(p => ({ ...p, [s]: !p[s] }))}
                  />
                ))}
              </div>
              <DragOverlay>{activeLead && <LeadCardUI lead={activeLead} company={companies[activeLead.Company]} isOverlay={true} showOwnerAvatar={ownerFilter === ''} />}</DragOverlay>
            </DndContext>
          )}
        </main>

        {showAddModal && <AddModal companies={companies} leads={leads} owners={uniqueOwners} onClose={() => setShowAddModal(false)} onSave={handleAdd} onResearchLead={researchLead} onResearchCompany={researchCompany} />}
        {detailLead && (
          <DetailModal
            key={detailLead.id}
            lead={detailLead}
            companies={companies}
            leads={leads}
            owners={uniqueOwners}
            onClose={() => setDetailLead(null)}
            onOpenLead={setDetailLead}
            onSave={handleUpdateLead}
            onAnalyze={askGemini}
            onResearch={researchCompany}
            onDelete={id => saveLeadsToGithub(leads.filter(l => l.id !== id)).then(() => setDetailLead(null))}
          />
        )}

        {showSettings && (
          <ModalWrapper title="Settings" onClose={() => setShowSettings(false)}>
            <div className="space-y-4">
              <div><label className="text-xs font-bold text-slate-400 uppercase">GitHub Token</label><input type="password" value={keys.github} onChange={e => setKeys({ ...keys, github: e.target.value })} className="input-clean mt-1" /></div>
              <div><label className="text-xs font-bold text-slate-400 uppercase">Gemini Key</label><input type="password" value={keys.gemini} onChange={e => setKeys({ ...keys, gemini: e.target.value })} className="input-clean mt-1" /></div>
              <button onClick={() => { localStorage.setItem('gh_token', keys.github); localStorage.setItem('gemini_key', keys.gemini); window.location.reload(); }} className="w-full btn-primary py-2.5">Save & Reload</button>
            </div>
          </ModalWrapper>
        )}

        {advice && (
          <div className="fixed right-0 top-0 h-full w-[450px] bg-white shadow-2xl border-l border-slate-200 z-[90] p-6 overflow-y-auto animate-in slide-in-from-right">
            <div className="flex justify-between items-center mb-6"><h3 className="text-xl font-bold flex items-center gap-2 text-slate-800"><Sparkles className="text-purple-600" /> AI Analysis</h3><button onClick={() => setAdvice(null)}><X size={20} className="text-slate-400 hover:text-slate-600" /></button></div>
            <div className="space-y-6">
              <div className="bg-purple-50 p-5 rounded-xl border border-purple-100 shadow-sm"><h4 className="font-bold text-purple-900 text-xs uppercase tracking-wider mb-2">Strategy</h4><p className="text-sm text-slate-700 leading-relaxed">{advice.strategy}</p></div>
              <div><div className="flex justify-between mb-2"><h4 className="font-bold text-slate-400 text-xs uppercase">Response Draft</h4><button onClick={() => { navigator.clipboard.writeText(advice.email_draft || ""); setCopiedEmail(true); setTimeout(() => setCopiedEmail(false), 1500); }} className="text-indigo-600 text-xs font-bold flex gap-1 hover:text-indigo-800 transition-colors">{copiedEmail ? <CheckCircle2 size={12} /> : <Mail size={12} />} Copy</button></div><textarea className="w-full h-64 p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono text-slate-600 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all" defaultValue={advice.email_draft} /></div>
            </div>
          </div>
        )}
        {geminiLoading && <div className="fixed bottom-8 right-8 bg-slate-900 text-white px-6 py-3 rounded-full flex items-center gap-3 shadow-2xl z-[100] animate-bounce"><Loader2 className="animate-spin" size={20} /> Analyzing...</div>}
      </div>
    </>
  );
}