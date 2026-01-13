/* src/App.jsx */
import React, { useState, useEffect, useMemo } from 'react';
import {
  DndContext, useDraggable, useDroppable, DragOverlay, closestCorners,
  useSensor, useSensors, MouseSensor, TouchSensor
} from '@dnd-kit/core';
import {
  Settings, Sparkles, X, Loader2, Search, Mail, Calendar,
  Edit3, Save, Plus, Linkedin, Clock, Building2, UserPlus, MessageSquare,
  Globe, CheckCircle2, AlertCircle, MapPin, Trophy, Ban, Trash2, Filter
} from 'lucide-react';
import { fetchCSV, saveCSV } from './lib/github';
import { useGemini } from './hooks/useGemini';

// --- DATE PICKER IMPORTS ---
import DatePicker, { registerLocale } from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { da } from 'date-fns/locale/da';
registerLocale('da', da);

// --- CONFIGURATION (STRICTLY KEPT AS REQUESTED) ---
const REPO_OWNER = "figurement";
const REPO_NAME = "leads-data";
const LEADS_PATH = "leads.csv";
const COMPANIES_PATH = "companies.csv";

// --- CONSTANTS ---
const ORDERED_STAGES = [
  '1. New',
  '2. Attempting',
  '3. Connected',
  '4. Qualified',
  '5. Disqualified',
  '6. Won'
];

// --- HELPERS ---
const generateId = (name) => {
  const rand = Math.random().toString(36).slice(2, 8);
  return `lead-${Date.now()}-${rand}-${name?.replace(/[^a-z0-9]/gi, '') || 'new'}`;
};
const safeJSONParse = (str) => {
  try { return JSON.parse(str); } catch { return []; }
};

// Parse DD/MM/YYYY string to JS Date Object
const parseDateStr = (str) => {
  if (!str) return null;
  const [d, m, y] = str.split('/');
  const date = new Date(y, m - 1, d);
  return isNaN(date) ? null : date;
};

// Format JS Date to DD/MM/YYYY string
const formatDateStr = (date) => {
  if (!date) return "";
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = date.getFullYear();
  return `${d}/${m}/${y}`;
};

// Normalize CSV boolean-ish values for filters and badges
const toBool = (v) => {
  if (typeof v === 'boolean') return v;
  const s = String(v || '').trim().toLowerCase();
  return s === 'true' || s === '1' || s === 'yes' || s === 'y';
};

// Employees must be an integer; no string conversion here

const isDue = (dateStr) => {
  if (!dateStr) return false;
  const date = parseDateStr(dateStr);
  if (!date) return false;
  const now = new Date();
  now.setHours(0, 0, 0, 0); // Compare dates only
  return date <= now;
};

// --- CUSTOM DATE PICKER COMPONENT ---
const CustomDatePicker = ({ selected, onChange, showTimeSelect, placeholderText }) => {
  return (
    <div className="relative w-full">
      <DatePicker
        selected={selected}
        onChange={onChange}
        locale="da"
        dateFormat={showTimeSelect ? "dd/MM/yyyy HH:mm" : "dd/MM/yyyy"}
        showTimeSelect={showTimeSelect}
        timeFormat="HH:mm"
        timeIntervals={15}
        placeholderText={placeholderText || "Vælg dato"}
        className="w-full border rounded p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
        portalId="root"
        popperPlacement="bottom-start"
        popperClassName="z-[1000]"
        calendarClassName="!font-sans !border-0 !shadow-xl !rounded-lg"
        dayClassName={() => "!rounded hover:!bg-blue-100"}
      />
      {/* Custom Styles for DatePicker to match Tailwind */}
      <style>{`
        .react-datepicker-wrapper { width: 100%; }
        .react-datepicker-popper { z-index: 1000; }
        .react-datepicker__header { background: #f3f4f6; border-bottom: 1px solid #e5e7eb; }
        .react-datepicker__day--selected { background-color: #2563eb !important; }
        .react-datepicker__time-container .react-datepicker__time .react-datepicker__time-box ul.react-datepicker__time-list li.react-datepicker__time-list-item--selected { background-color: #2563eb !important; }
      `}</style>
    </div>
  );
};

// --- COMPONENT 1: Add New Modal ---
const AddModal = ({ companies, onClose, onSave, onResearchLead, onResearchCompany }) => {
  const [type, setType] = useState('lead');
  const [isResearching, setIsResearching] = useState(false);
  const [formData, setFormData] = useState({
    Name: '', Title: '', Company: '', Email: '', LinkedIn: '',
    Category: '', Employees: '', City: '', Country: '', Url: '', Software: '', Notes: ''
  });

  const handleAutoFill = async () => {
    setIsResearching(true);
    if (type === 'lead') {
      if (!formData.Name || !formData.Company) { alert("Enter Name and Company first"); setIsResearching(false); return; }
      const res = await onResearchLead(formData.Name, formData.Company);
      if (res) setFormData(prev => ({ ...prev, ...res }));
    } else {
      if (!formData.Company) { alert("Enter Company Name first"); setIsResearching(false); return; }
      const res = await onResearchCompany(formData.Company);
      if (res) setFormData(prev => ({ ...prev, ...res }));
    }
    setIsResearching(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(type, formData);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[70]" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="bg-gray-50 px-6 py-4 border-b flex justify-between items-center">
          <h3 className="font-bold text-gray-800">Add New</h3>
          <div className="flex bg-gray-200 rounded-lg p-1 text-xs font-bold">
            <button onClick={() => setType('lead')} className={`px-3 py-1 rounded ${type === 'lead' ? 'bg-white shadow' : 'text-gray-500'}`}>Lead</button>
            <button onClick={() => setType('company')} className={`px-3 py-1 rounded ${type === 'company' ? 'bg-white shadow' : 'text-gray-500'}`}>Company</button>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {type === 'lead' ? (
            <>
              <div className="flex gap-2 items-center">
                <input required placeholder="Full Name" className="flex-1 border p-2 rounded w-full min-w-0" value={formData.Name} onChange={e => setFormData({ ...formData, Name: e.target.value })} />
                <input required placeholder="Company" list="company-list" className="flex-1 border p-2 rounded w-full min-w-0" value={formData.Company} onChange={e => setFormData({ ...formData, Company: e.target.value })} />
                <button type="button" onClick={handleAutoFill} className="flex-none bg-purple-100 text-purple-700 p-2.5 rounded hover:bg-purple-200 transition-colors" title="Auto-Fill with AI">
                  {isResearching ? <Loader2 className="animate-spin" size={18} /> : <Sparkles size={18} />}
                </button>
              </div>
              <datalist id="company-list">{Object.keys(companies).map(c => <option key={c} value={c} />)}</datalist>

              <input placeholder="Job Title" className="w-full border p-2 rounded" value={formData.Title || ''} onChange={e => setFormData({ ...formData, Title: e.target.value })} />
              <input placeholder="Email" className="w-full border p-2 rounded" value={formData.Email || ''} onChange={e => setFormData({ ...formData, Email: e.target.value })} />
              <input placeholder="LinkedIn URL" className="w-full border p-2 rounded" value={formData.LinkedIn || ''} onChange={e => setFormData({ ...formData, LinkedIn: e.target.value })} />

              <div className="flex gap-2">
                <input placeholder="City" className="flex-1 border p-2 rounded w-full" value={formData.City || ''} onChange={e => setFormData({ ...formData, City: e.target.value })} />
                <input placeholder="Country" className="flex-1 border p-2 rounded w-full" value={formData.Country || ''} onChange={e => setFormData({ ...formData, Country: e.target.value })} />
              </div>
              <textarea placeholder="Initial Notes..." className="w-full border p-2 rounded h-20 text-sm" value={formData.Notes || ''} onChange={e => setFormData({ ...formData, Notes: e.target.value })} />
            </>
          ) : (
            <>
              <div className="flex gap-2 items-center">
                <input required placeholder="Company Name" className="flex-1 border p-2 rounded w-full min-w-0" value={formData.Company} onChange={e => setFormData({ ...formData, Company: e.target.value })} />
                <button type="button" onClick={handleAutoFill} className="flex-none bg-purple-100 text-purple-700 p-2.5 rounded hover:bg-purple-200 transition-colors" title="Auto-Fill with AI">
                  {isResearching ? <Loader2 className="animate-spin" size={18} /> : <Sparkles size={18} />}
                </button>
              </div>
              <input placeholder="Website URL" className="w-full border p-2 rounded" value={formData.Url || ''} onChange={e => setFormData({ ...formData, Url: e.target.value })} />
              <input placeholder="Industry / Category" className="w-full border p-2 rounded" value={formData.Category || ''} onChange={e => setFormData({ ...formData, Category: e.target.value })} />
              <input placeholder="Tech Stack (comma sep)" className="w-full border p-2 rounded" value={formData.Software || ''} onChange={e => setFormData({ ...formData, Software: e.target.value })} />
              <input placeholder="Employees (e.g. 50-200)" className="w-full border p-2 rounded" value={formData.Employees || ''} onChange={e => setFormData({ ...formData, Employees: e.target.value })} />
              <div className="flex gap-2">
                <input placeholder="City" className="flex-1 border p-2 rounded w-full" value={formData.City || ''} onChange={e => setFormData({ ...formData, City: e.target.value })} />
                <input placeholder="Country" className="flex-1 border p-2 rounded w-full" value={formData.Country || ''} onChange={e => setFormData({ ...formData, Country: e.target.value })} />
              </div>
            </>
          )}
          <button type="submit" className="w-full bg-blue-600 text-white p-3 rounded font-bold hover:bg-blue-700">Create {type === 'lead' ? 'Lead' : 'Company'}</button>
        </form>
      </div>
    </div>
  );
};

// --- COMPONENT 2: Super Detail Modal ---
const DetailModal = ({ lead, companies, leads, onClose, onSave, onAnalyze, onResearch, onDelete }) => {
  const [companyData, setCompanyData] = useState(companies[lead.Company] || { Company: lead.Company });
  const otherLeads = leads.filter(l => l.Company === lead.Company && l.id !== lead.id);

  const [history, setHistory] = useState(() => {
    let initialHistory = [];
    if (lead.History && lead.History.startsWith('[')) initialHistory = safeJSONParse(lead.History);
    else if (lead.Notes) initialHistory = [{ date: new Date().toISOString(), type: 'note', content: lead.Notes }];
    return initialHistory.sort((a, b) => new Date(b.date) - new Date(a.date));
  });

  const [newMessage, setNewMessage] = useState("");
  const [messageType, setMessageType] = useState('user');
  const [details, setDetails] = useState({ ...lead });
  const [logDate, setLogDate] = useState(new Date()); // State is now a Date Object

  // Autosave state
  const [saveState, setSaveState] = useState('idle'); // idle | saving | saved
  const autosaveTimerRef = React.useRef(null);
  const initialRenderRef = React.useRef(true);
  const onSaveRef = React.useRef(onSave);
  useEffect(() => { onSaveRef.current = onSave; }, [onSave]);

  // Debounced autosave whenever details, history, or companyData change
  useEffect(() => {
    if (initialRenderRef.current) {
      initialRenderRef.current = false;
      return;
    }

    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(() => {
      setSaveState('saving');
      Promise.resolve(
        onSaveRef.current({ ...details, History: JSON.stringify(history) }, companyData)
      ).then(() => {
        setSaveState('saved');
        setTimeout(() => setSaveState('idle'), 1200);
      }).catch(() => {
        setSaveState('idle');
      });
    }, 800);

    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }
    };
  }, [details, companyData, history]);

  const handleSendMessage = () => {
    if (!newMessage.trim()) return;
    const newEntry = { date: logDate.toISOString(), type: messageType, content: newMessage };
    const updatedHistory = [...history, newEntry].sort((a, b) => new Date(b.date) - new Date(a.date));
    setHistory(updatedHistory);
    setNewMessage("");
    // Autosave will persist this change shortly
  };

  const handleDeleteEntry = (idx) => {
    const updated = history.filter((_, i) => i !== idx);
    setHistory(updated);
  };

  const handleResearch = async () => {
    const result = await onResearch(companyData.Company, details.City || "");
    if (result) setCompanyData(prev => ({ ...prev, ...result }));
  };

  // Removed explicit save button; autosave handles persistence

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-[60]" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl h-[85vh] flex overflow-hidden" onClick={e => e.stopPropagation()}>

        {/* COL 1: Lead Details */}
        <div className="w-1/4 bg-gray-50 border-r p-6 overflow-y-auto">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3 text-2xl font-bold text-blue-600">
              {lead.Name.charAt(0)}
            </div>
            <h2 className="font-bold text-lg text-gray-900 leading-tight mb-2">{lead.Name}</h2>
            <input
              value={details.Title || ''} onChange={e => setDetails({ ...details, Title: e.target.value })}
              className="text-sm text-gray-500 mb-2 text-center w-full bg-transparent border-b border-transparent hover:border-gray-300 focus:border-blue-500 outline-none"
              placeholder="Add Title"
            />

            <div className="flex items-center gap-1 justify-center mb-1">
              <Mail size={12} className="text-gray-400" />
              <input
                value={details.Email || ''} onChange={e => setDetails({ ...details, Email: e.target.value })}
                className="text-xs text-center bg-transparent border-b border-transparent hover:border-gray-300 focus:border-blue-500 outline-none w-40"
                placeholder="Add Email"
              />
            </div>
            <div className="flex items-center gap-1 justify-center mb-4">
              <Linkedin size={12} className="text-blue-600" />
              <input
                value={details.LinkedIn || ''} onChange={e => setDetails({ ...details, LinkedIn: e.target.value })}
                className="text-xs text-blue-600 text-center bg-transparent border-b border-transparent hover:border-gray-300 focus:border-blue-500 outline-none w-40"
                placeholder="LinkedIn URL"
              />
              {details.LinkedIn && <a href={details.LinkedIn} target="_blank" className="text-gray-400 hover:text-blue-600">↗</a>}
            </div>
            <div className="flex gap-2 mb-4">
              <input placeholder="City" className="w-1/2 text-xs border rounded p-1" value={details.City || ''} onChange={e => setDetails({ ...details, City: e.target.value })} />
              <input placeholder="Country" className="w-1/2 text-xs border rounded p-1" value={details.Country || ''} onChange={e => setDetails({ ...details, Country: e.target.value })} />
            </div>
          </div>

          <div className="space-y-4 text-sm border-t pt-4">
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase">Stage</label>
              <select value={details.Stage} onChange={(e) => setDetails({ ...details, Stage: e.target.value })} className="w-full mt-1 border rounded p-1.5 bg-white">
                {ORDERED_STAGES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className={`p-2 rounded-lg border ${isDue(details['Next Date']) ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200'}`}>
              <label className="block text-xs font-bold text-gray-400 uppercase flex items-center gap-1">Next Date {isDue(details['Next Date']) && <AlertCircle size={10} className="text-red-500" />}</label>
              {/* CUSTOM DATE PICKER */}
              <CustomDatePicker
                selected={parseDateStr(details['Next Date'])}
                onChange={(date) => setDetails({ ...details, 'Next Date': formatDateStr(date) })}
                placeholderText="dd/mm/yyyy"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase">Next Action</label>
              <input value={details['Next Action'] || ''} onChange={e => setDetails({ ...details, 'Next Action': e.target.value })} className="w-full mt-1 border rounded p-1.5" placeholder="e.g. Follow up email" />
            </div>
            <div className="flex items-center gap-4 mt-1">
              <label className="flex items-center gap-2 text-xs text-gray-600">
                <input
                  type="checkbox"
                  checked={toBool(details.Beta)}
                  onChange={(e) => setDetails({ ...details, Beta: e.target.checked ? 'true' : 'false' })}
                />
                Beta Program
              </label>
              <label className="flex items-center gap-2 text-xs text-gray-600">
                <input
                  type="checkbox"
                  checked={toBool(details.Trial)}
                  onChange={(e) => setDetails({ ...details, Trial: e.target.checked ? 'true' : 'false' })}
                />
                Trialing
              </label>
            </div>
            <div className="mt-3 text-[11px] text-gray-500 flex items-center gap-2">
              {saveState === 'saving' && (<>
                <Loader2 className="animate-spin" size={12} /> Saving…
              </>)}
              {saveState === 'saved' && (<>
                <CheckCircle2 size={12} className="text-green-600" /> Saved
              </>)}
              {saveState === 'idle' && (<span className="text-gray-400">Autosave enabled</span>)}
            </div>
          </div>
        </div>

        {/* COL 2: Interaction History */}
        <div className="flex-1 flex flex-col bg-white border-r">
          <div className="p-4 border-b flex justify-between items-center bg-gray-50/50">
            <h3 className="font-bold text-gray-700 flex items-center gap-2"><MessageSquare size={16} /> Interaction Log</h3>
            <button
              onClick={() => onAnalyze(details, companyData, history)}
              className="bg-purple-100 text-purple-700 px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-2 hover:bg-purple-200 transition-colors"
            >
              <Sparkles size={14} /> Analyze Dialogue
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50/30">
            {history.map((entry, idx) => (
              <div key={idx} className={`flex flex-col ${entry.type === 'user' || entry.type === 'note' ? 'items-end' : 'items-start'}`}>
                <span className="text-[10px] text-gray-400 mb-1 flex items-center gap-1">
                  {entry.type === 'user' ? 'Me' : entry.type === 'note' ? 'Note' : lead.Name.split(' ')[0]} • {new Date(entry.date).toLocaleString('da-DK')}
                </span>
                <div className={`max-w-[85%] p-3 rounded-xl text-sm whitespace-pre-wrap
                     ${entry.type === 'user' ? 'bg-blue-600 text-white rounded-br-none' :
                    entry.type === 'note' ? 'bg-yellow-100 text-gray-800 border border-yellow-200' :
                      'bg-white border text-gray-800 rounded-bl-none shadow-sm'}`}
                >
                  {entry.content}
                </div>
                <button onClick={() => handleDeleteEntry(idx)} className="mt-1 text-[10px] text-red-600 hover:text-red-700 flex items-center gap-1">
                  <Trash2 size={12} /> Delete
                </button>
              </div>
            ))}
          </div>

          <div className="p-4 border-t bg-white">
            <div className="flex justify-between items-center mb-2">
              <div className="flex gap-2">
                <button onClick={() => setMessageType('user')} className={`text-xs px-3 py-1 rounded-full border ${messageType === 'user' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-500'}`}>Me</button>
                <button onClick={() => setMessageType('lead')} className={`text-xs px-3 py-1 rounded-full border ${messageType === 'lead' ? 'bg-gray-700 text-white border-gray-700' : 'bg-white text-gray-500'}`}>Them</button>
                <button onClick={() => setMessageType('note')} className={`text-xs px-3 py-1 rounded-full border ${messageType === 'note' ? 'bg-yellow-400 text-yellow-900 border-yellow-400' : 'bg-white text-gray-500'}`}>Note</button>
              </div>
              {/* LOG BACKFILL PICKER */}
              <div className="w-40">
                <CustomDatePicker
                  selected={logDate}
                  onChange={(date) => setLogDate(date)}
                  showTimeSelect
                  placeholderText="Tidspunkt"
                />
              </div>
            </div>
            <div className="relative">
              <textarea
                value={newMessage} onChange={e => setNewMessage(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
                placeholder="Type your message..."
                className="w-full border rounded-xl p-3 pr-12 text-sm focus:ring-2 ring-blue-500 outline-none resize-none shadow-sm" rows={3}
              />
              <button onClick={handleSendMessage} className="absolute right-2 bottom-2 p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"><Edit3 size={14} /></button>
            </div>
          </div>
        </div>

        {/* COL 3: Company Intelligence */}
        <div className="w-1/4 bg-gray-50 p-6 overflow-y-auto">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-gray-800 flex items-center gap-2"><Building2 size={16} /> Company Intel</h3>
            <button onClick={handleResearch} className="text-xs bg-purple-600 text-white px-2 py-1 rounded hover:bg-purple-700 flex items-center gap-1">
              <Globe size={10} /> Auto-Fill
            </button>
          </div>

          <div className="bg-white p-4 rounded-lg shadow-sm border mb-4 space-y-3">
            <div><label className="text-[10px] font-bold text-gray-400 uppercase">Company Name</label><input value={companyData.Company || ''} onChange={e => setCompanyData({ ...companyData, Company: e.target.value })} className="w-full text-sm font-bold border-b border-transparent focus:border-blue-500 outline-none" /></div>
            <div><label className="text-[10px] font-bold text-gray-400 uppercase">Website</label><input value={companyData.Url || ''} onChange={e => setCompanyData({ ...companyData, Url: e.target.value })} placeholder="https://..." className="w-full text-xs text-blue-600 border-b border-transparent focus:border-blue-500 outline-none" />{companyData.Url && <a href={companyData.Url} target="_blank" className="text-[10px] text-gray-400 hover:text-blue-600 flex items-center gap-1 mt-1"><Globe size={8} /> Visit</a>}</div>
            <div><label className="text-[10px] font-bold text-gray-400 uppercase">Location</label><div className="flex gap-2"><input value={companyData.City || ''} onChange={e => setCompanyData({ ...companyData, City: e.target.value })} className="w-1/2 text-xs border-b border-transparent focus:border-blue-500 outline-none" placeholder="City" /><input value={companyData.Country || ''} onChange={e => setCompanyData({ ...companyData, Country: e.target.value })} className="w-1/2 text-xs border-b border-transparent focus:border-blue-500 outline-none" placeholder="Country" /></div></div>
            <div><label className="text-[10px] font-bold text-gray-400 uppercase">Industry</label><input value={companyData.Category || ''} onChange={e => setCompanyData({ ...companyData, Category: e.target.value })} className="w-full text-xs border-b border-transparent focus:border-blue-500 outline-none" /></div>
            <div><label className="text-[10px] font-bold text-gray-400 uppercase">Tech Stack</label><textarea value={companyData.Software || ''} onChange={e => setCompanyData({ ...companyData, Software: e.target.value })} className="w-full text-xs border rounded p-1.5 focus:border-blue-500 outline-none mt-1 h-16 bg-blue-50/50 text-blue-800" placeholder="e.g. KeyShot, Rhino..." /></div>
            <div><label className="text-[10px] font-bold text-gray-400 uppercase">Employees</label><input value={companyData.Employees || ''} onChange={e => setCompanyData({ ...companyData, Employees: e.target.value })} className="w-full text-xs border-b border-transparent focus:border-blue-500 outline-none" /></div>
            {companyData.Reasoning && <div className="bg-purple-50 p-2 rounded text-[9px] text-purple-800 border border-purple-100 mt-2"><div className="font-bold mb-1">AI Research Note:</div>{companyData.Reasoning}{companyData.SourceUrl && <a href={companyData.SourceUrl} target="_blank" className="block mt-1 text-blue-600 underline truncate hover:text-blue-800">Verify Source ↗</a>}</div>}
            <button onClick={() => { if (confirm('Delete this lead? This cannot be undone.')) onDelete(lead.id); }} className="w-full bg-red-600 text-white py-2 rounded mt-2 text-xs font-bold hover:bg-red-700 flex items-center justify-center gap-2">
              <Trash2 size={14} /> Delete Lead
            </button>
          </div>

          {otherLeads.length > 0 && (
            <div>
              <h4 className="font-bold text-gray-700 text-xs uppercase mb-2">Other Leads ({otherLeads.length})</h4>
              <div className="space-y-2">
                {otherLeads.map(l => (
                  <div key={l.id} className="bg-white p-2 rounded border text-xs cursor-pointer hover:border-blue-400 opacity-80 hover:opacity-100">
                    <div className="font-bold">{l.Name}</div>
                    <div className="text-gray-500">{l.Title}</div>
                    <div className="mt-1 flex justify-between">
                      <span className="text-[9px] bg-gray-100 px-1 rounded">{l.Stage}</span>
                    </div>
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

// --- COMPONENT 3: Board Card ---
const LeadCardUI = React.forwardRef(({ lead, company, onOpen, style, listeners, attributes, isOverlay, duplicatesSet }, ref) => {
  const isDormant = lead['Days since contact'] && parseInt(lead['Days since contact']) > 45;
  const isDueToday = isDue(lead['Next Date']);
  const isDuplicate = duplicatesSet?.has(lead.id);
  const isEnterprise = (typeof company?.Employees === 'number') && company.Employees >= 500;

  return (
    <div
      ref={ref} style={style} {...listeners} {...attributes}
      onClick={() => !isOverlay && onOpen(lead)}
      className={`bg-white p-3 mb-2 rounded-lg shadow-sm border-l-[3px] cursor-grab hover:shadow-md transition-all group relative
        ${isDueToday ? 'border-red-500 ring-2 ring-red-100' : isDormant ? 'border-gray-400' : 'border-blue-500'} 
        ${isOverlay ? 'shadow-2xl scale-105 cursor-grabbing rotate-2 z-50' : ''}
      `}
    >
      <div className="flex justify-between items-start mb-1">
        <h4 className="font-bold text-gray-800 text-sm truncate pr-2 leading-tight">{lead.Name}</h4>
        <div className="flex items-center gap-1">
          {isDuplicate && <span className="text-[10px] text-red-700 bg-red-100 px-1.5 py-0.5 rounded">Dup</span>}
          {lead.LinkedIn && <Linkedin size={12} className="text-blue-600 flex-shrink-0" />}
        </div>
      </div>
      <p className="text-[11px] text-gray-500 truncate mb-2">{lead.Title}</p>
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-1.5 text-[10px]">
          {/* Company Badge */}
          <span className={`font-medium px-1.5 py-0.5 rounded truncate max-w-[100px] ${isEnterprise ? 'bg-indigo-100 text-indigo-700 border border-indigo-200' : 'bg-gray-100 text-gray-600'}`}>
            {isEnterprise && <Building2 size={8} className="inline mr-1" />}
            {lead.Company}
          </span>
          {company?.Software && (
            <span className="text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded truncate max-w-[60px]">
              {company.Software.split(',')[0]}
            </span>
          )}
          {toBool(lead.Beta) && (
            <span className="text-purple-700 bg-purple-100 px-1.5 py-0.5 rounded">Beta</span>
          )}
          {toBool(lead.Trial) && (
            <span className="text-green-700 bg-green-100 px-1.5 py-0.5 rounded">Trial</span>
          )}
        </div>
        {lead['Next Date'] && (
          <div className={`flex items-center gap-1 text-[10px] font-medium w-fit px-1.5 py-0.5 rounded ${isDueToday ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500'}`}>
            <Calendar size={10} /> {lead['Next Date']}
          </div>
        )}
      </div>
    </div>
  );
});

const DraggableLeadCard = ({ lead, company, onOpen, duplicatesSet }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: lead.id, data: { ...lead, company }
  });
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, opacity: isDragging ? 0 : 1 } : undefined;
  return <LeadCardUI ref={setNodeRef} style={style} listeners={listeners} attributes={attributes} lead={lead} company={company} onOpen={onOpen} duplicatesSet={duplicatesSet} />;
};

const Column = ({ id, title, leads, companies, onOpen, duplicatesSet }) => {
  const { setNodeRef } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className="flex-shrink-0 w-72 bg-gray-50/80 h-full rounded-xl p-2 mr-4 flex flex-col border border-gray-200 backdrop-blur-sm">
      <h3 className="font-bold text-gray-700 mb-3 px-2 flex justify-between items-center text-xs uppercase tracking-wider">
        {title} <span className="bg-white border text-[10px] px-2 py-0.5 rounded-full text-gray-500">{leads.length}</span>
      </h3>
      <div className="overflow-y-auto flex-1 px-1 custom-scrollbar pb-10 space-y-2">
        {leads.map(lead => (
          <DraggableLeadCard key={lead.id} lead={lead} company={companies[lead.Company]} onOpen={onOpen} duplicatesSet={duplicatesSet} />
        ))}
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
  const [showSettings, setShowSettings] = useState(!keys.github);
  const [loading, setLoading] = useState(false);

  // UI State
  const [activeId, setActiveId] = useState(null);
  const [detailLead, setDetailLead] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [hideDisqualified, setHideDisqualified] = useState(true);
  const [hideWon, setHideWon] = useState(true);
  const [showDueOnly, setShowDueOnly] = useState(false);
  const [showDupOnly, setShowDupOnly] = useState(false);
  const [showBetaOnly, setShowBetaOnly] = useState(false);
  const [showTrialOnly, setShowTrialOnly] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState(false);

  const { askGemini, researchCompany, researchLead, advice, loading: geminiLoading, setAdvice } = useGemini(keys.gemini);
  const sensors = useSensors(useSensor(MouseSensor, { activationConstraint: { distance: 10 } }), useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }));

  // Load Data
  useEffect(() => {
    if (!keys.github) return;
    setTimeout(() => setLoading(true), 0);
    Promise.all([
      fetchCSV(keys.github, REPO_OWNER, REPO_NAME, LEADS_PATH),
      fetchCSV(keys.github, REPO_OWNER, REPO_NAME, COMPANIES_PATH)
    ]).then(([leadsRes, companiesRes]) => {
      const compMap = {};
      companiesRes.data.forEach(c => {
        const emp = c.Employees;
        if (emp !== undefined && emp !== null && emp !== '' && typeof emp !== 'number') {
          throw new Error(`Invalid Employees value for company "${c.Company}". Expected integer, got ${typeof emp}.`);
        }
        compMap[c.Company] = { ...c };
      });

      const validLeads = leadsRes.data
        .filter(l => l.Name && l.Stage)
        .map((l) => ({
          ...l,
          id: l.id || generateId(l.Name),
          Beta: toBool(l.Beta) ? 'true' : 'false',
          Trial: toBool(l.Trial) ? 'true' : 'false',
        }));

      // Ensure unique stable IDs; fix any accidental duplicates
      const idsSeen = new Set();
      const uniqueLeads = validLeads.map((l) => {
        let id = l.id;
        while (idsSeen.has(id)) {
          id = generateId(l.Name);
        }
        idsSeen.add(id);
        return { ...l, id };
      });

      setCompanies(compMap);
      setLeads(uniqueLeads);
      setSha({ leads: leadsRes.sha, companies: companiesRes.sha });
    }).catch((err) => {
      console.error(err);
      alert("Error loading data. Check console.");
    }).finally(() => setLoading(false));
  }, [keys.github]);

  const saveLeadsToGithub = (newLeads) => {
    setLeads(newLeads);
    return saveCSV(keys.github, REPO_OWNER, REPO_NAME, LEADS_PATH, newLeads, sha.leads)
      .then(res => setSha(prev => ({ ...prev, leads: res.content.sha })))
      .catch(() => alert("Save failed"));
  };

  const saveCompaniesToGithub = (newCompaniesObj) => {
    // Enforce integer-only Employees; do not coerce from strings
    for (const [name, c] of Object.entries(newCompaniesObj)) {
      const v = c.Employees;
      if (v !== undefined && v !== null && v !== '' && typeof v !== 'number') {
        alert(`Company "${name}": Employees must be an integer. Please enter a number.`);
        return Promise.reject(new Error('Employees must be an integer'));
      }
      if (typeof v === 'number' && !Number.isInteger(v)) {
        alert(`Company "${name}": Employees must be an integer (no decimals).`);
        return Promise.reject(new Error('Employees must be an integer'));
      }
    }

    // Keep in-memory map as-is
    setCompanies(newCompaniesObj);
    const compArray = Object.values(newCompaniesObj).map(c => ({ ...c }));
    return saveCSV(keys.github, REPO_OWNER, REPO_NAME, COMPANIES_PATH, compArray, sha.companies)
      .then(res => setSha(prev => ({ ...prev, companies: res.content.sha })))
      .catch(() => alert("Company save failed"));
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    setActiveId(null);
    if (!over || active.id === over.id) return;

    const newStage = over.id;
    // RESTORED WON LOGIC
    const newLeads = leads.map(l => {
      if (l.id === active.id) {
        return {
          ...l,
          Stage: newStage,
          'Is Customer': newStage === '6. Won' ? 'TRUE' : l['Is Customer']
        };
      }
      return l;
    });

    saveLeadsToGithub(newLeads);
  };

  const handleAdd = (type, data) => {
    if (type === 'lead') {
      const newLead = { ...data, Stage: '1. New', 'Days since contact': 0, id: generateId(data.Name), Beta: data.Beta ?? 'false', Trial: data.Trial ?? 'false' };
      saveLeadsToGithub([newLead, ...leads]);
    } else {
      saveCompaniesToGithub({ ...companies, [data.Company]: data });
    }
    setShowAddModal(false);
  };

  const handleDeleteLeadById = (id) => {
    const newLeads = leads.filter(l => l.id !== id);
    return saveLeadsToGithub(newLeads).then(() => setDetailLead(null));
  };

  const handleUpdateLead = (updatedLead, updatedCompany) => {
    const currentLead = leads.find(l => l.id === updatedLead.id);
    const leadChanged = JSON.stringify(currentLead) !== JSON.stringify(updatedLead);
    const promises = [];
    if (leadChanged) {
      const newLeads = leads.map(l => l.id === updatedLead.id ? updatedLead : l);
      promises.push(saveLeadsToGithub(newLeads));
    }

    if (updatedCompany && JSON.stringify(companies[updatedCompany.Company]) !== JSON.stringify(updatedCompany)) {
      promises.push(saveCompaniesToGithub({ ...companies, [updatedCompany.Company]: updatedCompany }));
    }
    // Keep the modal in sync with latest local state
    setDetailLead(updatedLead);
    return Promise.all(promises);
  };

  // Duplicate detection: union of groups by Email, LinkedIn, Name+Company, and Name-only
  const duplicatesSet = useMemo(() => {
    const groupsEmail = new Map();
    const groupsLinkedIn = new Map();
    const groupsNameCompany = new Map();
    const groupsNameOnly = new Map();
    const norm = (s) => (s || '').trim().toLowerCase();
    for (const l of leads) {
      const id = l.id;
      const email = norm(l.Email);
      const li = norm(l.LinkedIn);
      const name = norm(l.Name);
      const company = norm(l.Company);
      if (email) {
        const arr = groupsEmail.get(email);
        if (arr) arr.push(id); else groupsEmail.set(email, [id]);
      }
      if (li) {
        const arr = groupsLinkedIn.get(li);
        if (arr) arr.push(id); else groupsLinkedIn.set(li, [id]);
      }
      const ncKey = `${name}|${company}`;
      {
        const arr = groupsNameCompany.get(ncKey);
        if (arr) arr.push(id); else groupsNameCompany.set(ncKey, [id]);
      }
      {
        const arr = groupsNameOnly.get(name);
        if (arr) arr.push(id); else groupsNameOnly.set(name, [id]);
      }
    }
    const dup = new Set();
    const addDupFrom = (map) => {
      for (const arr of map.values()) {
        if (arr.length > 1) arr.forEach((id) => dup.add(id));
      }
    };
    addDupFrom(groupsEmail);
    addDupFrom(groupsLinkedIn);
    addDupFrom(groupsNameCompany);
    addDupFrom(groupsNameOnly);
    return dup;
  }, [leads]);

  const processedLeads = useMemo(() => {
    let list = leads.filter(l => {
      if (showDueOnly && !isDue(l['Next Date'])) return false;
      if (hideDisqualified && l.Stage.includes('Disqualified')) return false;
      if (hideWon && l.Stage.includes('Won')) return false; // RESTORED
      if (showDupOnly && !duplicatesSet.has(l.id)) return false;
      if (showBetaOnly && !toBool(l.Beta)) return false;
      if (showTrialOnly && !toBool(l.Trial)) return false;
      // --- FOCUS MODE LOGIC ---
      if (focusMode) {
        const hasTask = !!l['Next Date'];
        const daysSince = parseInt(l['Days since contact'] ?? 999);
        const isRecent = daysSince < 30;
        const isHighValue = l.Stage.includes('Connected') || l.Stage.includes('Qualified');
        if (!hasTask && !isRecent && !isHighValue) return false;
      }
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return l.Name.toLowerCase().includes(q) || l.Company.toLowerCase().includes(q);
    });
    return list.sort((a, b) => {
      const dueA = isDue(a['Next Date']) ? 1 : 0;
      const dueB = isDue(b['Next Date']) ? 1 : 0;
      if (dueA !== dueB) return dueB - dueA;
      return (parseInt(b['Days since contact'] || 0) - parseInt(a['Days since contact'] || 0));
    });
  }, [leads, searchQuery, hideDisqualified, hideWon, showDueOnly, showDupOnly, showBetaOnly, showTrialOnly, duplicatesSet, focusMode]);

  const activeLead = activeId ? leads.find(l => l.id === activeId) : null;

  return (
    <div className="h-screen flex flex-col bg-gray-100 font-sans text-gray-900 overflow-hidden">
      <header className="bg-white border-b px-6 py-3 flex justify-between items-center z-10 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center text-white font-bold shadow-blue-200 shadow-lg">F</div>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="Search..."
              className="w-full pl-9 pr-8 py-2 bg-gray-100 rounded-lg text-sm focus:bg-white focus:ring-2 ring-blue-500 outline-none transition-all"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                type="button"
                aria-label="Clear search"
                title="Clear"
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-gray-200 text-gray-500"
              >
                <X size={14} />
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={() => setHideDisqualified(!hideDisqualified)} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition-all ${hideDisqualified ? 'bg-gray-200 text-gray-700' : 'bg-white text-gray-500 border'}`}>
              <Ban size={14} /> {hideDisqualified ? 'No Disqualified' : 'Show Disqualified'}
            </button>
            <button onClick={() => setHideWon(!hideWon)} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition-all ${hideWon ? 'bg-green-100 text-green-700' : 'bg-white text-gray-500 border'}`}>
              <Trophy size={14} /> {hideWon ? 'Hidden Won' : 'Show Won'}
            </button>
            <button onClick={() => setShowDueOnly(!showDueOnly)} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition-all ${showDueOnly ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-white text-gray-500 border'}`}>
              <Clock size={14} /> {showDueOnly ? 'Due Today' : 'Tasks'}
            </button>
            <button onClick={() => setShowDupOnly(!showDupOnly)} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition-all ${showDupOnly ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-white text-gray-500 border'}`}>
              <AlertCircle size={14} /> {showDupOnly ? 'Duplicates Only' : 'Highlight Duplicates'}
            </button>
            <button onClick={() => setShowBetaOnly(!showBetaOnly)} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition-all ${showBetaOnly ? 'bg-purple-100 text-purple-700 border border-purple-200' : 'bg-white text-gray-500 border'}`}>
              <Sparkles size={14} /> {showBetaOnly ? 'Beta Only' : 'Beta'}
            </button>
            <button onClick={() => setShowTrialOnly(!showTrialOnly)} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition-all ${showTrialOnly ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-white text-gray-500 border'}`}>
              <CheckCircle2 size={14} /> {showTrialOnly ? 'Trial Only' : 'Trial'}
            </button>
            <button onClick={() => setFocusMode(!focusMode)} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition-all ${focusMode ? 'bg-blue-100 text-blue-700 border border-blue-200' : 'bg-white text-gray-500 border'}`}>
              <Filter size={14} /> {focusMode ? 'Focus Mode' : 'All Leads'}
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowAddModal(true)} className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-gray-800 transition-colors shadow-lg shadow-gray-200">
            <Plus size={16} /> New Entry
          </button>
          <button onClick={() => setShowSettings(true)} className="p-2 hover:bg-gray-100 rounded-full text-gray-500"><Settings size={20} /></button>
        </div>
      </header>
      <main className="flex-1 overflow-x-auto overflow-y-hidden p-6 bg-gray-100">
        {loading ? <div className="flex justify-center items-center h-full text-gray-400 gap-2"><Loader2 className="animate-spin" /> Loading Pipeline...</div> : (
          <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd} onDragStart={e => setActiveId(e.active.id)}>
            <div className="flex h-full w-max">
              {ORDERED_STAGES.filter(s => {
                if (hideDisqualified && s.includes('Disqualified')) return false;
                if (hideWon && s.includes('Won')) return false;
                return true;
              }).map(stage => (
                <Column key={stage} id={stage} title={stage} leads={processedLeads.filter(l => l.Stage === stage)} companies={companies} onOpen={setDetailLead} duplicatesSet={duplicatesSet} />
              ))}
            </div>
            <DragOverlay>
              {activeLead && <LeadCardUI lead={activeLead} company={companies[activeLead.Company]} isOverlay={true} />}
            </DragOverlay>
          </DndContext>
        )}
      </main>

      {/* FIXED: Passing props to AddModal */}
      {showAddModal && <AddModal companies={companies} onClose={() => setShowAddModal(false)} onSave={handleAdd} onResearchLead={researchLead} onResearchCompany={researchCompany} />}

      {detailLead && <DetailModal lead={detailLead} companies={companies} leads={leads} onClose={() => setDetailLead(null)} onSave={handleUpdateLead} onAnalyze={(l, c, h) => askGemini(l, c, h)} onResearch={researchCompany} onDelete={handleDeleteLeadById} />}
      {showSettings && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[80]">
          <div className="bg-white p-6 rounded-lg w-96 shadow-xl">
            <h2 className="font-bold mb-4">Settings</h2>
            <input type="password" placeholder="GitHub Token" className="w-full border p-2 mb-2 rounded" value={keys.github} onChange={e => setKeys({ ...keys, github: e.target.value })} />
            <input type="password" placeholder="Gemini Key" className="w-full border p-2 mb-4 rounded" value={keys.gemini} onChange={e => setKeys({ ...keys, gemini: e.target.value })} />
            <button onClick={() => { localStorage.setItem('gh_token', keys.github); localStorage.setItem('gemini_key', keys.gemini); window.location.reload(); }} className="w-full bg-blue-600 text-white p-2 rounded">Save & Reload</button>
          </div>
        </div>
      )}
      {advice && (
        <div className="fixed right-0 top-0 h-full w-[450px] bg-white shadow-2xl border-l z-[90] p-6 overflow-y-auto animate-in slide-in-from-right">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-bold flex items-center gap-2 text-gray-800"><Sparkles className="text-purple-600" /> AI Analysis</h3>
            <button onClick={() => setAdvice(null)}><X size={20} /></button>
          </div>
          <div className="space-y-6">
            <div className="bg-purple-50 p-5 rounded-xl border border-purple-100">
              <h4 className="font-bold text-purple-900 text-xs uppercase tracking-wider mb-2">Strategy</h4>
              <p className="text-sm text-gray-800 leading-relaxed">{advice.strategy}</p>
            </div>
            <div>
              <div className="flex justify-between mb-2">
                <h4 className="font-bold text-gray-500 text-xs uppercase">Recommended Response</h4>
                <button
                  onClick={async () => {
                    try {
                      if (navigator?.clipboard?.writeText) {
                        await navigator.clipboard.writeText(advice.email_draft || "");
                      } else {
                        const ta = document.createElement('textarea');
                        ta.value = advice.email_draft || "";
                        ta.style.position = 'fixed';
                        ta.style.left = '-9999px';
                        document.body.appendChild(ta);
                        ta.select();
                        document.execCommand('copy');
                        document.body.removeChild(ta);
                      }
                      setCopiedEmail(true);
                      setTimeout(() => setCopiedEmail(false), 1500);
                    } catch (e) {
                      void e;
                    }
                  }}
                  className="text-blue-600 text-xs font-bold flex gap-1"
                >
                  {copiedEmail ? (<><CheckCircle2 size={12} /> Copied</>) : (<><Mail size={12} /> Copy</>)}
                </button>
              </div>
              <textarea className="w-full h-64 p-3 bg-gray-50 border rounded-lg text-sm font-mono" defaultValue={advice.email_draft} />
            </div>
          </div>
        </div>
      )}
      {geminiLoading && <div className="fixed bottom-8 right-8 bg-gray-900 text-white px-5 py-3 rounded-full flex items-center gap-3 shadow-xl z-[100] animate-bounce"><Loader2 className="animate-spin" size={18} /> Analyzing...</div>}
    </div>
  );
}