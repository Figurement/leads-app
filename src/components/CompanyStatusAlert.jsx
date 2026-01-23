import React from 'react';
import { Users, AlertCircle, ArrowRight, Search } from 'lucide-react';

export const CompanyStatusAlert = ({ companyName, newLeadsCount, onClose, onScout, onGiveUp, onGoToNew }) => {
    const hasPotentials = newLeadsCount > 0;
    return (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[100] animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden border border-slate-100 p-6">
                <div className="flex flex-col items-center text-center mb-6">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-3 ${hasPotentials ? 'bg-indigo-100 text-indigo-600' : 'bg-orange-100 text-orange-600'}`}>
                        {hasPotentials ? <Users size={24} /> : <AlertCircle size={24} />}
                    </div>
                    <h3 className="text-lg font-bold text-slate-800">{hasPotentials ? "Active Pursuit Ended" : "Dead End Reached"}</h3>
                    <p className="text-sm text-slate-500 mt-2">You disqualified the last active person at <strong className="text-slate-700">{companyName}</strong>.</p>
                    {hasPotentials ? (
                        <p className="text-sm text-indigo-600 font-medium mt-2 bg-indigo-50 px-3 py-1 rounded-full">But you have {newLeadsCount} potential leads in "New".</p>
                    ) : (
                        <p className="text-sm text-slate-500 mt-1">There are no other leads in the pipeline.</p>
                    )}
                </div>
                <div className="space-y-3">
                    {hasPotentials ? (
                        <button onClick={onGoToNew} className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition-colors"><ArrowRight size={16} /> Review Leads in "New"</button>
                    ) : (
                        <button onClick={onScout} className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition-colors"><Search size={16} /> Scout New Contacts (Create Task)</button>
                    )}
                    <button onClick={onGiveUp} className="w-full py-3 px-4 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl font-medium text-sm transition-colors">Give up on Company</button>
                </div>
            </div>
        </div>
    );
};