import axios from 'axios';

const API_BASE_URL = 'https://hello-world-9yb9.onrender.com'

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

export const fetchAthletes = async () => {
    try {
        const response = await axios.get(`${API_BASE_URL}/athletes`);
        return response.data;
    } catch (error) {
        console.error('Error fetching athletes:', error);
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