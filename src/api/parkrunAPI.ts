import axios from 'axios';


const API_BASE_URL = 'https://hello-world-9yb9.onrender.com/'


export const fetchResults = async (limitOrDate: number | string = 15) => {
    try {
        const params: any = {};
        if (typeof limitOrDate === 'number') {
            params.limit = limitOrDate;
        } else if (typeof limitOrDate === 'string') {
            params.date = limitOrDate;
        }
        const response = await axios.get(`${API_BASE_URL}/results`, { params });
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