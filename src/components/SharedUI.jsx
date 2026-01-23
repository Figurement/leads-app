import React from 'react';
import DatePicker, { registerLocale } from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { da } from 'date-fns/locale/da';
import { Clock, BadgeCheck, X } from 'lucide-react';

registerLocale('da', da);

export const CustomDatePicker = ({ selected, onChange, showTimeSelect, placeholderText }) => (
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

export const StatusBadge = ({ type, label }) => {
    const base = "leading-none ml-auto flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap shrink-0";
    let cls = "", icon = null;
    switch (type) {
        case 'due': cls = "text-rose-600 bg-rose-50 border-rose-100"; icon = <Clock size={10} />; break;
        case 'stalled': cls = "text-slate-600 bg-slate-100 border-slate-200"; break;
        case 'active': cls = "text-emerald-600 bg-emerald-50 border-emerald-100"; break;
        default: cls = "text-slate-600 bg-slate-100 border-slate-200";
    }
    return <div className={`${base} ${cls}`}>{icon}{label}</div>;
};

export const EnterpriseMark = () => (
    <BadgeCheck size={10} className=" text-indigo-500 shrink-0" fill="#e0e7ff" aria-label="Enterprise Verified" />
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

export const ModalWrapper = ({ title, children, onClose }) => (
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