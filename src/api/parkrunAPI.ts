import axios from 'axios';


const API_BASE_URL = 'https://1230e3eca65d.ngrok-free.app'


export const fetchResults = async () => {
    try {
        const response = await axios.get(`${API_BASE_URL}/results`, { withCredentials: false });
        //const response = await axios.get(`http://127.0.0.1:5000/results`, { withCredentials: false });
        console.log('Results fetched:', response.data);
        return response.data;
    } catch (error) {
        console.error('Error fetching results:', error);
        throw error;
    }
};