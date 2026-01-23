import React, { useState, useMemo } from 'react';
import { Loader2, Sparkles, AlertCircle, X } from 'lucide-react';

export const AddModal = ({ companies, leads, owners, onClose, onSave, onResearchLead, onResearchCompany }) => {
    const [type, setType] = useState('lead');
    const [formData, setFormData] = useState({ Name: '', Title: '', Company: '', Email: '', Phone: '', LinkedIn: '', Category: '', Employees: '', City: '', Country: '', Url: '', Software: '', Notes: '', Owner: '' });
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
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[70] animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-100 scale-100">
                <div className="bg-white px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                    <h3 className="font-semibold text-slate-800 text-lg">Add New Entry</h3>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"><X size={20} /></button>
                </div>
                <div className="p-6 max-h-[85vh] overflow-y-auto">
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
                                        <div className="flex items-center gap-2 text-amber-700 font-bold mb-1"><AlertCircle size={16} />Lead Info</div>
                                        <p className="text-amber-600 text-xs mb-2">We have other leads at {formData.Company}:</p>
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
                                <input placeholder="Phone" className="input-clean" value={formData.Phone} onChange={e => setFormData({ ...formData, Phone: e.target.value })} />
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
                        <div className="flex gap-2 mt-2">
                            <button type="button" className="w-1/2 btn-icon-secondary py-2.5" onClick={onClose}>Cancel</button>
                            <button type="submit" className="w-1/2 btn-primary py-2.5">Create {type === 'lead' ? 'Lead' : 'Company'}</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};