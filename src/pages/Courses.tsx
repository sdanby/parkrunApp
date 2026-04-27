import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { fetchAllResults, fetchEventSummary, fetchResults } from '../api/backendAPI';
import './ResultsTable.css';
import './Courses.css';

type CourseRecord = { [key: string]: any };

type CoursesLocationState = {
    eventCode?: string;
    eventName?: string;
    from?: string;
    returnTo?: { pathname: string; search?: string };
    sourceEvent?: {
        eventName?: string;
        eventDate?: string;
    };
};

type EventOption = {
    eventCode: string;
    eventName: string;
};

type ColumnDef = {
    key: string;
    label: string;
    align?: 'left' | 'center' | 'right';
    desktopWidth?: number;
    mobileWidth?: number;
};

type SummaryMode = 'average' | 'total' | 'maximum' | 'minimum' | 'range' | 'growth';
type PeriodQuery = 'recent' | 'last50' | 'since-lockdown' | 'all';
type CoursePanelMode = 'table' | 'profile' | 'top250';

const COURSES_VIEW_MODE_KEY = 'courses_view_mode_v1';
const COURSES_PERIOD_QUERY_KEY = 'courses_period_query_v1';

const summaryModeOptions: Array<{ value: SummaryMode; label: string }> = [
    { value: 'average', label: 'Average' },
    { value: 'total', label: 'Total' },
    { value: 'maximum', label: 'Maximum' },
    { value: 'minimum', label: 'Minimum' },
    { value: 'range', label: 'Range' },
    { value: 'growth', label: 'Growth' }
];

const periodOptions: Array<{ value: PeriodQuery; label: string }> = [
    { value: 'recent', label: 'Recent Events' },
    { value: 'last50', label: 'Last 50 Events' },
    { value: 'since-lockdown', label: 'Since Lockdown' },
    { value: 'all', label: 'All Events' }
];

const toCoursesLocationState = (value: unknown): CoursesLocationState => {
    if (!value || typeof value !== 'object') {
        return {};
    }
    const possible: any = value;
    const next: CoursesLocationState = {};
    if (typeof possible.eventCode === 'string') next.eventCode = possible.eventCode;
    if (typeof possible.eventName === 'string') next.eventName = possible.eventName;
    if (typeof possible.from === 'string') next.from = possible.from;
    if (possible.returnTo && typeof possible.returnTo === 'object' && typeof possible.returnTo.pathname === 'string') {
        next.returnTo = {
            pathname: possible.returnTo.pathname,
            search: typeof possible.returnTo.search === 'string' ? possible.returnTo.search : undefined
        };
    }
    if (possible.sourceEvent && typeof possible.sourceEvent === 'object') {
        const se: any = possible.sourceEvent;
        if (typeof se.eventName === 'string' || typeof se.eventDate === 'string') {
            next.sourceEvent = {
                eventName: typeof se.eventName === 'string' ? se.eventName : undefined,
                eventDate: typeof se.eventDate === 'string' ? se.eventDate : undefined
            };
        }
    }
    return next;
};

const pickField = (row: CourseRecord | null | undefined, keys: string[]): any => {
    if (!row) return undefined;
    for (const key of keys) {
        if (Object.prototype.hasOwnProperty.call(row, key)) {
            const value = row[key];
            if (value !== undefined && value !== null && value !== '') {
                return value;
            }
        }
    }
    return undefined;
};

const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const formatDateValue = (value: unknown): string => {
    if (value === undefined || value === null) return '';
    const raw = String(value).trim();
    const compact = (day: string, month: string, year: string) => `${day.padStart(2, '0')}${month}${year.slice(-2)}`;
    const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (iso) {
        const month = monthNames[Number(iso[2]) - 1] || iso[2];
        return compact(iso[3], month, iso[1]);
    }
    const slash = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (slash) {
        const month = monthNames[Number(slash[2]) - 1] || slash[2];
        return compact(slash[1], month, slash[3]);
    }
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) {
        const day = String(parsed.getUTCDate()).padStart(2, '0');
        const month = monthNames[parsed.getUTCMonth()] || '';
        const year = String(parsed.getUTCFullYear());
        return compact(day, month, year);
    }
    return raw;
};

const formatDateDdmmyyDash = (value: unknown): string => {
    if (value === undefined || value === null || value === '') return '';
    const raw = String(value).trim();

    const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (iso) {
        const month = monthNames[Number(iso[2]) - 1] || iso[2];
        return `${iso[3]}-${month}-${iso[1].slice(-2)}`;
    }

    const slash = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (slash) {
        const month = monthNames[Number(slash[2]) - 1] || slash[2];
        return `${slash[1]}-${month}-${slash[3].slice(-2)}`;
    }

    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) {
        const day = String(parsed.getUTCDate()).padStart(2, '0');
        const month = monthNames[parsed.getUTCMonth()] || '';
        const year = String(parsed.getUTCFullYear()).slice(-2);
        return `${day}-${month}-${year}`;
    }

    return raw;
};

const parseDateSortValue = (value: unknown): number | null => {
    if (value === undefined || value === null || value === '') return null;
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    const raw = String(value).trim();
    const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (iso) {
        const parsed = Date.parse(`${iso[1]}-${iso[2]}-${iso[3]}T00:00:00Z`);
        return Number.isNaN(parsed) ? null : parsed;
    }
    const slash = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (slash) {
        const parsed = Date.parse(`${slash[3]}-${slash[2]}-${slash[1]}T00:00:00Z`);
        return Number.isNaN(parsed) ? null : parsed;
    }
    const parsed = Date.parse(raw);
    return Number.isNaN(parsed) ? null : parsed;
};

const parseNumberValue = (value: unknown): number | null => {
    if (value === undefined || value === null || value === '') return null;
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    const cleaned = String(value).replace(/,/g, '').trim();
    if (cleaned === '') return null;
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
};

const parseMmssToSeconds = (value: unknown): number | null => {
    if (value === undefined || value === null || value === '') return null;
    const raw = String(value).trim();
    const match = raw.match(/^(\d+):(\d{1,2})$/);
    if (!match) return null;
    const minutes = Number(match[1]);
    const seconds = Number(match[2]);
    if (!Number.isFinite(minutes) || !Number.isFinite(seconds)) return null;
    return (minutes * 60) + seconds;
};

const formatMetricValue = (key: string, value: unknown): string => {
    const numberValue = parseNumberValue(value);
    if (numberValue === null) {
        return '';
    }
    if (key === 'coeff_combined') {
        let deviation = numberValue;
        if (Math.abs(deviation) >= 0.5 && Math.abs(deviation) < 3) {
            deviation = deviation - 1;
        }
        return `${(deviation * 100).toFixed(2)}%`;
    }
    if (key === 'coeff' || key === 'coeff_event') {
        const deviation = numberValue - 1;
        return `${(deviation * 100).toFixed(2)}%`;
    }
    return String(Math.round(numberValue));
};

const normalizeCombinedHardnessDeviation = (value: number): number => {
    let deviation = value;
    if (Math.abs(deviation) >= 0.5 && Math.abs(deviation) < 3) {
        deviation = deviation - 1;
    }
    return deviation;
};

const toAggregatableValue = (key: string, value: number): number => {
    if (key === 'coeff' || key === 'coeff_event') {
        return value - 1;
    }
    if (key === 'coeff_combined') {
        return normalizeCombinedHardnessDeviation(value);
    }
    return value;
};

const formatSummaryValue = (key: string, value: number | null): string => {
    if (value === null) {
        return '';
    }
    if (key === 'coeff' || key === 'coeff_event' || key === 'coeff_combined') {
        return `${(value * 100).toFixed(2)}%`;
    }
    return String(Math.round(value));
};

const normalizeCoefficient = (value: unknown): number | null => {
    const parsed = parseNumberValue(value);
    if (parsed === null) return null;
    if (Math.abs(parsed) < 0.5) {
        return 1 + parsed;
    }
    return parsed;
};

const getColumnRawValue = (row: CourseRecord, key: string): unknown => {
    if (key === 'participants') {
        return pickField(row, ['last_position', 'lastPosition', 'participants', 'participant_count', 'obs']);
    }
    if (key === 'coeff_combined') {
        const direct = pickField(row, ['coeff_combined', 'coeffCombined']);
        if (direct !== undefined && direct !== null && String(direct).trim() !== '') {
            return direct;
        }
        const coeff = normalizeCoefficient(pickField(row, ['coeff']));
        const coeffEvent = normalizeCoefficient(pickField(row, ['coeff_event', 'coeffEvent', 'coefEvent', 'coeffevent']));
        if (coeff === null || coeffEvent === null) {
            return null;
        }
        return (coeff - 1) + (coeffEvent - 1);
    }
    return pickField(row, [key]);
};

const useMediaQuery = (query: string): boolean => {
    const getMatch = () => {
        if (typeof window === 'undefined' || typeof window.matchMedia === 'undefined') {
            return false;
        }
        return window.matchMedia(query).matches;
    };
    const [matches, setMatches] = useState<boolean>(getMatch);
    useEffect(() => {
        if (typeof window === 'undefined' || typeof window.matchMedia === 'undefined') {
            return;
        }
        const mediaQueryList = window.matchMedia(query);
        const listener = () => setMatches(mediaQueryList.matches);
        listener();
        if (typeof mediaQueryList.addEventListener === 'function') {
            mediaQueryList.addEventListener('change', listener);
            return () => mediaQueryList.removeEventListener('change', listener);
        }
        mediaQueryList.addListener(listener);
        return () => mediaQueryList.removeListener(listener);
    }, [query]);
    return matches;
};

const EventSearch: React.FC<{
    options: EventOption[];
    initialQuery?: string;
    onSelect: (eventCode: string, eventName: string) => void;
}> = ({ options, initialQuery, onSelect }) => {
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
    }, [initialQuery]);

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
                id="courses-search-input"
                aria-label="Search events"
                placeholder="Enter Search"
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
                    width: 'calc(154px + 2cm)',
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
                        width: 'calc(154px + 2cm + 38px)',
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

const basicColumns: ColumnDef[] = [
    { key: 'date', label: 'Date', align: 'left', desktopWidth: 55, mobileWidth: 55 },
    { key: 'event_number', label: 'Event #', align: 'center', desktopWidth: 52, mobileWidth: 52 },
    { key: 'participants', label: 'Athletes', align: 'center', desktopWidth: 64, mobileWidth: 58 },
    { key: 'coeff_combined', label: 'Hardness', align: 'center', desktopWidth: 68, mobileWidth: 66 },
    { key: 'volunteers', label: 'Volunts', align: 'center', desktopWidth: 60, mobileWidth: 50 },
    { key: 'tourist_count', label: 'Tourists', align: 'center', desktopWidth: 60, mobileWidth:  57},
    { key: 'first_timers_count', label: '1st timers', align: 'center', desktopWidth: 64, mobileWidth: 64 },
    { key: 'pb_count', label: 'PBs', align: 'center', desktopWidth: 60, mobileWidth: 60 },
    { key: 'unknown_count', label: 'Unknowns', align: 'center', desktopWidth: 68, mobileWidth: 68 }
];

const detailedOnlyColumns: ColumnDef[] = [
    { key: 'coeff', label: 'Season Hard', align: 'center', desktopWidth: 78, mobileWidth: 78 },
    { key: 'coeff_event', label: 'Event Hard', align: 'center', desktopWidth: 76, mobileWidth: 76 },
    { key: 'super_tourist_count', label: 'Super Tourists', align: 'center', desktopWidth: 78, mobileWidth: 78 },
    { key: 'regulars', label: 'Regulars', align: 'center', desktopWidth: 64, mobileWidth: 64 },
    { key: 'returners_count', label: 'Returners', align: 'center', desktopWidth: 64, mobileWidth: 64 },
    { key: 'club_count', label: 'Clubs', align: 'center', desktopWidth: 50, mobileWidth: 50 },
    { key: 'recentbest_count', label: 'Recent Bests', align: 'center', desktopWidth: 74, mobileWidth: 74 },
    { key: 'eligible_time_count', label: 'Eligible', align: 'center', desktopWidth: 54, mobileWidth: 54 }
];

const top250Columns: ColumnDef[] = [
    { key: 'name', label: 'Participants', align: 'left', desktopWidth: 150, mobileWidth: 140 },
    { key: 'total_count', label: 'Total', align: 'center', desktopWidth: 58, mobileWidth: 52 },
    { key: 'appearances', label: 'Events', align: 'center', desktopWidth: 62, mobileWidth: 58 },
    { key: 'volunteer_count', label: 'Volunts', align: 'center', desktopWidth: 58, mobileWidth: 52 },
    { key: 'club', label: 'Club', align: 'left', desktopWidth: 120, mobileWidth: 110 },
    { key: 'best_curve_ranking_current', label: 'Cur. Rank', align: 'center', desktopWidth: 68, mobileWidth: 62 },
    { key: 'best_curve_ranking_historic', label: 'Hist Rank', align: 'center', desktopWidth: 68, mobileWidth: 62 },
    { key: 'best_curve_ranking_current_type', label: 'Rank Type', align: 'center', desktopWidth: 76, mobileWidth: 72 },
    { key: 'min_time_mmss', label: 'Best time', align: 'center', desktopWidth: 68, mobileWidth: 62 },
    { key: 'min_event_adj_mmss', label: 'Ev adj time', align: 'center', desktopWidth: 78, mobileWidth: 72 },
    { key: 'min_age_event_adj_mmss', label: 'AE adj time', align: 'center', desktopWidth: 78, mobileWidth: 72 },
    { key: 'min_age_sex_event_adj_mmss', label: 'AES adj time', align: 'center', desktopWidth: 85, mobileWidth: 78 },
    { key: 'last_run_date', label: 'Last Event', align: 'center', desktopWidth: 78, mobileWidth: 72 },
    { key: 'last_volunteer_date', label: 'Last Volunt', align: 'center', desktopWidth: 82, mobileWidth: 76 }
];

const top250SortableKeys = new Set<string>(top250Columns.map((col) => col.key));

const Courses: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const isMobile = useMediaQuery('(max-width: 640px)');
    const locationState = toCoursesLocationState(location.state ?? {});
    const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);

    const initialEventCode = locationState.eventCode || searchParams.get('event_code') || '';
    const initialEventName = locationState.eventName || searchParams.get('event_name') || '';
    const initialPanelModeParam = searchParams.get('panel');
    const initialPanelMode: CoursePanelMode = initialPanelModeParam === 'top250'
        ? 'top250'
        : initialPanelModeParam === 'profile'
            ? 'profile'
            : 'table';
    const initialTop250SortKeyParam = searchParams.get('top250_sort') || 'total_count';
    const initialTop250SortKey = top250SortableKeys.has(initialTop250SortKeyParam) ? initialTop250SortKeyParam : 'total_count';
    const initialTop250SortDirParam = searchParams.get('top250_dir');
    const initialTop250SortDir: 'asc' | 'desc' = initialTop250SortDirParam === 'asc' ? 'asc' : 'desc';
    const highlightedTop250AthleteCode = searchParams.get('highlight_athlete') || '';

    const [allRows, setAllRows] = useState<CourseRecord[]>([]);
    const [periodRows, setPeriodRows] = useState<CourseRecord[]>([]);
    const [rows, setRows] = useState<CourseRecord[]>([]);
    const [activeEventCode, setActiveEventCode] = useState<string>(initialEventCode);
    const [activeEventName, setActiveEventName] = useState<string>(initialEventName);
    const [viewMode, setViewMode] = useState<'basic' | 'detailed'>(() => {
        try {
            const stored = sessionStorage.getItem(COURSES_VIEW_MODE_KEY);
            return stored === 'detailed' ? 'detailed' : 'basic';
        } catch (_err) {
            return 'basic';
        }
    });
    const [periodQuery, setPeriodQuery] = useState<PeriodQuery>(() => {
        try {
            const stored = sessionStorage.getItem(COURSES_PERIOD_QUERY_KEY);
            if (stored === 'recent' || stored === 'last50' || stored === 'since-lockdown' || stored === 'all') {
                return stored;
            }
            return 'recent';
        } catch (_err) {
            return 'recent';
        }
    });
    const [panelMode, setPanelMode] = useState<CoursePanelMode>(initialPanelMode);
    const [sortKey, setSortKey] = useState<string>('date');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
    const [top250SortKey, setTop250SortKey] = useState<string>(initialTop250SortKey);
    const [top250SortDir, setTop250SortDir] = useState<'asc' | 'desc'>(initialTop250SortDir);
    const [summaryMode, setSummaryMode] = useState<SummaryMode>('average');
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [top250Rows, setTop250Rows] = useState<CourseRecord[]>([]);
    const [top250Loading, setTop250Loading] = useState<boolean>(false);
    const [top250Error, setTop250Error] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            try {
                setLoading(true);
                setError(null);
                const data = await fetchAllResults();
                if (cancelled) return;
                setAllRows(Array.isArray(data) ? data : []);
            } catch (err: any) {
                if (cancelled) return;
                setError(err?.message || 'Unable to load course data.');
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        load();
        return () => {
            cancelled = true;
        };
    }, []);

    const eventOptions = useMemo(() => {
        const byCode = new Map<string, EventOption>();
        allRows.forEach((row) => {
            const codeRaw = pickField(row, ['event_code', 'eventCode']);
            const nameRaw = pickField(row, ['event_name', 'eventName', 'event_display', 'eventDisplay', 'event']);
            if (codeRaw === undefined || codeRaw === null || codeRaw === '') return;
            const eventCode = String(codeRaw);
            if (!byCode.has(eventCode)) {
                byCode.set(eventCode, {
                    eventCode,
                    eventName: String(nameRaw ?? eventCode)
                });
            }
        });
        return Array.from(byCode.values()).sort((a, b) => a.eventName.localeCompare(b.eventName));
    }, [allRows]);

    useEffect(() => {
        if (!activeEventCode && activeEventName) {
            const match = eventOptions.find((opt) => opt.eventName.toLowerCase() === activeEventName.toLowerCase());
            if (match) {
                setActiveEventCode(match.eventCode);
                setActiveEventName(match.eventName);
            }
        }
    }, [activeEventCode, activeEventName, eventOptions]);

    useEffect(() => {
        if (periodQuery !== 'all') {
            return;
        }
        setPeriodRows(allRows);
    }, [periodQuery, allRows]);

    useEffect(() => {
        if (periodQuery === 'all') {
            return;
        }

        let cancelled = false;
        const loadForPeriod = async () => {
            try {
                setLoading(true);
                setError(null);

                let data: any;
                if (periodQuery === 'last50') {
                    data = await fetchResults(50);
                } else if (periodQuery === 'since-lockdown') {
                    data = await fetchResults('2021-07-24');
                } else {
                    data = await fetchResults();
                }

                if (!cancelled) {
                    setPeriodRows(Array.isArray(data) ? data : []);
                }
            } catch (err: any) {
                if (!cancelled) {
                    setError(err?.message || 'Unable to load course data for the selected period.');
                    setPeriodRows([]);
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };

        loadForPeriod();
        return () => {
            cancelled = true;
        };
    }, [periodQuery]);

    useEffect(() => {
        try {
            sessionStorage.setItem(COURSES_VIEW_MODE_KEY, viewMode);
        } catch (_err) {
            // ignore storage write failures
        }
    }, [viewMode]);

    useEffect(() => {
        try {
            sessionStorage.setItem(COURSES_PERIOD_QUERY_KEY, periodQuery);
        } catch (_err) {
            // ignore storage write failures
        }
    }, [periodQuery]);

    useEffect(() => {
        if (panelMode !== 'top250') {
            return;
        }

        const parsedEventCode = Number(activeEventCode);
        if (!Number.isInteger(parsedEventCode) || parsedEventCode < 1) {
            setTop250Rows([]);
            setTop250Error('Please select a valid event to load Top250.');
            setTop250Loading(false);
            return;
        }

        let cancelled = false;
        const loadTop250 = async () => {
            try {
                setTop250Loading(true);
                setTop250Error(null);
                const data = await fetchEventSummary(parsedEventCode, 250);
                if (!cancelled) {
                    setTop250Rows(Array.isArray(data) ? data : []);
                }
            } catch (err: any) {
                if (!cancelled) {
                    setTop250Error(err?.message || 'Unable to load Top250 data.');
                    setTop250Rows([]);
                }
            } finally {
                if (!cancelled) {
                    setTop250Loading(false);
                }
            }
        };

        loadTop250();
        return () => {
            cancelled = true;
        };
    }, [panelMode, activeEventCode]);

    useEffect(() => {
        if (!activeEventCode) {
            setRows([]);
            return;
        }
        const filtered = periodRows
            .filter((row) => String(pickField(row, ['event_code', 'eventCode']) ?? '') === String(activeEventCode))
            .filter((row) => {
                const participants = parseNumberValue(getColumnRawValue(row, 'participants'));
                if (participants === null || participants <= 0) {
                    return false;
                }
                const eventNumber = parseNumberValue(getColumnRawValue(row, 'event_number'));
                if (eventNumber !== null && eventNumber > 10000) {
                    return false;
                }
                return true;
            });
        setRows(filtered);
    }, [periodRows, activeEventCode]);

    const tableColumns = useMemo(
        () => (viewMode === 'basic' ? basicColumns : [...basicColumns, ...detailedOnlyColumns]),
        [viewMode]
    );

    const sortedRows = useMemo(() => {
        const withIndex = rows.map((row, index) => ({ row, index }));
        withIndex.sort((left, right) => {
            const leftRaw = sortKey === 'date'
                ? pickField(left.row, ['event_date', 'formatted_date', 'date'])
                : getColumnRawValue(left.row, sortKey);
            const rightRaw = sortKey === 'date'
                ? pickField(right.row, ['event_date', 'formatted_date', 'date'])
                : getColumnRawValue(right.row, sortKey);

            if (sortKey === 'date') {
                const lDate = parseDateSortValue(leftRaw) ?? Number.NEGATIVE_INFINITY;
                const rDate = parseDateSortValue(rightRaw) ?? Number.NEGATIVE_INFINITY;
                if (lDate !== rDate) {
                    return sortDir === 'asc' ? lDate - rDate : rDate - lDate;
                }
                return left.index - right.index;
            }

            const lNum = parseNumberValue(leftRaw);
            const rNum = parseNumberValue(rightRaw);
            if (lNum !== null && rNum !== null && lNum !== rNum) {
                return sortDir === 'asc' ? lNum - rNum : rNum - lNum;
            }

            const lText = String(leftRaw ?? '').toLowerCase();
            const rText = String(rightRaw ?? '').toLowerCase();
            if (lText !== rText) {
                return sortDir === 'asc' ? lText.localeCompare(rText) : rText.localeCompare(lText);
            }
            return left.index - right.index;
        });
        return withIndex.map((entry) => entry.row);
    }, [rows, sortKey, sortDir]);

    const handleSort = (columnKey: string) => {
        if (sortKey === columnKey) {
            setSortDir((prevDir) => (prevDir === 'asc' ? 'desc' : 'asc'));
            return;
        }
        setSortKey(columnKey);
        setSortDir('desc');
    };

    const selectedEventOption = useMemo(
        () => eventOptions.find((opt) => opt.eventCode === activeEventCode) ?? null,
        [eventOptions, activeEventCode]
    );

    const displayName = selectedEventOption?.eventName || activeEventName || 'Course';
    const displayCode = selectedEventOption?.eventCode || activeEventCode;
    const returnTarget = locationState.returnTo;
    const showHeader = Boolean(displayCode);
    const sourceEvent = locationState.sourceEvent || {
        eventName: searchParams.get('source_event') || undefined,
        eventDate: searchParams.get('source_date') || undefined
    };

    const isHighlightedRow = (row: CourseRecord): boolean => {
        if (!sourceEvent?.eventDate && !sourceEvent?.eventName) return false;
        const rowDate = pickField(row, ['event_date', 'formatted_date', 'date']);
        const rowEventName = pickField(row, ['event_name', 'eventName', 'event_display', 'eventDisplay', 'event']);
        const dateMatches = !sourceEvent.eventDate || (
            rowDate && formatDateValue(rowDate) === formatDateValue(sourceEvent.eventDate)
        );
        const eventMatches = !sourceEvent.eventName || (
            rowEventName && String(rowEventName).toLowerCase().includes(sourceEvent.eventName.toLowerCase())
        );
        return dateMatches && eventMatches;
    };

    const handleSelectEvent = (eventCode: string, eventName: string) => {
        setActiveEventCode(eventCode);
        setActiveEventName(eventName);
        setPanelMode('table');
        const params = new URLSearchParams();
        params.set('event_code', eventCode);
        params.set('event_name', eventName);
        navigate(`/courses?${params.toString()}`, {
            state: {
                eventCode,
                eventName,
                from: locationState.from,
                returnTo: locationState.returnTo
            }
        });
    };

    const handleBackNavigation = () => {
        if (returnTarget?.pathname) {
            navigate(`${returnTarget.pathname}${returnTarget.search ?? ''}`);
            return;
        }
        navigate('/results');
    };

    const handleOpenSingleEvent = (row: CourseRecord) => {
        const eventDate = pickField(row, ['event_date', 'formatted_date', 'date']);
        if (!displayCode || !eventDate) {
            return;
        }
        const eventNumber = pickField(row, ['event_number', 'eventNumber']);
        const params = new URLSearchParams();
        params.set('event_code', String(displayCode));
        params.set('date', String(eventDate));
        params.set('from_courses', '1');
        if (eventNumber !== undefined && eventNumber !== null && eventNumber !== '') {
            params.set('event_number', String(eventNumber));
        }

        navigate(`/races?${params.toString()}`, {
            state: {
                from: 'courses',
                returnTo: {
                    pathname: '/courses',
                    search: location.search || ''
                },
                sourceEvent: {
                    eventName: displayName,
                    eventDate: String(eventDate)
                }
            }
        });
    };

    const handleTop250AthleteOpen = (row: CourseRecord) => {
        const athleteCode = pickField(row, ['athlete_code']);
        if (!athleteCode) {
            return;
        }

        const athleteName = pickField(row, ['name']);
        const params = new URLSearchParams();
        params.set('athlete_code', String(athleteCode));
        const returnParams = new URLSearchParams(location.search || '');
        returnParams.set('panel', 'top250');
        returnParams.set('top250_sort', top250SortKey);
        returnParams.set('top250_dir', top250SortDir);
        returnParams.set('highlight_athlete', String(athleteCode));
        const returnSearch = `?${returnParams.toString()}`;

        navigate(`/athletes?${params.toString()}`, {
            state: {
                athleteCode: String(athleteCode),
                athleteName: athleteName ? String(athleteName) : undefined,
                from: 'courses',
                returnTo: {
                    pathname: '/courses',
                    search: returnSearch
                }
            }
        });
    };

    useEffect(() => {
        if (!rows.length || (!sourceEvent?.eventDate && !sourceEvent?.eventName)) {
            return;
        }
        const scrollTimeout = setTimeout(() => {
            const highlightedRow = document.querySelector('.highlighted-source-row');
            if (highlightedRow) {
                highlightedRow.scrollIntoView({
                    behavior: 'smooth',
                    block: 'center'
                });
            }
        }, 100);
        return () => clearTimeout(scrollTimeout);
    }, [rows, sourceEvent]);

    const nextPanelMode: CoursePanelMode = panelMode === 'table'
        ? 'top250'
        : panelMode === 'top250'
            ? 'profile'
            : 'table';

    const panelToggleLabel = nextPanelMode === 'top250'
        ? 'Top250'
        : nextPanelMode === 'profile'
            ? 'Profile'
            : 'Table';

    const chronologicallySortedRows = useMemo(() => {
        return [...rows].sort((left, right) => {
            const leftDate = parseDateSortValue(pickField(left, ['event_date', 'formatted_date', 'date'])) ?? Number.NEGATIVE_INFINITY;
            const rightDate = parseDateSortValue(pickField(right, ['event_date', 'formatted_date', 'date'])) ?? Number.NEGATIVE_INFINITY;
            return leftDate - rightDate;
        });
    }, [rows]);

    const getColumnWidthStyle = (col: ColumnDef): React.CSSProperties => {
        const style: React.CSSProperties = {};
        const targetWidth = isMobile
            ? (col.mobileWidth ?? col.desktopWidth)
            : (col.desktopWidth ?? col.mobileWidth);
        if (typeof targetWidth === 'number') {
            const px = `${targetWidth}px`;
            style.width = px;
            style.minWidth = px;
            style.maxWidth = px;
        }
        return style;
    };

    const summaryByColumn = useMemo(() => {
        const values = new Map<string, string>();

        tableColumns.forEach((col) => {
            if (col.key === 'date') {
                values.set(col.key, '');
                return;
            }

            const numericSeries = rows
                .map((row) => parseNumberValue(getColumnRawValue(row, col.key)))
                .filter((value): value is number => value !== null)
                .map((value) => toAggregatableValue(col.key, value));

            if (numericSeries.length === 0) {
                values.set(col.key, '');
                return;
            }

            let aggregateValue: number | null = null;
            if (summaryMode === 'average') {
                const total = numericSeries.reduce((acc, value) => acc + value, 0);
                aggregateValue = total / numericSeries.length;
            } else if (summaryMode === 'total') {
                aggregateValue = numericSeries.reduce((acc, value) => acc + value, 0);
            } else if (summaryMode === 'maximum') {
                aggregateValue = Math.max(...numericSeries);
            } else if (summaryMode === 'minimum') {
                aggregateValue = Math.min(...numericSeries);
            } else if (summaryMode === 'range') {
                aggregateValue = Math.max(...numericSeries) - Math.min(...numericSeries);
            } else if (summaryMode === 'growth') {
                const growthSeries = chronologicallySortedRows
                    .map((row) => parseNumberValue(getColumnRawValue(row, col.key)))
                    .filter((value): value is number => value !== null)
                    .map((value) => toAggregatableValue(col.key, value));

                if (growthSeries.length >= 2) {
                    aggregateValue = growthSeries[growthSeries.length - 1] - growthSeries[0];
                } else {
                    aggregateValue = null;
                }
            }

            values.set(col.key, formatSummaryValue(col.key, aggregateValue));
        });

        return values;
    }, [tableColumns, rows, summaryMode, chronologicallySortedRows]);

    const profileSummary = useMemo(() => {
        if (rows.length === 0) {
            return null;
        }
        const firstDate = formatDateValue(pickField(rows[rows.length - 1], ['event_date', 'formatted_date', 'date']));
        const lastDate = formatDateValue(pickField(rows[0], ['event_date', 'formatted_date', 'date']));
        const average = (key: string) => {
            const values = rows.map((row) => parseNumberValue(pickField(row, [key]))).filter((value): value is number => value !== null);
            if (values.length === 0) return '';
            const sum = values.reduce((acc, value) => acc + value, 0);
            return Math.round(sum / values.length);
        };

        return {
            events: rows.length,
            firstDate,
            lastDate,
            avgVolunteers: average('volunteers'),
            avgTourists: average('tourist_count'),
            avgFirstTimers: average('first_timers_count'),
            avgPbs: average('pb_count')
        };
    }, [rows]);

    const sortedTop250Rows = useMemo(() => {
        const withIndex = top250Rows.map((row, index) => ({ row, index }));

        withIndex.sort((left, right) => {
            const leftRaw = pickField(left.row, [top250SortKey]);
            const rightRaw = pickField(right.row, [top250SortKey]);

            if (top250SortKey.endsWith('_date')) {
                const lDate = parseDateSortValue(leftRaw) ?? Number.NEGATIVE_INFINITY;
                const rDate = parseDateSortValue(rightRaw) ?? Number.NEGATIVE_INFINITY;
                if (lDate !== rDate) {
                    return top250SortDir === 'asc' ? lDate - rDate : rDate - lDate;
                }
            }

            if (top250SortKey.endsWith('_mmss')) {
                const lTime = parseMmssToSeconds(leftRaw);
                const rTime = parseMmssToSeconds(rightRaw);
                if (lTime !== null && rTime !== null && lTime !== rTime) {
                    return top250SortDir === 'asc' ? lTime - rTime : rTime - lTime;
                }
            }

            const lNum = parseNumberValue(leftRaw);
            const rNum = parseNumberValue(rightRaw);
            if (lNum !== null && rNum !== null && lNum !== rNum) {
                return top250SortDir === 'asc' ? lNum - rNum : rNum - lNum;
            }

            const lText = String(leftRaw ?? '').toLowerCase();
            const rText = String(rightRaw ?? '').toLowerCase();
            if (lText !== rText) {
                return top250SortDir === 'asc' ? lText.localeCompare(rText) : rText.localeCompare(lText);
            }

            return left.index - right.index;
        });

        return withIndex.map((entry) => entry.row);
    }, [top250Rows, top250SortKey, top250SortDir]);

    const handleTop250Sort = (columnKey: string) => {
        if (top250SortKey === columnKey) {
            setTop250SortDir((prevDir) => (prevDir === 'asc' ? 'desc' : 'asc'));
            return;
        }
        setTop250SortKey(columnKey);
        setTop250SortDir('desc');
    };

    useEffect(() => {
        if (panelMode !== 'top250' || !highlightedTop250AthleteCode || top250Loading || sortedTop250Rows.length === 0) {
            return;
        }

        const scrollTimeout = window.setTimeout(() => {
            const candidates = Array.from(document.querySelectorAll<HTMLTableRowElement>('tr[data-top250-athlete-code]'));
            const highlightedRow = candidates.find(
                (row) => row.getAttribute('data-top250-athlete-code') === highlightedTop250AthleteCode
            );
            if (highlightedRow) {
                highlightedRow.scrollIntoView({
                    behavior: 'smooth',
                    block: 'center'
                });
            }
        }, 100);

        return () => window.clearTimeout(scrollTimeout);
    }, [panelMode, highlightedTop250AthleteCode, top250Loading, sortedTop250Rows]);

    return (
        <div className="page-content courses-page">
            <div className="course-header">
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.3rem', marginRight: '0.5em' }}>
                    <button
                        type="button"
                        className="courses-back-button"
                        aria-label="Back to Event analysis"
                        title="Back to Event analysis"
                        onClick={handleBackNavigation}
                        onTouchEnd={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            handleBackNavigation();
                        }}
                        style={{
                            fontSize: isMobile ? '1.35rem' : '1.2rem',
                            border: '1px solid #222',
                            borderRadius: '8px',
                            background: '#fff',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxSizing: 'border-box',
                            width: '30px',
                            height: '30px',
                            minWidth: '30px',
                            minHeight: '30px',
                            position: 'relative',
                            flexShrink: 0,
                            zIndex: 1200,
                            pointerEvents: 'auto',
                            touchAction: 'manipulation',
                            WebkitTapHighlightColor: 'transparent',
                            userSelect: 'none'
                        }}
                    >
                        &#8592;
                    </button>
                    {showHeader && (
                        <button
                            id="courses-view-toggle-btn"
                            type="button"
                            onClick={() => setPanelMode(nextPanelMode)}
                            title={`Show ${panelToggleLabel.toLowerCase()}`}
                            aria-label={`Show ${panelToggleLabel.toLowerCase()}`}
                            style={{
                                width: '1cm',
                                height: '1cm',
                                border: '1px solid #777',
                                borderRadius: '6px',
                                background: '#fff',
                                cursor: 'pointer',
                                fontSize: '0.5rem',
                                fontWeight: 700,
                                lineHeight: 1,
                                padding: 0
                            }}
                        >
                            {panelToggleLabel}
                        </button>
                    )}
                </div>
                <div className={`course-header-main ${showHeader ? 'course-header-main--selected' : 'course-header-main--search'}`}>
                    <div className="course-header-text">
                        <div className="course-header-title" title="Course Search" style={{ display: 'flex', alignItems: 'center', gap: '0.5em', overflow: 'visible' }}>
                            <EventSearch
                                options={eventOptions}
                                initialQuery={displayName}
                                onSelect={handleSelectEvent}
                            />
                        </div>
                        {showHeader && (
                            <div className="course-header-code" title="Event Code">
                                {displayCode}
                            </div>
                        )}
                        {showHeader && (
                            <div className="course-header-total-events" title="Total events recorded">
                                Total events: {rows.length}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {showHeader && loading && <p>Loading course data…</p>}
            {error && <p className="athlete-error">{error}</p>}

            {!loading && !error && showHeader && (
                <section className="course-runs-section">
                    <div style={{ display: 'flex', justifyContent: 'flex-end', margin: '0 0.3cm 0.28rem 0.3cm' }}>
                        <div className="course-view-control races-view-control" style={{ marginLeft: 0 }}>
                            <div className="races-view-control-item">
                                <label htmlFor="courses-view-select">View:</label>
                                <select
                                    id="courses-view-select"
                                    value={viewMode}
                                    onChange={(event) => setViewMode(event.target.value === 'detailed' ? 'detailed' : 'basic')}
                                    aria-label="Courses view mode"
                                >
                                    <option value="basic">Basic</option>
                                    <option value="detailed">Detailed</option>
                                </select>
                            </div>
                            <div className="races-view-control-item">
                                <label htmlFor="courses-period-select">Period:</label>
                                <select
                                    id="courses-period-select"
                                    value={periodQuery}
                                    onChange={(event) => {
                                        const value = event.target.value as PeriodQuery;
                                        setPeriodQuery(value);
                                    }}
                                    aria-label="Courses period"
                                >
                                    {periodOptions.map((option) => (
                                        <option key={option.value} value={option.value}>{option.label}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>
                    {panelMode === 'profile' ? (
                        <div
                            className="athlete-runs-table-wrapper"
                            style={{
                                background: 'transparent',
                                boxShadow: 'none',
                                border: 'none',
                                padding: 0
                            }}
                        >
                            <div
                                style={{
                                    border: '2px solid #9ca3af',
                                    borderRadius: '12px',
                                    background: '#fff',
                                    minHeight: '6cm',
                                    marginLeft: '0.3cm',
                                    marginRight: '0.3cm',
                                    overflow: 'hidden',
                                    boxShadow: '0 10px 18px rgba(15, 23, 42, 0.08)'
                                }}
                            >
                                <div
                                    style={{
                                        background: '#e5e7eb',
                                        borderBottom: '1px solid #d1d5db',
                                        padding: '0.55rem 0.8rem',
                                        textAlign: 'center',
                                        fontSize: '1.05rem',
                                        fontWeight: 700
                                    }}
                                >
                                    {displayName}
                                </div>
                                <div style={{ padding: '0.7rem 1rem 1rem 1rem' }}>
                                    {!profileSummary ? (
                                        <div style={{ color: '#6b7280', fontSize: '0.9rem' }}>No profile summary returned.</div>
                                    ) : (
                                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: isMobile ? '0.8rem' : '0.85rem' }}>
                                            <thead>
                                                <tr>
                                                    <th style={{ border: '1px solid #d1d5db', padding: '0.35rem', textAlign: 'center', background: '#f3f4f6' }}>Events</th>
                                                    <th style={{ border: '1px solid #d1d5db', padding: '0.35rem', textAlign: 'center', background: '#f3f4f6' }}>First Date</th>
                                                    <th style={{ border: '1px solid #d1d5db', padding: '0.35rem', textAlign: 'center', background: '#f3f4f6' }}>Latest Date</th>
                                                    <th style={{ border: '1px solid #d1d5db', padding: '0.35rem', textAlign: 'center', background: '#f3f4f6' }}>Avg Volunteers</th>
                                                    <th style={{ border: '1px solid #d1d5db', padding: '0.35rem', textAlign: 'center', background: '#f3f4f6' }}>Avg Tourists</th>
                                                    <th style={{ border: '1px solid #d1d5db', padding: '0.35rem', textAlign: 'center', background: '#f3f4f6' }}>Avg First Timers</th>
                                                    <th style={{ border: '1px solid #d1d5db', padding: '0.35rem', textAlign: 'center', background: '#f3f4f6' }}>Avg PBs</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                <tr>
                                                    <td style={{ border: '1px solid #d1d5db', padding: '0.35rem', textAlign: 'center' }}>{profileSummary.events}</td>
                                                    <td style={{ border: '1px solid #d1d5db', padding: '0.35rem', textAlign: 'center' }}>{profileSummary.firstDate}</td>
                                                    <td style={{ border: '1px solid #d1d5db', padding: '0.35rem', textAlign: 'center' }}>{profileSummary.lastDate}</td>
                                                    <td style={{ border: '1px solid #d1d5db', padding: '0.35rem', textAlign: 'center' }}>{profileSummary.avgVolunteers}</td>
                                                    <td style={{ border: '1px solid #d1d5db', padding: '0.35rem', textAlign: 'center' }}>{profileSummary.avgTourists}</td>
                                                    <td style={{ border: '1px solid #d1d5db', padding: '0.35rem', textAlign: 'center' }}>{profileSummary.avgFirstTimers}</td>
                                                    <td style={{ border: '1px solid #d1d5db', padding: '0.35rem', textAlign: 'center' }}>{profileSummary.avgPbs}</td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : panelMode === 'top250' ? (
                        <div className="athlete-runs-table-wrapper top250-table-wrapper">
                            {top250Loading ? (
                                <p className="course-runs-empty">Loading Top250 data…</p>
                            ) : top250Error ? (
                                <p className="athlete-error">{top250Error}</p>
                            ) : sortedTop250Rows.length > 0 ? (
                                <table className="athlete-runs-table" aria-label="Top250 event summary">
                                    <thead>
                                        <tr>
                                            {top250Columns.map((col) => {
                                                const isSorted = top250SortKey === col.key;
                                                const headerClasses = ['athlete-table-header'];
                                                if (col.key === 'name') headerClasses.push('athlete-date-header');
                                                const style: React.CSSProperties = {
                                                    ...getColumnWidthStyle(col),
                                                    textAlign: col.align ?? 'left'
                                                };
                                                return (
                                                    <th
                                                        key={col.key}
                                                        className={headerClasses.join(' ')}
                                                        onClick={() => handleTop250Sort(col.key)}
                                                        onKeyDown={(event) => {
                                                            if (event.key === 'Enter' || event.key === ' ') {
                                                                event.preventDefault();
                                                                handleTop250Sort(col.key);
                                                            }
                                                        }}
                                                        tabIndex={0}
                                                        scope="col"
                                                        aria-sort={isSorted ? (top250SortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                                                        style={style}
                                                    >
                                                        <span>{col.label}</span>
                                                        <span className="athlete-sort-indicator">{isSorted ? (top250SortDir === 'asc' ? '▲' : '▼') : ''}</span>
                                                    </th>
                                                );
                                            })}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {sortedTop250Rows.map((row, index) => {
                                            const rowKey = `${pickField(row, ['athlete_code'])}-${pickField(row, ['name'])}-${index}`;
                                            const top250AthleteCode = String(pickField(row, ['athlete_code']) ?? '');
                                            const top250IsHighlighted = Boolean(top250AthleteCode) && top250AthleteCode === highlightedTop250AthleteCode;
                                            return (
                                                <tr
                                                    key={rowKey}
                                                    data-top250-athlete-code={top250AthleteCode || undefined}
                                                    className={top250IsHighlighted ? 'top250-highlighted-row' : ''}
                                                >
                                                    {top250Columns.map((col) => {
                                                        const alignmentStyle: React.CSSProperties = {
                                                            ...getColumnWidthStyle(col),
                                                            ...(col.align ? { textAlign: col.align } : {})
                                                        };
                                                        const rawValue = pickField(row, [col.key]);
                                                        const value = (col.key === 'last_run_date' || col.key === 'last_volunteer_date')
                                                            ? formatDateDdmmyyDash(rawValue)
                                                            : String(rawValue ?? '');

                                                        if (col.key === 'name') {
                                                            return (
                                                                <th key={col.key} scope="row" className="athlete-date-cell" style={alignmentStyle}>
                                                                    <button
                                                                        type="button"
                                                                        onClick={(event) => {
                                                                            event.preventDefault();
                                                                            event.stopPropagation();
                                                                            handleTop250AthleteOpen(row);
                                                                        }}
                                                                        style={{
                                                                            border: 'none',
                                                                            background: 'none',
                                                                            padding: 0,
                                                                            margin: 0,
                                                                            color: '#0a5ad1',
                                                                            cursor: 'pointer',
                                                                            textAlign: 'left',
                                                                            font: 'inherit',
                                                                            textDecoration: 'underline'
                                                                        }}
                                                                        aria-label={`Open athlete run history for ${value}`}
                                                                    >
                                                                        {value}
                                                                    </button>
                                                                </th>
                                                            );
                                                        }

                                                        return (
                                                            <td key={col.key} style={alignmentStyle}>
                                                                {value}
                                                            </td>
                                                        );
                                                    })}
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            ) : (
                                <p className="course-runs-empty">No Top250 data returned.</p>
                            )}
                        </div>
                    ) : (
                        <div className="athlete-runs-table-wrapper course-table-wrapper">
                            {rows.length > 0 ? (
                                <>
                                    <table className="athlete-runs-table course-summary-table" aria-label="Course summary row">
                                        <tbody>
                                            <tr>
                                                {tableColumns.map((col) => {
                                                    const baseStyle = getColumnWidthStyle(col);
                                                    if (col.key === 'date') {
                                                        return (
                                                            <th key={col.key} scope="row" className="athlete-date-cell" style={baseStyle}>
                                                                <select
                                                                    value={summaryMode}
                                                                    onChange={(event) => setSummaryMode(event.target.value as SummaryMode)}
                                                                    aria-label="Summary metric"
                                                                    className="course-summary-mode-select"
                                                                >
                                                                    {summaryModeOptions.map((option) => (
                                                                        <option key={option.value} value={option.value}>{option.label}</option>
                                                                    ))}
                                                                </select>
                                                            </th>
                                                        );
                                                    }
                                                    return (
                                                        <td key={col.key} style={{ ...baseStyle, textAlign: col.align ?? 'left' }}>
                                                            {summaryByColumn.get(col.key) || ''}
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        </tbody>
                                    </table>

                                    <table className="athlete-runs-table">
                                        <thead>
                                            <tr>
                                                {tableColumns.map((col) => {
                                                    const isSorted = sortKey === col.key;
                                                    const headerClasses = ['athlete-table-header'];
                                                    if (col.key === 'date') headerClasses.push('athlete-date-header');
                                                    const style: React.CSSProperties = {
                                                        ...getColumnWidthStyle(col),
                                                        textAlign: col.align ?? 'left'
                                                    };
                                                    return (
                                                        <th
                                                            key={col.key}
                                                            className={headerClasses.join(' ')}
                                                            onClick={() => handleSort(col.key)}
                                                            onKeyDown={(event) => {
                                                                if (event.key === 'Enter' || event.key === ' ') {
                                                                    event.preventDefault();
                                                                    handleSort(col.key);
                                                                }
                                                            }}
                                                            tabIndex={0}
                                                            scope="col"
                                                            aria-sort={isSorted ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                                                            style={style}
                                                        >
                                                            <span>{col.label}</span>
                                                            <span className="athlete-sort-indicator">{isSorted ? (sortDir === 'asc' ? '▲' : '▼') : ''}</span>
                                                        </th>
                                                    );
                                                })}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {sortedRows.map((row, index) => {
                                                const rowKey = `${pickField(row, ['event_code', 'eventCode'])}-${pickField(row, ['event_date', 'formatted_date', 'date'])}-${index}`;
                                                const rowIsHighlighted = isHighlightedRow(row);
                                                return (
                                                    <tr
                                                        key={rowKey}
                                                        className={rowIsHighlighted ? 'highlighted-source-row course-clickable-row' : 'course-clickable-row'}
                                                        onClick={() => handleOpenSingleEvent(row)}
                                                        onKeyDown={(event) => {
                                                            if (event.key === 'Enter' || event.key === ' ') {
                                                                event.preventDefault();
                                                                handleOpenSingleEvent(row);
                                                            }
                                                        }}
                                                        tabIndex={0}
                                                        role="button"
                                                        aria-label="Open single event"
                                                    >
                                                        {tableColumns.map((col) => {
                                                            const alignmentStyle: React.CSSProperties = {
                                                                ...getColumnWidthStyle(col),
                                                                ...(col.align ? { textAlign: col.align } : {})
                                                            };

                                                            const rawValue = col.key === 'date'
                                                                ? pickField(row, ['event_date', 'formatted_date', 'date'])
                                                                : getColumnRawValue(row, col.key);
                                                            const value = col.key === 'date'
                                                                ? formatDateValue(rawValue)
                                                                : formatMetricValue(col.key, rawValue);

                                                            if (col.key === 'date') {
                                                                return (
                                                                    <th key={col.key} scope="row" className="athlete-date-cell" style={alignmentStyle}>
                                                                        {value}
                                                                    </th>
                                                                );
                                                            }

                                                            return (
                                                                <td key={col.key} style={alignmentStyle}>
                                                                    {value}
                                                                </td>
                                                            );
                                                        })}
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </>
                            ) : (
                                <p className="course-runs-empty">No run data returned for this event.</p>
                            )}
                        </div>
                    )}
                </section>
            )}
        </div>
    );
};

export default Courses;