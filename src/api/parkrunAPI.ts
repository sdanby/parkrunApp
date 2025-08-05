import axios from 'axios';


const API_BASE_URL = 'https://hello-world-9yb9.onrender.com/'


export const fetchResults = async () => {
    try {
        const response = await axios.get(`${API_BASE_URL}/results`);
        //const response = await axios.get(`http://127.0.0.1:5000/results`, { withCredentials: false });
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