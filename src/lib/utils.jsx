/* src/lib/utils.js */
import React from 'react';
import {
  Clock, Ban, Search, Mail, MessageSquare, Trophy, FileText, Sparkles,
  BadgeCheck
} from 'lucide-react';

// --- CONSTANTS ---
export const REPO_OWNER = "figurement";
export const REPO_NAME = "leads-data";
export const LEADS_PATH = "leads.csv";
export const COMPANIES_PATH = "companies.csv";

export const ORDERED_STAGES = [
  'New', 'Attempting', 'Connected', 'Nurture', 'Qualified', 'Offer', 'Disqualified', 'Won'
];

export const SORT_STRATEGIES = {
  momentum: { label: 'Newest', icon: '🔥', desc: 'Most recent activity first' },
  revival: { label: 'Oldest', icon: '💤', desc: 'Longest time since contact' },
  size: { label: 'Largest', icon: '💎', desc: 'Most employees first' },
  alpha: { label: 'A-Z', icon: 'Aa', desc: 'Name alphabetical' }
};

export const DEFAULT_SORTS = {
  'New': 'momentum', 'Attempting': 'revival', 'Connected': 'momentum',
  'Qualified': 'size', 'Offer': 'size', 'Nurture': 'revival',
  'Disqualified': 'revival', 'Won': 'size'
};

export const DEFAULT_COLLAPSE = {
  'New': false, 'Attempting': false, 'Connected': false,
  'Nurture': true, 'Qualified': false, 'Offer': false,
  'Disqualified': false, 'Won': false
};

export const STAGE_DEFINITIONS = {
  'New': { icon: <Search size={14} />, desc: 'Uncontacted. Research valid.', exit: 'First message sent' },
  'Attempting': { icon: <Mail size={14} />, desc: 'Outreach active. No reply yet.', exit: 'Response received' },
  'Connected': { icon: <MessageSquare size={14} />, desc: 'Two-way dialogue. Discovery.', exit: 'Pain verified + Meeting set' },
  'Nurture': { icon: <Clock size={14} />, desc: 'Not ready now. Timing mismatch.', exit: 'Re-engagement date arrived' },
  'Qualified': { icon: <Trophy size={14} />, desc: 'Pain verified. Deal in progress.', exit: 'Proposal/Pricing sent' },
  'Offer': { icon: <FileText size={14} />, desc: 'Pricing/Terms delivered.', exit: 'Contract signed' },
  'Won': { icon: <Sparkles size={14} />, desc: 'Contract signed. Onboarding.', exit: 'N/A' },
  'Disqualified': { icon: <Ban size={14} />, desc: 'Bad fit or hard "No".', exit: 'N/A' }
};

// --- HELPERS ---
export const generateId = (name) => `lead-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
export const safeJSONParse = (str) => { try { return JSON.parse(str); } catch { return []; } };
export const normalizeStage = (s) => (s || '').trim().replace(/^\d+\.?\s*/, '');

export const parseDateStr = (str) => {
  if (!str) return null;
  const [d, m, y] = str.split('/');
  const date = new Date(y, m - 1, d);
  return isNaN(date) ? null : date;
};

export const formatDateStr = (date) => {
  if (!date) return "";
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
};

export const toBool = (v) => {
  const s = String(v || '').trim().toLowerCase();
  return s === 'true' || s === '1' || s === 'yes' || s === 'y';
};

export const isDue = (dateStr) => {
  if (!dateStr) return false;
  const d = parseDateStr(dateStr);
  return d && d <= new Date().setHours(0, 0, 0, 0);
};

export const getDaysSinceInteraction = (historyStr) => {
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

// --- SHARED UI ---

export const StatusBadge = ({ type, label }) => {
  const base = "leading-none ml-auto flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap shrink-0";
  let cls = "";
  let icon = null;
  switch (type) {
    case 'due': cls = "text-rose-600 bg-rose-50 border-rose-100"; icon = <Clock size={10} />; break;
    case 'stalled': cls = "text-slate-600 bg-slate-100 border-slate-200"; break;
    case 'active': cls = "text-emerald-600 bg-emerald-50 border-emerald-100"; break;
    default: cls = "text-slate-600 bg-slate-100 border-slate-200";
  }
  return <div className={`${base} ${cls}`}>{icon}{label}</div>;
};

export const EnterpriseMark = () => (
  <BadgeCheck size={10} className="text-indigo-500 shrink-0" fill="#e0e7ff" aria-label="Enterprise Verified" />
);

export const OwnerAvatar = ({ name, size = "w-5 h-5", textSize = "text-[9px]" }) => {
  const safeName = name || 'Unassigned';
  const initial = safeName === 'Unassigned' ? '?' : safeName.charAt(0).toUpperCase();
  const style = safeName === 'Unassigned' ? 'bg-slate-50 text-slate-300 border-dashed border-slate-300' : 'bg-indigo-50 text-indigo-600 border-indigo-200';
  return (
    <div className={`${size} ${textSize} rounded-full border flex items-center justify-center font-bold shadow-sm shrink-0 ${style}`}>
      {initial}
    </div>
  );
};