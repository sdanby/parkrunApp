import React, { useEffect, useState } from 'react';
import { fetchAthleteHistory } from '../api/backendAPI';

const AthletesPage: React.FC = () => {
    const [athleteHistory, setAthleteHistory] = useState<any[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const getAthleteHistory = async () => {
            try {
                const data = await fetchAthleteHistory();
                setAthleteHistory(data);
            } catch (err) {
                setError('Failed to fetch athlete history.');
            } finally {
                setLoading(false);
            }
        };

        getAthleteHistory();
    }, []);

    if (loading) {
        return <div>Loading...</div>;
    }

    if (error) {
        return <div>{error}</div>;
    }

    return (
        <div className="page-content" style={{ marginTop: '60px' }}>
            <h1>Athlete History</h1>
            <ul>
                {athleteHistory.map((athlete, index) => (
                    <li key={index}>
                        <h2>{athlete.name}</h2>
                        <p>Event Code: {athlete.event_code}</p>
                        <p>Event Date: {athlete.event_date}</p>
                        <p>Position: {athlete.position}</p>
                        <p>Time: {athlete.time}</p>
                    </li>
                ))}
            </ul>
        </div>
    );
};

export default AthletesPage;