import React, { useEffect, useMemo, useRef, useState } from 'react';

export type EventOption = {
    eventCode: string;
    eventName: string;
};

type Props = {
    options: EventOption[];
    initialQuery?: string;
    onSelect: (eventCode: string, eventName: string) => void;
    inputId?: string;
    placeholder?: string;
    inputWidth?: string;
    dropdownWidth?: string;
};

const EventSearch: React.FC<Props> = ({
    options,
    initialQuery,
    onSelect,
    inputId = 'event-search-input',
    placeholder = 'Enter Search',
    inputWidth = 'calc(154px + 2cm)',
    dropdownWidth = 'calc(154px + 2cm + 38px)'
}) => {
    const [query, setQuery] = useState('');
    const [open, setOpen] = useState(false);
    const [highlight, setHighlight] = useState(-1);
    const prefilledRef = useRef(false);

    useEffect(() => {
        if (typeof initialQuery !== 'string') return;
        const trimmed = initialQuery.trim();
        if (!trimmed) return;
        if (query.trim() !== '') return;
        setQuery(trimmed);
        prefilledRef.current = true;
    }, [initialQuery, query]);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return [] as EventOption[];
        return options
            .filter((opt) => opt.eventName.toLowerCase().includes(q) || opt.eventCode.toLowerCase().includes(q))
            .slice(0, 25);
    }, [options, query]);

    const choose = (opt: EventOption) => {
        setQuery(opt.eventName);
        setOpen(false);
        setHighlight(-1);
        onSelect(opt.eventCode, opt.eventName);
    };

    return (
        <div style={{ position: 'relative', maxWidth: 640, zIndex: 10060 }}>
            <input
                id={inputId}
                aria-label="Search events"
                placeholder={placeholder}
                value={query}
                onChange={(event) => {
                    setQuery(event.target.value);
                    setOpen(true);
                    setHighlight(-1);
                    prefilledRef.current = false;
                }}
                onFocus={() => {
                    if (!prefilledRef.current && filtered.length > 0) {
                        setOpen(true);
                    }
                }}
                onBlur={() => {
                    window.setTimeout(() => setOpen(false), 150);
                }}
                onKeyDown={(event) => {
                    if (!open) return;
                    if (event.key === 'ArrowDown') {
                        event.preventDefault();
                        setHighlight((prev) => Math.min(prev + 1, filtered.length - 1));
                    } else if (event.key === 'ArrowUp') {
                        event.preventDefault();
                        setHighlight((prev) => Math.max(prev - 1, 0));
                    } else if (event.key === 'Enter') {
                        if (highlight >= 0 && highlight < filtered.length) {
                            choose(filtered[highlight]);
                        } else if (filtered.length > 0) {
                            choose(filtered[0]);
                        }
                    } else if (event.key === 'Escape') {
                        setOpen(false);
                    }
                }}
                style={{
                    width: inputWidth,
                    height: '20px',
                    padding: '8px 6px',
                    boxSizing: 'border-box',
                    fontSize: '0.95rem',
                    fontWeight: 600,
                    letterSpacing: '-0.01em',
                    color: '#4b5563',
                    fontFamily: 'inherit'
                }}
            />
            {open && filtered.length > 0 && (
                <div
                    role="listbox"
                    style={{
                        position: 'absolute',
                        zIndex: 1500,
                        top: 'calc(100% + 4px)',
                        left: 0,
                        width: dropdownWidth,
                        background: '#fff',
                        border: '1px solid rgba(0,0,0,0.15)',
                        borderRadius: 4,
                        boxShadow: '0 6px 18px rgba(0,0,0,0.08)',
                        maxHeight: 240,
                        overflowY: 'auto'
                    }}
                >
                    {filtered.map((opt, idx) => (
                        <div
                            key={`${opt.eventCode}-${idx}`}
                            role="option"
                            aria-selected={highlight === idx}
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => choose(opt)}
                            onMouseEnter={() => setHighlight(idx)}
                            style={{
                                padding: '8px 10px',
                                cursor: 'pointer',
                                background: highlight === idx ? '#eef2ff' : 'transparent',
                                display: 'flex',
                                justifyContent: 'space-between',
                                gap: 8
                            }}
                        >
                            <span style={{ fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{opt.eventName}</span>
                            <span style={{ color: '#666', fontSize: 13 }}>{opt.eventCode}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default EventSearch;
