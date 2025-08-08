import React, { useEffect, useState } from 'react';
import { fetchResults ,fetchAllResults} from '../api/parkrunAPI';
import './ResultsTable.css'; // Create this CSS file for sticky headers
import { formatDate,formatDate1,formatDate2 } from '../utilities'; // Utility function to format dates

const queryOptions = [
    { value: 'recent', label: 'Recent Events' },
    { value: 'last50', label: 'Last 50 Events' },
    { value: 'all', label: 'All Events' },

    // Add more options here as needed
];

const Results: React.FC = () => {
    const [results, setResults] = useState<any[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [query, setQuery] = useState<string>('recent');
    const [sortBy, setSortBy] = useState<'event' | 'total'>('event');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
    const [aggregation, setAggregation] = useState<'total' | 'average'>('total');

useEffect(() => {
    const getResults = async () => {
        setLoading(true);
        try {
            let data;
            if (query === 'all') {
                data = await fetchAllResults();
            } else if (query === 'last50') {
                data = await fetchResults(50);
            } else {
                data = await fetchResults();
            }
            setResults(Array.isArray(data) ? data : []);
        } catch (err) {
            setError('Failed to fetch results');
        } finally {
            setLoading(false);
        }
    };
    getResults();
}, [query]);

    if (loading) return <div>Loading...</div>;
    if (error) return <div>{error}</div>;
    if (!results.length) return <div>No results found.</div>;

    // Get unique event_codes and event_dates
    const eventCodes = Array.from(new Set(results.map(r => r.event_code)))
        .sort((a, b) => Number(a) - Number(b));

    const eventDates = Array.from(new Set(results.map(r => r.event_date)))
        .sort((a, b) => new Date(b).getTime() - new Date(a).getTime()); // Latest first

    // Build a lookup for last_position
    const positionLookup: { [key: string]: { [key: string]: number } } = {};
    results.forEach(r => {
        if (!positionLookup[r.event_date]) positionLookup[r.event_date] = {};
        positionLookup[r.event_date][r.event_code] = r.last_position;
    });
    const eventTotals: { [code: string]: number } = {};
    eventCodes.forEach(code => {
        eventTotals[code] = eventDates.reduce((sum, date) => {
            const val = positionLookup[date]?.[code];
            return sum + (typeof val === 'number' ? val : 0);}, 0);
        if (aggregation === 'average') {    
            const count = eventDates.reduce((cnt, date) => {
                const val = positionLookup[date]?.[code];
                return cnt + (typeof val === 'number' ? 1 : 0);
            }, 0);
        eventTotals[code] = count > 0 ? Math.round(eventTotals[code] / count) : 0;
        } 
    }
       
   );
    const sortedEventCodes = [...eventCodes].sort((a, b) => {
        if (sortBy === 'event') {
            const nameA = (results.find(r => r.event_code === a)?.event_name || a).toLowerCase();
            const nameB = (results.find(r => r.event_code === b)?.event_name || b).toLowerCase();
            return sortDir === 'asc' ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
        } else {
            return sortDir === 'asc'
                ? eventTotals[a] - eventTotals[b]
                : eventTotals[b] - eventTotals[a];
        }
    });

    return (
        <div className="page-content">
            <div style={{ marginBottom: '0.5em', marginLeft: '0.5cm', display: 'flex', alignItems: 'center' }}>
                <label htmlFor="query-select" style={{ marginRight: '1em' }}>Analysis:</label>
                <select
                    id="query-select"
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                >
                    {queryOptions.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                </select>
    
            </div>
            <div style={{ marginBottom: '0.5em',marginLeft: '0.1cm', display: 'flex', alignItems: 'center' }}>
            <label htmlFor="aggregation-select" style={{ margin: '0 1em 0 2em' }}>Show:</label>
            <button
                style={{ marginLeft: '0.2em' }}
                onClick={() => setAggregation(aggregation === 'total' ? 'average' : 'total')}
            >
                {aggregation === 'total' ? 'Show Averages' : 'Show Totals'}
            </button>
            </div>
            <div className="results-table-container">
                <table className="results-table">
                    <thead>
                        <tr>
                            <th
                                colSpan={2}
                                className="sticky-corner-wide"
                                style={{ textAlign: 'center' }}
                            >
                                Participation
                            </th>
                            {eventDates.map(date => (
                                <th key={date} className="sticky-header">{formatDate2(date)}</th>
                            ))}
                        </tr>
                        <tr>
                            <th
                                className="sticky-col sticky-corner-2-1"
                                style={{ cursor: 'pointer' }}
                                onClick={() => {
                                    setSortBy('event');
                                    setSortDir(sortBy === 'event' && sortDir === 'asc' ? 'desc' : 'asc');
                                }}
                            >
                                Event {sortBy === 'event'
                                    ? (sortDir === 'asc' ? '▲' : '▼')
                                    : <span style={{ opacity: 0.3 }}>▲▼</span>}
                            </th>
                            <th
                                className="sticky-col-2 sticky-corner-2-2"
                                style={{ cursor: 'pointer' }}
                                onClick={() => {
                                    setSortBy('total');
                                    setSortDir(sortBy === 'total' && sortDir === 'asc' ? 'desc' : 'asc');
                                }}
                            >
                                {aggregation === 'average' ? 'Avg' : 'Total'}{' '}
                                {sortBy === 'total'
                                    ? (sortDir === 'asc' ? '▲' : '▼')
                                    : <span style={{ opacity: 0.3 }}>▲▼</span>}
                            </th>
                            {eventDates.map(date => {
                                // Sum all values for this date
                                const sum = eventCodes.reduce((acc, code) => {
                                    const val = positionLookup[date]?.[code];
                                    return acc + (typeof val === 'number' ? val : 0);
                                }, 0);
                                // Count valid numbers for this date
                                const count = eventCodes.reduce((cnt, code) => {
                                    const val = positionLookup[date]?.[code];
                                    return cnt + (typeof val === 'number' ? 1 : 0);
                                }, 0);
                                // Show average or total
                                const value = aggregation === 'average'
                                    ? (count > 0 ? Math.round(sum / count) : 0)
                                    : sum;
                                return (
                                    <th key={date} className="sticky-header second-row">{value}</th>
                                );
                            })}
                        </tr>
                    </thead>
                    <tbody>
                        {sortedEventCodes.map(code => (
                            <tr key={code}>
                                <td className="sticky-col">
                                    {results.find(r => r.event_code === code)?.event_name || code}
                                </td>
                                <td className="sticky-col-2">
                                    {eventTotals[code]}
                                </td>
                                {eventDates.map(date => (
                                    <td key={date}>
                                        {positionLookup[date] && positionLookup[date][code] !== undefined
                                            ? positionLookup[date][code] === 0
                                                ? ''
                                                : positionLookup[date][code]
                                            : ''}
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