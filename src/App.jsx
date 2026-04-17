/* src/App.jsx */
import React, { useState, useEffect, useMemo, useRef } from 'react';

import {
  Settings, Sparkles, X, Loader2, Search, Mail, Calendar,
  Plus, Clock,
  CheckCircle2, AlertCircle, Trophy, Filter,
  Users,
  LayoutGrid,
  List,
  Link,
  Table2
} from 'lucide-react';

import { fetchCSV, saveCSV } from './lib/github';
import { useGemini } from './hooks/useGemini';
import { DailySummaryModal } from './components/DailySummaryModal';
import { PipelineBoard } from './components/PipelineBoard';
import { CompanyManager } from './components/CompanyManager';
import { LeadsTableView } from './components/LeadsTableView';

// --- IMPORTS ---
import { REPO_OWNER, REPO_NAME, LEADS_PATH, COMPANIES_PATH, generateId, normalizeStage, toBool, getDaysSinceInteraction, DEFAULT_SORTS, DEFAULT_COLLAPSE, getAllLeadEmails, normalizeLinkedInUrl } from './lib/utils';
import { ModalWrapper } from './components/SharedUI';
import { AddModal } from './components/AddModal';
import { CompanyStatusAlert } from './components/CompanyStatusAlert';
import { DetailModal } from './components/DetailModal';
import { MailMergeModal, MailMergeSelectionBar } from './components/MailMergeModal';

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

// --- MAIN APP ---
export default function App() {
  // Data State
  const [leads, setLeads] = useState([]);
  const [companies, setCompanies] = useState({});
  const [sha, setSha] = useState({ leads: null, companies: null });
  const [loading, setLoading] = useState(false);
  const [keys, setKeys] = useState({ github: localStorage.getItem('gh_token') || '', gemini: localStorage.getItem('gemini_key') || '' });

  // Global UI State
  const [viewMode, setViewMode] = useState('pipeline'); // 'pipeline' | 'companies' | 'table'
  const [searchQuery, setSearchQuery] = useState("");
  const [ownerFilter, setOwnerFilter] = useState(() => localStorage.getItem('ownerFilter') || '');
  const [filters, setFilters] = useState({ due: false, dup: false, beta: false, trial: false, focus: false });
  const [activeId, setActiveId] = useState(null);
  const [toast, setToast] = useState(null);
  const [ownerConfirmed, setOwnerConfirmed] = useState(!!ownerFilter); // For first time setup
  const [copiedEmail, setCopiedEmail] = useState(false);

  // Board State (Lifted state to persist when switching tabs)
  const [focusedStage, setFocusedStage] = useState(null);
  const [columnSorts, setColumnSorts] = useState(DEFAULT_SORTS);
  const [columnCollapse, setColumnCollapse] = useState(DEFAULT_COLLAPSE);
  const [columnScroll, setColumnScroll] = useState({});
  const [minimizedStages, setMinimizedStages] = useState(() => {
    try { return JSON.parse(localStorage.getItem('minimizedStages')) || {}; } catch { return {}; }
  });

  // Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [detailLead, setDetailLead] = useState(null);
  const [showSettings, setShowSettings] = useState(!keys.github || !keys.gemini || ownerFilter === undefined);
  const [showSummary, setShowSummary] = useState(false);
  const [deadEndData, setDeadEndData] = useState(null);

  // Mail Merge State
  const [mailMergeMode, setMailMergeMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [showMailMergeModal, setShowMailMergeModal] = useState(false);
  const [enrichingNewLeads, setEnrichingNewLeads] = useState(false);

  const { askGemini, researchCompany, researchLead, advice, setAdvice, loading: geminiLoading } = useGemini(keys.gemini);
  const toastTimerRef = useRef(null);

  // --- DERIVED DATA ---
  const uniqueOwners = useMemo(() => [...new Set(leads.map(l => l.Owner).filter(Boolean))].sort(), [leads]);
  const duplicatesSet = useMemo(() => {
    const map = new Map(), dup = new Set();
    leads.forEach(l => {
      [...getAllLeadEmails(l), l.LinkedIn, l.Name].forEach(k => {
        if (!k) return;
        const key = k.trim().toLowerCase();
        if (map.has(key)) { dup.add(l.id); dup.add(map.get(key)); } else map.set(key, l.id);
      });
    });
    return dup;
  }, [leads]);
  const activeLead = activeId ? leads.find(l => l.id === activeId) : null;

  // --- ACTIONS ---
  const notifyToast = (type, text) => { setToast({ type, text }); if (toastTimerRef.current) clearTimeout(toastTimerRef.current); toastTimerRef.current = setTimeout(() => setToast(null), 2500); };
  const toggleFilter = (k) => setFilters(p => ({ ...p, [k]: !p[k] }));

  useEffect(() => { try { localStorage.setItem('minimizedStages', JSON.stringify(minimizedStages)); } catch { } }, [minimizedStages]);

  useEffect(() => {
    if (!keys.github) return;
    setLoading(true);
    Promise.all([fetchCSV(keys.github, REPO_OWNER, REPO_NAME, LEADS_PATH), fetchCSV(keys.github, REPO_OWNER, REPO_NAME, COMPANIES_PATH)]).then(([lRes, cRes]) => {
      const compMap = {}; cRes.data.forEach(c => { if (c.Employees !== undefined && typeof c.Employees !== 'number') return; compMap[c.Company] = { ...c }; });
      const validLeads = lRes.data.filter(l => l.Name && l.Stage).map(l => {
        const normStage = normalizeStage(l.Stage);
        const rawDays = getDaysSinceInteraction(l.History);
        let finalDays = 999;
        if (rawDays !== null) finalDays = rawDays; else if (normStage === 'New') finalDays = 0;
        return { ...l, Stage: normStage, id: l.id || generateId(l.Name), Beta: toBool(l.Beta) ? 'true' : 'false', Trial: toBool(l.Trial) ? 'true' : 'false', calculatedDays: finalDays };
      });
      const idsSeen = new Set(); const uniqueLeads = validLeads.map(l => { let id = l.id; while (idsSeen.has(id)) id = generateId(l.Name); idsSeen.add(id); return { ...l, id }; });
      setCompanies(compMap); setLeads(uniqueLeads); setSha({ leads: lRes.sha, companies: cRes.sha });
    }).catch(e => { console.error(e); alert("Error loading data"); }).finally(() => setLoading(false));
  }, [keys.github]);

  const saveLeadsToGithub = (newLeads) => { setLeads(newLeads); return saveCSV(keys.github, REPO_OWNER, REPO_NAME, LEADS_PATH, newLeads, sha.leads).then(r => setSha(p => ({ ...p, leads: r.content.sha }))).catch(() => alert("Save failed")); };
  const saveCompaniesToGithub = (newComp) => { setCompanies(newComp); return saveCSV(keys.github, REPO_OWNER, REPO_NAME, COMPANIES_PATH, Object.values(newComp), sha.companies).then(r => setSha(p => ({ ...p, companies: r.content.sha }))); };

  // --- HELPER: CHECK DEAD END ---
  const checkForDeadEnd = (currentLeads, companyName) => {
    const companyLeads = currentLeads.filter(l => l.Company === companyName);
    const activeLeads = companyLeads.filter(l => {
      const s = normalizeStage(l.Stage);
      return s !== 'New' && s !== 'Disqualified' && s !== 'Won';
    });
    const wonLeads = companyLeads.filter(l => normalizeStage(l.Stage) === 'Won');
    const newLeads = companyLeads.filter(l => normalizeStage(l.Stage) === 'New');

    if (activeLeads.length === 0 && wonLeads.length === 0) {
      setDeadEndData({ name: companyName, newCount: newLeads.length });
    }
  };

  // --- HANDLERS ---
  const handleDragEnd = ({ active, over }) => {
    setActiveId(null); if (!over || active.id === over.id) return;
    const newStage = over.id;
    const currentLead = leads.find(l => l.id === active.id);
    const updatedLeads = leads.map(l => l.id === active.id ? { ...l, Stage: newStage, 'Is Customer': newStage === 'Won' ? 'TRUE' : l['Is Customer'] } : l);

    saveLeadsToGithub(updatedLeads);

    // Check Dead End
    const wasAlive = normalizeStage(currentLead?.Stage) !== 'Disqualified';
    if (wasAlive && newStage === 'Disqualified') {
      checkForDeadEnd(updatedLeads, currentLead.Company);
    }
  };

  const handleAdd = (type, data) => {
    if (type === 'lead') {
      const now = new Date();
      const hasInitialNote = (data.Notes || '').trim().length > 0;
      const history = hasInitialNote ? [{ date: now.toISOString(), type: 'note', content: data.Notes }] : [];
      const newLead = { ...data, Email: data.Email || '', PersonalEmail: data.PersonalEmail || '', History: history.length ? JSON.stringify(history) : '', Notes: hasInitialNote ? '' : (data.Notes || ''), Stage: 'New', calculatedDays: 0, id: generateId(data.Name), Beta: 'false', Trial: 'false', Owner: data.Owner || '' };
      saveLeadsToGithub([newLead, ...leads]); setDetailLead(newLead);
    } else if (type === 'bulkLeads') {
      const mode = data?.mode === 'insert' ? 'insert' : 'upsert';
      const rows = Array.isArray(data?.rows) ? data.rows : [];
      const defaultStage = normalizeStage(data?.defaultStage || 'New') || 'New';
      const defaultOwner = (data?.defaultOwner || '').trim();
      const nowIso = new Date().toISOString();

      const byId = new Map(leads.map(l => [String(l.id || '').trim(), l]).filter(([k]) => k));
      const byEmail = new Map();
      leads.forEach(lead => {
        getAllLeadEmails(lead).forEach(email => {
          const key = String(email || '').trim().toLowerCase();
          if (key && !byEmail.has(key)) byEmail.set(key, lead);
        });
      });
      const byLinkedIn = new Map(leads.map(l => [String(l.LinkedIn || '').trim().toLowerCase(), l]).filter(([k]) => k));
      const byNameCompany = new Map(leads.map(l => [`${String(l.Name || '').trim().toLowerCase()}|${String(l.Company || '').trim().toLowerCase()}`, l]).filter(([k]) => k !== '|'));

      const parseHistory = (value) => {
        if (!value) return [];
        if (Array.isArray(value)) return value;
        if (typeof value === 'string') {
          try {
            const parsed = JSON.parse(value);
            return Array.isArray(parsed) ? parsed : [];
          } catch {
            return [];
          }
        }
        return [];
      };

      const withNotesInHistory = (existingHistory, notesText) => {
        if (!notesText) return existingHistory;
        return [...existingHistory, { date: nowIso, type: 'note', content: notesText }];
      };

      const cleanRow = (row) => {
        const out = {};
        Object.keys(row || {}).forEach(k => {
          const value = row[k];
          out[k] = typeof value === 'string' ? value.trim() : value;
        });
        return out;
      };

      const mergedLeads = [...leads];
      let inserted = 0;
      let updated = 0;
      let skipped = 0;

      rows.forEach(raw => {
        const row = cleanRow(raw);
        const name = row.Name || '';
        const company = row.Company || '';
        const notes = row.Notes || '';

        if (!name || !company) { skipped += 1; return; }

        const idKey = String(row.id || row.ID || '').trim();
        const emailKeys = [row.Email, row.PersonalEmail].map(value => String(value || '').trim().toLowerCase()).filter(Boolean);
        const linkedinKey = String(row.LinkedIn || '').trim().toLowerCase();
        const nameCompanyKey = `${name.toLowerCase()}|${company.toLowerCase()}`;

        let matched = null;
        if (mode === 'upsert') {
          matched = (idKey && byId.get(idKey)) || emailKeys.map(key => byEmail.get(key)).find(Boolean) || (linkedinKey && byLinkedIn.get(linkedinKey)) || byNameCompany.get(nameCompanyKey) || null;
        }

        if (matched) {
          const existingHistory = parseHistory(matched.History);
          const nextHistory = withNotesInHistory(existingHistory, notes);
          const normalizedImportedLinkedIn = normalizeLinkedInUrl(row.LinkedIn);
          const patch = {
            Name: name,
            Company: company,
            Title: row.Title || matched.Title || '',
            Email: row.Email || matched.Email || '',
            PersonalEmail: row.PersonalEmail || matched.PersonalEmail || '',
            Phone: row.Phone || matched.Phone || '',
            LinkedIn: normalizedImportedLinkedIn || matched.LinkedIn || '',
            City: row.City || matched.City || '',
            Country: row.Country || matched.Country || '',
            Owner: row.Owner || matched.Owner || defaultOwner || '',
            Stage: normalizeStage(row.Stage || matched.Stage || defaultStage),
            History: JSON.stringify(nextHistory),
            Notes: '',
            calculatedDays: getDaysSinceInteraction(JSON.stringify(nextHistory)) ?? 0
          };
          const idx = mergedLeads.findIndex(l => l.id === matched.id);
          if (idx !== -1) {
            mergedLeads[idx] = { ...mergedLeads[idx], ...patch };
            updated += 1;
          } else {
            skipped += 1;
          }
          return;
        }

        const initialHistory = notes ? [{ date: nowIso, type: 'note', content: notes }] : [];
        const normalizedImportedLinkedIn = normalizeLinkedInUrl(row.LinkedIn);
        const newLead = {
          id: generateId(name),
          Name: name,
          Title: row.Title || '',
          Company: company,
          Email: row.Email || '',
          PersonalEmail: row.PersonalEmail || '',
          Phone: row.Phone || '',
          LinkedIn: normalizedImportedLinkedIn,
          City: row.City || '',
          Country: row.Country || '',
          Stage: normalizeStage(row.Stage || defaultStage),
          Owner: row.Owner || defaultOwner || '',
          Beta: toBool(row.Beta) ? 'true' : 'false',
          Trial: toBool(row.Trial) ? 'true' : 'false',
          History: initialHistory.length ? JSON.stringify(initialHistory) : '',
          Notes: initialHistory.length ? '' : notes,
          calculatedDays: initialHistory.length ? 0 : 0
        };
        mergedLeads.unshift(newLead);
        inserted += 1;
      });

      if (inserted === 0 && updated === 0) {
        notifyToast('error', `No rows imported. ${skipped} row${skipped === 1 ? '' : 's'} skipped.`);
        return;
      }

      saveLeadsToGithub(mergedLeads);
      notifyToast('success', `Bulk save complete: ${inserted} added, ${updated} updated, ${skipped} skipped`);
    } else saveCompaniesToGithub({ ...companies, [data.Company]: data });
    setShowAddModal(false);
  };

  const handleUpdateLead = (updLead, updComp, opts) => {
    const enriched = { ...updLead, calculatedDays: getDaysSinceInteraction(updLead.History) };
    const p = [];
    const originalLead = leads.find(l => l.id === updLead.id);
    const updatedLeadsList = leads.map(l => l.id === updLead.id ? enriched : l);

    if (JSON.stringify(originalLead) !== JSON.stringify(enriched)) {
      p.push(saveLeadsToGithub(updatedLeadsList));

      // CASE 1: Status changed to Disqualified
      const oldStage = normalizeStage(originalLead?.Stage);
      const newStage = normalizeStage(enriched.Stage);
      if (oldStage !== 'Disqualified' && newStage === 'Disqualified') {
        checkForDeadEnd(updatedLeadsList, enriched.Company);
      }

      // CASE 2: Company changed (Lead left the old company)
      // We need to check if the OLD company is now empty
      if (originalLead.Company !== enriched.Company) {
        checkForDeadEnd(updatedLeadsList, originalLead.Company);
      }
    }

    if (updComp && JSON.stringify(companies[updComp.Company]) !== JSON.stringify(updComp)) {
      p.push(saveCompaniesToGithub({ ...companies, [updComp.Company]: updComp }));
    }

    if (!opts?.silent) setDetailLead(enriched);
    return Promise.all(p);
  };

  const handleDeleteLead = (id) => {
    const leadToDelete = leads.find(l => l.id === id);
    const updatedLeads = leads.filter(l => l.id !== id);

    saveLeadsToGithub(updatedLeads).then(() => {
      setDetailLead(null);
      if (leadToDelete) {
        checkForDeadEnd(updatedLeads, leadToDelete.Company);
      }
    });
  };

  const handleRenameCompany = (oldName, newName) => {
    const updatedLeads = leads.map(l => l.Company === oldName ? { ...l, Company: newName } : l);
    const oldData = companies[oldName] || {};
    const targetData = companies[newName] || {};
    const mergedCompanyData = { ...oldData, ...targetData, Company: newName };
    const updatedCompanies = { ...companies };
    delete updatedCompanies[oldName];
    updatedCompanies[newName] = mergedCompanyData;
    Promise.all([saveLeadsToGithub(updatedLeads), saveCompaniesToGithub(updatedCompanies)]).then(() => notifyToast('success', `Merged "${oldName}" into "${newName}"`));
  };

  const handleDeleteCompany = (name) => {
    const updatedCompanies = { ...companies }; delete updatedCompanies[name];
    saveCompaniesToGithub(updatedCompanies).then(() => notifyToast('success', `Deleted "${name}"`));
  };

  const handleUpdateCompany = (compData) => {
    saveCompaniesToGithub({ ...companies, [compData.Company]: compData }).then(() => notifyToast('success', 'Company updated'));
  };

  const handleTableSaveAll = async (draftLeads, draftCompanies) => {
    const saves = [];
    if (JSON.stringify(draftLeads) !== JSON.stringify(leads)) saves.push(saveLeadsToGithub(draftLeads));
    if (JSON.stringify(draftCompanies) !== JSON.stringify(companies)) saves.push(saveCompaniesToGithub(draftCompanies));
    if (!saves.length) return;
    await Promise.all(saves);
  };

  const handleScoutTask = () => {
    if (!deadEndData) return;
    const taskLead = { id: generateId('Scout'), Name: 'Scout New Contacts', Title: 'Research Task', Company: deadEndData.name, Stage: 'New', Notes: 'Automated task: Previous contacts disqualified. Find new entry point.', History: JSON.stringify([{ date: new Date().toISOString(), type: 'note', content: 'Auto-generated: Company hit a dead end.' }]), calculatedDays: 0, Owner: ownerFilter === 'Unassigned' ? '' : ownerFilter };
    saveLeadsToGithub([taskLead, ...leads]); setDeadEndData(null); notifyToast('info', 'Scout task created in "New"');
  };

  const handleReviewNewLeads = () => {
    if (!deadEndData) return;
    setSearchQuery(deadEndData.name); // Filter the board to this company
    setDeadEndData(null);
  };

  const handleEnrichNewLeads = async () => {
    if (enrichingNewLeads) return;
    const newLeadsWithEmail = leads.filter(l => normalizeStage(l.Stage) === 'New' && String(l.Email || '').trim());
    if (newLeadsWithEmail.length === 0) {
      notifyToast('info', 'No New leads with email found');
      return;
    }

    setEnrichingNewLeads(true);
    try {
      const updatedLeads = [...leads];
      const updatedCompanies = { ...companies };

      const findLeadIndex = (leadId) => updatedLeads.findIndex(l => l.id === leadId);
      const companyResearchCache = new Map();
      const leadResearchCache = new Map();

      let linkedInFilled = 0;
      let companySizeFilled = 0;
      let linkedInCleaned = 0;

      for (const lead of newLeadsWithEmail) {
        const idx = findLeadIndex(lead.id);
        if (idx === -1) continue;

        const currentLead = updatedLeads[idx];
        const companyName = String(currentLead.Company || '').trim();
        if (!companyName) continue;

        const currentCompany = updatedCompanies[companyName] || { Company: companyName };

        const normalizedExistingLinkedIn = normalizeLinkedInUrl(currentLead.LinkedIn);
        const rawExistingLinkedIn = String(currentLead.LinkedIn || '').trim();
        if (rawExistingLinkedIn !== normalizedExistingLinkedIn) {
          updatedLeads[idx] = { ...updatedLeads[idx], LinkedIn: normalizedExistingLinkedIn };
          if (rawExistingLinkedIn) linkedInCleaned += 1;
        }

        const missingLinkedIn = !normalizedExistingLinkedIn;
        const missingSize = !Number.isFinite(Number(currentCompany.Employees)) || Number(currentCompany.Employees) <= 0;
        if (!missingLinkedIn && !missingSize) continue;

        if (missingLinkedIn) {
          const leadKey = `${String(currentLead.Name || '').trim().toLowerCase()}|${companyName.toLowerCase()}`;
          if (!leadResearchCache.has(leadKey)) {
            leadResearchCache.set(leadKey, await researchLead(currentLead.Name, companyName));
          }
          const leadIntel = leadResearchCache.get(leadKey) || {};
          const normalizedLinkedIn = normalizeLinkedInUrl(leadIntel.LinkedIn);

          if (normalizedLinkedIn) {
            updatedLeads[idx] = {
              ...updatedLeads[idx],
              LinkedIn: normalizedLinkedIn,
              Title: updatedLeads[idx].Title || leadIntel.Title || '',
              City: updatedLeads[idx].City || leadIntel.City || '',
              Country: updatedLeads[idx].Country || leadIntel.Country || ''
            };
            linkedInFilled += 1;
          }
        }

        if (missingSize) {
          if (!companyResearchCache.has(companyName)) {
            companyResearchCache.set(companyName, await researchCompany(companyName, currentLead.City || ''));
          }
          const companyIntel = companyResearchCache.get(companyName) || {};
          const employeeDigits = String(companyIntel.Employees || '').replace(/[^0-9]/g, '');
          const employeeCount = employeeDigits ? Number(employeeDigits) : 0;

          if (employeeCount > 0) {
            updatedCompanies[companyName] = {
              ...currentCompany,
              Company: companyName,
              Employees: employeeCount,
              Category: currentCompany.Category || companyIntel.Category || '',
              Software: currentCompany.Software || companyIntel.Software || '',
              Url: currentCompany.Url || companyIntel.Url || '',
              City: currentCompany.City || companyIntel.City || '',
              Country: currentCompany.Country || companyIntel.Country || ''
            };
            companySizeFilled += 1;
          }
        }
      }

      const leadsChanged = JSON.stringify(updatedLeads) !== JSON.stringify(leads);
      const companiesChanged = JSON.stringify(updatedCompanies) !== JSON.stringify(companies);

      if (!leadsChanged && !companiesChanged) {
        notifyToast('info', 'No missing LinkedIn or company size found in New leads');
        return;
      }

      const saves = [];
      if (leadsChanged) saves.push(saveLeadsToGithub(updatedLeads));
      if (companiesChanged) saves.push(saveCompaniesToGithub(updatedCompanies));
      await Promise.all(saves);

      setColumnSorts(prev => ({ ...prev, New: 'size' }));
      notifyToast('success', `Enriched New leads: ${linkedInFilled} LinkedIn, ${companySizeFilled} company sizes, ${linkedInCleaned} cleaned`);
    } catch (e) {
      console.error(e);
      notifyToast('error', 'New lead enrichment failed');
    } finally {
      setEnrichingNewLeads(false);
    }
  };

  // --- MAIL MERGE HANDLERS ---
  const handleToggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleSelectAllColumn = (stageId, leadIds) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      const allSelected = leadIds.every(id => next.has(id));
      if (allSelected) { leadIds.forEach(id => next.delete(id)); }
      else { leadIds.forEach(id => next.add(id)); }
      return next;
    });
  };

  const handleMailMergeLogOutreach = (mergeLeads, campaignName, selectedEmails = {}) => {
    const now = new Date().toISOString();
    const updatedLeads = leads.map(lead => {
      if (!mergeLeads.find(ml => ml.id === lead.id)) return lead;
      const history = lead.History ? JSON.parse(lead.History) : [];
      const chosenEmail = selectedEmails[lead.id];
      history.push({ date: now, type: 'user', content: chosenEmail ? `Mail merge: ${campaignName} -> ${chosenEmail}` : `Mail merge: ${campaignName}` });
      return { ...lead, History: JSON.stringify(history), calculatedDays: 0 };
    });
    saveLeadsToGithub(updatedLeads);
    notifyToast('success', `Outreach logged for ${mergeLeads.length} leads`);
  };

  const handleRemoveFromMerge = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const exitMailMergeMode = () => {
    setMailMergeMode(false);
    setSelectedIds(new Set());
    setShowMailMergeModal(false);
  };

  return (
    <>
      <GlobalStyles />
      <div className="h-screen flex flex-col bg-slate-50 text-slate-900 overflow-hidden">
        {/* HEADER */}
        <header className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center shadow-sm z-20">
          <div className="flex items-center gap-6">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-indigo-200">F</div>

            {/* VIEW SWITCHER */}
            <div className="flex bg-slate-100 rounded-lg p-1 gap-1">
              <button onClick={() => setViewMode('pipeline')} className={`flex items-center gap-2 px-3 py-1.5 text-xs font-bold rounded-md transition-all ${viewMode === 'pipeline' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}><LayoutGrid size={14} /> Pipeline</button>
              <button onClick={() => setViewMode('table')} className={`flex items-center gap-2 px-3 py-1.5 text-xs font-bold rounded-md transition-all ${viewMode === 'table' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}><Table2 size={14} /> Spreadsheet</button>
              <button onClick={() => setViewMode('companies')} className={`flex items-center gap-2 px-3 py-1.5 text-xs font-bold rounded-md transition-all ${viewMode === 'companies' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}><List size={14} /> Companies</button>
            </div>

            {/* SEARCH */}
            <div className="relative w-64 group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={16} />
              <input type="text" placeholder={viewMode === 'pipeline' ? "Search leads..." : "Search companies..."} className="w-full pl-10 pr-4 py-2 bg-slate-100 border-transparent rounded-lg text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
              {searchQuery && <button onClick={() => setSearchQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600"><X size={14} /></button>}
            </div>

            {/* PIPELINE FILTERS */}
            {viewMode === 'pipeline' && (
              <>
                <div className="flex items-center gap-2 border-l border-slate-200 pl-6">
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-slate-200 bg-white hover:border-slate-300">
                    <Users size={14} className="text-slate-400" />
                    <select className="text-xs font-semibold text-slate-600 outline-none bg-transparent cursor-pointer" value={ownerFilter} onChange={e => setOwnerFilter(e.target.value)}>
                      <option value="">All Owners</option>{uniqueOwners.map(m => <option key={m} value={m}>{m}</option>)}<option value="Unassigned">Unassigned</option>
                    </select>
                  </div>
                </div>
                <div className="flex items-center gap-2 border-l border-slate-200 pl-6">
                  {[{ k: 'due', l: 'Due Today', i: <Clock size={14} />, c: 'text-rose-600 bg-rose-50 border-rose-200' }, { k: 'focus', l: 'Focus', i: <Filter size={14} />, c: 'text-indigo-600 bg-indigo-50 border-indigo-200' }, { k: 'beta', l: 'Beta', i: <Sparkles size={14} />, c: 'text-purple-600 bg-purple-50 border-purple-200' }, { k: 'trial', l: 'Trial', i: <Trophy size={14} />, c: 'text-amber-600 bg-amber-50 border-amber-200' }].map(f => (
                    <button key={f.k} onClick={() => toggleFilter(f.k)} className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold transition-all border ${filters[f.k] ? f.c : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'}`}>{f.i} <span className="hidden xl:inline">{f.l}</span></button>
                  ))}
                </div>
              </>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setShowSummary(true)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-colors" title="Daily Summary"><Calendar size={20} /></button>
            {viewMode === 'pipeline' && (
              <button
                onClick={handleEnrichNewLeads}
                disabled={enrichingNewLeads}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition-all border ${enrichingNewLeads
                    ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                    : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300 hover:text-slate-700'
                  }`}
                title="Auto-fill LinkedIn and company size for New leads with email"
              >
                {enrichingNewLeads ? <Loader2 size={16} className="animate-spin" /> : <Link size={16} />}
                <span className="hidden sm:inline">Enrich New</span>
              </button>
            )}
            {viewMode === 'pipeline' && (
              <button
                onClick={() => { if (mailMergeMode) { exitMailMergeMode(); } else { setMailMergeMode(true); } }}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition-all border ${mailMergeMode
                    ? 'bg-indigo-50 text-indigo-600 border-indigo-200'
                    : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300 hover:text-slate-700'
                  }`}
                title="Mail Merge Mode"
              >
                <Mail size={16} />
                <span className="hidden sm:inline">{mailMergeMode ? 'Exit Merge' : 'Mail Merge'}</span>
              </button>
            )}
            <button onClick={() => setShowAddModal(true)} className="btn-primary flex items-center gap-2 px-4 py-2 rounded-lg text-sm shadow-md shadow-indigo-200"><Plus size={16} /> <span className="hidden sm:inline">Add</span></button>
            <button onClick={() => setShowSettings(true)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"><Settings size={20} /></button>
          </div>
        </header>

        {/* MAIN CONTENT */}
        <main className="flex-1 overflow-x-auto overflow-y-hidden">
          {loading ? (
            <div className="flex flex-col justify-center items-center h-full text-slate-400 gap-3"><Loader2 className="animate-spin text-indigo-500" size={32} /> <span className="text-sm font-medium">Loading Pipeline...</span></div>
          ) : viewMode === 'companies' ? (
            <CompanyManager
              companies={companies}
              leads={leads}
              searchQuery={searchQuery}
              onUpdateCompany={handleUpdateCompany}
              onRenameCompany={handleRenameCompany}
              onDeleteCompany={handleDeleteCompany}
              onResearchCompany={researchCompany}
              onOpenLead={setDetailLead}
            />
          ) : viewMode === 'table' ? (
            <LeadsTableView
              leads={leads}
              companies={companies}
              owners={uniqueOwners}
              searchQuery={searchQuery}
              onSaveAll={handleTableSaveAll}
              onToast={notifyToast}
            />
          ) : (
            <PipelineBoard
              leads={leads} companies={companies} searchQuery={searchQuery} filters={filters}
              ownerFilter={ownerFilter} duplicatesSet={duplicatesSet}
              activeLead={activeLead} setActiveId={setActiveId}
              focusedStage={focusedStage} setFocusedStage={setFocusedStage}
              columnSorts={columnSorts} setColumnSorts={setColumnSorts}
              columnCollapse={columnCollapse} setColumnCollapse={setColumnCollapse}
              columnScroll={columnScroll} setColumnScroll={setColumnScroll}
              minimizedStages={minimizedStages} setMinimizedStages={setMinimizedStages}
              onDragEnd={handleDragEnd} onOpenLead={setDetailLead}
              mailMergeMode={mailMergeMode} selectedIds={selectedIds}
              onToggleSelect={handleToggleSelect} onSelectAllColumn={handleSelectAllColumn}
            />
          )}
        </main>

        {/* MODALS */}
        {showAddModal && <AddModal companies={companies} leads={leads} owners={uniqueOwners} onClose={() => setShowAddModal(false)} onSave={handleAdd} onResearchLead={researchLead} onResearchCompany={researchCompany} />}
        {detailLead && <DetailModal lead={detailLead} companies={companies} leads={leads} owners={uniqueOwners} onClose={() => setDetailLead(null)} onOpenLead={setDetailLead} onSave={handleUpdateLead} onAnalyze={askGemini} onResearch={researchCompany} onToast={notifyToast} onDelete={handleDeleteLead} />}
        {showSummary && <DailySummaryModal leads={leads} onClose={() => setShowSummary(false)} />}
        {deadEndData && <CompanyStatusAlert companyName={deadEndData.name} newLeadsCount={deadEndData.newCount} onClose={() => setDeadEndData(null)} onScout={handleScoutTask} onGiveUp={() => setDeadEndData(null)} onGoToNew={handleReviewNewLeads} />}

        {/* MAIL MERGE */}
        {mailMergeMode && (
          <MailMergeSelectionBar
            selectedCount={selectedIds.size}
            onOpenMerge={() => setShowMailMergeModal(true)}
            onClearSelection={() => setSelectedIds(new Set())}
            onCancel={exitMailMergeMode}
          />
        )}
        {showMailMergeModal && (
          <MailMergeModal
            selectedLeads={leads.filter(l => selectedIds.has(l.id))}
            companies={companies}
            onClose={() => setShowMailMergeModal(false)}
            onLogOutreach={handleMailMergeLogOutreach}
            onRemoveLead={handleRemoveFromMerge}
          />
        )}

        {/* SETTINGS MODAL */}
        {showSettings && (
          <ModalWrapper title="Login / Settings" onClose={() => { if (keys.github && keys.gemini && ownerConfirmed) setShowSettings(false); }}>
            <div className="space-y-4">
              <div><label className="text-xs font-bold text-slate-400 uppercase">GitHub Token</label><input type="password" value={keys.github} onChange={e => setKeys({ ...keys, github: e.target.value })} className="input-clean mt-1" /></div>
              <div><label className="text-xs font-bold text-slate-400 uppercase">Gemini Key</label><input type="password" value={keys.gemini} onChange={e => setKeys({ ...keys, gemini: e.target.value })} className="input-clean mt-1" /></div>
              <div><label className="text-xs font-bold text-slate-400 uppercase">Your Owner Name (optional)</label><input type="text" value={ownerFilter} onChange={e => setOwnerFilter(e.target.value)} className="input-clean mt-1" placeholder="(Optional)" /></div>
              <button onClick={() => { localStorage.setItem('gh_token', keys.github); localStorage.setItem('gemini_key', keys.gemini); localStorage.setItem('ownerFilter', ownerFilter ?? ''); setOwnerConfirmed(true); if (keys.github && keys.gemini) window.location.reload(); }} className="w-full btn-primary py-2.5" disabled={!keys.github || !keys.gemini}>Save & Reload</button>
            </div>
          </ModalWrapper>
        )}

        {/* UTILS */}
        {advice && <div className="fixed right-0 top-0 h-full w-[450px] bg-white shadow-2xl border-l border-slate-200 z-[90] p-6 overflow-y-auto animate-in slide-in-from-right"><div className="flex justify-between items-center mb-6"><h3 className="text-xl font-bold flex items-center gap-2 text-slate-800"><Sparkles className="text-purple-600" /> AI Analysis</h3><button onClick={() => setAdvice(null)}><X size={20} className="text-slate-400 hover:text-slate-600" /></button></div><div className="space-y-6"><div className="bg-purple-50 p-5 rounded-xl border border-purple-100 shadow-sm"><h4 className="font-bold text-purple-900 text-xs uppercase tracking-wider mb-2">Strategy</h4><p className="text-sm text-slate-700 leading-relaxed">{advice.strategy}</p></div><div><div className="flex justify-between mb-2"><h4 className="font-bold text-slate-400 text-xs uppercase">Response Draft</h4><button onClick={() => { navigator.clipboard.writeText(advice.email_draft || ""); setCopiedEmail(true); setTimeout(() => setCopiedEmail(false), 1500); }} className="text-indigo-600 text-xs font-bold flex gap-1 hover:text-indigo-800 transition-colors">{copiedEmail ? <CheckCircle2 size={12} /> : <Mail size={12} />} Copy</button></div><textarea className="w-full h-64 p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono text-slate-600 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all" defaultValue={advice.email_draft} /></div></div></div>}
        {geminiLoading && <div className="fixed bottom-8 right-8 bg-slate-900 text-white px-6 py-3 rounded-full flex items-center gap-3 shadow-2xl z-[100] animate-bounce"><Loader2 className="animate-spin" size={20} /> Analyzing...</div>}
        {toast && !geminiLoading && <div className={`fixed bottom-8 right-8 text-white px-6 py-3 rounded-full flex items-center gap-3 shadow-2xl z-[100] ${toast.type === 'success' ? 'bg-emerald-600' : toast.type === 'error' ? 'bg-rose-600' : 'bg-slate-800'}`}>{toast.type === 'success' && <CheckCircle2 size={20} />}{toast.type === 'error' && <AlertCircle size={20} />}{toast.type === 'info' && <Sparkles size={20} />}<span className="text-sm font-medium">{toast.text}</span></div>}
      </div>
    </>
  );
}