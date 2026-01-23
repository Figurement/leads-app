/* src/components/PipelineBoard.jsx */
import React, { useState, useMemo, useRef, useLayoutEffect, useEffect } from 'react';
import {
    DndContext, useDraggable, useDroppable, DragOverlay, closestCorners,
    useSensor, useSensors, MouseSensor, TouchSensor
} from '@dnd-kit/core';
import { ChevronDown, ChevronLeft, Check, Building2, HelpCircle, CheckCircle2 } from 'lucide-react';
import {
    STAGE_DEFINITIONS, ORDERED_STAGES, SORT_STRATEGIES,
    StatusBadge, EnterpriseMark, OwnerAvatar,
    normalizeStage, isDue
} from '../lib/utils'; // Importing from our new shared file

// --- INTERNAL COMPONENT: LeadCardUI ---
export const LeadCardUI = React.forwardRef(({ lead, company, onOpen, style, listeners, attributes, isOverlay, duplicatesSet, showOwnerAvatar }, ref) => {
    const stage = normalizeStage(lead.Stage);
    const daysSince = lead.calculatedDays || 0;
    const isDueToday = isDue(lead['Next Date']);
    const isStalled = (stage === 'Connected' && daysSince > 10);
    const isActive = (stage === 'Qualified');
    const isDuplicate = duplicatesSet?.has(lead.id);
    const isEnterprise = (typeof company?.Employees === 'number') && company.Employees >= 500;

    let historyLen = 0;
    try {
        const h = JSON.parse(lead.History || '[]');
        if (Array.isArray(h)) historyLen = h.length;
    } catch { }

    const ownerName = lead.Owner || 'Unassigned';
    const ownerInitial = ownerName === 'Unassigned' ? '?' : ownerName.charAt(0).toUpperCase();

    // --- HEADER BADGE LOGIC (top-right) ---
    const headerBadge = (stage === 'Disqualified') ? null : (
        isDueToday
            ? <StatusBadge type="due" label="Due Today" />
            : isStalled
                ? <StatusBadge type="stalled" label="Stalled" />
                : isActive
                    ? <StatusBadge type="active" label="Active" />
                    : null
    );

    return (
        <div
            ref={ref} style={style} {...listeners} {...attributes}
            onClick={() => !isOverlay && onOpen(lead)}
            className={`
        bg-white p-4 mb-3 rounded-xl shadow-sm border border-slate-200 
        cursor-grab hover:shadow-md hover:border-indigo-300 transition-all duration-200 group relative
        ${isOverlay ? 'shadow-2xl scale-105 rotate-1 z-50 ring-2 ring-indigo-500' : ''}
      `}
        >
            {/* --- HEADER: COMPANY INFO (icon removed, elegant enterprise tag) --- */}
            <div className="flex items-center h-6 gap-1.5 mb-2 overflow-hidden ">
                <span className="text-[10px] font-bold uppercase tracking-wider truncate text-slate-600">
                    {lead.Company}
                </span>
                {isEnterprise && (<EnterpriseMark />)}
                {isDuplicate && <span className="text-[9px] font-bold text-white bg-red-500 px-1 rounded-[3px]">DUP</span>}
                {headerBadge || (
                    historyLen > 0 && daysSince < 900 && (
                        <span className="ml-auto text-[10px] font-semibold text-slate-400 whitespace-nowrap">
                            {daysSince}d
                        </span>
                    )
                )}
            </div>

            {/* --- BODY: LEAD DETAILS + Owner Avatar (compact) --- */}
            <div className="space-y-1">
                <div>
                    <h4 className="font-bold text-slate-800 text-sm leading-snug">{lead.Name}</h4>
                </div>
                <div className="flex items-center justify-between">
                    <p className="text-xs text-slate-500 truncate min-w-0">{lead.Title || 'No Title'}</p>
                    {showOwnerAvatar && (
                        <OwnerAvatar name={lead.Owner} size="w-5 h-5" textSize="text-[9px]" />
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

// --- INTERNAL COMPONENT: Column ---
const Column = ({ id, title, leads, companies, onOpen, duplicatesSet, onFocusToggle, isFocused, currentSort, onChangeSort, showOwnerAvatar, collapseMulti, onToggleCollapse, scrollPos, onScrollPosChange, isMinimized, onToggleMinimize }) => {
    const { setNodeRef, isOver } = useDroppable({ id });
    const [menuOpen, setMenuOpen] = useState(false);
    const [guideOpen, setGuideOpen] = useState(false);
    const menuRef = useRef(null);
    const [expandedCompanies, setExpandedCompanies] = useState(() => new Set());
    const scrollRef = useRef(null);
    const prevScrollTopRef = useRef(0);

    // Retrieve the actual object for the current sort (Label + Icon)
    const activeSortData = SORT_STRATEGIES[currentSort] || SORT_STRATEGIES.momentum;

    useEffect(() => {
        const handleClick = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    useLayoutEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = prevScrollTopRef.current;
        }
    }, [leads]);

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
            const compName = (l.Company || '').trim();
            const key = compName ? compName : `__single__${l.id}`;
            if (!map.has(key)) { map.set(key, { company: compName, items: [] }); order.push(key); }
            map.get(key).items.push(l);
        });
        return order.map(k => map.get(k));
    }, [sortedLeads]);

    const toggleCompanyExpand = (company) => {
        setExpandedCompanies(prev => {
            const next = new Set(prev);
            if (next.has(company)) next.delete(company); else next.add(company);
            return next;
        });
    };

    // 1. MINIMIZED VIEW
    if (isMinimized) {
        return (
            <div
                ref={setNodeRef}
                onClick={onToggleMinimize}
                className={`
          w-10 h-full flex flex-col items-center py-4 gap-4 transition-all duration-200 cursor-pointer flex-shrink-0 relative rounded-xl mr-4
          ${isOver ? 'bg-indigo-50 ring-2 ring-indigo-500 ring-opacity-50 z-50' : 'bg-slate-50 hover:bg-slate-100'}
        `}
            >
                {/* Count Badge */}
                <div className="bg-slate-200 text-slate-600 text-[10px] font-bold h-6 min-w-[24px] px-1 rounded-full flex items-center justify-center z-10">
                    {leads.length}
                </div>

                {/* Rotated Label (Vertical Text) with icon below */}
                <div className="flex-1 flex flex-col items-center justify-start">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400 whitespace-nowrap [writing-mode:vertical-rl] rotate-180 select-none mt-0">
                        {title}
                    </span>

                    <div className="text-slate-400 mt-2">
                        {STAGE_DEFINITIONS[title]?.icon}
                    </div>
                </div>
            </div>
        );
    }
    const stageInfo = STAGE_DEFINITIONS[title] || { icon: <HelpCircle size={14} />, desc: '', exit: '' };

    // 2. EXPANDED VIEW
    return (
        <div
            ref={setNodeRef}
            className={`
        flex-shrink-0 w-64 h-full flex flex-col mr-4 transition-all duration-200 rounded-xl
        ${isOver ? 'ring-2 ring-indigo-500 ring-opacity-50 bg-indigo-50/30' : ''} 
      `}
        >
            {/* --- COLUMN HEADER --- */}
            <div className={`group flex justify-between items-center mb-3 px-3 py-2 rounded-lg transition-colors relative ${isFocused ? 'bg-indigo-50 border border-indigo-100' : 'hover:bg-gray-200/50'}`}>

                {/* GUIDELINE POPOVER (Positioned BELOW the header to avoid clipping) */}
                {guideOpen && (
                    <div className="absolute top-full left-0 mt-2 w-64 z-[100] animate-in fade-in slide-in-from-top-1 duration-200">
                        <div className="bg-slate-800 p-4 rounded-xl shadow-2xl border border-slate-700 relative">
                            {/* Arrow pointing UP */}
                            <div className="absolute -top-1.5 left-6 w-3 h-3 bg-slate-800 border-t border-l border-slate-700 rotate-45 transform"></div>

                            {/* Content (Clean, No Icon) */}
                            <p className="text-xs text-slate-300 font-medium leading-relaxed mb-3">
                                {stageInfo.desc}
                            </p>
                            <div>
                                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                                    Exit Criteria
                                </div>
                                <div className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                                    <CheckCircle2 size={12} /> {stageInfo.exit}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Left Side: Title & Info Trigger */}
                <div
                    className="flex items-center gap-2 cursor-pointer relative z-10"
                    onClick={() => onFocusToggle(id)}
                    onMouseEnter={() => setGuideOpen(true)}
                    onMouseLeave={() => setGuideOpen(false)}
                >
                    {/* Stage Icon */}
                    <span className={`inline-flex items-center justify-center ${isFocused ? 'text-indigo-600' : 'text-slate-400'}`}>
                        {stageInfo.icon}
                    </span>
                    {/* Title */}
                    <span className={`text-xs font-bold uppercase tracking-wider ${isFocused ? 'text-indigo-700' : 'text-slate-500'}`}>
                        {title}
                    </span>
                    {/* Count Pill */}
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${isFocused ? 'bg-white text-indigo-600 shadow-sm' : 'bg-slate-200 text-slate-600'}`}>
                        {leads.length}
                    </span>
                </div>

                {/* Right Side: SORT BADGE + CHEVRON */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" ref={menuRef}>
                    {/* Sort menu trigger (keeps menu) */}
                    <div
                        className="flex items-center gap-1.5 px-2 py-1 rounded bg-white border border-slate-200 shadow-sm cursor-pointer hover:border-indigo-300"
                        onClick={() => setMenuOpen(!menuOpen)}
                        title={`Sorted by ${activeSortData.label}: ${activeSortData.desc}`}
                    >
                        <span className="text-xs">{activeSortData.icon}</span>
                        <span className="text-[9px] font-bold uppercase tracking-wide text-slate-500">{activeSortData.label}</span>
                    </div>
                    {/* Chevron for minimize */}
                    <button
                        onClick={onToggleMinimize}
                        className="p-1.5 rounded-md hover:bg-white hover:shadow-sm transition-all text-slate-400 hover:text-indigo-600"
                        title="Minimize Column"
                    >
                        <ChevronLeft size={16} className={isMinimized ? 'rotate-180 transition-transform' : 'transition-transform'} />
                    </button>
                    {/* The menu is only shown when clicking the sort badge above */}
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
                            <div className="border-t border-slate-100 p-1">
                                <button onClick={() => { onToggleMinimize(); setMenuOpen(false); }} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-600 hover:bg-slate-50 rounded-lg transition-colors">
                                    <ArrowRight size={14} className="rotate-180" /> Minimize Column
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* --- COLUMN BODY --- */}
            <div
                ref={scrollRef}
                onScroll={(e) => {
                    prevScrollTopRef.current = e.currentTarget.scrollTop;
                    onScrollPosChange && onScrollPosChange(id, e.currentTarget.scrollTop);
                }}
                className={`flex-1 overflow-y-auto overflow-x-hidden px-1 pb-4 custom-scrollbar rounded-xl transition-colors ${isFocused ? 'bg-indigo-50/30' : 'bg-slate-100/50'}`}
            >
                <div className="h-2" />

                {/* NON-COLLAPSED MODE */}
                {!collapseMulti && (
                    sortedLeads.map(lead => {
                        return (
                            <div key={lead.id} className="relative group/card">

                                <DraggableLeadCard lead={lead} company={companies[lead.Company]} onOpen={onOpen} duplicatesSet={duplicatesSet} showOwnerAvatar={showOwnerAvatar} />
                            </div>
                        );
                    })
                )}

                {/* COLLAPSED MODE */}
                {collapseMulti && (
                    groupedByCompany.map(group => {
                        if (group.items.length <= 1) {
                            const lead = group.items[0];
                            return (
                                <div key={lead.id} className="relative group/card">

                                    <DraggableLeadCard lead={lead} company={companies[lead.Company]} onOpen={onOpen} duplicatesSet={duplicatesSet} showOwnerAvatar={showOwnerAvatar} />
                                </div>
                            );
                        }
                        const expanded = expandedCompanies.has(group.company);
                        const compData = companies[group.company];
                        const isEnterprise = (typeof compData?.Employees === 'number') && compData.Employees >= 500;
                        const groupDue = group.items.some(i => isDue(i['Next Date']));
                        const groupStalled = group.items.some(i => normalizeStage(i.Stage) === 'Connected' && (i.calculatedDays || 0) > 10);
                        const groupActive = group.items.some(i => normalizeStage(i.Stage) === 'Qualified');
                        const groupHeaderBadge = (title === 'Disqualified') ? null : (
                            groupDue
                                ? <StatusBadge type="due" label="Due Today" />
                                : groupStalled
                                    ? <StatusBadge type="stalled" label="Stalled" />
                                    : groupActive
                                        ? <StatusBadge type="active" label="Active" />
                                        : null
                        );

                        return (
                            <div key={`group-${group.company}`} className="mb-3">
                                <button onClick={() => toggleCompanyExpand(group.company)} className={`w-full text-left relative bg-white p-4 rounded-xl shadow-sm border border-slate-200 hover:shadow-md hover:border-indigo-300 transition-all duration-200 ${expanded ? 'ring-2 ring-indigo-500/20 border-indigo-300' : ''}`}>
                                    <div className="flex items-center h-6 gap-1.5 mb-2 overflow-hidden">
                                        <span className="text-[10px] font-bold uppercase tracking-wider truncate text-slate-600">{group.company}</span>
                                        {isEnterprise && <EnterpriseMark />}
                                        {groupHeaderBadge}
                                    </div>
                                    <div className="flex justify-between items-start">
                                        <div className="flex-1 min-w-0 pr-2">
                                            {/* Aligned text size/leading to match LeadCardUI body more closely */}
                                            <h4 className="font-bold text-slate-800 text-sm leading-snug mb-0.5">{group.items.length} Contacts</h4>
                                            <p className="text-xs text-slate-500 truncate">{group.items.map(i => i.Name).join(', ')}</p>
                                        </div>
                                        <div className={`text-slate-400 transition-transform mt-1 ${expanded ? 'rotate-180' : ''}`}><ChevronDown size={16} /></div>
                                    </div>
                                </button>
                                {expanded && (
                                    <div className="mt-2 ml-4 pl-3 border-l-2 border-indigo-100 animate-in fade-in slide-in-from-top-1 duration-200">
                                        {group.items.map(lead => (
                                            <DraggableLeadCard key={lead.id} lead={lead} company={companies[lead.Company]} onOpen={onOpen} duplicatesSet={duplicatesSet} showOwnerAvatar={showOwnerAvatar} />
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}

                {sortedLeads.length === 0 && (<div className="h-24 flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 rounded-xl m-2"><span className="text-xs">Empty</span></div>)}
            </div>
        </div>
    );
};

// --- EXPORTED PIPELINE BOARD ---
export const PipelineBoard = ({
    leads, companies, searchQuery, filters, duplicatesSet, ownerFilter,
    onDragEnd, onOpenLead, activeLead, setActiveId, // Added setters for full control
    // View State (Passed from App.jsx so it persists)
    focusedStage, setFocusedStage,
    columnSorts, setColumnSorts,
    columnCollapse, setColumnCollapse,
    columnScroll, setColumnScroll,
    minimizedStages, setMinimizedStages
}) => {
    const sensors = useSensors(useSensor(MouseSensor, { activationConstraint: { distance: 5 } }), useSensor(TouchSensor));

    const processedLeads = useMemo(() => {
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            return leads.filter(l => l.Name.toLowerCase().includes(q) || l.Company.toLowerCase().includes(q) || (l.Email && l.Email.toLowerCase().includes(q)));
        }
        return leads.filter(l => {
            if (ownerFilter && (l.Owner || 'Unassigned') !== ownerFilter) return false;
            if (filters.due && !isDue(l['Next Date'])) return false;
            if (filters.dup && !duplicatesSet.has(l.id)) return false;
            if (filters.beta && !toBool(l.Beta)) return false;
            if (filters.trial && !toBool(l.Trial)) return false;
            if (filters.focus && !isDue(l['Next Date']) && (l.calculatedDays || 0) >= 30 && !['Connected', 'Qualified', 'Offer'].includes(l.Stage)) return false;
            return true;
        });
    }, [leads, searchQuery, filters, duplicatesSet, ownerFilter]);

    return (
        <div className="h-full flex-1 overflow-x-auto overflow-y-hidden p-6">
            <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={onDragEnd} onDragStart={e => setActiveId(e.active.id)}>
                <div className="flex h-full w-max">
                    {(focusedStage ? [focusedStage] : ORDERED_STAGES).map(stage => (
                        <Column
                            key={stage} id={stage} title={stage}
                            leads={processedLeads.filter(l => l.Stage === stage)}
                            companies={companies} onOpen={onOpenLead} duplicatesSet={duplicatesSet}
                            onFocusToggle={s => setFocusedStage(prev => prev === s ? null : s)} isFocused={focusedStage === stage}
                            currentSort={columnSorts[stage]} onChangeSort={(s, k) => setColumnSorts(p => ({ ...p, [s]: k }))}
                            showOwnerAvatar={ownerFilter === ''} collapseMulti={!!columnCollapse[stage]} onToggleCollapse={(s) => setColumnCollapse(p => ({ ...p, [s]: !p[s] }))}
                            scrollPos={columnScroll[stage]} onScrollPosChange={(s, pos) => setColumnScroll(p => ({ ...p, [s]: pos }))}
                            isMinimized={!!minimizedStages[stage]} onToggleMinimize={() => setMinimizedStages(prev => ({ ...prev, [stage]: !prev[stage] }))}
                        />
                    ))}
                </div>
                <DragOverlay>
                    {activeLead && <LeadCardUI lead={activeLead} company={companies[activeLead.Company]} isOverlay={true} showOwnerAvatar={ownerFilter === ''} />}
                </DragOverlay>
            </DndContext>
        </div>
    );
};