/* src/components/DailySummaryModal.jsx */
import React, { useState, useMemo } from 'react';
import { X, ChevronLeft, ChevronRight, MessageSquare, Mail, FileText, Calendar } from 'lucide-react';

// Helper to parse dates strictly for day comparison
const isSameDay = (d1, d2) => {
    return d1.getFullYear() === d2.getFullYear() &&
        d1.getMonth() === d2.getMonth() &&
        d1.getDate() === d2.getDate();
};

export const DailySummaryModal = ({ leads, onClose }) => {
    const [selectedDate, setSelectedDate] = useState(new Date());

    // --- AGGREGATION LOGIC ---
    const dailyActivities = useMemo(() => {
        const activities = [];

        leads.forEach(lead => {
            if (!lead.History) return;

            let history = [];
            try {
                history = JSON.parse(lead.History);
            } catch (e) { return; }

            // Filter entries for the selected date
            const daysEntries = history.filter(entry => {
                const entryDate = new Date(entry.date);
                return isSameDay(entryDate, selectedDate);
            });

            if (daysEntries.length > 0) {
                activities.push({
                    leadName: lead.Name,
                    company: lead.Company,
                    leadId: lead.id,
                    entries: daysEntries.sort((a, b) => new Date(a.date) - new Date(b.date)) // Chronological order for the summary
                });
            }
        });

        return activities;
    }, [leads, selectedDate]);

    // Navigation helpers
    const changeDate = (days) => {
        const next = new Date(selectedDate);
        next.setDate(next.getDate() + days);
        setSelectedDate(next);
    };

    const setToday = () => setSelectedDate(new Date());

    return (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[70] animate-in fade-in duration-200" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[85vh]" onClick={e => e.stopPropagation()}>

                {/* HEADER */}
                <div className="bg-white px-6 py-4 border-b border-slate-100 flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                            <Calendar size={20} />
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-800 text-lg leading-tight">Daily Recap</h3>
                            <p className="text-xs text-slate-500">Reviewing activity log</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"><X size={20} /></button>
                </div>

                {/* DATE NAVIGATION */}
                <div className="flex items-center justify-between px-6 py-3 bg-slate-50 border-b border-slate-200 shrink-0">
                    <button onClick={() => changeDate(-1)} className="p-1.5 hover:bg-white hover:shadow-sm rounded-md text-slate-500 transition-all"><ChevronLeft size={18} /></button>

                    <div className="flex items-center gap-3">
                        <span className="font-semibold text-slate-700 tabular-nums">
                            {selectedDate.toLocaleDateString('da-DK', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                        </span>
                        {!isSameDay(selectedDate, new Date()) && (
                            <button onClick={setToday} className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full hover:bg-indigo-100">
                                Go to Today
                            </button>
                        )}
                    </div>

                    <button onClick={() => changeDate(1)} className="p-1.5 hover:bg-white hover:shadow-sm rounded-md text-slate-500 transition-all"><ChevronRight size={18} /></button>
                </div>

                {/* CONTENT */}
                <div className="flex-1 overflow-y-auto p-6 bg-slate-50/30">
                    {dailyActivities.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-48 text-slate-400">
                            <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mb-2">
                                <Calendar size={20} />
                            </div>
                            <p className="text-sm font-medium">No activity logged for this date.</p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {dailyActivities.map((group) => (
                                <div key={group.leadId} className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                                    {/* Lead Header */}
                                    <div className="bg-slate-50 px-4 py-2 border-b border-slate-100 flex justify-between items-center">
                                        <div className="font-semibold text-slate-800 text-sm">
                                            {group.leadName} <span className="text-slate-400 font-normal">at {group.company}</span>
                                        </div>
                                    </div>

                                    {/* Entries */}
                                    <div className="divide-y divide-slate-50">
                                        {group.entries.map((entry, idx) => {
                                            const timeStr = new Date(entry.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                                            let Icon = MessageSquare;
                                            let colorClass = "text-slate-500 bg-slate-100";

                                            if (entry.type === 'user') { Icon = Mail; colorClass = "text-indigo-600 bg-indigo-50"; }
                                            if (entry.type === 'note') { Icon = FileText; colorClass = "text-amber-600 bg-amber-50"; }

                                            return (
                                                <div key={idx} className="p-4 flex gap-4 hover:bg-slate-50/50 transition-colors">
                                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${colorClass}`}>
                                                        <Icon size={14} />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{timeStr}</span>
                                                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded text-white capitalize ${entry.type === 'user' ? 'bg-indigo-500' : entry.type === 'note' ? 'bg-amber-400' : 'bg-slate-400'}`}>
                                                                {entry.type || 'Log'}
                                                            </span>
                                                        </div>
                                                        <div className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                                                            {entry.content}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};