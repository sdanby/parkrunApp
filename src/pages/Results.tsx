import React, { useEffect, useState } from 'react';
import { fetchResults ,fetchAllResults} from '../api/parkrunAPI';
import './ResultsTable.css'; // Create this CSS file for sticky headers
import { formatDate,formatDate1,formatDate2,formatAvgTime } from '../utilities'; // Utility function to format dates

const queryOptions = [
    { value: 'recent', label: 'Recent Events' },
    { value: 'last50', label: 'Last 50 Events' },
    { value: 'all', label: 'All Events' },

    // Add more options here as needed
];
const analysisOptions = [
    { value: 'participants', label: 'Participants' },
    { value: 'avgTimes', label: 'Average Times' },
    { value: 'medTimes', label: 'Median Times' },

    // Add more options here as needed
];
const avgOptions = [
    { value: 'all', label: 'All Times' },
    { value: 'lt12', label: 'times < 12%' },
    { value: 'lt5', label: 'times < 5%'},

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
    const [analysisType, setAnalysisType] = useState<string>('participants');
    const [avgType, setAvgType] = useState<string>('all');

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
    useEffect(() => {
        if (analysisType === 'participants' && avgType !== 'all') {
            setAvgType('all');
        }
    }, [analysisType, avgType]);

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
    // Build a lookup for avg_time
    const avgTimeLookup: { [key: string]: { [key: string]: number } } = {};
        results.forEach(r => {
            if (!avgTimeLookup[r.event_date]) avgTimeLookup[r.event_date] = {};
            //if (r.event_code == 1) console.log('r.avg_time:', r.event_code, r.event_date,r.avg_time);
            avgTimeLookup[r.event_date][r.event_code] = r.avg_time;
        });

    // Add after avgTimeLookup
    const avgTimeLim12Lookup: { [key: string]: { [key: string]: number } } = {};
        //console.log('results:', results);
        results.forEach(r => {
            if (!avgTimeLim12Lookup[r.event_date]) avgTimeLim12Lookup[r.event_date] = {};
            //if (r.event_code == 1) console.log('r.avg_time:', r.event_code, r.event_date,r.avgTimeLim12);
            avgTimeLim12Lookup[r.event_date][r.event_code] = r.avgtimelim12;
        });

    // Add after avgTimeLookup
    const avgTimeLim5Lookup: { [key: string]: { [key: string]: number } } = {};
        //console.log('results:', results);
        results.forEach(r => {
            if (!avgTimeLim5Lookup[r.event_date]) avgTimeLim5Lookup[r.event_date] = {};
            //if (r.event_code == 1) console.log('r.avg_time:', r.event_code, r.event_date,r.avgtimelim5);
            avgTimeLim5Lookup[r.event_date][r.event_code] = r.avgtimelim5;
        });
    
    //console.log('avgTimeLookup:', avgTimeLookup);   
    const eventTotals: { [code: string]: number } = {};
        //console.log('Analysis Type:', analysisType,avgType);
        eventCodes.forEach(code => {
            if (analysisType === 'avgTimes') {
                let sum = 0;
                let count = 0;
                eventDates.forEach(date => {
                    let val: number | undefined;
                    if (avgType === 'lt12') {
                        //console.log('avgTimeLim12Lookup:', avgTimeLim12Lookup);
                        val = avgTimeLim12Lookup[date]?.[code];
                    } else {
                        if (avgType === 'lt5') {
                            val = avgTimeLim5Lookup[date]?.[code];
                        } else {
                            //console.log('avgTimeLookup:', avgTimeLookup);
                            val = avgTimeLookup[date]?.[code];
                        }
                    }
                    if (typeof val === 'number' && !isNaN(val)) {
                        sum += val;
                        count += 1;
                    }
                });
                eventTotals[code] = count > 0 ? Math.round(sum / count) : 0;
            } else {
                // Default: use positioneventDates.map(dateLookup for participants
                eventTotals[code] = eventDates.reduce((sum, date) => {
                    const val = positionLookup[date]?.[code];
                    return sum + (typeof val === 'number' ? val : 0);
                }, 0);
                if (aggregation === 'average') {    
                    const count = eventDates.reduce((cnt, date) => {
                        const val = positionLookup[date]?.[code];
                        return cnt + (typeof val === 'number' ? 1 : 0);
                    }, 0);
                    eventTotals[code] = count > 0 ? Math.round(eventTotals[code] / count) : 0;
                }
            }
        });
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
            <div style={{ marginBottom: '0.5em', marginLeft: '0.4cm', display: 'flex', alignItems: 'center' }}>
                <label htmlFor="query-select" style={{ marginRight: '1.5em' }}>Analysis:</label>
                <select
                    id="query-select"
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                >
                    {queryOptions.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                </select>
                {/* New select box for analysis type */}
                <label htmlFor="analysis-type-select" style={{ margin: '0 0.5em 0 0.5em' }}></label>
                <select
                    id="analysis-type-select"
                    value={analysisType}
                    onChange={e => setAnalysisType(e.target.value)}
                >
                    {analysisOptions.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                </select>

            </div>
            <div style={{ marginBottom: '0.5em',marginLeft: '0.1cm', display: 'flex', alignItems: 'center' }}>
            <label htmlFor="aggregation-select" style={{ margin: '0 1em 0 2em' }}>Show:</label>
            <button
                    style={{
                        marginLeft: '0.2em',
                        backgroundColor: 'lightgray', // optional: for a light background
                        color: '#222', // optional: for dark text
                        border: '1px solid #111', // optional: for a subtle border
                        borderRadius: '4px',      // optional: for rounded corners
                        width: '115px',      // Make it wider
                        padding: '0.1em 0.7em'      // optional: for spacing
                    }}
                onClick={() => setAggregation(aggregation === 'total' ? 'average' : 'total')}
                    >
                {aggregation === 'total' ? 'Showing Totals' : 'Showing Avgs'}
            </button>
            <label htmlFor="avg-type-select" style={{ 
                                                margin: '0 0.8em 0.9em 0.3em' 
                                                }}></label>
            <select
                id="avg-type-select"
                value={avgType}
                onChange={e => setAvgType(e.target.value)}
                style={{
                    width: '110px',
                }}
                disabled={analysisType === 'participants'}
            >
                {avgOptions
                    .filter(opt => analysisType !== 'participants' || opt.value === 'all')
                    .map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
            </select>
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
                                {analysisType === 'avgTimes'
                                    ? 'Avg Time'
                                    : aggregation === 'average' ? 'Avg' : 'Total'}{' '}
                                {sortBy === 'total'
                                    ? (sortDir === 'asc' ? '▲' : '▼')
                                    : <span style={{ opacity: 0.3 }}>▲▼</span>}
                            </th>
                                {eventDates.map(date => {
                                    if (analysisType === 'avgTimes') {
                                        let sum = 0;
                                        let count = 0;
                                        eventCodes.forEach(code => {
                                            let val: number | undefined;
                                            if (avgType === 'lt12') {
                                                val = avgTimeLim12Lookup[date]?.[code];
                                            } else {
                                                if (avgType === 'lt5') {
                                                    val = avgTimeLim5Lookup[date]?.[code];
                                                } else {
                                                    val = avgTimeLookup[date]?.[code];
                                                }
                                            }
                                            if (typeof val === 'number' && !isNaN(val)) {
                                                sum += val;
                                                count += 1;
                                            }
                                        });
                                        const avg = count > 0 ? Math.round(sum / count) : 0;
                                        return (
                                            <th key={date} className="sticky-header second-row">
                                                {formatAvgTime(avg)}
                                            </th>
                                        );
                                    } else {
                                        // Existing logic for participants
                                        const sum = eventCodes.reduce((acc, code) => {
                                            const val = positionLookup[date]?.[code];
                                            return acc + (typeof val === 'number' ? val : 0);
                                        }, 0);
                                        const count = eventCodes.reduce((cnt, code) => {
                                            const val = positionLookup[date]?.[code];
                                            return cnt + (typeof val === 'number' ? 1 : 0);
                                        }, 0);
                                        const value = aggregation === 'average'
                                            ? (count > 0 ? Math.round(sum / count) : 0)
                                            : sum;
                                        return (
                                            <th key={date} className="sticky-header second-row">{value}</th>
                                        );
                                    }
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
                                    {analysisType === 'avgTimes'
                                        ? formatAvgTime(eventTotals[code])
                                        : eventTotals[code]}
                                </td>
                                {eventDates.map(date => (
                                    <td key={date}>
                                        {analysisType === 'avgTimes'
                                            ? (
                                                avgType === 'lt12'
                                                    ? (
                                                        avgTimeLim12Lookup[date] && avgTimeLim12Lookup[date][code] !== undefined
                                                            ? formatAvgTime(avgTimeLim12Lookup[date][code])
                                                            : ''
                                                    )
                                                    : (avgType === 'lt5'
                                                        ? (
                                                            avgTimeLim5Lookup[date] && avgTimeLim5Lookup[date][code] !== undefined
                                                                ? formatAvgTime(avgTimeLim5Lookup[date][code])
                                                                : ''
                                                        )
                                                        : (
                                                            avgTimeLookup[date] && avgTimeLookup[date][code] !== undefined
                                                                ? formatAvgTime(avgTimeLookup[date][code])
                                                                : ''
                                                        )
                                            ))
                                            : (
                                                positionLookup[date] && positionLookup[date][code] !== undefined
                                                    ? positionLookup[date][code] === 0
                                                        ? ''
                                                        : positionLookup[date][code]
                                                    : ''
                                            )
                                        }
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