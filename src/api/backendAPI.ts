import axios from 'axios';

const API_BASE_URL = 'https://hello-world-9yb9.onrender.com/'

export const fetchResults = async () => {
    try {
        const response = await axios.get(`${API_BASE_URL}/results`);
        return response.data;
    } catch (error) {
        console.error('Error fetching results:', error);
        throw error;
    }
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