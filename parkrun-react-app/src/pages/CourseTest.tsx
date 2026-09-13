import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import ReactECharts from 'echarts-for-react';
import { fetchAllResults, fetchEventPositionsMonthlyCascade, fetchEventSummary, fetchResults } from '../api/backendAPI';
import EventSearch, { type EventOption } from '../components/EventSearch';
import { navigateBackWithNavStack, navigateWithNavStack } from '../utils/navigationStack';
import { useColumnHeaderMode } from '../utils/useColumnHeaderMode';
import { useGlobalWaitCursor } from '../utils/useGlobalWaitCursor';
import { useDelayedUnifiedHelp } from '../utils/useDelayedUnifiedHelp';
import { requestUnifiedHelp } from './UnifiedHelp';
import {
    getCourseColumnsForView,
    getCourseElementById,
    getCourseElementPlacement,
    getCourseLayoutConfig,
    getCourseTableColumnByKey,
    getCourseViewportForWidth,
    type CourseViewport,
    type CourseViewMode
} from '../config/layout/courseLayoutHelper';
import './ResultsTable.css';
import './Courses.css';

type CourseRecord = { [key: string]: any };

type CoursesLocationState = {
    eventCode?: string;
    eventName?: string;
    from?: string;
    returnTo?: { pathname: string; search?: string };
    highlightAthleteCode?: string;
    highlightClubName?: string;
    sourceEvent?: {
        eventName?: string;
        eventDate?: string;
    };
};

type ColumnDef = {
    key: string;
    label: string;
    align?: 'left' | 'center' | 'right';
    desktopWidth?: number;
    mobileWidth?: number;
    helpTarget?: string;
    helpTipEnabled?: boolean;
    helpTipDelayMs?: number;
};

type SummaryMode = 'average' | 'total' | 'maximum' | 'minimum' | 'range' | 'growth';
type PeriodQuery = 'recent' | 'last50' | 'since-lockdown' | 'all';
type CoursePanelMode = 'table' | 'profile' | 'harness' | 'groups' | 'top250';
type GroupsBarMode = 'type' | 'age' | 'both';

type MonthlyCascadeRow = {
    month_idx?: number;
    month_label?: string;
    events_in_month?: number;
    unknown_avg?: number;
    first_first_timer_avg?: number;
    first_timer_comment_avg?: number;
    super_tourist_avg?: number;
    tourist_avg?: number;
    returner_or_super_returner_avg?: number;
    super_regular_avg?: number;
    last_event_code_count_long_gt10_avg?: number;
    rest_avg?: number;
    younger_men_avg?: number;
    adult_men_avg?: number;
    senior_men_avg?: number;
    veteran_men_avg?: number;
    super_vet_men_avg?: number;
    younger_women_avg?: number;
    adult_women_avg?: number;
    senior_women_avg?: number;
    veteran_women_avg?: number;
    super_vet_women_avg?: number;
    unclassified_avg?: number;
};

const COURSES_VIEW_MODE_KEY = 'courses_test_view_mode_v1';
const COURSES_PERIOD_QUERY_KEY = 'courses_test_period_query_v1';

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

const normalizeControlToken = (value: string): string =>
    String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '');

const normalizeCourseViewMode = (value: string): 'basic' | 'detailed' => {
    const token = normalizeControlToken(value);
    if (token === 'detailed') return 'detailed';
    return 'basic';
};

const normalizePeriodQuery = (value: string): PeriodQuery => {
    const token = normalizeControlToken(value);
    if (token === 'last50' || token === 'last50events') return 'last50';
    if (token === 'sincelockdown') return 'since-lockdown';
    if (token === 'all' || token === 'allevents') return 'all';
    return 'recent';
};

const normalizeSummaryMode = (value: string): SummaryMode => {
    const token = normalizeControlToken(value);
    if (token === 'total') return 'total';
    if (token === 'maximum' || token === 'max') return 'maximum';
    if (token === 'minimum' || token === 'min') return 'minimum';
    if (token === 'range') return 'range';
    if (token === 'growth') return 'growth';
    return 'average';
};

const normalizeGroupsBarMode = (value: string): GroupsBarMode => {
    const token = normalizeControlToken(value);
    if (token === 'type') return 'type';
    if (token === 'age' || token === 'agegroup') return 'age';
    return 'both';
};

const widthToPx = (value?: string): number | undefined => {
    if (!value) return undefined;
    const match = String(value).trim().match(/^(\d+(?:\.\d+)?)px$/i);
    if (!match) return undefined;
    const parsed = Number(match[1]);
    return Number.isFinite(parsed) ? parsed : undefined;
};

const toCoursesLocationState = (value: unknown): CoursesLocationState => {
    if (!value || typeof value !== 'object') {
        return {};
    }
    const possible: any = value;
    const next: CoursesLocationState = {};
    if (typeof possible.eventCode === 'string') next.eventCode = possible.eventCode;
    if (typeof possible.eventName === 'string') next.eventName = possible.eventName;
    if (typeof possible.from === 'string') next.from = possible.from;
    if (typeof possible.highlightAthleteCode === 'string') next.highlightAthleteCode = possible.highlightAthleteCode;
    if (typeof possible.highlightClubName === 'string') next.highlightClubName = possible.highlightClubName;
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

const top250Columns: ColumnDef[] = getCourseColumnsForView('top250').map((column) => ({
    key: column.key,
    label: column.headerName || column.key,
    align: column.style?.textAlign,
    helpTarget: (column as any)?.helpTarget,
    helpTipEnabled: typeof (column as any)?.helpTip === 'object'
        ? (column as any).helpTip.enabled !== false
        : (column as any)?.helpTip !== false,
    helpTipDelayMs: typeof (column as any)?.helpTip === 'object' && Number((column as any).helpTip.delayMs) > 0
        ? Number((column as any).helpTip.delayMs)
        : undefined,
    desktopWidth: widthToPx(column.laptop?.width),
    mobileWidth: widthToPx(column.mobile?.width)
}));

const top250SortableKeys = new Set<string>(top250Columns.map((col) => col.key));
const courseSortableKeys = new Set<string>(['date', ...basicColumns.map((col) => col.key), ...detailedOnlyColumns.map((col) => col.key)]);

const buildConfiguredColumnDef = (column: ColumnDef): ColumnDef => {
    const configColumn = getCourseTableColumnByKey(column.key);
    return {
        ...column,
        label: configColumn?.headerName || column.label,
        align: configColumn?.style?.textAlign || column.align,
        desktopWidth: widthToPx(configColumn?.laptop?.width) ?? column.desktopWidth,
        mobileWidth: widthToPx(configColumn?.mobile?.width) ?? column.mobileWidth
    };
};

const CourseTest: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { isHelpMode } = useColumnHeaderMode();
    const isMobile = useMediaQuery('(max-width: 640px)');
    const locationState = toCoursesLocationState(location.state ?? {});
    const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
    const layoutConfig = getCourseLayoutConfig();
    const tableHeaderTextAlign = layoutConfig.tableModel?.header?.textAlign ?? 'left';
    const tableHeaderHelpEnabled = (layoutConfig as any)?.tableHelpTip?.enabled !== false;
    const tableHeaderHelpDelayMs = Number((layoutConfig as any)?.tableHelpTip?.delayMs) > 0
        ? Number((layoutConfig as any).tableHelpTip.delayMs)
        : 2000;
    const delayedHeaderHelp = useDelayedUnifiedHelp(tableHeaderHelpEnabled, tableHeaderHelpDelayMs);
    const tableModel = layoutConfig.tableModel;
    const tableWidthMode = (layoutConfig as any)?.tableWidthMode;

    const viewLabelElement = getCourseElementById('course.viewLabel');
    const viewSelectElement = getCourseElementById('course.viewSelect');
    const periodLabelElement = getCourseElementById('course.periodLabel');
    const periodSelectElement = getCourseElementById('course.periodSelect');
    const backButtonElement = getCourseElementById('course.backButton');
    const panelToggleElement = getCourseElementById('course.panelToggle');
    const resetButtonElement = getCourseElementById('course.resetButton');
    const expandButtonElement = getCourseElementById('course.expandButton');
    const groupsLegendDividerElement = getCourseElementById('course.groupsLegendDivider');
    const courseLabelElement = getCourseElementById('course.courseLabel');
    const searchInputElement = getCourseElementById('course.searchInput');
    const eventCodeElement = getCourseElementById('course.eventCode');
    const totalEventsElement = getCourseElementById('course.totalEvents');
    const statusMessageElement = getCourseElementById('course.statusMessage');
    const tableTitleElement = getCourseElementById('course.tableTitle');
    const top250TitleElement = getCourseElementById('course.top250Title');
    const summaryModeSelectElement = getCourseElementById('course.summaryModeSelect');
    const groupsPanelElement = getCourseElementById('course.groupsPanel');
    const tableContainerElement = getCourseElementById('course.tableContainer');
    const summaryRowElement = getCourseElementById('course.summaryRow');
    const [viewport, setViewport] = useState<CourseViewport>(() => getCourseViewportForWidth(window.innerWidth));

    useEffect(() => {
        const onResize = () => setViewport(getCourseViewportForWidth(window.innerWidth));
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    const pViewLabel = getCourseElementPlacement('course.viewLabel', viewport);
    const pViewSelect = getCourseElementPlacement('course.viewSelect', viewport);
    const pPeriodLabel = getCourseElementPlacement('course.periodLabel', viewport);
    const pPeriodSelect = getCourseElementPlacement('course.periodSelect', viewport);
    const pBackButton = getCourseElementPlacement('course.backButton', viewport);
    const pPanelToggle = getCourseElementPlacement('course.panelToggle', viewport);
    const pResetButton = getCourseElementPlacement('course.resetButton', viewport);
    const pExpandButton = getCourseElementPlacement('course.expandButton', viewport);
    const pGroupsLegendDivider = getCourseElementPlacement('course.groupsLegendDivider', viewport);
    const pCourseLabel = getCourseElementPlacement('course.courseLabel', viewport);
    const pSearchInput = getCourseElementPlacement('course.searchInput', viewport);
    const pEventCode = getCourseElementPlacement('course.eventCode', viewport);
    const pTotalEvents = getCourseElementPlacement('course.totalEvents', viewport);
    const pStatusMessage = getCourseElementPlacement('course.statusMessage', viewport);
    const pTableTitle = getCourseElementPlacement('course.tableTitle', viewport);
    const pTop250Title = getCourseElementPlacement('course.top250Title', viewport);
    const pSummaryModeSelect = getCourseElementPlacement('course.summaryModeSelect', viewport);
    const pGroupsPanel = getCourseElementPlacement('course.groupsPanel', viewport);
    const pTableContainer = getCourseElementPlacement('course.tableContainer', viewport);
    const pSummaryRow = getCourseElementPlacement('course.summaryRow', viewport);

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
    const loggedInDefaultCourseCode = typeof loggedInUser.defaultCourseCode === 'string' && loggedInUser.defaultCourseCode.trim()
        ? loggedInUser.defaultCourseCode.trim()
        : '';
    const loggedInDefaultCourseName = typeof loggedInUser.defaultCourseName === 'string' && loggedInUser.defaultCourseName.trim()
        ? loggedInUser.defaultCourseName.trim()
        : '';

    const incomingEventCode = locationState.eventCode || searchParams.get('event_code') || '';
    const initialEventCode = incomingEventCode || loggedInDefaultCourseCode || '';
    const initialEventName = locationState.eventName
        || searchParams.get('event_name')
        || (!incomingEventCode ? loggedInDefaultCourseName : '')
        || '';
    const initialPanelModeParam = searchParams.get('panel');
    const initialViewModeParam = searchParams.get('view');
    const initialPeriodQueryParam = searchParams.get('period');
    const initialPanelMode: CoursePanelMode = initialPanelModeParam === 'top250'
        ? 'top250'
        : initialPanelModeParam === 'profile'
            ? 'profile'
            : initialPanelModeParam === 'harness' || initialPanelModeParam === 'plot_harness'
                ? 'harness'
            : initialPanelModeParam === 'groups' || initialPanelModeParam === 'plot_groups'
                ? 'groups'
            : 'table';
    const initialSortKeyParam = String(searchParams.get('sort') || '').trim();
    const initialSortDirParam = String(searchParams.get('dir') || '').trim().toLowerCase();
    const initialSortKey = courseSortableKeys.has(initialSortKeyParam) ? initialSortKeyParam : 'date';
    const initialSortDir: 'asc' | 'desc' = initialSortDirParam === 'asc' ? 'asc' : 'desc';
    const initialTop250SortKeyParam = searchParams.get('top250_sort') || 'total_count';
    const initialTop250SortKey = top250SortableKeys.has(initialTop250SortKeyParam) ? initialTop250SortKeyParam : 'total_count';
    const initialTop250SortDirParam = searchParams.get('top250_dir');
    const initialTop250SortDir: 'asc' | 'desc' = initialTop250SortDirParam === 'asc' ? 'asc' : 'desc';
    const initialGroupsModeParam = searchParams.get('groups_mode') || '';
    const initialGroupsBarMode = normalizeGroupsBarMode(initialGroupsModeParam);
    const highlightedTop250AthleteCode = searchParams.get('highlight_athlete') || locationState.highlightAthleteCode || '';
    const highlightedTop250ClubName = searchParams.get('highlight_club') || locationState.highlightClubName || '';
    const highlightedTop250ClubToken = String(highlightedTop250ClubName || '').trim().toLowerCase();

    const [allRows, setAllRows] = useState<CourseRecord[]>([]);
    const [periodRows, setPeriodRows] = useState<CourseRecord[]>([]);
    const [rows, setRows] = useState<CourseRecord[]>([]);
    const [activeEventCode, setActiveEventCode] = useState<string>(initialEventCode);
    const [activeEventName, setActiveEventName] = useState<string>(initialEventName);
    const [viewMode, setViewMode] = useState<'basic' | 'detailed'>(() => {
        if (initialViewModeParam === 'basic' || initialViewModeParam === 'detailed') {
            return initialViewModeParam;
        }
        try {
            const stored = sessionStorage.getItem(COURSES_VIEW_MODE_KEY);
            if (stored === 'detailed' || stored === 'basic') {
                return stored;
            }
        } catch (_err) {
            // ignore storage read failures
        }
        const configured = String(viewSelectElement?.name || '').trim();
        return normalizeCourseViewMode(configured);
    });
    const [periodQuery, setPeriodQuery] = useState<PeriodQuery>(() => {
        if (initialPeriodQueryParam === 'recent' || initialPeriodQueryParam === 'last50' || initialPeriodQueryParam === 'since-lockdown' || initialPeriodQueryParam === 'all') {
            return initialPeriodQueryParam;
        }
        try {
            const stored = sessionStorage.getItem(COURSES_PERIOD_QUERY_KEY);
            if (stored === 'recent' || stored === 'last50' || stored === 'since-lockdown' || stored === 'all') {
                return stored;
            }
        } catch (_err) {
            // ignore storage read failures
        }
        const configured = String(periodSelectElement?.name || '').trim();
        return normalizePeriodQuery(configured);
    });
    const [panelMode, setPanelMode] = useState<CoursePanelMode>(initialPanelMode);
    const [sortKey, setSortKey] = useState<string>(initialSortKey);
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>(initialSortDir);
    const [top250SortKey, setTop250SortKey] = useState<string>(initialTop250SortKey);
    const [top250SortDir, setTop250SortDir] = useState<'asc' | 'desc'>(initialTop250SortDir);
    const [summaryMode, setSummaryMode] = useState<SummaryMode>(() => {
        const configured = String(summaryModeSelectElement?.name || '').trim();
        return normalizeSummaryMode(configured);
    });
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [top250Rows, setTop250Rows] = useState<CourseRecord[]>([]);
    const [top250Loading, setTop250Loading] = useState<boolean>(false);
    const [top250Error, setTop250Error] = useState<string | null>(null);
    const [monthlyCascadeRows, setMonthlyCascadeRows] = useState<MonthlyCascadeRow[]>([]);
    const [monthlyCascadeLoading, setMonthlyCascadeLoading] = useState<boolean>(false);
    const [monthlyCascadeError, setMonthlyCascadeError] = useState<string | null>(null);
    useGlobalWaitCursor(loading || top250Loading || monthlyCascadeLoading);
    const [groupsBarMode, setGroupsBarMode] = useState<GroupsBarMode>(initialGroupsBarMode);
    const [isIndexMode, setIsIndexMode] = useState<boolean>(false);
    const [isPlotExpanded, setIsPlotExpanded] = useState<boolean>(false);
    const [profileXZoom, setProfileXZoom] = useState<{ start: number; end: number }>({ start: 0, end: 100 });
    const [profileYZoom, setProfileYZoom] = useState<{ start: number; end: number }>({ start: 0, end: 100 });
    const [profileCumulative, setProfileCumulative] = useState<boolean>(false);
    const [profileLogScale, setProfileLogScale] = useState<boolean>(false);

    const normalizeSeriesData = (dataArrays: (number[] | undefined)[]): number[][] => {
        if (!isIndexMode || !dataArrays[0]) return dataArrays.map(d => d || []);
        
        // Get the length from the first non-undefined array
        const length = (dataArrays[0] || []).length;
        if (length === 0) return dataArrays.map(d => d || []);

        // Normalize each stack independently
        // Stack 1 (Type group): indices 0-7
        // Stack 2 (Age group): indices 8-18
        const normalized: number[][] = dataArrays.map(arr => new Array(length).fill(0));
        
        // Normalize Type group stack (indices 0-7)
        for (let monthIdx = 0; monthIdx < length; monthIdx++) {
            let typeGroupTotal = 0;
            for (let i = 0; i < 8; i++) {
                const value = dataArrays[i]?.[monthIdx] ?? 0;
                if (typeof value === 'number' && isFinite(value)) {
                    typeGroupTotal += value;
                }
            }
            
            if (typeGroupTotal > 0) {
                for (let i = 0; i < 8; i++) {
                    const value = dataArrays[i]?.[monthIdx] ?? 0;
                    if (typeof value === 'number' && isFinite(value)) {
                        normalized[i][monthIdx] = (value / typeGroupTotal) * 100;
                    }
                }
            }
        }
        
        // Normalize Age group stack (indices 8-18)
        for (let monthIdx = 0; monthIdx < length; monthIdx++) {
            let ageGroupTotal = 0;
            for (let i = 8; i < 19; i++) {
                const value = dataArrays[i]?.[monthIdx] ?? 0;
                if (typeof value === 'number' && isFinite(value)) {
                    ageGroupTotal += value;
                }
            }
            
            if (ageGroupTotal > 0) {
                for (let i = 8; i < 19; i++) {
                    const value = dataArrays[i]?.[monthIdx] ?? 0;
                    if (typeof value === 'number' && isFinite(value)) {
                        normalized[i][monthIdx] = (value / ageGroupTotal) * 100;
                    }
                }
            }
        }
        
        return normalized;
    };

    // Force viewMode to 'detailed' when in top250 mode (top250 doesn't support basic)
    useEffect(() => {
        if (panelMode === 'top250' && viewMode !== 'detailed') {
            setViewMode('detailed');
        }
    }, [panelMode, viewMode]);

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
                console.error('CourseTest: Failed to load results:', err);
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
        const result = Array.from(byCode.values()).sort((a, b) => a.eventName.localeCompare(b.eventName));
        return result;
    }, [allRows]);

    useEffect(() => {
        if (initialEventCode !== activeEventCode) {
            setActiveEventCode(initialEventCode);
        }
        if (initialEventName !== activeEventName) {
            setActiveEventName(initialEventName);
        }
    }, [initialEventCode, initialEventName, activeEventCode, activeEventName]);

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
        if (activeEventCode || eventOptions.length === 0) {
            return;
        }
        const firstEvent = eventOptions[0];
        setActiveEventCode(firstEvent.eventCode);
        setActiveEventName(firstEvent.eventName);
    }, [activeEventCode, eventOptions]);

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
        const nextParams = new URLSearchParams(location.search || '');
        if (activeEventCode) {
            nextParams.set('event_code', activeEventCode);
        }
        if (activeEventName) {
            nextParams.set('event_name', activeEventName);
        }
        nextParams.set('panel', panelMode);
        nextParams.set('view', viewMode);
        nextParams.set('period', periodQuery);
        nextParams.set('sort', sortKey);
        nextParams.set('dir', sortDir);

        if (panelMode === 'top250') {
            nextParams.set('top250_sort', top250SortKey);
            nextParams.set('top250_dir', top250SortDir);
        } else {
            nextParams.delete('top250_sort');
            nextParams.delete('top250_dir');
            nextParams.delete('highlight_athlete');
            nextParams.delete('highlight_club');
        }

        if (panelMode === 'groups') {
            nextParams.set('groups_mode', groupsBarMode);
        } else {
            nextParams.delete('groups_mode');
        }

        const nextSearch = `?${nextParams.toString()}`;
        if (nextSearch === (location.search || '')) {
            return;
        }

        navigate({ pathname: location.pathname, search: nextSearch }, { replace: true, state: location.state });
    }, [
        activeEventCode,
        activeEventName,
        location.pathname,
        location.search,
        location.state,
        navigate,
        groupsBarMode,
        panelMode,
        periodQuery,
        top250SortDir,
        top250SortKey,
        viewMode
    ]);

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
        if (panelMode !== 'groups') {
            return;
        }

        const parsedEventCode = Number(activeEventCode);
        if (!Number.isInteger(parsedEventCode) || parsedEventCode < 1) {
            setMonthlyCascadeRows([]);
            setMonthlyCascadeError('Please select a valid event to load group trends.');
            setMonthlyCascadeLoading(false);
            return;
        }

        let cancelled = false;
        const loadGroups = async () => {
            try {
                setMonthlyCascadeLoading(true);
                setMonthlyCascadeError(null);
                const data = await fetchEventPositionsMonthlyCascade(parsedEventCode);
                if (!cancelled) {
                    setMonthlyCascadeRows(Array.isArray(data) ? data : []);
                }
            } catch (err: any) {
                if (!cancelled) {
                    setMonthlyCascadeError(err?.message || 'Unable to load monthly cascade groups.');
                    setMonthlyCascadeRows([]);
                }
            } finally {
                if (!cancelled) {
                    setMonthlyCascadeLoading(false);
                }
            }
        };

        loadGroups();
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

    const tableColumns = useMemo(() => {
        const configuredColumns = getCourseColumnsForView(viewMode);
        if (configuredColumns.length > 0) {
            return configuredColumns.map((column) => ({
                key: column.key,
                label: column.headerName || column.key,
                align: column.style?.textAlign || 'left',
                desktopWidth: widthToPx(column.laptop?.width),
                mobileWidth: widthToPx(column.mobile?.width),
                helpTarget: (column as any)?.helpTarget,
                helpTipEnabled: typeof (column as any)?.helpTip === 'object'
                    ? (column as any).helpTip.enabled !== false
                    : (column as any)?.helpTip !== false,
                helpTipDelayMs: typeof (column as any)?.helpTip === 'object' && Number((column as any).helpTip.delayMs) > 0
                    ? Number((column as any).helpTip.delayMs)
                    : undefined
            })) as ColumnDef[];
        }
        return viewMode === 'basic' ? basicColumns : [...basicColumns, ...detailedOnlyColumns];
    }, [viewMode]);

    const onHeaderActivate = (eventTarget: EventTarget | null, key: string, label: string, helpTarget?: string, onSort?: (columnKey: string) => void) => {
        if (!isHelpMode) {
            if (onSort) {
                onSort(key);
            }
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

    // Top250 table column order now comes from course.layout.json tableViews.top250
    const visibleTop250Columns = useMemo(() => {
        return top250Columns;
    }, []);

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

    const sortingEnabled = tableModel?.sort?.enabled !== false;

    const handleSort = (columnKey: string) => {
        if (!sortingEnabled) return;
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

    const displayName = selectedEventOption?.eventName || activeEventName || '';
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
        if (sourceEvent.eventDate) {
            return Boolean(rowDate) && formatDateValue(rowDate) === formatDateValue(sourceEvent.eventDate);
        }
        return Boolean(rowEventName) && String(rowEventName).toLowerCase().includes(String(sourceEvent.eventName || '').toLowerCase());
    };

    const handleSelectEvent = (eventCode: string, eventName: string) => {
        setActiveEventCode(eventCode);
        setActiveEventName(eventName);
        // Keep the current panel mode — don't reset to table when changing course
        const params = new URLSearchParams();
        params.set('event_code', eventCode);
        params.set('event_name', eventName);
        params.set('panel', panelMode);
        navigate(`/courses_test?${params.toString()}`, {
            replace: true,
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
        if (navigateBackWithNavStack(navigate, location.pathname)) {
            return;
        }
        navigate('/results_test');
    };

    const handleResetHighlights = () => {
        const params = new URLSearchParams(location.search || '');
        params.delete('source_event');
        params.delete('source_date');
        params.delete('highlight_athlete');
        params.delete('highlight_club');

        const nextSearchRaw = params.toString();
        const nextSearch = nextSearchRaw ? `?${nextSearchRaw}` : '';

        const nextState = { ...(location.state as Record<string, unknown> | null ?? {}) };
        delete (nextState as any).sourceEvent;
        delete (nextState as any).highlightAthleteCode;
        delete (nextState as any).highlightClubName;

        navigate(
            { pathname: location.pathname, search: nextSearch },
            { replace: true, state: nextState }
        );
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

        const returnParams = new URLSearchParams(location.search || '');
        returnParams.set('source_event', displayName);
        returnParams.set('source_date', String(eventDate));
        const returnSearch = `?${returnParams.toString()}`;
        const returnState = {
            ...(location.state as Record<string, unknown> | null ?? {}),
            sourceEvent: {
                eventName: displayName,
                eventDate: String(eventDate)
            }
        };

        navigateWithNavStack(navigate, {
            pathname: location.pathname,
            search: returnSearch,
            state: returnState
        }, `/races?${params.toString()}`, {
            state: {
                from: 'courses',
                returnTo: {
                    pathname: '/courses_test',
                    search: returnSearch
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

        navigateWithNavStack(navigate, {
            pathname: location.pathname,
            search: returnSearch,
            state: {
                ...(location.state as Record<string, unknown> | null ?? {}),
                highlightAthleteCode: String(athleteCode)
            }
        }, `/athletes?${params.toString()}`, {
            state: {
                athleteCode: String(athleteCode),
                athleteName: athleteName ? String(athleteName) : undefined,
                from: 'courses',
                returnTo: {
                    pathname: '/courses_test',
                    search: returnSearch
                }
            }
        });
    };

    const handleClubNavigate = (clubRaw: unknown, athleteCodeRaw?: unknown) => {
        const club = String(clubRaw ?? '').trim();
        if (!club || club === '--' || club.toLowerCase() === '<no club>') {
            return;
        }

        const params = new URLSearchParams();
        params.set('club', club);

        const returnParams = new URLSearchParams(location.search || '');
        if (panelMode === 'top250') {
            returnParams.set('panel', 'top250');
            returnParams.set('top250_sort', top250SortKey);
            returnParams.set('top250_dir', top250SortDir);
            const athleteCode = String(athleteCodeRaw ?? '').trim();
            if (athleteCode) {
                returnParams.set('highlight_athlete', athleteCode);
            }
            returnParams.set('highlight_club', club);
        }

        const returnSearch = `?${returnParams.toString()}`;

        navigateWithNavStack(navigate, {
            pathname: location.pathname,
            search: returnSearch,
            state: {
                ...(location.state as Record<string, unknown> | null ?? {}),
                highlightAthleteCode: String(athleteCodeRaw ?? '').trim() || undefined,
                highlightClubName: club
            }
        }, `/clubs?${params.toString()}`, {
            state: {
                from: 'courses',
                returnTo: {
                    pathname: location.pathname,
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
            : panelMode === 'profile'
                ? 'harness'
                : panelMode === 'harness'
                    ? 'groups'
                : 'table';

    const panelToggleLabel = nextPanelMode === 'top250'
        ? 'Top250'
        : nextPanelMode === 'profile'
            ? 'Plot Parts'
            : nextPanelMode === 'harness'
                ? 'Plot Hardness'
            : nextPanelMode === 'groups'
                ? 'Plot Groups'
            : 'Table';

    const chronologicallySortedRows = useMemo(() => {
        return [...rows].sort((left, right) => {
            const leftDate = parseDateSortValue(pickField(left, ['event_date', 'formatted_date', 'date'])) ?? Number.NEGATIVE_INFINITY;
            const rightDate = parseDateSortValue(pickField(right, ['event_date', 'formatted_date', 'date'])) ?? Number.NEGATIVE_INFINITY;
            return leftDate - rightDate;
        });
    }, [rows]);

    const calculateColumnsTotalWidth = (cols: ColumnDef[], viewport: CourseViewport): number => {
        return cols.reduce((total, col) => {
            const targetWidth = viewport === 'mobile'
                ? (col.mobileWidth ?? col.desktopWidth)
                : (col.desktopWidth ?? col.mobileWidth);
            return total + (targetWidth ?? 0);
        }, 0);
    };

    const getColumnWidthStyle = (col: ColumnDef): React.CSSProperties => {
        const style: React.CSSProperties = {};
        const configColumn = getCourseTableColumnByKey(col.key);
        const configWidth = isMobile
            ? (configColumn?.mobile?.width ?? configColumn?.laptop?.width)
            : (configColumn?.laptop?.width ?? configColumn?.mobile?.width);
        if (configWidth) {
            style.width = configWidth;
            style.minWidth = configWidth;
            style.maxWidth = configWidth;
            return style;
        }
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

    // ── Profile chart: 6 monthly participant series ─────────────────────────────
    const profileChartData = useMemo(() => {
        const MN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const parseRowDate = (row: CourseRecord): Date | null => {
            const raw = String(pickField(row, ['event_date', 'formatted_date', 'date']) ?? '').trim();
            // DD/MM/YYYY
            const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(raw);
            if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
            // YYYY-MM-DD
            if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
                const d = new Date(raw);
                return isNaN(d.getTime()) ? null : d;
            }
            return null;
        };
        const getParticipants = (row: CourseRecord): number | null => {
            const raw = pickField(row, ['last_position', 'lastPosition']);
            const n = Number(raw);
            return Number.isFinite(n) && n > 0 ? n : null;
        };

        const nowMs = Date.now();
        const oneYearAgoMs = nowMs - 365 * 24 * 60 * 60 * 1000;

        // Bucket: course → month (0-11) → number[]
        type MonthBuckets = number[][];
        const makeBuckets = (): MonthBuckets => Array.from({ length: 12 }, () => []);

        const courseCode = String(activeEventCode || '');
        const courseBucketsAll: MonthBuckets = makeBuckets();
        const courseBuckets1Y: MonthBuckets = makeBuckets();

        // Per-course aggregation for cross-course series
        // course → month → averages list (one per course per month)
        const crossAll: number[][] = Array.from({ length: 12 }, () => []);
        const cross1Y: number[][] = Array.from({ length: 12 }, () => []);
        // course → month → values
        const byCourseAll = new Map<string, MonthBuckets>();
        const byCourse1Y = new Map<string, MonthBuckets>();

        allRows.forEach((row) => {
            const code = String(pickField(row, ['event_code', 'eventCode']) ?? '');
            if (!code) return;
            const d = parseRowDate(row);
            if (!d) return;
            const mo = d.getMonth();
            const p = getParticipants(row);
            if (p === null) return;
            const ts = d.getTime();

            // per-selected-course
            if (code === courseCode) {
                courseBucketsAll[mo].push(p);
                if (ts >= oneYearAgoMs) courseBuckets1Y[mo].push(p);
            }

            // cross-course buckets
            if (!byCourseAll.has(code)) byCourseAll.set(code, makeBuckets());
            if (!byCourse1Y.has(code)) byCourse1Y.set(code, makeBuckets());
            byCourseAll.get(code)![mo].push(p);
            if (ts >= oneYearAgoMs) byCourse1Y.get(code)![mo].push(p);
        });

        const avg = (arr: number[]): number | null => {
            const good = arr.filter(v => v > 0);
            if (!good.length) return null;
            return good.reduce((a, b) => a + b, 0) / good.length;
        };

        // Build per-month avg per course, then derive cross-course series
        for (let mo = 0; mo < 12; mo++) {
            byCourseAll.forEach((buckets) => {
                const a = avg(buckets[mo]);
                if (a !== null) crossAll[mo].push(a);
            });
            byCourse1Y.forEach((buckets) => {
                const a = avg(buckets[mo]);
                if (a !== null) cross1Y[mo].push(a);
            });
        }

        const series1 = MN.map((_, mo) => avg(courseBucketsAll[mo]));
        const series2 = MN.map((_, mo) => avg(courseBuckets1Y[mo]));
        const series3 = MN.map((_, mo) => crossAll[mo].length ? crossAll[mo].reduce((a, b) => a + b, 0) / crossAll[mo].length : null);
        const series4 = MN.map((_, mo) => cross1Y[mo].length ? cross1Y[mo].reduce((a, b) => a + b, 0) / cross1Y[mo].length : null);
        const series5 = MN.map((_, mo) => crossAll[mo].length ? Math.max(...crossAll[mo]) : null);
        const series6 = MN.map((_, mo) => crossAll[mo].length ? Math.min(...crossAll[mo]) : null);

        const cumulate = (arr: (number | null)[]): (number | null)[] => {
            let acc = 0;
            return arr.map(v => { if (v === null) return null; acc += v; return acc; });
        };

        const withCumulative = (arr: (number | null)[]) => profileCumulative ? cumulate(arr) : arr;

        return {
            months: MN,
            series: [
                { name: `${displayName || 'Course'} – All Time`, data: withCumulative(series1), color: '#374151' },
                { name: `${displayName || 'Course'} – Last 1Y`, data: withCumulative(series2), color: '#60a5fa' },
                { name: 'All Courses – All Time (avg)', data: withCumulative(series3), color: '#dc2626', lineWidth: 2.5 },
                { name: 'All Courses – Last 1Y (avg)', data: withCumulative(series4), color: '#f97316' },
                { name: 'All Courses – Month (avg) Max', data: withCumulative(series5), color: '#9467bd', lineType: 'dashed' },
                { name: 'All Courses – Month (avg) Min', data: withCumulative(series6), color: '#8c564b', lineType: 'dashed' },
            ]
        };
    }, [allRows, activeEventCode, displayName, profileCumulative]);

    const profileHardnessChartData = useMemo(() => {
        const MN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const parseRowDate = (row: CourseRecord): Date | null => {
            const raw = String(pickField(row, ['event_date', 'formatted_date', 'date']) ?? '').trim();
            const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(raw);
            if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
            if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
                const d = new Date(raw);
                return isNaN(d.getTime()) ? null : d;
            }
            return null;
        };

        const nowMs = Date.now();
        const oneYearAgoMs = nowMs - 365 * 24 * 60 * 60 * 1000;

        const makeBuckets = (): number[][] => Array.from({ length: 12 }, () => []);
        const courseCode = String(activeEventCode || '');

        const seasonalAll = makeBuckets();
        const seasonal1Y = makeBuckets();
        const eventAll = makeBuckets();
        const event1Y = makeBuckets();

        allRows.forEach((row) => {
            const code = String(pickField(row, ['event_code', 'eventCode']) ?? '');
            if (!code || code !== courseCode) return;

            const d = parseRowDate(row);
            if (!d) return;
            const mo = d.getMonth();
            const ts = d.getTime();

            const seasonalCoeff = normalizeCoefficient(pickField(row, ['coeff']));
            const eventCoeff = normalizeCoefficient(pickField(row, ['coeff_event', 'coeffEvent', 'coefEvent', 'coeffevent']));
            const seasonalDeviation = seasonalCoeff === null ? null : seasonalCoeff - 1;
            const eventDeviation = eventCoeff === null ? null : eventCoeff - 1;

            if (seasonalDeviation !== null) {
                seasonalAll[mo].push(seasonalDeviation);
                if (ts >= oneYearAgoMs) seasonal1Y[mo].push(seasonalDeviation);
            }
            if (eventDeviation !== null) {
                eventAll[mo].push(eventDeviation);
                if (ts >= oneYearAgoMs) event1Y[mo].push(eventDeviation);
            }
        });

        const avg = (arr: number[]): number | null => {
            if (!arr.length) return null;
            return arr.reduce((a, b) => a + b, 0) / arr.length;
        };

        return {
            months: MN,
            allTimeSeasonal: MN.map((_, mo) => avg(seasonalAll[mo])),
            allTimeEvent: MN.map((_, mo) => avg(eventAll[mo])),
            last1YSeasonal: MN.map((_, mo) => avg(seasonal1Y[mo])),
            last1YEvent: MN.map((_, mo) => avg(event1Y[mo]))
        };
    }, [allRows, activeEventCode]);

    const profileGroupsChartData = useMemo(() => {
        const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const byMonth = new Map<number, MonthlyCascadeRow>();

        monthlyCascadeRows.forEach((row) => {
            const monthIdx = Number(row.month_idx);
            if (Number.isFinite(monthIdx) && monthIdx >= 1 && monthIdx <= 12) {
                byMonth.set(monthIdx, row);
            }
        });

        const toNum = (value: unknown): number => {
            const parsed = Number(value);
            return Number.isFinite(parsed) ? parsed : 0;
        };

        return {
            months: monthLabels,
            eventsInMonth: monthLabels.map((_, index) => toNum(byMonth.get(index + 1)?.events_in_month)),
            unknown: monthLabels.map((_, index) => toNum(byMonth.get(index + 1)?.unknown_avg)),
            firstFirstTimer: monthLabels.map((_, index) => toNum(byMonth.get(index + 1)?.first_first_timer_avg)),
            firstTimerComment: monthLabels.map((_, index) => toNum(byMonth.get(index + 1)?.first_timer_comment_avg)),
            tourist: monthLabels.map((_, index) => {
                const month = byMonth.get(index + 1);
                return toNum(month?.super_tourist_avg) + toNum(month?.tourist_avg);
            }),
            returnerOrSuperReturner: monthLabels.map((_, index) => toNum(byMonth.get(index + 1)?.returner_or_super_returner_avg)),
            superRegular: monthLabels.map((_, index) => toNum(byMonth.get(index + 1)?.super_regular_avg)),
            lastCodeGt10: monthLabels.map((_, index) => toNum(byMonth.get(index + 1)?.last_event_code_count_long_gt10_avg)),
            rest: monthLabels.map((_, index) => toNum(byMonth.get(index + 1)?.rest_avg)),
            youngerMen: monthLabels.map((_, index) => toNum(byMonth.get(index + 1)?.younger_men_avg)),
            adultMen: monthLabels.map((_, index) => toNum(byMonth.get(index + 1)?.adult_men_avg)),
            seniorMen: monthLabels.map((_, index) => toNum(byMonth.get(index + 1)?.senior_men_avg)),
            veteranMen: monthLabels.map((_, index) => toNum(byMonth.get(index + 1)?.veteran_men_avg)),
            superVetMen: monthLabels.map((_, index) => toNum(byMonth.get(index + 1)?.super_vet_men_avg)),
            youngerWomen: monthLabels.map((_, index) => toNum(byMonth.get(index + 1)?.younger_women_avg)),
            adultWomen: monthLabels.map((_, index) => toNum(byMonth.get(index + 1)?.adult_women_avg)),
            seniorWomen: monthLabels.map((_, index) => toNum(byMonth.get(index + 1)?.senior_women_avg)),
            veteranWomen: monthLabels.map((_, index) => toNum(byMonth.get(index + 1)?.veteran_women_avg)),
            superVetWomen: monthLabels.map((_, index) => toNum(byMonth.get(index + 1)?.super_vet_women_avg)),
            unclassified: monthLabels.map((_, index) => toNum(byMonth.get(index + 1)?.unclassified_avg))
        };
    }, [monthlyCascadeRows]);

    // Normalize data to percentages if in index mode
    const displayGroupsChartData = useMemo(() => {
        if (!isIndexMode) {
            return profileGroupsChartData;
        }

        const allDataArrays = [
            profileGroupsChartData.unknown,
            profileGroupsChartData.firstFirstTimer,
            profileGroupsChartData.firstTimerComment,
            profileGroupsChartData.tourist,
            profileGroupsChartData.returnerOrSuperReturner,
            profileGroupsChartData.superRegular,
            profileGroupsChartData.lastCodeGt10,
            profileGroupsChartData.rest,
            profileGroupsChartData.youngerMen,
            profileGroupsChartData.adultMen,
            profileGroupsChartData.seniorMen,
            profileGroupsChartData.veteranMen,
            profileGroupsChartData.superVetMen,
            profileGroupsChartData.youngerWomen,
            profileGroupsChartData.adultWomen,
            profileGroupsChartData.seniorWomen,
            profileGroupsChartData.veteranWomen,
            profileGroupsChartData.superVetWomen,
            profileGroupsChartData.unclassified
        ];

        const [normalized_unknown, normalized_firstFirstTimer, normalized_firstTimerComment, normalized_tourist, 
               normalized_returnerOrSuperReturner, normalized_superRegular, normalized_lastCodeGt10, normalized_rest,
               normalized_youngerMen, normalized_adultMen, normalized_seniorMen, normalized_veteranMen, normalized_superVetMen,
               normalized_youngerWomen, normalized_adultWomen, normalized_seniorWomen, normalized_veteranWomen, normalized_superVetWomen,
               normalized_unclassified] = normalizeSeriesData(allDataArrays);

        return {
            ...profileGroupsChartData,
            unknown: normalized_unknown,
            firstFirstTimer: normalized_firstFirstTimer,
            firstTimerComment: normalized_firstTimerComment,
            tourist: normalized_tourist,
            returnerOrSuperReturner: normalized_returnerOrSuperReturner,
            superRegular: normalized_superRegular,
            lastCodeGt10: normalized_lastCodeGt10,
            rest: normalized_rest,
            youngerMen: normalized_youngerMen,
            adultMen: normalized_adultMen,
            seniorMen: normalized_seniorMen,
            veteranMen: normalized_veteranMen,
            superVetMen: normalized_superVetMen,
            youngerWomen: normalized_youngerWomen,
            adultWomen: normalized_adultWomen,
            seniorWomen: normalized_seniorWomen,
            veteranWomen: normalized_veteranWomen,
            superVetWomen: normalized_superVetWomen,
            unclassified: normalized_unclassified
        };
    }, [profileGroupsChartData, isIndexMode]);

    const activeTableContainerSpec = useMemo(() => {
        const baseSpec = tableContainerElement?.[viewport];
        const expandedSpec = viewport === 'mobile' ? tableContainerElement?.mobileExpanded : tableContainerElement?.laptopExpanded;
        if (isPlotExpanded && expandedSpec) {
            return { ...baseSpec, ...expandedSpec };
        }
        return baseSpec;
    }, [isPlotExpanded, tableContainerElement, viewport]);

    const activeGroupsPanelSpec = useMemo(() => {
        const baseSpec = groupsPanelElement?.[viewport];
        const expandedSpec = viewport === 'mobile' ? groupsPanelElement?.mobileExpanded : groupsPanelElement?.laptopExpanded;
        if (isPlotExpanded && expandedSpec) {
            return { ...baseSpec, ...expandedSpec };
        }
        return baseSpec;
    }, [groupsPanelElement, isPlotExpanded, viewport]);

    const tablePanelTop = String(activeTableContainerSpec?.y ?? pTableContainer?.y ?? tableContainerElement?.[viewport]?.y ?? '3cm');
    const tablePanelLeft = String(activeTableContainerSpec?.x ?? pTableContainer?.x ?? tableContainerElement?.[viewport]?.x ?? '0cm');
    const configuredTableContainerWidth = activeTableContainerSpec?.width ?? pTableContainer?.width;
    
    // Calculate table width: use tableWidthMode for table mode, detailed width for top250
    const getTablePanelWidth = () => {
        if (panelMode === 'table') {
            // Allow course.tableContainer width to override tableWidthMode when explicitly configured.
            return String(configuredTableContainerWidth ?? tableWidthMode?.[viewport]?.[viewMode] ?? (isMobile ? '11cm' : '14.6cm'));
        }
        if (panelMode === 'top250') {
            // Top250 table: always uses detailed width from tableWidthMode (no basic option)
            return String(tableWidthMode?.[viewport]?.['detailed'] ?? (isMobile ? '15.5cm' : '33.6cm'));
        }
        // For plot modes: use tableContainer x/y/height positioning (width from plots themselves)
        return String(configuredTableContainerWidth ?? (isMobile ? '11cm' : '20cm'));
    };
    const tablePanelWidth = getTablePanelWidth();
    
    const tablePanelMinHeight = String(activeTableContainerSpec?.height ?? pTableContainer?.height ?? tableContainerElement?.[viewport]?.height ?? (isMobile ? '9cm' : '11cm'));

    const groupsBaseHeight = String(activeGroupsPanelSpec?.height ?? activeTableContainerSpec?.height ?? (isMobile ? '8.8cm' : '10.8cm'));
    const groupsMessageVisible = panelMode === 'groups' && monthlyCascadeLoading;
    const groupsPlotHeight = isMobile ? `calc(${groupsBaseHeight} + 1cm)` : `calc(${groupsBaseHeight} + 1cm)`;
    const groupsWindowHeight = isMobile ? `calc(${groupsBaseHeight} + 4cm)` : `calc(${groupsBaseHeight} + 1cm)`;
    const groupsWindowFixedHeight = isMobile ? groupsWindowHeight : undefined;
    const groupsPanelTop = String(activeGroupsPanelSpec?.y ?? pGroupsPanel?.y ?? (isMobile ? '12cm' : '2cm'));
    const groupsPanelLeft = String(activeGroupsPanelSpec?.x ?? pGroupsPanel?.x ?? '0cm');
    const groupsPanelWidth = String(activeGroupsPanelSpec?.width ?? pGroupsPanel?.width ?? (isMobile ? '11cm' : '21.2cm'));
    const groupsWindowWidth = 'calc(100% - 0.6cm)';
    const groupsPlotWidth = '100%';
    const showTypeGroupBars = groupsBarMode === 'type' || groupsBarMode === 'both';
    const showAgeGroupBars = groupsBarMode === 'age' || groupsBarMode === 'both';
    const groupsToggleLabel = groupsBarMode === 'type'
        ? 'Age Group'
        : groupsBarMode === 'age'
            ? 'Both Group'
            : 'Type Group';
    const cycleGroupsBarMode = () => {
        setGroupsBarMode((prev) => (prev === 'type' ? 'age' : prev === 'age' ? 'both' : 'type'));
    };

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
        if (panelMode !== 'top250' || top250Loading || sortedTop250Rows.length === 0) {
            return;
        }

        const scrollTimeout = window.setTimeout(() => {
            let highlightedRow: HTMLTableRowElement | undefined;

            if (highlightedTop250AthleteCode) {
                const athleteCandidates = Array.from(document.querySelectorAll<HTMLTableRowElement>('tr[data-top250-athlete-code]'));
                highlightedRow = athleteCandidates.find(
                    (row) => row.getAttribute('data-top250-athlete-code') === highlightedTop250AthleteCode
                );
            }

            if (!highlightedRow && highlightedTop250ClubToken) {
                const clubCandidates = Array.from(document.querySelectorAll<HTMLTableRowElement>('tr[data-top250-club-token]'));
                highlightedRow = clubCandidates.find(
                    (row) => row.getAttribute('data-top250-club-token') === highlightedTop250ClubToken
                );
            }

            if (highlightedRow) {
                highlightedRow.scrollIntoView({
                    behavior: 'smooth',
                    block: 'center'
                });
            }
        }, 100);

        return () => window.clearTimeout(scrollTimeout);
    }, [panelMode, highlightedTop250AthleteCode, highlightedTop250ClubToken, top250Loading, sortedTop250Rows]);

    const viewControlOptions = useMemo(() => {
        const options = (viewSelectElement?.options || []).map((option) => String(option).trim()).filter(Boolean);
        if (options.length === 0) return ['Basic', 'Detailed'];
        return options;
    }, [viewSelectElement?.options]);

    // Filter view options based on panel mode: top250 only shows Detailed
    const visibleViewControlOptions = useMemo(() => {
        if (panelMode === 'top250') {
            return viewControlOptions.filter((opt) => normalizeCourseViewMode(opt) === 'detailed');
        }
        return viewControlOptions;
    }, [panelMode, viewControlOptions]);

    const periodControlOptions = useMemo(() => {
        const options = (periodSelectElement?.options || []).map((option) => String(option).trim()).filter(Boolean);
        if (options.length === 0) {
            return periodOptions.map((option) => option.label);
        }
        return options;
    }, [periodSelectElement?.options]);

    const summaryControlOptions = useMemo(() => {
        const options = (summaryModeSelectElement?.options || []).map((option) => String(option).trim()).filter(Boolean);
        if (options.length === 0) {
            return summaryModeOptions.map((option) => option.label);
        }
        return options;
    }, [summaryModeSelectElement?.options]);

    const viewModeSelectedLabel = useMemo(() => {
        return viewControlOptions.find((option) => normalizeCourseViewMode(option) === viewMode) || viewControlOptions[0] || 'Basic';
    }, [viewControlOptions, viewMode]);

    const periodSelectedLabel = useMemo(() => {
        return periodControlOptions.find((option) => normalizePeriodQuery(option) === periodQuery) || periodControlOptions[0] || 'Recent Events';
    }, [periodControlOptions, periodQuery]);

    const summarySelectedLabel = useMemo(() => {
        return summaryControlOptions.find((option) => normalizeSummaryMode(option) === summaryMode) || summaryControlOptions[0] || 'Average';
    }, [summaryControlOptions, summaryMode]);

    const ctrlBtnStyle: React.CSSProperties = {
        fontSize: '0.7rem',
        fontWeight: 700,
        border: '1px solid #9ca3af',
        borderRadius: '4px',
        background: '#fff',
        cursor: 'pointer',
        padding: '2px 6px',
        minWidth: '1.4rem',
        lineHeight: 1.4,
        color: '#374151'
    };

    return (
        <div className="page-content courses-page" style={{ position: 'relative' }}>
            <div
                className="course-header"
                style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    width: '100%',
                    minHeight: '2.6cm',
                    marginLeft: 0,
                    marginRight: 0,
                    marginBottom: 0,
                    pointerEvents: 'none'
                }}
            >
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
                        fontSize: backButtonElement?.style?.fontSize ?? (isMobile ? '1.35rem' : '1.2rem'),
                        border: '1px solid #222',
                        borderRadius: '8px',
                        background: '#fff',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxSizing: 'border-box',
                        width: pBackButton?.width ?? backButtonElement?.style?.width ?? '30px',
                        height: pBackButton?.height ?? backButtonElement?.style?.height ?? '30px',
                        minWidth: pBackButton?.width ?? backButtonElement?.style?.width ?? '30px',
                        minHeight: pBackButton?.height ?? backButtonElement?.style?.height ?? '30px',
                        position: 'absolute',
                        left: pBackButton?.x ?? backButtonElement?.[viewport]?.x ?? '0.3cm',
                        top: pBackButton?.y ?? backButtonElement?.[viewport]?.y ?? '0cm',
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

                {showHeader && panelToggleElement && (
                    <button
                        id="courses-view-toggle-btn"
                        type="button"
                        onClick={() => setPanelMode(nextPanelMode)}
                        title={`Show ${panelToggleLabel.toLowerCase()}`}
                        aria-label={`Show ${panelToggleLabel.toLowerCase()}`}
                        style={{
                            width: pPanelToggle?.width ?? panelToggleElement?.style?.width ?? '1cm',
                            height: pPanelToggle?.height ?? panelToggleElement?.style?.height ?? '1cm',
                            border: '1px solid #777',
                            borderRadius: '6px',
                            background: '#fff',
                            cursor: 'pointer',
                            fontSize: panelToggleElement?.style?.fontSize ?? '0.5rem',
                            fontWeight: panelToggleElement?.style?.fontWeight ?? 700,
                            lineHeight: Number(panelToggleElement?.style?.lineHeight ?? 1),
                            padding: 0,
                            position: 'absolute',
                            left: pPanelToggle?.x ?? panelToggleElement?.[viewport]?.x ?? '0.3cm',
                            top: pPanelToggle?.y ?? panelToggleElement?.[viewport]?.y ?? '1.1cm',
                            zIndex: 1200,
                            pointerEvents: 'auto'
                        }}
                    >
                        {panelToggleLabel}
                    </button>
                )}

                {showHeader && resetButtonElement && (
                    <button
                        id="courses-reset-highlight-btn"
                        type="button"
                        onClick={handleResetHighlights}
                        title="Reset row highlights"
                        aria-label="Reset row highlights"
                        style={{
                            width: pResetButton?.width ?? resetButtonElement?.style?.width ?? '1cm',
                            height: pResetButton?.height ?? resetButtonElement?.style?.height ?? '1cm',
                            border: '1px solid #777',
                            borderRadius: '6px',
                            background: '#fff',
                            cursor: 'pointer',
                            fontSize: resetButtonElement?.style?.fontSize ?? '0.5rem',
                            fontWeight: resetButtonElement?.style?.fontWeight ?? 700,
                            lineHeight: Number(resetButtonElement?.style?.lineHeight ?? 1),
                            padding: 0,
                            position: 'absolute',
                            left: pResetButton?.x ?? resetButtonElement?.[viewport]?.x ?? '1.45cm',
                            top: pResetButton?.y ?? resetButtonElement?.[viewport]?.y ?? '1.1cm',
                            zIndex: 1200,
                            pointerEvents: 'auto'
                        }}
                    >
                        {resetButtonElement?.name || 'Reset'}
                    </button>
                )}

                {showHeader && expandButtonElement && (panelMode === 'profile' || panelMode === 'harness' || panelMode === 'groups') && (
                    <button
                        id="courses-expand-plot-btn"
                        type="button"
                        onClick={() => setIsPlotExpanded((prev) => !prev)}
                        title={isPlotExpanded ? 'Reduce plot panel' : 'Expand plot panel'}
                        aria-label={isPlotExpanded ? 'Reduce plot panel' : 'Expand plot panel'}
                        style={{
                            width: pExpandButton?.width ?? expandButtonElement?.style?.width ?? '1.1cm',
                            height: pExpandButton?.height ?? expandButtonElement?.style?.height ?? '1cm',
                            border: '1px solid #777',
                            borderRadius: '6px',
                            background: '#fff',
                            cursor: 'pointer',
                            fontSize: expandButtonElement?.style?.fontSize ?? '0.5rem',
                            fontWeight: expandButtonElement?.style?.fontWeight ?? 700,
                            lineHeight: Number(expandButtonElement?.style?.lineHeight ?? 1),
                            padding: 0,
                            position: 'absolute',
                            left: pExpandButton?.x ?? expandButtonElement?.[viewport]?.x ?? '2.6cm',
                            top: pExpandButton?.y ?? expandButtonElement?.[viewport]?.y ?? '1.1cm',
                            zIndex: 1200,
                            pointerEvents: 'auto'
                        }}
                    >
                        {isPlotExpanded ? 'Reduce' : (expandButtonElement?.name || 'Expand')}
                    </button>
                )}

                {searchInputElement && (
                    <>
                        {courseLabelElement ? (
                            <div
                                style={{
                                    position: 'absolute',
                                    left: pCourseLabel?.x ?? courseLabelElement?.[viewport]?.x ?? '1.6cm',
                                    top: pCourseLabel?.y ?? courseLabelElement?.[viewport]?.y ?? '0cm',
                                    pointerEvents: 'auto'
                                }}
                            >
                                {courseLabelElement?.helpLabel ? (
                                    <span className="help-tooltip" style={{ display: 'inline-flex' }}>
                                        <button
                                            type="button"
                                            className="help-trigger help-trigger-label"
                                            onClick={(event) => {
                                                const rect = (event.currentTarget as HTMLButtonElement).getBoundingClientRect();
                                                requestUnifiedHelp(courseLabelElement?.helpTarget || 'control-course', {
                                                    x: rect.left,
                                                    y: rect.bottom
                                                });
                                            }}
                                            title={`${String(courseLabelElement?.name || 'Course').replace(/:\s*$/, '')} help`}
                                            aria-label={`${String(courseLabelElement?.name || 'Course').replace(/:\s*$/, '')} help`}
                                        >
                                            <span
                                                className="help-trigger-text"
                                                style={{
                                                    lineHeight: courseLabelElement?.style?.lineHeight ?? 1.1,
                                                    fontWeight: courseLabelElement?.style?.fontWeight ?? 700,
                                                    fontSize: courseLabelElement?.style?.fontSize,
                                                    color: courseLabelElement?.style?.color ?? '#111827'
                                                }}
                                            >
                                                {courseLabelElement?.name || 'Course:'}
                                            </span>
                                        </button>
                                    </span>
                                ) : (
                                    <label
                                        htmlFor="courses-search-input"
                                        style={{
                                            lineHeight: courseLabelElement?.style?.lineHeight ?? 1.1,
                                            fontWeight: courseLabelElement?.style?.fontWeight ?? 700,
                                            fontSize: courseLabelElement?.style?.fontSize,
                                            color: courseLabelElement?.style?.color ?? '#111827'
                                        }}
                                    >
                                        {courseLabelElement?.name || 'Course:'}
                                    </label>
                                )}
                            </div>
                        ) : null}
                        <div
                            className="course-header-title"
                            title={searchInputElement?.name || 'Course Search'}
                            style={{
                                position: 'absolute',
                                left: pSearchInput?.x ?? searchInputElement?.[viewport]?.x ?? '1.6cm',
                                top: pSearchInput?.y ?? searchInputElement?.[viewport]?.y ?? '0cm',
                                width: pSearchInput?.width ?? searchInputElement?.[viewport]?.width ?? '8.8cm',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5em',
                                overflow: 'visible',
                                pointerEvents: 'auto'
                            }}
                        >
                            <EventSearch
                                inputId="courses-search-input"
                                options={eventOptions}
                                initialQuery={displayName}
                                placeholder="search for course"
                                inputWidth={pSearchInput?.width ?? searchInputElement?.[viewport]?.width ?? '8.8cm'}
                                dropdownWidth={pSearchInput?.width ?? searchInputElement?.[viewport]?.width ?? '8.8cm'}
                                onSelect={handleSelectEvent}
                            />
                        </div>
                    </>
                )}

                {showHeader && eventCodeElement && (
                    <div
                        className="course-header-code"
                        title={eventCodeElement?.name || 'Event Code'}
                        style={{
                            position: 'absolute',
                            left: pEventCode?.x ?? eventCodeElement?.[viewport]?.x ?? '1.6cm',
                            top: pEventCode?.y ?? eventCodeElement?.[viewport]?.y ?? '1.0cm',
                            width: pEventCode?.width ?? eventCodeElement?.[viewport]?.width,
                            color: eventCodeElement?.style?.color ?? '#374151',
                            fontSize: eventCodeElement?.style?.fontSize ?? '0.84rem'
                        }}
                    >
                        {displayCode}
                    </div>
                )}

                {showHeader && totalEventsElement && (
                    <div
                        className="course-header-total-events"
                        title={totalEventsElement?.name || 'Total events recorded'}
                        style={{
                            position: 'absolute',
                            left: pTotalEvents?.x ?? totalEventsElement?.[viewport]?.x ?? '1.6cm',
                            top: pTotalEvents?.y ?? totalEventsElement?.[viewport]?.y ?? '1.45cm',
                            width: pTotalEvents?.width ?? totalEventsElement?.[viewport]?.width,
                            color: totalEventsElement?.style?.color ?? '#374151',
                            fontSize: totalEventsElement?.style?.fontSize ?? '0.84rem'
                        }}
                    >
                        Total events: {rows.length}
                    </div>
                )}

            </div>

            {showHeader ? (
                <div
                    id={layoutConfig.anchor || 'course-header-root'}
                    style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '2.6cm', pointerEvents: 'none', zIndex: 300 }}
                >
                    <div style={{ position: 'absolute', left: pViewLabel?.x, top: pViewLabel?.y, pointerEvents: 'auto' }}>
                        {viewLabelElement?.helpLabel ? (
                            <span className="help-tooltip" style={{ display: 'inline-flex' }}>
                                <button
                                    type="button"
                                    className="help-trigger help-trigger-label"
                                    onClick={(event) => {
                                        const rect = (event.currentTarget as HTMLButtonElement).getBoundingClientRect();
                                        requestUnifiedHelp(viewLabelElement?.helpTarget || 'control-table-view', {
                                            x: rect.left,
                                            y: rect.bottom
                                        });
                                    }}
                                    title={`${String(viewLabelElement?.name || 'Table View').replace(/:\s*$/, '')} help`}
                                    aria-label={`${String(viewLabelElement?.name || 'Table View').replace(/:\s*$/, '')} help`}
                                >
                                    <span
                                        className="help-trigger-text"
                                        style={{
                                            lineHeight: viewLabelElement?.style?.lineHeight ?? 1.1,
                                            fontWeight: viewLabelElement?.style?.fontWeight ?? 700,
                                            fontSize: viewLabelElement?.style?.fontSize,
                                            color: viewLabelElement?.style?.color ?? '#111827'
                                        }}
                                    >
                                        {viewLabelElement?.name || 'Table View:'}
                                    </span>
                                </button>
                            </span>
                        ) : (
                            <label
                                htmlFor="courses-view-select"
                                style={{
                                    lineHeight: viewLabelElement?.style?.lineHeight ?? 1.1,
                                    fontWeight: viewLabelElement?.style?.fontWeight ?? 700,
                                    fontSize: viewLabelElement?.style?.fontSize,
                                    color: viewLabelElement?.style?.color ?? '#111827'
                                }}
                            >
                                {viewLabelElement?.name || 'Table View:'}
                            </label>
                        )}
                    </div>

                    <select
                        id="courses-view-select"
                        value={viewModeSelectedLabel}
                        onChange={(event) => setViewMode(normalizeCourseViewMode(event.target.value))}
                        aria-label="Courses view mode"
                        style={{ position: 'absolute', left: pViewSelect?.x, top: pViewSelect?.y, width: pViewSelect?.width, pointerEvents: 'auto' }}
                    >
                        {visibleViewControlOptions.map((option) => (
                            <option key={option} value={option}>{option}</option>
                        ))}
                    </select>

                    <div
                        style={{
                            position: 'absolute',
                            left: pPeriodLabel?.x,
                            top: pPeriodLabel?.y,
                            pointerEvents: 'auto'
                        }}
                    >
                        {periodLabelElement?.helpLabel ? (
                            <span className="help-tooltip" style={{ display: 'inline-flex' }}>
                                <button
                                    type="button"
                                    className="help-trigger help-trigger-label"
                                    onClick={(event) => {
                                        const rect = (event.currentTarget as HTMLButtonElement).getBoundingClientRect();
                                        requestUnifiedHelp(periodLabelElement?.helpTarget || 'control-period', {
                                            x: rect.left,
                                            y: rect.bottom
                                        });
                                    }}
                                    title={`${String(periodLabelElement?.name || 'Period').replace(/:\s*$/, '')} help`}
                                    aria-label={`${String(periodLabelElement?.name || 'Period').replace(/:\s*$/, '')} help`}
                                >
                                    <span
                                        className="help-trigger-text"
                                        style={{
                                            lineHeight: periodLabelElement?.style?.lineHeight ?? 1.1,
                                            fontWeight: periodLabelElement?.style?.fontWeight ?? 700,
                                            fontSize: periodLabelElement?.style?.fontSize,
                                            color: periodLabelElement?.style?.color ?? '#111827'
                                        }}
                                    >
                                        {periodLabelElement?.name || 'Period:'}
                                    </span>
                                </button>
                            </span>
                        ) : (
                            <label
                                htmlFor="courses-period-select"
                                style={{
                                    lineHeight: periodLabelElement?.style?.lineHeight ?? 1.1,
                                    fontWeight: periodLabelElement?.style?.fontWeight ?? 700,
                                    fontSize: periodLabelElement?.style?.fontSize,
                                    color: periodLabelElement?.style?.color ?? '#111827'
                                }}
                            >
                                {periodLabelElement?.name || 'Period:'}
                            </label>
                        )}
                    </div>

                    <select
                        id="courses-period-select"
                        value={periodSelectedLabel}
                        onChange={(event) => {
                            setPeriodQuery(normalizePeriodQuery(event.target.value));
                        }}
                        aria-label="Courses period"
                        style={{ position: 'absolute', left: pPeriodSelect?.x, top: pPeriodSelect?.y, width: pPeriodSelect?.width, pointerEvents: 'auto' }}
                    >
                        {periodControlOptions.map((option) => (
                            <option key={option} value={option}>{option}</option>
                        ))}
                    </select>

                </div>
            ) : null}

                 {(loading || error || groupsMessageVisible || (panelMode === 'top250' && top250Loading)) && statusMessageElement && (
                     <div
                         style={{
                             position: 'absolute',
                             left: pStatusMessage?.x ?? statusMessageElement?.[viewport]?.x ?? '0.3cm',
                             top: pStatusMessage?.y ?? statusMessageElement?.[viewport]?.y ?? '2.3cm',
                             width: pStatusMessage?.width ?? statusMessageElement?.[viewport]?.width,
                             color: groupsMessageVisible ? '#dc2626' : (statusMessageElement?.style?.color ?? '#6b7280'),
                             fontSize: statusMessageElement?.style?.fontSize ?? '0.75rem',
                             fontStyle: statusMessageElement?.style?.fontStyle ?? 'normal',
                             zIndex: 100,
                             pointerEvents: 'auto'
                         }}
                     >
                         {groupsMessageVisible && <p style={{ margin: 0, fontSize: '0.9rem' }}>This process can take up to 30 seconds— click Table button to move on</p>}
                         {panelMode === 'top250' && top250Loading && <p style={{ margin: 0, fontSize: '0.9rem' }}>Loading Top250 data…</p>}
                         {loading && <p style={{ margin: 0 }}>Loading course data…</p>}
                         {error && <p className="athlete-error" style={{ margin: 0 }}>{error}</p>}
                     </div>
                 )}

            {!loading && !error && showHeader && (
                <section className="course-runs-section">
                    {panelMode === 'table' && tableTitleElement && (
                        <div
                            style={{
                                position: 'absolute',
                                left: pTableTitle?.x ?? tableTitleElement?.[viewport]?.x ?? '0.3cm',
                                top: pTableTitle?.y ?? tableTitleElement?.[viewport]?.y ?? '3.0cm',
                                width: pTableTitle?.width ?? tableTitleElement?.[viewport]?.width,
                                color: tableTitleElement?.style?.color ?? '#111827',
                                fontSize: tableTitleElement?.style?.fontSize ?? '0.95rem',
                                fontWeight: tableTitleElement?.style?.fontWeight ?? 700,
                                lineHeight: Number(tableTitleElement?.style?.lineHeight ?? 1),
                                zIndex: 100,
                                pointerEvents: 'none'
                            }}
                        >
                            {tableTitleElement?.name || 'Course History'}
                        </div>
                    )}
                    {panelMode === 'top250' && top250TitleElement && (
                        <div
                            style={{
                                position: 'absolute',
                                left: pTop250Title?.x ?? top250TitleElement?.[viewport]?.x ?? '0.3cm',
                                top: pTop250Title?.y ?? top250TitleElement?.[viewport]?.y ?? '3.0cm',
                                width: pTop250Title?.width ?? top250TitleElement?.[viewport]?.width,
                                color: top250TitleElement?.style?.color ?? '#111827',
                                fontSize: top250TitleElement?.style?.fontSize ?? '0.95rem',
                                fontWeight: top250TitleElement?.style?.fontWeight ?? 700,
                                lineHeight: Number(top250TitleElement?.style?.lineHeight ?? 1),
                                zIndex: 100,
                                pointerEvents: 'none'
                            }}
                        >
                            {top250TitleElement?.name || 'Top 250 participants'}
                        </div>
                    )}
                    {panelMode === 'profile' ? (
                        <div
                            className="athlete-runs-table-wrapper plot-panel-wrapper"
                            style={{
                                position: isMobile ? 'relative' : 'absolute',
                                background: 'transparent',
                                boxShadow: 'none',
                                border: 'none',
                                padding: 0,
                                left: isMobile ? 'auto' : groupsPanelLeft,
                                top: isMobile ? 'auto' : groupsPanelTop,
                                width: groupsPanelWidth,
                                overflow: 'hidden',
                                marginTop: isMobile ? groupsPanelTop : 0
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
                                    boxShadow: '0 10px 18px rgba(15, 23, 42, 0.08)',
                                    width: groupsWindowWidth,
                                    height: groupsWindowFixedHeight,
                                    minHeight: groupsWindowHeight
                                }}
                            >
                                {/* grey header */}
                                <div style={{ background: '#e5e7eb', borderBottom: '1px solid #d1d5db', padding: '0.45rem 0.8rem', textAlign: 'center', fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}>
                                    <span>Course statistics comparison</span>
                                    <button
                                        type="button"
                                        className="top-bar-help-btn"
                                        aria-label="Course statistics comparison help"
                                        title="Course statistics comparison help"
                                        onClick={(event) => {
                                            const rect = (event.currentTarget as HTMLButtonElement).getBoundingClientRect();
                                            requestUnifiedHelp('plotCourseStatsComp', {
                                                x: rect.left,
                                                y: rect.bottom
                                            });
                                        }}
                                    >
                                        📖
                                    </button>
                                </div>

                                {/* chart */}
                                <div style={{ padding: '0.3rem 0.2rem 0 0.2rem', overflowX: 'hidden' }}>
                                    <ReactECharts
                                        style={{ height: groupsPlotHeight, width: groupsPlotWidth }}
                                        option={{
                                            animation: false,
                                            grid: { top: 30, bottom: 90, left: 55, right: 20, containLabel: false },
                                            legend: {
                                                type: 'plain',
                                                bottom: 0,
                                                textStyle: { fontSize: 10 },
                                                itemGap: 10,
                                                data: profileChartData.series.map(s => s.name)
                                            },
                                            xAxis: {
                                                type: 'category',
                                                data: profileChartData.months,
                                                axisLabel: { fontSize: 11 },
                                                axisLine: { lineStyle: { color: '#c4c7cf' } }
                                            },
                                            yAxis: {
                                                type: profileLogScale ? 'log' : 'value',
                                                logBase: 10,
                                                name: profileCumulative ? 'Cumulative' : 'Participants',
                                                nameTextStyle: { fontSize: 10 },
                                                axisLabel: { fontSize: 10 },
                                                axisLine: { lineStyle: { color: '#c4c7cf' } },
                                                minorTick: { show: profileLogScale, splitNumber: 9 },
                                                minorSplitLine: { show: profileLogScale, lineStyle: { color: '#e5e7eb', type: 'dashed' } },
                                                min: 'dataMin',
                                                dataZoom: [{ type: 'inside', yAxisIndex: 0, start: profileYZoom.start, end: profileYZoom.end }]
                                            },
                                            dataZoom: [
                                                { type: 'inside', xAxisIndex: 0, start: profileXZoom.start, end: profileXZoom.end },
                                                { type: 'inside', yAxisIndex: 0, start: profileYZoom.start, end: profileYZoom.end }
                                            ],
                                            series: profileChartData.series.map(s => ({
                                                name: s.name,
                                                type: 'line',
                                                data: s.data,
                                                connectNulls: true,
                                                lineStyle: { color: s.color, type: s.lineType ?? 'solid', width: s.lineWidth ?? 1.5 },
                                                itemStyle: { color: s.color },
                                                symbol: 'circle',
                                                symbolSize: 4
                                            })),
                                            tooltip: {
                                                trigger: 'axis',
                                                formatter: (params: any) => {
                                                    if (!Array.isArray(params) || !params.length) return '';
                                                    const month = String(params[0]?.axisValue ?? '');
                                                    const lines = params
                                                        .filter((p: any) => p.value !== null && p.value !== undefined)
                                                        .map((p: any) => `${p.seriesName}: ${typeof p.value === 'number' ? Math.round(p.value) : p.value}`);
                                                    return [month, ...lines].join('<br/>');
                                                }
                                            }
                                        }}
                                    />
                                </div>

                                {/* controls */}
                                <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center', padding: '0.4rem 0.6rem', flexWrap: 'wrap', borderTop: '1px solid #e5e7eb' }}>
                                    <span style={{ fontSize: '0.7rem', fontWeight: 600, color: '#374151' }}>Date</span>
                                    <button type="button" style={ctrlBtnStyle} onClick={() => setProfileXZoom(prev => {
                                        const w = Math.max(12, (prev.end - prev.start) * 0.8);
                                        const c = (prev.start + prev.end) / 2;
                                        return { start: Math.max(0, c - w / 2), end: Math.min(100, c + w / 2) };
                                    })}>+</button>
                                    <button type="button" style={ctrlBtnStyle} onClick={() => setProfileXZoom(prev => {
                                        const w = Math.min(100, (prev.end - prev.start) * 1.25);
                                        const c = (prev.start + prev.end) / 2;
                                        return { start: Math.max(0, c - w / 2), end: Math.min(100, c + w / 2) };
                                    })}>-</button>
                                    <button type="button" style={ctrlBtnStyle} onClick={() => setProfileXZoom(prev => {
                                        const w = prev.end - prev.start;
                                        const s = Math.max(0, prev.start - w * 0.15);
                                        return { start: s, end: Math.min(100, s + w) };
                                    })}>←</button>
                                    <button type="button" style={ctrlBtnStyle} onClick={() => setProfileXZoom(prev => {
                                        const w = prev.end - prev.start;
                                        const e = Math.min(100, prev.end + w * 0.15);
                                        return { start: Math.max(0, e - w), end: e };
                                    })}>→</button>

                                    <span style={{ fontSize: '0.7rem', fontWeight: 600, color: '#374151', marginLeft: '0.4rem' }}>Participants</span>
                                    <button type="button" style={ctrlBtnStyle} onClick={() => setProfileYZoom(prev => {
                                        const w = Math.max(12, (prev.end - prev.start) * 0.8);
                                        const c = (prev.start + prev.end) / 2;
                                        return { start: Math.max(0, c - w / 2), end: Math.min(100, c + w / 2) };
                                    })}>+</button>
                                    <button type="button" style={ctrlBtnStyle} onClick={() => setProfileYZoom(prev => {
                                        const w = Math.min(100, (prev.end - prev.start) * 1.25);
                                        const c = (prev.start + prev.end) / 2;
                                        return { start: Math.max(0, c - w / 2), end: Math.min(100, c + w / 2) };
                                    })}>-</button>
                                    <button type="button" style={ctrlBtnStyle} onClick={() => setProfileYZoom(prev => {
                                        const w = prev.end - prev.start;
                                        const s = Math.max(0, prev.start - w * 0.15);
                                        return { start: s, end: Math.min(100, s + w) };
                                    })}>↑</button>
                                    <button type="button" style={ctrlBtnStyle} onClick={() => setProfileYZoom(prev => {
                                        const w = prev.end - prev.start;
                                        const e = Math.min(100, prev.end + w * 0.15);
                                        return { start: Math.max(0, e - w), end: e };
                                    })}>↓</button>

                                    <button type="button" style={{ ...ctrlBtnStyle, minWidth: '3.5rem' }} onClick={() => {
                                        setProfileXZoom({ start: 0, end: 100 });
                                        setProfileYZoom({ start: 0, end: 100 });
                                    }}>pan-out</button>

                                    <button type="button" style={{ ...ctrlBtnStyle, minWidth: '4rem', background: profileCumulative ? '#374151' : '#fff', color: profileCumulative ? '#fff' : '#374151' }}
                                        onClick={() => setProfileCumulative(prev => !prev)}>cumulative</button>
                                    <button type="button" style={{ ...ctrlBtnStyle, minWidth: '2.5rem', background: profileLogScale ? '#374151' : '#fff', color: profileLogScale ? '#fff' : '#374151' }}
                                        onClick={() => setProfileLogScale(prev => !prev)}>log</button>
                                </div>
                            </div>

                        </div>
                    ) : panelMode === 'harness' ? (
                        <div
                            className="athlete-runs-table-wrapper plot-panel-wrapper"
                            style={{
                                position: isMobile ? 'relative' : 'absolute',
                                background: 'transparent',
                                boxShadow: 'none',
                                border: 'none',
                                padding: 0,
                                left: isMobile ? 'auto' : groupsPanelLeft,
                                top: isMobile ? 'auto' : groupsPanelTop,
                                width: groupsPanelWidth,
                                overflow: 'hidden',
                                marginTop: isMobile ? groupsPanelTop : 0
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
                                    boxShadow: '0 10px 18px rgba(15, 23, 42, 0.08)',
                                    width: groupsWindowWidth,
                                    height: groupsWindowFixedHeight,
                                    minHeight: groupsWindowHeight
                                }}
                            >
                                <div style={{ background: '#e5e7eb', borderBottom: '1px solid #d1d5db', padding: '0.45rem 0.8rem', textAlign: 'center', fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}>
                                    <span>Course statistics comparison (Hardness)</span>
                                    <button
                                        type="button"
                                        className="top-bar-help-btn"
                                        aria-label="Course statistics comparison hardness help"
                                        title="Course statistics comparison hardness help"
                                        onClick={(event) => {
                                            const rect = (event.currentTarget as HTMLButtonElement).getBoundingClientRect();
                                            requestUnifiedHelp('plotCourseStatsCompHard', {
                                                x: rect.left,
                                                y: rect.bottom
                                            });
                                        }}
                                    >
                                        📖
                                    </button>
                                </div>

                                <div style={{ padding: '0.3rem 0.2rem 0.35rem 0.2rem', overflowX: 'hidden' }}>
                                    <ReactECharts
                                        style={{ height: groupsPlotHeight, width: groupsPlotWidth }}
                                        notMerge={true}
                                        option={{
                                            animation: false,
                                            grid: { top: 42, bottom: 75, left: 58, right: 20, containLabel: false },
                                            legend: {
                                                type: 'plain',
                                                bottom: 0,
                                                textStyle: { fontSize: 10 },
                                                itemGap: 10,
                                                data: [
                                                    'All Time – Event',
                                                    'All Time – Seasonal',
                                                    'Last 1Y – Event',
                                                    'Last 1Y – Seasonal'
                                                ]
                                            },
                                            xAxis: {
                                                type: 'category',
                                                data: profileHardnessChartData.months,
                                                axisLabel: { fontSize: 11 },
                                                axisLine: { lineStyle: { color: '#c4c7cf' } }
                                            },
                                            yAxis: {
                                                type: 'value',
                                                name: 'Hardness',
                                                nameTextStyle: { fontSize: 10 },
                                                axisLabel: {
                                                    fontSize: 10,
                                                    formatter: (value: number) => `${(value * 100).toFixed(1)}%`
                                                },
                                                axisLine: { lineStyle: { color: '#c4c7cf' } },
                                                splitLine: { lineStyle: { color: '#e5e7eb' } }
                                            },
                                            series: [
                                                {
                                                    name: 'All Time – Event',
                                                    type: 'bar',
                                                    stack: 'all_time',
                                                    barWidth: '18%',
                                                    barCategoryGap: '38%',
                                                    itemStyle: { color: '#1d4ed8' },
                                                    data: profileHardnessChartData.allTimeEvent
                                                },
                                                {
                                                    name: 'All Time – Seasonal',
                                                    type: 'bar',
                                                    stack: 'all_time',
                                                    barWidth: '18%',
                                                    itemStyle: { color: '#60a5fa' },
                                                    data: profileHardnessChartData.allTimeSeasonal
                                                },
                                                {
                                                    name: 'Last 1Y – Event',
                                                    type: 'bar',
                                                    stack: 'last_1y',
                                                    barWidth: '18%',
                                                    itemStyle: { color: '#ea580c' },
                                                    data: profileHardnessChartData.last1YEvent
                                                },
                                                {
                                                    name: 'Last 1Y – Seasonal',
                                                    type: 'bar',
                                                    stack: 'last_1y',
                                                    barWidth: '18%',
                                                    itemStyle: { color: '#fdba74' },
                                                    data: profileHardnessChartData.last1YSeasonal
                                                }
                                            ],
                                            tooltip: {
                                                trigger: 'axis',
                                                axisPointer: { type: 'shadow' },
                                                formatter: (params: any) => {
                                                    if (!Array.isArray(params) || !params.length) return '';
                                                    const month = String(params[0]?.axisValue ?? '');
                                                    const lines = params
                                                        .filter((p: any) => p.value !== null && p.value !== undefined)
                                                        .map((p: any) => `${p.seriesName}: ${((Number(p.value) || 0) * 100).toFixed(1)}%`);
                                                    return [month, ...lines].join('<br/>');
                                                }
                                            }
                                        }}
                                    />
                                </div>
                            </div>
                        </div>
                    ) : panelMode === 'groups' ? (
                        <div
                            className="athlete-runs-table-wrapper groups-panel-wrapper plot-panel-wrapper"
                            style={{
                                position: isMobile ? 'relative' : 'absolute',
                                background: 'transparent',
                                boxShadow: 'none',
                                border: 'none',
                                padding: 0,
                                left: isMobile ? 'auto' : groupsPanelLeft,
                                top: isMobile ? 'auto' : groupsPanelTop,
                                width: groupsPanelWidth,
                                overflow: 'hidden',
                                marginTop: isMobile ? groupsPanelTop : 0
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
                                    boxShadow: '0 10px 18px rgba(15, 23, 42, 0.08)',
                                    width: groupsWindowWidth,
                                    height: groupsWindowFixedHeight,
                                    minHeight: groupsWindowHeight
                                }}
                            >
                                <div style={{ background: '#e5e7eb', borderBottom: '1px solid #d1d5db', padding: '0.45rem 0.8rem', textAlign: 'center', fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}>
                                    <span>Course statistics comparison (Groups)</span>
                                    <button
                                        type="button"
                                        className="top-bar-help-btn"
                                        aria-label="Course statistics comparison groups help"
                                        title="Course statistics comparison groups help"
                                        onClick={(event) => {
                                            const rect = (event.currentTarget as HTMLButtonElement).getBoundingClientRect();
                                            requestUnifiedHelp('plotCourseStatsCompGroups', {
                                                x: rect.left,
                                                y: rect.bottom
                                            });
                                        }}
                                    >
                                        📖
                                    </button>
                                </div>

                                {monthlyCascadeLoading ? (
                                    <div style={{ padding: '0.8rem', fontSize: '0.9rem', color: '#4b5563' }}>Loading monthly group trends…</div>
                                ) : monthlyCascadeError ? (
                                    <div style={{ padding: '0.8rem', fontSize: '0.9rem', color: '#b91c1c' }}>{monthlyCascadeError}</div>
                                ) : (
                                    <div style={{ padding: '0.3rem 0.2rem 0.35rem 0.2rem', overflowX: 'hidden', position: 'relative' }}>
                                        <button
                                            type="button"
                                            onClick={cycleGroupsBarMode}
                                            title={`Switch groups chart mode (current: ${groupsBarMode})`}
                                            aria-label={`Switch groups chart mode (current: ${groupsBarMode})`}
                                            style={{
                                                position: 'absolute',
                                                right: '0.45rem',
                                                top: '0.35rem',
                                                zIndex: 3,
                                                border: '1px solid #9ca3af',
                                                borderRadius: '6px',
                                                background: '#fff',
                                                color: '#111827',
                                                fontSize: '0.65rem',
                                                fontWeight: 700,
                                                lineHeight: 1.15,
                                                padding: '0.18rem 0.45rem',
                                                cursor: 'pointer',
                                                boxShadow: '0 1px 2px rgba(15, 23, 42, 0.08)'
                                            }}
                                        >
                                            {groupsToggleLabel}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setIsIndexMode(!isIndexMode)}
                                            title={`Toggle between Actual and Index modes`}
                                            aria-label={`Toggle between Actual and Index modes`}
                                            style={{
                                                position: 'absolute',
                                                right: '0.45rem',
                                                top: 'calc(1.05rem + 0.3cm)',
                                                zIndex: 3,
                                                border: '1px solid #9ca3af',
                                                borderRadius: '6px',
                                                background: '#fff',
                                                color: '#111827',
                                                fontSize: '0.65rem',
                                                fontWeight: 700,
                                                lineHeight: 1.15,
                                                padding: '0.18rem 0.45rem',
                                                cursor: 'pointer',
                                                boxShadow: '0 1px 2px rgba(15, 23, 42, 0.08)'
                                            }}
                                        >
                                            {isIndexMode ? 'Actual' : 'Index'}
                                        </button>
                                        {showTypeGroupBars && showAgeGroupBars ? (
                                            <div
                                                aria-hidden="true"
                                                style={{
                                                    position: 'absolute',
                                                    left: pGroupsLegendDivider?.x ?? groupsLegendDividerElement?.[viewport]?.x ?? '0.6rem',
                                                    width: pGroupsLegendDivider?.width ?? groupsLegendDividerElement?.[viewport]?.width ?? 'calc(100% - 1.2rem)',
                                                    bottom: pGroupsLegendDivider?.y ?? groupsLegendDividerElement?.[viewport]?.y ?? 'calc(2.35rem + 0.3cm)',
                                                    borderTop: '1px solid #d1d5db',
                                                    zIndex: 2,
                                                    pointerEvents: 'none'
                                                }}
                                            />
                                        ) : null}
                                        <ReactECharts
                                            style={{ height: groupsPlotHeight, width: groupsPlotWidth }}
                                            notMerge={true}
                                            option={{
                                                animation: false,
                                                grid: { top: 42, bottom: isMobile ? 170 : 130, left: 58, right: 20, containLabel: false },
                                                legend: [
                                                    ...(showTypeGroupBars
                                                        ? (isMobile
                                                            ? [{ type: 'plain', bottom: 118, left: 'center', textStyle: { fontSize: 10 }, itemGap: 10, data: ['1st First Timer', 'First Timer event', 'Tourist','Returner'] },
                                                               { type: 'plain', bottom: 96, left: 'center', textStyle: { fontSize: 10 }, itemGap: 10, data: ['Super Regular', 'Regular','Rest', 'Unknown'] }]
                                                             
                                                            : [{ type: 'plain', bottom: 70, left: 'center', textStyle: { fontSize: 10 }, itemGap: 10, data: ['1st First Timer', 'First Timer event', 'Tourist', 'Returner'] },
                                                               { type: 'plain', bottom: 48, left: 'center', textStyle: { fontSize: 10 }, itemGap: 10, data: ['Super Regular', 'Regular', 'Rest', 'Unknown'] }])
                                                        : []),
                                                    ...(showAgeGroupBars
                                                        ? (isMobile
                                                            ? [{ type: 'plain', bottom: 70, left: 'center', textStyle: { fontSize: 10 }, itemGap: 10, data: ['Younger Men', 'Adult Men', 'Senior Men', 'Veteran Men'] },
                                                               { type: 'plain', bottom: 48, left: 'center', textStyle: { fontSize: 10 }, itemGap: 10, data: ['Super-vet Men', 'Younger Women', 'Adult Women'] },
                                                               { type: 'plain', bottom: 26, left: 'center', textStyle: { fontSize: 10 }, itemGap: 10, data: ['Senior Women','Veteran Women', 'Super-vet Women'] }]
                                                            : [{ type: 'plain', bottom: 24, left: 'center', textStyle: { fontSize: 10 }, itemGap: 10, data: ['Younger Men', 'Adult Men', 'Senior Men', 'Veteran Men', 'Super-vet Men'] },
                                                               { type: 'plain', bottom: 2, left: 'center', textStyle: { fontSize: 10 }, itemGap: 10, data: ['Younger Women', 'Adult Women', 'Senior Women', 'Veteran Women', 'Super-vet Women', 'unclassified'] }])
                                                        : [])
                                                ],
                                                xAxis: {
                                                    type: 'category',
                                                    data: displayGroupsChartData.months,
                                                    axisLabel: { fontSize: 11 },
                                                    axisLine: { lineStyle: { color: '#c4c7cf' } }
                                                },
                                                yAxis: {
                                                    type: 'value',
                                                    name: isIndexMode ? 'Percentage (%)' : 'Avg Participants / event',
                                                    nameTextStyle: { fontSize: 10 },
                                                    axisLabel: {
                                                        fontSize: 10,
                                                        formatter: (value: number) => isIndexMode ? `${value.toFixed(0)}%` : `${value.toFixed(1)}`
                                                    },
                                                    axisLine: { lineStyle: { color: '#c4c7cf' } },
                                                    splitLine: { lineStyle: { color: '#e5e7eb' } }
                                                },
                                                series: [
                                                    { name: '1st First Timer', type: 'bar', stack: 'monthly_groups', barWidth: isMobile ? 7 : 10, itemStyle: { color: '#1d4ed8', opacity: showTypeGroupBars ? 1 : 0 }, tooltip: { show: showTypeGroupBars }, emphasis: { disabled: !showTypeGroupBars }, data: showTypeGroupBars ? displayGroupsChartData.firstFirstTimer : displayGroupsChartData.firstFirstTimer.map(() => 0) },
                                                    { name: 'First Timer event', type: 'bar', stack: 'monthly_groups', barWidth: isMobile ? 7 : 10, itemStyle: { color: '#60a5fa', opacity: showTypeGroupBars ? 1 : 0 }, tooltip: { show: showTypeGroupBars }, emphasis: { disabled: !showTypeGroupBars }, data: showTypeGroupBars ? displayGroupsChartData.firstTimerComment : displayGroupsChartData.firstTimerComment.map(() => 0) },
                                                    { name: 'Tourist', type: 'bar', stack: 'monthly_groups', barWidth: isMobile ? 7 : 10, itemStyle: { color: '#a78bfa', opacity: showTypeGroupBars ? 1 : 0 }, tooltip: { show: showTypeGroupBars }, emphasis: { disabled: !showTypeGroupBars }, data: showTypeGroupBars ? displayGroupsChartData.tourist : displayGroupsChartData.tourist.map(() => 0) },
                                                    { name: 'Returner', type: 'bar', stack: 'monthly_groups', barWidth: isMobile ? 7 : 10, itemStyle: { color: '#059669', opacity: showTypeGroupBars ? 1 : 0 }, tooltip: { show: showTypeGroupBars }, emphasis: { disabled: !showTypeGroupBars }, data: showTypeGroupBars ? displayGroupsChartData.returnerOrSuperReturner : displayGroupsChartData.returnerOrSuperReturner.map(() => 0) },
                                                    { name: 'Super Regular', type: 'bar', stack: 'monthly_groups', barWidth: isMobile ? 7 : 10, itemStyle: { color: '#10b981', opacity: showTypeGroupBars ? 1 : 0 }, tooltip: { show: showTypeGroupBars }, emphasis: { disabled: !showTypeGroupBars }, data: showTypeGroupBars ? displayGroupsChartData.superRegular : displayGroupsChartData.superRegular.map(() => 0) },
                                                    { name: 'Regular', type: 'bar', stack: 'monthly_groups', barWidth: isMobile ? 7 : 10, itemStyle: { color: '#86efac', opacity: showTypeGroupBars ? 1 : 0 }, tooltip: { show: showTypeGroupBars }, emphasis: { disabled: !showTypeGroupBars }, data: showTypeGroupBars ? displayGroupsChartData.lastCodeGt10 : displayGroupsChartData.lastCodeGt10.map(() => 0) },
                                                    { name: 'Rest', type: 'bar', stack: 'monthly_groups', barWidth: isMobile ? 7 : 10, itemStyle: { color: '#9ca3af', opacity: showTypeGroupBars ? 1 : 0 }, tooltip: { show: showTypeGroupBars }, emphasis: { disabled: !showTypeGroupBars }, data: showTypeGroupBars ? displayGroupsChartData.rest : displayGroupsChartData.rest.map(() => 0) },
                                                    { name: 'Unknown', type: 'bar', stack: 'monthly_groups', barWidth: isMobile ? 7 : 10, itemStyle: { color: '#fbbf24', opacity: showTypeGroupBars ? 1 : 0 }, tooltip: { show: showTypeGroupBars }, emphasis: { disabled: !showTypeGroupBars }, data: showTypeGroupBars ? displayGroupsChartData.unknown : displayGroupsChartData.unknown.map(() => 0) },
                                                    { name: 'Younger Men', type: 'bar', stack: 'monthly_age_groups', barWidth: isMobile ? 7 : 10, itemStyle: { color: '#1e3a8a', opacity: showAgeGroupBars ? 1 : 0 }, tooltip: { show: showAgeGroupBars }, emphasis: { disabled: !showAgeGroupBars }, data: showAgeGroupBars ? displayGroupsChartData.youngerMen : displayGroupsChartData.youngerMen.map(() => 0) },
                                                    { name: 'Adult Men', type: 'bar', stack: 'monthly_age_groups', barWidth: isMobile ? 7 : 10, itemStyle: { color: '#2563eb', opacity: showAgeGroupBars ? 1 : 0 }, tooltip: { show: showAgeGroupBars }, emphasis: { disabled: !showAgeGroupBars }, data: showAgeGroupBars ? displayGroupsChartData.adultMen : displayGroupsChartData.adultMen.map(() => 0) },
                                                    { name: 'Senior Men', type: 'bar', stack: 'monthly_age_groups', barWidth: isMobile ? 7 : 10, itemStyle: { color: '#60a5fa', opacity: showAgeGroupBars ? 1 : 0 }, tooltip: { show: showAgeGroupBars }, emphasis: { disabled: !showAgeGroupBars }, data: showAgeGroupBars ? displayGroupsChartData.seniorMen : displayGroupsChartData.seniorMen.map(() => 0) },
                                                    { name: 'Veteran Men', type: 'bar', stack: 'monthly_age_groups', barWidth: isMobile ? 7 : 10, itemStyle: { color: '#93c5fd', opacity: showAgeGroupBars ? 1 : 0 }, tooltip: { show: showAgeGroupBars }, emphasis: { disabled: !showAgeGroupBars }, data: showAgeGroupBars ? displayGroupsChartData.veteranMen : displayGroupsChartData.veteranMen.map(() => 0) },
                                                    { name: 'Super-vet Men', type: 'bar', stack: 'monthly_age_groups', barWidth: isMobile ? 7 : 10, itemStyle: { color: '#bfdbfe', opacity: showAgeGroupBars ? 1 : 0 }, tooltip: { show: showAgeGroupBars }, emphasis: { disabled: !showAgeGroupBars }, data: showAgeGroupBars ? displayGroupsChartData.superVetMen : displayGroupsChartData.superVetMen.map(() => 0) },
                                                    { name: 'Younger Women', type: 'bar', stack: 'monthly_age_groups', barWidth: isMobile ? 7 : 10, itemStyle: { color: '#9d174d', opacity: showAgeGroupBars ? 1 : 0 }, tooltip: { show: showAgeGroupBars }, emphasis: { disabled: !showAgeGroupBars }, data: showAgeGroupBars ? displayGroupsChartData.youngerWomen : displayGroupsChartData.youngerWomen.map(() => 0) },
                                                    { name: 'Adult Women', type: 'bar', stack: 'monthly_age_groups', barWidth: isMobile ? 7 : 10, itemStyle: { color: '#db2777', opacity: showAgeGroupBars ? 1 : 0 }, tooltip: { show: showAgeGroupBars }, emphasis: { disabled: !showAgeGroupBars }, data: showAgeGroupBars ? displayGroupsChartData.adultWomen : displayGroupsChartData.adultWomen.map(() => 0) },
                                                    { name: 'Senior Women', type: 'bar', stack: 'monthly_age_groups', barWidth: isMobile ? 7 : 10, itemStyle: { color: '#f472b6', opacity: showAgeGroupBars ? 1 : 0 }, tooltip: { show: showAgeGroupBars }, emphasis: { disabled: !showAgeGroupBars }, data: showAgeGroupBars ? displayGroupsChartData.seniorWomen : displayGroupsChartData.seniorWomen.map(() => 0) },
                                                    { name: 'Veteran Women', type: 'bar', stack: 'monthly_age_groups', barWidth: isMobile ? 7 : 10, itemStyle: { color: '#f9a8d4', opacity: showAgeGroupBars ? 1 : 0 }, tooltip: { show: showAgeGroupBars }, emphasis: { disabled: !showAgeGroupBars }, data: showAgeGroupBars ? displayGroupsChartData.veteranWomen : displayGroupsChartData.veteranWomen.map(() => 0) },
                                                    { name: 'Super-vet Women', type: 'bar', stack: 'monthly_age_groups', barWidth: isMobile ? 7 : 10, itemStyle: { color: '#fbcfe8', opacity: showAgeGroupBars ? 1 : 0 }, tooltip: { show: showAgeGroupBars }, emphasis: { disabled: !showAgeGroupBars }, data: showAgeGroupBars ? displayGroupsChartData.superVetWomen : displayGroupsChartData.superVetWomen.map(() => 0) },
                                                    { name: 'unclassified', type: 'bar', stack: 'monthly_age_groups', barWidth: isMobile ? 7 : 10, itemStyle: { color: '#6b7280', opacity: showAgeGroupBars ? 1 : 0 }, tooltip: { show: showAgeGroupBars }, emphasis: { disabled: !showAgeGroupBars }, data: showAgeGroupBars ? displayGroupsChartData.unclassified : displayGroupsChartData.unclassified.map(() => 0) }
                                                ],
                                                tooltip: {
                                                    trigger: 'axis',
                                                    axisPointer: { type: 'shadow' },
                                                    formatter: (params: any) => {
                                                        if (!Array.isArray(params) || !params.length) return '';
                                                        const idx = Number(params[0]?.dataIndex ?? 0);
                                                        const month = String(params[0]?.axisValue ?? '');
                                                        const eventsCount = Number(displayGroupsChartData.eventsInMonth[idx] ?? 0);
                                                        const lines = params
                                                            .filter((p: any) => p.value !== null && p.value !== undefined && Number(p.value) !== 0 && p.seriesName)
                                                            .map((p: any) => `${p.seriesName}: ${isIndexMode ? (Number(p.value) || 0).toFixed(2) + '%' : (Number(p.value) || 0).toFixed(1)}`);
                                                        return [`${month} (events: ${eventsCount})`, ...lines].join('<br/>');
                                                    }
                                                }
                                            }}
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : panelMode === 'top250' ? (
                        <div
                            className="athlete-runs-table-wrapper top250-table-wrapper"
                            style={{
                                position: isMobile ? 'relative' : 'absolute',
                                marginTop: isMobile ? tablePanelTop : 0,
                                left: isMobile ? 'auto' : tablePanelLeft,
                                top: isMobile ? 'auto' : tablePanelTop,
                                width: 'fit-content',
                                maxWidth: tablePanelWidth,
                                height: tablePanelMinHeight,
                                maxHeight: tablePanelMinHeight,
                                overflowX: 'auto',
                                overflowY: 'auto'
                            }}
                        >
                            {top250Loading ? (
                                <p className="course-runs-empty"></p>
                            ) : top250Error ? (
                                <p className="athlete-error">{top250Error}</p>
                            ) : sortedTop250Rows.length > 0 ? (
                                <table className="athlete-runs-table" aria-label="Top250 event summary" style={{ width: 'max-content', tableLayout: 'fixed' }}>
                                    <thead>
                                        <tr>
                                            {visibleTop250Columns.map((col) => {
                                                const isSorted = top250SortKey === col.key;
                                                const headerClasses = ['athlete-table-header'];
                                                if (col.key === 'name') headerClasses.push('athlete-date-header');
                                                if (isSorted) headerClasses.push('courses-sorted-column');
                                                const style: React.CSSProperties = {
                                                    ...getColumnWidthStyle(col),
                                                    textAlign: tableHeaderTextAlign
                                                };
                                                return (
                                                    <th
                                                        key={col.key}
                                                        className={headerClasses.join(' ')}
                                                        onClick={(event) => onHeaderActivate(event.currentTarget, col.key, col.label, col.helpTarget, handleTop250Sort)}
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
                                                                onHeaderActivate(event.currentTarget, col.key, col.label, col.helpTarget, handleTop250Sort);
                                                            }
                                                        }}
                                                        tabIndex={0}
                                                        scope="col"
                                                        aria-sort={isSorted ? (top250SortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                                                        style={style}
                                                    >
                                                        <span className="courses-header-content">
                                                            <span className="courses-header-label">{col.label}</span>
                                                            <span className="athlete-sort-indicator courses-sort-indicator">{isSorted ? (top250SortDir === 'asc' ? '▲' : '▼') : ''}</span>
                                                        </span>
                                                    </th>
                                                );
                                            })}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {sortedTop250Rows.map((row, index) => {
                                            const rowKey = `${pickField(row, ['athlete_code'])}-${pickField(row, ['name'])}-${index}`;
                                            const top250AthleteCode = String(pickField(row, ['athlete_code']) ?? '');
                                            const top250ClubToken = String(pickField(row, ['club']) ?? '').trim().toLowerCase();
                                            const top250IsHighlightedByAthlete = Boolean(top250AthleteCode) && top250AthleteCode === highlightedTop250AthleteCode;
                                            const top250IsHighlightedByClub = Boolean(top250ClubToken) && Boolean(highlightedTop250ClubToken) && top250ClubToken === highlightedTop250ClubToken;
                                            const top250IsHighlighted = top250IsHighlightedByAthlete || top250IsHighlightedByClub;
                                            return (
                                                <tr
                                                    key={rowKey}
                                                    data-top250-athlete-code={top250AthleteCode || undefined}
                                                    data-top250-club-token={top250ClubToken || undefined}
                                                    className={top250IsHighlighted ? 'top250-highlighted-row' : ''}
                                                >
                                                    {visibleTop250Columns.map((col) => {
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

                                                        if (col.key === 'club') {
                                                            const clubValue = String(rawValue ?? '').trim();
                                                            const canOpenClub = Boolean(clubValue) && clubValue !== '--' && clubValue.toLowerCase() !== '<no club>';

                                                            return (
                                                                <td key={col.key} style={alignmentStyle}>
                                                                    {canOpenClub ? (
                                                                        <button
                                                                            type="button"
                                                                            onClick={(event) => {
                                                                                event.preventDefault();
                                                                                event.stopPropagation();
                                                                                handleClubNavigate(clubValue, pickField(row, ['athlete_code']));
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
                                                                            aria-label={`Open club page for ${clubValue}`}
                                                                        >
                                                                            {clubValue}
                                                                        </button>
                                                                    ) : (
                                                                        value
                                                                    )}
                                                                </td>
                                                            );
                                                        }

                                                        if (col.key === 'best_curve_ranking_current') {
                                                            const currentRankRaw = row?.best_curve_ranking_current ?? row?.bestCurveRankingCurrent ?? row?.rank;
                                                            const historicRankRaw = row?.best_curve_ranking_historic ?? row?.bestCurveRankingHistoric;
                                                            const rankTypeRaw = pickField(row, ['best_curve_ranking_current_type', 'bestCurveRankingCurrentType']);
                                                            const rankSubFontSize = '0.62rem';

                                                            const toOptionalRankNumber = (value: unknown): number | null => {
                                                                if (value === null || value === undefined) return null;
                                                                const text = String(value).trim();
                                                                if (!text) return null;
                                                                const numeric = Number(text);
                                                                return Number.isFinite(numeric) ? numeric : null;
                                                            };

                                                            const currentRank = toOptionalRankNumber(currentRankRaw);
                                                            const historicRank = toOptionalRankNumber(historicRankRaw);
                                                            const hasCurrent = currentRank !== null;
                                                            const hasHistoric = historicRank !== null;
                                                            const rankType = hasCurrent ? (String(rankTypeRaw || '').trim() || '*') : '';
                                                            const currentRankInt = hasCurrent ? Math.round(currentRank as number) : null;
                                                            const historicRankInt = hasHistoric ? Math.round(historicRank as number) : null;
                                                            const delta = currentRankInt !== null && historicRankInt !== null
                                                                ? currentRankInt - historicRankInt
                                                                : null;
                                                            const deltaText = delta === null ? '' : `${delta >= 0 ? '+' : ''}${delta}`;

                                                            return (
                                                                <td key={col.key} style={{ ...alignmentStyle, textAlign: 'center' }}>
                                                                    <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                                                                        <span>{currentRankInt !== null ? String(currentRankInt) : ''}</span>
                                                                        {(rankType || deltaText) ? (
                                                                            <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', lineHeight: 1.02 }}>
                                                                                <span style={{ fontSize: rankSubFontSize, opacity: 0.9 }}>{rankType}</span>
                                                                                <span style={{ fontSize: rankSubFontSize, opacity: 0.9 }}>{deltaText}</span>
                                                                            </span>
                                                                        ) : null}
                                                                    </div>
                                                                </td>
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
                        <div
                            className="athlete-runs-table-wrapper course-table-wrapper"
                            style={{
                                position: isMobile ? 'relative' : 'absolute',
                                marginTop: isMobile ? tablePanelTop : 0,
                                left: isMobile ? 'auto' : tablePanelLeft,
                                top: isMobile ? 'auto' : tablePanelTop,
                                width: tablePanelWidth,
                                minHeight: tablePanelMinHeight
                            }}
                        >
                            {rows.length > 0 ? (
                                <>
                                    <table
                                        className="athlete-runs-table course-summary-table"
                                        aria-label="Course summary row"
                                        style={{
                                            position: summaryRowElement?.sticky ? 'sticky' : 'relative',
                                            left: pSummaryRow?.x ?? summaryRowElement?.[viewport]?.x ?? '0cm',
                                            top: pSummaryRow?.y ?? summaryRowElement?.[viewport]?.y ?? '0cm',
                                            zIndex: summaryRowElement?.sticky ? 120 : undefined
                                        }}
                                    >
                                        <tbody>
                                            <tr>
                                                {tableColumns.map((col) => {
                                                    const baseStyle = getColumnWidthStyle(col);
                                                    if (col.key === 'date') {
                                                        return (
                                                            <th key={col.key} scope="row" className="athlete-date-cell" style={baseStyle}>
                                                                <div
                                                                    className="course-summary-mode-select-wrap"
                                                                    style={{
                                                                        width: summaryModeSelectElement?.[viewport]?.width,
                                                                        position: summaryModeSelectElement?.sticky ? 'sticky' : 'relative',
                                                                        top: summaryModeSelectElement?.sticky ? 0 : undefined,
                                                                        zIndex: summaryModeSelectElement?.sticky ? 110 : undefined
                                                                    }}
                                                                >
                                                                    <select
                                                                        id="courses-summary-mode-select"
                                                                        value={summarySelectedLabel}
                                                                        onChange={(event) => setSummaryMode(normalizeSummaryMode(event.target.value))}
                                                                        aria-label="Summary metric"
                                                                        className="course-summary-mode-select"
                                                                        style={{
                                                                            background: summaryModeSelectElement?.sticky ? '#e0e0e0' : undefined
                                                                        }}
                                                                    >
                                                                        {summaryControlOptions.map((option) => (
                                                                            <option key={option} value={option}>{option}</option>
                                                                        ))}
                                                                    </select>
                                                                    <span className="course-summary-mode-caret" aria-hidden="true">▼</span>
                                                                </div>
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
                                                    if (isSorted) headerClasses.push('courses-sorted-column');
                                                    const style: React.CSSProperties = {
                                                        ...getColumnWidthStyle(col),
                                                        textAlign: tableHeaderTextAlign
                                                    };
                                                    return (
                                                        <th
                                                            key={col.key}
                                                            className={headerClasses.join(' ')}
                                                            onClick={(event) => onHeaderActivate(event.currentTarget, col.key, col.label, col.helpTarget, handleSort)}
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
                                                                    onHeaderActivate(event.currentTarget, col.key, col.label, col.helpTarget, handleSort);
                                                                }
                                                            }}
                                                            tabIndex={0}
                                                            scope="col"
                                                            aria-sort={isSorted ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                                                            style={style}
                                                        >
                                                            <span className="courses-header-content">
                                                                <span className="courses-header-label">{col.label}</span>
                                                                <span className="athlete-sort-indicator courses-sort-indicator">{isSorted ? (sortDir === 'asc' ? '▲' : '▼') : ''}</span>
                                                            </span>
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
                                                                        <button
                                                                            type="button"
                                                                            className="courses-date-link"
                                                                            onPointerDown={(event) => {
                                                                                event.stopPropagation();
                                                                            }}
                                                                            onClick={(event) => {
                                                                                event.stopPropagation();
                                                                                handleOpenSingleEvent(row);
                                                                            }}
                                                                            title="Open this event date"
                                                                            aria-label={`Open event for ${String(value)}`}
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

export default CourseTest;