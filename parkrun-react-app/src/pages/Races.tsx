/*
    LEGACY PAGE (retiring): `Races.tsx`
    Active replacement: `EventTest.tsx`.
    Use the replacement page for new feature work and behavior changes.
    Keep this page functional for now because some legacy links/routes may still land here.
*/
import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { fetchEventPositions, fetchEventInfo, fetchEventByNumber, fetchEventOptions, fetchEventTimeAdjustment } from '../api/backendAPI';
import EventSearch, { type EventOption } from '../components/EventSearch';
import { getEventColumnsForView, getEventTableColumnByKey } from '../config/layout/eventsLayoutHelper';
import { getEventElementById } from '../config/layout/eventsLayoutHelper';
import { navigateBackWithNavStack, navigateWithNavStack } from '../utils/navigationStack';
import { requestUnifiedHelp } from './UnifiedHelp';
import './ResultsTable.css';

type CourseAdjOption = 'none' | 'seasonal' | 'full';
type OtherAdjOption = 'none' | 'age' | 'sex' | 'age_sex';
type SelectOptionConfig = {
    value: string;
    label: string;
};
type LegacyEventViewport = 'laptop' | 'mobile';

const LEGACY_COMPACT_BREAKPOINT_PX = 900;
const RACES_COL_WIDTHS_STORAGE_KEY = 'races_col_widths_v3';

const widthSpecToPixels = (widthSpec: string | undefined, fallback: number): number => {
    const raw = String(widthSpec || '').trim().toLowerCase();
    if (!raw) return fallback;

    const numeric = Number.parseFloat(raw);
    if (!Number.isFinite(numeric)) return fallback;
    if (raw.endsWith('cm')) return Math.round(numeric * 37.7952755906);
    if (raw.endsWith('rem')) return Math.round(numeric * 16);
    if (raw.endsWith('px')) return Math.round(numeric);

    return Math.round(numeric);
};

const getLegacyEventViewport = (screenWidth: number): LegacyEventViewport =>
    screenWidth <= LEGACY_COMPACT_BREAKPOINT_PX ? 'mobile' : 'laptop';

const getConfiguredEventColumnWidthPx = (
    columnKey: string,
    viewport: LegacyEventViewport,
    fallback: number
): number => widthSpecToPixels(getEventTableColumnByKey(columnKey)?.[viewport]?.width, fallback);

const toLegacyColumnConfig = (columnKey: string) => {
    const column = getEventTableColumnByKey(columnKey);
    return {
        k: columnKey,
        label: String(column?.headerName || columnKey)
    };
};

const buildSelectOptionConfigs = (
    configuredOptions: string[] | undefined,
    values: readonly string[],
    fallbackLabels: readonly string[]
): SelectOptionConfig[] => values.map((value, index) => ({
    value,
    label: String(configuredOptions?.[index] || fallbackLabels[index] || value)
}));

const adjustmentColumnMatrix: Record<CourseAdjOption, Record<OtherAdjOption, string[]>> = {
    none: {
        none: [],
        age: ['age_adj_time'],
        sex: ['sex_adj_time'],
        age_sex: ['age_sex_adj_time']
    },
    seasonal: {
        none: ['season_adj_time'],
        age: ['age_adj_time'],
        sex: ['sex_adj_time'],
        age_sex: ['age_sex_adj_time']
    },
    full: {
        none: ['event_adj_time'],
        age: ['age_event_adj_time'],
        sex: ['sex_event_adj_time'],
        age_sex: ['age_sex_event_adj_time']
    }
};

const getAdjustmentKeys = (course: CourseAdjOption, other: OtherAdjOption): string[] => {
    const courseMap = adjustmentColumnMatrix[course];
    if (!courseMap) return [];
    return courseMap[other] ?? [];
};

const normalizeCourseAdj = (val: string): CourseAdjOption => {
    if (val === 'seasonal' || val === 'full') return val;
    return 'none';
};

const normalizeOtherAdj = (val: string): OtherAdjOption => {
    if (val === 'age' || val === 'sex' || val === 'age_sex') return val;
    return 'none';
};

const sanitizeAdjustmentSelection = (
    course: CourseAdjOption,
    other: OtherAdjOption,
    changed: 'course' | 'other' | 'hydrate'
): { courseAdj: CourseAdjOption; otherAdj: OtherAdjOption } => {
    if (course !== 'seasonal' || other === 'none') {
        return { courseAdj: course, otherAdj: other };
    }

    if (changed === 'other') {
        return { courseAdj: 'none', otherAdj: other };
    }

    return { courseAdj: course, otherAdj: 'none' };
};

const parseNumeric = (value: any): number | null => {
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
};

const formatHardnessPercent = (value: number | null): string => {
    if (value === null || !Number.isFinite(value)) return 'N/A';
    const percentValue = Math.abs(value) <= 1 ? value * 100 : value;
    return `${percentValue.toFixed(2)}%`;
};

const parseTimeToSeconds = (value: any): number | null => {
    if (value === null || value === undefined || value === '') return null;
    if (typeof value === 'number' && Number.isFinite(value)) return value;

    const raw = String(value).trim();
    if (!raw) return null;
    if (/^-?\d+(?:\.\d+)?$/.test(raw)) {
        const numeric = Number(raw);
        return Number.isFinite(numeric) ? numeric : null;
    }

    const parts = raw.split(':').map((part) => Number(part));
    if (parts.some((part) => Number.isNaN(part))) return null;
    if (parts.length === 2) {
        return (parts[0] * 60) + parts[1];
    }
    if (parts.length === 3) {
        return (parts[0] * 3600) + (parts[1] * 60) + parts[2];
    }
    return null;
};

const getDefaultWidthsBase = (viewport: LegacyEventViewport): number[] => [
    getConfiguredEventColumnWidthPx('position', viewport, 60),
    getConfiguredEventColumnWidthPx('athlete', viewport, 220),
    getConfiguredEventColumnWidthPx('time', viewport, viewport === 'mobile' ? 60 : 80),
    getConfiguredEventColumnWidthPx('age_group', viewport, viewport === 'mobile' ? 70 : 100),
    getConfiguredEventColumnWidthPx('age_grade', viewport, viewport === 'mobile' ? 70 : 100),
    getConfiguredEventColumnWidthPx('best_curve_ranking_current', viewport, viewport === 'mobile' ? 60 : 80),
    getConfiguredEventColumnWidthPx('club', viewport, viewport === 'mobile' ? 130 : 180),
    getConfiguredEventColumnWidthPx('comment', viewport, viewport === 'mobile' ? 90 : 180)
];

// Minimal Races page — shows the selected event/date (from query) and attempts to fetch event positions
const Races: React.FC = () => {
    const navigate = useNavigate();
    const [rows, setRows] = useState<any[] | null>(null);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const location = useLocation();
    const containerRef = useRef<HTMLDivElement | null>(null);
    const tableRef = useRef<HTMLTableElement | null>(null);
    // Column widths in pixels for each table column (Pos, Athlete, ...)
    // Start with sensible defaults; we'll expand when switching to Detailed view.
    const [colWidths, setColWidths] = useState<Array<number | null>>(() => {
        try {
            const saved = sessionStorage.getItem(RACES_COL_WIDTHS_STORAGE_KEY);
            if (saved) return JSON.parse(saved);
        } catch (e) { /* ignore */ }
        return [];
    });
    const [viewMode, setViewMode] = useState<'basic' | 'detailed' | 'allTimeAdjustments' | 'eventRanks'>(() => {
        try {
            const stored = sessionStorage.getItem('races_view_mode');
            if (stored === 'detailed' || stored === 'allTimeAdjustments' || stored === 'eventRanks') return stored;
            return 'basic';
        } catch (_err) {
            return 'basic';
        }
    });
    const [courseAdj, setCourseAdj] = useState<CourseAdjOption>('none');
    const [otherAdj, setOtherAdj] = useState<OtherAdjOption>('none');
        const courseAdjSelectElement = getEventElementById('event.courseAdjSelect');
        const otherAdjSelectElement = getEventElementById('event.otherAdjSelect');
    const adjustmentKeys = useMemo(() => getAdjustmentKeys(courseAdj, otherAdj), [courseAdj, otherAdj]);
    const adjustmentsActive = courseAdj !== 'none' || otherAdj !== 'none';
        const courseAdjOptions = useMemo(
            () => buildSelectOptionConfigs(
                Array.isArray((courseAdjSelectElement as any)?.options) ? (courseAdjSelectElement as any).options : undefined,
                ['none', 'seasonal', 'full'] as const,
                ['no adjustment', 'seasonal adj.', 'full event adj.'] as const
            ),
            [courseAdjSelectElement]
        );
        const otherAdjOptions = useMemo(
            () => buildSelectOptionConfigs(
                Array.isArray((otherAdjSelectElement as any)?.options) ? (otherAdjSelectElement as any).options : undefined,
                ['none', 'age', 'sex', 'age_sex'] as const,
                ['no adjustment', 'age adj.', 'sex adj.', 'age & sex adj.'] as const
            ),
            [otherAdjSelectElement]
        );
    const ensureBasicViewForAdjustments = (nextCourse: CourseAdjOption, nextOther: OtherAdjOption) => {
        if ((nextCourse !== 'none' || nextOther !== 'none') && viewMode !== 'basic') {
            setViewMode('basic');
        }
    };
    const handleViewModeChange = (nextMode: 'basic' | 'detailed' | 'allTimeAdjustments' | 'eventRanks') => {
        if (nextMode !== 'basic') {
            if (courseAdj !== 'none') setCourseAdj('none');
            if (otherAdj !== 'none') setOtherAdj('none');
        }
        setViewMode(nextMode);
    };
    const handleCourseAdjChange = (value: CourseAdjOption) => {
        const nextAdjustments = sanitizeAdjustmentSelection(value, otherAdj, 'course');
        setCourseAdj(nextAdjustments.courseAdj);
        setOtherAdj(nextAdjustments.otherAdj);
        ensureBasicViewForAdjustments(nextAdjustments.courseAdj, nextAdjustments.otherAdj);
    };
    const handleOtherAdjChange = (value: OtherAdjOption) => {
        const nextAdjustments = sanitizeAdjustmentSelection(courseAdj, value, 'other');
        setCourseAdj(nextAdjustments.courseAdj);
        setOtherAdj(nextAdjustments.otherAdj);
        ensureBasicViewForAdjustments(nextAdjustments.courseAdj, nextAdjustments.otherAdj);
    };
    const handleAthleteNavigate = (row: any) => {
        const athleteCode = row?.athlete_code ?? row?.athleteCode;
        const athleteName = row?.name ?? row?.athlete_name;
        if (!athleteCode) {
            return;
        }
        const params = new URLSearchParams();
        params.set('athlete_code', String(athleteCode));
        
        // Add source event information for row highlighting  
        const sourceEventName = eventInfo?.event_name;
        const sourceEventDate = resolvedDateDisplay || date;
        if (sourceEventName) {
            params.set('source_event', sourceEventName);
        }
        if (sourceEventDate) {
            params.set('source_date', sourceEventDate);
        }
        
        navigateWithNavStack(navigate, location, `/athletes?${params.toString()}`, {
            state: {
                athleteCode: String(athleteCode),
                athleteName: athleteName ? String(athleteName) : undefined,
                from: 'races',
                returnTo: {
                    pathname: '/races',
                    search: location.search || ''
                },
                sourceEvent: {
                    eventName: sourceEventName,
                    eventDate: sourceEventDate
                }
            }
        });
    };
    const handleClubNavigate = (clubRaw: unknown) => {
        const club = String(clubRaw ?? '').trim();
        if (!club || club.toLowerCase() === '<no club>') {
            return;
        }

        const params = new URLSearchParams();
        params.set('club', club);

        navigateWithNavStack(navigate, location, `/clubs?${params.toString()}`, {
            state: {
                returnTo: {
                    pathname: '/races',
                    search: location.search || ''
                }
            }
        });
    };
    const onCourseAdjSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
        handleCourseAdjChange(normalizeCourseAdj(e.target.value));
    };
    const onOtherAdjSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
        handleOtherAdjChange(normalizeOtherAdj(e.target.value));
    };
    const resizingColRef = useRef<number | null>(null);
    const startXRef = useRef<number | null>(null);
    const startWidthRef = useRef<number | null>(null);
    // Sorting state
    const [sortKey, setSortKey] = useState<string | null>(null);
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
    const [isCompactViewport, setIsCompactViewport] = useState<boolean>(() => {
        if (typeof window === 'undefined') return false;
        return window.innerWidth <= LEGACY_COMPACT_BREAKPOINT_PX;
    });

    useEffect(() => {
        const updateViewportMode = () => {
            setIsCompactViewport(window.innerWidth <= LEGACY_COMPACT_BREAKPOINT_PX);
        };

        updateViewportMode();
        window.addEventListener('resize', updateViewportMode);
        window.addEventListener('orientationchange', updateViewportMode);

        return () => {
            window.removeEventListener('resize', updateViewportMode);
            window.removeEventListener('orientationchange', updateViewportMode);
        };
    }, []);

    const layoutViewport: LegacyEventViewport = isCompactViewport ? 'mobile' : 'laptop';
    const defaultWidthsBase = useMemo(() => getDefaultWidthsBase(layoutViewport), [layoutViewport]);

    const snakeToCamel = useCallback((s: string) => s.replace(/_(.)/g, (_m, g1) => g1.toUpperCase()), []);
    const getSortValue = useCallback((row: any, key: string) => {
        if (!row) return null;
        let v = row[key];
        if (v === undefined) v = row[snakeToCamel(key)];
        if (v === null || v === undefined) return null;
        if (typeof v === 'number') return v;
        const s = String(v).trim();
        // numeric?
        if (/^-?\d+(?:\.\d+)?$/.test(s)) return Number(s);
        return s.toLowerCase();
    }, [snakeToCamel]);

    const handleSort = (key: string) => {
        if (sortKey === key) {
            setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortKey(key);
            setSortDir('asc');
        }
    };

    const sortedRows = useMemo(() => {
        if (!rows || !sortKey) return rows;
        const copy = (Array.isArray(rows) ? rows.slice() : []);
        copy.sort((a, b) => {
            const va = getSortValue(a, sortKey);
            const vb = getSortValue(b, sortKey);
            if (va === null && vb === null) return 0;
            if (va === null) return 1;
            if (vb === null) return -1;
            if (typeof va === 'number' && typeof vb === 'number') {
                return sortDir === 'asc' ? (va - vb) : (vb - va);
            }
            const sa = String(va);
            const sb = String(vb);
            if (sa < sb) return sortDir === 'asc' ? -1 : 1;
            if (sa > sb) return sortDir === 'asc' ? 1 : -1;
            return 0;
        });
        return copy;
    }, [getSortValue, rows, sortKey, sortDir]);

    // Column resize handlers
    const onColResizerMouseDown = (e: React.MouseEvent, colIndex: number) => {
        e.preventDefault();
        resizingColRef.current = colIndex;
        startXRef.current = e.clientX;
        startWidthRef.current = colWidths[colIndex] ?? defaultWidthsBase[colIndex] ?? 100;
        document.addEventListener('mousemove', onColResizerMouseMove);
        document.addEventListener('mouseup', onColResizerMouseUp);
    };

    const onColResizerMouseMove = useCallback((e: MouseEvent) => {
        const col = resizingColRef.current;
        if (col === null) return;
        const startX = startXRef.current ?? e.clientX;
        const startW = startWidthRef.current ?? (colWidths[col] ?? defaultWidthsBase[col]);
        const dx = e.clientX - startX;
        //const newW = Math.max(40, Math.round(startW + dx));
        const newW = Math.max(40, Math.round(startW + dx));
        setColWidths(prev => {
            const copy = prev.slice();
            copy[col] = newW;
            return copy;
        });
    }, [colWidths]);

    const onColResizerMouseUp = useCallback((_e: MouseEvent) => {
        resizingColRef.current = null;
        startXRef.current = null;
        startWidthRef.current = null;
        document.removeEventListener('mousemove', onColResizerMouseMove);
        document.removeEventListener('mouseup', onColResizerMouseUp);
    }, [onColResizerMouseMove]);

    // Ensure any global listeners are removed on unmount
    useEffect(() => {
        return () => {
            try {
                document.removeEventListener('mousemove', onColResizerMouseMove);
                document.removeEventListener('mouseup', onColResizerMouseUp);
            } catch (e) {}
        };
    }, [onColResizerMouseMove, onColResizerMouseUp]);

    // Persist column widths when they change
    useEffect(() => {
        try { sessionStorage.setItem(RACES_COL_WIDTHS_STORAGE_KEY, JSON.stringify(colWidths)); } catch (e) { /* ignore */ }
    }, [colWidths]);

    const params = new URLSearchParams(location.search);
    const date = params.get('date') || '';
    // Accept either `event` (legacy) or `event_code` (explicit) as the identifier
    const rawEventParam = params.get('event') || params.get('event_code') || '';
    // Accept an explicit event_number param so the page can display the
    // event number and show the ▲/▼ controls even when navigation used
    // `event_code`/`event_number` query params.
    const paramEventNumberRaw = params.get('event_number') || params.get('eventNumber') || null;
    const paramEventNumber = paramEventNumberRaw ? Number(paramEventNumberRaw) : null;
    // Get athlete code for highlighting if coming from Athletes table
    const highlightAthleteCode = params.get('highlight_athlete') || '';
    const [eventInfo, setEventInfo] = useState<{
        event_name?: string;
        event_number?: number;
        event_code?: number;
        coeff?: number;
        coeff_event?: number;
        coeffCombined?: number;
        coeff_combined?: number;
        coeffEvent?: number;
    } | null>(null);
    const [navLoading, setNavLoading] = useState<boolean>(false);
    const [eventOptions, setEventOptions] = useState<EventOption[]>([]);
    const [headerCourseEditMode, setHeaderCourseEditMode] = useState<boolean>(false);
    const headerCourseHoverTimerRef = useRef<number | null>(null);
    // If the URL doesn't include a `date`, we may resolve it from
    // `event_code` + `event_number` via the backend. Store the resolved
    // display date here (DD/MM/YYYY) so the header can show it.
    const [resolvedDateDisplay, setResolvedDateDisplay] = useState<string | null>(null);

    const clearHeaderCourseHoverTimer = useCallback(() => {
        if (headerCourseHoverTimerRef.current !== null) {
            window.clearTimeout(headerCourseHoverTimerRef.current);
            headerCourseHoverTimerRef.current = null;
        }
    }, []);

    useEffect(() => {
        if (!highlightAthleteCode) return;
        const timer = window.setTimeout(() => {
            const row = document.querySelector('tr.highlighted-athlete-row') as HTMLElement | null;
            if (row) {
                row.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }, 120);
        return () => window.clearTimeout(timer);
    }, [highlightAthleteCode, sortedRows]);

    useEffect(() => {
        let cancelled = false;

        const loadEventOptions = async () => {
            try {
                const loaded = await fetchEventOptions();
                if (!cancelled) {
                    setEventOptions(Array.isArray(loaded) ? loaded : []);
                }
            } catch {
                if (!cancelled) {
                    setEventOptions([]);
                }
            }
        };

        void loadEventOptions();
        return () => {
            cancelled = true;
            clearHeaderCourseHoverTimer();
        };
    }, [clearHeaderCourseHoverTimer]);

    useEffect(() => {
    if (!rawEventParam && !date) return;

    const load = async () => {
        setLoading(true);
        setError(null);
        setEventInfo(null);
        setResolvedDateDisplay(null);

        try {
        // Resolve the DD/MM/YYYY date string expected by the backend
        let apiDate: string | null = date;
        if (apiDate && /^\d{4}-\d{2}-\d{2}$/.test(apiDate)) {
            const [yyyy, mm, dd] = apiDate.split('-');
            apiDate = `${dd}/${mm}/${yyyy}`;
        }

        if (!apiDate && rawEventParam && paramEventNumber) {
            try {
            const info = await fetchEventByNumber(Number(rawEventParam), Number(paramEventNumber));
            if (info?.event_date) {
                const d = String(info.event_date);
                if (/^\d{2}\/\d{2}\/\d{4}$/.test(d)) {
                apiDate = d;
                setResolvedDateDisplay(d);
                } else if (/^\d{4}-\d{2}-\d{2}$/.test(d)) {
                const [yyyy, mm, dd] = d.split('-');
                apiDate = `${dd}/${mm}/${yyyy}`;
                setResolvedDateDisplay(`${dd}/${mm}/${yyyy}`);
                } else {
                apiDate = d;
                setResolvedDateDisplay(d);
                }
            }
            } catch (err) {
            console.warn('fetchEventByNumber failed', err);
            }
        }

        if (!apiDate) throw new Error('Event date is unknown — cannot load event positions');

        const positionsPromise = fetchEventPositions(rawEventParam, apiDate);
        const needsAdjustmentData = true;
        const adjustmentsPromise = fetchEventTimeAdjustment(rawEventParam, apiDate).catch((adjustErr) => {
            console.warn('fetchEventTimeAdjustment failed (optional):', adjustErr);
            return null;
        });

        const [positionsRaw, adjustmentsRaw] = await Promise.all([positionsPromise, adjustmentsPromise]);

        

        const baseRows = Array.isArray(positionsRaw) ? positionsRaw : [];

        const mergedRows =
            needsAdjustmentData && Array.isArray(adjustmentsRaw)
            ? (() => {
                const key = (athleteCode?: any, time?: any) => `${athleteCode ?? ''}__${time ?? ''}`;
                const adjMap = new Map(
                    adjustmentsRaw.map((row: any) => [key(row.athlete_code, row.time), row])
                );
                return baseRows.map((row) => {
                    const adj = adjMap.get(key(row.athlete_code, row.time));
                    const merged = adj ? { ...row, ...adj } : { ...row };

                    const baseRank = row?.best_curve_ranking_current ?? row?.bestCurveRankingCurrent ?? row?.rank;
                    const mergedRank = merged?.best_curve_ranking_current ?? merged?.bestCurveRankingCurrent ?? merged?.rank;
                    if ((mergedRank === null || mergedRank === undefined || mergedRank === '') && baseRank !== null && baseRank !== undefined && baseRank !== '') {
                        merged.best_curve_ranking_current = baseRank;
                    }

                    return merged;
                });
                })()
            : baseRows;

        setRows(mergedRows);

        try {
            const info = await fetchEventInfo(rawEventParam, apiDate);
            setEventInfo(info && typeof info === 'object' ? info : null);
        } catch (infoErr) {
            console.warn('fetchEventInfo failed (optional):', infoErr);
        }
        } catch (err) {
        console.error('[Races] load failed:', err);
        setError('Failed to fetch event positions — backend may not support this endpoint');
        setRows(null);
        } finally {
        setLoading(false);
        }
    };

    load();
    }, [rawEventParam, date, paramEventNumber, adjustmentKeys]);

    useEffect(() => {
        if (adjustmentsActive && viewMode !== 'basic') {
            setViewMode('basic');
        }
    }, [adjustmentsActive, viewMode]);

    // derive a friendly event name and number from fetched rows or the eventInfo API
    // If the identifier query param is numeric, don't show it as the event name
    const isNumericIdentifier = (s: string) => /^[0-9]+$/.test(String(s || '').trim());
    const eventName = (eventInfo && eventInfo.event_name)
        ? eventInfo.event_name
        : ((rows && rows.length > 0 && (rows[0].event_name || rows[0].eventName))
            ? (rows[0].event_name || rows[0].eventName)
            : (isNumericIdentifier(rawEventParam) ? '' : (rawEventParam || '')));
    // Prefer an explicit `event_number` query param when present because it
    // represents the navigation intent (e.g. `/races?event_code=1&event_number=472`).
    // Otherwise fall back to fetched `eventInfo` or the rows returned by the API.
    let eventNumberVal: number | null = null;
    if (paramEventNumber !== null) {
        eventNumberVal = paramEventNumber;
    } else {
        eventNumberVal = (eventInfo && eventInfo.event_number)
            ? eventInfo.event_number
            : ((rows && rows.length > 0) ? (rows[0].event_number ?? rows[0].eventNumber ?? null) : null);
    }

    // Keep any numeric event_code in a separate variable so we can display
    // it as a code (e.g. "code 3") rather than misstating it as an event_number.
    let eventCodeVal: number | null = null;
    // If we don't have a true event_number, try to read an event_code from
    // the fetched rows or the query param but don't assign it to
    // `eventNumberVal`.
    if (eventNumberVal === null || eventNumberVal === undefined) {
        if (rows && rows.length > 0) {
            const possibleCode = rows[0].event_code ?? rows[0].eventCode ?? null;
            if (possibleCode !== null && possibleCode !== undefined && possibleCode !== '') {
                const n = Number(possibleCode);
                if (!Number.isNaN(n)) eventCodeVal = n;
            }
        }
        if (eventCodeVal === null && isNumericIdentifier(rawEventParam)) {
            const n = Number(rawEventParam);
            if (!Number.isNaN(n)) eventCodeVal = n;
        }
    }

    const startHeaderCourseHoverTimer = () => {
        if (headerCourseEditMode || !String(eventName || '').trim()) {
            return;
        }

        clearHeaderCourseHoverTimer();
        headerCourseHoverTimerRef.current = window.setTimeout(() => {
            setHeaderCourseEditMode(true);
            headerCourseHoverTimerRef.current = null;
        }, 2000);
    };

    const displayDate = (() => {
        // Prefer a resolved date (from fetchEventByNumber) if available.
        if (resolvedDateDisplay) return resolvedDateDisplay;
        if (!date) return '';
        if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            const p = date.split('-');
            return `${p[2]}/${p[1]}/${p[0]}`;
        }
        return date;
    })();

    const handleHeaderCourseNavigate = () => {
        const selectedEventCode = isNumericIdentifier(rawEventParam)
            ? String(rawEventParam)
            : ((eventInfo?.event_code !== undefined && eventInfo?.event_code !== null)
                ? String(eventInfo.event_code)
                : (eventCodeVal !== null && eventCodeVal !== undefined ? String(eventCodeVal) : ''));
        const selectedEventName = String(eventName || '').trim();

        if (!selectedEventCode && !selectedEventName) {
            return;
        }

        const params = new URLSearchParams();
        if (selectedEventCode) {
            params.set('event_code', selectedEventCode);
        }
        if (selectedEventName) {
            params.set('event_name', selectedEventName);
        }

        navigateWithNavStack(navigate, location, `/courses?${params.toString()}`, {
            state: {
                eventCode: selectedEventCode || undefined,
                eventName: selectedEventName || undefined,
                from: 'races',
                returnTo: {
                    pathname: '/races',
                    search: location.search || ''
                }
            }
        });
    };

    const handleHeaderCourseSelect = (selectedEventCode: string, selectedEventName: string) => {
        clearHeaderCourseHoverTimer();
        setHeaderCourseEditMode(false);

        if (!selectedEventCode && !selectedEventName) {
            return;
        }

        const params = new URLSearchParams();
        if (selectedEventCode) {
            params.set('event_code', selectedEventCode);
        }
        if (selectedEventName) {
            params.set('event_name', selectedEventName);
        }

        navigateWithNavStack(navigate, location, `/courses?${params.toString()}`, {
            state: {
                eventCode: selectedEventCode || undefined,
                eventName: selectedEventName || undefined,
                from: 'races',
                returnTo: {
                    pathname: '/races',
                    search: location.search || ''
                }
            }
        });
    };

    const combinedHardnessRaw = (() => {
        if (rows && rows.length > 0) {
            const adjustments = rows
                .map((row: any) => {
                    const rawTime = row?.time ?? row?.time_seconds ?? row?.timeSeconds;
                    const rawEventAdj = row?.event_adj_time ?? row?.eventAdjTime;
                    const timeSeconds = parseTimeToSeconds(rawTime);
                    const eventAdjSeconds = parseTimeToSeconds(rawEventAdj);
                    if (timeSeconds === null || eventAdjSeconds === null || eventAdjSeconds === 0) {
                        return null;
                    }
                    return (timeSeconds / eventAdjSeconds) - 1;
                })
                .filter((value): value is number => value !== null && Number.isFinite(value));

            if (adjustments.length > 0) {
                return adjustments.reduce((sum, value) => sum + value, 0) / adjustments.length;
            }
        }

        const fromInfoCombined = parseNumeric(eventInfo?.coeff_combined ?? eventInfo?.coeffCombined);
        if (fromInfoCombined !== null) return fromInfoCombined;

        const infoCoeff = parseNumeric(eventInfo?.coeff);
        const infoCoeffEvent = parseNumeric(eventInfo?.coeff_event ?? eventInfo?.coeffEvent);
        if (infoCoeff !== null && infoCoeffEvent !== null) return infoCoeff + infoCoeffEvent;

        if (rows && rows.length > 0) {
            const first = rows[0] || {};
            const rowCombined = parseNumeric(first.coeff_combined ?? first.coeffCombined);
            if (rowCombined !== null) return rowCombined;

            const rowCoeff = parseNumeric(first.coeff);
            const rowCoeffEvent = parseNumeric(first.coeff_event ?? first.coeffEvent);
            if (rowCoeff !== null && rowCoeffEvent !== null) return rowCoeff + rowCoeffEvent;
        }

        return null;
    })();
    const combinedHardnessDisplay = formatHardnessPercent(combinedHardnessRaw);
    

    // Change event number by delta (-1 or +1). Will look up the date for the
    // requested event number for the same event_code, then navigate/update.
    const changeEventNumber = async (delta: number) => {
        // Determine event_code to operate on
        const code = (eventInfo && eventInfo.event_code) ? Number(eventInfo.event_code) : (eventCodeVal ?? null);
        const currentNumber = eventNumberVal ? Number(eventNumberVal) : null;
        if (!code) {
            setError('Event code unknown — cannot change event number');
            return;
        }
        const candidate = (currentNumber || 0) + delta;
        if (candidate < 1) {
            setError('Already at the first event');
            return;
        }
        setNavLoading(true);
        setError(null);
        // changeEventNumber invocation logging removed
        try {
            const info = await fetchEventByNumber(code, candidate);
            // changeEventNumber fetchEventByNumber logging removed
            // Expecting event_date returned as DD/MM/YYYY or similar — convert to ISO YYYY-MM-DD for URL
            let newDate = info && (info.event_date || info.eventDate) ? String(info.event_date || info.eventDate) : '';
            if (!newDate) {
                setError('Event not found');
                return;
            }
            if (/^\d{2}\/\d{2}\/\d{4}$/.test(newDate)) {
                const p = newDate.split('/');
                newDate = `${p[2]}-${p[1]}-${p[0]}`;
            }
            // Navigate to the new event using only `event_code` + `event_number`.
            // The loader will resolve the date from these params.
            const qs = new URLSearchParams();
            qs.set('event_code', String(code));
            qs.set('event_number', String(candidate));
            navigate(`/races?${qs.toString()}`);
        } catch (e) {
            // If backend returned 404, surface a friendly message.
            // `e` is `unknown` in TS; narrow safely before accessing `response`.
            let status404 = false;
            try {
                if (e && typeof e === 'object' && 'response' in e) {
                    const anyE: any = e;
                    const resp = anyE.response;
                    if (resp && typeof resp.status === 'number' && resp.status === 404) status404 = true;
                }
            } catch (_err) {
                // ignore narrowing errors
            }
            if (status404) {
                setError('No event found for that event number (probably you are at the most recent event)');
            } else {
                setError(String(e));
            }
        } finally {
            setNavLoading(false);
        }
    };

    // Back button component placed in the header so users can return to Results

    const BackButton: React.FC = () => {
        const params = new URLSearchParams(location.search);
        const fromList = params.get('from_list') === '1';
        const locationState: any = location.state ?? {};
        const fromCourses = locationState?.from === 'courses' || params.get('from_courses') === '1';
        const handleBack = () => {
            if (navigateBackWithNavStack(navigate, location.pathname)) {
                return;
            }
            if (fromList) {
                navigate('/lists');
                return;
            }
            if (fromCourses) {
                const returnTo = locationState?.returnTo;
                const targetPath = (returnTo && typeof returnTo.pathname === 'string') ? returnTo.pathname : '/courses';
                const targetParams = new URLSearchParams((returnTo && typeof returnTo.search === 'string') ? returnTo.search : '');
                if (eventName) {
                    targetParams.set('event_name', String(eventName));
                }
                if (rawEventParam) {
                    targetParams.set('event_code', String(rawEventParam));
                }
                const sourceDate = resolvedDateDisplay || date;
                if (sourceDate) {
                    targetParams.set('source_date', String(sourceDate));
                }
                navigate(`${targetPath}${targetParams.toString() ? `?${targetParams.toString()}` : ''}`, {
                    state: {
                        eventCode: rawEventParam || undefined,
                        eventName: eventName || undefined,
                        from: 'results',
                        returnTo: {
                            pathname: '/results'
                        },
                        sourceEvent: {
                            eventName: eventName || undefined,
                            eventDate: sourceDate || undefined
                        }
                    }
                });
                return;
            }
            // Always navigate back to the Results page and ignore browser history entries.
            // Preserve Results UI state (if any) stored in sessionStorage under `results_state_v1`.
            try {
                const raw = sessionStorage.getItem('results_state_v1');
                const rs = new URLSearchParams();
                if (raw) {
                    const obj = JSON.parse(raw);
                    const keys = ['query','sortBy','sortDir','analysisType','avgType','filterType','aggType','cellAgg','scrollTop','scrollLeft'];
                    keys.forEach(k => {
                        if (obj && Object.prototype.hasOwnProperty.call(obj, k) && obj[k] !== undefined && obj[k] !== null) {
                            rs.set(`rs_${k}`, String(obj[k]));
                        }
                    });
                }
                const q = rs.toString();
                navigate(`/results_test${q ? `?${q}` : ''}`);
            } catch (e) {
                navigate('/results_test');
            }
        };
        return (
            <button
                type="button"
                aria-label={fromList ? 'Back to Lists' : (fromCourses ? 'Back to Courses' : 'Back to Event Analysis')}
                className="races-back-btn"
                onClick={handleBack}
                title={fromList ? 'Back to Lists' : (fromCourses ? 'Back to Courses' : 'Back to Event Analysis')}
            >
                ←
            </button>
        );
    };

    const stickyCol1Width = colWidths[0] ?? defaultWidthsBase[0] ?? (isCompactViewport ? 50 : 60);
    const stickyCol2Width = colWidths[1] ?? defaultWidthsBase[1] ?? (isCompactViewport ? 150 : 220);

    // Expose CSS variables for first two column widths so sticky offsets follow user resizing.
    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        try {
            el.style.setProperty('--col1-width', `${stickyCol1Width}px`);
            el.style.setProperty('--col2-width', `${stickyCol2Width}px`);
        } catch (e) {
            // ignore
        }
    }, [stickyCol1Width, stickyCol2Width]);

    // Ensure header <th> widths match the rendered <col> widths so header and
    // body columns remain aligned even after resizing. Run after layout via
    // two RAFs to ensure the browser has applied col widths.
    useEffect(() => {
        const syncHeaderWidthsAndStickyOffsets = () => {
            const table = tableRef.current;
            if (!table) return;

            const cols = table.querySelectorAll<HTMLTableColElement>('col');
            const ths = table.querySelectorAll<HTMLTableCellElement>('thead th');
            for (let i = 0; i < cols.length; i++) {
                try {
                    const col = cols[i];
                    const rect = col.getBoundingClientRect();
                    const widthPx = Math.max(0, Math.round(rect.width));
                    const th = ths[i];
                    if (th && th instanceof HTMLElement) {
                        // Apply pixel-exact widths on the header to mirror the <col>.
                        th.style.minWidth = `${widthPx}px`;
                        th.style.width = `${widthPx}px`;
                        th.style.maxWidth = `${widthPx}px`;
                    }
                } catch (e) {
                    // ignore measurement errors
                }
            }

            try {
                const firstCol = table.querySelector<HTMLTableColElement>('col');
                if (!firstCol) return;
                const firstWidthPx = Math.max(0, Math.round(firstCol.getBoundingClientRect().width));
                const stickySecondColumnCells = table.querySelectorAll<HTMLElement>('.sticky-col-2, .sticky-corner-2-2');
                stickySecondColumnCells.forEach((element) => {
                    try {
                        element.style.left = `${firstWidthPx}px`;
                    } catch (e) {
                        // ignore per-element measurement errors
                    }
                });
            } catch (e) {
                // ignore sticky offset measurement errors
            }
        };

        // Defer until after layout; run two RAFs to be safer across browsers.
        let raf1 = 0;
        let raf2 = 0;
        raf1 = requestAnimationFrame(() => {
            raf2 = requestAnimationFrame(() => {
                try {
                    syncHeaderWidthsAndStickyOffsets();
                } catch (err) {
                    // ignore
                }
            });
        });
        const onResize = () => {
            // Recompute after layout stabilises
            requestAnimationFrame(() => requestAnimationFrame(() => syncHeaderWidthsAndStickyOffsets()));
        };
        window.addEventListener('resize', onResize);
        window.addEventListener('orientationchange', onResize);

        return () => {
            window.removeEventListener('resize', onResize);
            window.removeEventListener('orientationchange', onResize);
            if (raf1) cancelAnimationFrame(raf1);
            if (raf2) cancelAnimationFrame(raf2);
        };
    }, [colWidths, rows, viewMode, courseAdj, otherAdj, isCompactViewport]);

    // Column definitions come from events.layout.json; the first two sticky columns
    // are still rendered separately in this legacy page.
    const nonLeadingColumnKeys = useCallback(
        (view: 'basic' | 'detailed' | 'allTimeAdjustments' | 'eventRanks') => getEventColumnsForView(view)
            .map((column) => column.key)
            .filter((key) => key !== 'position' && key !== 'athlete'),
        []
    );
    const baseColumns = useMemo(
        () => nonLeadingColumnKeys('basic').map((key) => toLegacyColumnConfig(key)),
        [nonLeadingColumnKeys]
    );
    const detailedColumns = useMemo(
        () => nonLeadingColumnKeys('detailed').map((key) => toLegacyColumnConfig(key)),
        [nonLeadingColumnKeys]
    );
    const allTimeAdjustmentColumns = useMemo(
        () => nonLeadingColumnKeys('allTimeAdjustments').map((key) => toLegacyColumnConfig(key)),
        [nonLeadingColumnKeys]
    );
    const eventRankColumns = useMemo(
        () => nonLeadingColumnKeys('eventRanks').map((key) => toLegacyColumnConfig(key)),
        [nonLeadingColumnKeys]
    );
    const adjustmentColumns = useMemo(
        () => [
            'season_adj_time',
            'event_adj_time',
            'age_adj_time',
            'sex_adj_time',
            'age_event_adj_time',
            'sex_event_adj_time',
            'age_sex_adj_time',
            'age_sex_event_adj_time'
        ].map((key) => toLegacyColumnConfig(key)),
        []
    );
    const configuredLeadingWidths = useMemo(() => ({
        position: getConfiguredEventColumnWidthPx('position', layoutViewport, isCompactViewport ? 50 : 60),
        athlete: getConfiguredEventColumnWidthPx('athlete', layoutViewport, isCompactViewport ? 150 : 220)
    }), [isCompactViewport, layoutViewport]);
    const positionHeaderLabel = String(getEventTableColumnByKey('position')?.headerName || 'Pos');
    const athleteHeaderLabel = String(getEventTableColumnByKey('athlete')?.headerName || 'Participant');
    const getConfiguredDataColumnWidth = useCallback(
        (columnKey: string): number => getConfiguredEventColumnWidthPx(columnKey, layoutViewport, isCompactViewport ? 90 : 120),
        [isCompactViewport, layoutViewport]
    );
    // ...after adjustmentColumns definition
    const columns = useMemo(() => {
        if (viewMode === 'detailed') return detailedColumns;
        if (viewMode === 'allTimeAdjustments') return allTimeAdjustmentColumns;
        if (viewMode === 'eventRanks') return eventRankColumns;

        const selected = [...baseColumns];
        if (adjustmentKeys.length === 0) return selected;

        const adjustmentCols = adjustmentKeys
            .map(key => adjustmentColumns.find(c => c.k === key))
            .filter((col): col is typeof adjustmentColumns[number] => Boolean(col))
            .filter((col, idx, arr) => arr.findIndex(c => c.k === col.k) === idx);

        if (adjustmentCols.length === 0) return selected;

        const timeIndex = selected.findIndex(col => col.k === 'time');
        const insertAt = timeIndex === -1 ? 0 : timeIndex + 1;
        return [
            ...selected.slice(0, insertAt),
            ...adjustmentCols,
            ...selected.slice(insertAt)
        ];
    }, [adjustmentColumns, adjustmentKeys, allTimeAdjustmentColumns, baseColumns, detailedColumns, eventRankColumns, viewMode]);
    const defaultColWidths = useMemo<number[]>(
        () => [
            configuredLeadingWidths.position,
            configuredLeadingWidths.athlete,
            ...columns.map((col) => getConfiguredDataColumnWidth(col.k))
        ],
        [columns, configuredLeadingWidths.athlete, configuredLeadingWidths.position, getConfiguredDataColumnWidth]
    );
    const effectiveColWidths = useMemo<number[]>(
        () => defaultColWidths.map((defaultWidth, index) => {
            const currentWidth = colWidths[index];
            const overrideWidth = typeof currentWidth === 'number' && Number.isFinite(currentWidth)
                ? currentWidth
                : null;
            return overrideWidth ?? defaultWidth;
        }),
        [colWidths, defaultColWidths]
    );
    const fixedLeadingWidths = useMemo(() => ({
        position: effectiveColWidths[0] ?? configuredLeadingWidths.position,
        athlete: effectiveColWidths[1] ?? configuredLeadingWidths.athlete
    }), [configuredLeadingWidths.athlete, configuredLeadingWidths.position, effectiveColWidths]);
    const getFixedDataColumnWidth = useCallback(
        (columnIndex: number, columnKey: string): number => effectiveColWidths[columnIndex + 2] ?? getConfiguredDataColumnWidth(columnKey),
        [effectiveColWidths, getConfiguredDataColumnWidth]
    );
    const racesTableWidthPx = useMemo(() => {
        return effectiveColWidths.reduce<number>((sum, width) => sum + Number(width ?? 0), 0);
    }, [effectiveColWidths]);


    // keep colWidths aligned with the current column count
    useEffect(() => {
    const desired = 2 + columns.length;
    setColWidths(prev => {
        const copy = prev.slice(0, desired);
        while (copy.length < desired) copy.push(null);
        return copy;
    });
    }, [columns, defaultColWidths]);

    // Persist view mode
    useEffect(() => {
        try { sessionStorage.setItem('races_view_mode', viewMode); } catch (e) { /* ignore */ }
    }, [viewMode]);

    const statusMessage: string | null = loading ? 'Loading event positions…' : (error ?? null);

    return (
        <div className="page-content">
            <div className="races-header" style={{ marginBottom: '0.0em', display: 'flex', alignItems: 'normal',marginLeft: '1.0em' }}>
                <BackButton />
                <div className="races-header-text">
                    <div className="races-header-title">
                        {String(eventName || '').trim() ? (
                            headerCourseEditMode ? (
                                <EventSearch
                                    inputId="races-course-search-input"
                                    options={eventOptions}
                                    initialQuery={String(eventName || '')}
                                    placeholder="search for course"
                                    onSelect={handleHeaderCourseSelect}
                                    autoFocus={true}
                                    onInputBlur={() => setHeaderCourseEditMode(false)}
                                    onEscape={() => setHeaderCourseEditMode(false)}
                                />
                            ) : (
                                <button
                                    type="button"
                                    className="races-athlete-button"
                                    onClick={handleHeaderCourseNavigate}
                                    onMouseEnter={startHeaderCourseHoverTimer}
                                    onMouseLeave={clearHeaderCourseHoverTimer}
                                    title={`Open course: ${String(eventName)}. Hover for 2 seconds to edit.`}
                                    aria-label={`Open course ${String(eventName)}. Hover for 2 seconds to edit.`}
                                    style={{ fontSize: 'inherit', fontWeight: 700 }}
                                >
                                    {eventName}
                                </button>
                            )
                        ) : (
                            <em>none</em>
                        )}
                    </div>
                    <div className="races-header-sub">
                        {displayDate || ''}
                        { (displayDate && (eventNumberVal || eventCodeVal)) && (
                            <span className="races-header-sep"></span>
                        ) }
                        { eventNumberVal ? (
                                <span style={{ display: 'inline-flex', alignItems: 'start', gap: 6 , transform: 'translateY(-0.5cm)' }}>
                                    <span style={{ marginLeft: '1.1rem',marginTop: '0.3cm'  }}>{`#${eventNumberVal}`}</span>  
                                    <span style={{ display: 'inline-flex', flexDirection: 'column' }}>
                                        <button
                                            type="button"
                                            onClick={() => changeEventNumber(1)}
                                            disabled={navLoading}
                                            title="Previous event"
                                            className="evnum-btn"
                                            style={{ padding: '2px 6px', fontSize: '0.7rem' }}
                                        >▲</button>
                                        <button
                                            type="button"
                                            onClick={() => changeEventNumber(-1)}
                                            disabled={navLoading}
                                            title="Next event"
                                            className="evnum-btn"
                                            style={{ padding: '2px 6px', fontSize: '0.7rem' }}
                                        >▼</button>
                                    </span>
                                    <span className="races-view-control">
                                        <div className="races-view-control-item" style={{ marginLeft: '0.5cm' }}>
                                            <span className="help-tooltip" style={{ display: 'inline-flex' }}>
                                                <button
                                                    type="button"
                                                    className="help-trigger help-trigger-label"
                                                    onClick={(event) => {
                                                        const rect = (event.currentTarget as HTMLButtonElement).getBoundingClientRect();
                                                        requestUnifiedHelp('control-table-view', {
                                                            x: rect.left,
                                                            y: rect.bottom
                                                        });
                                                    }}
                                                    title="Table View help"
                                                    aria-label="Table View help"
                                                >
                                                    <span className="help-trigger-text">Table View:</span>
                                                </button>
                                            </span>
                                            <select
                                                id="races-view-select"
                                                value={viewMode}
                                                style={{ marginLeft: '-1.0cm' }}
                                                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                                                    const v = e.target.value;
                                                    const next = v === 'detailed'
                                                        ? 'detailed'
                                                        : v === 'allTimeAdjustments'
                                                            ? 'allTimeAdjustments'
                                                            : v === 'eventRanks'
                                                                ? 'eventRanks'
                                                                : 'basic';
                                                    handleViewModeChange(next);
                                                }}
                                                aria-label="Races view mode"
                                            >
                                                <option value="basic">Basic</option>
                                                <option value="detailed">Detailed</option>
                                                <option value="allTimeAdjustments">All Time Adjustments</option>
                                                <option value="eventRanks">Event Ranks</option>
                                            </select>
                                         </div>

                                        <div className="races-view-control-item">
                                            <label htmlFor="course-adj-select">Course adj:</label>
                                            <select id="course-adj-select" value={courseAdj} onChange={onCourseAdjSelect} aria-label="Course adjustment">
                                                {courseAdjOptions.map((option) => (
                                                    <option key={option.value} value={option.value} disabled={otherAdj !== 'none' && option.value === 'seasonal'}>{option.label}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="races-view-control-item">
                                            <label htmlFor="other-adj-select">Other adj:</label>
                                            <select id="other-adj-select" value={otherAdj} onChange={onOtherAdjSelect} aria-label="Other adjustment">
                                                {otherAdjOptions.map((option) => (
                                                    <option key={option.value} value={option.value} disabled={courseAdj === 'seasonal' && option.value !== 'none'}>{option.label}</option>
                                                ))}
                                            </select>
                                            <div
                                                style={{
                                                    gridColumn: '2 / 3',
                                                    marginTop: '0.60em',
                                                    marginLeft: '-2.9cm',
                                                    fontSize: '0.78rem',
                                                    color: '#374151',
                                                    whiteSpace: 'nowrap',
                                                    width: 'max-content'
                                                }}
                                            >
                                                <span>Hardness adj:</span>
                                                <span style={{ marginLeft: '0.2cm' }}>{combinedHardnessDisplay}</span>
                                            </div>
                                        </div>
                                    </span>
                                </span>
                            ) : (eventCodeVal ? `code ${eventCodeVal}` : '') }
                    </div>
                </div>
            </div>
                <div
                    className="races-output-box"
                    style={{
                        backgroundColor: '#fff',
                        border: 'none',
                        borderRadius: '8px',
                        padding: '0.35rem 0.6rem',
                        minHeight: '0.3rem',
                        display: 'flex',
                        alignItems: 'center',
                        boxShadow: 'none',
                        color: loading ? '#333' : (error ? '#8b0000' : '#333'),
                        fontSize: '0.85rem'
                    }}
                >
                    {statusMessage ? (
                        <span style={loading ? { fontStyle: 'italic' } : undefined}>{statusMessage}</span>
                    ) : null}
                </div>
            {rows && rows.length === 0 && <div>No positions returned for this event/date.</div>}
            {rows && rows.length > 0 && (
                            <div className="results-table-container" ref={containerRef} style={{ marginTop: '0.1cm' }}>
                            <table
                                key={viewMode}                 // force remount when view changes
                                className="results-table races-table eventtest-table"
                                ref={tableRef}
                                style={{ ['--races-table-width' as any]: `${racesTableWidthPx}px` }}
                            >
                                {/* colgroup ... */}
                                <colgroup>
                                {Array.from({ length: 2 + columns.length }).map((_, i) => {
                                    const columnKey = i >= 2 ? columns[i - 2]?.k : null;
                                    const w = i === 0
                                        ? fixedLeadingWidths.position
                                        : i === 1
                                            ? fixedLeadingWidths.athlete
                                            : getFixedDataColumnWidth(i - 2, String(columnKey || ''));
                                    return <col key={i} style={{ width: `${w}px` }} />;
                                })}
                                </colgroup>

                                {/* ... */}

                            <thead key={viewMode}>
                            {/* Top header row: first two sticky headers then the remaining column headers */}
                            <tr>
                                <th
                                    className="eventtest-col eventtest-sticky-col"
                                    style={{
                                        ['--event-col-width' as any]: `${fixedLeadingWidths.position}px`,
                                        ['--event-col-left' as any]: '0px',
                                        fontWeight: 700,
                                        position: 'sticky',
                                        top: 0,
                                        left: 0,
                                        zIndex: 650,
                                        backgroundColor: 'rgba(224,224,224,0.98)',
                                        backgroundClip: 'padding-box',
                                        cursor: 'pointer',
                                        width: `${fixedLeadingWidths.position}px`,
                                        minWidth: `${fixedLeadingWidths.position}px`,
                                        maxWidth: `${fixedLeadingWidths.position}px`
                                    }}
                                    onClick={() => handleSort('position')}
                                    onTouchEnd={(e) => { e.preventDefault(); handleSort('position'); }}
                                >
                                    <span className="eventtest-header-label">{positionHeaderLabel}</span>
                                    <span className="eventtest-sort-indicator">{sortKey === 'position' ? (sortDir === 'asc' ? '▲' : '▼') : ''}</span>
                                    <div
                                        role="separator"
                                        aria-orientation="vertical"
                                        onMouseDown={(e) => onColResizerMouseDown(e, 0)}
                                        style={{ position: 'absolute', right: 0, top: 0, width: 8, height: '100%', cursor: 'col-resize' }}
                                    />
                                </th>
                                    <th
                                        className="eventtest-col eventtest-sticky-col"
                                        style={{
                                            ['--event-col-width' as any]: `${fixedLeadingWidths.athlete}px`,
                                            ['--event-col-left' as any]: `${fixedLeadingWidths.position}px`,
                                            fontWeight: 700,
                                            position: 'sticky',
                                            top: 0,
                                            left: `${fixedLeadingWidths.position}px`,
                                            zIndex: 645,
                                            backgroundColor: 'rgba(224,224,224,0.98)',
                                            backgroundClip: 'padding-box',
                                            textAlign: 'left',
                                            cursor: 'pointer',
                                            width: `${fixedLeadingWidths.athlete}px`,
                                            minWidth: `${fixedLeadingWidths.athlete}px`,
                                            maxWidth: `${fixedLeadingWidths.athlete}px`
                                        }}
                                        onClick={() => handleSort('name')}
                                        onTouchEnd={(e) => { e.preventDefault(); handleSort('name'); }}
                                    >
                                        <span className="eventtest-header-label">{athleteHeaderLabel}</span>
                                        <span className="eventtest-sort-indicator">{sortKey === 'name' ? (sortDir === 'asc' ? '▲' : '▼') : ''}</span>
                                        <div
                                            role="separator"
                                            aria-orientation="vertical"
                                            onMouseDown={(e) => onColResizerMouseDown(e, 1)}
                                            style={{ position: 'absolute', right: 0, top: 0, width: 8, height: '100%', cursor: 'col-resize' }}
                                        />
                                    </th>
                                    {/* Render columns based on selected view (basic/detailed) */}
                                    {columns.map((col, idx) => (
                                    <th
                                        key={col.k}
                                        className={`eventtest-col ${adjustmentColumns.find(ac => ac.k === col.k) ? 'sticky-header adjustment-header' : ''} ${col.k.startsWith('event_rank_') ? 'event-rank-header' : ''}`}
                                        style={{
                                            ['--event-col-width' as any]: `${getFixedDataColumnWidth(idx, col.k)}px`,
                                            ['--event-col-left' as any]: 'auto',
                                            fontWeight: 700,
                                            position: 'sticky',
                                            top: 0,
                                            zIndex: 200,
                                            cursor: 'pointer',
                                            backgroundColor: col.k.startsWith('event_rank_') ? '#d9f99d' : undefined,
                                            width: `${getFixedDataColumnWidth(idx, col.k)}px`,
                                            minWidth: `${getFixedDataColumnWidth(idx, col.k)}px`,
                                            maxWidth: `${getFixedDataColumnWidth(idx, col.k)}px`
                                        }}
                                        onClick={() => handleSort(col.k)}
                                        onTouchEnd={(e) => { e.preventDefault(); handleSort(col.k); }}  // add this
                                    >
                                        <span className="eventtest-header-label">{col.label}</span>
                                        <span className="eventtest-sort-indicator">{sortKey === col.k ? (sortDir === 'asc' ? '▲' : '▼') : ''}</span>
                                        <div
                                        role="separator"
                                        aria-orientation="vertical"
                                        onMouseDown={(e) => onColResizerMouseDown(e, idx + 2)}
                                        style={{ position: 'absolute', right: 0, top: 0, width: 8, height: '100%', cursor: 'col-resize' }}
                                        />
                                    </th>
                                    ))}
                                </tr>
                                </thead>
                        <tbody>
                            {(sortedRows ?? rows).map((r: any, i: number) => {
                                // Check if this row should be highlighted (athlete from Athletes table)
                                const rowAthleteCode = r['athlete_code'] ?? r['athleteCode'];
                                const isHighlightedAthlete = highlightAthleteCode && 
                                    String(rowAthleteCode) === String(highlightAthleteCode);
                                
                                return (
                                <tr 
                                    key={r.athlete_code || i}
                                    className={isHighlightedAthlete ? 'highlighted-athlete-row' : undefined}
                                    style={{
                                        backgroundColor: isHighlightedAthlete ? '#e6f3ff' : undefined,
                                        fontWeight: isHighlightedAthlete ? 'bold' : undefined
                                    }}
                                >
                                    {/* First two sticky columns: position, name */}
                                    <td
                                        className="eventtest-col eventtest-sticky-col"
                                        style={{
                                            ['--event-col-width' as any]: `${fixedLeadingWidths.position}px`,
                                            ['--event-col-left' as any]: '0px',
                                            width: `${fixedLeadingWidths.position}px`,
                                            minWidth: `${fixedLeadingWidths.position}px`,
                                            maxWidth: `${fixedLeadingWidths.position}px`
                                        }}
                                    >{String(r['position'] ?? '')}</td>
                                        {
                                            (() => {
                                                const athleteName = String(r['name'] ?? r['athlete_name'] ?? '');
                                                const athleteCodeValue = r['athlete_code'] ?? r['athleteCode'];
                                                const superTourVal = r['super_tourist'] ?? r['super_tourist'.replace(/_(.)/g, (_m, g1) => g1.toUpperCase())] ?? '';
                                                const isSuperTour = (String(superTourVal) === 'T' || String(superTourVal) === '1' || superTourVal === 1);
                                                const superReturnVal = r['super_returner'] ?? r['super_returner'.replace(/_(.)/g, (_m, g1) => g1.toUpperCase())] ?? '';
                                                const isCommentBold = (String(superReturnVal) === 'T' || String(superReturnVal) === '1' || superReturnVal === 1);
                                                // Crown: when Eligible recent > 10 or Local recent > 20 and Detail equals 'New PB!'
                                                const eligibleRaw = r['event_eligible_appearances'] ?? r['eventEligibleAppearances'] ?? r['event_eligible_appearances'.replace(/_(.)/g, (_m, g1) => g1.toUpperCase())] ?? '';
                                                const localRaw = r['last_event_code_count_long'] ?? r['lastEventCodeCountLong'] ?? r['last_event_code_count_long'.replace(/_(.)/g, (_m, g1) => g1.toUpperCase())] ?? '';
                                                const eligibleNum = Number(eligibleRaw) || 0;
                                                const localNum = Number(localRaw) || 0;
                                                const commentRaw = String(r['comment'] ?? r['comment'.replace(/_(.)/g, (_m, g1) => g1.toUpperCase())] ?? '');
                                                const showCrown = ( (eligibleNum > 10 || localNum > 20) && commentRaw === 'New PB!' );
                                                const otherRaw = r['distinct_courses_long'] ?? r['distinctCoursesLong'] ?? r['distinct_courses_long'.replace(/_(.)/g, (_m, g1) => g1.toUpperCase())] ?? '';
                                                const otherNum = Number(otherRaw) || 0;
                                                const totalRaw = r['total_runs'] ?? r['totalRuns'] ?? r['total_runs'.replace(/_(.)/g, (_m, g1) => g1.toUpperCase())] ?? null;
                                                // First-timer badge conditions (shared match). Two variants:
                                                //  - firstEver: total_runs is null/absent → '1st ever Parkrun'
                                                //  - firstAtEvent: total_runs present → 'First time at this event'
                                                const isFirstTimerMatch = (commentRaw === 'First Timer!' && localNum === 1 && otherNum === 1);
                                                const showFirstBadgeFirstEver = isFirstTimerMatch && (totalRaw == null);
                                                const showFirstBadgeEventOnly = isFirstTimerMatch && (totalRaw != null);
                                                const athleteLabel = athleteName || 'Unknown athlete';
                                                const hasAthleteCode = athleteCodeValue !== undefined && athleteCodeValue !== null && athleteCodeValue !== '';
                                                return (
                                                    <td
                                                        className="eventtest-col eventtest-sticky-col"
                                                        style={{
                                                            ['--event-col-width' as any]: `${fixedLeadingWidths.athlete}px`,
                                                            ['--event-col-left' as any]: `${fixedLeadingWidths.position}px`,
                                                            width: `${fixedLeadingWidths.athlete}px`,
                                                            minWidth: `${fixedLeadingWidths.athlete}px`,
                                                            maxWidth: `${fixedLeadingWidths.athlete}px`,
                                                            textAlign: 'left'
                                                        }}
                                                    >
                                                        {hasAthleteCode ? (
                                                            <button
                                                                type="button"
                                                                className="races-athlete-button"
                                                                onClick={() => handleAthleteNavigate(r)}
                                                                title="View athlete details"
                                                            >
                                                                {athleteLabel}
                                                            </button>
                                                        ) : (
                                                            athleteLabel
                                                        )}
                                                        {isSuperTour && (
                                                            <span title="Super Tourist" style={{ marginLeft: 6, fontSize: '0.55rem', color: '#0077cc', background: '#f0f0f0', padding: '1px 3px', borderRadius: 4, fontWeight: 700, display: 'inline-block' }}>ST</span>
                                                        )}
                                                        {isCommentBold && (
                                                            <span title="Returner" style={{ marginLeft: 6, fontSize: '0.68rem', display: 'inline-block' }}>👋</span>
                                                        )}
                                                        {showCrown && (
                                                            <span title="New PB" style={{ marginLeft: 6, fontSize: '0.58rem', color: '#b8860b', background: '#fff8e1', padding: '1px 3px', borderRadius: 4, fontWeight: 700, display: 'inline-block' }}>👑</span>
                                                        )}
                                                        {showFirstBadgeFirstEver && (
                                                            <span title="1st ever Parkrun" aria-label="First timer" role="img" style={{ marginLeft: 6, fontSize: '0.55rem', color: '#0077cc', background: '#f0f0f0', padding: '1px 3px', borderRadius: 4, fontWeight: 700, display: 'inline-block' }}>🥇 1st</span>
                                                        )}
                                                        {showFirstBadgeEventOnly && (
                                                            <span title="First time at this event" aria-label="First time at this event" role="img" style={{ marginLeft: 6, fontSize: '0.55rem', color: '#0077cc', background: '#f0f0f0', padding: '1px 3px', borderRadius: 4, fontWeight: 700, display: 'inline-block' }}>1st</span>
                                                        )}
                                                    </td>
                                                );
                                            })()
                                        }
                                    {/* Render remaining columns dynamically */}
                                    {columns.map((col, idx) => {
                                        const rawVal = r[col.k] ?? r[col.k.replace(/_(.)/g, (_m, g1) => g1.toUpperCase())] ?? '';
                                        const textAlign = (typeof rawVal === 'string') ? ((col.k === 'club' || col.k === 'comment') ? 'left' : undefined) : undefined;
                                        const cellStyle: React.CSSProperties = {
                                            textAlign,
                                            width: `${getFixedDataColumnWidth(idx, col.k)}px`,
                                            minWidth: `${getFixedDataColumnWidth(idx, col.k)}px`,
                                            maxWidth: `${getFixedDataColumnWidth(idx, col.k)}px`
                                        };

                                        if (col.k === 'club') {
                                            const clubValue = String(rawVal ?? '').trim();
                                            const canOpenClub = clubValue.length > 0 && clubValue.toLowerCase() !== '<no club>';
                                            return (
                                                <td key={col.k} style={cellStyle}>
                                                    {canOpenClub ? (
                                                        <button
                                                            type="button"
                                                            className="races-athlete-button"
                                                            onClick={() => handleClubNavigate(clubValue)}
                                                            title={`Open club: ${clubValue}`}
                                                            aria-label={`Open club ${clubValue}`}
                                                        >
                                                            {clubValue}
                                                        </button>
                                                    ) : (
                                                        String(rawVal)
                                                    )}
                                                </td>
                                            );
                                        }

                                        if (col.k === 'best_curve_ranking_current') {
                                            const currentRankRaw = r['best_curve_ranking_current'] ?? r['bestCurveRankingCurrent'] ?? r['rank'];
                                            const historicRankRaw = r['best_curve_ranking_historic'] ?? r['bestCurveRankingHistoric'];
                                            const rankTypeRaw = r['best_curve_ranking_current_type'] ?? r['bestCurveRankingCurrentType'] ?? '';

                                            const currentRank = Number(currentRankRaw);
                                            const historicRank = Number(historicRankRaw);
                                            const hasCurrent = Number.isFinite(currentRank);
                                            const hasHistoric = Number.isFinite(historicRank);

                                            const rankType = String(rankTypeRaw || '').trim() || '*';
                                            const currentRankInt = hasCurrent ? Math.round(currentRank) : null;
                                            const historicRankInt = hasHistoric ? Math.round(historicRank) : null;
                                            const delta = currentRankInt !== null && historicRankInt !== null ? currentRankInt - historicRankInt : null;
                                            const deltaText = delta === null ? '' : `${delta >= 0 ? '+' : ''}${delta}`;

                                            return (
                                                <td key={col.k} style={{ ...cellStyle, textAlign: 'center' }}>
                                                    <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                                                        <span>{currentRankInt !== null ? String(currentRankInt) : ''}</span>
                                                        <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', lineHeight: 1.02 }}>
                                                            <span style={{ fontSize: '0.62rem', opacity: 0.9 }}>{rankType}</span>
                                                            <span style={{ fontSize: '0.62rem', opacity: 0.9 }}>{deltaText}</span>
                                                        </span>
                                                    </div>
                                                </td>
                                            );
                                        }

                                        // If this is the Eligible recent column and the row is marked Regular === 'T', shade green
                                        if (col.k === 'event_eligible_appearances') {
                                            const regVal = r['regular'] ?? r['regular'.replace(/_(.)/g, (_m, g1) => g1.toUpperCase())] ?? '';
                                            if (String(regVal) === 'T') {
                                                cellStyle.backgroundColor = '#dff0d8';
                                            }
                                        }
                                        // If this is the Other events column and the row is marked Tourist === 'T', shade green
                                        if (col.k === 'distinct_courses_long') {
                                            const tourVal = r['tourist_flag'] ?? r['tourist_flag'.replace(/_(.)/g, (_m, g1) => g1.toUpperCase())] ?? '';
                                            if (String(tourVal) === 'T') {
                                                cellStyle.backgroundColor = '#dff0d8';
                                            }
                                            // If the row is marked as super_tourist, make the Other events cell bold
                                            const superTourVal = r['super_tourist'] ?? r['super_tourist'.replace(/_(.)/g, (_m, g1) => g1.toUpperCase())] ?? '';
                                            if (String(superTourVal) === 'T' || String(superTourVal) === '1' || superTourVal === 1) {
                                                cellStyle.fontWeight = '700';
                                            }
                                        }
                                        // If this is the Detail column and row has returner/super_returner flags, style accordingly
                                        if (col.k === 'comment') {
                                            const returnerVal = r['returner'] ?? r['returner'.replace(/_(.)/g, (_m, g1) => g1.toUpperCase())] ?? '';
                                            const superReturnerVal = r['super_returner'] ?? r['super_returner'.replace(/_(.)/g, (_m, g1) => g1.toUpperCase())] ?? '';
                                            if (String(returnerVal) === 'T') {
                                                cellStyle.backgroundColor = '#dff0d8';
                                            }
                                            if (String(superReturnerVal) === 'T') {
                                                cellStyle.fontWeight = '700';
                                            }
                                            // Also make the comment bold when the crown condition applies
                                            const eligibleRaw = r['event_eligible_appearances'] ?? r['eventEligibleAppearances'] ?? r['event_eligible_appearances'.replace(/_(.)/g, (_m, g1) => g1.toUpperCase())] ?? '';
                                            const localRaw = r['last_event_code_count_long'] ?? r['lastEventCodeCountLong'] ?? r['last_event_code_count_long'.replace(/_(.)/g, (_m, g1) => g1.toUpperCase())] ?? '';
                                            const eligibleNum = Number(eligibleRaw) || 0;
                                            const localNum = Number(localRaw) || 0;
                                            const commentRaw = String(r['comment'] ?? r['comment'.replace(/_(.)/g, (_m, g1) => g1.toUpperCase())] ?? '');
                                            const showCrown = ( (eligibleNum > 10 || localNum > 20) && commentRaw === 'New PB!' );
                                            if (showCrown) {
                                                cellStyle.fontWeight = '700';
                                            }
                                        }
                                        return (
                                            <td key={col.k} style={cellStyle}>
                                                {String(rawVal)}
                                            </td>
                                        );
                                    })}
                                </tr>
                                );
                            })}
                        </tbody>
                    </table>
                    {/* Native scrollbars are used instead of custom fast-scroll/always-visible thumb. */}
                </div>
            )}
            {!loading && rows === null && !error && (
                <div>Click a cell in Event Analysis to view the selected event/date here.</div>
            )}
        </div>
    );
};

export default Races;
