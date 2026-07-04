import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { fetchAthleteBestSummary, fetchAthleteRuns, fetchCurveRankReference, type CurveRankReferenceRow } from '../api/backendAPI';
import './ResultsTable.css';
import AthleteSearch from '../components/AthleteSearch';
import ReactECharts from 'echarts-for-react';
import { requestUnifiedHelp } from './UnifiedHelp';
import { navigateBackWithNavStack, navigateWithNavStack } from '../utils/navigationStack';
import { useGlobalWaitCursor } from '../utils/useGlobalWaitCursor';
import { useColumnHeaderMode } from '../utils/useColumnHeaderMode';
import { useDelayedUnifiedHelp } from '../utils/useDelayedUnifiedHelp';
import { getEventElementById } from '../config/layout/eventsLayoutHelper';
import { getParticipantElementById, getParticipantElements, getParticipantLayoutConfig, getParticipantTableColumnByKey } from '../config/layout/participantLayoutHelper';

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

type CurveRankReferenceType = 'B' | 'E' | 'ES' | 'AE' | 'AES';

const curveRankReferenceTypeOptions: Array<{ value: CurveRankReferenceType; label: string }> = [
    { value: 'B', label: 'Best Time' },
    { value: 'E', label: 'Event Adj (E)' },
    { value: 'ES', label: 'Event & Sex Adj (ES)' },
    { value: 'AE', label: 'Age & Event Adj (AE)' },
    { value: 'AES', label: 'Age & Event & Sex Adj (AES)' }
];

const ATHLETES_STATE_KEY = 'athletes_state_v1';
const ATHLETES_PREFERENCES_KEY = 'athletes_preferences_v1';
const ATHLETES_RETURN_SCROLL_KEY = 'athletes_return_scroll_v1';

const normalizeAthletePanel = (value: string | null): 'table' | 'profile' | 'plot' | null => {
    const token = String(value || '').trim().toLowerCase();
    if (token === 'table' || token === 'profile' || token === 'plot') {
        return token;
    }
    return null;
};

const normalizeBoolParam = (value: string | null): boolean | null => {
    const token = String(value || '').trim().toLowerCase();
    if (token === '1' || token === 'true' || token === 'yes') return true;
    if (token === '0' || token === 'false' || token === 'no') return false;
    return null;
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
    fill('current_age_estimate', ['athlete_current_age_estimate', 'athleteCurrentAgeEstimate', 'current_age_estimate', 'age_estimate', 'age']);
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

type AthleteViewMode = 'basic' | 'detailed' | 'all_time_adjustments' | 'event_ranks';
type CourseAdjOption = 'none' | 'seasonal' | 'full';
type OtherAdjOption = 'none' | 'age' | 'sex' | 'age_sex';
type SelectOptionConfig = {
    value: string;
    label: string;
};

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
    return courseMap[other] ?? [];
};

const normalizeViewMode = (value: string): AthleteViewMode => {
    if (value === 'detailed' || value === 'all_time_adjustments' || value === 'event_ranks') return value;
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

const buildSelectOptionConfigs = (
    configuredOptions: string[] | undefined,
    values: readonly string[],
    fallbackLabels: readonly string[]
): SelectOptionConfig[] => values.map((value, index) => ({
    value,
    label: String(configuredOptions?.[index] || fallbackLabels[index] || value)
}));

type ColumnKey =
    | 'date'
    | 'event_display'
    | 'position'
    | 'age_group'
    | 'age_grade'
    | 'best_curve_ranking_current'
    | 'time'
    | 'comment'
    | 'club'
    | 'season_adj_time'
    | 'event_adj_time'
    | 'age_adj_time'
    | 'sex_adj_time'
    | 'event_age_adj_time'
    | 'event_sex_adj_time'
    | 'event_age_sex_adj_time'
    | 'age_sex_adj_time'
    | 'event_rank_b'
    | 'event_rank_e'
    | 'event_rank_es'
    | 'event_rank_ae'
    | 'event_rank_aes'
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
    align?: 'left' | 'center' | 'right';
    desktopWidth?: string;
    mobileWidth?: string;
    helpTarget?: string;
    helpTipEnabled?: boolean;
    helpTipDelayMs?: number;
};

const baseAthleteColumnKeys: ColumnKey[] = ['date', 'event_display', 'position', 'time', 'age_group', 'age_grade', 'best_curve_ranking_current', 'comment'];

const adjustmentColumnKeys: ColumnKey[] = ['season_adj_time', 'event_adj_time', 'age_adj_time', 'sex_adj_time', 'event_age_adj_time', 'event_sex_adj_time', 'event_age_sex_adj_time', 'age_sex_adj_time'];

const eventRankColumnKeys: ColumnKey[] = ['event_rank_b', 'event_rank_e', 'event_rank_es', 'event_rank_ae', 'event_rank_aes'];

const toRoundedRankNumber = (value: unknown): number | null => {
    if (value === null || value === undefined) return null;
    const text = String(value).trim();
    if (!text) return null;
    const numeric = Number(text);
    return Number.isFinite(numeric) ? Math.round(numeric) : null;
};

const getRankDifferenceBackground = (rankValue: unknown, comparisonValue: unknown): string | undefined => {
    const rank = toRoundedRankNumber(rankValue);
    const comparison = toRoundedRankNumber(comparisonValue);
    if (rank === null || comparison === null) {
        return undefined;
    }

    const diff = Math.abs(comparison - rank);
    if (diff === 0) return '#dbeafe';
    if (diff <= 2) return '#dcfce7';
    if (diff <= 5) return '#e5e7eb';
    if (diff <= 10) return '#fed7aa';
    return '#fee2e2';
};

const getLargestEventRankCellBackground = (row: AthleteRecord, columnKey: ColumnKey): string | undefined => {
    if (!eventRankColumnKeys.includes(columnKey)) {
        return undefined;
    }

    let largestKey: ColumnKey | null = null;
    let largestValue: number | null = null;

    for (const key of eventRankColumnKeys) {
        const value = toRoundedRankNumber(pickField(row, [key, key.replace(/_([a-z])/g, (_match, letter) => letter.toUpperCase())]));
        if (value === null) {
            continue;
        }
        if (largestValue === null || value > largestValue) {
            largestValue = value;
            largestKey = key;
        }
    }

    if (largestKey !== columnKey || largestValue === null) {
        return undefined;
    }

    return getRankDifferenceBackground(
        pickField(row, ['best_curve_ranking_current', 'bestCurveRankingCurrent', 'rank']),
        largestValue
    );
};

const detailedColumnKeys: ColumnKey[] = ['club', 'last_position', 'event_number', 'total_runs_long', 'event_eligible_appearances', 'last_event_code_count_long', 'distinct_courses_long', 'tourist_flag', 'super_tourist', 'returner'];

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

    const coeffProduct = coeff && coeffEvent ? coeff + coeffEvent - 1 : null;
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
        case 'club':
            return parseStringSortValue(pickField(row, ['club']));
        case 'season_adj_time':
        case 'event_adj_time':
        case 'age_adj_time':
        case 'sex_adj_time':
        case 'event_age_adj_time':
        case 'event_sex_adj_time':
        case 'event_age_sex_adj_time':
        case 'age_sex_adj_time':
            return getAdjustmentSeconds(row, column);
        case 'event_rank_b':
            return parseNumericSortValue(pickField(row, ['event_rank_b', 'eventRankB']));
        case 'event_rank_e':
            return parseNumericSortValue(pickField(row, ['event_rank_e', 'eventRankE']));
        case 'event_rank_es':
            return parseNumericSortValue(pickField(row, ['event_rank_es', 'eventRankEs']));
        case 'event_rank_ae':
            return parseNumericSortValue(pickField(row, ['event_rank_ae', 'eventRankAe']));
        case 'event_rank_aes':
            return parseNumericSortValue(pickField(row, ['event_rank_aes', 'eventRankAes']));
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
    const { isHelpMode } = useColumnHeaderMode();
    const readStoredAthletesState = (): Partial<{
        sortKey: ColumnKey;
        sortDir: 'asc' | 'desc';
        viewMode: AthleteViewMode;
        courseAdj: CourseAdjOption;
        otherAdj: OtherAdjOption;
        showPlot: boolean;
        showProfile: boolean;
        plotEligibilityMode: 'all' | 'eligible' | 'best';
        plotSeriesMode: 'events_only' | 'rank_only' | 'both_series';
        isPlotExpanded: boolean;
        selectedPlotLegendKey: string | null;
    }> => {
        const readStoredValue = (): string | null => {
            try {
                const localValue = localStorage.getItem(ATHLETES_PREFERENCES_KEY);
                if (localValue) {
                    return localValue;
                }
            } catch {
                // ignore storage failures
            }
            try {
                return sessionStorage.getItem(ATHLETES_STATE_KEY);
            } catch {
                return null;
            }
        };

        try {
            const raw = readStoredValue();
            if (!raw) return {};
            const parsed = JSON.parse(raw);
            if (!parsed || typeof parsed !== 'object') return {};
            const next: Partial<{
                sortKey: ColumnKey;
                sortDir: 'asc' | 'desc';
                viewMode: AthleteViewMode;
                courseAdj: CourseAdjOption;
                otherAdj: OtherAdjOption;
                showPlot: boolean;
                showProfile: boolean;
                plotEligibilityMode: 'all' | 'eligible' | 'best';
                plotSeriesMode: 'events_only' | 'rank_only' | 'both_series';
                isPlotExpanded: boolean;
                selectedPlotLegendKey: string | null;
            }> = {};
            if (typeof (parsed as any).sortKey === 'string') {
                next.sortKey = (parsed as any).sortKey as ColumnKey;
            }
            if ((parsed as any).sortDir === 'asc' || (parsed as any).sortDir === 'desc') {
                next.sortDir = (parsed as any).sortDir;
            }
            if ((parsed as any).viewMode === 'basic' || (parsed as any).viewMode === 'detailed' || (parsed as any).viewMode === 'all_time_adjustments' || (parsed as any).viewMode === 'event_ranks') {
                next.viewMode = (parsed as any).viewMode;
            }
            if ((parsed as any).courseAdj === 'none' || (parsed as any).courseAdj === 'seasonal' || (parsed as any).courseAdj === 'full') {
                next.courseAdj = (parsed as any).courseAdj;
            }
            if ((parsed as any).otherAdj === 'none' || (parsed as any).otherAdj === 'age' || (parsed as any).otherAdj === 'sex' || (parsed as any).otherAdj === 'age_sex') {
                next.otherAdj = (parsed as any).otherAdj;
            }
            if (typeof (parsed as any).showPlot === 'boolean') {
                next.showPlot = Boolean((parsed as any).showPlot);
            }
            if (typeof (parsed as any).showProfile === 'boolean') {
                next.showProfile = Boolean((parsed as any).showProfile);
            }
            if ((parsed as any).plotEligibilityMode === 'all' || (parsed as any).plotEligibilityMode === 'eligible' || (parsed as any).plotEligibilityMode === 'best') {
                next.plotEligibilityMode = (parsed as any).plotEligibilityMode;
            }
            if ((parsed as any).plotSeriesMode === 'events_only' || (parsed as any).plotSeriesMode === 'rank_only' || (parsed as any).plotSeriesMode === 'both_series') {
                next.plotSeriesMode = (parsed as any).plotSeriesMode;
            }
            if (typeof (parsed as any).isPlotExpanded === 'boolean') {
                next.isPlotExpanded = Boolean((parsed as any).isPlotExpanded);
            }
            if (typeof (parsed as any).selectedPlotLegendKey === 'string' || (parsed as any).selectedPlotLegendKey === null) {
                next.selectedPlotLegendKey = (parsed as any).selectedPlotLegendKey;
            }
            return next;
        } catch {
            return {};
        }
    };
    const storedAthletesState = readStoredAthletesState();
    const sortKeyFromQuery = searchParams.get('ath_sort');
    const sortDirFromQuery = searchParams.get('ath_dir');
    const viewModeFromQuery = searchParams.get('ath_view');
    const courseAdjFromQuery = searchParams.get('ath_course_adj');
    const otherAdjFromQuery = searchParams.get('ath_other_adj');
    const panelFromQuery = normalizeAthletePanel(searchParams.get('ath_panel'));
    const plotEligibilityFromQuery = searchParams.get('ath_plot_eligibility');
    const plotSeriesFromQuery = searchParams.get('ath_plot_series');
    const plotExpandedFromQuery = normalizeBoolParam(searchParams.get('ath_plot_expanded'));
    const plotLegendFromQueryRaw = searchParams.get('ath_plot_legend');
    const plotLegendFromQuery = plotLegendFromQueryRaw === null ? undefined : plotLegendFromQueryRaw;
    // Detect if coming from Lists page via query string
    const fromList = searchParams.get('from_list') === '1';
    // (Removed duplicate useState and related variable declarations)
    const [runs, setRuns] = useState<AthleteRecord[]>([]);
    const [summary, setSummary] = useState<AthleteSummary | null>(null);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<AthleteViewMode>(() => normalizeViewMode(viewModeFromQuery || storedAthletesState.viewMode || 'basic'));
    const [courseAdj, setCourseAdj] = useState<CourseAdjOption>(() => normalizeCourseAdjOption(courseAdjFromQuery || storedAthletesState.courseAdj || 'none'));
    const [otherAdj, setOtherAdj] = useState<OtherAdjOption>(() => normalizeOtherAdjOption(otherAdjFromQuery || storedAthletesState.otherAdj || 'none'));
    const [showPlot, setShowPlot] = useState<boolean>(() => panelFromQuery ? panelFromQuery === 'plot' : Boolean(storedAthletesState.showPlot));
    const [showProfile, setShowProfile] = useState<boolean>(() => panelFromQuery ? panelFromQuery === 'profile' : Boolean(storedAthletesState.showProfile));
    const [profileRows, setProfileRows] = useState<AthleteBestSummaryRow[]>([]);
    const [profileLoading, setProfileLoading] = useState<boolean>(false);
    useGlobalWaitCursor(loading);
    const [profileError, setProfileError] = useState<string | null>(null);
    const [curveRankReferenceOpen, setCurveRankReferenceOpen] = useState<boolean>(false);
    const [curveRankReferenceLoading, setCurveRankReferenceLoading] = useState<boolean>(false);
    const [curveRankReferenceError, setCurveRankReferenceError] = useState<string | null>(null);
    const [curveRankReferenceRows, setCurveRankReferenceRows] = useState<CurveRankReferenceRow[]>([]);
    const [curveRankReferenceType, setCurveRankReferenceType] = useState<CurveRankReferenceType>('B');
    const [curveRankReferenceVersion, setCurveRankReferenceVersion] = useState<string>('');
    const [curveRankReferenceLatestVersion, setCurveRankReferenceLatestVersion] = useState<string>('');
    const [curveRankReferenceVersions, setCurveRankReferenceVersions] = useState<string[]>([]);
    const [profileJumpDate, setProfileJumpDate] = useState<string | null>(null);
    const [profileJumpRequest, setProfileJumpRequest] = useState<{ date: string; stamp: number } | null>(null);
    const [returnScrollHighlightDate, setReturnScrollHighlightDate] = useState<string | null>(null);
    const adjustmentKeys = useMemo(() => getAdjustmentKeys(courseAdj, otherAdj), [courseAdj, otherAdj]);
    const [sortKey, setSortKey] = useState<ColumnKey>(() => {
        if (typeof sortKeyFromQuery === 'string' && sortKeyFromQuery.trim()) {
            return sortKeyFromQuery as ColumnKey;
        }
        return 'date';
    });
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>(() => {
        if (sortDirFromQuery === 'asc' || sortDirFromQuery === 'desc') {
            return sortDirFromQuery;
        }
        return 'desc';
    });
    const [plotEligibilityMode, setPlotEligibilityMode] = useState<'all' | 'eligible' | 'best'>(() => {
        if (plotEligibilityFromQuery === 'all' || plotEligibilityFromQuery === 'eligible' || plotEligibilityFromQuery === 'best') {
            return plotEligibilityFromQuery;
        }
        return storedAthletesState.plotEligibilityMode || 'all';
    });
    const [plotSeriesMode, setPlotSeriesMode] = useState<'events_only' | 'rank_only' | 'both_series'>(() => {
        if (plotSeriesFromQuery === 'events_only' || plotSeriesFromQuery === 'rank_only' || plotSeriesFromQuery === 'both_series') {
            return plotSeriesFromQuery;
        }
        return storedAthletesState.plotSeriesMode || 'events_only';
    });
    const [isPlotExpanded, setIsPlotExpanded] = useState<boolean>(() => {
        if (plotExpandedFromQuery !== null) {
            return plotExpandedFromQuery;
        }
        return Boolean(storedAthletesState.isPlotExpanded);
    });
    const [selectedPlotLegendKey, setSelectedPlotLegendKey] = useState<string | null>(() => {
        if (plotLegendFromQuery !== undefined) {
            const trimmed = String(plotLegendFromQuery || '').trim();
            return trimmed || null;
        }
        return storedAthletesState.selectedPlotLegendKey || null;
    });
    const [plotXZoom, setPlotXZoom] = useState<{ start: number; end: number }>({ start: 0, end: 100 });
    const [plotYZoom, setPlotYZoom] = useState<{ start: number; end: number }>({ start: 0, end: 100 });
    const lastSortTouchAtRef = useRef<number>(0);
    const eventCourseAdjSelectElement = getEventElementById('event.courseAdjSelect');
    const eventOtherAdjSelectElement = getEventElementById('event.otherAdjSelect');
    const courseAdjOptions = useMemo(
        () => buildSelectOptionConfigs(
            Array.isArray((eventCourseAdjSelectElement as any)?.options) ? (eventCourseAdjSelectElement as any).options : undefined,
            ['none', 'seasonal', 'full'] as const,
            ['no adjustment', 'seasonal adj.', 'full event adj.'] as const
        ),
        [eventCourseAdjSelectElement]
    );
    const otherAdjOptions = useMemo(
        () => buildSelectOptionConfigs(
            Array.isArray((eventOtherAdjSelectElement as any)?.options) ? (eventOtherAdjSelectElement as any).options : undefined,
            ['none', 'age', 'sex', 'age_sex'] as const,
            ['no adjustment', 'age adj.', 'sex adj.', 'age & sex adj.'] as const
        ),
        [eventOtherAdjSelectElement]
    );

    useEffect(() => {
        const nextAdjustments = sanitizeAdjustmentSelection(courseAdj, otherAdj, 'hydrate');
        if (nextAdjustments.courseAdj !== courseAdj) {
            setCourseAdj(nextAdjustments.courseAdj);
        }
        if (nextAdjustments.otherAdj !== otherAdj) {
            setOtherAdj(nextAdjustments.otherAdj);
        }
    }, [courseAdj, otherAdj]);
    const tableRowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});
    const runsTableWrapperRef = useRef<HTMLDivElement | null>(null);
    const plotChartRef = useRef<any>(null);
    const isMobile = useMediaQuery('(max-width: 640px)');
    const isMobileButtonLayout = useMediaQuery('(max-width: 900px), (pointer: coarse)');
    const navigate = useNavigate();
    const locationState = toAthletesLocationState(location.state ?? {});
    // --- Athlete code selection logic ---
    // If location state or query param has athlete_code, use it. Otherwise, use logged-in user's athlete_code from localStorage.
    const getLoggedInUser = () => {
        try {
            const raw = localStorage.getItem('auth_user_v1');
            if (!raw) return {};
            const parsed = JSON.parse(raw);
            return parsed || {};
        } catch {
            return {};
        }
    };
    const loggedInUser = getLoggedInUser();
    const loggedInAthleteCode = loggedInUser.athleteCode && typeof loggedInUser.athleteCode === 'string' && loggedInUser.athleteCode.trim() ? loggedInUser.athleteCode.trim() : undefined;
    const loggedInDisplayName = loggedInUser.displayName && typeof loggedInUser.displayName === 'string' && loggedInUser.displayName.trim() ? loggedInUser.displayName.trim() : undefined;
    const selectedCode = locationState.athleteCode || searchParams.get('athlete_code') || loggedInAthleteCode;
    const activeSelectedCode = selectedCode;
    // If we are defaulting to the logged-in user, prefill the search box with their name
    const athleteNameFromQuery = searchParams.get('athlete_name') || searchParams.get('name') || undefined;
    const initialSearchQuery = locationState.athleteName || athleteNameFromQuery || (selectedCode === loggedInAthleteCode ? loggedInDisplayName : undefined);
    const shouldSuppressInitialSearch = Boolean((initialSearchQuery && initialSearchQuery.trim()) || activeSelectedCode);
    const fromRaces = locationState.from === 'races';
    const returnTarget = locationState.returnTo;
    // Use event_date from query string if coming from Lists
    const sourceEvent = locationState.sourceEvent || {
        eventName: searchParams.get('source_event'),
        eventDate: searchParams.get('source_date') || searchParams.get('event_date')
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

    const persistEventReturnHighlight = (eventCodeRaw?: unknown, eventDateRaw?: unknown) => {
        if (!fromRaces || !activeSelectedCode) {
            return;
        }

        const eventCode = String(eventCodeRaw ?? '').trim();
        const eventDate = String(eventDateRaw ?? '').trim();
        if (!eventCode || !eventDate) {
            return;
        }

        try {
            window.sessionStorage.setItem('event_test_return_highlight', JSON.stringify({
                eventCode,
                eventDate,
                columnKey: 'athlete',
                token: String(activeSelectedCode)
            }));
        } catch (_err) {
        }
    };

    const persistEventReturnHighlightFromReturnTarget = () => {
        const returnParams = new URLSearchParams(returnTarget?.search || '');
        const eventCode =
            searchParams.get('event_code') ||
            searchParams.get('eventCode') ||
            returnParams.get('event_code') ||
            returnParams.get('eventCode') ||
            '';
        const eventDate =
            searchParams.get('event_date') ||
            searchParams.get('date') ||
            searchParams.get('eventDate') ||
            returnParams.get('date') ||
            returnParams.get('event_date') ||
            returnParams.get('eventDate') ||
            sourceEvent?.eventDate ||
            '';
        persistEventReturnHighlight(eventCode, eventDate);
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
        if (!activeSelectedCode) {
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
    }, [activeSelectedCode]);

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

    useEffect(() => {
        if (!runs.length || showProfile) {
            return;
        }

        let targetDate = '';
        try {
            const raw = window.sessionStorage.getItem(ATHLETES_RETURN_SCROLL_KEY);
            if (!raw) {
                return;
            }
            const parsed = JSON.parse(raw) as { athleteCode?: string; date?: string };
            const savedAthleteCode = String(parsed?.athleteCode || '').trim();
            const currentAthleteCode = String(activeSelectedCode || '').trim();
            if (!savedAthleteCode || savedAthleteCode === currentAthleteCode) {
                targetDate = formatDateValue(parsed?.date || '');
            }
            window.sessionStorage.removeItem(ATHLETES_RETURN_SCROLL_KEY);
        } catch {
            return;
        }

        if (!targetDate) {
            return;
        }

        const scrollTimeout = window.setTimeout(() => {
            const rowElement = runsTableWrapperRef.current?.querySelector<HTMLTableRowElement>(`tr[data-run-date="${targetDate}"]`);
            if (rowElement) {
                rowElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                setReturnScrollHighlightDate(targetDate);
            }
        }, 120);

        const clearHighlightTimeout = window.setTimeout(() => {
            setReturnScrollHighlightDate(null);
        }, 3200);

        return () => {
            window.clearTimeout(scrollTimeout);
            window.clearTimeout(clearHighlightTimeout);
        };
    }, [activeSelectedCode, runs, showProfile]);

    const getReturnNavigationPath = (): string | null => {
        if (!returnTarget?.pathname) {
            return null;
        }

        const normalizedReturnPathname = returnTarget.pathname === '/results' ? '/results_test' : returnTarget.pathname;

        const params = new URLSearchParams(returnTarget.search || '');
        if (activeSelectedCode) {
            params.set('highlight_athlete', String(activeSelectedCode));
        }

        if (returnTarget.pathname === '/clubs') {
            const latestRunForClub = runs.length > 0 ? runs[runs.length - 1] : null;
            const clubRaw = pickField(latestRunForClub, ['club']) || summary?.club;
            const clubName = clubRaw ? String(clubRaw).trim() : '';
            if (clubName && clubName.toLowerCase() !== '<no club>') {
                params.set('club', clubName);
            }
        }

        const qs = params.toString();
        return `${normalizedReturnPathname}${qs ? `?${qs}` : ''}`;
    };

    const handleBackToRaces = () => {
        if (fromRaces && (locationState.fromSearchSelection || !hasSourceEvent) && runs.length > 0) {
            const mostRecentRow = sortedRuns.length > 0 ? sortedRuns[0] : runs[0];
            const eventCode = pickField(mostRecentRow, ['event_code', 'eventCode']);
            const eventName = pickField(mostRecentRow, ['event_name', 'eventName', 'event_display', 'eventDisplay', 'event']);
            const eventDate = pickField(mostRecentRow, ['formatted_date', 'event_date', 'date']);
            if ((eventCode || eventName) && eventDate) {
                persistEventReturnHighlight(eventCode, eventDate);
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
            const targetPath = getReturnNavigationPath();
            if (targetPath) {
                navigate(targetPath);
                return;
            }
        } else {
            navigate('/races');
        }
    };

    const handleBackNavigation = () => {
        if (fromRaces) {
            persistEventReturnHighlightFromReturnTarget();
            if (navigateBackWithNavStack(navigate, location.pathname)) {
                return;
            }
            handleBackToRaces();
            return;
        }
        if (navigateBackWithNavStack(navigate, location.pathname)) {
            return;
        }
        if (returnTarget?.pathname) {
            const targetPath = getReturnNavigationPath();
            if (targetPath) {
                navigate(targetPath);
                return;
            }
            return;
        }
        // Default: go to Event Analysis screen
        navigate('/results_test');
    };

    const handleResetHighlights = () => {
        const params = new URLSearchParams(location.search || '');
        params.delete('source_event');
        params.delete('source_date');
        params.delete('event_date');

        const nextSearchRaw = params.toString();
        const nextSearch = nextSearchRaw ? `?${nextSearchRaw}` : '';

        const nextState = { ...(location.state as Record<string, unknown> | null ?? {}) };
        delete (nextState as any).sourceEvent;

        navigate(
            { pathname: location.pathname, search: nextSearch },
            { replace: true, state: nextState }
        );
    };

    const handleViewModeSelect = (event: React.ChangeEvent<HTMLSelectElement>) => {
        const newViewMode = normalizeViewMode(event.target.value);
        setViewMode(newViewMode);
        
        // Specialised table views replace the dynamic adjustment columns.
        if (newViewMode === 'all_time_adjustments' || newViewMode === 'event_ranks') {
            setCourseAdj('none');
            setOtherAdj('none');
        }
    };

    const handleCourseAdjSelect = (event: React.ChangeEvent<HTMLSelectElement>) => {
        const nextAdjustments = sanitizeAdjustmentSelection(normalizeCourseAdjOption(event.target.value), otherAdj, 'course');
        setCourseAdj(nextAdjustments.courseAdj);
        setOtherAdj(nextAdjustments.otherAdj);
        
        // If course adj is used, reset view mode to Basic
        if (event.target.value !== 'none') {
            setViewMode('basic');
        }
    };

    const handleOtherAdjSelect = (event: React.ChangeEvent<HTMLSelectElement>) => {
        const nextAdjustments = sanitizeAdjustmentSelection(courseAdj, normalizeOtherAdjOption(event.target.value), 'other');
        setCourseAdj(nextAdjustments.courseAdj);
        setOtherAdj(nextAdjustments.otherAdj);
        
        // If other adj is used, reset view mode to Basic
        if (event.target.value !== 'none') {
            setViewMode('basic');
        }
    };

    const appendAthletesUiStateParams = useCallback((params: URLSearchParams) => {
        params.set('ath_view', viewMode);
        params.set('ath_course_adj', courseAdj);
        params.set('ath_other_adj', otherAdj);
        const panelMode: 'table' | 'profile' | 'plot' = showProfile ? 'profile' : (showPlot ? 'plot' : 'table');
        params.set('ath_panel', panelMode);
        params.set('ath_sort', sortKey);
        params.set('ath_dir', sortDir);
        params.set('ath_plot_eligibility', plotEligibilityMode);
        params.set('ath_plot_series', plotSeriesMode);
        params.set('ath_plot_expanded', isPlotExpanded ? '1' : '0');
        if (selectedPlotLegendKey && String(selectedPlotLegendKey).trim()) {
            params.set('ath_plot_legend', String(selectedPlotLegendKey).trim());
        } else {
            params.delete('ath_plot_legend');
        }
    }, [courseAdj, isPlotExpanded, otherAdj, plotEligibilityMode, plotSeriesMode, selectedPlotLegendKey, showPlot, showProfile, sortDir, sortKey, viewMode]);

    const handleRowClick = (row: AthleteRecord) => {
        // Extract event_code and date from the clicked row
        const eventCode = pickField(row, ['event_code', 'eventCode']);
        const eventDate = pickField(row, ['formatted_date', 'event_date', 'date']);
        const eventName = pickField(row, ['event_display', 'eventDisplay', 'event_name', 'eventName', 'event']);
        const athleteCode = pickField(row, ['athlete_code', 'athleteCode']) || activeSelectedCode;
        
        if (eventCode && eventDate) {
            const returnParams = new URLSearchParams(location.search || '');
            appendAthletesUiStateParams(returnParams);
            const sourceEventName = eventName ? String(eventName) : '';
            if (sourceEventName) {
                returnParams.set('source_event', sourceEventName);
            } else {
                returnParams.delete('source_event');
            }
            returnParams.set('source_date', String(eventDate));
            const returnSearchRaw = returnParams.toString();
            const returnSearch = returnSearchRaw ? `?${returnSearchRaw}` : '';
            const sourceEventState = {
                eventName: sourceEventName || undefined,
                eventDate: String(eventDate)
            };

            try {
                window.sessionStorage.setItem(ATHLETES_RETURN_SCROLL_KEY, JSON.stringify({
                    athleteCode: athleteCode ? String(athleteCode) : '',
                    date: String(eventDate)
                }));
            } catch {
            }

            // Navigate to Single Event page with the selected event data and athlete code for highlighting
            const params = new URLSearchParams();
            params.set('event_code', String(eventCode));
            params.set('date', String(eventDate));
            if (athleteCode) {
                params.set('highlight_athlete', String(athleteCode));
            }
            navigateWithNavStack(
                navigate,
                {
                    pathname: location.pathname,
                    search: returnSearch,
                    state: {
                        ...(location.state as Record<string, unknown> | null ?? {}),
                        sourceEvent: sourceEventState
                    }
                },
                `/races?${params.toString()}`,
                {
                    state: {
                        from: 'athletes',
                        returnTo: {
                            pathname: '/athletes',
                            search: returnSearch
                        },
                        sourceEvent: sourceEventState
                    }
                }
            );
        }
    };

    const participantEventDisplayColumn = useMemo(() => getParticipantTableColumnByKey('event_display'), []);
    const participantLayoutConfig = useMemo(() => getParticipantLayoutConfig() as any, []);
    const tableHeaderHelpEnabled = participantLayoutConfig?.tableHelpTip?.enabled !== false;
    const tableHeaderHelpDelayMs = Number(participantLayoutConfig?.tableHelpTip?.delayMs) > 0
        ? Number(participantLayoutConfig.tableHelpTip.delayMs)
        : 2000;
    const delayedHeaderHelp = useDelayedUnifiedHelp(tableHeaderHelpEnabled, tableHeaderHelpDelayMs);

    const participantCourseTarget = useMemo(() => {
        const configuredTarget = String(participantEventDisplayColumn?.interaction?.target || '').trim();
        return configuredTarget || '/courses_test';
    }, [participantEventDisplayColumn]);

    const handleCourseNavigate = (row: AthleteRecord) => {
        const eventCodeRaw = pickField(row, ['event_code', 'eventCode']);
        const eventNameRaw = pickField(row, ['event_display', 'eventDisplay', 'event_name', 'eventName', 'event']);
        const eventDateRaw = pickField(row, ['formatted_date', 'event_date', 'date']);
        const eventCode = eventCodeRaw ? String(eventCodeRaw).trim() : '';
        const eventName = eventNameRaw ? String(eventNameRaw).trim() : '';
        const eventDate = eventDateRaw ? String(eventDateRaw).trim() : '';
        if (!eventCode && !eventName) {
            return;
        }

        const params = new URLSearchParams();
        if (eventCode) {
            params.set('event_code', eventCode);
        }
        if (eventName) {
            params.set('event_name', eventName);
        }

        const returnParams = new URLSearchParams(location.search || '');
        appendAthletesUiStateParams(returnParams);
        if (activeSelectedCode) {
            returnParams.set('athlete_code', String(activeSelectedCode));
        }
        if (eventName) {
            returnParams.set('source_event', eventName);
        }
        if (eventDate) {
            returnParams.set('source_date', eventDate);
        }
        const returnSearch = returnParams.toString() ? `?${returnParams.toString()}` : '';
        const sourceEventState = {
            eventName: eventName || undefined,
            eventDate: eventDate || undefined
        };

        navigateWithNavStack(navigate, {
            pathname: location.pathname,
            search: returnSearch,
            state: {
                ...(location.state as Record<string, unknown> | null ?? {}),
                sourceEvent: sourceEventState
            }
        }, `${participantCourseTarget}?${params.toString()}`, {
            state: {
                eventCode: eventCode || undefined,
                eventName: eventName || undefined,
                from: 'athletes',
                returnTo: {
                    pathname: '/athletes',
                    search: returnSearch
                },
                sourceEvent: sourceEventState
            }
        });
    };

    const handleClubNavigate = (clubRaw: unknown, sourceRow?: AthleteRecord) => {
        const club = String(clubRaw ?? '').trim();
        if (!club || club === '--' || club.toLowerCase() === '<no club>') {
            return;
        }

        const sourceEventNameRaw = pickField(sourceRow, ['event_display', 'eventDisplay', 'event_name', 'eventName', 'event']);
        const sourceEventDateRaw = pickField(sourceRow, ['formatted_date', 'event_date', 'date']);
        const sourceEventName = sourceEventNameRaw ? String(sourceEventNameRaw).trim() : '';
        const sourceEventDate = sourceEventDateRaw ? String(sourceEventDateRaw).trim() : '';

        const params = new URLSearchParams();
        params.set('club', club);

        const returnParams = new URLSearchParams(location.search || '');
        appendAthletesUiStateParams(returnParams);
        if (activeSelectedCode) {
            returnParams.set('athlete_code', String(activeSelectedCode));
        }
        if (sourceEventName) {
            returnParams.set('source_event', sourceEventName);
        }
        if (sourceEventDate) {
            returnParams.set('source_date', sourceEventDate);
        }

        const returnSearch = returnParams.toString() ? `?${returnParams.toString()}` : '';
        const sourceEventState = {
            eventName: sourceEventName || undefined,
            eventDate: sourceEventDate || undefined
        };

        navigateWithNavStack(navigate, {
            pathname: location.pathname,
            search: returnSearch,
            state: {
                ...(location.state as Record<string, unknown> | null ?? {}),
                sourceEvent: sourceEventState
            }
        }, `/clubs?${params.toString()}`, {
            state: {
                from: 'athletes',
                returnTo: {
                    pathname: '/athletes',
                    search: returnSearch
                },
                sourceEvent: sourceEventState
            }
        });
    };

    const latestRun = useMemo(() => (runs.length > 0 ? runs[runs.length - 1] : null), [runs]);
    const rawLatestAge = pickField(latestRun, ['athlete_current_age_estimate', 'athleteCurrentAgeEstimate', 'current_age_estimate', 'currentAgeEstimate', 'age_estimate', 'age']) ??
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
    const headerClubIsLinkable = Boolean(
        headerClub &&
        headerClub !== '--' &&
        headerClub.toLowerCase() !== '<no club>'
    );
    const favoriteCourseRow = useMemo(() => {
        if (runs.length === 0) {
            return null;
        }

        const cutoff = new Date();
        cutoff.setFullYear(cutoff.getFullYear() - 1);
        const cutoffMs = cutoff.getTime();

        let bestRow: AthleteRecord | null = null;
        let bestCount = Number.NEGATIVE_INFINITY;
        let bestDate = Number.NEGATIVE_INFINITY;

        for (const row of runs) {
            const eventDateMs = parseDateSortValue(pickField(row, ['formatted_date', 'event_date', 'date']));
            if (eventDateMs === null || eventDateMs < cutoffMs) {
                continue;
            }

            const eventCount = parseNumericSortValue(pickField(row, ['last_event_code_count_long', 'lastEventCodeCountLong']));
            if (eventCount === null) {
                continue;
            }

            const eventName = pickField(row, ['event_display', 'eventDisplay', 'event_name', 'eventName', 'event']);
            if (!eventName || !String(eventName).trim()) {
                continue;
            }

            if (eventCount > bestCount || (eventCount === bestCount && eventDateMs > bestDate)) {
                bestRow = row;
                bestCount = eventCount;
                bestDate = eventDateMs;
            }
        }

        return bestRow;
    }, [runs]);
    const headerFavoriteCourseRaw = pickField(favoriteCourseRow, ['event_display', 'eventDisplay', 'event_name', 'eventName', 'event']);
    const headerFavoriteCourse = headerFavoriteCourseRaw ? String(headerFavoriteCourseRaw) : '--';
    const headerFavoriteCourseIsLinkable = Boolean(
        favoriteCourseRow &&
        headerFavoriteCourse &&
        headerFavoriteCourse !== '--'
    );

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

    const estimatedRankSummary = useMemo(() => {
        const oneYearTypeToMetric: Record<string, { metric: string; order: number }> = {
            best_1y: { metric: 'B', order: 1 },
            event_1y: { metric: 'E', order: 2 },
            age_event_1y: { metric: 'AE', order: 3 },
            sex_event_1y: { metric: 'ES', order: 4 },
            age_sex_event_1y: { metric: 'AES', order: 5 }
        };

        const candidates = profileRows
            .map((row) => {
                const bestType = String(row?.best_type ?? '').trim();
                const mapping = oneYearTypeToMetric[bestType];
                if (!mapping) return null;
                const rankRaw = Number(row?.rank);
                if (!Number.isFinite(rankRaw)) return null;
                return {
                    rank: rankRaw,
                    metric: mapping.metric,
                    order: mapping.order
                };
            })
            .filter((item): item is { rank: number; metric: string; order: number } => Boolean(item));

        if (candidates.length === 0) {
            return {
                label: 'Est. Rank',
                value: '--',
                hasValue: false
            };
        }

        candidates.sort((a, b) => {
            if (b.rank !== a.rank) return b.rank - a.rank;
            return a.order - b.order;
        });

        const best = candidates[0];
        const displayMetric = best.metric === 'B' ? '*' : best.metric;
        return {
            label: 'Est. Rank',
            value: `${Math.round(best.rank)} ${displayMetric}`,
            hasValue: true
        };
    }, [profileRows]);

    const eventsAllPieSegments = useMemo(() => {
        const totalRunsRaw = profileTypeMap['total_runs']?.time ?? totalRunsCount ?? runs.length;
        const totalRunsAll = Math.max(0, Math.round(Number(totalRunsRaw) || 0));
        if (totalRunsAll <= 0) {
            return [] as Array<{ name: string; value: number; latestDateMs: number }>;
        }

        const eventMap = new Map<string, { name: string; value: number; latestDateMs: number }>();
        for (const row of runs) {
            const eventNameRaw = pickField(row, ['event_display', 'eventDisplay', 'event_name', 'eventName', 'event']);
            const eventName = String(eventNameRaw || '').trim();
            if (!eventName) {
                continue;
            }

            const eventCodeRaw = pickField(row, ['event_code', 'eventCode']);
            const eventKey = `${String(eventCodeRaw ?? '').trim()}__${eventName.toLowerCase()}`;
            const eventDateMs = parseDateSortValue(pickField(row, ['formatted_date', 'event_date', 'date'])) ?? Number.NEGATIVE_INFINITY;
            const existing = eventMap.get(eventKey);
            if (existing) {
                existing.value += 1;
                if (eventDateMs > existing.latestDateMs) {
                    existing.latestDateMs = eventDateMs;
                }
            } else {
                eventMap.set(eventKey, { name: eventName, value: 1, latestDateMs: eventDateMs });
            }
        }

        const rankedEvents = Array.from(eventMap.values()).sort((a, b) => {
            if (b.value !== a.value) return b.value - a.value;
            if (b.latestDateMs !== a.latestDateMs) return b.latestDateMs - a.latestDateMs;
            return a.name.localeCompare(b.name);
        });

        const topEvents = rankedEvents.slice(0, 5);
        const otherValue = rankedEvents.slice(5).reduce((sum, item) => sum + item.value, 0);
        const representedValue = topEvents.reduce((sum, item) => sum + item.value, 0) + otherValue;
        const nonLocalValue = Math.max(totalRunsAll - representedValue, 0);

        const segments: Array<{ name: string; value: number; latestDateMs: number }> = [...topEvents];
        if (otherValue > 0) {
            segments.push({ name: 'Other', value: otherValue, latestDateMs: Number.NEGATIVE_INFINITY });
        }
        if (nonLocalValue > 0) {
            segments.push({ name: 'Non-local runs', value: nonLocalValue, latestDateMs: Number.NEGATIVE_INFINITY });
        }
        return segments;
    }, [profileTypeMap, runs, totalRunsCount]);

    const eventsAllPiePalette = ['#0f766e', '#2563eb', '#ca8a04', '#dc2626', '#7c3aed', '#475569', '#9ca3af'];

    const eventsAllPieOption = useMemo(() => ({
        tooltip: {
            trigger: 'item',
            formatter: (params: any) => `${params?.name || ''}: ${params?.value || 0}`
        },
        animation: false,
        series: [
            {
                type: 'pie',
                radius: ['0%', '72%'],
                center: ['50%', '50%'],
                avoidLabelOverlap: true,
                label: { show: false },
                labelLine: { show: false },
                data: eventsAllPieSegments.map((segment, index) => ({
                    name: segment.name,
                    value: segment.value,
                    itemStyle: { color: eventsAllPiePalette[index % eventsAllPiePalette.length] }
                }))
            }
        ]
    }), [eventsAllPieSegments]);

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
            case 'club':
                return renderCell(pickField(row, ['club']));
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
            case 'event_rank_b':
                return renderCell(pickField(row, ['event_rank_b', 'eventRankB']));
            case 'event_rank_e':
                return renderCell(pickField(row, ['event_rank_e', 'eventRankE']));
            case 'event_rank_es':
                return renderCell(pickField(row, ['event_rank_es', 'eventRankEs']));
            case 'event_rank_ae':
                return renderCell(pickField(row, ['event_rank_ae', 'eventRankAe']));
            case 'event_rank_aes':
                return renderCell(pickField(row, ['event_rank_aes', 'eventRankAes']));
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

    useEffect(() => {
        const nextState = JSON.stringify({
            sortKey,
            sortDir,
            viewMode,
            courseAdj,
            otherAdj,
            showPlot,
            showProfile,
            plotEligibilityMode,
            plotSeriesMode,
            isPlotExpanded,
            selectedPlotLegendKey
        });

        try {
            sessionStorage.setItem(ATHLETES_STATE_KEY, nextState);
        } catch {
            // ignore storage failures
        }

        try {
            localStorage.setItem(ATHLETES_PREFERENCES_KEY, nextState);
        } catch {
            // ignore storage failures
        }
    }, [
        sortKey,
        sortDir,
        viewMode,
        courseAdj,
        otherAdj,
        showPlot,
        showProfile,
        plotEligibilityMode,
        plotSeriesMode,
        isPlotExpanded,
        selectedPlotLegendKey
    ]);

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

    const getConfiguredColumnDef = useCallback((key: ColumnKey): ColumnDef => {
        const configuredColumn = getParticipantTableColumnByKey(key);
        const helpTipConfig = (configuredColumn as any)?.helpTip;
        const helpTipEnabled = typeof helpTipConfig === 'object'
            ? helpTipConfig?.enabled !== false
            : helpTipConfig !== false;
        const helpTipDelayMs = typeof helpTipConfig === 'object' && Number(helpTipConfig?.delayMs) > 0
            ? Number(helpTipConfig.delayMs)
            : undefined;
        return {
            key,
            label: configuredColumn?.headerName ?? configuredColumn?.name ?? key,
            sticky: configuredColumn?.sticky,
            align: (configuredColumn?.style?.textAlign as 'left' | 'center' | 'right' | undefined) ?? 'left',
            desktopWidth: configuredColumn?.laptop?.width,
            mobileWidth: configuredColumn?.mobile?.width,
            helpTarget: (configuredColumn as any)?.helpTarget,
            helpTipEnabled,
            helpTipDelayMs,
        };
    }, []);

    const baseAthleteColumns = useMemo(
        () => baseAthleteColumnKeys.map(getConfiguredColumnDef),
        [getConfiguredColumnDef]
    );

    const adjustmentColumns = useMemo(
        () => adjustmentColumnKeys.map(getConfiguredColumnDef),
        [getConfiguredColumnDef]
    );

    const detailedColumns = useMemo(
        () => detailedColumnKeys.map(getConfiguredColumnDef),
        [getConfiguredColumnDef]
    );

    const eventRankColumns = useMemo(
        () => eventRankColumnKeys.map(getConfiguredColumnDef),
        [getConfiguredColumnDef]
    );

    const tableColumns = useMemo(() => {
        // If 'All Time Adjustments' view is selected, show all adjustment columns at the end
        if (viewMode === 'all_time_adjustments') {
            const allTimeAdjustmentColumns = [
                ...adjustmentColumns.filter((col) => col.key !== 'event_age_sex_adj_time'),
                ...adjustmentColumns.filter((col) => col.key === 'event_age_sex_adj_time')
            ];
            return [...baseAthleteColumns, ...allTimeAdjustmentColumns];
        }

        if (viewMode === 'event_ranks') {
            return [...baseAthleteColumns, ...eventRankColumns];
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
    }, [viewMode, adjustmentKeys, adjustmentColumns, baseAthleteColumns, detailedColumns, eventRankColumns]);

    const onHeaderActivate = (
        eventTarget: EventTarget | null,
        key: ColumnKey,
        label: string,
        helpTarget?: string
    ) => {
        if (!isHelpMode) {
            handleSort(key);
            return;
        }

        const element = eventTarget as HTMLElement | null;
        if (!element) {
            requestUnifiedHelp(helpTarget || 'top', null, label);
            return;
        }

        const rect = element.getBoundingClientRect();
        requestUnifiedHelp(helpTarget || 'top', { x: rect.left, y: rect.bottom }, label);
    };

    const rowsToRender = runs.length > 0 ? sortedRuns : [];
    const participantElements = getParticipantElements();

    const backButtonElement = getParticipantElementById('participant.backButton');
    const tableViewLabelElement = getParticipantElementById('participant.tableViewLabel');
    const participantInputElement = getParticipantElementById('participant.input');
    const courseAdjLabelElement = getParticipantElementById('participant.courseAdjLabel');
    const otherAdjLabelElement = getParticipantElementById('participant.otherAdjLabel');
    const totalRunsLabelElement = getParticipantElementById('participant.totalRunsLabel');
    const totalRunsValueElement = getParticipantElementById('participant.totalRuns');
    const statusMessageElement = getParticipantElementById('participant.statusMessage');
    const estimatedAgeLabelElement = getParticipantElementById('participant.estimatedAgeLabel');
    const estimatedAgeValueElement = getParticipantElementById('participant.estimatedAge');
    const clubLabelElement = getParticipantElementById('participant.clubLabel');
    const recentClubValueElement = getParticipantElementById('participant.recentClub');
    const freqCourseLabelElement = getParticipantElementById('participant.freqCourseLabel');
    const freqCourseValueElement = getParticipantElementById('participant.freqCourse');
    const athleteCodeLabelElement = useMemo(
        () => participantElements.find((element) => element.id === 'participant.athleteCodeLabel' && element.type === 'label'),
        [participantElements]
    );
    const athleteCodeFieldElement = useMemo(
        () => participantElements.find((element) => element.id === 'participant.athleteCode' && element.type === 'field'),
        [participantElements]
    );
    const tableViewSelectElement = getParticipantElementById('participant.tableViewSelect');
    const courseAdjSelectElement = getParticipantElementById('participant.courseAdjSelect');
    const otherAdjSelectElement = getParticipantElementById('participant.otherAdjSelect');
    const estRankLabelElement = getParticipantElementById('participant.estRankLabel');
    const estRankValueElement = getParticipantElementById('participant.estRankValue');
    const profileButtonElement = getParticipantElementById('participant.profileButton');
    const resetButtonElement = getParticipantElementById('participant.resetButton');
    const plotContainerElement = getParticipantElementById('participant.plotContainer');
    const curveRankReferenceContainerElement = getParticipantElementById('participant.curveRankReferenceContainer');
    const profileContainerElement = getParticipantElementById('participant.profileContainer');
    const eventsAllPieElement = getParticipantElementById('participant.eventsAllPie');
    const tableContainerElement = getParticipantElementById('participant.tableContainer');
    const plotShowLabelElement = getParticipantElementById('participant.plotShowLabel');
    const plotBestButtonElement = getParticipantElementById('participant.plotBestButton');
    const plotRankOnlyButtonElement = getParticipantElementById('participant.plotRankOnlyButton');
    const plotExpandButtonElement = getParticipantElementById('participant.plotExpandButton');
    const tableViewLabelPlacement = useMemo(
        () => tableViewLabelElement?.[isMobile ? 'mobile' : 'laptop'],
        [isMobile, tableViewLabelElement]
    );
    const backButtonPlacement = useMemo(
        () => backButtonElement?.[isMobile ? 'mobile' : 'laptop'],
        [backButtonElement, isMobile]
    );
    const participantInputPlacement = useMemo(
        () => participantInputElement?.[isMobile ? 'mobile' : 'laptop'],
        [isMobile, participantInputElement]
    );
    const totalRunsLabelPlacement = useMemo(
        () => totalRunsLabelElement?.[isMobile ? 'mobile' : 'laptop'],
        [isMobile, totalRunsLabelElement]
    );
    const totalRunsValuePlacement = useMemo(
        () => totalRunsValueElement?.[isMobile ? 'mobile' : 'laptop'],
        [isMobile, totalRunsValueElement]
    );
    const statusMessagePlacement = useMemo(
        () => statusMessageElement?.[isMobile ? 'mobile' : 'laptop'],
        [isMobile, statusMessageElement]
    );
    const estimatedAgeLabelPlacement = useMemo(
        () => estimatedAgeLabelElement?.[isMobile ? 'mobile' : 'laptop'],
        [isMobile, estimatedAgeLabelElement]
    );
    const estimatedAgeValuePlacement = useMemo(
        () => estimatedAgeValueElement?.[isMobile ? 'mobile' : 'laptop'],
        [isMobile, estimatedAgeValueElement]
    );
    const clubLabelPlacement = useMemo(
        () => clubLabelElement?.[isMobile ? 'mobile' : 'laptop'],
        [isMobile, clubLabelElement]
    );
    const recentClubValuePlacement = useMemo(
        () => recentClubValueElement?.[isMobile ? 'mobile' : 'laptop'],
        [isMobile, recentClubValueElement]
    );
    const freqCourseLabelPlacement = useMemo(
        () => freqCourseLabelElement?.[isMobile ? 'mobile' : 'laptop'],
        [freqCourseLabelElement, isMobile]
    );
    const freqCourseValuePlacement = useMemo(
        () => freqCourseValueElement?.[isMobile ? 'mobile' : 'laptop'],
        [freqCourseValueElement, isMobile]
    );
    const athleteCodeLabelPlacement = useMemo(
        () => athleteCodeLabelElement?.[isMobile ? 'mobile' : 'laptop'],
        [athleteCodeLabelElement, isMobile]
    );
    const athleteCodeFieldPlacement = useMemo(
        () => athleteCodeFieldElement?.[isMobile ? 'mobile' : 'laptop'],
        [athleteCodeFieldElement, isMobile]
    );
    const courseAdjLabelPlacement = useMemo(
        () => courseAdjLabelElement?.[isMobile ? 'mobile' : 'laptop'],
        [isMobile, courseAdjLabelElement]
    );
    const otherAdjLabelPlacement = useMemo(
        () => otherAdjLabelElement?.[isMobile ? 'mobile' : 'laptop'],
        [isMobile, otherAdjLabelElement]
    );
    const tableViewSelectPlacement = useMemo(
        () => tableViewSelectElement?.[isMobile ? 'mobile' : 'laptop'],
        [isMobile, tableViewSelectElement]
    );
    const courseAdjSelectPlacement = useMemo(
        () => courseAdjSelectElement?.[isMobile ? 'mobile' : 'laptop'],
        [isMobile, courseAdjSelectElement]
    );
    const otherAdjSelectPlacement = useMemo(
        () => otherAdjSelectElement?.[isMobile ? 'mobile' : 'laptop'],
        [isMobile, otherAdjSelectElement]
    );
    const estRankLabelPlacement = useMemo(
        () => estRankLabelElement?.[isMobile ? 'mobile' : 'laptop'],
        [estRankLabelElement, isMobile]
    );
    const estRankValuePlacement = useMemo(
        () => estRankValueElement?.[isMobile ? 'mobile' : 'laptop'],
        [estRankValueElement, isMobile]
    );
    const profileButtonPlacement = useMemo(
        () => profileButtonElement?.[isMobile ? 'mobile' : 'laptop'],
        [isMobile, profileButtonElement]
    );
    const resetButtonPlacement = useMemo(
        () => resetButtonElement?.[isMobile ? 'mobile' : 'laptop'],
        [isMobile, resetButtonElement]
    );
    const plotContainerPlacement = useMemo(() => {
        if (!plotContainerElement) {
            return undefined;
        }
        if (isMobile) {
            return isPlotExpanded
                ? (plotContainerElement.mobileExpanded ?? plotContainerElement.mobile)
                : plotContainerElement.mobile;
        }
        return isPlotExpanded
            ? (plotContainerElement.laptopExpanded ?? plotContainerElement.laptop)
            : plotContainerElement.laptop;
    }, [isMobile, isPlotExpanded, plotContainerElement]);
    const plotContainerBasePlacement = useMemo(
        () => plotContainerElement?.[isMobile ? 'mobile' : 'laptop'],
        [isMobile, plotContainerElement]
    );
    const curveRankReferenceContainerPlacement = useMemo(
        () => curveRankReferenceContainerElement?.[isMobile ? 'mobile' : 'laptop'],
        [curveRankReferenceContainerElement, isMobile]
    );
    const profileContainerPlacement = useMemo(
        () => profileContainerElement?.[isMobile ? 'mobile' : 'laptop'],
        [isMobile, profileContainerElement]
    );
    const eventsAllPiePlacement = useMemo(
        () => eventsAllPieElement?.[isMobile ? 'mobile' : 'laptop'],
        [eventsAllPieElement, isMobile]
    );
    const tableContainerPlacement = useMemo(
        () => tableContainerElement?.[isMobile ? 'mobile' : 'laptop'],
        [isMobile, tableContainerElement]
    );
    const plotShowLabelPlacement = useMemo(
        () => plotShowLabelElement?.[isMobile ? 'mobile' : 'laptop'],
        [isMobile, plotShowLabelElement]
    );
    const plotBestButtonPlacement = useMemo(
        () => plotBestButtonElement?.[isMobile ? 'mobile' : 'laptop'],
        [isMobile, plotBestButtonElement]
    );
    const plotRankOnlyButtonPlacement = useMemo(
        () => plotRankOnlyButtonElement?.[isMobile ? 'mobile' : 'laptop'],
        [isMobile, plotRankOnlyButtonElement]
    );
    const plotExpandButtonPlacement = useMemo(
        () => plotExpandButtonElement?.[isMobile ? 'mobile' : 'laptop'],
        [isMobile, plotExpandButtonElement]
    );

    const tableViewLabelWrapperStyle = useMemo<React.CSSProperties>(() => ({
        display: 'inline-flex',
        position: 'absolute',
        left: tableViewLabelPlacement?.x ?? '6.0cm',
        top: tableViewLabelPlacement?.y ?? '0cm',
        pointerEvents: 'auto'
    }), [tableViewLabelPlacement]);

    const participantInputWrapperStyle = useMemo<React.CSSProperties>(() => ({
        display: 'flex',
        alignItems: 'center',
        gap: '0.5em',
        overflow: 'visible',
        position: 'absolute',
        left: participantInputPlacement?.x ?? '1.4cm',
        top: participantInputPlacement?.y ?? '0cm',
        width: participantInputPlacement?.width ?? '8.8cm',
        pointerEvents: 'auto'
    }), [participantInputPlacement]);

    const backButtonStyle = useMemo<React.CSSProperties>(() => ({
        fontSize: backButtonElement?.style?.fontSize ?? (isMobile ? '1.35rem' : '1.2rem'),
        border: '1px solid #222',
        borderRadius: '8px',
        background: '#fff',
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxSizing: 'border-box',
        width: backButtonPlacement?.width ?? backButtonElement?.style?.width ?? '30px',
        height: backButtonPlacement?.height ?? backButtonElement?.style?.height ?? '30px',
        minWidth: backButtonPlacement?.width ?? backButtonElement?.style?.width ?? '30px',
        minHeight: backButtonPlacement?.height ?? backButtonElement?.style?.height ?? '30px',
        position: 'absolute',
        left: backButtonPlacement?.x ?? backButtonElement?.[isMobile ? 'mobile' : 'laptop']?.x ?? '0.3cm',
        top: backButtonPlacement?.y ?? backButtonElement?.[isMobile ? 'mobile' : 'laptop']?.y ?? '0cm',
        flexShrink: 0,
        zIndex: 1300,
        pointerEvents: 'auto',
        touchAction: 'manipulation',
        WebkitTapHighlightColor: 'transparent',
        userSelect: 'none',
        margin: 0
    }), [backButtonElement, backButtonPlacement, isMobile]);

    const courseAdjLabelWrapperStyle = useMemo<React.CSSProperties>(() => ({
        display: 'inline-flex',
        position: 'absolute',
        left: courseAdjLabelPlacement?.x ?? '6.0cm',
        top: courseAdjLabelPlacement?.y ?? '0.9cm',
        pointerEvents: 'auto'
    }), [courseAdjLabelPlacement]);

    const otherAdjLabelWrapperStyle = useMemo<React.CSSProperties>(() => ({
        display: 'inline-flex',
        position: 'absolute',
        left: otherAdjLabelPlacement?.x ?? '6.2cm',
        top: otherAdjLabelPlacement?.y ?? '1.8cm',
        pointerEvents: 'auto'
    }), [otherAdjLabelPlacement]);

    const totalRunsLabelWrapperStyle = useMemo<React.CSSProperties>(() => ({
        display: 'inline-flex'
    }), []);

    const estimatedAgeLabelWrapperStyle = useMemo<React.CSSProperties>(() => ({
        display: 'inline-flex',
        position: 'absolute',
        left: estimatedAgeLabelPlacement?.x ?? '0.2cm',
        top: estimatedAgeLabelPlacement?.y ?? '2.2cm',
        pointerEvents: 'auto'
    }), [estimatedAgeLabelPlacement]);

    const clubLabelWrapperStyle = useMemo<React.CSSProperties>(() => ({
        display: 'inline-flex',
        position: 'absolute',
        left: clubLabelPlacement?.x ?? '1.0cm',
        top: clubLabelPlacement?.y ?? '2.2cm',
        pointerEvents: 'auto'
    }), [clubLabelPlacement]);

    const athleteCodeLabelWrapperStyle = useMemo<React.CSSProperties>(() => ({
        display: 'inline-flex',
        position: 'absolute',
        left: athleteCodeLabelPlacement?.x ?? '1.4cm',
        top: athleteCodeLabelPlacement?.y ?? '0.8cm',
        pointerEvents: 'auto'
    }), [athleteCodeLabelPlacement]);

    const athleteCodeFieldStyle = useMemo<React.CSSProperties>(() => ({
        position: 'absolute',
        left: athleteCodeFieldPlacement?.x ?? '3.4cm',
        top: athleteCodeFieldPlacement?.y ?? '0.8cm',
        width: athleteCodeFieldPlacement?.width,
        pointerEvents: 'auto'
    }), [athleteCodeFieldPlacement]);

    const freqCourseLabelWrapperStyle = useMemo<React.CSSProperties>(() => ({
        display: 'inline-flex',
        position: 'absolute',
        left: freqCourseLabelPlacement?.x ?? '8.0cm',
        top: freqCourseLabelPlacement?.y ?? '2.7cm',
        pointerEvents: 'auto'
    }), [freqCourseLabelPlacement]);

    const freqCourseValueStyle = useMemo<React.CSSProperties>(() => ({
        position: 'absolute',
        left: freqCourseValuePlacement?.x ?? '10.5cm',
        top: freqCourseValuePlacement?.y ?? '2.7cm',
        width: freqCourseValuePlacement?.width,
        pointerEvents: 'auto'
    }), [freqCourseValuePlacement]);

    const recentClubValueStyle = useMemo<React.CSSProperties>(() => ({
        position: 'absolute',
        left: recentClubValuePlacement?.x ?? '2.4cm',
        top: recentClubValuePlacement?.y ?? '2.2cm',
        width: recentClubValuePlacement?.width,
        pointerEvents: 'auto'
    }), [recentClubValuePlacement]);

    const estimatedAgeValueStyle = useMemo<React.CSSProperties>(() => ({
        position: 'absolute',
        left: estimatedAgeValuePlacement?.x ?? '1.6cm',
        top: estimatedAgeValuePlacement?.y ?? '2.2cm',
        width: estimatedAgeValuePlacement?.width,
        pointerEvents: 'auto'
    }), [estimatedAgeValuePlacement]);

    const statusMessageStyle = useMemo<React.CSSProperties>(() => ({
        position: 'absolute',
        left: statusMessagePlacement?.x ?? '2.6cm',
        top: statusMessagePlacement?.y ?? '3.6cm',
        width: statusMessagePlacement?.width,
        pointerEvents: 'none'
    }), [statusMessagePlacement]);

    const totalRunsRowStyle = useMemo<React.CSSProperties>(() => ({
        position: 'absolute',
        left: totalRunsLabelPlacement?.x ?? '1.5cm',
        top: totalRunsLabelPlacement?.y ?? '1.0cm',
        display: 'inline-flex',
        alignItems: 'center',
        whiteSpace: 'nowrap'
    }), [totalRunsLabelPlacement]);

    const totalRunsValueStyle = useMemo<React.CSSProperties>(() => ({
        position: 'relative',
        left: `calc((${totalRunsValuePlacement?.x ?? '3.4cm'}) - (${totalRunsLabelPlacement?.x ?? '1.5cm'}))`,
        top: `calc((${totalRunsValuePlacement?.y ?? '1.0cm'}) - (${totalRunsLabelPlacement?.y ?? '1.0cm'}))`,
        marginLeft: '0.15rem',
        display: 'inline-block'
    }), [totalRunsLabelPlacement, totalRunsValuePlacement]);

    const tableViewSelectStyle = useMemo<React.CSSProperties>(() => {
        return {
            position: 'absolute',
            left: tableViewSelectPlacement?.x ?? '8.7cm',
            top: tableViewSelectPlacement?.y ?? '0cm',
            marginLeft: 0,
            width: tableViewSelectPlacement?.width,
            minWidth: tableViewSelectPlacement?.width,
            maxWidth: tableViewSelectPlacement?.width,
            pointerEvents: 'auto'
        };
    }, [tableViewSelectPlacement]);

    const courseAdjSelectStyle = useMemo<React.CSSProperties>(() => {
        return {
            position: 'absolute',
            left: courseAdjSelectPlacement?.x ?? '8.7cm',
            top: courseAdjSelectPlacement?.y ?? '0.9cm',
            marginLeft: 0,
            width: courseAdjSelectPlacement?.width,
            minWidth: courseAdjSelectPlacement?.width,
            maxWidth: courseAdjSelectPlacement?.width,
            pointerEvents: 'auto'
        };
    }, [courseAdjSelectPlacement]);

    const otherAdjSelectStyle = useMemo<React.CSSProperties>(() => {
        return {
            position: 'absolute',
            left: otherAdjSelectPlacement?.x ?? '8.7cm',
            top: otherAdjSelectPlacement?.y ?? '1.8cm',
            marginLeft: 0,
            width: otherAdjSelectPlacement?.width,
            minWidth: otherAdjSelectPlacement?.width,
            maxWidth: otherAdjSelectPlacement?.width,
            pointerEvents: 'auto'
        };
    }, [otherAdjSelectPlacement]);

    const estRankLabelWrapperStyle = useMemo<React.CSSProperties>(() => ({
        position: 'absolute',
        left: estRankLabelPlacement?.x ?? otherAdjSelectPlacement?.x ?? '8.7cm',
        top: estRankLabelPlacement?.y ?? `calc(${otherAdjSelectPlacement?.y ?? '1.8cm'} + 0.85cm)`,
        display: 'inline-flex',
        zIndex: 25,
        background: 'rgba(255, 255, 255, 0.92)',
        padding: '0 0.08cm',
        pointerEvents: 'auto',
        whiteSpace: 'nowrap'
    }), [estRankLabelPlacement, otherAdjSelectPlacement]);

    const estRankValueStyle = useMemo<React.CSSProperties>(() => ({
        position: 'absolute',
        left: estRankValuePlacement?.x ?? `calc(${estRankLabelPlacement?.x ?? otherAdjSelectPlacement?.x ?? '8.7cm'} + 2.1cm)`,
        top: estRankValuePlacement?.y ?? estRankLabelPlacement?.y ?? `calc(${otherAdjSelectPlacement?.y ?? '1.8cm'} + 0.85cm)`,
        zIndex: 25,
        background: 'rgba(255, 255, 255, 0.92)',
        padding: '0 0.08cm',
        pointerEvents: 'none',
        whiteSpace: 'nowrap',
        opacity: estimatedRankSummary.hasValue ? 1 : 0.45
    }), [estRankLabelPlacement?.x, estRankLabelPlacement?.y, estRankValuePlacement, estimatedRankSummary.hasValue, otherAdjSelectPlacement?.x, otherAdjSelectPlacement?.y]);

    const profileButtonStyle = useMemo<React.CSSProperties>(() => ({
        position: 'absolute',
        left: profileButtonPlacement?.x ?? '13.3cm',
        top: profileButtonPlacement?.y ?? '1.4cm',
        width: profileButtonPlacement?.width ?? profileButtonElement?.style?.width ?? '1cm',
        height: profileButtonPlacement?.height ?? profileButtonElement?.style?.height ?? '1cm',
        border: '1px solid #777',
        borderRadius: '6px',
        background: '#fff',
        cursor: 'pointer',
        fontSize: profileButtonElement?.style?.fontSize ?? '0.5rem',
        fontWeight: profileButtonElement?.style?.fontWeight ?? 700,
        lineHeight: Number(profileButtonElement?.style?.lineHeight ?? 1),
        padding: 0,
        pointerEvents: 'auto'
    }), [profileButtonElement?.style?.fontSize, profileButtonElement?.style?.fontWeight, profileButtonElement?.style?.height, profileButtonElement?.style?.lineHeight, profileButtonElement?.style?.width, profileButtonPlacement]);

    const resetButtonStyle = useMemo<React.CSSProperties>(() => ({
        position: 'absolute',
        left: resetButtonPlacement?.x ?? '-0.2cm',
        top: resetButtonPlacement?.y ?? '1.0cm',
        width: resetButtonPlacement?.width ?? resetButtonElement?.style?.width ?? '1cm',
        height: resetButtonPlacement?.height ?? resetButtonElement?.style?.height ?? '1cm',
        border: '1px solid #777',
        borderRadius: '6px',
        background: '#fff',
        cursor: 'pointer',
        fontSize: resetButtonElement?.style?.fontSize ?? '0.5rem',
        fontWeight: resetButtonElement?.style?.fontWeight ?? 700,
        lineHeight: Number(resetButtonElement?.style?.lineHeight ?? 1),
        padding: 0,
        pointerEvents: 'auto'
    }), [resetButtonElement?.style?.fontSize, resetButtonElement?.style?.fontWeight, resetButtonElement?.style?.height, resetButtonElement?.style?.lineHeight, resetButtonElement?.style?.width, resetButtonPlacement]);

    const buildPanelContainerStyle = useCallback((
        placement: { x?: string; y?: string; width?: string; height?: string } | undefined,
        fallbackHeight?: string,
        fallbackWidth?: string
    ): React.CSSProperties => {
        if (isMobile) {
            return {
                position: 'relative',
                left: 'auto',
                top: 'auto',
                width: '100%',
                height: placement?.height ?? fallbackHeight,
                marginLeft: placement?.x ?? '0cm',
                marginTop: `calc(${placement?.y ?? '0cm'} - 0.5cm)`
            };
        }

        return {
            position: 'absolute',
            left: placement?.x ?? '0cm',
            top: `calc(${placement?.y ?? '3.5cm'} - 0.5cm)`,
            width: placement?.width ?? fallbackWidth ?? '100%',
            height: placement?.height ?? fallbackHeight,
            marginTop: 0
        };
    }, [isMobile]);

    const tableContainerStyle = useMemo<React.CSSProperties>(() => {
        return buildPanelContainerStyle(tableContainerPlacement, tableContainerPlacement?.height, tableContainerPlacement?.width ?? '100%');
    }, [buildPanelContainerStyle, tableContainerPlacement]);

    const plotContainerStyle = useMemo<React.CSSProperties>(() => {
        return buildPanelContainerStyle(plotContainerPlacement, plotContainerPlacement?.height, plotContainerPlacement?.width ?? '100%');
    }, [buildPanelContainerStyle, plotContainerPlacement]);

    const curveRankReferenceContainerStyle = useMemo<React.CSSProperties>(() => {
        return buildPanelContainerStyle(curveRankReferenceContainerPlacement, curveRankReferenceContainerPlacement?.height, curveRankReferenceContainerPlacement?.width ?? '100%');
    }, [buildPanelContainerStyle, curveRankReferenceContainerPlacement]);

    const tableWrapperSizeStyle = useMemo<React.CSSProperties>(() => ({
        width: tableContainerPlacement?.width,
        maxWidth: tableContainerPlacement?.width ?? '100%',
        height: tableContainerPlacement?.height,
        maxHeight: tableContainerPlacement?.height
    }), [tableContainerPlacement]);

    const profileWrapperSizeStyle = useMemo<React.CSSProperties>(() => ({
        width: profileContainerPlacement?.width ?? tableWrapperSizeStyle.width,
        maxWidth: profileContainerPlacement?.width ?? tableWrapperSizeStyle.maxWidth,
        height: profileContainerPlacement?.height ?? tableWrapperSizeStyle.height,
        maxHeight: profileContainerPlacement?.height ?? tableWrapperSizeStyle.maxHeight
    }), [profileContainerPlacement, tableWrapperSizeStyle.height, tableWrapperSizeStyle.maxHeight, tableWrapperSizeStyle.maxWidth, tableWrapperSizeStyle.width]);

    const activePanelContainerStyle = useMemo<React.CSSProperties>(() => {
        if (curveRankReferenceOpen) {
            return curveRankReferenceContainerStyle;
        }
        if (showPlot) {
            return plotContainerStyle;
        }
        if (!showProfile) {
            return tableContainerStyle;
        }
        return {
            ...tableContainerStyle,
            width: profileContainerPlacement?.width ?? tableContainerStyle.width,
            height: profileContainerPlacement?.height ?? tableContainerStyle.height
        };
    }, [curveRankReferenceContainerStyle, curveRankReferenceOpen, plotContainerStyle, profileContainerPlacement?.height, profileContainerPlacement?.width, showPlot, showProfile, tableContainerStyle]);

    const nonPlotPanelTopOffset = useMemo(() => (isMobile ? '0cm' : 'calc(0.3cm + 0.2rem)'), [isMobile]);
    const plotControlsTopOffset = useMemo(() => (isMobile ? '0cm' : '0.7cm'), [isMobile]);

    const tableViewLabelTextStyle = useMemo<React.CSSProperties>(() => {
        const style = tableViewLabelElement?.style;
        return {
            fontSize: style?.fontSize,
            fontWeight: style?.fontWeight,
            color: style?.color,
            lineHeight: style?.lineHeight
        };
    }, [tableViewLabelElement]);

    const courseAdjLabelTextStyle = useMemo<React.CSSProperties>(() => {
        const style = courseAdjLabelElement?.style;
        return {
            fontSize: style?.fontSize,
            fontWeight: style?.fontWeight,
            color: style?.color,
            lineHeight: style?.lineHeight
        };
    }, [courseAdjLabelElement]);

    const otherAdjLabelTextStyle = useMemo<React.CSSProperties>(() => {
        const style = otherAdjLabelElement?.style;
        return {
            fontSize: style?.fontSize,
            fontWeight: style?.fontWeight,
            color: style?.color,
            lineHeight: style?.lineHeight
        };
    }, [otherAdjLabelElement]);

    const freqCourseLabelTextStyle = useMemo<React.CSSProperties>(() => {
        const style = freqCourseLabelElement?.style;
        return {
            fontSize: style?.fontSize,
            fontWeight: style?.fontWeight,
            color: style?.color,
            lineHeight: style?.lineHeight
        };
    }, [freqCourseLabelElement]);

    const totalRunsLabelTextStyle = useMemo<React.CSSProperties>(() => {
        const style = totalRunsLabelElement?.style;
        return {
            fontSize: style?.fontSize,
            fontWeight: style?.fontWeight,
            color: style?.color,
            lineHeight: style?.lineHeight
        };
    }, [totalRunsLabelElement]);

    const clubLabelTextStyle = useMemo<React.CSSProperties>(() => {
        const style = clubLabelElement?.style;
        return {
            fontSize: style?.fontSize,
            fontWeight: style?.fontWeight,
            color: style?.color,
            lineHeight: style?.lineHeight
        };
    }, [clubLabelElement]);

    const estimatedAgeLabelTextStyle = useMemo<React.CSSProperties>(() => {
        const style = estimatedAgeLabelElement?.style;
        return {
            fontSize: style?.fontSize,
            fontWeight: style?.fontWeight,
            color: style?.color,
            lineHeight: style?.lineHeight
        };
    }, [estimatedAgeLabelElement]);

    const athleteCodeLabelTextStyle = useMemo<React.CSSProperties>(() => {
        const style = athleteCodeLabelElement?.style;
        return {
            fontSize: style?.fontSize,
            fontWeight: style?.fontWeight,
            color: style?.color,
            lineHeight: style?.lineHeight
        };
    }, [athleteCodeLabelElement]);

    const estRankLabelTextStyle = useMemo<React.CSSProperties>(() => {
        const style = estRankLabelElement?.style;
        return {
            fontSize: style?.fontSize ?? (isMobile ? '0.72rem' : '0.76rem'),
            fontWeight: style?.fontWeight ?? 700,
            color: style?.color ?? '#111827',
            lineHeight: style?.lineHeight ?? 1.2
        };
    }, [estRankLabelElement, isMobile]);

    const totalRunsValueTextStyle = useMemo<React.CSSProperties>(() => {
        const style = totalRunsValueElement?.style;
        return {
            fontSize: style?.fontSize,
            fontWeight: style?.fontWeight,
            color: style?.color,
            lineHeight: style?.lineHeight,
            fontStyle: style?.fontStyle,
            textAlign: style?.textAlign,
            width: totalRunsValuePlacement?.width ?? style?.width,
            height: totalRunsValuePlacement?.height ?? style?.height
        };
    }, [totalRunsValueElement, totalRunsValuePlacement]);

    const recentClubValueTextStyle = useMemo<React.CSSProperties>(() => {
        const style = recentClubValueElement?.style;
        return {
            fontSize: style?.fontSize,
            fontWeight: style?.fontWeight,
            color: style?.color,
            lineHeight: style?.lineHeight,
            fontStyle: style?.fontStyle,
            textAlign: style?.textAlign,
            width: recentClubValuePlacement?.width ?? style?.width,
            height: recentClubValuePlacement?.height ?? style?.height
        };
    }, [recentClubValueElement, recentClubValuePlacement]);

    const freqCourseValueTextStyle = useMemo<React.CSSProperties>(() => {
        const style = freqCourseValueElement?.style;
        return {
            fontSize: style?.fontSize,
            fontWeight: style?.fontWeight,
            color: style?.color,
            lineHeight: style?.lineHeight,
            fontStyle: style?.fontStyle,
            textAlign: style?.textAlign,
            width: freqCourseValuePlacement?.width ?? style?.width,
            height: freqCourseValuePlacement?.height ?? style?.height
        };
    }, [freqCourseValueElement, freqCourseValuePlacement]);

    const estimatedAgeValueTextStyle = useMemo<React.CSSProperties>(() => {
        const style = estimatedAgeValueElement?.style;
        return {
            fontSize: style?.fontSize,
            fontWeight: style?.fontWeight,
            color: style?.color,
            lineHeight: style?.lineHeight,
            fontStyle: style?.fontStyle,
            textAlign: style?.textAlign,
            width: estimatedAgeValuePlacement?.width ?? style?.width,
            height: estimatedAgeValuePlacement?.height ?? style?.height
        };
    }, [estimatedAgeValueElement, estimatedAgeValuePlacement]);

    const estRankValueTextStyle = useMemo<React.CSSProperties>(() => {
        const style = estRankValueElement?.style;
        return {
            fontSize: style?.fontSize ?? (isMobile ? '0.72rem' : '0.76rem'),
            fontWeight: style?.fontWeight ?? 700,
            color: style?.color ?? (estimatedRankSummary.hasValue ? '#111827' : '#6b7280'),
            lineHeight: style?.lineHeight ?? 1.2,
            fontStyle: style?.fontStyle,
            textAlign: style?.textAlign,
            width: estRankValuePlacement?.width ?? style?.width,
            height: estRankValuePlacement?.height ?? style?.height
        };
    }, [estRankValueElement, estRankValuePlacement, estimatedRankSummary.hasValue, isMobile]);

    const eventsAllPieDiameter = useMemo(() => {
        const width = eventsAllPieElement?.style?.width;
        const height = eventsAllPieElement?.style?.height;
        return width || height || (isMobile ? '3.1cm' : '3.6cm');
    }, [eventsAllPieElement, isMobile]);

    const statusMessageTextStyle = useMemo<React.CSSProperties>(() => {
        const style = statusMessageElement?.style;
        return {
            fontSize: style?.fontSize,
            fontWeight: style?.fontWeight,
            color: style?.color,
            lineHeight: style?.lineHeight,
            fontStyle: style?.fontStyle,
            textAlign: style?.textAlign,
            width: statusMessagePlacement?.width ?? style?.width,
            height: statusMessagePlacement?.height ?? style?.height,
            whiteSpace: 'normal'
        };
    }, [statusMessageElement, statusMessagePlacement]);

    const participantStatusMessage = useMemo(() => {
        if (activeSelectedCode && loading) {
            return 'Loading athlete data…';
        }
        if (error) {
            return error;
        }
        return '';
    }, [activeSelectedCode, error, loading]);

    const renderConfigControlLabel = (
        element: {
            helpLabel?: boolean;
            helpTarget?: string;
            name?: string;
            style?: {
                fontStyle?: string;
                backgroundColor?: string;
                padding?: string;
                width?: string;
                height?: string;
            };
        } | undefined,
        fallbackName: string,
        fallbackHelpTarget: string,
        htmlFor: string,
        textStyle?: React.CSSProperties,
        wrapperStyle?: React.CSSProperties,
        preferHelpLabel: boolean = false
    ) => {
        const labelText = element?.name || fallbackName;
        const helpTarget = element?.helpTarget || fallbackHelpTarget;
        const helpTitle = `${String(labelText).replace(/:\s*$/, '')} help`;
        const shouldRenderHelpLabel = element?.helpLabel ?? preferHelpLabel;

        if (shouldRenderHelpLabel) {
            const buttonStyle: React.CSSProperties = {
                fontStyle: element?.style?.fontStyle,
                background: element?.style?.backgroundColor,
                padding: element?.style?.padding,
                width: element?.style?.width,
                height: element?.style?.height
            };
            return (
                <span className="help-tooltip" style={wrapperStyle ?? { display: 'inline-flex' }}>
                    <button
                        type="button"
                        className="help-trigger help-trigger-label"
                        style={buttonStyle}
                        onClick={(event) => {
                            const rect = (event.currentTarget as HTMLButtonElement).getBoundingClientRect();
                            requestUnifiedHelp(helpTarget, {
                                x: rect.left,
                                y: rect.bottom
                            });
                        }}
                        title={helpTitle}
                        aria-label={helpTitle}
                    >
                        <span className="help-trigger-text" style={textStyle}>{labelText}</span>
                    </button>
                </span>
            );
        }

        return (
            <span style={wrapperStyle ?? { display: 'inline-flex' }}>
                <label htmlFor={htmlFor} style={textStyle}>{labelText}</label>
            </span>
        );
    };

    const renderConfigInfoLabel = (
        element: {
            helpLabel?: boolean;
            helpTarget?: string;
            name?: string;
            style?: {
                fontStyle?: string;
                backgroundColor?: string;
                padding?: string;
                width?: string;
                height?: string;
            };
        } | undefined,
        fallbackName: string,
        fallbackHelpTarget: string,
        textStyle?: React.CSSProperties,
        wrapperStyle?: React.CSSProperties,
        preferHelpLabel: boolean = false
    ) => {
        const labelText = element?.name || fallbackName;
        const helpTarget = element?.helpTarget || fallbackHelpTarget;
        const helpTitle = `${String(labelText).replace(/:\s*$/, '')} help`;
        const shouldRenderHelpLabel = element ? Boolean(element.helpLabel) : preferHelpLabel;

        if (shouldRenderHelpLabel) {
            const buttonStyle: React.CSSProperties = {
                fontStyle: element?.style?.fontStyle,
                background: element?.style?.backgroundColor,
                padding: element?.style?.padding,
                width: element?.style?.width,
                height: element?.style?.height
            };
            return (
                <span className="help-tooltip" style={wrapperStyle ?? { display: 'inline-flex' }}>
                    <button
                        type="button"
                        className="help-trigger help-trigger-label"
                        style={buttonStyle}
                        onClick={(event) => {
                            const rect = (event.currentTarget as HTMLButtonElement).getBoundingClientRect();
                            requestUnifiedHelp(helpTarget, {
                                x: rect.left,
                                y: rect.bottom
                            });
                        }}
                        title={helpTitle}
                        aria-label={helpTitle}
                    >
                        <span className="help-trigger-text" style={textStyle}>{labelText}</span>
                    </button>
                </span>
            );
        }

        return <span style={textStyle}>{labelText}</span>;
    };

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
    const configuredPlotWidth = plotContainerPlacement?.width;
    const configuredPlotHeight = plotContainerPlacement?.height;
    const configuredPlotControlsWidth = plotContainerBasePlacement?.width;
    const plotPanelHeight = configuredPlotHeight ?? (isMobile ? '8.5cm' : isPlotExpanded ? '14cm' : '10cm');
    const plotPanelMaxWidth = configuredPlotWidth ?? (isMobile ? '100%' : isPlotExpanded ? '100%' : '20cm');
    const plotControlsMaxWidth = configuredPlotControlsWidth ?? (isMobile ? '100%' : '20cm');
    const plotChartMinWidth = isMobile ? (configuredPlotWidth ?? '10cm') : isPlotExpanded ? '18cm' : '100%';
    const plotCaptionGapReduction = '0.2cm';
    const plotChartHeight = `calc(${plotPanelHeight} - ${isMobile ? '5.8cm' : '4.9cm'})`;
    const curveRankReferencePanelWidth = curveRankReferenceContainerPlacement?.width ?? plotPanelMaxWidth;
    const curveRankReferencePanelHeight = curveRankReferenceContainerPlacement?.height ?? (isMobile ? plotPanelHeight : `calc(${plotPanelHeight} + 1cm)`);
    const plotPanelTopOffset = '0cm';
    const curveRankReferencePanelTopOffset = '0cm';
    const curveRankReferencePanelLeftOffset = '0cm';

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

    const nextPlotEligibilityLabel =
        plotEligibilityMode === 'all' ? 'Eligible' : plotEligibilityMode === 'eligible' ? 'Best' : 'All';

    const nextPlotSeriesLabel =
        plotSeriesMode === 'events_only' ? 'Rank Only' : plotSeriesMode === 'rank_only' ? 'Both Series' : 'Events Only';

    const togglePlotExpanded = () => {
        if (!canTogglePlotExpand) {
            return;
        }
        setIsPlotExpanded((prev) => !prev);
    };

    useEffect(() => {
        if (!curveRankReferenceOpen) {
            return;
        }

        let cancelled = false;

        const loadCurveRankReference = async () => {
            try {
                setCurveRankReferenceLoading(true);
                setCurveRankReferenceError(null);
                const payload = await fetchCurveRankReference(curveRankReferenceType, curveRankReferenceVersion || undefined);
                if (cancelled) {
                    return;
                }
                const versions = Array.isArray(payload?.available_curve_rank_reference_versions)
                    ? payload.available_curve_rank_reference_versions.filter((value): value is string => typeof value === 'string' && value.trim() !== '')
                    : [];
                const latestVersion = typeof payload?.latest_curve_rank_reference_version === 'string'
                    ? payload.latest_curve_rank_reference_version
                    : '';
                const selectedVersion = typeof payload?.curve_rank_reference_version === 'string'
                    ? payload.curve_rank_reference_version
                    : latestVersion;
                setCurveRankReferenceRows(Array.isArray(payload?.rows) ? payload.rows : []);
                setCurveRankReferenceVersions(versions);
                setCurveRankReferenceLatestVersion(latestVersion);
                if (selectedVersion && selectedVersion !== curveRankReferenceVersion) {
                    setCurveRankReferenceVersion(selectedVersion);
                }
            } catch (_error) {
                if (cancelled) {
                    return;
                }
                setCurveRankReferenceRows([]);
                setCurveRankReferenceError('Unable to load curved time rank reference right now.');
            } finally {
                if (!cancelled) {
                    setCurveRankReferenceLoading(false);
                }
            }
        };

        loadCurveRankReference();

        return () => {
            cancelled = true;
        };
    }, [curveRankReferenceOpen, curveRankReferenceType, curveRankReferenceVersion]);

    const handleCurveRankReferenceHelp = (event?: React.MouseEvent<HTMLElement>) => {
        if (event?.currentTarget) {
            const rect = event.currentTarget.getBoundingClientRect();
            requestUnifiedHelp('section-curved-rank-time-reference', {
                x: rect.left,
                y: rect.bottom
            }, 'Curved Rank Time Reference');
            return;
        }
        requestUnifiedHelp('section-curved-rank-time-reference', null, 'Curved Rank Time Reference');
    };

    const curveRankReferenceVersionOptions = useMemo(() => {
        const values = curveRankReferenceVersions.slice();
        if (curveRankReferenceLatestVersion && !values.includes(curveRankReferenceLatestVersion)) {
            values.unshift(curveRankReferenceLatestVersion);
        }
        return values;
    }, [curveRankReferenceLatestVersion, curveRankReferenceVersions]);

    const curveRankReferenceSelectedVersion = curveRankReferenceVersion || curveRankReferenceLatestVersion || curveRankReferenceVersionOptions[0] || '';

    const formatCurveRankReferenceScore = (value: unknown): string => {
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) {
            return '--';
        }
        return Number.isInteger(numeric) ? `${numeric}` : numeric.toFixed(1);
    };

    const getPlotControlOffset = React.useCallback((value?: string, base?: string, extraOffset?: string): string | undefined => {
        if (!value) {
            return undefined;
        }
        if (!base) {
            return extraOffset && extraOffset !== '0cm' ? `calc(${value} + ${extraOffset})` : value;
        }
        return extraOffset && extraOffset !== '0cm'
            ? `calc(${value} - ${base} + ${extraOffset})`
            : `calc(${value} - ${base})`;
    }, []);

    const plotShowLabelStyle = useMemo<React.CSSProperties>(() => ({
        position: 'absolute',
        left: getPlotControlOffset(plotShowLabelPlacement?.x, tableContainerPlacement?.x),
        top: getPlotControlOffset(plotShowLabelPlacement?.y, tableContainerPlacement?.y, plotControlsTopOffset),
        fontSize: plotShowLabelElement?.style?.fontSize ?? '0.78rem',
        fontWeight: plotShowLabelElement?.style?.fontWeight ?? 700,
        color: plotShowLabelElement?.style?.color ?? '#111827',
        lineHeight: plotShowLabelElement?.style?.lineHeight ?? 1.0,
        pointerEvents: 'auto'
    }), [getPlotControlOffset, plotControlsTopOffset, plotShowLabelElement?.style?.color, plotShowLabelElement?.style?.fontSize, plotShowLabelElement?.style?.fontWeight, plotShowLabelElement?.style?.lineHeight, plotShowLabelPlacement?.x, plotShowLabelPlacement?.y, tableContainerPlacement?.x, tableContainerPlacement?.y]);

    const buildPlotButtonStyle = React.useCallback((
        placement?: { x?: string; y?: string; width?: string; height?: string },
        element?: { style?: { border?: string; borderRadius?: string; backgroundColor?: string; color?: string; fontSize?: string; fontWeight?: string | number; padding?: string } }
    ): React.CSSProperties => ({
        position: 'absolute',
        left: getPlotControlOffset(placement?.x, tableContainerPlacement?.x),
        top: getPlotControlOffset(placement?.y, tableContainerPlacement?.y, plotControlsTopOffset),
        width: placement?.width,
        height: placement?.height ?? '1.9rem',
        border: element?.style?.border ?? '1px solid #9ca3af',
        borderRadius: element?.style?.borderRadius ?? '6px',
        background: element?.style?.backgroundColor ?? '#fff',
        color: element?.style?.color ?? '#111827',
        fontSize: element?.style?.fontSize ?? '0.78rem',
        fontWeight: element?.style?.fontWeight ?? 700,
        cursor: 'pointer',
        padding: element?.style?.padding ?? '0 0.65rem',
        pointerEvents: 'auto'
    }), [getPlotControlOffset, plotControlsTopOffset, tableContainerPlacement?.x, tableContainerPlacement?.y]);

    const plotBestButtonStyle = useMemo(
        () => buildPlotButtonStyle(plotBestButtonPlacement, plotBestButtonElement as any),
        [buildPlotButtonStyle, plotBestButtonElement, plotBestButtonPlacement]
    );
    const plotRankOnlyButtonStyle = useMemo(
        () => buildPlotButtonStyle(plotRankOnlyButtonPlacement, plotRankOnlyButtonElement as any),
        [buildPlotButtonStyle, plotRankOnlyButtonElement, plotRankOnlyButtonPlacement]
    );
    const plotExpandButtonStyle = useMemo(
        () => buildPlotButtonStyle(plotExpandButtonPlacement, plotExpandButtonElement as any),
        [buildPlotButtonStyle, plotExpandButtonElement, plotExpandButtonPlacement]
    );

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
                left: isMobile ? 26 : 38,
                right: isMobile ? 84 : 64,
                top: 22,
                bottom: 36,
                containLabel: true,
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
                nameGap: 36,
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
                    name: isMobile ? 'Time (mm)' : 'Time',
                    nameLocation: 'middle',
                    nameGap: isMobile ? 26 : 46,
                    axisLabel: {
                        formatter: (value: number) => {
                            if (isMobile) {
                                const minutes = Math.floor(Number(value || 0) / 60);
                                return String(Math.max(0, minutes)).padStart(2, '0');
                            }
                            return formatTimeValue(value);
                        }
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
                    nameGap: isMobile ? 32 : 42,
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

    const currentPanelMode: 'table' | 'profile' | 'plot' | 'rank' = curveRankReferenceOpen ? 'rank' : (showProfile ? 'profile' : (showPlot ? 'plot' : 'table'));
    const nextPanelMode: 'table' | 'profile' | 'plot' | 'rank' =
        currentPanelMode === 'table'
            ? 'profile'
            : currentPanelMode === 'profile'
                ? 'plot'
                : currentPanelMode === 'plot'
                    ? 'rank'
                    : 'table';
    const panelToggleLabel = nextPanelMode === 'table' ? 'Table' : (nextPanelMode === 'profile' ? 'Profile' : (nextPanelMode === 'plot' ? 'Plot' : 'Rank'));
    const handlePanelCycle = () => {
        if (!showProfile && !showPlot && !curveRankReferenceOpen) {
            setShowProfile(true);
            setShowPlot(false);
            setCurveRankReferenceOpen(false);
            return;
        }
        if (showProfile) {
            setShowProfile(false);
            setShowPlot(true);
            setCurveRankReferenceOpen(false);
            return;
        }
        if (showPlot) {
            setShowProfile(false);
            setShowPlot(false);
            setCurveRankReferenceError(null);
            setCurveRankReferenceOpen(true);
            return;
        }
        setCurveRankReferenceOpen(false);
        setShowPlot(false);
        setShowProfile(false);
    };
    const showBackButton = showHeader;

    return (
        <div className="page-content athletes-page" style={{ position: 'relative' }}>
            
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
                            style={backButtonStyle}
                        >
                            &#8592;
                        </button>
                    )}
                    <div className={`athlete-header-main ${showHeader ? 'athlete-header-main--selected' : 'athlete-header-main--search'}`}>
                        <div className="athlete-header-text">
                            <div className="athlete-header-title" title="Athlete Search" style={participantInputWrapperStyle}>
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
                                <>
                                    {renderConfigControlLabel(
                                        athleteCodeLabelElement,
                                        'Athlete code:',
                                        'control-athlete-code',
                                        'athletes-athlete-code',
                                        athleteCodeLabelTextStyle,
                                        athleteCodeLabelWrapperStyle,
                                        true
                                    )}
                                    <div className="athlete-header-code" title="Athlete Code" style={athleteCodeFieldStyle}>
                                        {headerCode}
                                    </div>
                                </>
                            )}
                            {showHeader && (
                                <>
                                    {renderConfigControlLabel(
                                        clubLabelElement,
                                        'Recent club:',
                                        'control-recent-club',
                                        'athletes-recent-club',
                                        clubLabelTextStyle,
                                        clubLabelWrapperStyle,
                                        true
                                    )}
                                    <div className="athlete-header-club" title="Athlete's Club" style={{ ...recentClubValueStyle, ...recentClubValueTextStyle }}>
                                        {headerClubIsLinkable ? (
                                            <button
                                                type="button"
                                                className="athletes-club-link"
                                                onPointerDown={(event) => {
                                                    event.stopPropagation();
                                                }}
                                                onClick={(event) => {
                                                    event.stopPropagation();
                                                    handleClubNavigate(headerClub, latestRun ?? undefined);
                                                }}
                                                title={`Open club: ${headerClub}`}
                                                aria-label={`Open club ${headerClub}`}
                                                style={{
                                                    display: 'inline-block',
                                                    maxWidth: '100%',
                                                    whiteSpace: 'nowrap',
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis'
                                                }}
                                            >
                                                {headerClub}
                                            </button>
                                        ) : (
                                            headerClub
                                        )}
                                    </div>
                                </>
                            )}
                            {showHeader && (
                                <>
                                    {renderConfigControlLabel(
                                        estimatedAgeLabelElement,
                                        'Estimated age:',
                                        'control-estimated-age',
                                        'athletes-estimated-age',
                                        estimatedAgeLabelTextStyle,
                                        estimatedAgeLabelWrapperStyle,
                                        true
                                    )}
                                    <div className="athlete-header-age" title="Estimated Age" style={{ ...estimatedAgeValueStyle, ...estimatedAgeValueTextStyle }}>
                                        {formattedLatestAge || '--'}
                                    </div>
                                </>
                            )}
                            {showHeader && totalRunsCount !== undefined && (
                                <div
                                    className="athlete-header-total-runs"
                                    title="Total runs recorded"
                                    style={totalRunsRowStyle}
                                >
                                    {renderConfigControlLabel(
                                        totalRunsLabelElement,
                                        'Total runs:',
                                        'control-total-runs',
                                        'athletes-total-runs-label',
                                        totalRunsLabelTextStyle,
                                        totalRunsLabelWrapperStyle,
                                        true
                                    )}
                                    <span style={{ ...totalRunsValueStyle, ...totalRunsValueTextStyle }}>{totalRunsCount}</span>
                                </div>
                            )}
                            {participantStatusMessage && (
                                <div style={{ ...statusMessageStyle, ...statusMessageTextStyle }} aria-live="polite">
                                    {participantStatusMessage}
                                </div>
                            )}
                        </div>
                        
                        <div
                            style={{
                                position: 'absolute',
                                left: 0,
                                top: 0,
                                width: '100%',
                                height: isMobile ? '5.2cm' : '3.3cm',
                                overflow: 'visible',
                                pointerEvents: 'none',
                                zIndex: 20
                            }}
                        >
                            {showHeader && (
                                <>
                                    {renderConfigControlLabel(
                                        tableViewLabelElement,
                                        'Table View:',
                                        'control-table-view',
                                        'athletes-view-select',
                                        tableViewLabelTextStyle,
                                        tableViewLabelWrapperStyle
                                    )}
                                    <select
                                        id="athletes-view-select"
                                        value={viewMode}
                                        onChange={handleViewModeSelect}
                                        aria-label="Athletes view mode"
                                        style={tableViewSelectStyle}
                                    >
                                        <option value="basic">Basic</option>
                                        <option value="detailed">Detailed</option>
                                        <option value="all_time_adjustments">All Time Adjustments</option>
                                        <option value="event_ranks">Event Ranks</option>
                                    </select>

                                    {renderConfigControlLabel(
                                        courseAdjLabelElement,
                                        'Course adj:',
                                        'control-course-adj',
                                        'athletes-course-adj-select',
                                        courseAdjLabelTextStyle,
                                        courseAdjLabelWrapperStyle
                                    )}
                                    <select
                                        id="athletes-course-adj-select"
                                        value={courseAdj}
                                        onChange={handleCourseAdjSelect}
                                        aria-label="Course adjustment"
                                        style={courseAdjSelectStyle}
                                    >
                                        {courseAdjOptions.map((option) => (
                                            <option key={option.value} value={option.value} disabled={otherAdj !== 'none' && option.value === 'seasonal'}>{option.label}</option>
                                        ))}
                                    </select>

                                    {renderConfigControlLabel(
                                        otherAdjLabelElement,
                                        'Other adj:',
                                        'control-other-adj',
                                        'athletes-other-adj-select',
                                        otherAdjLabelTextStyle,
                                        otherAdjLabelWrapperStyle
                                    )}
                                    <select
                                        id="athletes-other-adj-select"
                                        value={otherAdj}
                                        onChange={handleOtherAdjSelect}
                                        aria-label="Other adjustment"
                                        style={otherAdjSelectStyle}
                                    >
                                        {otherAdjOptions.map((option) => (
                                            <option key={option.value} value={option.value} disabled={courseAdj === 'seasonal' && option.value !== 'none'}>{option.label}</option>
                                        ))}
                                    </select>
                                    {showHeader && (
                                        <>
                                            {renderConfigControlLabel(
                                                estRankLabelElement,
                                                `${estimatedRankSummary.label}:`,
                                                estRankLabelElement?.helpTarget || 'control-other-adj',
                                                'athletes-est-rank-label',
                                                estRankLabelTextStyle,
                                                estRankLabelWrapperStyle
                                            )}
                                            <div style={{ ...estRankValueStyle, ...estRankValueTextStyle }}>{estimatedRankSummary.value}</div>
                                        </>
                                    )}

                                    {renderConfigControlLabel(
                                        freqCourseLabelElement,
                                        'Freq Course:',
                                        'control-freq-course',
                                        'athletes-freq-course',
                                        freqCourseLabelTextStyle,
                                        freqCourseLabelWrapperStyle
                                    )}
                                    <div className="athlete-header-freq-course" title="Most frequent course in last year" style={{
                                        ...freqCourseValueStyle,
                                        ...recentClubValueTextStyle,
                                        width: freqCourseValuePlacement?.width ?? recentClubValueTextStyle.width,
                                        height: freqCourseValuePlacement?.height ?? recentClubValueTextStyle.height
                                    }}>
                                        {headerFavoriteCourseIsLinkable ? (
                                            <button
                                                id="athletes-freq-course"
                                                type="button"
                                                className="athletes-club-link"
                                                onPointerDown={(event) => {
                                                    event.stopPropagation();
                                                }}
                                                onClick={(event) => {
                                                    event.stopPropagation();
                                                    handleCourseNavigate(favoriteCourseRow ?? {});
                                                }}
                                                title={`Open course: ${headerFavoriteCourse}`}
                                                aria-label={`Open course ${headerFavoriteCourse}`}
                                                style={{
                                                    display: 'inline-block',
                                                    maxWidth: '100%',
                                                    whiteSpace: 'nowrap',
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis'
                                                }}
                                            >
                                                {headerFavoriteCourse}
                                            </button>
                                        ) : (
                                            headerFavoriteCourse
                                        )}
                                    </div>

                                    <button
                                        id="athletes-view-cycle-btn"
                                        type="button"
                                        onClick={handlePanelCycle}
                                        title={`Show ${panelToggleLabel.toLowerCase()}`}
                                        aria-label={`Show ${panelToggleLabel.toLowerCase()}`}
                                        style={profileButtonStyle}
                                    >
                                        {panelToggleLabel}
                                    </button>

                                    {resetButtonElement && (
                                        <button
                                            id="athletes-reset-highlight-btn"
                                            type="button"
                                            onClick={handleResetHighlights}
                                            title="Reset row highlights"
                                            aria-label="Reset row highlights"
                                            style={resetButtonStyle}
                                        >
                                            {resetButtonElement?.name || 'Reset'}
                                        </button>
                                    )}

                                </>
                            )}
                        </div>
                    </div>
                </div>
            {/* When no athlete selected, we show only the search box in the header above. Empty message removed. */}

            {!loading && !error && activeSelectedCode && (
                <>
                    <section className="athlete-runs-section" style={activePanelContainerStyle}>
                        {curveRankReferenceOpen ? (
                            <div
                                className="athlete-runs-table-wrapper athlete-runs-table-wrapper--plot"
                                style={{
                                    position: 'absolute',
                                    top: curveRankReferencePanelTopOffset,
                                    left: curveRankReferencePanelLeftOffset,
                                    marginTop: curveRankReferencePanelTopOffset,
                                    marginLeft: curveRankReferencePanelLeftOffset,
                                    background: 'transparent',
                                    boxShadow: 'none',
                                    border: 'none',
                                    padding: 0,
                                    display: 'block',
                                    width: curveRankReferencePanelWidth,
                                    maxWidth: curveRankReferencePanelWidth,
                                    overflow: 'visible',
                                    height: curveRankReferencePanelHeight,
                                    maxHeight: curveRankReferencePanelHeight,
                                    transform: 'none'
                                }}
                            >
                                <div
                                    role="dialog"
                                    aria-label="Curved Time Ranks Reference"
                                    style={{
                                        border: '2px solid #9ca3af',
                                        borderRadius: '12px',
                                        background: '#fff',
                                        marginLeft: '0.3cm',
                                        marginRight: '0.3cm',
                                        overflow: 'hidden',
                                        boxShadow: '0 10px 18px rgba(15, 23, 42, 0.08)',
                                        height: '100%',
                                        boxSizing: 'border-box',
                                        display: 'flex',
                                        flexDirection: 'column'
                                    }}
                                >
                                    <div
                                        style={{
                                            background: '#e5e7eb',
                                            borderBottom: '1px solid #d1d5db',
                                            padding: '0.55rem 0.8rem',
                                            fontSize: '1.02rem',
                                            fontWeight: 700,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '0.35rem'
                                        }}
                                    >
                                        <span>Curved Time Ranks Reference</span>
                                        <button
                                            type="button"
                                            className="top-bar-help-btn"
                                            aria-label="Curved Rank Time Reference help"
                                            title="Curved Rank Time Reference help"
                                            onClick={handleCurveRankReferenceHelp}
                                            style={{ flexShrink: 0 }}
                                        >
                                            📖
                                        </button>
                                    </div>
                                    <div style={{ padding: '0.45rem 0.7rem 0.55rem 0.7rem', display: 'flex', flexDirection: 'column', gap: '0.45rem', flex: 1, minHeight: 0 }}>
                                        {curveRankReferenceError ? (
                                            <div style={{ color: '#b91c1c', fontSize: '0.92rem' }}>{curveRankReferenceError}</div>
                                        ) : null}
                                        <div style={{ overflowY: 'auto', overflowX: 'hidden', border: '1px solid #d1d5db', borderRadius: '10px', flex: 1, minHeight: 0 }}>
                                            <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', fontSize: isMobile ? '0.67rem' : '0.74rem' }}>
                                                <thead>
                                                    <tr style={{ background: '#f0fdf4' }}>
                                                        <th style={{ width: '12%', textAlign: 'left', padding: '0.42rem 0.42rem', borderBottom: '1px solid #d1d5db', whiteSpace: 'normal', wordBreak: 'break-word', lineHeight: 1.15 }}>Rank</th>
                                                        <th style={{ width: '18%', textAlign: 'left', padding: '0.42rem 0.42rem', borderBottom: '1px solid #d1d5db', whiteSpace: 'normal', wordBreak: 'break-word', lineHeight: 1.15 }}>Min<br />time</th>
                                                        <th style={{ width: '18%', textAlign: 'left', padding: '0.42rem 0.42rem', borderBottom: '1px solid #d1d5db', whiteSpace: 'normal', wordBreak: 'break-word', lineHeight: 1.15 }}>Max<br />time</th>
                                                        <th style={{ width: '18%', textAlign: 'left', padding: '0.42rem 0.42rem', borderBottom: '1px solid #d1d5db', whiteSpace: 'normal', wordBreak: 'break-word', lineHeight: 1.15 }}>Low<br />bound</th>
                                                        <th style={{ width: '18%', textAlign: 'left', padding: '0.42rem 0.42rem', borderBottom: '1px solid #d1d5db', whiteSpace: 'normal', wordBreak: 'break-word', lineHeight: 1.15 }}>High<br />bound</th>
                                                        <th style={{ width: '16%', textAlign: 'left', padding: '0.42rem 0.42rem', borderBottom: '1px solid #d1d5db', whiteSpace: 'normal', wordBreak: 'break-word', lineHeight: 1.15 }}>Rank<br />cnt</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {curveRankReferenceLoading ? (
                                                        <tr>
                                                            <td colSpan={6} style={{ padding: '0.7rem 0.42rem', color: '#6b7280' }}>Loading reference rows…</td>
                                                        </tr>
                                                    ) : curveRankReferenceRows.length === 0 ? (
                                                        <tr>
                                                            <td colSpan={6} style={{ padding: '0.7rem 0.42rem', color: '#6b7280' }}>No curved rank reference rows available.</td>
                                                        </tr>
                                                    ) : curveRankReferenceRows.map((row) => (
                                                        <tr key={`${row.curve_rank_reference_version || 'latest'}-${row.curved_rank_group}`}>
                                                            <td style={{ padding: '0.42rem 0.42rem', borderBottom: '1px solid #e5e7eb', fontWeight: 600, whiteSpace: 'nowrap' }}>{row.curved_rank_group ?? '--'}</td>
                                                            <td style={{ padding: '0.42rem 0.42rem', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>{row.min_time || formatTimeValue(row.min_seconds) || '--'}</td>
                                                            <td style={{ padding: '0.42rem 0.42rem', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>{row.max_time || formatTimeValue(row.max_seconds) || '--'}</td>
                                                            <td style={{ padding: '0.42rem 0.42rem', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>{formatCurveRankReferenceScore(row.score_lower)}</td>
                                                            <td style={{ padding: '0.42rem 0.42rem', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>{formatCurveRankReferenceScore(row.score_upper)}</td>
                                                            <td style={{ padding: '0.42rem 0.42rem', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>{row.actual_group_cnt ?? '--'}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                    <div
                                        style={{
                                            display: 'flex',
                                            flexWrap: 'wrap',
                                            alignItems: 'center',
                                            gap: '0.9rem',
                                            padding: '0.75rem 0.9rem 0.85rem 0.9rem',
                                            borderTop: '1px solid #d1d5db',
                                            background: '#f9fafb'
                                        }}
                                    >
                                        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.88rem', color: '#111827', fontWeight: 600 }}>
                                            <span>Rank type</span>
                                            <select
                                                value={curveRankReferenceType}
                                                onChange={(event) => setCurveRankReferenceType(event.target.value as CurveRankReferenceType)}
                                                style={{ minWidth: '12rem' }}
                                            >
                                                {curveRankReferenceTypeOptions.map((option) => (
                                                    <option key={option.value} value={option.value}>{option.label}</option>
                                                ))}
                                            </select>
                                        </label>
                                        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.88rem', color: '#111827', fontWeight: 600 }}>
                                            <span>Date Snap</span>
                                            <select
                                                value={curveRankReferenceSelectedVersion}
                                                onChange={(event) => setCurveRankReferenceVersion(event.target.value)}
                                                style={{ minWidth: '10rem' }}
                                            >
                                                {curveRankReferenceVersionOptions.map((version) => (
                                                    <option key={version} value={version}>{version}</option>
                                                ))}
                                            </select>
                                        </label>
                                    </div>
                                </div>
                            </div>
                        ) : showPlot ? (
                            <>
                            <div
                                style={{
                                    width: '100%',
                                    maxWidth: plotControlsMaxWidth,
                                    position: 'relative',
                                    zIndex: isMobile ? 10 : 1400,
                                    marginBottom: '0.2rem',
                                    overflow: 'visible',
                                    minHeight: `calc(0.8cm + ${plotControlsTopOffset})`
                                }}
                            >
                                <span style={plotShowLabelStyle}>
                                    {plotShowLabelElement?.name || 'Show:'}
                                </span>
                                <button
                                    type="button"
                                    onClick={cyclePlotEligibilityMode}
                                    style={plotBestButtonStyle}
                                >
                                    {nextPlotEligibilityLabel}
                                </button>
                                <button
                                    type="button"
                                    onClick={cyclePlotSeriesMode}
                                    style={plotRankOnlyButtonStyle}
                                >
                                    {nextPlotSeriesLabel}
                                </button>
                                {canTogglePlotExpand && (
                                    <button
                                        type="button"
                                        onClick={togglePlotExpanded}
                                        style={plotExpandButtonStyle}
                                    >
                                        {isPlotExpanded ? 'Reduce' : (plotExpandButtonElement?.name || 'Expand')}
                                    </button>
                                )}
                            </div>
                            <div
                                className="athlete-runs-table-wrapper athlete-runs-table-wrapper--plot"
                                style={{
                                    position: 'absolute',
                                    top: plotPanelTopOffset,
                                    left: 0,
                                    marginTop: 0,
                                    background: 'transparent',
                                    boxShadow: 'none',
                                    border: 'none',
                                    padding: 0,
                                    display: 'block',
                                    width: plotPanelMaxWidth,
                                    maxWidth: plotPanelMaxWidth,
                                    overflow: 'hidden',
                                    height: plotPanelHeight,
                                    maxHeight: plotPanelHeight,
                                    transform: 'none'
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
                                            fontSize: '1.05rem',
                                            fontWeight: 700,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '0.35rem'
                                        }}
                                    >
                                        <span>Time by Date</span>
                                        <button
                                            type="button"
                                            className="top-bar-help-btn"
                                            aria-label="Time by Date help"
                                            title="Time by Date help"
                                            onClick={(event) => {
                                                const rect = (event.currentTarget as HTMLButtonElement).getBoundingClientRect();
                                                requestUnifiedHelp('section-time-by-date', {
                                                    x: rect.left,
                                                    y: rect.bottom
                                                });
                                            }}
                                        >
                                            📖
                                        </button>
                                    </div>
                                    <div style={{ padding: '0.6rem 0.8rem 0.9rem 0.8rem' }}>
                                        <div
                                            style={{
                                                color: '#6b7280',
                                                fontSize: '0.75rem',
                                                fontWeight: 400,
                                                lineHeight: 1.2,
                                                textAlign: 'left',
                                                marginBottom: `calc(0.35rem - ${plotCaptionGapReduction})`
                                            }}
                                        >
                                            Click on point in graph to see event
                                        </div>
                                        {plotPointsFilteredByEligibility.length === 0 ? (
                                            <div style={{ color: '#6b7280', fontSize: '0.9rem' }}>No plot data available.</div>
                                        ) : (
                                            <>
                                            <div style={{ width: '100%', height: `calc(${plotChartHeight} + ${plotCaptionGapReduction})`, minHeight: isMobile ? '3.0cm' : '3.6cm', overflow: 'hidden' }}>
                                                <ReactECharts
                                                    ref={plotChartRef}
                                                    option={plotOption ?? {}}
                                                    notMerge
                                                    lazyUpdate
                                                    style={{ width: '100%', minWidth: plotChartMinWidth, height: '100%', marginTop: `-${plotCaptionGapReduction}` }}
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
                                                        overflowX: 'hidden'
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
                                                        overflowX: 'hidden'
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
                                    marginTop: nonPlotPanelTopOffset,
                                    background: 'transparent',
                                    boxShadow: 'none',
                                    border: 'none',
                                    padding: 0,
                                    width: profileWrapperSizeStyle.width,
                                    maxWidth: profileWrapperSizeStyle.maxWidth,
                                    height: profileWrapperSizeStyle.height ? `calc(${profileWrapperSizeStyle.height} - ${nonPlotPanelTopOffset})` : profileWrapperSizeStyle.height,
                                    maxHeight: profileWrapperSizeStyle.maxHeight ? `calc(${profileWrapperSizeStyle.maxHeight} - ${nonPlotPanelTopOffset})` : profileWrapperSizeStyle.maxHeight,
                                    overflow: 'hidden'
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
                                            fontSize: '1.05rem',
                                            fontWeight: 700,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '0.35rem'
                                        }}
                                    >
                                        <span>{displayName}</span>
                                        <button
                                            type="button"
                                            className="top-bar-help-btn"
                                            aria-label="Participant Profile help"
                                            title="Participant Profile help"
                                            onClick={(event) => {
                                                const rect = (event.currentTarget as HTMLButtonElement).getBoundingClientRect();
                                                requestUnifiedHelp('section-participant-profile', {
                                                    x: rect.left,
                                                    y: rect.bottom
                                                });
                                            }}
                                        >
                                            📖
                                        </button>
                                    </div>
                                    <div style={{ padding: '0.2rem 1rem 1rem 1rem' }}>
                                        {profileLoading ? (
                                            <div style={{ color: '#6b7280', fontSize: '0.9rem' }}>Loading profile summary…</div>
                                        ) : profileError ? (
                                            <div style={{ color: '#b91c1c', fontSize: '0.9rem' }}>{profileError}</div>
                                        ) : profileRows.length === 0 ? (
                                            <div style={{ color: '#6b7280', fontSize: '0.9rem' }}>No profile summary returned.</div>
                                        ) : (
                                            <div style={{ overflow: 'hidden' }}>
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
                                                                const rankDisplay = Number.isFinite(parsedRank) ? String(Math.round(parsedRank)) : '--';

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
                                                {eventsAllPieSegments.length > 0 && (
                                                    <div
                                                        style={{
                                                            marginLeft: eventsAllPiePlacement?.x ?? '0.3cm',
                                                            marginTop: eventsAllPiePlacement?.y ?? '0.55cm',
                                                            width: eventsAllPiePlacement?.width ?? '10.5cm',
                                                            maxWidth: '100%',
                                                            minHeight: eventsAllPiePlacement?.height ?? '4.2cm',
                                                            display: 'flex',
                                                            flexDirection: 'column',
                                                            alignItems: 'flex-start',
                                                            gap: '0.35rem'
                                                        }}
                                                    >
                                                        <div
                                                            style={{
                                                                fontSize: isMobile ? '0.82rem' : '0.88rem',
                                                                fontWeight: 700,
                                                                color: '#111827'
                                                            }}
                                                        >
                                                            Events All
                                                        </div>
                                                        <div
                                                            style={{
                                                                display: 'flex',
                                                                flexDirection: 'row',
                                                                alignItems: 'center',
                                                                justifyContent: 'flex-start',
                                                                gap: isMobile ? '0.45rem' : '0.75rem',
                                                                width: '100%'
                                                            }}
                                                        >
                                                            <div
                                                                style={{
                                                                    width: eventsAllPieDiameter,
                                                                    height: eventsAllPieDiameter,
                                                                    minWidth: eventsAllPieDiameter,
                                                                    minHeight: eventsAllPieDiameter,
                                                                    flexShrink: 0
                                                                }}
                                                            >
                                                                <ReactECharts
                                                                    option={eventsAllPieOption}
                                                                    notMerge
                                                                    lazyUpdate
                                                                    style={{ width: '100%', height: '100%' }}
                                                                />
                                                            </div>
                                                            <div
                                                                style={{
                                                                    display: 'flex',
                                                                    flexDirection: 'column',
                                                                    alignItems: 'flex-start',
                                                                    justifyContent: 'center',
                                                                    gap: '0.22rem',
                                                                    minWidth: 0,
                                                                    flex: 1
                                                                }}
                                                            >
                                                                {eventsAllPieSegments.map((segment, index) => (
                                                                    <div
                                                                        key={`${segment.name}-${index}`}
                                                                        style={{
                                                                            display: 'flex',
                                                                            alignItems: 'center',
                                                                            gap: '0.35rem',
                                                                            fontSize: isMobile ? '0.72rem' : '0.76rem',
                                                                            color: '#374151',
                                                                            minWidth: 0,
                                                                            width: '100%'
                                                                        }}
                                                                        title={`${segment.name}: ${segment.value}`}
                                                                    >
                                                                        <span
                                                                            style={{
                                                                                width: '0.6rem',
                                                                                height: '0.6rem',
                                                                                borderRadius: '999px',
                                                                                background: eventsAllPiePalette[index % eventsAllPiePalette.length],
                                                                                flexShrink: 0,
                                                                                border: '1px solid rgba(15, 23, 42, 0.15)'
                                                                            }}
                                                                        />
                                                                        <span
                                                                            style={{
                                                                                whiteSpace: 'nowrap',
                                                                                overflow: 'hidden',
                                                                                textOverflow: 'ellipsis',
                                                                                flex: 1,
                                                                                minWidth: 0
                                                                            }}
                                                                        >
                                                                            {segment.name}
                                                                        </span>
                                                                        <span style={{ fontWeight: 700, flexShrink: 0 }}>{segment.value}</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div
                                className="athlete-runs-table-wrapper"
                                ref={runsTableWrapperRef}
                                style={{
                                    marginTop: nonPlotPanelTopOffset,
                                    ['--athletes-table-mobile-height' as any]: isMobile && tableWrapperSizeStyle.height
                                        ? `calc(${tableWrapperSizeStyle.height} - ${nonPlotPanelTopOffset})`
                                        : undefined,
                                    width: 'max-content',
                                    maxWidth: isMobile ? '100%' : tableWrapperSizeStyle.maxWidth,
                                    height: tableWrapperSizeStyle.height ? `calc(${tableWrapperSizeStyle.height} - ${nonPlotPanelTopOffset})` : tableWrapperSizeStyle.height,
                                    maxHeight: tableWrapperSizeStyle.maxHeight ? `calc(${tableWrapperSizeStyle.maxHeight} - ${nonPlotPanelTopOffset})` : tableWrapperSizeStyle.maxHeight
                                }}
                            >
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

                                                if (eventRankColumnKeys.includes(col.key)) {
                                                    headerClasses.push('event-rank-header');
                                                }
                                                
                                                const sortIndicator = isSorted ? (sortDir === 'asc' ? '▲' : '▼') : '';
                                                const style: React.CSSProperties = { textAlign: col.align ?? 'left' };
                                                const targetWidth = isMobile
                                                    ? (col.mobileWidth ?? col.desktopWidth)
                                                    : (col.desktopWidth ?? col.mobileWidth);
                                                if (targetWidth) {
                                                    style.width = targetWidth;
                                                    style.minWidth = targetWidth;
                                                    style.maxWidth = targetWidth;
                                                }
                                                return (
                                                    <th
                                                        key={col.key}
                                                        className={headerClasses.join(' ')}
                                                        onClick={(event) => {
                                                            const now = Date.now();
                                                            if (now - lastSortTouchAtRef.current < 500) {
                                                                return;
                                                            }
                                                            onHeaderActivate(event.currentTarget, col.key, col.label, col.helpTarget);
                                                        }}
                                                        onTouchEnd={(event) => {
                                                            event.preventDefault();
                                                            lastSortTouchAtRef.current = Date.now();
                                                            delayedHeaderHelp.clear();
                                                            onHeaderActivate(event.currentTarget, col.key, col.label, col.helpTarget);
                                                        }}
                                                        onMouseEnter={(event) => {
                                                            if (col.helpTipEnabled === false) {
                                                                return;
                                                            }
                                                            delayedHeaderHelp.schedule({
                                                                event,
                                                                label: col.label,
                                                                markerId: col.helpTarget,
                                                                delayMs: col.helpTipDelayMs
                                                            });
                                                        }}
                                                        onMouseLeave={delayedHeaderHelp.clear}
                                                        onMouseDown={delayedHeaderHelp.clear}
                                                        onTouchStart={delayedHeaderHelp.clear}
                                                        onKeyDown={(event) => {
                                                            if (event.key === 'Enter' || event.key === ' ') {
                                                                event.preventDefault();
                                                                onHeaderActivate(event.currentTarget, col.key, col.label, col.helpTarget);
                                                            }
                                                        }}
                                                        tabIndex={0}
                                                        scope="col"
                                                        aria-sort={isSorted ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                                                        style={style}
                                                    >
                                                        {isSorted ? (
                                                            <span
                                                                style={{
                                                                    display: 'inline-flex',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'space-between',
                                                                    width: '100%',
                                                                    gap: '0.2rem'
                                                                }}
                                                            >
                                                                <span
                                                                    style={{
                                                                        minWidth: 0,
                                                                        overflow: 'hidden',
                                                                        textOverflow: 'ellipsis',
                                                                        whiteSpace: 'nowrap'
                                                                    }}
                                                                >
                                                                    {col.label}
                                                                </span>
                                                                <span
                                                                    className="athlete-sort-indicator"
                                                                    aria-hidden="true"
                                                                    style={{ minWidth: '0.75em', textAlign: 'center' }}
                                                                >
                                                                    {sortIndicator}
                                                                </span>
                                                            </span>
                                                        ) : (
                                                            <span
                                                                style={{
                                                                    display: 'inline-block',
                                                                    width: '100%',
                                                                    overflow: 'hidden',
                                                                    textOverflow: 'ellipsis',
                                                                    whiteSpace: 'nowrap'
                                                                }}
                                                            >
                                                                {col.label}
                                                            </span>
                                                        )}
                                                    </th>
                                                );
                                            })}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {rowsToRender.map((row, index) => {
                                            const rowKey = makeTableRowKey(row, index);
                                            const rowEventDate = pickField(row, ['formatted_date', 'event_date', 'date']);
                                            const rowDisplayDate = formatDateValue(rowEventDate);
                                            const isProfileJumpTarget = Boolean(profileJumpDate) && rowDisplayDate === profileJumpDate;
                                            const isReturnScrollTarget = Boolean(returnScrollHighlightDate) && rowDisplayDate === returnScrollHighlightDate;
                                            const sourceHighlightActive = isHighlightedRow(row) && !profileJumpDate;

                                            return (
                                                <tr
                                                    ref={(element) => {
                                                        tableRowRefs.current[rowKey] = element;
                                                    }}
                                                    data-run-date={rowDisplayDate}
                                                    key={rowKey}
                                                    className={[sourceHighlightActive ? 'highlighted-source-row' : '', isProfileJumpTarget ? 'profile-jump-row' : '', isReturnScrollTarget ? 'return-scroll-row' : ''].filter(Boolean).join(' ')}
                                                    style={{
                                                        ...(sourceHighlightActive ? { fontWeight: 'bold' } : {}),
                                                        ...(isProfileJumpTarget
                                                            ? {
                                                                outline: '2px solid #f59e0b',
                                                                outlineOffset: '-2px',
                                                                backgroundColor: '#fff7d6'
                                                            }
                                                            : {}),
                                                        ...(isReturnScrollTarget
                                                            ? {
                                                                outline: '2px solid #3b82f6',
                                                                outlineOffset: '-2px',
                                                                backgroundColor: '#dbeafe'
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
                                                        if (targetWidth) {
                                                            alignmentStyle.width = targetWidth;
                                                            alignmentStyle.minWidth = targetWidth;
                                                            alignmentStyle.maxWidth = targetWidth;
                                                        }
                                                        if (sourceHighlightActive) {
                                                            alignmentStyle.backgroundColor = '#e6f3ff';
                                                        } else if (isProfileJumpTarget) {
                                                            alignmentStyle.backgroundColor = '#fff7d6';
                                                        } else if (isReturnScrollTarget) {
                                                            alignmentStyle.backgroundColor = '#dbeafe';
                                                        } else if (eventRankColumnKeys.includes(col.key)) {
                                                            alignmentStyle.backgroundColor = getLargestEventRankCellBackground(row, col.key);
                                                        }
                                                        if (col.key === 'date') {
                                                            const value = getCellDisplayValue(row, col.key);
                                                            const rawDate = pickField(row, ['formatted_date', 'event_date', 'date']);
                                                            const canOpenEvent = rawDate !== undefined && rawDate !== null && String(rawDate).trim() !== '';
                                                            return (
                                                                <th
                                                                    key={col.key}
                                                                    scope="row"
                                                                    className="athlete-date-cell"
                                                                    style={alignmentStyle}
                                                                >
                                                                    {canOpenEvent ? (
                                                                        <button
                                                                            type="button"
                                                                            className="athletes-event-link"
                                                                            onPointerDown={(event) => {
                                                                                event.stopPropagation();
                                                                            }}
                                                                            onClick={(event) => {
                                                                                event.stopPropagation();
                                                                                handleRowClick(row);
                                                                            }}
                                                                            title="Open this event date"
                                                                            aria-label={`Open event for ${String(value)}`}
                                                                        >
                                                                            {value}
                                                                        </button>
                                                                    ) : (
                                                                        value
                                                                    )}
                                                                </th>
                                                            );
                                                        }

                                                        if (col.key === 'event_display') {
                                                            const value = getCellDisplayValue(row, col.key);
                                                            const eventText = String(value ?? '').trim();
                                                            const canOpenCourse = eventText.length > 0 && eventText !== '--';
                                                            return (
                                                                <td key={col.key} style={alignmentStyle}>
                                                                    {canOpenCourse ? (
                                                                        <button
                                                                            type="button"
                                                                            className="athletes-event-link"
                                                                            onPointerDown={(event) => {
                                                                                event.stopPropagation();
                                                                            }}
                                                                            onClick={(event) => {
                                                                                event.stopPropagation();
                                                                                handleCourseNavigate(row);
                                                                            }}
                                                                            title={`Open course: ${eventText}`}
                                                                            aria-label={`Open course ${eventText}`}
                                                                        >
                                                                            {eventText}
                                                                        </button>
                                                                    ) : (
                                                                        eventText
                                                                    )}
                                                                </td>
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
                                                            const currentRankInt = hasCurrent ? Math.round(currentRank) : null;
                                                            const historicRankInt = hasHistoric ? Math.round(historicRank) : null;
                                                            const delta = currentRankInt !== null && historicRankInt !== null ? currentRankInt - historicRankInt : null;
                                                            const deltaText = delta === null ? '' : `${delta >= 0 ? '+' : ''}${delta}`;

                                                            return (
                                                                <td key={col.key} style={{ ...alignmentStyle, textAlign: 'center' }}>
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

                                                        if (col.key === 'club') {
                                                            const clubValue = String(getCellDisplayValue(row, col.key) ?? '').trim();
                                                            const canOpenClub = clubValue.length > 0 && clubValue !== '--' && clubValue.toLowerCase() !== '<no club>';
                                                            return (
                                                                <td key={col.key} style={alignmentStyle}>
                                                                    {canOpenClub ? (
                                                                        <button
                                                                            type="button"
                                                                            className="athletes-club-link"
                                                                            onPointerDown={(event) => {
                                                                                event.stopPropagation();
                                                                            }}
                                                                            onClick={(event) => {
                                                                                event.stopPropagation();
                                                                                handleClubNavigate(clubValue, row);
                                                                            }}
                                                                            title={`Open club: ${clubValue}`}
                                                                            aria-label={`Open club ${clubValue}`}
                                                                        >
                                                                            {clubValue}
                                                                        </button>
                                                                    ) : (
                                                                        clubValue
                                                                    )}
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