import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import './lists.css'; // Import the new CSS file
import './ResultsTable.css';

// Define the type for a single run record based on the API output
type Run = {
    age_grade: string;
    age_group: string;
    athlete_code: string;
    club: string;
    comment: string;
    event_code: number;
    event_date: string;
    event_name?: string;
    name: string;
    position: number;
    time: string;
    originalRank?: number;
    season_adj_time?: string;
    event_adj_time?: string;
    age_adj_time?: string;
    sex_adj_time?: string;
    age_event_adj_time?: string;
    sex_event_adj_time?: string;
    age_sex_adj_time?: string;
    age_sex_event_adj_time?: string;
};

// Map list keys to API endpoints
const listApiEndpoints: { [key: string]: string } = {
    fastest_runs: 'https://hello-world-9yb9.onrender.com/api/lists/fastest_runs',
    // Add other list endpoints here in the future
};

// Utility function to format date from DD/MM/YYYY to DDMonYY
const formatDate = (dateString: string): string => {
    try {
        const parts = dateString.split('/');
        if (parts.length !== 3) return dateString;

        const day = parts[0];
        const month = parseInt(parts[1], 10);
        const year = parts[2].slice(-2); // Get last two digits of the year

        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const monthName = monthNames[month - 1];

        return `${day}${monthName}${year}`;
    } catch (error) {
        console.error("Error formatting date:", error);
        return dateString; // Return original string on error
    }
};

const Lists: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();

    // Initialize selections from URL params or sessionStorage so state is preserved when navigating back
    const urlParamsInit = new URLSearchParams(location.search);
    const storedList = sessionStorage.getItem('lists:selectedList');
    const storedCourse = sessionStorage.getItem('lists:courseAdj');
    const storedOther = sessionStorage.getItem('lists:otherAdj');
    const initialList = urlParamsInit.get('list') || storedList || 'fastest_runs';
    const initialCourse = ((): '1' | '2' | '3' => {
        const v = urlParamsInit.get('courseAdj') || storedCourse;
        return v === '2' || v === '3' ? (v as '2' | '3') : '1';
    })();
    const initialOther = ((): '1' | '2' | '3' | '4' => {
        const v = urlParamsInit.get('otherAdj') || storedOther;
        return v === '2' || v === '3' || v === '4' ? (v as '2' | '3' | '4') : '1';
    })();

    const [selectedList, setSelectedList] = useState<string>(initialList);
    const [runs, setRuns] = useState<Run[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [sortKey, setSortKey] = useState<string>('Rank');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
    const [courseAdj, setCourseAdj] = useState<'1' | '2' | '3'>(initialCourse);
    const [otherAdj, setOtherAdj] = useState<'1' | '2' | '3' | '4'>(initialOther);

    useEffect(() => {
        const fetchRuns = async () => {
            setLoading(true);
            setError(null);

            const endpoint = listApiEndpoints[selectedList];
            if (!endpoint) {
                setError('Invalid list selection.');
                setLoading(false);
                return;
            }

            try {
                    // If the selected list is the server-side "fastest_runs", request the
                    // extended API with sorting and a sensible limit to match server expectations.
                    let url = endpoint;
                    if (selectedList === 'fastest_runs') {
                        // Determine sort field from courseAdj/otherAdj selections
                        const getSortField = (course: string, other: string): string => {
                            // course: '1' none, '2' season, '3' full
                            // other: '1' none, '2' age, '3' sex, '4' age+sex
                            if (course === '1' && other === '1') return 'time_seconds';
                            if (course === '2') return 'season_adj_time_seconds';
                            if (course === '3' && other === '1') return 'event_adj_time_seconds';
                            if (course === '1' && other === '2') return 'age_adj_time_seconds';
                            if (course === '3' && other === '2') return 'age_event_adj_time_seconds';
                            if (course === '1' && other === '3') return 'sex_adj_time_seconds';
                            if (course === '3' && other === '3') return 'sex_event_adj_time_seconds';
                            if (course === '1' && other === '4') return 'age_sex_adj_time_seconds';
                            if (course === '3' && other === '4') return 'age_sex_event_adj_time_seconds';
                            // Fallback
                            return 'time_seconds';
                        };

                        // If course seasonal (2) was chosen, otherAdj should default to '1'
                        const effectiveOther = courseAdj === '2' ? '1' : otherAdj;
                        const sortField = getSortField(courseAdj, effectiveOther);

                        const params = new URLSearchParams({
                            sort: sortField,
                            direction: 'asc',
                            limit: '1000'
                        });
                        url = `${endpoint}?${params.toString()}`;
                    }

                    const response = await fetch(url);
                    if (!response.ok) {
                        throw new Error(`Failed to fetch data: ${response.statusText}`);
                    }
                    const data: Run[] = await response.json();
                // Attach original rank to each run
                const ranked = data.map((run, idx) => ({ ...run, originalRank: idx + 1 }));
                setRuns(ranked);
            } catch (err: any) {
                setError(err.message || 'An unexpected error occurred.');
            } finally {
                setLoading(false);
            }
        };

        fetchRuns();
    }, [selectedList, courseAdj, otherAdj]);

    const handleListSelect = (event: React.ChangeEvent<HTMLSelectElement>) => {
        const v = event.target.value;
        setSelectedList(v);
        sessionStorage.setItem('lists:selectedList', v);
    };

    const handleCourseAdjSelect = (event: React.ChangeEvent<HTMLSelectElement>) => {
        const v = event.target.value as '1' | '2' | '3';
        setCourseAdj(v);
        sessionStorage.setItem('lists:courseAdj', v);
        // If seasonal chosen, reset otherAdj to '1' (no adjustment)
        if (v === '2') {
            setOtherAdj('1');
            sessionStorage.setItem('lists:otherAdj', '1');
        }
    };

    const handleOtherAdjSelect = (event: React.ChangeEvent<HTMLSelectElement>) => {
        const v = event.target.value as '1' | '2' | '3' | '4';
        setOtherAdj(v);
        sessionStorage.setItem('lists:otherAdj', v);
    };

    // Keep URL query params in sync so selections persist across navigation/back
    React.useEffect(() => {
        const params = new URLSearchParams(location.search);
        params.set('list', selectedList);
        params.set('courseAdj', courseAdj);
        params.set('otherAdj', otherAdj);
        // replace so history isn't noisy
        navigate(`${location.pathname}?${params.toString()}`, { replace: true });
        // persist selections so Back/Forward can restore even if URL entries differ
        sessionStorage.setItem('lists:selectedList', selectedList);
        sessionStorage.setItem('lists:courseAdj', courseAdj);
        sessionStorage.setItem('lists:otherAdj', otherAdj);
    }, [selectedList, courseAdj, otherAdj]);

    // When the location.search changes (e.g., user hits Back/Forward), restore selections
    React.useEffect(() => {
        const params = new URLSearchParams(location.search);
        const list = params.get('list') || null;
        const course = params.get('courseAdj') || null;
        const other = params.get('otherAdj') || null;

        const savedList = sessionStorage.getItem('lists:selectedList');
        const savedCourse = sessionStorage.getItem('lists:courseAdj');
        const savedOther = sessionStorage.getItem('lists:otherAdj');

        // If URL explicitly provides values, prefer them. If they are missing or default and we have saved values, restore saved.
        if (list) {
            if (list !== selectedList) setSelectedList(list);
        } else if (savedList && savedList !== selectedList) {
            setSelectedList(savedList);
        }

        if (course) {
            const c = (course === '2' || course === '3') ? (course as '2' | '3') : '1';
            if (c !== courseAdj) setCourseAdj(c);
        } else if (savedCourse && savedCourse !== courseAdj) {
            setCourseAdj(savedCourse as '1' | '2' | '3');
        }

        if (other) {
            const o = (other === '2' || other === '3' || other === '4') ? (other as '2' | '3' | '4') : '1';
            if (o !== otherAdj) setOtherAdj(o);
        } else if (savedOther && savedOther !== otherAdj) {
            setOtherAdj(savedOther as '1' | '2' | '3' | '4');
        }
    }, [location.search]);

    // Column definitions for sorting
    const columns = [
        { key: 'Rank', label: 'Rk', className: 'sticky-header sticky-corner-2-1' },
        { key: 'Name', label: 'Name', className: 'sticky-header sticky-col-2' },
        { key: 'Time', label: 'Time', className: 'sticky-header' },
        { key: 'Date', label: 'Date', className: 'sticky-header' },
        { key: 'Pos', label: 'Pos', className: 'sticky-header' },
        { key: 'Age Grd', label: 'Age Grd', className: 'sticky-header' },
        { key: 'Age Grp', label: 'Age Grp', className: 'sticky-header' },
        { key: 'Event', label: 'Event Name', className: 'sticky-header event-name-header-col' },
        { key: 'Comment', label: 'Comment', className: 'sticky-header' },
        { key: 'Club', label: 'Club', className: 'sticky-header' },
        { key: 'Season', label: 'Season', className: 'sticky-header' },
        { key: 'EventAdj', label: 'Event', className: 'sticky-header' },
        { key: 'AgeAdj', label: 'Age', className: 'sticky-header' },
        { key: 'SexAdj', label: 'Sex', className: 'sticky-header' },
        { key: 'EventAgeAdj', label: 'Ev+Age', className: 'sticky-header' },
        { key: 'EventSexAdj', label: 'Ev+Sx', className: 'sticky-header' },
        { key: 'AgeSexAdj', label: 'Age+Sx', className: 'sticky-header' },
        { key: 'EventAgeSexAdj', label: 'Ev+A+Sx', className: 'sticky-header' },

    ];

    // Helper to get ISO date for sorting
    const getIsoDate = (dateStr: string): string => {
        // Try to parse DD/MM/YYYY or YYYY-MM-DD
        if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
            const [dd, mm, yyyy] = dateStr.split('/');
            return `${yyyy}-${mm}-${dd}`;
        }
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
            return dateStr;
        }
        // fallback: try Date parse
        const d = new Date(dateStr);
        if (!isNaN(d.getTime())) {
            return d.toISOString().slice(0, 10);
        }
        return dateStr;
    };

    // Sorting logic
    const sortedRuns = React.useMemo(() => {
        if (!runs || runs.length === 0) return [];
        const getValue = (run: Run, colKey: string, index: number) => {
            switch (colKey) {
                case 'Rank': return run.originalRank ?? (index + 1);
                case 'Name': return run.name;
                case 'Time': return run.time;
                case 'Date': return getIsoDate(run.event_date);
                case 'Event': return run.event_name || run.event_code;
                case 'Pos': return run.position;
                case 'Age Grd': return run.age_grade;
                case 'Age Grp': return run.age_group;
                case 'Comment': return run.comment;
                case 'Club': return run.club;
                case 'Season': return run.season_adj_time ?? '';
                case 'EventAdj': return run.event_adj_time ?? '';
                case 'AgeAdj': return run.age_adj_time ?? '';
                case 'SexAdj': return run.sex_adj_time ?? '';
                case 'EventAgeAdj': return run.age_event_adj_time ?? '';
                case 'EventSexAdj': return run.sex_event_adj_time ?? '';
                case 'AgeSexAdj': return run.age_sex_adj_time ?? '';
                case 'EventAgeSexAdj': return run.age_sex_event_adj_time ?? '';
                default: return '';
            }
        };
        const compare = (a: Run, b: Run, idxA: number, idxB: number) => {
            const valA = getValue(a, sortKey, idxA);
            const valB = getValue(b, sortKey, idxB);
            if (sortKey === 'Rank' || sortKey === 'Event' || sortKey === 'Pos') {
                const numA = Number(valA);
                const numB = Number(valB);
                if (!isNaN(numA) && !isNaN(numB)) {
                    return sortDir === 'asc' ? numA - numB : numB - numA;
                }
                // fallback to string compare if not numbers
                const strA = String(valA).toLowerCase();
                const strB = String(valB).toLowerCase();
                if (strA === strB) return 0;
                return sortDir === 'asc' ? (strA < strB ? -1 : 1) : (strA > strB ? -1 : 1);
            }
            if (sortKey === 'Date') {
                // Sort by ISO date string
                if (valA < valB) return sortDir === 'asc' ? -1 : 1;
                if (valA > valB) return sortDir === 'asc' ? 1 : -1;
                return 0;
            }
            // String comparison
            const strA = String(valA).toLowerCase();
            const strB = String(valB).toLowerCase();
            if (strA === strB) return 0;
            return sortDir === 'asc' ? (strA < strB ? -1 : 1) : (strA > strB ? -1 : 1);
        };
        return runs.slice().sort((a, b) => compare(a, b, runs.indexOf(a), runs.indexOf(b)));
    }, [runs, sortKey, sortDir]);

    // Determine which header should be highlighted based on current list/course/other selections
    const getActiveHeaderKey = (): string => {
        if (selectedList !== 'fastest_runs') return '';
        // course: '1' none, '2' season, '3' full
        // other: '1' none, '2' age, '3' sex, '4' age+sex
        if (courseAdj === '1' && otherAdj === '1') return 'Time';
        if (courseAdj === '2' && otherAdj === '1') return 'Season';
        if (courseAdj === '3' && otherAdj === '1') return 'EventAdj';
        if (courseAdj === '1' && otherAdj === '2') return 'AgeAdj';
        if (courseAdj === '3' && otherAdj === '2') return 'EventAgeAdj';
        if (courseAdj === '1' && otherAdj === '3') return 'SexAdj';
        if (courseAdj === '3' && otherAdj === '3') return 'EventSexAdj';
        if (courseAdj === '1' && otherAdj === '4') return 'AgeSexAdj';
        if (courseAdj === '3' && otherAdj === '4') return 'EventAgeSexAdj';
        return '';
    };

    const handleSort = (colKey: string) => {
        setSortKey(colKey);
        setSortDir(prev => (colKey === sortKey ? (prev === 'asc' ? 'desc' : 'asc') : 'asc'));
    };

    // Navigation for row click
    const handleRowClick = (run: Run) => {
        // event_code is the event number, event_date is the date
        const params = new URLSearchParams();
        params.set('event_code', String(run.event_code));
        params.set('date', String(run.event_date));
        params.set('from_list', '1');
        window.location.href = `/races?${params.toString()}`;
    };

    // Navigation for name click
    const handleNameClick = (e: React.MouseEvent, run: Run) => {
        e.stopPropagation();
        const params = new URLSearchParams();
        params.set('athlete_code', String(run.athlete_code));
        params.set('from_list', '1');
        params.set('event_date', String(run.event_date)); // Pass the event date for highlighting
        // Preserve current list/course/other selections so they can be restored on return
        params.set('list', selectedList);
        params.set('courseAdj', courseAdj);
        params.set('otherAdj', otherAdj);
        navigate(`/athletes?${params.toString()}`, {
            state: {
                athleteCode: String(run.athlete_code),
                athleteName: String(run.name || ''),
                from: 'lists',
                returnTo: {
                    pathname: '/lists',
                    search: `?${new URLSearchParams({
                        list: selectedList,
                        courseAdj,
                        otherAdj
                    }).toString()}`
                }
            }
        });
    };

    return (
        <div className="page-content athletes-page lists-page">
            <div className="athlete-header">
                <div className="athlete-header-main">
                    <div className="athlete-header-text">
                        <div className="athlete-header-title">
                            Top 1000 List
                        </div>
                    </div>
                    <div className="athlete-view-control races-view-control">
                        <div className="races-view-control-item">
                            <label htmlFor="list-select">List selection:</label>
                            <select
                                id="list-select"
                                value={selectedList}
                                onChange={handleListSelect}
                                aria-label="List selection"
                            >
                                <option value="fastest_runs">Fastest Athletes by Time</option>
                                {/* Add other <option> elements for new lists here */}
                            </select>
                        </div>
                        <div className="races-view-control-item">
                            <label htmlFor="lists-course-adj-select">Course adj:</label>
                            <select
                                id="lists-course-adj-select"
                                value={courseAdj}
                                onChange={handleCourseAdjSelect}
                                aria-label="Course adjustment"
                            >
                                <option value="1">no adjustment (default)</option>
                                <option value="2">seasonal adjustments</option>
                                <option value="3">full event adjustments</option>
                            </select>
                        </div>
                        <div className="races-view-control-item">
                            <label htmlFor="lists-other-adj-select">Other adj:</label>
                            <select
                                id="lists-other-adj-select"
                                value={otherAdj}
                                onChange={handleOtherAdjSelect}
                                aria-label="Other adjustment"
                            >
                                <option value="1">no adjustment (default)</option>
                                <option value="2">age adjustments</option>
                                <option value="3">sex adjustments</option>
                                <option value="4">age & sex adjustment</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>

            <section className="athlete-runs-section">
                <div className="athlete-runs-table-wrapper">
                    {loading && <p>Loading...</p>}
                    {error && <p style={{ color: 'red' }}>Error: {error}</p>}
                    {!loading && !error && (
                        <table className="athlete-runs-table lists-table">
                            <thead>
                                <tr>
                                    {columns.map(col => {
                                        const isSorted = sortKey === col.key;
                                        const sortIndicator = isSorted ? (sortDir === 'asc' ? '▲' : '▼') : '';
                                        const activeKey = getActiveHeaderKey();
                                        const extraClass = (col.key === activeKey) ? ' active-selected-header' : '';
                                        return (
                                            <th
                                                key={col.key}
                                                className={col.className + extraClass}
                                                onClick={() => handleSort(col.key)}
                                                style={{ cursor: 'pointer', userSelect: 'none' }}
                                                tabIndex={0}
                                                aria-sort={isSorted ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                                            >
                                                <span>{col.label}</span>
                                                <span style={{ marginLeft: 4 }}>{sortIndicator}</span>
                                            </th>
                                        );
                                    })}
                                </tr>
                            </thead>
                            <tbody>
                                {sortedRuns.map((run, index) => (
                                    <tr
                                        key={`${run.athlete_code}-${run.event_date}`}
                                        onClick={() => handleRowClick(run)}
                                        style={{ cursor: 'pointer' }}
                                        title="Click to view this event"
                                    >
                                        <td className="sticky-col">{run.originalRank ?? (index + 1)}</td>
                                        <td
                                            className="sticky-col-2"
                                            title={run.name}
                                            style={{ color: '#0077cc', textDecoration: 'underline', cursor: 'pointer' }}
                                            onClick={e => handleNameClick(e, run)}
                                        >
                                            {run.name}
                                        </td>
                                        <td>{run.time}</td>
                                        <td>{formatDate(run.event_date)}</td>
                                        <td>{run.position}</td>
                                        <td>{run.age_grade}</td>
                                        <td>{run.age_group}</td>
                                        <td className="event-name-body-col">{run.event_name || run.event_code}</td>
                                        <td>{run.comment}</td>
                                        <td>{run.club}</td>                                        
                                        <td>{run.season_adj_time ?? ''}</td>
                                        <td>{run.event_adj_time ?? ''}</td>
                                        <td>{run.age_adj_time ?? ''}</td>
                                        <td>{run.sex_adj_time ?? ''}</td>
                                        <td>{run.age_event_adj_time ?? ''}</td>
                                        <td>{run.sex_event_adj_time ?? ''}</td>
                                        <td>{run.age_sex_adj_time ?? ''}</td>
                                        <td>{run.age_sex_event_adj_time ?? ''}</td>

                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </section>
        </div>
    );
};

export default Lists;
