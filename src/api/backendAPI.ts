import axios from 'axios';

const isLocalHost = typeof window !== 'undefined'
    && ['localhost', '127.0.0.1'].includes(window.location.hostname);

// Use environment variable when available. In local browser dev, default to local backend.
export const API_BASE_URL = process.env.REACT_APP_API_BASE_URL
    || (isLocalHost ? 'http://127.0.0.1:5050' : 'https://hello-world-9yb9.onrender.com');

export const WEEKLY_UPLOAD_API_BASE_URL = process.env.REACT_APP_WEEKLY_UPLOAD_API_BASE_URL
    || API_BASE_URL;

const NEXT_EXT_API_TIMEOUT_MS = 12000;
const WEEKLY_UPLOAD_API_GET_TIMEOUT_MS = 20000;
const WEEKLY_UPLOAD_API_POST_TIMEOUT_MS = 20000;

const getNextExtApiBaseUrls = (): string[] => {
    const configuredBaseUrl = String(API_BASE_URL || '').trim();
    const candidates: string[] = [];

    if (configuredBaseUrl) {
        candidates.push(configuredBaseUrl);
    }

    if (isLocalHost && !configuredBaseUrl.includes('onrender.com')) {
        candidates.push('https://hello-world-9yb9.onrender.com');
    }

    const seen = new Set<string>();
    return candidates.filter((value) => {
        if (!value || seen.has(value)) return false;
        seen.add(value);
        return true;
    });
};

const getWeeklyUploadApiBaseUrls = (): string[] => {
    const configuredBaseUrl = String(WEEKLY_UPLOAD_API_BASE_URL || '').trim();
    const candidates: string[] = [];
    if (configuredBaseUrl) {
        candidates.push(configuredBaseUrl);
    }
    if (isLocalHost && !configuredBaseUrl) {
        candidates.push('http://127.0.0.1:5001');
    }

    const seen = new Set<string>();
    return candidates.filter((value) => {
        if (!value || seen.has(value)) return false;
        seen.add(value);
        return true;
    });
};

const requestWeeklyUploadApi = async <T>(
    method: 'get' | 'post',
    path: string,
    token: string,
    payload?: unknown,
): Promise<T> => {
    const headers = {
        Authorization: `Bearer ${token}`
    };
    const candidates = getWeeklyUploadApiBaseUrls();
    let lastError: unknown = null;

    for (const baseUrl of candidates) {
        try {
            if (method === 'get') {
                const response = await axios.get(`${baseUrl}${path}`, {
                    headers,
                    timeout: WEEKLY_UPLOAD_API_GET_TIMEOUT_MS,
                });
                return response.data as T;
            }

            const response = await axios.post(`${baseUrl}${path}`, payload ?? {}, {
                headers,
                timeout: WEEKLY_UPLOAD_API_POST_TIMEOUT_MS,
            });
            return response.data as T;
        } catch (error) {
            lastError = error;
        }
    }

    throw lastError;
};

export type AuthUser = {
    id: number;
    email: string;
    displayName?: string;
    athleteCode?: string | null;
    defaultCourseCode?: string | null;
    defaultCourseName?: string | null;
    isAdmin?: boolean;
    lastLoginAt?: string | null;
    previousLoginAt?: string | null;
};

export type EventOption = {
    eventCode: string;
    eventName: string;
};

export type ClubCourseSummaryRecord = {
    event_code: number | string;
    event_name: string;
    events_held_all_history: number;
    club_runs_all_history: number;
    athletes_all_history: number;
    rank_all_history: number;
    events_held_last_year: number;
    club_runs_last_year: number;
    athletes_last_year: number;
    rank_last_year: number;
};

export type EventHighlightsPerson = {
    position?: number | null;
    name: string;
    athlete_code?: string | null;
    time?: string | null;
    age_group?: string | null;
    sex?: 'male' | 'female' | 'unknown' | string;
    age_grade?: string | number | null;
    age_grade_value?: number | null;
    comment?: string | null;
    role?: string | null;
    total_runs?: number | null;
    total_vols?: number | null;
    milestone_level?: number | null;
    milestone_label?: string | null;
    first_timer_type?: 'ever' | 'here' | string;
};

export type EventHighlightsBreakdown = {
    total?: number;
    male?: number;
    female?: number;
    unknown?: number;
    ever?: number;
    here?: number;
    '10'?: number;
    '25'?: number;
    '50'?: number;
    '100'?: number;
    '250'?: number;
    '500'?: number;
    '1000'?: number;
};

export type EventHighlightsResponse = {
    event_code: number;
    event_date: string;
    event_number?: number | null;
    event_name: string;
    last_position?: number | null;
    volunteers?: number | null;
    avg_age?: number | null;
    first_timers_count?: number | null;
    pb_count?: number | null;
    tourist_count?: number | null;
    regulars?: number | null;
    returners_count?: number | null;
    club_count?: number | null;
    participants: number;
    distance_covered_km: number;
    first_finisher?: EventHighlightsPerson | null;
    first_finishers?: {
        male?: EventHighlightsPerson | null;
        female?: EventHighlightsPerson | null;
    };
    top_age_grade?: EventHighlightsPerson | null;
    gender_breakdown?: EventHighlightsBreakdown;
    pb_breakdown?: EventHighlightsBreakdown;
    first_timer_breakdown?: EventHighlightsBreakdown;
    milestone_breakdown?: EventHighlightsBreakdown;
    volunteer_milestone_breakdown?: EventHighlightsBreakdown;
    first_timers: EventHighlightsPerson[];
    first_timer_names?: string[];
    pb_roster: EventHighlightsPerson[];
    volunteer_roster: EventHighlightsPerson[];
    volunteer_names?: string[];
    milestone_people?: EventHighlightsPerson[];
    milestone_names?: string[];
    volunteer_milestones?: EventHighlightsPerson[];
    milestone_candidates?: EventHighlightsPerson[];
    finishers_by_minute: Array<{ minute: number; label: string; count: number }>;
    provisional_notes?: string[];
};

export type AdminStatusResponse = {
    adminCount: number;
    bootstrapOpen: boolean;
    canAccessAdmin: boolean;
    user?: AuthUser;
};

export type AdminUser = {
    id: number;
    email: string;
    displayName?: string | null;
    athleteCode?: string | null;
    defaultCourseCode?: string | null;
    defaultCourseName?: string | null;
    isAdmin: boolean;
    createdAt?: string | null;
    lastLoginAt?: string | null;
};

export type AdminActivityRecord = {
    activityType: 'page_visit' | 'login' | string;
    activityAt?: string | null;
    userId?: number | null;
    email?: string | null;
    displayName?: string | null;
    provider?: string | null;
    success?: boolean | null;
    pagePath?: string | null;
    durationMs?: number | null;
    referrerPath?: string | null;
    userAgent?: string | null;
    ipAddress?: string | null;
};

export type WeeklyUploadLogEntry = {
    at: string;
    level: 'info' | 'success' | 'warning' | 'error' | string;
    message: string;
    eventCode?: string;
    eventName?: string;
    athletes?: number | null;
    volunteers?: number | null;
};

export type WeeklySqlPipelineOptions = {
    startDate?: string;
    rebuild?: boolean;
    runSqlPipeline?: boolean;
    buildAthletes?: boolean;
    skipCoeffUpdates?: boolean;
    noParkrunPostgres?: boolean;
    eventCode?: number | null;
    scraper?: boolean;
    allAthletes?: boolean;
    leaveAthletePostgres?: boolean;
    noVolunteers?: boolean;
    refreshMaterializedView?: boolean;
    rebuildMaterializedViewsFromDefinitions?: boolean;
    rebuildHistoricAfterRun?: boolean;
    resumeCurveFromStage2?: boolean;
    resumeCurveFromAllHistory?: boolean;
    forceFreshStart?: boolean;
};

export type WeeklySqlRunSummary = {
    scopeKey: string;
    startDate: string;
    eventCode?: number | null;
    status?: string;
    startedAt?: string | null;
    finishedAt?: string | null;
    error?: string | null;
    updatedAt?: string | null;
    completedStageIds?: string[];
    stageCompletedAt?: Record<string, string>;
    lastMessage?: string;
    autoResumeMode?: string | null;
};

export type WeeklyUploadStatus = {
    running: boolean;
    status: string;
    runMode?: string;
    stopRequested?: boolean;
    isStalled?: boolean;
    currentCourseElapsedSeconds?: number;
    startedAt?: string | null;
    finishedAt?: string | null;
    totalCourses: number;
    processedCourses: number;
    currentCourse?: string;
    currentCode?: string;
    loopEvents?: boolean;
    loadHistory?: boolean;
    parkrunName?: string;
    sqlPipelineOptions?: WeeklySqlPipelineOptions;
    previousSqlRun?: WeeklySqlRunSummary | null;
    error?: string | null;
    logs: WeeklyUploadLogEntry[];
};

export type WeeklyDeleteEventResponse = {
    ok?: boolean;
    deleted?: {
        sqlite?: {
            eventpositions?: number;
            parkrunEvents?: number;
        };
        postgres?: {
            eventpositions?: number;
            parkrunEvents?: number;
        };
    };
    state?: WeeklyUploadStatus;
};

export type CurveReferenceStatus = {
    running: boolean;
    status: string;
    referenceDate?: string;
    startedAt?: string | null;
    finishedAt?: string | null;
    error?: string | null;
    logs: WeeklyUploadLogEntry[];
};

export type FeedbackRequest = {
    id: number;
    type: 'error' | 'suggestion';
    title: string;
    details: string;
    dateLogged: string;
    lastUpdated?: string;
    status: string;
    createdBy?: string;
    deleted?: boolean;
};

export type ChatMessage = {
    id: number;
    messageText: string;
    createdAt?: string | null;
    createdBy: string;
    athleteCode?: string | null;
};

export type ChatUnreadStatus = {
    hasUnread: boolean;
    lastReadChatMessageId?: number | null;
    latestChatMessageId?: number | null;
};

export type FeedbackRequestStatus =
    | 'logged'
    | 'updated'
    | 'in-progress'
    | 'prioritised'
    | 'rejected'
    | 'on-hold'
    | 'completed'
    | 'deleted';

const AUTH_TOKEN_KEY = 'auth_token_v1';

const getAuthHeaders = () => {
    if (typeof window === 'undefined') {
        return undefined;
    }

    const token = window.localStorage.getItem(AUTH_TOKEN_KEY);
    if (!token) {
        return undefined;
    }

    return {
        Authorization: `Bearer ${token}`
    };
};

export type AuthResponse = {
    token: string;
    user: AuthUser;
};

export type PasswordResetValidation = {
    valid: boolean;
    expiresAt?: string | null;
};

export const fetchResults = async (opts?: number | string) => {
    try {
        let url = `${API_BASE_URL}/results`;
        if (typeof opts === 'number') {
            url += `?limit=${opts}`;
            } else if (typeof opts === 'string') {
                // Some deployments expect a `date` param (YYYY-MM-DD). Use `date=` to match the server.
                url += `?date=${encodeURIComponent(opts)}`;
        }
        const response = await axios.get(url);
        return response.data;
    } catch (error) {
        console.error('Error fetching results:', error);
        throw error;
    }
};

// Backwards-compatible alias used by Results.tsx when requesting all results
export const fetchAllResults = async () => {
    const candidates = [
        // Prefer the known working resultsAll endpoint when available
        `${API_BASE_URL}/resultsAll`
       // `${API_BASE_URL}/results?all=true`
      //  `${API_BASE_URL}/results?all=1`,
      //  `${API_BASE_URL}/results/all`,
      //  `${API_BASE_URL}/results?limit=10000`,
      //  `${API_BASE_URL}/results?since=1970-01-01`,
      //  `${API_BASE_URL}/results`
    ];
    let lastErr: any = null;
    let bestData: any[] | null = null;
    let bestUniqueDates = 0;
    for (const url of candidates) {
        try {
            const response = await axios.get(url);
            const data = response.data;
            if (Array.isArray(data)) {
                const uniqueDates = new Set(data.map((r: any) => r && r.event_date)).size;
                if (uniqueDates > bestUniqueDates) {
                    bestUniqueDates = uniqueDates;
                    bestData = data;
                }
                if (uniqueDates > 100) {
                    return data;
                }
            } else {
                // Non-array response; ignore this candidate
            }
        } catch (error) {
            console.warn('[fetchAllResults] request failed for', url, String(error));
            lastErr = error;
        }
    }
    if (bestData && bestUniqueDates > 1) {
        console.log('[fetchAllResults] selected best candidate by uniqueDates', bestUniqueDates);
        return bestData;
    }
    if (lastErr) {
        console.error('[fetchAllResults] all attempts failed, falling back to fetchResults', String(lastErr));
    }
    return fetchResults();
};

export const fetchCourses = async () => {
    try {
        const response = await axios.get(`${API_BASE_URL}/courses`);
        return response.data;
    } catch (error) {
        console.error('Error fetching courses:', error);
        throw error;
    }
};

export const fetchEventPositions = async (eventIdentifier: string, eventDate: string) => {
    try {
        const params = new URLSearchParams();
        if (eventIdentifier) {
            // If identifier is numeric, send as event_code; otherwise as event_name
            if (/^\d+$/.test(String(eventIdentifier))) {
                params.set('event_code', String(eventIdentifier));
            } else {
                params.set('event_name', String(eventIdentifier));
            }
        }
        if (eventDate) params.set('event_date', eventDate);
        // Call the deployed API path `/api/eventpositions`.
        const url = `${API_BASE_URL}/api/eventpositions?${params.toString()}`;
        const response = await axios.get(url);
        return response.data;
    } catch (error) {
        console.error('Error fetching event positions:', error);
        throw error;
    }
};

export const fetchEventByNumber = async (eventCode: number, eventNumber: number) => {
    try {
        const params = new URLSearchParams();
        if (eventCode !== undefined && eventCode !== null) params.set('event_code', String(eventCode));
        if (eventNumber !== undefined && eventNumber !== null) params.set('event_number', String(eventNumber));
        const url = `${API_BASE_URL}/api/eventby_number?${params.toString()}`;
        const response = await axios.get(url);
        return response.data;
    } catch (error) {
        console.error('Error fetching event by number:', error);
        throw error;
    }
};

export const fetchEventSummary = async (eventCode: number, limit = 250) => {
    try {
        const params = new URLSearchParams();
        params.set('event_code', String(eventCode));
        params.set('limit', String(limit));
        const url = `${API_BASE_URL}/api/lists/event_summary?${params.toString()}`;
        const response = await axios.get(url);
        return response.data;
    } catch (error) {
        console.error('Error fetching event summary:', error);
        throw error;
    }
};

export const fetchEventPositionsMonthlyCascade = async (eventCode: number) => {
    try {
        const params = new URLSearchParams();
        params.set('event_code', String(eventCode));
        const url = `${API_BASE_URL}/api/eventpositions/monthly-cascade?${params.toString()}`;
        const response = await axios.get(url);
        return response.data;
    } catch (error) {
        console.error('Error fetching monthly cascade groups:', error);
        throw error;
    }
};

export const fetchEventInfo = async (eventIdentifier: string, eventDate: string) => {
    try {
        const params = new URLSearchParams();
        if (eventIdentifier) {
            // If identifier is numeric, treat it as an `event_code` (not an event_number).
            // Previously this code set both `event_number` and `event_code` when numeric,
            // which caused queries like `?event_number=1` to be sent when the identifier
            // was actually an event_code (e.g. `1` for Brentwood). That led the server
            // to return metadata for event_number=1 (first event of some other course).
            if (/^\d+$/.test(String(eventIdentifier))) {
                params.set('event_code', String(eventIdentifier));
            } else {
                params.set('event_name', String(eventIdentifier));
            }
        }
        if (eventDate) params.set('event_date', eventDate);
        const url = `${API_BASE_URL}/api/eventinfo?${params.toString()}`;
        const response = await axios.get(url);
        return response.data;
    } catch (error) {
        console.error('Error fetching event info:', error);
        throw error;
    }
};

export const fetchEventHighlights = async ({
    eventCode,
    eventName,
    eventDate
}: {
    eventCode?: string | number | null;
    eventName?: string | null;
    eventDate: string;
}): Promise<EventHighlightsResponse> => {
    try {
        const params = new URLSearchParams();
        if (eventCode !== undefined && eventCode !== null && String(eventCode).trim()) {
            params.set('event_code', String(eventCode).trim());
        } else if (eventName && String(eventName).trim()) {
            params.set('event_name', String(eventName).trim());
        }
        params.set('event_date', eventDate);
        const url = `${API_BASE_URL}/api/event_highlights?${params.toString()}`;
        const response = await axios.get(url);
        return response.data as EventHighlightsResponse;
    } catch (error) {
        console.error('Error fetching event highlights:', error);
        throw error;
    }
};

export const fetchAthletes = async () => {
    try {
        const response = await axios.get(`${API_BASE_URL}/athletes`);
        return response.data;
    } catch (error) {
        console.error('Error fetching athletes:', error);
        throw error;
    }
};

export const fetchClubsSearch = async (q: string, limit = 25) => {
    try {
        const params = new URLSearchParams();
        params.set('q', q);
        params.set('limit', String(limit));
        const url = `${API_BASE_URL}/api/clubs/search?${params.toString()}`;
        const response = await axios.get(url);
        return response.data;
    } catch (error) {
        console.error('Error fetching clubs search:', error);
        throw error;
    }
};

export const fetchClubMembers = async (club: string, limit = 1000) => {
    try {
        const params = new URLSearchParams();
        params.set('club', club);
        params.set('limit', String(limit));
        const url = `${API_BASE_URL}/api/clubs/members?${params.toString()}`;
        const response = await axios.get(url);
        return response.data;
    } catch (error) {
        console.error('Error fetching club members:', error);
        throw error;
    }
};

export const fetchClubCourseSummary = async (club: string, limit = 1000): Promise<ClubCourseSummaryRecord[]> => {
    try {
        const params = new URLSearchParams();
        params.set('club', club);
        params.set('limit', String(limit));
        const url = `${API_BASE_URL}/api/clubs/course-summary?${params.toString()}`;
        const response = await axios.get(url);
        return response.data;
    } catch (error) {
        console.error('Error fetching club course summary:', error);
        throw error;
    }
};
/*
export const loginUser = async (athleteCode, password) => {
    try {
        const response = await axios.post(`${API_BASE_URL}/login`, {
            athleteCode,
            password
        });
        return response.data;
    } catch (error) {
        console.error('Error logging in:', error);
        throw error;
    }
};
*/
export const loginUser = async (athleteCode: string, password: string) => {
    // Temporary mock for development
    return {
        athleteCode,
        name: "Test User",
        homeCourse: "Sample Course",
        token: "mock-token"
    };
};

export async function fetchAthleteData() {
    // Mock data for testing
    return [
        {
            id: 1,
            name: "Jane Doe",
            history: "Parkrun results here...",
            comparison: "Compared to others..."
        },
        {
            id: 2,
            name: "John Smith",
            history: "Parkrun results here...",
            comparison: "Compared to others..."
        }
    ];
}

export async function fetchAthleteHistory() {
    // Mock data for testing
    return [
        { id: 1, name: "Jane Doe", history: "Parkrun results..." },
        { id: 2, name: "John Smith", history: "Parkrun results..." }
    ];
}

export async function fetchCoursesData() {
    // Mock data for testing
    return [
        { id: 1, name: "Sample Course 1", description: "Description 1" },
        { id: 2, name: "Sample Course 2", description: "Description 2" }
    ];
}

export const fetchEventTimeAdjustment = async (event_code: string | number, event_date: string) => {
  const params = new URLSearchParams({
    event_code: String(event_code),
    event_date
  });
  const response = await fetch(`${API_BASE_URL}/api/eventTimeAdjustment?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  return response.json();
};

export const fetchAthleteRuns = async (athleteCode: string) => {
    if (!athleteCode) {
        throw new Error('athleteCode is required');
    }
    try {
        const params = new URLSearchParams({ athlete_code: String(athleteCode) });
        const url = `${API_BASE_URL}/api/athlete_runs?${params.toString()}`;
        const response = await axios.get(url);
        return response.data;
    } catch (error) {
        console.error('Error fetching athlete runs:', error);
        throw error;
    }
};

export const fetchAthleteBestSummary = async (athleteCode: string) => {
    if (!athleteCode) {
        throw new Error('athleteCode is required');
    }
    try {
        const params = new URLSearchParams({ athlete_code: String(athleteCode) });
        const url = `${API_BASE_URL}/api/athlete_best_summary?${params.toString()}`;
        const response = await axios.get(url);
        return response.data;
    } catch (error) {
        console.error('Error fetching athlete best summary:', error);
        throw error;
    }
};

export type NextExtSimilarRow = {
    athlete_code: string;
    athlete_name: string;
    club?: string | null;
    best_course_code?: string | null;
    best_course?: string | null;
    freq_course_code?: string | null;
    freq_course?: string | null;
    age_group?: string | null;
    age_grade?: string | number | null;
    event_date?: string | null;
    rank_metric: 'B' | 'E' | 'AE' | 'ES' | 'AES';
    rank_suffix: string;
    rank_score: number;
    exact_rank?: number | null;
    rank_display: string;
    best_time_seconds?: number | null;
    actual_time_seconds?: number | null;
    local_runs_1y?: number | null;
    peer_rn?: number | null;
    selected_peer_rn?: number | null;
    is_selected?: boolean;
};

export type NextExtSimilarResponse = {
    selectedAthleteCode: string;
    selectedRankScore: number | null;
    selectedRankDisplay: string | null;
    selectedPreferredAdjType?: 'B' | 'E' | 'AE' | 'ES' | 'AES' | null;
    selectedPreferredRankScore?: number | null;
    selectedPreferredExactRank?: number | null;
    selectedPreferredRankDisplay?: string | null;
    courseCodeFilter?: string | string[] | null;
    ageGroupFilter?: string | string[] | null;
    adjTypeFilter?: 'B' | 'E' | 'AE' | 'ES' | 'AES' | null;
    rows: NextExtSimilarRow[];
};

export const fetchNextExtSimilar = async (
    athleteCode: string,
    above: number = 10,
    below: number = 10,
    courseCode?: string | string[] | null,
    ageGroup?: string | string[] | null,
    adjType: 'B' | 'E' | 'AE' | 'ES' | 'AES' = 'AE',
): Promise<NextExtSimilarResponse> => {
    if (!athleteCode) {
        throw new Error('athleteCode is required');
    }
    try {
        const params = new URLSearchParams({
            athlete_code: String(athleteCode),
            above: String(above),
            below: String(below),
            adj_type: String(adjType || 'AE')
        });
        if (Array.isArray(courseCode)) {
            const normalizedCourseCodes = courseCode
                .map((value) => String(value || '').trim())
                .filter((value) => value.length > 0);
            if (normalizedCourseCodes.length > 0) {
                params.set('course_code', normalizedCourseCodes.join(','));
            }
        } else if (courseCode) {
            params.set('course_code', String(courseCode));
        }
        if (Array.isArray(ageGroup)) {
            const normalizedAgeGroups = ageGroup
                .map((value) => String(value || '').trim())
                .filter((value) => value.length > 0);
            if (normalizedAgeGroups.length > 0) {
                params.set('age_group', normalizedAgeGroups.join(','));
            }
        } else if (ageGroup) {
            params.set('age_group', String(ageGroup));
        }
        const candidates = getNextExtApiBaseUrls();
        let lastError: unknown = null;

        for (const baseUrl of candidates) {
            try {
                const url = `${baseUrl}/api/next_ext_similar?${params.toString()}`;
                const response = await axios.get(url, { timeout: NEXT_EXT_API_TIMEOUT_MS });
                return response.data as NextExtSimilarResponse;
            } catch (error) {
                lastError = error;
            }
        }

        throw lastError;
    } catch (error) {
        console.error('Error fetching Next Ext similar participants:', error);
        throw error;
    }
};

export type CurveRankReferenceRow = {
    curved_rank_group: number;
    curve_rank_reference_version: string | null;
    min_seconds?: number | null;
    max_seconds?: number | null;
    min_time?: string | null;
    max_time?: string | null;
    score_lower?: number | null;
    score_upper?: number | null;
    actual_group_cnt?: number | null;
};

export type CurveRankReferenceResponse = {
    rank_type: 'B' | 'E' | 'ES' | 'AE' | 'AES';
    curve_rank_reference_version: string | null;
    latest_curve_rank_reference_version: string | null;
    available_curve_rank_reference_versions: string[];
    rows: CurveRankReferenceRow[];
};

export const fetchCurveRankReference = async (
    rankType: 'B' | 'E' | 'ES' | 'AE' | 'AES',
    referenceVersion?: string | null,
) => {
    const params = new URLSearchParams({ rank_type: rankType });
    if (referenceVersion) {
        params.set('reference_version', referenceVersion);
    }
    try {
        const url = `${API_BASE_URL}/api/curve-rank-reference?${params.toString()}`;
        const response = await axios.get(url);
        return response.data as CurveRankReferenceResponse;
    } catch (error) {
        console.error('Error fetching curve rank reference:', error);
        throw error;
    }
};

export type ParkrunEventRow = {
    event_code: number | string;
    event_date: string;
    event_number?: number | null;
    coeff?: number | null;
    coeff_event?: number | null;
    last_position?: number | null;
    volunteers?: number | null;
};

export const fetchParkrunEvents = async (eventCode: string | number): Promise<ParkrunEventRow[]> => {
    if (eventCode === undefined || eventCode === null || String(eventCode).trim() === '') {
        return [];
    }
    try {
        const params = new URLSearchParams({ event_code: String(eventCode) });
        const url = `${API_BASE_URL}/api/parkrun_events?${params.toString()}`;
        const response = await axios.get(url);
        return Array.isArray(response.data) ? response.data : [];
    } catch (error) {
        console.error('Error fetching parkrun events:', error);
        throw error;
    }
};

export const registerWithEmail = async (email: string, password: string, displayName?: string): Promise<AuthResponse> => {
    const response = await axios.post(`${API_BASE_URL}/api/auth/register`, {
        email,
        password,
        displayName
    });
    return response.data;
};

export const loginWithEmail = async (email: string, password: string): Promise<AuthResponse> => {
    const response = await axios.post(`${API_BASE_URL}/api/auth/login`, {
        email,
        password
    });
    return response.data;
};

export const loginWithGoogle = async (credential: string): Promise<AuthResponse> => {
    const response = await axios.post(`${API_BASE_URL}/api/auth/google`, {
        credential
    });
    return response.data;
};

export const logoutSession = async (token?: string): Promise<void> => {
    await axios.post(`${API_BASE_URL}/api/auth/logout`, {
        token
    });
};

export const trackPageVisit = async (payload: {
    token?: string;
    path: string;
    enteredAt?: string;
    leftAt?: string;
    durationMs?: number;
    referrer?: string;
}): Promise<void> => {
    await axios.post(`${API_BASE_URL}/api/analytics/page-visit`, payload);
};

export const fetchAuthConfig = async (): Promise<{ googleClientId?: string; passwordResetEnabled?: boolean }> => {
    const response = await axios.get(`${API_BASE_URL}/api/auth/config`);
    return response.data || {};
};

export const requestPasswordReset = async (email: string): Promise<{ ok: boolean; message?: string }> => {
    const response = await axios.post(`${API_BASE_URL}/api/auth/password-reset/request`, {
        email
    });
    return response.data;
};

export const validatePasswordResetToken = async (token: string): Promise<PasswordResetValidation> => {
    const params = new URLSearchParams({ token });
    const response = await axios.get(`${API_BASE_URL}/api/auth/password-reset/validate?${params.toString()}`);
    return response.data;
};

export const confirmPasswordReset = async (token: string, password: string): Promise<{ ok: boolean; message?: string }> => {
    const response = await axios.post(`${API_BASE_URL}/api/auth/password-reset/confirm`, {
        token,
        password
    });
    return response.data;
};

export const fetchEventOptions = async (): Promise<EventOption[]> => {
    const response = await axios.get(`${API_BASE_URL}/api/events/options`);
    const rows = Array.isArray(response.data) ? response.data : [];
    return rows.map((row: any) => ({
        eventCode: String(row.eventCode ?? row.event_code ?? ''),
        eventName: String(row.eventName ?? row.event_name ?? '')
    })).filter((row: EventOption) => row.eventCode && row.eventName);
};

export const linkAthleteCode = async (
    token: string,
    athleteCode?: string,
    defaultCourseCode?: string,
    defaultCourseName?: string
): Promise<{ ok: boolean; user?: AuthUser; message?: string }> => {
    const response = await axios.post(`${API_BASE_URL}/api/auth/link-athlete`, {
        token,
        athleteCode,
        defaultCourseCode,
        defaultCourseName
    });
    return response.data || { ok: true };
};

export const fetchAdminStatus = async (token: string): Promise<AdminStatusResponse> => {
    const response = await axios.get(`${API_BASE_URL}/api/admin/status`, {
        headers: {
            Authorization: `Bearer ${token}`
        }
    });
    return response.data;
};

export const fetchAdminUsers = async (token: string): Promise<{ users: AdminUser[]; adminCount: number; bootstrapOpen: boolean }> => {
    const response = await axios.get(`${API_BASE_URL}/api/admin/users`, {
        headers: {
            Authorization: `Bearer ${token}`
        }
    });
    return response.data || { users: [], adminCount: 0, bootstrapOpen: true };
};

export const setAdminUserFlag = async (token: string, userId: number, isAdmin: boolean): Promise<{ ok: boolean; user?: AdminUser; adminCount: number; bootstrapOpen: boolean }> => {
    const response = await axios.post(`${API_BASE_URL}/api/admin/users/${userId}/admin`, {
        isAdmin
    }, {
        headers: {
            Authorization: `Bearer ${token}`
        }
    });
    return response.data;
};

export const setAdminUserDefaultCourse = async (
    token: string,
    userId: number,
    defaultCourseCode?: string,
    defaultCourseName?: string
): Promise<{ ok: boolean; user?: AdminUser }> => {
    const response = await axios.post(`${API_BASE_URL}/api/admin/users/${userId}/default-course`, {
        defaultCourseCode,
        defaultCourseName
    }, {
        headers: {
            Authorization: `Bearer ${token}`
        }
    });
    return response.data || { ok: true };
};

export const fetchAdminActivity = async (token: string, limit = 300, since?: string): Promise<{ activity: AdminActivityRecord[]; limit: number }> => {
    const params = new URLSearchParams();
    params.set('limit', String(limit));
    if (since) {
        params.set('since', since);
    }

    const response = await axios.get(`${API_BASE_URL}/api/admin/activity?${params.toString()}`, {
        headers: {
            Authorization: `Bearer ${token}`
        }
    });
    return response.data || { activity: [], limit };
};

export const fetchAdminWeeklyUploadStatus = async (
    token: string,
    scope?: { startDate?: string; eventCode?: number | string | null }
): Promise<WeeklyUploadStatus> => {
    const params = new URLSearchParams();
    if (scope?.startDate) {
        params.set('startDate', String(scope.startDate));
    }
    if (scope?.eventCode != null && String(scope.eventCode).trim() !== '') {
        params.set('eventCode', String(scope.eventCode));
    }
    const query = params.toString();
    const response = await requestWeeklyUploadApi<WeeklyUploadStatus>(
        'get',
        `/api/admin/weekly-upload/status${query ? `?${query}` : ''}`,
        token,
    );
    return response || {
        running: false,
        status: 'idle',
        totalCourses: 0,
        processedCourses: 0,
        logs: []
    };
};

export const startAdminWeeklyUpload = async (
    token: string,
    payload?: { loopEvents?: boolean; loadHistory?: boolean; parkrunName?: string; runMode?: string; sqlPipelineOptions?: WeeklySqlPipelineOptions }
): Promise<{ ok?: boolean; state?: WeeklyUploadStatus }> => {
    return (await requestWeeklyUploadApi<{ ok?: boolean; state?: WeeklyUploadStatus }>(
        'post',
        '/api/admin/weekly-upload/start',
        token,
        payload || {},
    )) || { ok: true };
};

export const startAdminCurveReferencePublish = async (
    token: string,
    payload?: { sqlPipelineOptions?: WeeklySqlPipelineOptions }
): Promise<{ ok?: boolean; state?: CurveReferenceStatus }> => {
    return (await requestWeeklyUploadApi<{ ok?: boolean; state?: CurveReferenceStatus }>(
        'post',
        '/api/admin/curve-reference/publish',
        token,
        payload || {},
    )) || { ok: true };
};

export const fetchAdminCurveReferenceStatus = async (
    token: string,
): Promise<CurveReferenceStatus> => {
    const response = await requestWeeklyUploadApi<CurveReferenceStatus>(
        'get',
        '/api/admin/curve-reference/status',
        token,
    );
    return response || {
        running: false,
        status: 'idle',
        logs: []
    };
};

export const resetAdminCurveReferencePublish = async (
    token: string
): Promise<{ ok?: boolean; state?: CurveReferenceStatus }> => {
    return (await requestWeeklyUploadApi<{ ok?: boolean; state?: CurveReferenceStatus }>(
        'post',
        '/api/admin/curve-reference/reset',
        token,
        {},
    )) || { ok: true };
};

export const stopAdminWeeklyUpload = async (
    token: string
): Promise<{ ok?: boolean; state?: WeeklyUploadStatus }> => {
    return (await requestWeeklyUploadApi<{ ok?: boolean; state?: WeeklyUploadStatus }>(
        'post',
        '/api/admin/weekly-upload/stop',
        token,
        {},
    )) || { ok: true };
};

export const resetAdminWeeklyUpload = async (
    token: string
): Promise<{ ok?: boolean; state?: WeeklyUploadStatus }> => {
    return (await requestWeeklyUploadApi<{ ok?: boolean; state?: WeeklyUploadStatus }>(
        'post',
        '/api/admin/weekly-upload/reset',
        token,
        {},
    )) || { ok: true };
};

export const deleteAdminWeeklyUploadEvent = async (
    token: string,
    payload: { eventCode: string; eventName?: string; startDate: string }
): Promise<WeeklyDeleteEventResponse> => {
    return (await requestWeeklyUploadApi<WeeklyDeleteEventResponse>(
        'post',
        '/api/admin/weekly-upload/delete-event',
        token,
        payload,
    )) || { ok: true };
};

export const fetchFeedbackRequests = async (): Promise<FeedbackRequest[]> => {
    try {
        const response = await axios.get(`${API_BASE_URL}/api/feedback-requests`, {
            headers: getAuthHeaders()
        });
        return Array.isArray(response.data) ? response.data : [];
    } catch (error) {
        console.error('Error fetching feedback requests:', error);
        throw error;
    }
};

export const createFeedbackRequest = async (payload: {
    type: 'error' | 'suggestion';
    title: string;
    details: string;
    status?: FeedbackRequestStatus;
}): Promise<FeedbackRequest> => {
    try {
        const response = await axios.post(`${API_BASE_URL}/api/feedback-requests`, payload, {
            headers: getAuthHeaders()
        });
        return response.data;
    } catch (error) {
        console.error('Error creating feedback request:', error);
        throw error;
    }
};

export const updateFeedbackRequest = async (
    requestId: number,
    payload: {
        type: 'error' | 'suggestion';
        title: string;
        details: string;
        status: FeedbackRequestStatus;
    }
): Promise<FeedbackRequest> => {
    try {
        const response = await axios.put(`${API_BASE_URL}/api/feedback-requests/${requestId}`, payload, {
            headers: getAuthHeaders()
        });
        return response.data;
    } catch (error) {
        console.error('Error updating feedback request:', error);
        throw error;
    }
};

export const fetchChatMessages = async (limit = 200, options?: { markRead?: boolean }): Promise<ChatMessage[]> => {
    try {
        const params = new URLSearchParams();
        params.set('limit', String(limit));
        if (options?.markRead) {
            params.set('markRead', '1');
        }
        const response = await axios.get(`${API_BASE_URL}/api/chat/messages?${params.toString()}`, {
            headers: getAuthHeaders()
        });
        return Array.isArray(response.data) ? response.data : [];
    } catch (error) {
        console.error('Error fetching chat messages:', error);
        throw error;
    }
};

export const createChatMessage = async (payload: { messageText: string }): Promise<ChatMessage> => {
    try {
        const response = await axios.post(`${API_BASE_URL}/api/chat/messages`, payload, {
            headers: getAuthHeaders()
        });
        return response.data;
    } catch (error) {
        console.error('Error creating chat message:', error);
        throw error;
    }
};

export const fetchChatUnreadStatus = async (): Promise<ChatUnreadStatus> => {
    try {
        const response = await axios.get(`${API_BASE_URL}/api/chat/unread-status`, {
            headers: getAuthHeaders()
        });
        return response.data as ChatUnreadStatus;
    } catch (error) {
        console.error('Error fetching chat unread status:', error);
        throw error;
    }
};

export const markChatMessagesRead = async (): Promise<ChatUnreadStatus> => {
    try {
        const response = await axios.post(`${API_BASE_URL}/api/chat/read`, {}, {
            headers: getAuthHeaders()
        });
        return response.data as ChatUnreadStatus;
    } catch (error) {
        console.error('Error marking chat messages as read:', error);
        throw error;
    }
};