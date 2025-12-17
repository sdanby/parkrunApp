import React, { useEffect, useState } from 'react';
import { fetchResults } from '../api/backendAPI';

// Minimal Races page — lightweight listing similar to Courses
const Races: React.FC = () => {
    const [races, setRaces] = useState<any[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const get = async () => {
            try {
                // reuse fetchResults as a simple data source; adapt later if you have a dedicated endpoint
                const data = await fetchResults();
                setRaces(Array.isArray(data) ? data : []);
            } catch (e) {
                setError('Failed to load races');
            } finally {
                setLoading(false);
            }
        };
        get();
    }, []);

    if (loading) return <div>Loading...</div>;
    if (error) return <div>{error}</div>;

    return (
        <div className="page-content">
            <h1>Races</h1>
            <ul>
                {races.map((r: any, i: number) => (
                    <li key={r.id || `${r.event_code}-${i}`}>
                        <strong>{r.event_name || r.event_code}</strong> — {r.event_date}
                    </li>
                ))}
            </ul>
        </div>
    );
};

export default Races;
