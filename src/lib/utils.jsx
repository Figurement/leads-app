/* src/lib/utils.js — Pure helpers, constants, and stage config.
 * React UI components (StatusBadge, EnterpriseMark, OwnerAvatar) live in
 * src/components/SharedUI.jsx — do NOT duplicate them here.
 */
import React from 'react';
import {
  Clock, Ban, Search, Mail, MessageSquare, Trophy, FileText, Sparkles
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
  'New': 'size', 'Attempting': 'revival', 'Connected': 'momentum',
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

export const parseEmailList = (value) => {
  if (!value) return [];
  return String(value)
    .split(',')
    .map(email => email.trim())
    .filter(Boolean);
};

export const getLeadEmailOptions = (lead) => {
  const options = [];
  const seen = new Set();

  const addEmails = (emails, typeLabel) => {
    emails.forEach((email, index) => {
      const key = email.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      options.push({
        value: email,
        label: emails.length > 1 ? `${typeLabel} ${index + 1}` : typeLabel
      });
    });
  };

  addEmails(parseEmailList(lead?.Email), 'Work');
  addEmails(parseEmailList(lead?.PersonalEmail), 'Personal');

  return options;
};

export const getAllLeadEmails = (lead) => getLeadEmailOptions(lead).map(option => option.value);

export const getPrimaryLeadEmail = (lead) => getAllLeadEmails(lead)[0] || '';

export const normalizeLinkedInUrl = (url) => {
  const raw = String(url || '').trim();
  if (!raw) return '';

  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  let parsed;
  try {
    parsed = new URL(withProtocol);
  } catch {
    return '';
  }

  const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
  if (host !== 'linkedin.com') return '';

  const path = parsed.pathname.replace(/\/+$/, '');
  const validProfilePath = /^\/(in|pub)\/[a-z0-9-_%]+$/i.test(path);
  if (!validProfilePath) return '';

  return `https://www.linkedin.com${path}`;
};

export const getCompanySizeBand = (employees) => {
  const count = Number(employees);
  if (!Number.isFinite(count) || count <= 0) return { key: 'unknown', label: 'Size ?' };
  if (count < 11) return { key: 'micro', label: 'Micro' };
  if (count < 51) return { key: 'small', label: 'Small' };
  if (count < 251) return { key: 'mid', label: 'Mid' };
  if (count < 1001) return { key: 'large', label: 'Large' };
  return { key: 'enterprise', label: 'Enterprise' };
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

// StatusBadge, EnterpriseMark, OwnerAvatar → import from src/components/SharedUI.jsx
// Re-exported here for backward compatibility with existing imports.
export { StatusBadge, EnterpriseMark, OwnerAvatar } from '../components/SharedUI';
