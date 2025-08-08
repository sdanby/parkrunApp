import axios from 'axios';


const API_BASE_URL = 'https://hello-world-9yb9.onrender.com/'


export const fetchResults = async (limit: number = 15) => {
    try {
        const response = await axios.get(`${API_BASE_URL}/results`, {
            params: { limit }
        });
        console.log('Results fetched check:', response.data);
        return response.data;
    } catch (error) {
        console.error('Error fetching results:', error);
        throw error;
    }
};
export const fetchAllResults = async () => {
    try {
        const response = await axios.get(`${API_BASE_URL}/resultsAll`);
         console.log('Results fetched check:', response.data);
        return response.data;
    } catch (error) {
        console.error('Error fetching resultsAll', error);
        throw error;
    }
};