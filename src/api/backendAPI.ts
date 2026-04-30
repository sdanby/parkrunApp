import axios from 'axios';

// Use environment variable when available; default to deployed host.
export const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'https://hello-world-9yb9.onrender.com';
const API_LOCAL_URL = 'http://localhost:5000/';

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

export type FeedbackRequest = {
    id: number;
    type: 'error' | 'suggestion';
    title: string;
    details: string;
    dateLogged: string;
    status: string;
};

export type AuthResponse = {
    token: string;
    user: AuthUser;
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

export const fetchAuthConfig = async (): Promise<{ googleClientId?: string }> => {
    const response = await axios.get(`${API_BASE_URL}/api/auth/config`);
    return response.data || {};
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

export const fetchAdminActivity = async (token: string, limit = 300): Promise<{ activity: AdminActivityRecord[]; limit: number }> => {
    const response = await axios.get(`${API_BASE_URL}/api/admin/activity?limit=${encodeURIComponent(String(limit))}`, {
        headers: {
            Authorization: `Bearer ${token}`
        }
    });
    return response.data || { activity: [], limit };
};

export const fetchFeedbackRequests = async (): Promise<FeedbackRequest[]> => {
    try {
        const response = await axios.get(`${API_BASE_URL}/api/feedback-requests`);
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
}): Promise<FeedbackRequest> => {
    try {
        const response = await axios.post(`${API_BASE_URL}/api/feedback-requests`, payload);
        return response.data;
    } catch (error) {
        console.error('Error creating feedback request:', error);
        throw error;
    }
};