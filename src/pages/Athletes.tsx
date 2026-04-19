import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { fetchAthleteBestSummary, fetchAthleteRuns } from '../api/backendAPI';
import './ResultsTable.css';
import AthleteSearch from '../components/AthleteSearch';
import ReactECharts from 'echarts-for-react';

type AthleteRecord = { [key: string]: any };

type AthletesLocationState = {
    athleteCode?: string;
    athleteName?: string;
    fromSearchSelection?: boolean;
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
    if (typeof possible.athleteName === 'string') {
        next.athleteName = possible.athleteName;
    }
    if (typeof possible.fromSearchSelection === 'boolean') {
        next.fromSearchSelection = possible.fromSearchSelection;
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

type AthleteBestSummaryRow = {
    athlete_code?: string;
    best_type?: string;
    event_date?: string;
    rank?: number | string;
    time?: string | number;
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

const formatMonthYearValue = (value: unknown): string => {
    if (value === undefined || value === null || value === '') return '';

    if (typeof value === 'number' && Number.isFinite(value)) {
        const parsed = new Date(value);
        if (!Number.isNaN(parsed.getTime())) {
            const month = monthNames[parsed.getUTCMonth()] || '';
            const year = String(parsed.getUTCFullYear()).slice(-2);
            return `${month}-${year}`;
        }
    }

    const raw = String(value).trim();
    const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (iso) {
        const month = monthNames[Number(iso[2]) - 1] || iso[2];
        const year = iso[1].slice(-2);
        return `${month}-${year}`;
    }

    const slash = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (slash) {
        const month = monthNames[Number(slash[2]) - 1] || slash[2];
        const year = slash[3].slice(-2);
        return `${month}-${year}`;
    }

    const numericRaw = Number(raw);
    if (!Number.isNaN(numericRaw) && raw !== '') {
        const parsed = new Date(numericRaw);
        if (!Number.isNaN(parsed.getTime())) {
            const month = monthNames[parsed.getUTCMonth()] || '';
            const year = String(parsed.getUTCFullYear()).slice(-2);
            return `${month}-${year}`;
        }
    }

    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) {
        const month = monthNames[parsed.getUTCMonth()] || '';
        const year = String(parsed.getUTCFullYear()).slice(-2);
        return `${month}-${year}`;
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
    | 'best_curve_ranking_current'
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
    { key: 'best_curve_ranking_current', label: 'Rank', align: 'center', desktopWidth: 58, mobileWidth: 58},
    { key: 'comment', label: 'Detail', align: 'left', desktopWidth: 80 ,mobileWidth: 80}
];

const adjustmentColumns: ColumnDef[] = [
    { key: 'season_adj_time', label: 'Season', align: 'center', desktopWidth: 70, mobileWidth: 70 },
    { key: 'event_adj_time', label: 'Event', align: 'center', desktopWidth: 70, mobileWidth: 70 },
    { key: 'age_adj_time', label: 'Age', align: 'center', desktopWidth: 70, mobileWidth: 70 },
    { key: 'sex_adj_time', label: 'Sex', align: 'center', desktopWidth: 70, mobileWidth: 70 },
    { key: 'event_age_adj_time', label: 'Ev+Age', align: 'center', desktopWidth: 80, mobileWidth: 80 },
    { key: 'event_sex_adj_time', label: 'Ev+Sex', align: 'center', desktopWidth: 80, mobileWidth: 80 },
    { key: 'event_age_sex_adj_time', label: 'Ev+Age+Sex', align: 'center', desktopWidth: 100, mobileWidth: 100 },
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

const getAdjustmentSeriesSeconds = (row: AthleteRecord, key: string): number | null => {
    const aliasCandidates: Record<string, string[]> = {
        season_adj_time: ['season_adj_time_seconds', 'season_adj_seconds', 'season_adj_time'],
        event_adj_time: ['event_adj_time_seconds', 'event_adj_seconds', 'event_adj_time'],
        age_adj_time: ['age_adj_time_seconds', 'age_adj_seconds', 'age_adj_time'],
        sex_adj_time: ['sex_adj_time_seconds', 'sex_adj_seconds', 'sex_adj_time'],
        event_age_adj_time: [
            'event_age_adj_time_seconds',
            'age_event_adj_time_seconds',
            'event_age_adj_seconds',
            'age_event_adj_seconds',
            'event_age_adj_time',
            'age_event_adj_time'
        ],
        event_sex_adj_time: [
            'event_sex_adj_time_seconds',
            'sex_event_adj_time_seconds',
            'event_sex_adj_seconds',
            'sex_event_adj_seconds',
            'event_sex_adj_time',
            'sex_event_adj_time'
        ],
        event_age_sex_adj_time: [
            'event_age_sex_adj_time_seconds',
            'age_sex_event_adj_time_seconds',
            'event_age_sex_adj_seconds',
            'age_sex_event_adj_seconds',
            'event_age_sex_adj_time',
            'age_sex_event_adj_time'
        ],
        age_sex_adj_time: ['age_sex_adj_time_seconds', 'age_sex_adj_seconds', 'age_sex_adj_time']
    };

    const directCandidates = aliasCandidates[key] ?? [key];
    const directValue = pickField(row, directCandidates);
    const parsedDirect = parseTimeSortValue(directValue);
    if (parsedDirect !== null) {
        return parsedDirect;
    }

    const normalizedKey =
        key === 'age_event_adj_time' ? 'event_age_adj_time' :
        key === 'sex_event_adj_time' ? 'event_sex_adj_time' :
        key === 'age_sex_event_adj_time' ? 'event_age_sex_adj_time' :
        key;

    const adjustmentKey = [
        'season_adj_time',
        'event_adj_time',
        'age_adj_time',
        'sex_adj_time',
        'event_age_adj_time',
        'event_sex_adj_time',
        'event_age_sex_adj_time',
        'age_sex_adj_time'
    ].includes(normalizedKey)
        ? (normalizedKey as ColumnKey)
        : null;

    if (!adjustmentKey) {
        return null;
    }

    return getAdjustmentSeconds(row, adjustmentKey);
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
        case 'best_curve_ranking_current':
            return parseNumericSortValue(
                pickField(row, ['best_curve_ranking_current', 'bestCurveRankingCurrent', 'rank'])
            );
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
    const location = useLocation();
    const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
    // Detect if coming from Lists page via query string
    const fromList = searchParams.get('from_list') === '1';
    // (Removed duplicate useState and related variable declarations)
    const [runs, setRuns] = useState<AthleteRecord[]>([]);
    const [summary, setSummary] = useState<AthleteSummary | null>(null);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<AthleteViewMode>('basic');
    const [courseAdj, setCourseAdj] = useState<CourseAdjOption>('none');
    const [otherAdj, setOtherAdj] = useState<OtherAdjOption>('none');
    const [showPlot, setShowPlot] = useState<boolean>(false);
    const [showProfile, setShowProfile] = useState<boolean>(false);
    const [profileRows, setProfileRows] = useState<AthleteBestSummaryRow[]>([]);
    const [profileLoading, setProfileLoading] = useState<boolean>(false);
    const [profileError, setProfileError] = useState<string | null>(null);
    const [profileJumpDate, setProfileJumpDate] = useState<string | null>(null);
    const [profileJumpRequest, setProfileJumpRequest] = useState<{ date: string; stamp: number } | null>(null);
    const adjustmentKeys = useMemo(() => getAdjustmentKeys(courseAdj, otherAdj), [courseAdj, otherAdj]);
    const [sortKey, setSortKey] = useState<ColumnKey>('date');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
    const [plotEligibilityMode, setPlotEligibilityMode] = useState<'all' | 'eligible' | 'best'>('all');
    const [plotSeriesMode, setPlotSeriesMode] = useState<'events_only' | 'rank_only' | 'both_series'>('events_only');
    const [isPlotExpanded, setIsPlotExpanded] = useState<boolean>(false);
    const [selectedPlotLegendKey, setSelectedPlotLegendKey] = useState<string | null>(null);
    const [plotXZoom, setPlotXZoom] = useState<{ start: number; end: number }>({ start: 0, end: 100 });
    const [plotYZoom, setPlotYZoom] = useState<{ start: number; end: number }>({ start: 0, end: 100 });
    const lastSortTouchAtRef = useRef<number>(0);
    const tableRowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});
    const runsTableWrapperRef = useRef<HTMLDivElement | null>(null);
    const plotChartRef = useRef<any>(null);
    const isMobile = useMediaQuery('(max-width: 640px)');
    const isMobileButtonLayout = useMediaQuery('(max-width: 900px), (pointer: coarse)');
    const navigate = useNavigate();
    const locationState = toAthletesLocationState(location.state ?? {});
    const selectedCode = locationState.athleteCode || searchParams.get('athlete_code') || undefined;
    const activeSelectedCode = selectedCode;
    const initialSearchQuery = locationState.athleteName;
    const shouldSuppressInitialSearch = Boolean((initialSearchQuery && initialSearchQuery.trim()) || activeSelectedCode);
    const fromRaces = locationState.from === 'races';
    const returnTarget = locationState.returnTo;
    // Use event_date from query string if coming from Lists
    const sourceEvent = locationState.sourceEvent || {
        eventName: searchParams.get('source_event'),
        eventDate: searchParams.get('event_date') || searchParams.get('source_date')
    };
    const hasSourceEvent = Boolean(sourceEvent?.eventName || sourceEvent?.eventDate);

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
        if (!activeSelectedCode) {
            setRuns([]);
            setSummary(null);
            setError(null);
            setLoading(false);
            setShowPlot(false);
            setShowProfile(false);
            return () => {
                cancelled = true;
            };
        }

        const loadAthlete = async () => {
            try {
                setLoading(true);
                setError(null);
                const payload = await fetchAthleteRuns(activeSelectedCode);
                if (!cancelled) {
                    const normalized = normalizeAthleteResponse(payload, activeSelectedCode);
                    setRuns(normalized.runs);
                    setSummary(normalized.summary);
                }
            } catch (err) {
                if (!cancelled) {
                    console.error('Error fetching athlete runs:', err);
                    setError('Unable to load athlete runs right now.');
                    setRuns([]);
                    setSummary(activeSelectedCode ? { athlete_code: activeSelectedCode } : null);
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
    }, [activeSelectedCode]);

    useEffect(() => {
        let cancelled = false;
        if (!showProfile || !activeSelectedCode) {
            return () => {
                cancelled = true;
            };
        }

        const loadProfile = async () => {
            try {
                setProfileLoading(true);
                setProfileError(null);
                const payload = await fetchAthleteBestSummary(activeSelectedCode);
                if (!cancelled) {
                    setProfileRows(Array.isArray(payload) ? payload : []);
                }
            } catch (err) {
                if (!cancelled) {
                    console.error('Error fetching athlete best summary:', err);
                    setProfileError('Unable to load profile summary right now.');
                    setProfileRows([]);
                }
            } finally {
                if (!cancelled) {
                    setProfileLoading(false);
                }
            }
        };

        loadProfile();
        return () => {
            cancelled = true;
        };
    }, [showProfile, activeSelectedCode]);

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
        if (fromRaces && (locationState.fromSearchSelection || !hasSourceEvent) && runs.length > 0) {
            const mostRecentRow = sortedRuns.length > 0 ? sortedRuns[0] : runs[0];
            const eventCode = pickField(mostRecentRow, ['event_code', 'eventCode']);
            const eventName = pickField(mostRecentRow, ['event_name', 'eventName', 'event_display', 'eventDisplay', 'event']);
            const eventDate = pickField(mostRecentRow, ['formatted_date', 'event_date', 'date']);
            if ((eventCode || eventName) && eventDate) {
                const params = new URLSearchParams();
                if (eventCode) {
                    params.set('event_code', String(eventCode));
                } else if (eventName) {
                    params.set('event_name', String(eventName));
                }
                params.set('date', String(eventDate));
                if (activeSelectedCode) {
                    params.set('highlight_athlete', String(activeSelectedCode));
                }
                navigate(`/races?${params.toString()}`);
                return;
            }
        }
        if (returnTarget?.pathname) {
            const params = new URLSearchParams(returnTarget.search || '');
            if (activeSelectedCode) {
                params.set('highlight_athlete', String(activeSelectedCode));
            }
            const qs = params.toString();
            navigate(`${returnTarget.pathname}${qs ? `?${qs}` : ''}`);
        } else {
            navigate('/races');
        }
    };

    const handleBackNavigation = () => {
        if (fromRaces) {
            handleBackToRaces();
            return;
        }
        navigate('/lists');
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
        const athleteCode = pickField(row, ['athlete_code', 'athleteCode']) || activeSelectedCode;
        
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
    const fallbackName = summary?.athlete_code ? `Athlete ${summary.athlete_code}` : activeSelectedCode ? `Athlete ${activeSelectedCode}` : 'Athlete';
    const detailTitle = headerName || fallbackName;
    // Display name (CSS handles width/padding on mobile)
    const displayName = detailTitle;

    const showHeader = Boolean(activeSelectedCode);
    const headerCode = pickField(latestRun, ['athlete_code', 'athleteCode', 'runner_code', 'code']) || summary?.athlete_code || activeSelectedCode || '';
    const headerClubRaw = pickField(latestRun, ['club']) || summary?.club;
    const headerClub = headerClubRaw ? String(headerClubRaw) : '<no club>';

    const renderCell = (value: unknown): string => {
        if (value === undefined || value === null) return '--';
        const str = String(value);
        return str.trim() === '' ? '--' : str;
    };

    const profileTypeMap = useMemo(() => {
        const map: Record<string, AthleteBestSummaryRow> = {};
        for (const row of profileRows) {
            if (!row || !row.best_type) continue;
            map[String(row.best_type)] = row;
        }
        return map;
    }, [profileRows]);

    const formatProfileTime = (value: unknown): string => {
        if (value === undefined || value === null || value === '') return '--';
        return renderCell(formatTimeValue(value));
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
            case 'best_curve_ranking_current':
                return renderCell(pickField(row, ['best_curve_ranking_current', 'bestCurveRankingCurrent', 'rank']));
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
            const allTimeAdjustmentColumns = [
                ...adjustmentColumns.filter((col) => col.key !== 'event_age_sex_adj_time'),
                ...adjustmentColumns.filter((col) => col.key === 'event_age_sex_adj_time')
            ];
            return [...baseAthleteColumns, ...allTimeAdjustmentColumns];
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

    const selectedPlotAdjustmentKey = useMemo(() => {
        if (courseAdj === 'none' && otherAdj === 'none') {
            return null;
        }
        return adjustmentKeys[0] ?? null;
    }, [courseAdj, otherAdj, adjustmentKeys]);

    const plotPoints = useMemo(() => {
        const points = runs
            .map((row) => {
                const rawDate = pickField(row, ['formatted_date', 'event_date', 'date']);
                const x = parseDateSortValue(rawDate);
                const y = selectedPlotAdjustmentKey
                    ? getAdjustmentSeriesSeconds(row, selectedPlotAdjustmentKey)
                    : parseTimeSortValue(
                        pickField(row, ['time', 'time_display', 'finish_time', 'gun_time']) ??
                        pickField(row, ['time_seconds', 'adj_time_seconds'])
                    );
                if (x === null || y === null) {
                    return null;
                }
                return { x, y, row };
            })
            .filter((point): point is { x: number; y: number; row: AthleteRecord } => point !== null)
            .sort((a, b) => a.x - b.x);

        return points;
    }, [runs, selectedPlotAdjustmentKey]);

    const canTogglePlotExpand = !isMobileButtonLayout;
    const plotChartHeight = isMobile ? '8.5cm' : isPlotExpanded ? '14cm' : '10cm';
    const plotPanelMaxWidth = isMobile ? '100%' : isPlotExpanded ? '100%' : '18cm';
    const plotControlsMaxWidth = isMobile ? '100%' : '18cm';
    const plotChartMinWidth = isMobile ? '10cm' : isPlotExpanded ? '18cm' : '100%';

    const hasTimeRatioForPlot = (row: AthleteRecord): boolean => {
        const timeRatio = pickField(row, ['time_ratio', 'timeRatio']);
        return !(timeRatio === undefined || timeRatio === null || String(timeRatio).trim() === '');
    };

    const plotPointsFilteredByEligibility = useMemo(() => {
        if (plotEligibilityMode === 'all') {
            return plotPoints;
        }

        if (plotEligibilityMode === 'eligible') {
            return plotPoints.filter((point) => hasTimeRatioForPlot(point.row));
        }

        const rollingWindowMs = 90 * 24 * 60 * 60 * 1000;
        const bestPointKeys = new Set<string>();

        for (let startIndex = 0; startIndex < plotPoints.length; startIndex += 1) {
            const windowStart = plotPoints[startIndex].x;
            const windowEnd = windowStart + rollingWindowMs;

            let bestIndex = startIndex;
            let scanIndex = startIndex;

            while (scanIndex < plotPoints.length && plotPoints[scanIndex].x <= windowEnd) {
                const candidate = plotPoints[scanIndex];
                const currentBest = plotPoints[bestIndex];
                if (candidate.y < currentBest.y || (candidate.y === currentBest.y && candidate.x < currentBest.x)) {
                    bestIndex = scanIndex;
                }
                scanIndex += 1;
            }

            const bestPoint = plotPoints[bestIndex];
            bestPointKeys.add(`${bestPoint.x}-${bestPoint.y}-${bestIndex}`);
        }

        return plotPoints.filter((point, index) => bestPointKeys.has(`${point.x}-${point.y}-${index}`));
    }, [plotPoints, plotEligibilityMode]);

    const getPlotEventName = (row: AthleteRecord): string => {
        const raw = pickField(row, ['event_display', 'eventDisplay', 'event_name', 'eventName', 'event']);
        const name = raw === undefined || raw === null ? '' : String(raw).trim();
        return name || 'Unknown event';
    };

    type CurveRankTypeKey = 'actual' | 'event_adj' | 'event_age_adj' | 'event_sex_adj' | 'event_age_sex_adj';

    const normalizeCurveRankType = (rawType: unknown): CurveRankTypeKey => {
        const normalized = String(rawType ?? '').toLowerCase().trim().replace(/[^a-z]/g, '');

        if (normalized === '' || normalized === 'actual' || normalized === 'raw') {
            return 'actual';
        }
        if (normalized === 'eventadjusted' || normalized === 'eventadj' || normalized === 'e') {
            return 'event_adj';
        }
        if (normalized === 'eventageadjusted' || normalized === 'eventageadj' || normalized === 'ageeventadjusted' || normalized === 'ageeventadj' || normalized === 'ea' || normalized === 'ae') {
            return 'event_age_adj';
        }
        if (normalized === 'eventsexadjusted' || normalized === 'eventsexadj' || normalized === 'sexeventadjusted' || normalized === 'sexeventadj' || normalized === 'es') {
            return 'event_sex_adj';
        }
        if (normalized === 'eventagesexadjusted' || normalized === 'eventagesexadj' || normalized === 'ageeventsexadjusted' || normalized === 'ageeventsexadj' || normalized === 'sexageeventadjusted' || normalized === 'eas' || normalized === 'aes') {
            return 'event_age_sex_adj';
        }

        return 'actual';
    };

    const plotEventPalette = ['#00B0FF', '#00E676', '#FFEA00', '#FF6D00', '#FF1744'];
    const plotOtherEventColor = '#6b7280';
    const plotOtherLegendKey = '__other_events__';
    const curveRankTypeColorMap: Record<CurveRankTypeKey, string> = {
        actual: '#1e3a8a',
        event_adj: '#8B4513',
        event_age_adj: '#00E676',
        event_sex_adj: '#FF6D00',
        event_age_sex_adj: '#FF1744'
    };
    const curveRankLegendEntries: Array<{ key: CurveRankTypeKey; label: string }> = [
        { key: 'actual', label: 'Act' },
        { key: 'event_adj', label: 'E' },
        { key: 'event_age_adj', label: 'AE' },
        { key: 'event_sex_adj', label: 'ES' },
        { key: 'event_age_sex_adj', label: 'AES' }
    ];

    const getCurveRankDiamondColor = (row: AthleteRecord): string => {
        const rankTypeRaw = pickField(row, ['best_curve_ranking_current_type', 'bestCurveRankingCurrentType']);
        const typeKey = normalizeCurveRankType(rankTypeRaw);
        return curveRankTypeColorMap[typeKey];
    };

    const plotEventLegendEntries = useMemo(() => {
        const counts = new Map<string, number>();
        plotPointsFilteredByEligibility.forEach((point) => {
            const eventName = getPlotEventName(point.row);
            counts.set(eventName, (counts.get(eventName) ?? 0) + 1);
        });

        const ranked = Array.from(counts.entries())
            .sort((a, b) => (b[1] - a[1]) || a[0].localeCompare(b[0]))
            .slice(0, 5);

        return ranked.map(([eventName, count], index) => ({
            eventName,
            count,
            color: plotEventPalette[index]
        }));
    }, [plotPointsFilteredByEligibility]);

    const plotEventColorByName = useMemo(() => {
        const colorMap = new Map<string, string>();
        plotEventLegendEntries.forEach((entry) => {
            colorMap.set(entry.eventName, entry.color);
        });
        return colorMap;
    }, [plotEventLegendEntries]);

    const plotOtherEventCount = useMemo(() => {
        let count = 0;
        plotPointsFilteredByEligibility.forEach((point) => {
            const eventName = getPlotEventName(point.row);
            if (!plotEventColorByName.has(eventName)) {
                count += 1;
            }
        });
        return count;
    }, [plotPointsFilteredByEligibility, plotEventColorByName]);

    const isPointVisibleForLegendSelection = (row: AthleteRecord): boolean => {
        if (!selectedPlotLegendKey) {
            return true;
        }
        const eventName = getPlotEventName(row);
        if (selectedPlotLegendKey === plotOtherLegendKey) {
            return !plotEventColorByName.has(eventName);
        }
        return eventName === selectedPlotLegendKey;
    };

    const toggleLegendSelection = (legendKey: string) => {
        setSelectedPlotLegendKey((prev) => (prev === legendKey ? null : legendKey));
    };
    

    const clampPercent = (value: number) => Math.max(0, Math.min(100, value));

    const normalizeZoomWindow = (start: number, end: number, minWindow = 2) => {
        let nextStart = clampPercent(start);
        let nextEnd = clampPercent(end);
        if (nextEnd < nextStart) {
            [nextStart, nextEnd] = [nextEnd, nextStart];
        }
        let windowSize = nextEnd - nextStart;
        if (windowSize < minWindow) {
            const center = (nextStart + nextEnd) / 2;
            nextStart = clampPercent(center - minWindow / 2);
            nextEnd = clampPercent(center + minWindow / 2);
            windowSize = nextEnd - nextStart;
            if (windowSize < minWindow) {
                if (nextStart === 0) {
                    nextEnd = minWindow;
                } else if (nextEnd === 100) {
                    nextStart = 100 - minWindow;
                }
            }
        }
        return { start: clampPercent(nextStart), end: clampPercent(nextEnd) };
    };

    const updateAxisZoom = (axis: 'x' | 'y', nextRange: { start: number; end: number }) => {
        const normalized = normalizeZoomWindow(nextRange.start, nextRange.end);
        if (axis === 'x') {
            setPlotXZoom(normalized);
        } else {
            setPlotYZoom(normalized);
        }

        const chart = plotChartRef.current?.getEchartsInstance?.();
        if (chart) {
            chart.dispatchAction({
                type: 'dataZoom',
                dataZoomId: axis === 'x' ? 'xZoom' : 'yZoom',
                start: normalized.start,
                end: normalized.end
            });
        }
    };

    const zoomAxisIn = (axis: 'x' | 'y') => {
        const source = axis === 'x' ? plotXZoom : plotYZoom;
        const windowSize = source.end - source.start;
        const delta = windowSize * 0.12;
        updateAxisZoom(axis, { start: source.start + delta, end: source.end - delta });
    };

    const zoomAxisOut = (axis: 'x' | 'y') => {
        const source = axis === 'x' ? plotXZoom : plotYZoom;
        const windowSize = source.end - source.start;
        const delta = windowSize * 0.15;
        updateAxisZoom(axis, { start: source.start - delta, end: source.end + delta });
    };

    const shiftAxisLeft = (axis: 'x' | 'y') => {
        const source = axis === 'x' ? plotXZoom : plotYZoom;
        const windowSize = source.end - source.start;
        const delta = Math.max(windowSize * 0.2, 1);
        updateAxisZoom(axis, { start: source.start - delta, end: source.end - delta });
    };

    const shiftAxisRight = (axis: 'x' | 'y') => {
        const source = axis === 'x' ? plotXZoom : plotYZoom;
        const windowSize = source.end - source.start;
        const delta = Math.max(windowSize * 0.2, 1);
        updateAxisZoom(axis, { start: source.start + delta, end: source.end + delta });
    };

    const shiftYAxisUp = () => {
        shiftAxisLeft('y');
    };

    const shiftYAxisDown = () => {
        shiftAxisRight('y');
    };

    const resetPlotZoom = () => {
        const resetRange = { start: 0, end: 100 };
        setPlotXZoom(resetRange);
        setPlotYZoom(resetRange);

        const chart = plotChartRef.current?.getEchartsInstance?.();
        if (chart) {
            chart.dispatchAction({
                type: 'dataZoom',
                dataZoomId: 'xZoom',
                start: resetRange.start,
                end: resetRange.end
            });
            chart.dispatchAction({
                type: 'dataZoom',
                dataZoomId: 'yZoom',
                start: resetRange.start,
                end: resetRange.end
            });
        }
    };

    useEffect(() => {
        setPlotXZoom({ start: 0, end: 100 });
        setPlotYZoom({ start: 0, end: 100 });
        setPlotEligibilityMode('all');
        setPlotSeriesMode('events_only');
        setSelectedPlotLegendKey(null);
    }, [activeSelectedCode]);

    const cyclePlotEligibilityMode = () => {
        setPlotEligibilityMode((prev) => {
            if (prev === 'all') return 'eligible';
            if (prev === 'eligible') return 'best';
            return 'all';
        });
    };

    const cyclePlotSeriesMode = () => {
        setPlotSeriesMode((prev) => {
            if (prev === 'events_only') return 'rank_only';
            if (prev === 'rank_only') return 'both_series';
            return 'events_only';
        });
    };

    const togglePlotExpanded = () => {
        if (!canTogglePlotExpand) {
            return;
        }
        setIsPlotExpanded((prev) => !prev);
    };

    const handlePlotDataZoom = (params: any) => {
        const events = Array.isArray(params?.batch) ? params.batch : [params];
        events.forEach((event: any) => {
            const id = String(event?.dataZoomId ?? '');
            const start = Number(event?.start);
            const end = Number(event?.end);
            if (!Number.isFinite(start) || !Number.isFinite(end)) {
                return;
            }
            const normalized = normalizeZoomWindow(start, end);
            if (id.startsWith('xZoom')) {
                setPlotXZoom((prev) =>
                    prev.start === normalized.start && prev.end === normalized.end ? prev : normalized
                );
            }
            if (id.startsWith('yZoom')) {
                setPlotYZoom((prev) =>
                    prev.start === normalized.start && prev.end === normalized.end ? prev : normalized
                );
            }
        });
    };

    const jumpToRunHistoryRow = (row: AthleteRecord | null | undefined) => {
        if (!row) return;
        const rowDate = pickField(row, ['formatted_date', 'event_date', 'date']);
        const targetDate = formatDateValue(rowDate);
        if (!targetDate) return;

        setShowProfile(false);
        setShowPlot(false);
        setProfileJumpDate(targetDate);
        setProfileJumpRequest({ date: targetDate, stamp: Date.now() });
    };

    const plotOption = useMemo(() => {
        if (plotPointsFilteredByEligibility.length === 0) return null;

        const minX = plotPointsFilteredByEligibility[0].x;
        const maxX = plotPointsFilteredByEligibility[plotPointsFilteredByEligibility.length - 1].x;
        const fullXRange = Math.max(1, maxX - minX);
        const visibleXRange = Math.max(1, fullXRange * ((plotXZoom.end - plotXZoom.start) / 100));
        const xAxisIntervalMs = Math.max(1, Math.ceil(visibleXRange / 9));
        const yStepSeconds = 5 * 60;
        const rawMinY = Math.min(...plotPointsFilteredByEligibility.map((point) => point.y));
        const rawMaxY = Math.max(...plotPointsFilteredByEligibility.map((point) => point.y));
        const minY = Math.floor(rawMinY / yStepSeconds) * yStepSeconds;
        const maxYBase = Math.ceil(rawMaxY / yStepSeconds) * yStepSeconds;
        const maxY = maxYBase === minY ? minY + yStepSeconds : maxYBase;
        const curveRankData = plotPointsFilteredByEligibility
            .map((point) => {
                const curveRank = parseNumericSortValue(
                    pickField(point.row, ['best_curve_ranking_current', 'bestCurveRankingCurrent', 'rank'])
                );
                if (curveRank === null) {
                    return null;
                }
                return {
                    value: [point.x, curveRank],
                    row: point.row,
                    itemStyle: {
                        color: getCurveRankDiamondColor(point.row),
                        borderColor: getCurveRankDiamondColor(point.row),
                        borderWidth: 0.6
                    }
                };
            })
            .filter((point): point is { value: [number, number]; row: AthleteRecord; itemStyle: { color: string; borderColor: string; borderWidth: number } } => point !== null)
            .filter((point) => isPointVisibleForLegendSelection(point.row));

        const curveRankValues = curveRankData.map((point) => point.value[1]);
        const curveRankMinRaw = curveRankValues.length > 0 ? Math.min(...curveRankValues) : 0;
        const curveRankMaxRaw = curveRankValues.length > 0 ? Math.max(...curveRankValues) : 10;
        const curveRankMinRounded = Math.floor(curveRankMinRaw / 10) * 10;
        const curveRankMaxRounded = Math.ceil(curveRankMaxRaw / 10) * 10;
        const curveRankMin = Math.min(curveRankMinRounded, curveRankMaxRounded - 10);
        const curveRankMax = Math.max(curveRankMin + 10, curveRankMaxRounded);
        const showEventSeries = plotSeriesMode !== 'rank_only';
        const showCurveRankSeries = plotSeriesMode !== 'events_only';
        const eventSeriesData = plotPointsFilteredByEligibility.map((point) => ({
            value: [point.x, point.y],
            row: point.row,
            itemStyle: {
                color: plotEventColorByName.get(getPlotEventName(point.row)) ?? plotOtherEventColor
            }
        })).filter((point) => isPointVisibleForLegendSelection(point.row));

        return {
            animation: false,
            grid: {
                left: 56,
                right: 64,
                top: 22,
                bottom: 66,
                containLabel: false,
            },
            tooltip: {
                trigger: 'item',
                confine: true,
                extraCssText: 'z-index: 5000; pointer-events: none;',
                position: (point: number[], _params: any, _dom: any, _rect: any, size: any) => {
                    const margin = 10;
                    const viewSize: number[] = size?.viewSize ?? [0, 0];
                    const contentSize: number[] = size?.contentSize ?? [0, 0];
                    const pointX = Array.isArray(point) ? Number(point[0] ?? 0) : 0;
                    const pointY = Array.isArray(point) ? Number(point[1] ?? 0) : 0;

                    let x = pointX + margin;
                    let y = pointY - contentSize[1] - margin;

                    if (y < margin) {
                        y = pointY + margin;
                    }
                    if (x + contentSize[0] > viewSize[0] - margin) {
                        x = Math.max(margin, pointX - contentSize[0] - margin);
                    }

                    x = Math.max(margin, Math.min(x, Math.max(margin, viewSize[0] - contentSize[0] - margin)));
                    y = Math.max(margin, Math.min(y, Math.max(margin, viewSize[1] - contentSize[1] - margin)));

                    return [x, y];
                },
                formatter: (params: any) => {
                    const row = params?.data?.row;
                    const eventDate = formatDateValue(pickField(row, ['formatted_date', 'event_date', 'date']));
                    const eventName = String(pickField(row, ['event_display', 'eventDisplay', 'event_name', 'eventName', 'event']) ?? 'Event');
                    const rawTime =
                        pickField(row, ['time', 'time_display', 'finish_time', 'gun_time']) ??
                        pickField(row, ['time_seconds', 'adj_time_seconds']) ??
                        params?.value?.[1];

                    const eventAdj = formatTimeValue(getAdjustmentSeriesSeconds(row, 'event_adj_time'));
                    const ageAdj = formatTimeValue(getAdjustmentSeriesSeconds(row, 'age_adj_time'));
                    const sexAdj = formatTimeValue(getAdjustmentSeriesSeconds(row, 'sex_adj_time'));
                    const ageEventAdj = formatTimeValue(getAdjustmentSeriesSeconds(row, 'event_age_adj_time'));
                    const ageSexAdj = formatTimeValue(getAdjustmentSeriesSeconds(row, 'age_sex_adj_time'));
                    const sexEventAdj = formatTimeValue(getAdjustmentSeriesSeconds(row, 'event_sex_adj_time'));
                    const ageSexEventAdj = formatTimeValue(getAdjustmentSeriesSeconds(row, 'event_age_sex_adj_time'));
                    const curveRank = pickField(row, ['best_curve_ranking_current', 'bestCurveRankingCurrent', 'rank']);

                    const escapeHtml = (value: unknown): string => String(value ?? '')
                        .replace(/&/g, '&amp;')
                        .replace(/</g, '&lt;')
                        .replace(/>/g, '&gt;')
                        .replace(/"/g, '&quot;')
                        .replace(/'/g, '&#39;');

                    const tooltipRows: Array<{ label: string; value: string }> = [
                        { label: 'Date', value: eventDate },
                        { label: 'Event', value: eventName },
                        { label: 'Time', value: formatTimeValue(rawTime) },
                        { label: 'Event Adj', value: eventAdj },
                        { label: 'Age Adj', value: ageAdj },
                        { label: 'Sex Adj', value: sexAdj },
                        { label: 'Age_event_adj', value: ageEventAdj },
                        { label: 'Age_sex_adj', value: ageSexAdj },
                        { label: 'Sex_event_adj', value: sexEventAdj },
                        { label: 'Age_sex_event_adj', value: ageSexEventAdj },
                        { label: 'Curve Rank', value: curveRank === null || curveRank === undefined || String(curveRank).trim() === '' ? '-' : String(curveRank) }
                    ];

                    const rowsHtml = tooltipRows
                        .map(({ label, value }) => (
                            `<div style="display:grid;grid-template-columns:auto minmax(6.5ch,1fr);column-gap:0.6rem;align-items:baseline;line-height:1.2;">` +
                            `<span style="font-weight:700;white-space:nowrap;">${escapeHtml(label)}:</span>` +
                            `<span style="text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums;">${escapeHtml(value)}</span>` +
                            `</div>`
                        ))
                        .join('');

                    return `<div style="font-size:12px;line-height:1.2;">${rowsHtml}</div>`;
                }
            },
            xAxis: {
                type: 'time',
                min: minX,
                max: maxX,
                splitNumber: 10,
                interval: xAxisIntervalMs,
                minInterval: xAxisIntervalMs,
                splitLine: {
                    show: true,
                    lineStyle: {
                        color: '#d1d5db',
                        width: 0.6
                    }
                },
                name: 'Date',
                nameLocation: 'middle',
                nameGap: 38,
                axisLabel: {
                    hideOverlap: true,
                    formatter: (value: number) => formatMonthYearValue(value)
                }
            },
            yAxis: [
                {
                    type: 'value',
                    min: minY,
                    max: maxY,
                    splitNumber: 12,
                    minInterval: 60,
                    minorTick: {
                        show: true,
                        splitNumber: 4
                    },
                    minorSplitLine: {
                        show: true,
                        lineStyle: {
                            color: '#e5e7eb',
                            width: 0.4
                        }
                    },
                    splitLine: {
                        show: true,
                        lineStyle: {
                            color: '#d1d5db',
                            width: 0.6
                        }
                    },
                    inverse: true,
                    name: 'Time',
                    nameLocation: 'middle',
                    nameGap: 46,
                    axisLabel: {
                        formatter: (value: number) => formatTimeValue(value)
                    }
                },
                {
                    type: 'value',
                    position: 'right',
                    min: curveRankMin,
                    max: curveRankMax,
                    minInterval: 1,
                    splitNumber: 8,
                    inverse: false,
                    name: 'Curve Rank',
                    nameLocation: 'middle',
                    nameGap: 42,
                    splitLine: {
                        show: false
                    },
                    axisLabel: {
                        formatter: (value: number) => String(Math.round(value))
                    }
                }
            ],
            dataZoom: [
                { id: 'xZoom', type: 'inside', xAxisIndex: 0, filterMode: 'none', start: plotXZoom.start, end: plotXZoom.end },
                { id: 'yZoom', type: 'inside', yAxisIndex: 0, filterMode: 'none', start: plotYZoom.start, end: plotYZoom.end },
                // { id: 'xZoomSlider', type: 'slider', xAxisIndex: 0, filterMode: 'none', start: plotXZoom.start, end: plotXZoom.end, height: 16, bottom: 18 },
                // { id: 'yZoomSlider', type: 'slider', yAxisIndex: 0, filterMode: 'none', start: plotYZoom.start, end: plotYZoom.end, width: 14, right: 8 }
            ],
            series: [
                ...(showEventSeries ? [{
                    type: 'scatter',
                    symbolSize: isMobile ? 8 : 7,
                    itemStyle: {
                        borderColor: '#1e3a8a',
                        borderWidth: 0.8,
                    },
                    data: eventSeriesData,
                }] : []),
                ...(showCurveRankSeries ? [{
                    type: 'line',
                    yAxisIndex: 1,
                    showSymbol: true,
                    symbol: 'diamond',
                    symbolSize: isMobile ? 8 : 7,
                    connectNulls: true,
                    lineStyle: {
                        type: 'dotted',
                        width: 1,
                        color: '#d1d5db'
                    },
                    itemStyle: {
                        borderWidth: 0.6
                    },
                    data: curveRankData
                }] : [])
            ]
        };
    }, [plotPointsFilteredByEligibility, isMobile, plotXZoom, plotYZoom, plotEventColorByName, selectedPlotLegendKey, plotSeriesMode]);

    const makeTableRowKey = (row: AthleteRecord, index: number): string => {
        const keyParts = [
            pickField(row, ['event_code', 'eventCode']),
            pickField(row, ['formatted_date', 'event_date']),
            index
        ];
        return keyParts.filter(Boolean).join('-') || String(index);
    };

    const handleProfileRankCellClick = (cell?: AthleteBestSummaryRow) => {
        if (!cell?.event_date || rowsToRender.length === 0) {
            return;
        }
        const targetDate = formatDateValue(cell.event_date);

        const targetIndex = rowsToRender.findIndex((row) => {
            const rowDate = formatDateValue(pickField(row, ['formatted_date', 'event_date', 'date']));
            return rowDate === targetDate;
        });

        if (targetIndex < 0) {
            return;
        }

        setShowProfile(false);
        setProfileJumpDate(targetDate);
        setProfileJumpRequest({ date: targetDate, stamp: Date.now() });
    };

    useEffect(() => {
        if (showProfile || !profileJumpRequest) {
            return;
        }
        const rowElement = runsTableWrapperRef.current?.querySelector<HTMLTableRowElement>(`tr[data-run-date="${profileJumpRequest.date}"]`);
        if (!rowElement) {
            return;
        }

        rowElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        const clearRequestTimer = window.setTimeout(() => setProfileJumpRequest(null), 250);
        const clearHighlightTimer = window.setTimeout(() => setProfileJumpDate(null), 3500);

        return () => {
            window.clearTimeout(clearRequestTimer);
            window.clearTimeout(clearHighlightTimer);
        };
    }, [showProfile, profileJumpRequest, rowsToRender]);

    const profileButtonTransform = isMobileButtonLayout
        ? 'translateX(-1.2cm) translateY(-3.5cm)'
        : 'translateX(-26.5cm)';
    const currentPanelMode: 'table' | 'profile' | 'plot' = showProfile ? 'profile' : (showPlot ? 'plot' : 'table');
    const nextPanelMode: 'table' | 'profile' | 'plot' =
        currentPanelMode === 'table' ? 'profile' : (currentPanelMode === 'profile' ? 'plot' : 'table');
    const panelToggleLabel = nextPanelMode === 'table' ? 'Table' : (nextPanelMode === 'profile' ? 'Profile' : 'Plot');
    const handlePanelCycle = () => {
        if (!showProfile && !showPlot) {
            setShowProfile(true);
            setShowPlot(false);
            return;
        }
        if (showProfile) {
            setShowProfile(false);
            setShowPlot(true);
            return;
        }
        setShowPlot(false);
        setShowProfile(false);
    };
    const showBackButton = showHeader;

    return (
        <div className="page-content athletes-page">
            
            <div className="athlete-header">
                    {showBackButton && (
                        <button
                            type="button"
                            className="athletes-back-button"
                            aria-label={fromRaces ? "Back to race" : "Back to lists"}
                            title={fromRaces ? "Back to race" : "Back to lists"}
                            onClick={handleBackNavigation}
                            onTouchEnd={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                handleBackNavigation();
                            }}
                            style={{
                                marginRight: '0.5em',

                                fontSize: isMobile ? '1.35rem' : '1.2rem',
                                border: '1px solid #222',
                                borderRadius: '8px',
                                background: '#fff',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                boxSizing: 'border-box',
                                width: isMobile ? '30px' : '30px',
                                height: isMobile ? '30px' : '30px',
                                minWidth: isMobile ? '30px' : '30px',
                                minHeight: isMobile ? '30x' : '30px',
                                position: 'relative',
                                flexShrink: 0,
                                zIndex: 1200,
                                pointerEvents: 'auto',
                                touchAction: 'manipulation',
                                WebkitTapHighlightColor: 'transparent',
                                userSelect: 'none',
                            }}
                        >
                            &#8592;
                        </button>
                    )}
                    <div className={`athlete-header-main ${showHeader ? 'athlete-header-main--selected' : 'athlete-header-main--search'}`}>
                        <div className="athlete-header-text">
                            <div className="athlete-header-title" title="Athlete Search" style={{ display: 'flex', alignItems: 'center', gap: '0.5em', overflow: 'visible' }}>
                                <AthleteSearch inputId="athletes-search-input" onSelect={(athleteCode) => {
                                    const params = new URLSearchParams();
                                    params.set('athlete_code', String(athleteCode));
                                    navigate(`/athletes?${params.toString()}`, {
                                        state: {
                                            athleteCode: String(athleteCode),
                                            fromSearchSelection: true,
                                            from: locationState.from,
                                            returnTo: locationState.returnTo,
                                        }
                                    });
                                }} placeholder="Enter Search" initialQuery={initialSearchQuery} suppressInitialSearch={shouldSuppressInitialSearch} />
                                {showHeader && sexSymbol && <span className="athlete-header-sex" aria-label="Athlete sex">{sexSymbol}</span>}
                            </div>
                            {showHeader && headerCode && (
                                <div className="athlete-header-code" title="Athlete Code">
                                    {headerCode}
                                </div>
                            )}
                            {showHeader && (
                                <div className="athlete-header-club" title="Athlete's Club">
                                    {headerClub}
                                </div>
                            )}
                            {showHeader && formattedLatestAge && (
                                <div className="athlete-header-age" title="Estimated Age">
                                    Estm.Age: {formattedLatestAge}
                                </div>
                            )}
                            {showHeader && totalRunsCount !== undefined && (
                                <div className="athlete-header-total-runs" title="Total runs recorded">
                                    Total runs: {totalRunsCount}
                                </div>
                            )}
                        </div>
                        
                        <div className="athlete-view-control races-view-control">
                            {showHeader && (
                                <>
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
                                        <button
                                            id="athletes-view-cycle-btn"
                                            type="button"
                                            onClick={handlePanelCycle}
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
                                                padding: 0,
                                                transform: profileButtonTransform
                                            }}
                                        >
                                            {panelToggleLabel}
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>

            {activeSelectedCode && loading && <p>Loading athlete data…</p>}
            {error && <p className="athlete-error">{error}</p>}

            {/* When no athlete selected, we show only the search box in the header above. Empty message removed. */}

            {!loading && !error && activeSelectedCode && (
                <>
                    <section className="athlete-runs-section">
                        {showPlot ? (
                            <>
                            <div
                                style={{
                                    width: '100%',
                                    maxWidth: plotControlsMaxWidth,
                                    display: 'flex',
                                    position: 'relative',
                                    zIndex: isMobile ? 10 : 1400,
                                    justifyContent: 'flex-end',
                                    paddingLeft: '0.3cm',
                                    paddingRight: isMobile ? '2.5cm' : '5.3cm',
                                    boxSizing: 'border-box',
                                    marginBottom: '0.2rem',
                                    overflow: 'visible'
                                }}
                            >
                                <div
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.35rem',
                                        position: 'relative',
                                        zIndex: isMobile ? 20 : 1401,
                                        transform: isMobile ? 'translate(2.1cm, -2cm)' : 'translate(3.0cm, -0.7cm)'
                                    }}
                                >
                                    <span
                                        style={{
                                            fontSize: '0.78rem',
                                            fontWeight: 700,
                                            color: '#111827'
                                        }}
                                    >
                                        Show:
                                    </span>
                                    <button
                                        type="button"
                                        onClick={cyclePlotEligibilityMode}
                                        style={{
                                            height: '1.9rem',
                                            border: '1px solid #9ca3af',
                                            borderRadius: '6px',
                                            background: '#fff',
                                            color: '#111827',
                                            fontSize: '0.78rem',
                                            fontWeight: 700,
                                            cursor: 'pointer',
                                            padding: '0 0.65rem'
                                        }}
                                    >
                                        {plotEligibilityMode === 'all' ? 'All' : plotEligibilityMode === 'eligible' ? 'Eligible' : 'Best'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={cyclePlotSeriesMode}
                                        style={{
                                            height: '1.9rem',
                                            border: '1px solid #9ca3af',
                                            borderRadius: '6px',
                                            background: '#fff',
                                            color: '#111827',
                                            fontSize: '0.78rem',
                                            fontWeight: 700,
                                            cursor: 'pointer',
                                            padding: '0 0.65rem'
                                        }}
                                    >
                                        {plotSeriesMode === 'events_only' ? 'Events Only' : plotSeriesMode === 'rank_only' ? 'Rank Only' : 'Both Series'}
                                    </button>
                                    {canTogglePlotExpand && (
                                        <button
                                            type="button"
                                            onClick={togglePlotExpanded}
                                            style={{
                                                height: '1.9rem',
                                                border: '1px solid #9ca3af',
                                                borderRadius: '6px',
                                                background: '#fff',
                                                color: '#111827',
                                                fontSize: '0.78rem',
                                                fontWeight: 700,
                                                cursor: 'pointer',
                                                padding: '0 0.65rem'
                                            }}
                                        >
                                            {isPlotExpanded ? 'Reduce' : 'Expand'}
                                        </button>
                                    )}
                                </div>
                            </div>
                            <div
                                className="athlete-runs-table-wrapper athlete-runs-table-wrapper--plot"
                                style={{
                                    background: 'transparent',
                                    boxShadow: 'none',
                                    border: 'none',
                                    padding: 0,
                                    display: 'block',
                                    width: '100%',
                                    maxWidth: plotPanelMaxWidth,
                                    overflowX: 'auto'
                                }}
                            >
                                <div
                                    style={{
                                        border: '2px solid #9ca3af',
                                        borderRadius: '12px',
                                        background: '#fff',
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
                                        Time by Date
                                    </div>
                                    <div style={{ padding: '0.6rem 0.8rem 0.9rem 0.8rem' }}>
                                        {plotPointsFilteredByEligibility.length === 0 ? (
                                            <div style={{ color: '#6b7280', fontSize: '0.9rem' }}>No plot data available.</div>
                                        ) : (
                                            <>
                                            <div style={{ width: '100%', overflowX: isMobile ? 'auto' : 'hidden' }}>
                                                <ReactECharts
                                                    ref={plotChartRef}
                                                    option={plotOption ?? {}}
                                                    notMerge
                                                    lazyUpdate
                                                    style={{ width: '100%', minWidth: plotChartMinWidth, height: plotChartHeight }}
                                                    onEvents={{
                                                        datazoom: handlePlotDataZoom,
                                                        click: (params: any) => {
                                                            const row = params?.data?.row;
                                                            if (row) {
                                                                jumpToRunHistoryRow(row);
                                                            }
                                                        }
                                                    }}
                                                />
                                            </div>
                                            <div
                                                style={{
                                                    marginTop: '0.45rem',
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    alignItems: 'stretch',
                                                    gap: '0.28rem'
                                                }}
                                            >
                                                <div
                                                    style={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'flex-start',
                                                        gap: '0.3rem',
                                                        flexWrap: 'nowrap',
                                                        fontSize: '0.72rem',
                                                        color: '#374151',
                                                        minWidth: 0,
                                                        overflowX: 'auto'
                                                    }}
                                                >
                                                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', flexWrap: 'nowrap' }}>
                                                        <span style={{ fontWeight: 700 }}>Rank:</span>
                                                        {curveRankLegendEntries.map((entry) => (
                                                            <span
                                                                key={entry.key}
                                                                title={entry.label}
                                                                style={{
                                                                    display: 'inline-flex',
                                                                    alignItems: 'center',
                                                                    gap: '0.2rem',
                                                                    border: '1px solid #d1d5db',
                                                                    borderRadius: '4px',
                                                                    background: '#fff',
                                                                    padding: '0.04rem 0.18rem'
                                                                }}
                                                            >
                                                                <span
                                                                    style={{
                                                                        width: '0.5rem',
                                                                        height: '0.5rem',
                                                                        transform: 'rotate(45deg)',
                                                                        background: curveRankTypeColorMap[entry.key],
                                                                        border: '1px solid #374151',
                                                                        flexShrink: 0
                                                                    }}
                                                                />
                                                                <span>{entry.label}</span>
                                                            </span>
                                                        ))}
                                                    </div>
                                                    {isMobile && (
                                                        <button
                                                            type="button"
                                                            onClick={() => toggleLegendSelection(plotOtherLegendKey)}
                                                            title={`Other (${plotOtherEventCount})`}
                                                            style={{
                                                                display: 'inline-flex',
                                                                alignItems: 'center',
                                                                gap: '0.2rem',
                                                                border: selectedPlotLegendKey === plotOtherLegendKey ? '1px solid #1f2937' : '1px solid transparent',
                                                                borderRadius: '4px',
                                                                background: '#fff',
                                                                cursor: 'pointer',
                                                                padding: '0.04rem 0.15rem',
                                                                marginLeft: 'auto',
                                                                flexShrink: 0
                                                            }}
                                                        >
                                                            <span style={{ width: '0.5rem', height: '0.5rem', borderRadius: '999px', background: plotOtherEventColor, flexShrink: 0 }} />
                                                            <span>Other</span>
                                                        </button>
                                                    )}
                                                </div>
                                                <div
                                                    style={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'flex-start',
                                                        gap: '0.3rem',
                                                        flexWrap: 'nowrap',
                                                        fontSize: '0.72rem',
                                                        color: '#374151',
                                                        minWidth: 0,
                                                        overflowX: 'auto'
                                                    }}
                                                >
                                                    {plotEventLegendEntries.map((entry) => (
                                                        <button
                                                            type="button"
                                                            key={entry.eventName}
                                                            onClick={() => toggleLegendSelection(entry.eventName)}
                                                            title={`${entry.eventName} (${entry.count})`}
                                                            style={{
                                                                display: 'inline-flex',
                                                                alignItems: 'center',
                                                                gap: '0.2rem',
                                                                maxWidth: isMobile ? '5rem' : '6rem',
                                                                border: selectedPlotLegendKey === entry.eventName ? '1px solid #1f2937' : '1px solid transparent',
                                                                borderRadius: '4px',
                                                                background: '#fff',
                                                                cursor: 'pointer',
                                                                padding: '0.04rem 0.15rem'
                                                            }}
                                                        >
                                                            <span style={{ width: '0.5rem', height: '0.5rem', borderRadius: '999px', background: entry.color, flexShrink: 0 }} />
                                                            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{entry.eventName}</span>
                                                        </button>
                                                    ))}
                                                    {!isMobile && (
                                                        <button
                                                            type="button"
                                                            onClick={() => toggleLegendSelection(plotOtherLegendKey)}
                                                            title={`Other (${plotOtherEventCount})`}
                                                            style={{
                                                                display: 'inline-flex',
                                                                alignItems: 'center',
                                                                gap: '0.2rem',
                                                                border: selectedPlotLegendKey === plotOtherLegendKey ? '1px solid #1f2937' : '1px solid transparent',
                                                                borderRadius: '4px',
                                                                background: '#fff',
                                                                cursor: 'pointer',
                                                                padding: '0.04rem 0.15rem'
                                                            }}
                                                        >
                                                            <span style={{ width: '0.5rem', height: '0.5rem', borderRadius: '999px', background: plotOtherEventColor, flexShrink: 0 }} />
                                                            <span>Other</span>
                                                        </button>
                                                    )}
                                                </div>
                                                <div style={{ height: '0.05rem' }} />
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.22rem', border: '1px solid #9ca3af', borderRadius: '6px', background: '#f9fafb', padding: '0.12rem 0.2rem' }}>
                                                        <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#374151', marginRight: '0.08rem' }}>Date</span>
                                                        <button type="button" onClick={() => zoomAxisIn('x')} style={{ minWidth: 'calc(1.35rem + 1mm)', height: 'calc(1.35rem + 2mm)', border: '1px solid #9ca3af', borderRadius: '4px', background: '#fff', fontWeight: 700, cursor: 'pointer' }}>+</button>
                                                        <button type="button" onClick={() => zoomAxisOut('x')} style={{ minWidth: 'calc(1.35rem + 1mm)', height: 'calc(1.35rem + 2mm)', border: '1px solid #9ca3af', borderRadius: '4px', background: '#fff', fontWeight: 700, cursor: 'pointer' }}>-</button>
                                                        <button type="button" onClick={() => shiftAxisLeft('x')} style={{ minWidth: 'calc(1.35rem + 1mm)', height: 'calc(1.35rem + 2mm)', border: '1px solid #9ca3af', borderRadius: '4px', background: '#fff', fontWeight: 700, cursor: 'pointer' }}>{'←'}</button>
                                                        <button type="button" onClick={() => shiftAxisRight('x')} style={{ minWidth: 'calc(1.35rem + 1mm)', height: 'calc(1.35rem + 2mm)', border: '1px solid #9ca3af', borderRadius: '4px', background: '#fff', fontWeight: 700, cursor: 'pointer' }}>{'→'}</button>
                                                    </div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.22rem', border: '1px solid #9ca3af', borderRadius: '6px', background: '#f9fafb', padding: '0.12rem 0.2rem' }}>
                                                        <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#374151', marginRight: '0.08rem' }}>Time</span>
                                                        <button type="button" onClick={() => zoomAxisIn('y')} style={{ minWidth: 'calc(1.35rem + 1mm)', height: 'calc(1.35rem + 2mm)', border: '1px solid #9ca3af', borderRadius: '4px', background: '#fff', fontWeight: 700, cursor: 'pointer' }}>+</button>
                                                        <button type="button" onClick={() => zoomAxisOut('y')} style={{ minWidth: 'calc(1.35rem + 1mm)', height: 'calc(1.35rem + 2mm)', border: '1px solid #9ca3af', borderRadius: '4px', background: '#fff', fontWeight: 700, cursor: 'pointer' }}>-</button>
                                                        <button type="button" onClick={shiftYAxisUp} style={{ minWidth: 'calc(1.35rem + 1mm)', height: 'calc(1.35rem + 2mm)', border: '1px solid #9ca3af', borderRadius: '4px', background: '#fff', fontWeight: 700, cursor: 'pointer' }}>{'↑'}</button>
                                                        <button type="button" onClick={shiftYAxisDown} style={{ minWidth: 'calc(1.35rem + 1mm)', height: 'calc(1.35rem + 2mm)', border: '1px solid #9ca3af', borderRadius: '4px', background: '#fff', fontWeight: 700, cursor: 'pointer' }}>{'↓'}</button>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={resetPlotZoom}
                                                        style={{
                                                            height: '1.55rem',
                                                            border: '1px solid #9ca3af',
                                                            borderRadius: '6px',
                                                            background: '#fff',
                                                            color: '#111827',
                                                            fontSize: '0.72rem',
                                                            fontWeight: 700,
                                                            cursor: 'pointer',
                                                            padding: '0 0.4rem'
                                                        }}
                                                    >
                                                        pan-out
                                                    </button>
                                                </div>
                                            </div>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                            </>
                        ) : showProfile ? (
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
                                    <div style={{ padding: '0.2rem 1rem 1rem 1rem' }}>
                                        {profileLoading ? (
                                            <div style={{ color: '#6b7280', fontSize: '0.9rem' }}>Loading profile summary…</div>
                                        ) : profileError ? (
                                            <div style={{ color: '#b91c1c', fontSize: '0.9rem' }}>{profileError}</div>
                                        ) : profileRows.length === 0 ? (
                                            <div style={{ color: '#6b7280', fontSize: '0.9rem' }}>No profile summary returned.</div>
                                        ) : (
                                            <div style={{ overflowX: 'auto' }}>
                                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: isMobile ? '0.8rem' : '0.85rem' }}>
                                                    <thead>
                                                        <tr>
                                                            <th style={{ border: '1px solid #d1d5db', padding: '0.3rem', textAlign: 'center', background: '#f3f4f6' }}></th>
                                                            <th style={{ border: '1px solid #d1d5db', padding: '0.3rem', textAlign: 'center', background: '#f3f4f6' }}></th>
                                                            <th colSpan={4} style={{ border: '1px solid #d1d5db', padding: '0.3rem', textAlign: 'center', background: '#f3f4f6', fontWeight: 700 }}>Rank, Date & Time.   Adjusted for:</th>
                                                            <th style={{ border: '1px solid #d1d5db', padding: '0.3rem', textAlign: 'center', background: '#f3f4f6' }}></th>
                                                        </tr>
                                                        <tr>
                                                            <th style={{ border: '1px solid #d1d5db', padding: isMobile ? '0.15rem' : '0.25rem', textAlign: 'center', background: '#f3f4f6', width: isMobile ? '34px' : '42px', writingMode: 'vertical-rl', transform: 'rotate(180deg)', whiteSpace: 'nowrap', lineHeight: 1, letterSpacing: '0.02em' }}>Best Ev</th>
                                                            <th style={{ border: '1px solid #d1d5db', padding: isMobile ? '0.25rem' : '0.4rem', textAlign: 'center', background: '#f3f4f6', width: isMobile ? '40px' : '48px' }}>Act</th>
                                                            <th style={{ border: '1px solid #d1d5db', padding: isMobile ? '0.25rem' : '0.4rem', textAlign: 'center', background: '#f3f4f6' }}>Evnt<br /></th>
                                                            <th style={{ border: '1px solid #d1d5db', padding: isMobile ? '0.25rem' : '0.4rem', textAlign: 'center', background: '#f3f4f6' }}>Evnt &amp; Sex<br /></th>
                                                            <th style={{ border: '1px solid #d1d5db', padding: isMobile ? '0.25rem' : '0.4rem', textAlign: 'center', background: '#f3f4f6' }}>Evnt &amp; Age<br /></th>
                                                            <th style={{ border: '1px solid #d1d5db', padding: isMobile ? '0.25rem' : '0.4rem', textAlign: 'center', background: '#f3f4f6' }}>Evnt &amp; Age &amp; Sex<br /></th>
                                                            <th style={{ border: '1px solid #d1d5db', padding: isMobile ? '0.25rem' : '0.4rem', textAlign: 'center', background: '#f3f4f6', width: isMobile ? '46px' : '70px' }}>Total Runs</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {[
                                                            {
                                                                label: '1Y',
                                                                act: profileTypeMap['best_1y'],
                                                                event: profileTypeMap['event_1y'],
                                                                age: profileTypeMap['age_event_1y'],
                                                                sex: profileTypeMap['sex_event_1y'],
                                                                ageSex: profileTypeMap['age_sex_event_1y'],
                                                                runs: profileTypeMap['recent_runs']
                                                            },
                                                            {
                                                                label: 'All',
                                                                act: profileTypeMap['best_all_time'],
                                                                event: profileTypeMap['event_all_time'],
                                                                age: profileTypeMap['age_event_all_time'],
                                                                sex: profileTypeMap['sex_event_all_time'],
                                                                ageSex: profileTypeMap['age_sex_event_all_time'],
                                                                runs: profileTypeMap['total_runs']
                                                            }
                                                        ].map((row, idx) => {
                                                            const renderRankTimeCell = (cell?: AthleteBestSummaryRow) => {
                                                                const rawRank = cell?.rank;
                                                                const parsedRank = rawRank === undefined || rawRank === null || rawRank === '' ? NaN : Number(rawRank);
                                                                const rankDisplay = Number.isFinite(parsedRank) ? String(Math.ceil(parsedRank)) : '--';

                                                                return (
                                                                    <td
                                                                        style={{
                                                                            border: '1px solid #d1d5db',
                                                                            padding: '0.35rem',
                                                                            textAlign: 'center',
                                                                            cursor: cell?.event_date ? 'pointer' : 'default',
                                                                            userSelect: 'none'
                                                                        }}
                                                                        onClick={() => handleProfileRankCellClick(cell)}
                                                                        title={cell?.event_date ? 'Jump to this run in the table' : undefined}
                                                                    >
                                                                        <div style={{ fontSize: isMobile ? '1.45rem' : '1.7rem', lineHeight: 1.05 }}>{rankDisplay}</div>
                                                                        <div style={{ marginTop: '0.1rem', color: '#111827', lineHeight: 1.12, fontSize: isMobile ? '0.72rem' : '0.76rem' }}>
                                                                            <div>{formatDateValue(cell?.event_date)}</div>
                                                                            <div>{formatProfileTime(cell?.time)}</div>
                                                                        </div>
                                                                    </td>
                                                                );
                                                            };

                                                            return (
                                                                <tr key={`${row.label}-${idx}`}>
                                                                    <th style={{ border: '1px solid #d1d5db', padding: isMobile ? '0.15rem' : '0.25rem', textAlign: 'center', background: '#f9fafb', width: isMobile ? '34px' : '42px', writingMode: 'vertical-rl', transform: 'rotate(180deg)', whiteSpace: 'nowrap', lineHeight: 1, letterSpacing: '0.02em' }}>{row.label}</th>
                                                                    {renderRankTimeCell(row.act)}
                                                                    {renderRankTimeCell(row.event)}
                                                                    {renderRankTimeCell(row.sex)}
                                                                    {renderRankTimeCell(row.age)}
                                                                    {renderRankTimeCell(row.ageSex)}
                                                                    <td style={{ border: '1px solid #d1d5db', padding: isMobile ? '0.28rem' : '0.35rem', textAlign: 'center', fontSize: isMobile ? '1rem' : '1.1rem', fontWeight: 600, width: isMobile ? '56px' : '70px' }}>
                                                                        {row.runs?.time ?? '--'}
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="athlete-runs-table-wrapper" ref={runsTableWrapperRef}>
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
                                                        onClick={() => {
                                                            const now = Date.now();
                                                            if (now - lastSortTouchAtRef.current < 500) {
                                                                return;
                                                            }
                                                            handleSort(col.key);
                                                        }}
                                                        onTouchEnd={(event) => {
                                                            event.preventDefault();
                                                            lastSortTouchAtRef.current = Date.now();
                                                            handleSort(col.key);
                                                        }}
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
                                            const rowKey = makeTableRowKey(row, index);
                                            const rowAthleteCode = pickField(row, ['athlete_code', 'athleteCode']);
                                            const rowEventDate = pickField(row, ['formatted_date', 'event_date', 'date']);
                                            const rowDisplayDate = formatDateValue(rowEventDate);
                                            const isProfileJumpTarget = Boolean(profileJumpDate) && rowDisplayDate === profileJumpDate;
                                            let highlight = false;
                                            if (sourceEvent?.eventDate) {
                                                highlight = String(rowAthleteCode) === String(activeSelectedCode) && formatDateValue(rowEventDate) === formatDateValue(sourceEvent.eventDate);
                                            } else {
                                                highlight = String(rowAthleteCode) === String(activeSelectedCode) && index === rowsToRender.findIndex(r => String(pickField(r, ['athlete_code', 'athleteCode'])) === String(activeSelectedCode));
                                            }
                                            const sourceHighlightActive = highlight && !profileJumpDate;

                                            return (
                                                <tr
                                                    ref={(element) => {
                                                        tableRowRefs.current[rowKey] = element;
                                                    }}
                                                    data-run-date={rowDisplayDate}
                                                    key={rowKey}
                                                    className={[sourceHighlightActive ? 'highlighted-source-row' : '', isProfileJumpTarget ? 'profile-jump-row' : ''].filter(Boolean).join(' ')}
                                                    style={{
                                                        ...(sourceHighlightActive ? { fontWeight: 'bold' } : {}),
                                                        ...(isProfileJumpTarget
                                                            ? {
                                                                outline: '2px solid #f59e0b',
                                                                outlineOffset: '-2px',
                                                                backgroundColor: '#fff7d6'
                                                            }
                                                            : {}),
                                                        cursor: 'pointer'
                                                    }}
                                                    onClick={() => handleRowClick(row)}
                                                    title="Click to view this event"
                                                >
                                                    {tableColumns.map((col) => {
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
                                                        if (sourceHighlightActive) {
                                                            alignmentStyle.backgroundColor = '#e6f3ff';
                                                        } else if (isProfileJumpTarget) {
                                                            alignmentStyle.backgroundColor = '#fff7d6';
                                                        }
                                                        if (col.key === 'date') {
                                                            const value = getCellDisplayValue(row, col.key);
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

                                                        if (col.key === 'best_curve_ranking_current') {
                                                            const currentRankRaw = pickField(row, ['best_curve_ranking_current', 'bestCurveRankingCurrent', 'rank']);
                                                            const historicRankRaw = pickField(row, ['best_curve_ranking_historic', 'bestCurveRankingHistoric']);
                                                            const rankTypeRaw = pickField(row, ['best_curve_ranking_current_type', 'bestCurveRankingCurrentType']);

                                                            const currentRank = Number(currentRankRaw);
                                                            const historicRank = Number(historicRankRaw);
                                                            const hasCurrent = Number.isFinite(currentRank);
                                                            const hasHistoric = Number.isFinite(historicRank);

                                                            const rankType = String(rankTypeRaw ?? '').trim() || '*';
                                                            const delta = hasCurrent && hasHistoric ? currentRank - historicRank : null;
                                                            const deltaText = delta === null ? '' : `${delta >= 0 ? '+' : ''}${delta}`;

                                                            return (
                                                                <td key={col.key} style={{ ...alignmentStyle, textAlign: 'center' }}>
                                                                    <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                                                                        <span>{hasCurrent ? String(currentRank) : ''}</span>
                                                                        <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', lineHeight: 1.02 }}>
                                                                            <span style={{ fontSize: '0.62rem', opacity: 0.9 }}>{rankType}</span>
                                                                            <span style={{ fontSize: '0.62rem', opacity: 0.9 }}>{deltaText}</span>
                                                                        </span>
                                                                    </div>
                                                                </td>
                                                            );
                                                        }

                                                        const value = getCellDisplayValue(row, col.key);
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
                        )}
                    </section>
                </>
            )}
        </div>
    );
};

export default Athletes;