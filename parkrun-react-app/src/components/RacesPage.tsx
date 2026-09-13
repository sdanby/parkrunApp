import React from 'react';

// Minimal RacesPage component — lightweight listing when embedded
const RacesPage: React.FC<{ races?: any[] }> = ({ races = [] }) => {
    if (!races || races.length === 0) return <div className="page-content"><h2>No races available</h2></div>;
    return (
        <div className="page-content">
            <h2>Event</h2>
            <ul>
                {races.map((r: any, idx: number) => (
                    <li key={r.id || idx}>{r.event_name || r.event_code} — {r.event_date}</li>
                ))}
            </ul>
        </div>
    );
};

export default RacesPage;
