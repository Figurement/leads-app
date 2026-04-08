import React, { useState, useMemo } from 'react';
import { X, Download, Copy, CheckCircle2, AlertTriangle, Mail, Trash2, Send, Users, ChevronDown } from 'lucide-react';

const parseEmails = (emailStr) => {
  if (!emailStr) return [];
  return emailStr.split(',').map(e => e.trim()).filter(Boolean);
};

const parseName = (fullName) => {
  if (!fullName) return { first: '', last: '' };
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) {
    return { first: parts[0], last: '' };
  }
  return {
    first: parts[0], // First word is the first name
    last: parts.slice(1).join(' ') // Everything else is the last name
  };
};

export const MailMergeModal = ({ selectedLeads, companies, onClose, onLogOutreach, onRemoveLead }) => {
  const [campaignName, setCampaignName] = useState('');
  const [copied, setCopied] = useState(false);
  const [logged, setLogged] = useState(false);
  // Track chosen email per lead id — defaults built lazily
  const [emailChoices, setEmailChoices] = useState({});

  const withEmail = useMemo(() => selectedLeads.filter(l => l.Email && l.Email.trim()), [selectedLeads]);
  const withoutEmail = useMemo(() => selectedLeads.filter(l => !l.Email || !l.Email.trim()), [selectedLeads]);

  const getChosenEmail = (lead) => {
    if (emailChoices[lead.id]) return emailChoices[lead.id];
    const emails = parseEmails(lead.Email);
    return emails[0] || '';
  };

  const handleCopyTSV = () => {
    const headers = ['Email', 'First Name', 'Last Name', 'Title', 'Company', 'City', 'Country'];
    const rows = withEmail.map(l => {
      const { first, last } = parseName(l.Name);
      return [
        getChosenEmail(l), first, last, l.Title || '', l.Company || '', l.City || '', l.Country || ''
      ];
    });
    const tsv = [headers.join('\t'), ...rows.map(r => r.join('\t'))].join('\n');
    navigator.clipboard.writeText(tsv);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadCSV = () => {
    const headers = ['Email', 'First Name', 'Last Name', 'Title', 'Company', 'City', 'Country'];
    const rows = withEmail.map(l => {
      const { first, last } = parseName(l.Name);
      return [
        getChosenEmail(l),
        first,
        last,
        l.Title || '',
        l.Company || '',
        l.City || '',
        l.Country || ''
      ];
    });

    const escape = (val) => {
      const s = String(val);
      if (s.includes(',') || s.includes('"') || s.includes('\n')) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };

    const csv = [headers.join(','), ...rows.map(r => r.map(escape).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mail-merge-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleLogOutreach = () => {
    if (!campaignName.trim()) return;
    onLogOutreach(withEmail, campaignName.trim());
    setLogged(true);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[80] animate-in fade-in duration-200" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-100" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="bg-white px-6 py-4 border-b border-slate-100 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-indigo-100 rounded-lg flex items-center justify-center">
              <Mail size={18} className="text-indigo-600" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-800 text-lg">Mail Merge</h3>
              <p className="text-xs text-slate-400">{withEmail.length} recipients ready</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 max-h-[75vh] overflow-y-auto custom-scrollbar space-y-5">

          {/* Warning: Missing emails */}
          {withoutEmail.length > 0 && (
            <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-xl">
              <AlertTriangle size={16} className="text-amber-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-semibold text-amber-800">
                  {withoutEmail.length} lead{withoutEmail.length > 1 ? 's' : ''} missing email — excluded from merge
                </p>
                <p className="text-xs text-amber-600 mt-0.5">
                  {withoutEmail.map(l => l.Name).join(', ')}
                </p>
              </div>
            </div>
          )}

          {/* Recipients list */}
          <div>
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Recipients ({withEmail.length})</div>
            <div className="border border-slate-200 rounded-xl overflow-hidden max-h-64 overflow-y-auto custom-scrollbar">
              {withEmail.length === 0 ? (
                <div className="p-6 text-center text-slate-400 text-sm">No leads with email addresses selected</div>
              ) : (
                withEmail.map(lead => {
                  const emails = parseEmails(lead.Email);
                  const chosen = getChosenEmail(lead);
                  const hasMultiple = emails.length > 1;
                  return (
                    <div key={lead.id} className="flex items-center gap-3 px-4 py-2.5 border-b border-slate-50 last:border-b-0 hover:bg-slate-50 group">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-slate-700 truncate">{lead.Name}</span>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{lead.Company}</span>
                        </div>
                        {hasMultiple ? (
                          <div className="relative mt-0.5">
                            <select
                              value={chosen}
                              onChange={e => setEmailChoices(prev => ({ ...prev, [lead.id]: e.target.value }))}
                              className="w-full text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-md pl-2 pr-6 py-1 outline-none focus:ring-1 focus:ring-indigo-400 appearance-none cursor-pointer"
                            >
                              {emails.map(email => (
                                <option key={email} value={email}>{email}</option>
                              ))}
                            </select>
                            <ChevronDown size={12} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                          </div>
                        ) : (
                          <p className="text-xs text-slate-400 truncate">{chosen}</p>
                        )}
                      </div>
                      <button
                        onClick={() => onRemoveLead(lead.id)}
                        className="p-1 rounded text-slate-300 hover:text-rose-500 hover:bg-rose-50 opacity-0 group-hover:opacity-100 transition-all"
                        title="Remove from merge"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Actions: Copy & Download */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={handleCopyTSV}
              disabled={withEmail.length === 0}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-slate-100 hover:bg-slate-200 rounded-xl text-sm font-semibold text-slate-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {copied ? <CheckCircle2 size={16} className="text-emerald-500" /> : <Copy size={16} />}
              {copied ? 'Copied!' : 'Copy for Sheets'}
            </button>
            <button
              onClick={handleDownloadCSV}
              disabled={withEmail.length === 0}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-indigo-50 hover:bg-indigo-100 rounded-xl text-sm font-semibold text-indigo-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Download size={16} />
              Download CSV
            </button>
          </div>

          {/* Google Mail Merge instructions */}
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Google Mail Merge Steps</p>
            <ol className="text-xs text-slate-600 space-y-1.5 list-decimal list-inside">
              <li>Download CSV above and import into <strong>Google Sheets</strong></li>
              <li>Open <strong>Gmail</strong> → Compose → click <strong>Mail merge</strong> toggle</li>
              <li>Select your Google Sheet as the recipient source</li>
              <li>Use <code className="bg-slate-200 px-1 rounded text-[11px]">@Name</code>, <code className="bg-slate-200 px-1 rounded text-[11px]">@Company</code> etc. as merge tags in your email</li>
              <li>Preview, then send — come back here to log the outreach</li>
            </ol>
          </div>

          {/* Log outreach */}
          <div className="border-t border-slate-100 pt-5">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Log Outreach</div>
            <p className="text-xs text-slate-500 mb-3">Record this mail merge in each lead's activity history</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={campaignName}
                onChange={e => setCampaignName(e.target.value)}
                placeholder="Campaign name or subject line..."
                className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              />
              <button
                onClick={handleLogOutreach}
                disabled={!campaignName.trim() || withEmail.length === 0 || logged}
                className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-md shadow-indigo-200"
              >
                {logged ? <CheckCircle2 size={16} /> : <Send size={16} />}
                {logged ? 'Logged!' : 'Log as Sent'}
              </button>
            </div>
            {logged && (
              <p className="text-xs text-emerald-600 font-medium mt-2 flex items-center gap-1">
                <CheckCircle2 size={12} /> Outreach recorded for {withEmail.length} leads
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// --- Floating selection bar shown during mail merge mode ---
export const MailMergeSelectionBar = ({ selectedCount, onOpenMerge, onClearSelection, onCancel }) => {
  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] animate-in slide-in-from-bottom-4 fade-in duration-300">
      <div className="flex items-center gap-4 bg-slate-900 text-white pl-5 pr-3 py-3 rounded-2xl shadow-2xl border border-slate-700">
        <div className="flex items-center gap-2">
          <Users size={16} className="text-indigo-400" />
          <span className="text-sm font-semibold">{selectedCount} selected</span>
        </div>
        <div className="w-px h-5 bg-slate-700" />
        <button
          onClick={onOpenMerge}
          className="flex items-center gap-2 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-sm font-semibold transition-colors"
        >
          <Mail size={14} /> Prepare Merge
        </button>
        <button
          onClick={onClearSelection}
          className="px-3 py-1.5 text-slate-400 hover:text-white text-sm transition-colors"
        >
          Clear
        </button>
        <button
          onClick={onCancel}
          className="p-1.5 text-slate-500 hover:text-white rounded-lg hover:bg-slate-700 transition-colors"
          title="Exit mail merge mode"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
};
