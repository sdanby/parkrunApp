import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    API_BASE_URL,
    fetchAdminActivity,
    fetchAdminStatus,
    fetchAdminUsers,
    deleteAdminWeeklyUploadEvent,
    fetchAdminWeeklyUploadStatus,
    fetchEventOptions,
    resetAdminWeeklyUpload,
    setAdminUserDefaultCourse,
    setAdminUserFlag,
    startAdminWeeklyUpload,
    stopAdminWeeklyUpload,
    type AdminActivityRecord,
    type AdminUser,
    type EventOption,
    type WeeklyDeleteEventResponse,
    type WeeklySqlRunSummary,
    type WeeklySqlPipelineOptions,
    type WeeklyUploadStatus
} from '../api/backendAPI';
import './Admin.css';

const AUTH_TOKEN_KEY = 'auth_token_v1';
const AUTH_USER_KEY = 'auth_user_v1';

type AdminPanelSection = 'admin-setup' | 'activity' | 'weekly-upload';

type UserFilters = {
    email: string;
    name: string;
    athlete: string;
    created: string;
    lastLogin: string;
    admin: string;
};

type ActivityFilters = {
    day: string;
    person: string;
    device: string;
    type: string;
    typeVisit: string;
    hits: string;
    minutes: string;
};

type ActivitySummaryRow = {
    id: string;
    day: string;
    person: string;
    device: string;
    type: string;
    typeVisit: string;
    hitCount: number;
    totalDurationMs: number;
    rows: AdminActivityRecord[];
};

type WeeklySqlPipelineFormState = {
    startDate: string;
    rebuild: boolean;
    runSqlPipeline: boolean;
    buildAthletes: boolean;
    skipCoeffUpdates: boolean;
    noParkrunPostgres: boolean;
    eventCode: string;
    scraper: boolean;
    allAthletes: boolean;
    leaveAthletePostgres: boolean;
    noVolunteers: boolean;
    refreshMaterializedView: boolean;
    rebuildHistoricAfterRun: boolean;
    resumeCurveFromAllHistory: boolean;
    forceFreshStart: boolean;
};

type WeeklySqlOptionDefinition = {
    key: Exclude<keyof WeeklySqlPipelineFormState, 'startDate' | 'eventCode'>;
    label: string;
    description: string;
    defaultValue: boolean;
};

type WeeklyDeleteTarget = {
    eventCode: string;
    eventName: string;
    startDate: string;
};

type WeeklyPipelineStageStatus = 'pending' | 'running' | 'complete' | 'failed';

type WeeklyPipelineStageDefinition = {
    id: string;
    label: string;
    description: string;
    target: string;
    startPatterns: string[];
    completePatterns: string[];
};

const formatDateTime = (value?: string | null): string => {
    if (!value) return '—';
    const dt = new Date(value);
    if (Number.isNaN(dt.getTime())) return value;
    return dt.toLocaleString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
};

const formatDay = (value?: string | null): string => {
    if (!value) return 'Unknown day';
    const dt = new Date(value);
    if (Number.isNaN(dt.getTime())) return String(value).slice(0, 10) || 'Unknown day';
    return dt.toLocaleDateString('en-CA');
};

const formatDurationTotalMinutes = (durationMs: number): string => {
    const safeMs = Number.isFinite(durationMs) ? Math.max(0, Math.round(durationMs)) : 0;
    const totalMinutes = safeMs / 60000;
    return `${totalMinutes.toFixed(2)} min`;
};

const formatTimeWithSeconds = (value?: string | null): string => {
    if (!value) return '—';
    const dt = new Date(value);
    if (Number.isNaN(dt.getTime())) return value;
    return dt.toLocaleString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
};

const inferDeviceLabel = (userAgent?: string | null): string => {
    const ua = String(userAgent || '').toLowerCase();
    if (!ua) return 'Unknown';
    if (ua.includes('ipad') || ua.includes('tablet')) return 'Tablet';
    if (ua.includes('iphone') || ua.includes('android') || ua.includes('mobile')) return 'Mobile';
    return 'Desktop';
};

const getTypeVisitLabel = (row: AdminActivityRecord): string => {
    const activityType = String(row.activityType || '').toLowerCase();
    if (activityType !== 'page_visit') {
        return activityType || 'other';
    }

    const path = String(row.pagePath || '').trim().toLowerCase();
    if (!path) return 'unknown';
    if (path.startsWith('/races') || path.startsWith('/event_test')) return 'races';
    if (path.startsWith('/admin')) return 'admin';
    if (path.startsWith('/feedback')) return 'feedback';
    if (path.startsWith('/results') || path.startsWith('/results_test')) return 'results';
    if (path.startsWith('/lists')) return 'lists';
    if (path.startsWith('/clubs')) return 'clubs';
    if (path.startsWith('/courses') || path.startsWith('/courses_test')) return 'course';
    if (path.startsWith('/athletes')) return 'participants';
    if (path.startsWith('/login')) return 'login';
    return path.replace(/^\//, '').split('/')[0] || 'other';
};

const escapeForRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const matchesSqlLike = (rawValue: string, rawFilter: string): boolean => {
    const value = String(rawValue || '');
    const filter = String(rawFilter || '').trim();
    if (!filter) return true;

    if (filter.includes('%') || filter.includes('_')) {
        const regexPattern = escapeForRegex(filter)
            .replace(/%/g, '.*')
            .replace(/_/g, '.');
        return new RegExp(regexPattern, 'i').test(value);
    }

    return value.toLowerCase().includes(filter.toLowerCase());
};

const formatLocalIsoDate = (value: Date): string => {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const getCurrentSaturdayIso = (): string => {
    const now = new Date();
    const mondayOffset = (now.getDay() + 6) % 7;
    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - mondayOffset);
    const saturday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 5);
    return formatLocalIsoDate(saturday);
};

const createDefaultWeeklySqlPipelineFormState = (): WeeklySqlPipelineFormState => ({
    startDate: getCurrentSaturdayIso(),
    rebuild: true,
    runSqlPipeline: true,
    buildAthletes: true,
    skipCoeffUpdates: false,
    noParkrunPostgres: false,
    eventCode: '',
    scraper: true,
    allAthletes: true,
    leaveAthletePostgres: false,
    noVolunteers: false,
    refreshMaterializedView: true,
    rebuildHistoricAfterRun: false,
    resumeCurveFromAllHistory: false,
    forceFreshStart: false
});

const WEEKLY_SQL_OPTION_DEFINITIONS: WeeklySqlOptionDefinition[] = [
    {
        key: 'rebuild',
        label: 'Rebuild',
        description: 'Runs the full sequence of SQL sections from the start date. Turn this off to target just the supplied date instead.',
        defaultValue: true
    },
    {
        key: 'runSqlPipeline',
        label: 'Run SQL Pipeline',
        description: 'This is the main bulk-processing SQL stage. Turn it off to skip the heavy SQL work and just run the surrounding steps.',
        defaultValue: true
    },
    {
        key: 'buildAthletes',
        label: 'Build Athletes',
        description: 'Runs the heavy athlete update block. Turn it off for a lighter retrospective run.',
        defaultValue: true
    },
    {
        key: 'skipCoeffUpdates',
        label: 'Skip Coefficient Updates',
        description: 'Skips coefficient updates. Useful for testing or when coeff changes are not wanted.',
        defaultValue: false
    },
    {
        key: 'noParkrunPostgres',
        label: 'Skip Parkrun Postgres Copy',
        description: 'Prevents parkrun data from being copied to Postgres.',
        defaultValue: false
    },
    {
        key: 'scraper',
        label: 'Run Scraper',
        description: 'Runs scraper work at the end of each processed date.',
        defaultValue: true
    },
    {
        key: 'allAthletes',
        label: 'All Athletes',
        description: 'Controls whether all athletes are updated, rather than only the event range.',
        defaultValue: true
    },
    {
        key: 'leaveAthletePostgres',
        label: 'Skip Athlete Postgres Copy',
        description: 'Skips copying the athlete table to Postgres. This can help keep athlete totals aligned. Off means the copy is performed.',
        defaultValue: false
    },
    {
        key: 'noVolunteers',
        label: 'Skip Volunteers',
        description: 'Turns off volunteer scraping. Off means volunteers are scraped as normal.',
        defaultValue: false
    },
    {
        key: 'refreshMaterializedView',
        label: 'Refresh Materialized Views',
        description: 'Refreshes materialized views after processing. Turn it off if you want to refresh them separately later.',
        defaultValue: true
    },
    {
        key: 'rebuildHistoricAfterRun',
        label: 'Rebuild Historic After Run',
        description: 'Recomputes historic prior-best values once the weekly run has finished.',
        defaultValue: false
    },
    {
        key: 'resumeCurveFromAllHistory',
        label: 'Resume Curve At All-History',
        description: 'Skips the earlier SQL pipeline, scraper, athlete copy, and Stage 1-3 curve rebuild, then resumes at Rebuild All-History Time Reference and finishes the downstream Postgres refresh steps.',
        defaultValue: false
    },
    {
        key: 'forceFreshStart',
        label: 'Force Fresh Start',
        description: 'Ignores prior same-date checkpoints and starts from the beginning even when a safe resume checkpoint exists.',
        defaultValue: false
    }
];

const weeklySqlFormFromStatus = (options?: WeeklySqlPipelineOptions | null): WeeklySqlPipelineFormState => {
    const defaults = createDefaultWeeklySqlPipelineFormState();
    if (!options) return defaults;
    return {
        startDate: String(options.startDate || defaults.startDate),
        rebuild: options.rebuild ?? defaults.rebuild,
        runSqlPipeline: options.runSqlPipeline ?? defaults.runSqlPipeline,
        buildAthletes: options.buildAthletes ?? defaults.buildAthletes,
        skipCoeffUpdates: options.skipCoeffUpdates ?? defaults.skipCoeffUpdates,
        noParkrunPostgres: options.noParkrunPostgres ?? defaults.noParkrunPostgres,
        eventCode: options.eventCode == null ? '' : String(options.eventCode),
        scraper: options.scraper ?? defaults.scraper,
        allAthletes: options.allAthletes ?? defaults.allAthletes,
        leaveAthletePostgres: options.leaveAthletePostgres ?? defaults.leaveAthletePostgres,
        noVolunteers: options.noVolunteers ?? defaults.noVolunteers,
        refreshMaterializedView: options.refreshMaterializedView ?? defaults.refreshMaterializedView,
        rebuildHistoricAfterRun: options.rebuildHistoricAfterRun ?? defaults.rebuildHistoricAfterRun,
        resumeCurveFromAllHistory: options.resumeCurveFromAllHistory ?? defaults.resumeCurveFromAllHistory,
        forceFreshStart: options.forceFreshStart ?? defaults.forceFreshStart
    };
};

const weeklySqlDefaultLabel = (value: boolean): string => (value ? 'On' : 'Off');

const WEEKLY_SQL_PROGRESS_STAGES: WeeklyPipelineStageDefinition[] = [
    {
        id: 'setup',
        label: 'Queue and SQL Setup',
        description: 'Queues the run, resolves dates, and runs the core SQL rebuild pipeline for the selected week.',
        target: '1-2 min target',
        startPatterns: ['weekly sql pipeline queued', 'started weekly sql pipeline run', 'run_simple_sql_loop switches', 'execution plan:'],
        completePatterns: ['[timing] process.full_pipeline.sql_pipeline:']
    },
    {
        id: 'scraper',
        label: 'Scrape Event Results',
        description: 'Runs Athlete_runs across the selected events and updates raw weekly result capture.',
        target: '4-6 min target',
        startPatterns: ['running athlete_runs', 'processing [1/', 'loaded 28 events from events_override'],
        completePatterns: ['[timing] process.full_pipeline.scraper:']
    },
    {
        id: 'athletes',
        label: 'Copy Athletes to Postgres',
        description: 'Pushes athlete updates to Postgres and refreshes current_age_estimate.',
        target: '0-1 min target',
        startPatterns: ['upserted athletes 1-500', 'completed copying 6039 athletes to postgres', 'updated current_age_estimate in postgres'],
        completePatterns: ['[timing] process.full_pipeline.copy_athletes:']
    },
    {
        id: 'curve-stage-1',
        label: 'Curve Stage 1 Rebuild',
        description: 'Builds the rolling curve_run_metrics_history base across the recent rebuild window.',
        target: '2-4 min target',
        startPatterns: ['[curved_ranks] stage 1 rolling rebuild'],
        completePatterns: ['[curved_ranks][timing] pipeline.stage1:']
    },
    {
        id: 'curve-stage-2-build',
        label: 'Curve Stage 2 Build',
        description: 'Builds the snapshot-date curve rank mapping rows for the selected weekly date.',
        target: '4-6 min target',
        startPatterns: ['[curved_ranks] stage 2+3 processing dates', '[curved_ranks] processing 1/1:'],
        completePatterns: ['[curved_ranks][timing] stage2.build (']
    },
    {
        id: 'curve-stage-2-reference',
        label: 'Build Date Curve Time Reference',
        description: 'Rebuilds the date-scoped curve_time_ranks_reference used immediately before applying weekly curve ranks.',
        target: '6-9 min target',
        startPatterns: ['[curved_ranks] stage 2 rows for', '[curved_ranks] curve_time_ranks_reference build ('],
        completePatterns: ['[curved_ranks] stage 3: updating eventpositions']
    },
    {
        id: 'curve-stage-3-apply',
        label: 'Curve Stage 3 Apply',
        description: 'Updates weekly eventpositions with the freshly calculated current and historic curve ranking values.',
        target: '0-2 min target',
        startPatterns: ['[curved_ranks] stage 3: updating eventpositions'],
        completePatterns: ['[curved_ranks][timing] stage3.apply (']
    },
    {
        id: 'curve-all-history-reference',
        label: 'Rebuild All-History Time Reference',
        description: 'Rebuilds the all-history curve_time_ranks_reference used for the later athlete history steps.',
        target: '1-2 min target',
        startPatterns: ['[curved_ranks] rebuilding all-history curve_time_ranks_reference before weekly athlete history build', '[curved_ranks] curve_time_ranks_reference build (all) started'],
        completePatterns: ['[curved_ranks][timing] weekly.curve_time_ranks_reference.rebuild_all_history:']
    },
    {
        id: 'curve-athlete-history',
        label: 'Build Athlete Curve History',
        description: 'Builds temporary current-rank tables and writes current and historic athlete best-rank history rows.',
        target: '8-10 min target',
        startPatterns: ['[curved_ranks] curve_athlete_best_rank_history build start', '[curved_ranks] tmp_curve_current_ranks build started', '[curved_ranks] curve_athlete_best_rank_history insert started'],
        completePatterns: ['[curved_ranks][timing] curve_athlete_best_rank_history.fast_build']
    },
    {
        id: 'curve-history-sync',
        label: 'Sync Curve History Back to Results',
        description: 'Syncs the 3-week curve history back into eventpositions and copies that weekly backfill to Postgres.',
        target: '3-5 min target',
        startPatterns: ['[curved_ranks] prepared sync rows for', '[curved_ranks] updating 2026-', '[curved_ranks] copying 3-week backfill'],
        completePatterns: ['[timing] process.full_pipeline.curve_rank_updates_with_copy:']
    },
    {
        id: 'verify-summary',
        label: 'Verify and Upload Summary',
        description: 'Verifies curve ranks in Postgres and uploads curve rank range summary rows.',
        target: '0-1 min target',
        startPatterns: ['[curve][verify]', '[curve_rank_range_summary]', 'curve_rank_range_summary rows uploaded'],
        completePatterns: ['[timing] process.full_pipeline.curve_rank_range_summary_upload:']
    },
    {
        id: 'copy-results',
        label: 'Copy Weekly Results',
        description: 'Copies weekly eventpositions and parkrun_events rows into Postgres for the selected date window.',
        target: '0-1 min target',
        startPatterns: ['copy_table_to_postgres: selected', 'upserted rows 1 to 500 of', 'updated existing rows (updateonly) in parkrun_events'],
        completePatterns: ['[timing] process.full_pipeline.copy_parkrun_events:']
    },
    {
        id: 'mv-backup',
        label: 'Backup Materialized View SQL',
        description: 'Captures the current materialized view definitions before the refresh cycle starts.',
        target: '0-2 min target',
        startPatterns: ['[mv-backup]'],
        completePatterns: ['[mv-backup] saved', '[mv-backup] no materialized views found for schema']
    },
    {
        id: 'mv-refresh-foundation',
        label: 'Refresh Foundation Views',
        description: 'Refreshes the base views that support later curve reporting, including latest ranks and participant filters.',
        target: '4-6 min target',
        startPatterns: ['refreshing materialized view: mv_extend_runs', 'refreshing materialized view: mv_latest_curve_ranks'],
        completePatterns: ['refreshed mv_participant_run_filters in']
    },
    {
        id: 'mv-refresh-current',
        label: 'Refresh Current Best-Curve Views',
        description: 'Refreshes the current all-time best-curve reporting views across age, event, sex, and overall groupings.',
        target: '5-7 min target',
        startPatterns: ['refreshing materialized view: mv_best_age_curve', 'refreshing materialized view: mv_best_age_event_curve'],
        completePatterns: ['refreshed mv_best_curve in']
    },
    {
        id: 'mv-refresh-1y',
        label: 'Refresh 1-Year Best-Curve Views',
        description: 'Refreshes the one-year curve reporting views for the same age, event, sex, and overall rollups.',
        target: '1-2 min target',
        startPatterns: ['refreshing materialized view: mv_best_age_1y_curve', 'refreshing materialized view: mv_best_age_event_1y_curve'],
        completePatterns: ['refreshed mv_best_1y_curve in']
    },
    {
        id: 'mv-refresh-caches',
        label: 'Refresh Summary and Club Caches',
        description: 'Refreshes the event summary and club member cache views, then closes out the materialized view cycle.',
        target: '1-2 min target',
        startPatterns: ['refreshing materialized view: mv_event_summary_cache', 'refreshing materialized view: mv_club_members_cache'],
        completePatterns: ['refreshed mv_club_members_cache in', 'materialized views refreshed successfully.']
    },
    {
        id: 'finish',
        label: 'Finish and Finalise',
        description: 'Writes total timing, marks the job complete, and closes the weekly SQL pipeline run.',
        target: '0-1 min target',
        startPatterns: ['[timing] process.total:', 'completed weekly sql pipeline run.'],
        completePatterns: ['completed weekly sql pipeline run.']
    }
];

const findWeeklyLogEntry = (logs: WeeklyUploadStatus['logs'], patterns: string[], fromEnd = false) => {
    const entries = fromEnd ? [...logs].reverse() : logs;
    return entries.find((entry) => {
        const message = String(entry?.message || '').toLowerCase();
        return patterns.some((pattern) => message.includes(pattern.toLowerCase()));
    }) || null;
};

const Admin: React.FC = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [canAccess, setCanAccess] = useState(false);
    const [bootstrapOpen, setBootstrapOpen] = useState(false);
    const [adminCount, setAdminCount] = useState(0);
    const [users, setUsers] = useState<AdminUser[]>([]);
    const [courseOptions, setCourseOptions] = useState<EventOption[]>([]);
    const [savingUserId, setSavingUserId] = useState<number | null>(null);
    const [savingCourseUserId, setSavingCourseUserId] = useState<number | null>(null);
    const [section, setSection] = useState<AdminPanelSection>('admin-setup');
    const [activity, setActivity] = useState<AdminActivityRecord[]>([]);
    const [activityLoading, setActivityLoading] = useState(false);
    const [userFilters, setUserFilters] = useState<UserFilters>({
        email: '',
        name: '',
        athlete: '',
        created: '',
        lastLogin: '',
        admin: ''
    });
    const [activityFilters, setActivityFilters] = useState<ActivityFilters>({
        day: '',
        person: '',
        device: '',
        type: '',
        typeVisit: '',
        hits: '',
        minutes: ''
    });
    const [selectedSummaryRow, setSelectedSummaryRow] = useState<ActivitySummaryRow | null>(null);
    const [selectedDetailRow, setSelectedDetailRow] = useState<AdminActivityRecord | null>(null);
    const [weeklyStatus, setWeeklyStatus] = useState<WeeklyUploadStatus>({
        running: false,
        status: 'idle',
        totalCourses: 0,
        processedCourses: 0,
        logs: []
    });
    const [weeklyLoading, setWeeklyLoading] = useState(false);
    const [weeklyStarting, setWeeklyStarting] = useState(false);
    const [weeklyStopping, setWeeklyStopping] = useState(false);
    const [weeklyResetting, setWeeklyResetting] = useState(false);
    const [weeklyError, setWeeklyError] = useState<string | null>(null);
    const [weeklyOptions, setWeeklyOptions] = useState({
        loopEvents: true,
        loadHistory: false,
        parkrunName: 'brentwood'
    });
    const [weeklySqlOptions, setWeeklySqlOptions] = useState<WeeklySqlPipelineFormState>(() => createDefaultWeeklySqlPipelineFormState());
    const [weeklyDeleteCourseCode, setWeeklyDeleteCourseCode] = useState('');
    const [weeklyDeletePending, setWeeklyDeletePending] = useState(false);
    const [weeklyDeleteConfirm, setWeeklyDeleteConfirm] = useState<WeeklyDeleteTarget | null>(null);
    const [systemChecks, setSystemChecks] = useState<{
        backend: 'idle' | 'running' | 'ok' | 'error';
        weeklyApi: 'idle' | 'running' | 'ok' | 'error';
        message: string;
    }>({
        backend: 'idle',
        weeklyApi: 'idle',
        message: ''
    });
    const weeklyLogRef = useRef<HTMLDivElement | null>(null);
    const oneMonthStartIso = useMemo(() => {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
        return start.toISOString();
    }, []);
    const token = useMemo(() => localStorage.getItem(AUTH_TOKEN_KEY) || '', []);

    const getCachedAuthUser = (): any => {
        try {
            const raw = localStorage.getItem(AUTH_USER_KEY);
            return raw ? JSON.parse(raw) : null;
        } catch (_err) {
            return null;
        }
    };

    const resetToLogin = (message: string) => {
        localStorage.removeItem(AUTH_TOKEN_KEY);
        localStorage.removeItem(AUTH_USER_KEY);
        setCanAccess(false);
        setUsers([]);
        setActivity([]);
        setError(message);
        navigate('/login', {
            replace: true,
            state: { sessionMessage: message }
        });
    };

    const normalizeAdminUsers = (rawUsers: any[]): AdminUser[] => {
        const usersList = Array.isArray(rawUsers) ? rawUsers : [];
        const normalized = usersList.map((row: any) => ({
            id: Number(row?.id),
            email: String(row?.email || ''),
            displayName: row?.displayName ?? row?.display_name ?? null,
            athleteCode: row?.athleteCode ?? row?.athlete_code ?? null,
            defaultCourseCode: row?.defaultCourseCode ?? row?.default_course_code ?? null,
            defaultCourseName: row?.defaultCourseName ?? row?.default_course_name ?? null,
            isAdmin: Boolean(row?.isAdmin ?? row?.is_admin),
            createdAt: row?.createdAt ?? row?.created_at ?? null,
            lastLoginAt: row?.lastLoginAt ?? row?.last_login_at ?? null
        }));

        try {
            const rawAuth = localStorage.getItem(AUTH_USER_KEY);
            if (!rawAuth) return normalized;
            const authUser = JSON.parse(rawAuth) || {};
            const authId = Number(authUser.id);
            const authEmail = String(authUser.email || '').toLowerCase();
            const authDefaultCode = String(authUser.defaultCourseCode || authUser.default_course_code || '').trim();
            const authDefaultName = String(authUser.defaultCourseName || authUser.default_course_name || '').trim();
            if (!authDefaultCode && !authDefaultName) return normalized;

            return normalized.map((entry) => {
                const idMatch = Number.isFinite(authId) && Number(entry.id) === authId;
                const emailMatch = authEmail && String(entry.email || '').toLowerCase() === authEmail;
                if (!idMatch && !emailMatch) return entry;

                return {
                    ...entry,
                    defaultCourseCode: entry.defaultCourseCode || authDefaultCode || null,
                    defaultCourseName: entry.defaultCourseName || authDefaultName || null
                };
            });
        } catch (_err) {
            return normalized;
        }
    };

    const normalizeWeeklyStatus = (raw: any): WeeklyUploadStatus => ({
        running: Boolean(raw?.running),
        status: String(raw?.status || 'idle'),
        runMode: String(raw?.runMode || 'standard'),
        stopRequested: Boolean(raw?.stopRequested),
        isStalled: Boolean(raw?.isStalled),
        currentCourseElapsedSeconds: Number(raw?.currentCourseElapsedSeconds || 0),
        startedAt: raw?.startedAt || null,
        finishedAt: raw?.finishedAt || null,
        totalCourses: Number(raw?.totalCourses || 0),
        processedCourses: Number(raw?.processedCourses || 0),
        currentCourse: String(raw?.currentCourse || ''),
        currentCode: String(raw?.currentCode || ''),
        loopEvents: Boolean(raw?.loopEvents),
        loadHistory: Boolean(raw?.loadHistory),
        parkrunName: String(raw?.parkrunName || ''),
        sqlPipelineOptions: raw?.sqlPipelineOptions || undefined,
        previousSqlRun: (raw?.previousSqlRun || null) as WeeklySqlRunSummary | null,
        error: raw?.error || null,
        logs: Array.isArray(raw?.logs) ? raw.logs : []
    });

    const loadWeeklyStatus = async () => {
        if (!token) return;
        try {
            setWeeklyLoading(true);
            const eventCodeText = String(weeklySqlOptions.eventCode || '').trim();
            const response = await fetchAdminWeeklyUploadStatus(token, {
                startDate: String(weeklySqlOptions.startDate || '').trim() || undefined,
                eventCode: eventCodeText ? Number(eventCodeText) : null,
            });
            const normalized = normalizeWeeklyStatus(response);
            setWeeklyStatus(normalized);
            if (normalized.runMode === 'sqlPipeline' && normalized.sqlPipelineOptions) {
                setWeeklySqlOptions(weeklySqlFormFromStatus(normalized.sqlPipelineOptions));
            }
            setWeeklyError(null);
        } catch (err: any) {
            setWeeklyError(err?.response?.data?.error || 'Unable to load weekly upload status.');
        } finally {
            setWeeklyLoading(false);
        }
    };

    const handleStartWeeklyUpload = async () => {
        if (!token || weeklyStarting || weeklyStatus.running) return;

        try {
            setWeeklyStarting(true);
            setWeeklyError(null);
            await startAdminWeeklyUpload(token, {
                loopEvents: Boolean(weeklyOptions.loopEvents),
                loadHistory: Boolean(weeklyOptions.loadHistory),
                parkrunName: String(weeklyOptions.parkrunName || '').trim() || 'brentwood',
                runMode: 'standard'
            });
            await loadWeeklyStatus();
        } catch (err: any) {
            setWeeklyError(err?.response?.data?.error || 'Unable to start weekly upload.');
        } finally {
            setWeeklyStarting(false);
        }
    };

    const handleStartWeeklySqlPipeline = async () => {
        if (!token || weeklyStarting || weeklyStatus.running) return;

        const startDate = String(weeklySqlOptions.startDate || '').trim() || getCurrentSaturdayIso();
        const eventCodeText = String(weeklySqlOptions.eventCode || '').trim();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
            setWeeklyError('Start date must use YYYY-MM-DD.');
            return;
        }
        if (eventCodeText && !/^\d+$/.test(eventCodeText)) {
            setWeeklyError('Event code must be blank or a whole number.');
            return;
        }

        try {
            setWeeklyStarting(true);
            setWeeklyError(null);
            await startAdminWeeklyUpload(token, {
                runMode: 'sqlPipeline',
                sqlPipelineOptions: {
                    startDate,
                    rebuild: weeklySqlOptions.rebuild,
                    runSqlPipeline: weeklySqlOptions.runSqlPipeline,
                    buildAthletes: weeklySqlOptions.buildAthletes,
                    skipCoeffUpdates: weeklySqlOptions.skipCoeffUpdates,
                    noParkrunPostgres: weeklySqlOptions.noParkrunPostgres,
                    eventCode: eventCodeText ? Number(eventCodeText) : null,
                    scraper: weeklySqlOptions.scraper,
                    allAthletes: weeklySqlOptions.allAthletes,
                    leaveAthletePostgres: weeklySqlOptions.leaveAthletePostgres,
                    noVolunteers: weeklySqlOptions.noVolunteers,
                    refreshMaterializedView: weeklySqlOptions.refreshMaterializedView,
                    rebuildHistoricAfterRun: weeklySqlOptions.rebuildHistoricAfterRun,
                    resumeCurveFromAllHistory: weeklySqlOptions.resumeCurveFromAllHistory,
                    forceFreshStart: weeklySqlOptions.forceFreshStart
                }
            });
            await loadWeeklyStatus();
        } catch (err: any) {
            setWeeklyError(err?.response?.data?.error || err?.message || 'Unable to start weekly SQL pipeline.');
        } finally {
            setWeeklyStarting(false);
        }
    };

    const handleStopWeeklyUpload = async () => {
        if (!token || weeklyStopping || !weeklyStatus.running || weeklyStatus.runMode !== 'standard') return;

        try {
            setWeeklyStopping(true);
            setWeeklyError(null);
            await stopAdminWeeklyUpload(token);
            await loadWeeklyStatus();
        } catch (err: any) {
            setWeeklyError(err?.response?.data?.error || err?.message || 'Unable to stop weekly upload.');
        } finally {
            setWeeklyStopping(false);
        }
    };

    const handleResetWeeklyRunState = async () => {
        if (!token || weeklyResetting || !weeklyStatus.running || weeklyStatus.runMode !== 'sqlPipeline') return;

        try {
            setWeeklyResetting(true);
            setWeeklyError(null);
            await resetAdminWeeklyUpload(token);
            await loadWeeklyStatus();
        } catch (err: any) {
            setWeeklyError(err?.response?.data?.error || err?.message || 'Unable to reset weekly SQL pipeline state.');
        } finally {
            setWeeklyResetting(false);
        }
    };

    const selectedDeleteCourse = useMemo(() => {
        return courseOptions.find((option) => option.eventCode === weeklyDeleteCourseCode) || null;
    }, [courseOptions, weeklyDeleteCourseCode]);

    const weeklyPipelineProgress = useMemo(() => {
        const logs = Array.isArray(weeklyStatus.logs) ? weeklyStatus.logs : [];
        const previousCompletedStageIds = new Set(Array.isArray(weeklyStatus.previousSqlRun?.completedStageIds) ? weeklyStatus.previousSqlRun?.completedStageIds : []);
        const previousStageCompletedAt = weeklyStatus.previousSqlRun?.stageCompletedAt || {};
        const isSqlPipeline = weeklyStatus.runMode === 'sqlPipeline' || logs.some((entry) => String(entry?.message || '').toLowerCase().includes('weekly sql pipeline'));
        const stages = WEEKLY_SQL_PROGRESS_STAGES.map((stage) => {
            const startedEntry = findWeeklyLogEntry(logs, stage.startPatterns);
            const completedEntry = findWeeklyLogEntry(logs, stage.completePatterns, true);
            const latestEntry = findWeeklyLogEntry(logs, [...stage.completePatterns, ...stage.startPatterns], true);
            return {
                ...stage,
                startedEntry,
                completedEntry,
                latestEntry,
                previousCompletedAt: String(previousStageCompletedAt[stage.id] || ''),
                wasPreviouslyComplete: previousCompletedStageIds.has(stage.id)
            };
        });

        const lastCompletedIndex = stages.reduce((highest, stage, index) => (stage.completedEntry ? index : highest), -1);
        const failureIndex = weeklyStatus.status === 'failed'
            ? Math.min(lastCompletedIndex + 1, stages.length - 1)
            : -1;

        return stages.map((stage, index) => {
            let status: WeeklyPipelineStageStatus = 'pending';
            if (stage.completedEntry) {
                status = 'complete';
            } else if (failureIndex === index) {
                status = 'failed';
            } else if (isSqlPipeline && weeklyStatus.running && index === Math.min(lastCompletedIndex + 1, stages.length - 1) && logs.length > 0) {
                status = 'running';
            }

            return {
                ...stage,
                status,
                isSqlPipeline
            };
        });
    }, [weeklyStatus.logs, weeklyStatus.previousSqlRun, weeklyStatus.runMode, weeklyStatus.running, weeklyStatus.status]);

    const openWeeklyDeleteConfirm = () => {
        const startDate = String(weeklySqlOptions.startDate || '').trim();
        if (!startDate) {
            setWeeklyError('Select a start date before deleting uploaded data.');
            return;
        }
        if (!selectedDeleteCourse) {
            setWeeklyError('Select a course to delete uploaded data for.');
            return;
        }
        setWeeklyError(null);
        setWeeklyDeleteConfirm({
            eventCode: selectedDeleteCourse.eventCode,
            eventName: selectedDeleteCourse.eventName,
            startDate
        });
    };

    const handleDeleteUploadedEvent = async () => {
        if (!token || !weeklyDeleteConfirm || weeklyDeletePending) return;

        try {
            setWeeklyDeletePending(true);
            setWeeklyError(null);
            const response: WeeklyDeleteEventResponse = await deleteAdminWeeklyUploadEvent(token, {
                eventCode: weeklyDeleteConfirm.eventCode,
                eventName: weeklyDeleteConfirm.eventName,
                startDate: weeklyDeleteConfirm.startDate
            });
            if (response.state) {
                setWeeklyStatus(normalizeWeeklyStatus(response.state));
            } else {
                await loadWeeklyStatus();
            }
            setWeeklyDeleteConfirm(null);
        } catch (err: any) {
            setWeeklyError(err?.response?.data?.error || err?.message || 'Unable to delete uploaded event data.');
        } finally {
            setWeeklyDeletePending(false);
        }
    };

    const runBackendCheck = async () => {
        setSystemChecks((prev) => ({ ...prev, backend: 'running', message: '' }));
        try {
            const response = await fetch(`${API_BASE_URL}/`, { method: 'GET' });
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            setSystemChecks((prev) => ({ ...prev, backend: 'ok', message: 'Backend reachable.' }));
        } catch (err: any) {
            setSystemChecks((prev) => ({ ...prev, backend: 'error', message: `Backend check failed: ${err?.message || 'unknown error'}` }));
        }
    };

    const runWeeklyApiCheck = async () => {
        if (!token) {
            setSystemChecks((prev) => ({ ...prev, weeklyApi: 'error', message: 'No auth token available.' }));
            return;
        }

        setSystemChecks((prev) => ({ ...prev, weeklyApi: 'running', message: '' }));
        try {
            await fetchAdminWeeklyUploadStatus(token);
            setSystemChecks((prev) => ({ ...prev, weeklyApi: 'ok', message: 'Weekly upload API reachable.' }));
        } catch (err: any) {
            setSystemChecks((prev) => ({ ...prev, weeklyApi: 'error', message: `Weekly upload API failed: ${err?.response?.data?.error || err?.message || 'unknown error'}` }));
        }
    };

    const runAllSystemChecks = async () => {
        await runBackendCheck();
        await runWeeklyApiCheck();
    };

    const loadData = async () => {
        if (!token) {
            setCanAccess(false);
            setError('Missing login session.');
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            setError(null);
            const status = await fetchAdminStatus(token);
            setCanAccess(Boolean(status.canAccessAdmin));
            setBootstrapOpen(Boolean(status.bootstrapOpen));
            setAdminCount(Number(status.adminCount || 0));

            if (!status.canAccessAdmin) {
                setUsers([]);
                return;
            }

            const response = await fetchAdminUsers(token);
            setUsers(normalizeAdminUsers(response.users));
            const options = await fetchEventOptions();
            setCourseOptions(Array.isArray(options) ? options : []);
            setAdminCount(Number(response.adminCount || 0));
            setBootstrapOpen(Boolean(response.bootstrapOpen));
        } catch (err: any) {
            if (err?.response?.status === 401) {
                resetToLogin('Your session is no longer valid for the main API. Please log in again.');
                return;
            }

            const cachedUser = getCachedAuthUser();
            const cachedIsAdmin = Boolean(cachedUser?.isAdmin ?? cachedUser?.is_admin);

            if (cachedIsAdmin) {
                // Keep admins unblocked in the UI when admin status endpoint is temporarily unavailable.
                setCanAccess(true);
                setError(err?.response?.data?.error || 'Admin checks API unavailable. Using cached admin session.');
            } else {
                setCanAccess(false);
                setError(err?.response?.data?.error || 'Unable to load admin data.');
            }
        } finally {
            setLoading(false);
        }
    };

    const loadActivity = async () => {
        if (!token) return;
        try {
            setActivityLoading(true);
            setError(null);
            const response = await fetchAdminActivity(token, 5000, oneMonthStartIso);
            setActivity(Array.isArray(response.activity) ? response.activity : []);
        } catch (err: any) {
            if (err?.response?.status === 401) {
                resetToLogin('Your session is no longer valid for the main API. Please log in again.');
                return;
            }
            setError(err?.response?.data?.error || 'Unable to load activity.');
        } finally {
            setActivityLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (!canAccess || section !== 'activity') {
            return;
        }
        loadActivity();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [canAccess, oneMonthStartIso, section]);

    useEffect(() => {
        if (!canAccess || section !== 'weekly-upload') {
            return;
        }

        loadWeeklyStatus();
        const timer = window.setInterval(() => {
            loadWeeklyStatus();
        }, 2000);

        return () => {
            window.clearInterval(timer);
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [canAccess, section, weeklySqlOptions.startDate, weeklySqlOptions.eventCode]);

    useEffect(() => {
        if (section !== 'weekly-upload') return;
        if (!weeklyLogRef.current) return;
        weeklyLogRef.current.scrollTop = weeklyLogRef.current.scrollHeight;
    }, [section, weeklyStatus.logs.length]);

    const onUserFilterChange = (field: keyof UserFilters, value: string) => {
        setUserFilters((prev) => ({ ...prev, [field]: value }));
    };

    const onActivityFilterChange = (field: keyof ActivityFilters, value: string) => {
        setActivityFilters((prev) => ({ ...prev, [field]: value }));
    };

    const clearUserFilter = (field: keyof UserFilters) => {
        setUserFilters((prev) => ({ ...prev, [field]: '' }));
    };

    const clearActivityFilter = (field: keyof ActivityFilters) => {
        setActivityFilters((prev) => ({ ...prev, [field]: '' }));
    };

    const getActivityColumns = (row: AdminActivityRecord) => {
        const detail = row.activityType === 'page_visit'
            ? (row.pagePath || 'Page visit')
            : `Login${row.provider ? ` (${row.provider})` : ''}${row.success === false ? ' failed' : ' success'}`;
        const pageTime = row.durationMs != null ? formatDurationTotalMinutes(Number(row.durationMs || 0)) : '';
        const referrerRaw = String(row.referrerPath || '').trim();
        const from = referrerRaw ? `from ${referrerRaw}` : '';
        const device = row.userAgent || (row.ipAddress ? `IP ${row.ipAddress}` : '');

        return { detail, pageTime, from, device };
    };

    const selectedDetailColumns = useMemo(() => {
        if (!selectedDetailRow) return null;
        return getActivityColumns(selectedDetailRow);
    }, [selectedDetailRow]);

    const selectedDetailDeviceCapture = useMemo(() => {
        if (!selectedDetailRow) return [] as Array<{ label: string; value: string }>;

        const inferredDevice = inferDeviceLabel(selectedDetailRow.userAgent);
        const userAgent = String(selectedDetailRow.userAgent || '').trim() || '—';
        const ipAddress = String(selectedDetailRow.ipAddress || '').trim() || '—';
        const referrerPath = String(selectedDetailRow.referrerPath || '').trim() || '—';
        const provider = String(selectedDetailRow.provider || '').trim() || '—';
        const activityType = String(selectedDetailRow.activityType || '').trim() || '—';
        const success = selectedDetailRow.success == null
            ? '—'
            : (selectedDetailRow.success ? 'true' : 'false');
        const durationMs = selectedDetailRow.durationMs == null
            ? '—'
            : `${Math.max(0, Number(selectedDetailRow.durationMs || 0))} ms`;

        return [
            { label: 'Inferred device', value: inferredDevice },
            { label: 'User agent', value: userAgent },
            { label: 'IP address', value: ipAddress },
            { label: 'Referrer path', value: referrerPath },
            { label: 'Provider', value: provider },
            { label: 'Activity type', value: activityType },
            { label: 'Success', value: success },
            { label: 'Duration (raw)', value: durationMs }
        ];
    }, [selectedDetailRow]);

    const filteredUsers = useMemo(() => users.filter((row) => (
        matchesSqlLike(row.email || '', userFilters.email)
        && matchesSqlLike(row.displayName || '', userFilters.name)
        && matchesSqlLike(row.athleteCode || '', userFilters.athlete)
        && matchesSqlLike(formatDateTime(row.createdAt), userFilters.created)
        && matchesSqlLike(formatDateTime(row.lastLoginAt), userFilters.lastLogin)
        && matchesSqlLike(row.isAdmin ? 'yes' : 'no', userFilters.admin)
    )), [users, userFilters]);

    const windowedActivity = useMemo(() => activity.filter((row) => {
        const activityAtMs = new Date(row.activityAt || '').getTime();
        const windowStartMs = new Date(oneMonthStartIso).getTime();
        if (Number.isFinite(activityAtMs) && Number.isFinite(windowStartMs) && activityAtMs < windowStartMs) {
            return false;
        }
        return true;
    }), [activity, oneMonthStartIso]);

    const aggregatedRows = useMemo<ActivitySummaryRow[]>(() => {
        const buckets = new Map<string, ActivitySummaryRow>();

        for (const row of windowedActivity) {
            const day = formatDay(row.activityAt);
            const person = row.displayName || row.email || 'Unknown';
            const device = inferDeviceLabel(row.userAgent);
            const type = String(row.activityType || 'unknown');
            const typeVisit = getTypeVisitLabel(row);
            const id = [day, person, device, type, typeVisit].join('|');

            if (!buckets.has(id)) {
                buckets.set(id, {
                    id,
                    day,
                    person,
                    device,
                    type,
                    typeVisit,
                    hitCount: 0,
                    totalDurationMs: 0,
                    rows: []
                });
            }

            const bucket = buckets.get(id)!;
            bucket.hitCount += 1;
            bucket.totalDurationMs += Number(row.durationMs || 0);
            bucket.rows.push(row);
        }

        const sorted = Array.from(buckets.values()).sort((a, b) => {
            if (a.day !== b.day) return b.day.localeCompare(a.day);
            if (a.person !== b.person) return a.person.localeCompare(b.person);
            if (a.device !== b.device) return a.device.localeCompare(b.device);
            if (a.type !== b.type) return a.type.localeCompare(b.type);
            return a.typeVisit.localeCompare(b.typeVisit);
        });

        for (const row of sorted) {
            row.rows.sort((a, b) => {
                const left = new Date(a.activityAt || '').getTime();
                const right = new Date(b.activityAt || '').getTime();
                return (Number.isFinite(left) ? left : 0) - (Number.isFinite(right) ? right : 0);
            });
        }

        return sorted;
    }, [windowedActivity]);

    const filteredAggregatedRows = useMemo(() => {
        return aggregatedRows.filter((row) => (
            matchesSqlLike(row.day, activityFilters.day)
            && matchesSqlLike(row.person, activityFilters.person)
            && matchesSqlLike(row.device, activityFilters.device)
            && matchesSqlLike(row.type, activityFilters.type)
            && matchesSqlLike(row.typeVisit, activityFilters.typeVisit)
            && matchesSqlLike(String(row.hitCount), activityFilters.hits)
            && matchesSqlLike(formatDurationTotalMinutes(row.totalDurationMs), activityFilters.minutes)
        ));
    }, [activityFilters.day, activityFilters.device, activityFilters.hits, activityFilters.minutes, activityFilters.person, activityFilters.type, activityFilters.typeVisit, aggregatedRows]);

    const selectedSummaryTitle = useMemo(() => {
        if (!selectedSummaryRow) return '';

        const summarizeUnique = (values: string[]) => {
            const unique = Array.from(new Set(values.map((item) => String(item || '').trim() || 'unknown')));
            return unique.length === 1 ? unique[0] : 'All';
        };

        const dateValue = summarizeUnique(selectedSummaryRow.rows.map((row) => formatDay(row.activityAt)));
        const userValue = summarizeUnique(selectedSummaryRow.rows.map((row) => row.displayName || row.email || 'Unknown'));
        const typeValue = summarizeUnique(selectedSummaryRow.rows.map((row) => String(row.activityType || 'unknown')));
        const deviceValue = summarizeUnique(selectedSummaryRow.rows.map((row) => inferDeviceLabel(row.userAgent)));
        const typeVisitValue = summarizeUnique(selectedSummaryRow.rows.map((row) => getTypeVisitLabel(row)));

        return `Date: ${dateValue}; User: ${userValue}; Type: ${typeValue}; Device: ${deviceValue}; type-visit: ${typeVisitValue}`;
    }, [selectedSummaryRow]);

    const handleAdminToggle = async (row: AdminUser, checked: boolean) => {
        if (!token || savingUserId !== null) {
            return;
        }
        try {
            setSavingUserId(row.id);
            setError(null);
            const response = await setAdminUserFlag(token, row.id, checked);
            const updatedUser = response?.user;
            setUsers((prev) => prev.map((entry) => (entry.id === row.id ? { ...entry, isAdmin: Boolean(updatedUser?.isAdmin ?? checked) } : entry)));
            setAdminCount(Number(response.adminCount || 0));
            setBootstrapOpen(Boolean(response.bootstrapOpen));

            try {
                const raw = localStorage.getItem(AUTH_USER_KEY);
                if (raw) {
                    const currentUser = JSON.parse(raw) || {};
                    if (Number(currentUser.id) === Number(row.id)) {
                        localStorage.setItem(AUTH_USER_KEY, JSON.stringify({
                            ...currentUser,
                            isAdmin: Boolean(updatedUser?.isAdmin ?? checked)
                        }));
                    }
                }
            } catch (_err) {
                // ignore local storage parsing errors
            }
        } catch (err: any) {
            setError(err?.response?.data?.error || 'Unable to update admin flag.');
        } finally {
            setSavingUserId(null);
        }
    };

    const handleDefaultCourseChange = async (row: AdminUser, nextCode: string) => {
        if (!token || savingCourseUserId !== null) {
            return;
        }
        const syntheticNamePrefix = '__name__:';
        const isSyntheticName = nextCode.startsWith(syntheticNamePrefix);
        const selectedName = isSyntheticName ? nextCode.slice(syntheticNamePrefix.length) : undefined;
        const selected = courseOptions.find((opt) => opt.eventCode === nextCode);
        try {
            setSavingCourseUserId(row.id);
            setError(null);
            const response = await setAdminUserDefaultCourse(
                token,
                row.id,
                isSyntheticName ? undefined : (nextCode || undefined),
                selected?.eventName || selectedName || undefined
            );
            const updated = response?.user;
            setUsers((prev) => prev.map((entry) => (
                entry.id === row.id
                    ? {
                        ...entry,
                        defaultCourseCode: String(updated?.defaultCourseCode || ''),
                        defaultCourseName: String(updated?.defaultCourseName || '')
                    }
                    : entry
            )));
        } catch (err: any) {
            setError(err?.response?.data?.error || 'Unable to update default course.');
        } finally {
            setSavingCourseUserId(null);
        }
    };

    if (loading) {
        return <div className="page-content admin-page"><div className="admin-status">Loading admin panel...</div></div>;
    }

    if (!canAccess) {
        return <div className="page-content admin-page"><div className="admin-status">Admin page is restricted to admins.</div></div>;
    }

    return (
        <div className="page-content admin-page">
            <div className="admin-shell">
                <aside className="admin-sidebar">
                    <button
                        type="button"
                        className={section === 'admin-setup' ? 'admin-nav-btn active' : 'admin-nav-btn'}
                        onClick={() => setSection('admin-setup')}
                    >
                        Admin Set-up
                    </button>
                    <button
                        type="button"
                        className={section === 'activity' ? 'admin-nav-btn active' : 'admin-nav-btn'}
                        onClick={() => setSection('activity')}
                    >
                        Activity
                    </button>
                    <button
                        type="button"
                        className={section === 'weekly-upload' ? 'admin-nav-btn active' : 'admin-nav-btn'}
                        onClick={() => setSection('weekly-upload')}
                    >
                        Weekly Upload
                    </button>
                </aside>

                <section className="admin-main">
                    {section === 'admin-setup' ? (
                        <>
                            <h2>Admin Set-up</h2>
                            <div className="admin-meta">
                                <span>Admins: {adminCount}</span>
                                <span>{bootstrapOpen ? 'Bootstrap mode: open to all logged-in users' : 'Admin mode: restricted to admins'}</span>
                            </div>

                            {error && <div className="admin-error">{error}</div>}

                            <div className="admin-table-wrap">
                                <table className="admin-table">
                                    <thead>
                                        <tr>
                                            <th>Email</th>
                                            <th>Name</th>
                                            <th>Athlete</th>
                                            <th>Default Course</th>
                                            <th>Created</th>
                                            <th>Last Login</th>
                                            <th>Admin</th>
                                        </tr>
                                        <tr className="admin-filter-row">
                                            <th>
                                                <div className="admin-filter-cell">
                                                    <input className="admin-filter-input" value={userFilters.email} onChange={(e) => onUserFilterChange('email', e.target.value)} />
                                                    {userFilters.email && <button type="button" className="admin-filter-clear" onClick={() => clearUserFilter('email')}>x</button>}
                                                </div>
                                            </th>
                                            <th>
                                                <div className="admin-filter-cell">
                                                    <input className="admin-filter-input" value={userFilters.name} onChange={(e) => onUserFilterChange('name', e.target.value)} />
                                                    {userFilters.name && <button type="button" className="admin-filter-clear" onClick={() => clearUserFilter('name')}>x</button>}
                                                </div>
                                            </th>
                                            <th>
                                                <div className="admin-filter-cell">
                                                    <input className="admin-filter-input" value={userFilters.athlete} onChange={(e) => onUserFilterChange('athlete', e.target.value)} />
                                                    {userFilters.athlete && <button type="button" className="admin-filter-clear" onClick={() => clearUserFilter('athlete')}>x</button>}
                                                </div>
                                            </th>
                                            <th>
                                                <div className="admin-filter-cell" style={{ justifyContent: 'center' }}>
                                                    <span style={{ color: '#64748b', fontSize: '0.75rem' }}>select</span>
                                                </div>
                                            </th>
                                            <th>
                                                <div className="admin-filter-cell">
                                                    <input className="admin-filter-input" value={userFilters.created} onChange={(e) => onUserFilterChange('created', e.target.value)} />
                                                    {userFilters.created && <button type="button" className="admin-filter-clear" onClick={() => clearUserFilter('created')}>x</button>}
                                                </div>
                                            </th>
                                            <th>
                                                <div className="admin-filter-cell">
                                                    <input className="admin-filter-input" value={userFilters.lastLogin} onChange={(e) => onUserFilterChange('lastLogin', e.target.value)} />
                                                    {userFilters.lastLogin && <button type="button" className="admin-filter-clear" onClick={() => clearUserFilter('lastLogin')}>x</button>}
                                                </div>
                                            </th>
                                            <th>
                                                <div className="admin-filter-cell">
                                                    <input className="admin-filter-input" value={userFilters.admin} onChange={(e) => onUserFilterChange('admin', e.target.value)} />
                                                    {userFilters.admin && <button type="button" className="admin-filter-clear" onClick={() => clearUserFilter('admin')}>x</button>}
                                                </div>
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredUsers.length === 0 ? (
                                            <tr>
                                                <td colSpan={7} className="admin-empty">No matching users found.</td>
                                            </tr>
                                        ) : filteredUsers.map((row) => (
                                            <tr key={row.id}>
                                                <td>{row.email}</td>
                                                <td>{row.displayName || '—'}</td>
                                                <td>{row.athleteCode || '—'}</td>
                                                <td>
                                                    {(() => {
                                                        const currentCode = String(row.defaultCourseCode || '').trim();
                                                        const currentName = String(row.defaultCourseName || '').trim();
                                                        const syntheticNameValue = currentName ? `__name__:${currentName}` : '';
                                                        const hasCodeOption = currentCode
                                                            ? courseOptions.some((opt) => opt.eventCode === currentCode)
                                                            : false;
                                                        const hasNameOption = currentName
                                                            ? courseOptions.some((opt) => opt.eventName.toLowerCase() === currentName.toLowerCase())
                                                            : false;
                                                        const currentValue = currentCode
                                                            ? currentCode
                                                            : (currentName ? syntheticNameValue : '');

                                                        return (
                                                    <select
                                                        value={currentValue}
                                                        onChange={(event) => handleDefaultCourseChange(row, event.target.value)}
                                                        disabled={savingCourseUserId === row.id}
                                                        style={{ width: '100%', minWidth: 180 }}
                                                        aria-label={`Default course for ${row.email}`}
                                                    >
                                                        <option value="">Not set</option>
                                                        {currentCode && !hasCodeOption && (
                                                            <option value={currentCode}>{currentName || `Course ${currentCode}`} ({currentCode})</option>
                                                        )}
                                                        {!currentCode && currentName && !hasNameOption && (
                                                            <option value={syntheticNameValue}>{currentName}</option>
                                                        )}
                                                        {courseOptions.map((opt) => (
                                                            <option key={opt.eventCode} value={opt.eventCode}>
                                                                {opt.eventName} ({opt.eventCode})
                                                            </option>
                                                        ))}
                                                    </select>
                                                        );
                                                    })()}
                                                </td>
                                                <td>{formatDateTime(row.createdAt)}</td>
                                                <td>{formatDateTime(row.lastLoginAt)}</td>
                                                <td>
                                                    <input
                                                        type="checkbox"
                                                        checked={Boolean(row.isAdmin)}
                                                        disabled={savingUserId === row.id}
                                                        onChange={(event) => handleAdminToggle(row, event.target.checked)}
                                                        aria-label={`Set admin for ${row.email}`}
                                                    />
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    ) : section === 'activity' ? (
                        <>
                            <h2>Activity</h2>
                            <div className="admin-meta">
                                <span>Rolling log</span>
                                <span>Showing at least one month (from start of previous month)</span>
                            </div>

                            <div className="admin-activity-filter-inline">
                                <input className="admin-filter-input" placeholder="day" value={activityFilters.day} onChange={(e) => onActivityFilterChange('day', e.target.value)} />
                                <input className="admin-filter-input" placeholder="person" value={activityFilters.person} onChange={(e) => onActivityFilterChange('person', e.target.value)} />
                                <input className="admin-filter-input" placeholder="device" value={activityFilters.device} onChange={(e) => onActivityFilterChange('device', e.target.value)} />
                                <input className="admin-filter-input" placeholder="type" value={activityFilters.type} onChange={(e) => onActivityFilterChange('type', e.target.value)} />
                                <input className="admin-filter-input" placeholder="type-visit" value={activityFilters.typeVisit} onChange={(e) => onActivityFilterChange('typeVisit', e.target.value)} />
                                <input className="admin-filter-input" placeholder="total hits" value={activityFilters.hits} onChange={(e) => onActivityFilterChange('hits', e.target.value)} />
                                <input className="admin-filter-input" placeholder="total minutes" value={activityFilters.minutes} onChange={(e) => onActivityFilterChange('minutes', e.target.value)} />
                            </div>

                            {error && <div className="admin-error">{error}</div>}

                            <div className="admin-table-wrap">
                                <table className="admin-table admin-activity-summary-table">
                                    <thead>
                                        <tr>
                                            <th>Day</th>
                                            <th>Person</th>
                                            <th>Device</th>
                                            <th>Type</th>
                                            <th>Type-visit</th>
                                            <th>Total Hits</th>
                                            <th>Total Minutes</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {activityLoading ? (
                                            <tr>
                                                <td colSpan={7} className="admin-empty">Loading activity...</td>
                                            </tr>
                                        ) : filteredAggregatedRows.length === 0 ? (
                                            <tr>
                                                <td colSpan={7} className="admin-empty">No matching activity found.</td>
                                            </tr>
                                        ) : filteredAggregatedRows.map((row) => (
                                            <tr
                                                key={row.id}
                                                className="admin-summary-row"
                                                onClick={() => setSelectedSummaryRow(row)}
                                                role="button"
                                                tabIndex={0}
                                                onKeyDown={(event) => {
                                                    if (event.key === 'Enter' || event.key === ' ') {
                                                        event.preventDefault();
                                                        setSelectedSummaryRow(row);
                                                    }
                                                }}
                                                aria-label={`Open details for ${row.day} ${row.person} ${row.typeVisit}`}
                                            >
                                                <td title={row.day}>{row.day}</td>
                                                <td title={row.person}>{row.person}</td>
                                                <td title={row.device}>{row.device}</td>
                                                <td title={row.type}>{row.type}</td>
                                                <td title={row.typeVisit}>{row.typeVisit}</td>
                                                <td>{row.hitCount}</td>
                                                <td>{formatDurationTotalMinutes(row.totalDurationMs)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {selectedSummaryRow && (
                                <div className="admin-activity-modal-backdrop" onMouseDown={(event) => {
                                    if (event.target === event.currentTarget) {
                                        setSelectedDetailRow(null);
                                        setSelectedSummaryRow(null);
                                    }
                                }}>
                                    <div className="admin-activity-modal" role="dialog" aria-modal="true" aria-label="Activity detail">
                                        <div className="admin-activity-modal-head">
                                            <strong>{selectedSummaryTitle}</strong>
                                            <button
                                                type="button"
                                                className="admin-activity-modal-close"
                                                onClick={() => {
                                                    setSelectedDetailRow(null);
                                                    setSelectedSummaryRow(null);
                                                }}
                                                aria-label="Close detail"
                                            >
                                                x
                                            </button>
                                        </div>
                                        <div className="admin-table-wrap admin-activity-modal-table-wrap">
                                            <table className="admin-table admin-activity-detail-table">
                                                <thead>
                                                    <tr>
                                                        <th>Time</th>
                                                        <th>Detail</th>
                                                        <th>Page Time</th>
                                                        <th>from</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {selectedSummaryRow.rows.length === 0 ? (
                                                        <tr>
                                                            <td colSpan={4} className="admin-empty">No detail rows found.</td>
                                                        </tr>
                                                    ) : selectedSummaryRow.rows.map((row, idx) => {
                                                        const columns = getActivityColumns(row);
                                                        return (
                                                            <tr
                                                                key={`${selectedSummaryRow.id}-${idx}`}
                                                                className="admin-detail-row"
                                                                onClick={() => setSelectedDetailRow(row)}
                                                                role="button"
                                                                tabIndex={0}
                                                                onKeyDown={(event) => {
                                                                    if (event.key === 'Enter' || event.key === ' ') {
                                                                        event.preventDefault();
                                                                        setSelectedDetailRow(row);
                                                                    }
                                                                }}
                                                                aria-label={`Open full detail for ${formatDateTime(row.activityAt)}`}
                                                            >
                                                                <td title={formatDateTime(row.activityAt)}>{formatDateTime(row.activityAt)}</td>
                                                                <td title={columns.detail}>{columns.detail}</td>
                                                                <td title={columns.pageTime || '—'}>{columns.pageTime || '—'}</td>
                                                                <td title={columns.from || '—'}>{columns.from || '—'}</td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {selectedDetailRow && selectedDetailColumns && (
                                <div className="admin-activity-modal-backdrop admin-activity-submodal-backdrop" onMouseDown={(event) => {
                                    if (event.target === event.currentTarget) {
                                        setSelectedDetailRow(null);
                                    }
                                }}>
                                    <div className="admin-activity-modal admin-activity-submodal" role="dialog" aria-modal="true" aria-label="Full activity detail">
                                        <div className="admin-activity-modal-head">
                                            <strong>Full Detail and Device Capture</strong>
                                            <button type="button" className="admin-activity-modal-close" onClick={() => setSelectedDetailRow(null)} aria-label="Close full detail">x</button>
                                        </div>
                                        <div className="admin-activity-submodal-content">
                                            <div className="admin-activity-submodal-section">
                                                <h3>Full detail</h3>
                                                <div className="admin-activity-full-detail-box" title={selectedDetailColumns.detail}>{selectedDetailColumns.detail || '—'}</div>
                                            </div>

                                            <div className="admin-activity-submodal-section">
                                                <h3>Detailed device capture</h3>
                                                <div className="admin-activity-device-grid">
                                                    {selectedDetailDeviceCapture.map((item) => (
                                                        <React.Fragment key={item.label}>
                                                            <div className="admin-activity-device-label">{item.label}</div>
                                                            <div className="admin-activity-device-value" title={item.value}>{item.value}</div>
                                                        </React.Fragment>
                                                    ))}
                                                </div>
                                            </div>

                                            <div className="admin-activity-submodal-section">
                                                <h3>Record context</h3>
                                                <div className="admin-activity-device-grid">
                                                    <div className="admin-activity-device-label">Time</div>
                                                    <div className="admin-activity-device-value">{formatDateTime(selectedDetailRow.activityAt)}</div>
                                                    <div className="admin-activity-device-label">Page time</div>
                                                    <div className="admin-activity-device-value">{selectedDetailColumns.pageTime || '—'}</div>
                                                    <div className="admin-activity-device-label">From</div>
                                                    <div className="admin-activity-device-value" title={selectedDetailColumns.from || '—'}>{selectedDetailColumns.from || '—'}</div>
                                                    <div className="admin-activity-device-label">Raw device</div>
                                                    <div className="admin-activity-device-value" title={selectedDetailColumns.device || '—'}>{selectedDetailColumns.device || '—'}</div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="admin-weekly-layout">
                            <div className="admin-weekly-top">
                                <h2>Weekly Upload</h2>
                                <div className="admin-meta">
                                    <span>Status: {weeklyStatus.status || 'idle'}</span>
                                    <span>Mode: {weeklyStatus.runMode || 'standard'}</span>
                                    <span>
                                        Progress: {weeklyStatus.processedCourses || 0}/{weeklyStatus.totalCourses || 0}
                                    </span>
                                </div>

                                <div className="admin-weekly-checks-row">
                                    <div className="admin-system-checks">
                                        <div className="admin-system-checks-head">
                                            <strong>System Checks</strong>
                                            <span className="admin-system-checks-api">API: {API_BASE_URL}</span>
                                        </div>
                                        <div className="admin-system-checks-actions">
                                            <button type="button" className="admin-weekly-refresh" onClick={runBackendCheck}>Check Backend</button>
                                            <button type="button" className="admin-weekly-refresh" onClick={runWeeklyApiCheck}>Check Weekly API</button>
                                            <button type="button" className="admin-weekly-refresh" onClick={runAllSystemChecks}>Run All Checks</button>
                                        </div>
                                        <div className="admin-system-checks-results">
                                            <span className={`admin-check-pill ${systemChecks.backend}`}>Backend: {systemChecks.backend}</span>
                                            <span className={`admin-check-pill ${systemChecks.weeklyApi}`}>Weekly API: {systemChecks.weeklyApi}</span>
                                        </div>
                                        {systemChecks.message && <div className="admin-system-checks-message">{systemChecks.message}</div>}

                                        <div className="admin-weekly-controls admin-weekly-controls-inline">
                                            <label className="admin-weekly-check">
                                                <input
                                                    type="checkbox"
                                                    checked={weeklyOptions.loopEvents}
                                                    onChange={(event) => setWeeklyOptions((prev) => ({ ...prev, loopEvents: event.target.checked }))}
                                                    disabled={weeklyStatus.running || weeklyStarting}
                                                />
                                                Loop Events
                                            </label>

                                            <label className="admin-weekly-check">
                                                <input
                                                    type="checkbox"
                                                    checked={weeklyOptions.loadHistory}
                                                    onChange={(event) => setWeeklyOptions((prev) => ({ ...prev, loadHistory: event.target.checked }))}
                                                    disabled={weeklyStatus.running || weeklyStarting}
                                                />
                                                Load History
                                            </label>

                                            <label className="admin-weekly-name-wrap">
                                                Parkrun name:
                                                <input
                                                    className="admin-filter-input admin-weekly-name"
                                                    value={weeklyOptions.parkrunName}
                                                    onChange={(event) => setWeeklyOptions((prev) => ({ ...prev, parkrunName: event.target.value }))}
                                                    disabled={weeklyStatus.running || weeklyStarting || weeklyOptions.loopEvents}
                                                />
                                            </label>

                                            <button
                                                type="button"
                                                className="admin-weekly-start"
                                                onClick={handleStartWeeklyUpload}
                                                disabled={weeklyStatus.running || weeklyStarting}
                                            >
                                                {weeklyStatus.running ? 'Running...' : (weeklyStarting ? 'Starting...' : 'Start Weekly Upload')}
                                            </button>

                                            <button
                                                type="button"
                                                className="admin-weekly-start"
                                                onClick={handleStartWeeklySqlPipeline}
                                                disabled={weeklyStatus.running || weeklyStarting}
                                            >
                                                {weeklyStatus.running ? 'Running...' : (weeklyStarting ? 'Starting...' : 'Run Weekly SQL Pipeline')}
                                            </button>

                                            <button
                                                type="button"
                                                className="admin-weekly-stop"
                                                onClick={handleStopWeeklyUpload}
                                                disabled={!weeklyStatus.running || weeklyStatus.runMode !== 'standard' || weeklyStopping || Boolean(weeklyStatus.stopRequested)}
                                            >
                                                {weeklyStatus.stopRequested ? 'Stopping...' : (weeklyStopping ? 'Stopping...' : 'Stop Weekly Upload')}
                                            </button>

                                            <button
                                                type="button"
                                                className="admin-weekly-reset"
                                                onClick={handleResetWeeklyRunState}
                                                disabled={!weeklyStatus.running || weeklyStatus.runMode !== 'sqlPipeline' || weeklyResetting}
                                            >
                                                {weeklyResetting ? 'Resetting...' : 'Reset SQL Pipeline State'}
                                            </button>

                                            <button type="button" className="admin-weekly-refresh" onClick={loadWeeklyStatus} disabled={weeklyLoading}>
                                                {weeklyLoading ? 'Refreshing...' : 'Refresh'}
                                            </button>
                                        </div>

                                        <div className="admin-weekly-manual-note">
                                            Weekly Upload does not auto-start the SQL pipeline. Review the upload log first, then run the pipeline manually when you are satisfied.
                                        </div>
                                        {!weeklyStatus.running && weeklyStatus.previousSqlRun && weeklyStatus.previousSqlRun.startDate === weeklySqlOptions.startDate && (
                                            <div className="admin-weekly-manual-note admin-weekly-history-note">
                                                Previous SQL run found for this date{weeklyStatus.previousSqlRun.eventCode != null ? ` and event ${weeklyStatus.previousSqlRun.eventCode}` : ''}. Completed stages are shown in light blue below.
                                                {weeklyStatus.previousSqlRun.autoResumeMode === 'allHistory' && !weeklySqlOptions.forceFreshStart && ' A safe resume checkpoint is available from Rebuild All-History Time Reference.'}
                                            </div>
                                        )}
                                        {weeklyStatus.running && weeklyStatus.runMode === 'sqlPipeline' && (
                                            <div className="admin-weekly-manual-note">
                                                Reset SQL Pipeline State releases the Admin lockout and ignores stale worker logs. It does not kill Python in the middle of an active SQL statement.
                                            </div>
                                        )}
                                        {weeklyStatus.running && weeklyStatus.isStalled && weeklyStatus.runMode === 'sqlPipeline' && (
                                            <div className="admin-weekly-manual-note admin-weekly-stalled-note">
                                                Current SQL step has been running for about {Math.max(1, Math.round((weeklyStatus.currentCourseElapsedSeconds || 0) / 60))} minute(s). Use reset only if you are treating this run as hung.
                                            </div>
                                        )}
                                    </div>

                                    <div className="admin-weekly-danger-panel">
                                        <div className="admin-weekly-danger-head">
                                            <strong>Delete Uploaded Event</strong>
                                            <span>Removes the selected course and date from eventpositions and parkrun_events in SQLite and Postgres.</span>
                                        </div>

                                        <div className="admin-weekly-danger-controls">
                                            <label className="admin-weekly-sql-field">
                                                <span>Course</span>
                                                <select
                                                    className="admin-filter-input admin-weekly-delete-select"
                                                    value={weeklyDeleteCourseCode}
                                                    onChange={(event) => setWeeklyDeleteCourseCode(event.target.value)}
                                                    disabled={weeklyStatus.running || weeklyDeletePending}
                                                >
                                                    <option value="">Select a course</option>
                                                    {courseOptions.map((option) => (
                                                        <option key={option.eventCode} value={option.eventCode}>
                                                            {option.eventName} ({option.eventCode})
                                                        </option>
                                                    ))}
                                                </select>
                                            </label>

                                            <label className="admin-weekly-sql-field">
                                                <span>Date to delete</span>
                                                <input
                                                    type="date"
                                                    className="admin-filter-input"
                                                    value={weeklySqlOptions.startDate}
                                                    onChange={(event) => setWeeklySqlOptions((prev) => ({ ...prev, startDate: event.target.value }))}
                                                    disabled={weeklyStatus.running || weeklyDeletePending}
                                                />
                                            </label>

                                            <button
                                                type="button"
                                                className="admin-weekly-danger-button"
                                                onClick={openWeeklyDeleteConfirm}
                                                disabled={weeklyStatus.running || weeklyDeletePending || !weeklyDeleteCourseCode || !weeklySqlOptions.startDate}
                                            >
                                                {weeklyDeletePending ? 'Deleting...' : 'Delete Uploaded Event'}
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <div className="admin-weekly-sql-panel">
                                    <div className="admin-weekly-sql-head">
                                        <strong>Weekly SQL Pipeline Options</strong>
                                        <span>Defaults follow the current run_simple_sql_loop setup, with the date prefilled to the current Saturday.</span>
                                    </div>

                                    <div className="admin-weekly-sql-grid">
                                        <label className="admin-weekly-sql-field">
                                            <span>Start date</span>
                                            <input
                                                type="date"
                                                className="admin-filter-input"
                                                value={weeklySqlOptions.startDate}
                                                onChange={(event) => setWeeklySqlOptions((prev) => ({ ...prev, startDate: event.target.value }))}
                                                disabled={weeklyStatus.running || weeklyStarting}
                                            />
                                            <small>Default: current Saturday. Change this if you need to run the pipeline retrospectively.</small>
                                        </label>

                                        <label className="admin-weekly-sql-field">
                                            <span>Event code</span>
                                            <input
                                                type="text"
                                                inputMode="numeric"
                                                className="admin-filter-input"
                                                value={weeklySqlOptions.eventCode}
                                                onChange={(event) => setWeeklySqlOptions((prev) => ({ ...prev, eventCode: event.target.value.replace(/[^0-9]/g, '') }))}
                                                disabled={weeklyStatus.running || weeklyStarting}
                                                placeholder="All events"
                                            />
                                            <small>Optional filter to restrict the scraper and SQL processing to one event.</small>
                                        </label>
                                    </div>

                                    <div className="admin-weekly-sql-options">
                                        {WEEKLY_SQL_OPTION_DEFINITIONS.map((option) => (
                                            <label key={option.key} className="admin-weekly-sql-option">
                                                <input
                                                    type="checkbox"
                                                    checked={weeklySqlOptions[option.key]}
                                                    onChange={(event) => setWeeklySqlOptions((prev) => ({ ...prev, [option.key]: event.target.checked }))}
                                                    disabled={weeklyStatus.running || weeklyStarting}
                                                />
                                                <div>
                                                    <div className="admin-weekly-sql-option-title">{option.label}</div>
                                                    <div className="admin-weekly-sql-option-description">{option.description}</div>
                                                    <div className="admin-weekly-sql-option-default">Default: {weeklySqlDefaultLabel(option.defaultValue)}</div>
                                                </div>
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                <div className="admin-weekly-run-meta">
                                    <span>Started: {formatTimeWithSeconds(weeklyStatus.startedAt)}</span>
                                    <span>Finished: {formatTimeWithSeconds(weeklyStatus.finishedAt)}</span>
                                    <span>Current: {weeklyStatus.currentCourse || '—'} {weeklyStatus.currentCode ? `(${weeklyStatus.currentCode})` : ''}</span>
                                    {weeklyStatus.runMode === 'sqlPipeline' && weeklyStatus.sqlPipelineOptions?.startDate && (
                                        <span>SQL Start Date: {weeklyStatus.sqlPipelineOptions.startDate}</span>
                                    )}
                                </div>

                                {(weeklyError || weeklyStatus.error) && <div className="admin-error">{weeklyError || weeklyStatus.error}</div>}
                            </div>

                            <div className="admin-weekly-log-wrap">
                                <div className="admin-weekly-log-split">
                                    <div className="admin-weekly-progress">
                                        <div className="admin-weekly-progress-head">
                                            <strong>Pipeline Stages</strong>
                                            <span>Targets are approximate guide windows so progress is easier to read at a glance.</span>
                                        </div>
                                        <div className="admin-weekly-progress-list">
                                            {weeklyPipelineProgress.map((stage) => {
                                                const progressClass = stage.status === 'pending' && stage.wasPreviouslyComplete ? 'previous' : stage.status;
                                                return (
                                                <div key={stage.id} className={`admin-weekly-progress-step ${stage.status} ${stage.wasPreviouslyComplete && stage.status === 'pending' ? 'previous' : ''}`}>
                                                    <div className={`admin-weekly-progress-light ${progressClass}`} aria-hidden="true" />
                                                    <div className="admin-weekly-progress-body">
                                                        <div className="admin-weekly-progress-title-row">
                                                            <strong>{stage.label}</strong>
                                                            <span className="admin-weekly-progress-target">{stage.target}</span>
                                                        </div>
                                                        <div className="admin-weekly-progress-description">{stage.description}</div>
                                                        <div className="admin-weekly-progress-meta">
                                                            {stage.startedEntry ? <span>Started: {formatTimeWithSeconds(stage.startedEntry.at)}</span> : <span>Started: waiting</span>}
                                                            {stage.completedEntry ? <span>Done: {formatTimeWithSeconds(stage.completedEntry.at)}</span> : stage.previousCompletedAt ? <span>Prior Done: {formatTimeWithSeconds(stage.previousCompletedAt)}</span> : <span>Done: pending</span>}
                                                        </div>
                                                        {stage.latestEntry && (
                                                            <div className="admin-weekly-progress-message">{stage.latestEntry.message}</div>
                                                        )}
                                                    </div>
                                                </div>
                                            )})}
                                        </div>
                                    </div>

                                    <div className="admin-weekly-log" ref={weeklyLogRef}>
                                        {weeklyStatus.logs.length === 0 ? (
                                            <div className="admin-weekly-log-empty">No output yet.</div>
                                        ) : weeklyStatus.logs.map((entry, idx) => (
                                            <div key={`${entry.at}-${idx}`} className={`admin-weekly-log-row ${String(entry.level || 'info')}`}>
                                                <span className="admin-weekly-log-time">{formatTimeWithSeconds(entry.at)}</span>
                                                <span className="admin-weekly-log-message">{entry.message}</span>
                                                {(entry.eventName || entry.eventCode) && (
                                                    <span className="admin-weekly-log-event">{entry.eventName || ''}{entry.eventCode ? ` (${entry.eventCode})` : ''}</span>
                                                )}
                                                {(entry.athletes != null || entry.volunteers != null) && (
                                                    <span className="admin-weekly-log-stats">
                                                        athletes: {entry.athletes ?? '—'} | volunteers: {entry.volunteers ?? '—'}
                                                    </span>
                                                )}
                                            </div>
                                        ))}
                                        <div className="admin-weekly-log-spacer" aria-hidden="true" />
                                    </div>
                                </div>
                            </div>

                            {weeklyDeleteConfirm && (
                                <div className="admin-activity-modal-backdrop" onMouseDown={(event) => {
                                    if (event.target === event.currentTarget && !weeklyDeletePending) {
                                        setWeeklyDeleteConfirm(null);
                                    }
                                }}>
                                    <div className="admin-activity-modal admin-weekly-confirm-modal" role="dialog" aria-modal="true" aria-label="Confirm uploaded event delete">
                                        <div className="admin-activity-modal-head">
                                            <strong>Delete Uploaded Event</strong>
                                            <button
                                                type="button"
                                                className="admin-activity-modal-close"
                                                onClick={() => !weeklyDeletePending && setWeeklyDeleteConfirm(null)}
                                                aria-label="Close delete confirmation"
                                            >
                                                x
                                            </button>
                                        </div>
                                        <div className="admin-weekly-confirm-body">
                                            <p>
                                                This is about to remove uploaded event data for <strong>{weeklyDeleteConfirm.eventName}</strong> on <strong>{weeklyDeleteConfirm.startDate}</strong>.
                                            </p>
                                            <p>
                                                It will delete matching rows from <strong>eventpositions</strong> and <strong>parkrun_events</strong> in both <strong>SQLite</strong> and <strong>Postgres</strong> for event code <strong>{weeklyDeleteConfirm.eventCode}</strong>.
                                            </p>
                                            <p>This cannot be undone from the Admin page.</p>
                                        </div>
                                        <div className="admin-weekly-confirm-actions">
                                            <button
                                                type="button"
                                                className="admin-weekly-refresh"
                                                onClick={() => setWeeklyDeleteConfirm(null)}
                                                disabled={weeklyDeletePending}
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                type="button"
                                                className="admin-weekly-danger-button"
                                                onClick={handleDeleteUploadedEvent}
                                                disabled={weeklyDeletePending}
                                            >
                                                {weeklyDeletePending ? 'Deleting...' : 'Confirm Delete'}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </section>
            </div>
        </div>
    );
};

export default Admin;
