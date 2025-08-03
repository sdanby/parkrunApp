import React, { useEffect, useState } from 'react';
import { fetchResults } from '../api/parkrunAPI';
import './ResultsTable.css'; // Create this CSS file for sticky headers

const Results: React.FC = () => {
    const [results, setResults] = useState<any[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        console.log('Fetching results...');
        const getResults = async () => {
            try {
                const data = await fetchResults();
                console.log('Results fetched:', data);
                setResults(Array.isArray(data) ? data : []);
            } catch (err) {
                setError('Failed to fetch results');
            } finally {
                setLoading(false);
            }
        };
        getResults();
    }, []);

    if (loading) return <div>Loading...</div>;
    if (error) return <div>{error}</div>;
    if (!results.length) return <div>No results found.</div>;

    // Get unique event_codes and event_dates
    const eventCodes = Array.from(new Set(results.map(r => r.event_code))).sort();
    const eventDates = Array.from(new Set(results.map(r => r.event_date)))
        .sort((a, b) => b.localeCompare(a)); // Latest first

    // Build a lookup for last_position
    const positionLookup: { [key: string]: { [key: string]: number } } = {};
    results.forEach(r => {
        if (!positionLookup[r.event_date]) positionLookup[r.event_date] = {};
        positionLookup[r.event_date][r.event_code] = r.last_position;
    });

    return (
        <div className="page-content">
            <h1>Event Last Positions</h1>
            <div className="results-table-container">
                <table className="results-table">
                    <thead>
                        <tr>
                            <th className="sticky-col sticky-header">Date</th>
                            {eventCodes.map(code => (
                                <th key={code} className="sticky-header">{code}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {eventDates.map(date => (
                            <tr key={date}>
                                <td className="sticky-col">{date}</td>
                                {eventCodes.map(code => (
                                    <td key={code}>
                                        {positionLookup[date] && positionLookup[date][code] !== undefined
                                            ? positionLookup[date][code]
                                            : '-'}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default Results;