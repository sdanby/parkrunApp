import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { fetchAthleteRuns } from '../api/backendAPI';
import './ResultsTable.css';

type AthleteRecord = { [key: string]: any };

type AthletesLocationState = {
    athleteCode?: string;
    from?: string;
    returnTo?: { pathname: string; search?: string };
    sourceEvent?: {
        eventName?: string;
        eventDate?: string;
    };
};

const toAthletesLocationState = (value: unknown): AthletesLocationState => {
    if (!value || typeof value !== 'object') {
        return {};
    }
    const possible: any = value;
    const next: AthletesLocationState = {};
    if (typeof possible.athleteCode === 'string') {
        next.athleteCode = possible.athleteCode;
    }
    if (typeof possible.from === 'string') {
        next.from = possible.from;
    }
    if (possible.returnTo && typeof possible.returnTo === 'object') {
        const rt: any = possible.returnTo;
        if (typeof rt.pathname === 'string') {
            next.returnTo = {
                pathname: rt.pathname,
                search: typeof rt.search === 'string' ? rt.search : undefined
            };
        }
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

const pickField = (athlete: AthleteRecord | null | undefined, keys: string[]): any => {
    if (!athlete) return undefined;
    for (const key of keys) {
        if (Object.prototype.hasOwnProperty.call(athlete, key)) {
            const value = athlete[key];
            if (value !== undefined && value !== null && value !== '') {
                return value;
            }
        }
    }
    return undefined;
};

type AthleteSummary = {
    athlete_code?: string;
    athlete_name?: string;
    club?: string;
    current_age_estimate?: number | string;
    sex?: string;
    total_runs?: number;
};

type SummaryField = 'athlete_code' | 'athlete_name' | 'club' | 'current_age_estimate' | 'sex' | 'total_runs';

type AthleteRunsNormalized = {
    runs: AthleteRecord[];
    summary: AthleteSummary | null;
};

const nestedArrayKeys = ['runs', 'results', 'records', 'rows', 'items', 'data', 'events'];

const extractRunsArray = (payload: any): AthleteRecord[] => {
    if (Array.isArray(payload)) {
        return payload;
    }
    if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
        const obj: AthleteRecord = payload;
        for (const key of nestedArrayKeys) {
            const candidate = obj[key];
            if (Array.isArray(candidate)) {
                return candidate;
            }
        }
        for (const key of nestedArrayKeys) {
            const candidate = obj[key];
            if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) {
                const nested = extractRunsArray(candidate);
                if (nested.length > 0) {
                    return nested;
                }
            }
        }
    }
    return [];
};

const normalizeAthleteResponse = (payload: any, fallbackCode?: string): AthleteRunsNormalized => {
    const runs = extractRunsArray(payload);
    const summarySources: AthleteRecord[] = [];
    if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
        const obj: AthleteRecord = payload;
        summarySources.push(obj);
        ['summary', 'athlete', 'profile', 'details', 'meta'].forEach((key) => {
            const candidate = obj[key];
            if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) {
                const source: AthleteRecord = candidate;
                summarySources.push(source);
            }
        });
    }
    if (runs.length > 0) {
        summarySources.push(runs[0]);
    }

    const summary: AthleteSummary = {};
    const fill = (field: SummaryField, keys: string[], fallback?: any) => {
        if (summary[field] !== undefined && summary[field] !== null && summary[field] !== '') {
            return;
        }
        for (const source of summarySources) {
            if (!source) continue;
            const value = pickField(source, keys);
            if (value !== undefined && value !== null && value !== '') {
                summary[field] = value;
                return;
            }
        }
        if (fallback !== undefined) {
            summary[field] = fallback;
        }
    };

    fill('athlete_code', ['athlete_code', 'athleteCode', 'runner_code', 'code', 'id'], fallbackCode);
    fill('athlete_name', ['athlete_name', 'name', 'display_name']);
    fill('club', ['club', 'athlete_club']);
    fill('sex', ['sex', 'gender']);
    fill('current_age_estimate', ['current_age_estimate', 'age_estimate', 'age']);
    fill('total_runs', ['total_runs', 'totalRuns', 'run_count', 'runs']);

    if (summary.total_runs === undefined && runs.length > 0) {
        summary.total_runs = runs.length;
    }

    const hasValue = Object.values(summary).some((value) => value !== undefined && value !== null && value !== '');
    return {
        runs,
        summary: hasValue ? summary : (fallbackCode ? { athlete_code: fallbackCode } : null)
    };
};

const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const formatDateValue = (value: unknown): string => {
    if (value === undefined || value === null) return '';
    const compact = (day: string, month: string, year: string) => {
        const dd = day.padStart(2, '0');
        const mm = month;
        const yy = year.slice(-2);
        return `${dd}${mm}${yy}`;
    };
    const raw = String(value).trim();
    const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (iso) {
        const year = iso[1];
        const month = monthNames[Number(iso[2]) - 1] || iso[2];
        const day = iso[3];
        return compact(day, month, year);
    }
    const slash = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (slash) {
        const day = slash[1];
        const month = monthNames[Number(slash[2]) - 1] || slash[2];
        const year = slash[3];
        return compact(day, month, year);
    }
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) {
        const day = String(parsed.getUTCDate()).padStart(2, '0');
        const month = monthNames[parsed.getUTCMonth()] || parsed.toLocaleString('en-GB', { month: 'short' });
        const year = String(parsed.getUTCFullYear());
        return compact(day, month, year);
    }
    return raw;
};

const formatAgeGradeValue = (value: unknown): string => {
    if (value === undefined || value === null || value === '') return '';
    if (typeof value === 'number' && Number.isFinite(value)) {
        return `${value.toFixed(1)}%`;
    }
    const raw = String(value).trim();
    if (raw.endsWith('%')) {
        return raw;
    }
    const numeric = Number(raw);
    if (!Number.isNaN(numeric)) {
        return `${numeric.toFixed(1)}%`;
    }
    return raw;
};

const secondsToTime = (seconds: number): string => {
    if (!Number.isFinite(seconds)) return '';
    const totalSeconds = Math.max(0, Math.round(seconds));
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    const pad = (num: number) => String(num).padStart(2, '0');
    if (hrs > 0) {
        return `${hrs}:${pad(mins)}:${pad(secs)}`;
    }
    return `${mins}:${pad(secs)}`;
};

const formatTimeValue = (value: unknown): string => {
    if (value === undefined || value === null || value === '') return '';
    if (typeof value === 'number') {
        return secondsToTime(value);
    }
    const trimmed = String(value).trim();
    if (trimmed === '') return '';
    if (/^\d+(?:\.\d+)?$/.test(trimmed)) {
        return secondsToTime(Number(trimmed));
    }
    return trimmed;
};

const formatAgeEstimate = (value: unknown): string | undefined => {
    if (value === undefined || value === null || value === '') return undefined;
    const numeric = Number(value);
    if (!Number.isNaN(numeric)) {
        return Number.isInteger(numeric) ? `${numeric}` : numeric.toFixed(1);
    }
    return String(value);
};

const useMediaQuery = (query: string): boolean => {
    const [matches, setMatches] = useState<boolean>(() => {
        if (typeof window === 'undefined') return false;
        return window.matchMedia(query).matches;
    });

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const media = window.matchMedia(query);
        const listener = (event: MediaQueryListEvent) => setMatches(event.matches);
        setMatches(media.matches);
        try {
            media.addEventListener('change', listener);
        } catch (_err) {
            if (typeof media.addListener === 'function') media.addListener(listener);
        }
        return () => {
            try {
                media.removeEventListener('change', listener);
            } catch (_err) {
                if (typeof media.removeListener === 'function') media.removeListener(listener);
            }
        };
    }, [query]);

    return matches;
};

type AthleteViewMode = 'basic' | 'detailed' | 'all_time_adjustments';
type CourseAdjOption = 'none' | 'seasonal' | 'full';
type OtherAdjOption = 'none' | 'age' | 'sex' | 'age_sex';

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
        age: ['event_age_adj_time'],
        sex: ['event_sex_adj_time'],
        age_sex: ['event_age_sex_adj_time']
    }
};

const getAdjustmentKeys = (course: CourseAdjOption, other: OtherAdjOption): string[] => {
    const courseMap = adjustmentColumnMatrix[course];
    if (!courseMap) return [];
    return courseMap[other] ?? [];
};

const normalizeViewMode = (value: string): AthleteViewMode => {
    if (value === 'detailed' || value === 'all_time_adjustments') return value;
    return 'basic';
};

const normalizeCourseAdjOption = (value: string): CourseAdjOption => {
    if (value === 'seasonal' || value === 'full') return value;
    return 'none';
};

const normalizeOtherAdjOption = (value: string): OtherAdjOption => {
    if (value === 'age' || value === 'sex' || value === 'age_sex') return value;
    return 'none';
};

type ColumnKey =
    | 'date'
    | 'event_display'
    | 'position'
    | 'age_group'
    | 'age_grade'
    | 'time'
    | 'comment'
    | 'season_adj_time'
    | 'event_adj_time'
    | 'age_adj_time'
    | 'sex_adj_time'
    | 'event_age_adj_time'
    | 'event_sex_adj_time'
    | 'event_age_sex_adj_time'
    | 'age_sex_adj_time'
    | 'last_position'
    | 'event_number'
    | 'total_runs_long'
    | 'event_eligible_appearances'
    | 'last_event_code_count_long'
    | 'distinct_courses_long'
    | 'tourist_flag'
    | 'super_tourist'
    | 'returner';

type ColumnDef = {
    key: ColumnKey;
    label: string;
    sticky?: boolean;
    align?: 'left' | 'center';
    desktopWidth?: number;
    mobileWidth?: number;
};

const baseAthleteColumns: ColumnDef[] = [
    { key: 'date', label: 'Date', sticky: true, align: 'left', desktopWidth: 60, mobileWidth: 60 },
    { key: 'event_display', label: 'Event name', align: 'left', desktopWidth: 90, mobileWidth: 90 },
    { key: 'position', label: 'Pos', align: 'center', desktopWidth: 30 ,mobileWidth: 30},
    { key: 'time', label: 'Time', align: 'center', desktopWidth: 40 ,mobileWidth: 40},
    { key: 'age_group', label: 'Age grp', align: 'center', desktopWidth: 60 ,mobileWidth: 60},
    { key: 'age_grade', label: 'Age grd', align: 'center', desktopWidth: 60 ,mobileWidth: 60},
    { key: 'comment', label: 'Detail', align: 'left', desktopWidth: 80 ,mobileWidth: 80}
];

const adjustmentColumns: ColumnDef[] = [
    { key: 'season_adj_time', label: 'Season', align: 'center', desktopWidth: 70, mobileWidth: 70 },
    { key: 'event_adj_time', label: 'Event', align: 'center', desktopWidth: 70, mobileWidth: 70 },
    { key: 'age_adj_time', label: 'Age', align: 'center', desktopWidth: 70, mobileWidth: 70 },
    { key: 'sex_adj_time', label: 'Sex', align: 'center', desktopWidth: 70, mobileWidth: 70 },
    { key: 'event_age_adj_time', label: 'Event+Age', align: 'center', desktopWidth: 80, mobileWidth: 80 },
    { key: 'event_sex_adj_time', label: 'Event+Sex', align: 'center', desktopWidth: 80, mobileWidth: 80 },
    { key: 'event_age_sex_adj_time', label: 'Event+Age+Sex', align: 'center', desktopWidth: 100, mobileWidth: 100 },
    { key: 'age_sex_adj_time', label: 'Age+Sex', align: 'center', desktopWidth: 80, mobileWidth: 80 }
];

const detailedColumns: ColumnDef[] = [
    { key: 'last_position', label: 'Event total', align: 'center', desktopWidth: 80, mobileWidth: 70 },
    { key: 'event_number', label: 'Event No', align: 'center', desktopWidth: 70, mobileWidth: 60 },
    { key: 'total_runs_long', label: 'Runs in 1Y', align: 'center', desktopWidth: 80, mobileWidth: 70 },
    { key: 'event_eligible_appearances', label: 'Eligible events', align: 'center', desktopWidth: 100, mobileWidth: 90 },
    { key: 'last_event_code_count_long', label: 'Event Count', align: 'center', desktopWidth: 90, mobileWidth: 80 },
    { key: 'distinct_courses_long', label: 'Distinct events', align: 'center', desktopWidth: 110, mobileWidth: 100 },
    { key: 'tourist_flag', label: 'Tourist', align: 'center', desktopWidth: 60, mobileWidth: 60 },
    { key: 'super_tourist', label: 'Super tourist', align: 'center', desktopWidth: 90, mobileWidth: 80 },
    { key: 'returner', label: 'Returner', align: 'center', desktopWidth: 70, mobileWidth: 60 }
];

const parseDateSortValue = (value: unknown): number | null => {
    if (value === undefined || value === null || value === '') return null;
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    const raw = String(value).trim();
    if (!raw) return null;
    const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoMatch) {
        const parsed = Date.parse(`${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}T00:00:00Z`);
        if (!Number.isNaN(parsed)) return parsed;
    }
    const slashMatch = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (slashMatch) {
        const parsed = Date.parse(`${slashMatch[3]}-${slashMatch[2]}-${slashMatch[1]}T00:00:00Z`);
        if (!Number.isNaN(parsed)) return parsed;
    }
    const parsed = Date.parse(raw);
    return Number.isNaN(parsed) ? null : parsed;
};

const parseNumericSortValue = (value: unknown): number | null => {
    if (value === undefined || value === null || value === '') return null;
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    const cleaned = String(value).replace(/[^0-9.-]/g, '').trim();
    if (!cleaned) return null;
    const parsed = Number(cleaned);
    return Number.isNaN(parsed) ? null : parsed;
};

const parseTimeSortValue = (value: unknown): number | null => {
    if (value === undefined || value === null || value === '') return null;
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    const raw = String(value).trim();
    if (!raw) return null;
    if (/^\d+(?:\.\d+)?$/.test(raw)) {
        return Number(raw);
    }
    const timeParts = raw.split(':').map((part) => Number(part));
    if (timeParts.length === 0 || timeParts.some((num) => Number.isNaN(num))) return null;
    return timeParts.reduce((total, part) => (total * 60) + part, 0);
};

const coerceNumber = (value: unknown): number | null => {
    if (value === undefined || value === null || value === '') return null;
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    const cleaned = String(value).replace(/[^0-9.-]/g, '').trim();
    if (!cleaned) return null;
    const parsed = Number(cleaned);
    return Number.isNaN(parsed) ? null : parsed;
};

const getRowTimeSeconds = (row: AthleteRecord): number | null => {
    const raw = pickField(row, ['time_seconds', 'timeSeconds', 'time', 'time_display', 'finish_time', 'gun_time']);
    return parseTimeSortValue(raw);
};

const getAdjustmentSeconds = (row: AthleteRecord, key: ColumnKey): number | null => {
    const timeSeconds = getRowTimeSeconds(row);
    if (timeSeconds === null) return null;
    const coeff = coerceNumber(pickField(row, ['coeff']));
    const coeffEvent = coerceNumber(pickField(row, ['coeff_event', 'coeffEvent']));
    const ageRatioMale = coerceNumber(pickField(row, ['age_ratio_male', 'ageRatioMale']));
    const ageRatioSex = coerceNumber(pickField(row, ['age_ratio_sex', 'ageRatioSex']));
    const sexRatio = ageRatioMale && ageRatioSex ? ageRatioSex / ageRatioMale : null;

    const coeffProduct = coeff && coeffEvent ? coeff * coeffEvent : null;
    const safeDivide = (numerator: number, denominator: number | null): number | null => {
        if (!denominator) return null;
        return numerator / denominator;
    };

    switch (key) {
        case 'season_adj_time':
            return safeDivide(timeSeconds, coeff);
        case 'event_adj_time':
            return safeDivide(timeSeconds, coeffProduct);
        case 'age_adj_time':
            return safeDivide(timeSeconds, ageRatioMale);
        case 'sex_adj_time':
            return safeDivide(timeSeconds, sexRatio);
        case 'event_age_adj_time':
            return safeDivide(timeSeconds, coeffProduct && ageRatioMale ? coeffProduct * ageRatioMale : null);
        case 'event_sex_adj_time':
            return safeDivide(timeSeconds, coeffProduct && sexRatio ? coeffProduct * sexRatio : null);
        case 'event_age_sex_adj_time':
            return safeDivide(timeSeconds, coeffProduct && ageRatioSex ? coeffProduct * ageRatioSex : null);
        case 'age_sex_adj_time':
            return safeDivide(timeSeconds, ageRatioSex);
        default:
            return null;
    }
};

const parseStringSortValue = (value: unknown): string | null => {
    if (value === undefined || value === null) return null;
    const str = String(value).trim();
    if (!str) return null;
    return str.toLowerCase();
};

const resolveColumnSortValue = (row: AthleteRecord, column: ColumnKey): number | string | null => {
    switch (column) {
        case 'date':
            return parseDateSortValue(pickField(row, ['formatted_date', 'event_date', 'date']));
        case 'event_display':
            return parseStringSortValue(
                pickField(row, ['event_display', 'eventDisplay', 'event_name', 'eventName', 'event'])
            );
        case 'position':
            return parseNumericSortValue(pickField(row, ['position', 'overall_position']));
        case 'age_group':
            return parseStringSortValue(pickField(row, ['age_group', 'ageGroup']));
        case 'age_grade':
            return parseNumericSortValue(pickField(row, ['age_grade', 'ageGrade']));
        case 'time':
            return parseTimeSortValue(
                pickField(row, ['time', 'time_display', 'finish_time', 'gun_time']) ??
                pickField(row, ['time_seconds', 'adj_time_seconds'])
            );
        case 'comment':
            return parseStringSortValue(pickField(row, ['comment', 'notes', 'note', 'remark']));
        case 'season_adj_time':
        case 'event_adj_time':
        case 'age_adj_time':
        case 'sex_adj_time':
        case 'event_age_adj_time':
        case 'event_sex_adj_time':
        case 'event_age_sex_adj_time':
        case 'age_sex_adj_time':
            return getAdjustmentSeconds(row, column);
        case 'last_position':
            return parseNumericSortValue(pickField(row, ['last_position', 'lastPosition']));
        case 'event_number':
            return parseNumericSortValue(pickField(row, ['event_number', 'eventNumber']));
        case 'total_runs_long':
            return parseNumericSortValue(pickField(row, ['total_runs_long', 'totalRunsLong']));
        case 'event_eligible_appearances':
            return parseNumericSortValue(pickField(row, ['event_eligible_appearances', 'eventEligibleAppearances']));
        case 'last_event_code_count_long':
            return parseNumericSortValue(pickField(row, ['last_event_code_count_long', 'lastEventCodeCountLong']));
        case 'distinct_courses_long':
            return parseNumericSortValue(pickField(row, ['distinct_courses_long', 'distinctCoursesLong'])); 
        case 'tourist_flag':
            return parseStringSortValue(pickField(row, ['tourist_flag', 'touristFlag']));
        case 'super_tourist':
            return parseStringSortValue(pickField(row, ['super_tourist', 'superTourist']));
        case 'returner':
            return parseStringSortValue(pickField(row, ['returner']));
        default:
            return null;
    }
};

const Athletes: React.FC = () => {
    const [runs, setRuns] = useState<AthleteRecord[]>([]);
    const [summary, setSummary] = useState<AthleteSummary | null>(null);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<AthleteViewMode>('basic');
    const [courseAdj, setCourseAdj] = useState<CourseAdjOption>('none');
    const [otherAdj, setOtherAdj] = useState<OtherAdjOption>('none');
    const adjustmentKeys = useMemo(() => getAdjustmentKeys(courseAdj, otherAdj), [courseAdj, otherAdj]);
    const [sortKey, setSortKey] = useState<ColumnKey>('date');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
    const isMobile = useMediaQuery('(max-width: 640px)');
    const location = useLocation();
    const navigate = useNavigate();
    const locationState = toAthletesLocationState(location.state ?? {});
    const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
    const selectedCode = locationState.athleteCode || searchParams.get('athlete_code') || undefined;
    const fromRaces = locationState.from === 'races';
    const returnTarget = locationState.returnTo;
    const sourceEvent = locationState.sourceEvent || {
        eventName: searchParams.get('source_event'),
        eventDate: searchParams.get('source_date')
    };

    // Function to check if a row matches the source event
    const isHighlightedRow = (row: AthleteRecord): boolean => {
        if (!sourceEvent?.eventName && !sourceEvent?.eventDate) return false;
        
        const rowEventName = pickField(row, ['event_display', 'eventDisplay', 'event_name', 'eventName', 'event']);
        const rowDate = pickField(row, ['formatted_date', 'event_date', 'date']);
        
        const eventMatches = !sourceEvent.eventName || 
            (rowEventName && String(rowEventName).toLowerCase().includes(sourceEvent.eventName.toLowerCase()));
        const dateMatches = !sourceEvent.eventDate || 
            (rowDate && formatDateValue(rowDate) === formatDateValue(sourceEvent.eventDate));
            
        return eventMatches && dateMatches;
    };

    useEffect(() => {
        let cancelled = false;
        if (!selectedCode) {
            setRuns([]);
            setSummary(null);
            setError(null);
            setLoading(false);
            return () => {
                cancelled = true;
            };
        }

        const loadAthlete = async () => {
            try {
                setLoading(true);
                setError(null);
                const payload = await fetchAthleteRuns(selectedCode);
                if (!cancelled) {
                    const normalized = normalizeAthleteResponse(payload, selectedCode);
                    setRuns(normalized.runs);
                    setSummary(normalized.summary);
                }
            } catch (err) {
                if (!cancelled) {
                    console.error('Error fetching athlete runs:', err);
                    setError('Unable to load athlete runs right now.');
                    setRuns([]);
                    setSummary(selectedCode ? { athlete_code: selectedCode } : null);
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };

        loadAthlete();
        return () => {
            cancelled = true;
        };
    }, [selectedCode]);

    // Auto-scroll to highlighted row when coming from Single Event
    useEffect(() => {
        if (!runs.length) return;
        
        // Small delay to ensure DOM is updated after rendering
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
    }, [runs, sourceEvent]);

    const handleBackToRaces = () => {
        if (returnTarget?.pathname) {
            navigate(`${returnTarget.pathname}${returnTarget.search || ''}`);
        } else {
            navigate('/races');
        }
    };

    const handleViewModeSelect = (event: React.ChangeEvent<HTMLSelectElement>) => {
        const newViewMode = normalizeViewMode(event.target.value);
        setViewMode(newViewMode);
        
        // If 'All Time Adjustments' is selected, reset the course and other adj dropdowns
        if (newViewMode === 'all_time_adjustments') {
            setCourseAdj('none');
            setOtherAdj('none');
        }
    };

    const handleCourseAdjSelect = (event: React.ChangeEvent<HTMLSelectElement>) => {
        setCourseAdj(normalizeCourseAdjOption(event.target.value));
        
        // If course adj is used, reset view mode to Basic
        if (event.target.value !== 'none') {
            setViewMode('basic');
        }
    };

    const handleOtherAdjSelect = (event: React.ChangeEvent<HTMLSelectElement>) => {
        setOtherAdj(normalizeOtherAdjOption(event.target.value));
        
        // If other adj is used, reset view mode to Basic
        if (event.target.value !== 'none') {
            setViewMode('basic');
        }
    };

    const handleRowClick = (row: AthleteRecord) => {
        // Extract event_code and date from the clicked row
        const eventCode = pickField(row, ['event_code', 'eventCode']);
        const eventDate = pickField(row, ['formatted_date', 'event_date', 'date']);
        const athleteCode = pickField(row, ['athlete_code', 'athleteCode']) || selectedCode;
        
        if (eventCode && eventDate) {
            // Navigate to Single Event page with the selected event data and athlete code for highlighting
            const params = new URLSearchParams();
            params.set('event_code', String(eventCode));
            params.set('date', String(eventDate));
            if (athleteCode) {
                params.set('highlight_athlete', String(athleteCode));
            }
            navigate(`/races?${params.toString()}`);
        }
    };

    const latestRun = useMemo(() => (runs.length > 0 ? runs[runs.length - 1] : null), [runs]);
    const rawLatestAge = pickField(latestRun, ['current_age_estimate', 'currentAgeEstimate', 'age_estimate', 'age']) ??
        summary?.current_age_estimate;
    const formattedLatestAge = formatAgeEstimate(rawLatestAge);

    const headerSex = pickField(latestRun, ['sex']) || summary?.sex;
    const sexSymbol = (() => {
        if (!headerSex) return '';
        const normalized = String(headerSex).trim().toUpperCase();
        if (normalized === 'F' || normalized === 'FEMALE' || normalized === 'W') return '♀';
        if (normalized === 'M' || normalized === 'MALE') return '♂';
        return '';
    })();

    const totalRunsCount = summary?.total_runs ?? (runs.length > 0 ? runs.length : undefined);

    const headerName = pickField(latestRun, ['athlete_name', 'name']) || summary?.athlete_name;
    const fallbackName = summary?.athlete_code ? `Athlete ${summary.athlete_code}` : selectedCode ? `Athlete ${selectedCode}` : 'Athlete';
    const detailTitle = headerName || fallbackName;

    const showHeader = Boolean(selectedCode);
    const headerCode = pickField(latestRun, ['athlete_code', 'athleteCode', 'runner_code', 'code']) || summary?.athlete_code || selectedCode || '';
    const headerClubRaw = pickField(latestRun, ['club']) || summary?.club;
    const headerClub = headerClubRaw ? String(headerClubRaw) : '<no club>';

    const renderCell = (value: unknown): string => {
        if (value === undefined || value === null) return '--';
        const str = String(value);
        return str.trim() === '' ? '--' : str;
    };

    const getCellDisplayValue = (row: AthleteRecord, key: ColumnKey): string => {
        switch (key) {
            case 'date':
                return renderCell(formatDateValue(pickField(row, ['formatted_date', 'event_date', 'date'])));
            case 'event_display':
                return renderCell(
                    pickField(row, ['event_display', 'eventDisplay', 'event_name', 'eventName', 'event'])
                );
            case 'position':
                return renderCell(pickField(row, ['position', 'overall_position']));
            case 'age_group':
                return renderCell(pickField(row, ['age_group', 'ageGroup']));
            case 'age_grade':
                return renderCell(formatAgeGradeValue(pickField(row, ['age_grade', 'ageGrade'])));
            case 'time':
                return renderCell(
                    formatTimeValue(
                        pickField(row, ['time', 'time_display', 'finish_time', 'gun_time']) ??
                        pickField(row, ['time_seconds', 'adj_time_seconds'])
                    )
                );
            case 'comment':
                return renderCell(pickField(row, ['comment', 'notes', 'note', 'remark']));
            case 'season_adj_time':
            case 'event_adj_time':
            case 'age_adj_time':
            case 'sex_adj_time':
            case 'event_age_adj_time':
            case 'event_sex_adj_time':
            case 'event_age_sex_adj_time':
            case 'age_sex_adj_time': {
                const seconds = getAdjustmentSeconds(row, key);
                return renderCell(formatTimeValue(seconds));
            }
            case 'last_position':
                return renderCell(pickField(row, ['last_position', 'lastPosition']));
            case 'event_number':
                return renderCell(pickField(row, ['event_number', 'eventNumber']));
            case 'total_runs_long':
                return renderCell(pickField(row, ['total_runs_long', 'totalRunsLong'])); 
            case 'event_eligible_appearances':
                return renderCell(pickField(row, ['event_eligible_appearances', 'eventEligibleAppearances']));
            case 'last_event_code_count_long':
                return renderCell(pickField(row, ['last_event_code_count_long', 'lastEventCodeCountLong']));
            case 'distinct_courses_long':
                return renderCell(pickField(row, ['distinct_courses_long', 'distinctCoursesLong']));
            case 'tourist_flag':
                return renderCell(pickField(row, ['tourist_flag', 'touristFlag']));
            case 'super_tourist':
                return renderCell(pickField(row, ['super_tourist', 'superTourist']));
            case 'returner':
                return renderCell(pickField(row, ['returner']));
            default:
                return '--';
        }
    };

    const handleSort = (column: ColumnKey) => {
        setSortDir(prev => (column === sortKey ? (prev === 'asc' ? 'desc' : 'asc') : 'asc'));
        setSortKey(column);
    };

    const sortedRuns = useMemo(() => {
        if (runs.length === 0) return [] as AthleteRecord[];
        const decorated = runs.map((row, index) => ({ row, index }));
        decorated.sort((a, b) => {
            const va = resolveColumnSortValue(a.row, sortKey);
            const vb = resolveColumnSortValue(b.row, sortKey);
            if (va === null && vb === null) return a.index - b.index;
            if (va === null) return 1;
            if (vb === null) return -1;
            if (typeof va === 'number' && typeof vb === 'number') {
                if (va === vb) return a.index - b.index;
                return sortDir === 'asc' ? va - vb : vb - va;
            }
            const sa = String(va).toLowerCase();
            const sb = String(vb).toLowerCase();
            if (sa === sb) return a.index - b.index;
            if (sortDir === 'asc') return sa.localeCompare(sb);
            return sb.localeCompare(sa);
        });
        return decorated.map(({ row }) => row);
    }, [runs, sortKey, sortDir]);

    const tableColumns = useMemo(() => {
        // If 'All Time Adjustments' view is selected, show all adjustment columns at the end
        if (viewMode === 'all_time_adjustments') {
            return [...baseAthleteColumns, ...adjustmentColumns];
        }
        
        // If 'Detailed' view is selected, show detailed columns at the end
        if (viewMode === 'detailed') {
            return [...baseAthleteColumns, ...detailedColumns];
        }
        
        // Otherwise, use the existing logic for dynamic adjustment columns
        const selectedAdjColumns = adjustmentKeys
            .map(key => adjustmentColumns.find(c => c.key === key))
            .filter((col): col is ColumnDef => Boolean(col));
        
        if (selectedAdjColumns.length === 0) {
            return baseAthleteColumns;
        }

        // Insert adjustment column after Time (position 3)
        const insertAt = 4;
        return [
            ...baseAthleteColumns.slice(0, insertAt),
            ...selectedAdjColumns,
            ...baseAthleteColumns.slice(insertAt)
        ];
    }, [viewMode, adjustmentKeys]);

    const rowsToRender = runs.length > 0 ? sortedRuns : [];

    return (
        <div className="page-content athletes-page">
            {showHeader && (
                <div className="athlete-header">
                    {fromRaces && (
                        <button
                            type="button"
                            className="athletes-back-button"
                            aria-label="Back to race"
                            title="Back to race"
                            onClick={handleBackToRaces}
                        >
                            ←
                        </button>
                    )}
                    <div className="athlete-header-main">
                        <div className="athlete-header-text">
                            <div className="athlete-header-title" title="Athlete Name">
                                {detailTitle}
                                {sexSymbol && <span className="athlete-header-sex" aria-label="Athlete sex"> {sexSymbol}</span>}
                            </div>
                            {headerCode && (
                                <div className="athlete-header-code" title="Athlete Code">
                                    {headerCode}
                                </div>
                            )}
                            <div className="athlete-header-club" title="Athlete's Club">
                                {headerClub}
                            </div>
                            {formattedLatestAge && (
                                <div className="athlete-header-age" title="Estimated Age">
                                    Estm.Age: {formattedLatestAge}
                                </div>
                            )}
                            {totalRunsCount !== undefined && (
                                <div className="athlete-header-total-runs" title="Total runs recorded">
                                    Total runs: {totalRunsCount}
                                </div>
                            )}
                        </div>
                        <div className="athlete-view-control races-view-control">
                            <div className="races-view-control-item">
                                <label htmlFor="athletes-view-select">View:</label>
                                <select
                                    id="athletes-view-select"
                                    value={viewMode}
                                    onChange={handleViewModeSelect}
                                    aria-label="Athletes view mode"
                                >
                                    <option value="basic">Basic</option>
                                    <option value="detailed">Detailed</option>
                                    <option value="all_time_adjustments">All Time Adjustments</option>
                                </select>
                            </div>
                            <div className="races-view-control-item">
                                <label htmlFor="athletes-course-adj-select">Course adj:</label>
                                <select
                                    id="athletes-course-adj-select"
                                    value={courseAdj}
                                    onChange={handleCourseAdjSelect}
                                    aria-label="Course adjustment"
                                >
                                    <option value="none">no adjustment (default)</option>
                                    <option value="seasonal">seasonal adjustments</option>
                                    <option value="full">full event adjustments</option>
                                </select>
                            </div>
                            <div className="races-view-control-item">
                                <label htmlFor="athletes-other-adj-select">Other adj:</label>
                                <select
                                    id="athletes-other-adj-select"
                                    value={otherAdj}
                                    onChange={handleOtherAdjSelect}
                                    aria-label="Other adjustment"
                                >
                                    <option value="none">no adjustment (default)</option>
                                    <option value="age">age adjustments</option>
                                    <option value="sex">sex adjustments</option>
                                    <option value="age_sex">age & sex adjustment</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {selectedCode && loading && <p>Loading athlete data…</p>}
            {error && <p className="athlete-error">{error}</p>}

            {!selectedCode && !loading && !error && (
                <div className="athlete-empty-state">
                    <h2>Find an athlete</h2>
                    <p>Select a runner from the Races page to view their profile and run history here.</p>
                </div>
            )}

            {!loading && !error && selectedCode && (
                <>
                    <section className="athlete-runs-section">
                        <div className="athlete-runs-table-wrapper">
                            {runs.length > 0 ? (
                                <table className="athlete-runs-table">
                                    <thead>
                                        <tr>
                                            {tableColumns.map((col) => {
                                                const isSorted = sortKey === col.key;
                                                const headerClasses = ['athlete-table-header'];
                                                if (col.sticky) headerClasses.push('athlete-date-header');
                                                
                                                // Add blue header styling for adjustment columns
                                                const isAdjustmentColumn = col.key.includes('_adj_time');
                                                if (isAdjustmentColumn) {
                                                    headerClasses.push('sticky-header', 'adjustment-header');
                                                }
                                                
                                                const sortIndicator = isSorted ? (sortDir === 'asc' ? '▲' : '▼') : '';
                                                const style: React.CSSProperties = { textAlign: col.align ?? 'left' };
                                                const targetWidth = isMobile
                                                    ? (col.mobileWidth ?? col.desktopWidth)
                                                    : (col.desktopWidth ?? col.mobileWidth);
                                                if (typeof targetWidth === 'number') {
                                                    const px = `${targetWidth}px`;
                                                    style.width = px;
                                                    style.minWidth = px;
                                                    style.maxWidth = px;
                                                }
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
                                                        <span className="athlete-sort-indicator">{sortIndicator}</span>
                                                    </th>
                                                );
                                            })}
                                        </tr>
                                    </thead>
                                    <tbody>
                                            {rowsToRender.map((row, index) => {
                                            const keyParts = [
                                                pickField(row, ['event_code', 'eventCode']),
                                                pickField(row, ['formatted_date', 'event_date']),
                                                index
                                            ];

                                            return (
                                                <tr 
                                                    key={keyParts.filter(Boolean).join('-') || index}
                                                    className={isHighlightedRow(row) ? 'highlighted-source-row' : ''}
                                                    style={{
                                                        ...(isHighlightedRow(row) ? { fontWeight: 'bold' } : {}),
                                                        cursor: 'pointer'
                                                    }}
                                                    onClick={() => handleRowClick(row)}
                                                    title="Click to view this event"
                                                >
                                                    {tableColumns.map((col) => {
                                                        const value = getCellDisplayValue(row, col.key);
                                                        const alignmentStyle: React.CSSProperties = col.align ? { textAlign: col.align } : {};
                                                        const targetWidth = isMobile
                                                            ? (col.mobileWidth ?? col.desktopWidth)
                                                            : (col.desktopWidth ?? col.mobileWidth);
                                                        if (typeof targetWidth === 'number') {
                                                            const px = `${targetWidth}px`;
                                                            alignmentStyle.width = px;
                                                            alignmentStyle.minWidth = px;
                                                            alignmentStyle.maxWidth = px;
                                                        }
                                                        
                                                        // Apply highlight background to individual cells
                                                        if (isHighlightedRow(row)) {
                                                            alignmentStyle.backgroundColor = '#e6f3ff';
                                                        }
                                                        
                                                        if (col.key === 'date') {
                                                            return (
                                                                <th
                                                                    key={col.key}
                                                                    scope="row"
                                                                    className="athlete-date-cell"
                                                                    style={alignmentStyle}
                                                                >
                                                                    {value}
                                                                </th>
                                                            );
                                                        }
                                                        const cellClass = col.key === 'comment' ? 'comment-cell' : undefined;
                                                        return (
                                                            <td key={col.key} className={cellClass} style={alignmentStyle}>
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
                                <p className="athlete-runs-empty">No run data returned for this athlete.</p>
                            )}
                        </div>
                    </section>
                </>
            )}
        </div>
    );
};

export default Athletes;