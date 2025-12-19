import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { fetchEventPositions } from '../api/backendAPI';

// Minimal Races page — shows the selected event/date (from query) and attempts to fetch event positions
const Races: React.FC = () => {
    const [rows, setRows] = useState<any[] | null>(null);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const location = useLocation();

    const params = new URLSearchParams(location.search);
    const date = params.get('date') || '';
    const eventCodeOrName = params.get('event') || '';

    useEffect(() => {
        // If no params, do nothing — keep page minimal
        if (!eventCodeOrName && !date) return;
        const load = async () => {
            setLoading(true);
            setError(null);
            try {
                // Use the centralized API helper which respects `API_BASE_URL`
                const data = await fetchEventPositions(eventCodeOrName, date);
                setRows(Array.isArray(data) ? data : []);
            } catch (err) {
                setError('Failed to fetch event positions — backend may not support this endpoint');
                setRows(null);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [eventCodeOrName, date]);

    return (
        <div className="page-content">
            <h1>Races</h1>
            <div style={{ marginBottom: '1em' }}>
                <strong>Selected event:</strong> {eventCodeOrName || <em>none</em>}<br />
                <strong>Selected date:</strong> {date || <em>none</em>}
            </div>
            {loading && <div>Loading event positions…</div>}
            {error && <div style={{ color: 'darkred' }}>{error}</div>}
            {rows && rows.length === 0 && <div>No positions returned for this event/date.</div>}
            {rows && rows.length > 0 && (
                <table>
                    <thead>
                        <tr>
                            <th>Position</th>
                            <th>Name</th>
                            <th>Club</th>
                            <th>Time</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((r: any, i: number) => (
                            <tr key={r.athlete_code || i}>
                                <td>{r.position}</td>
                                <td>{r.name}</td>
                                <td>{r.club}</td>
                                <td>{r.time}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
            {!loading && rows === null && !error && (
                <div>Click a cell in Results to view the selected event/date here.</div>
            )}
        </div>
    );
};

export default Races;
