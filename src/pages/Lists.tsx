import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { navigateWithNavStack } from '../utils/navigationStack';
import {
    getListsElementById,
    getListsElementPlacement,
    getListsViewportForWidth,
    getListsColumnWidth,
    type ListsViewport
} from '../config/layout/listLayoutHelper';
import { requestUnifiedHelp } from './UnifiedHelp';
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
    rank?: number | string;
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

const LISTS_RETURN_SCROLL_KEY = 'lists:return_scroll_v1';

const makeRunKey = (run: Pick<Run, 'athlete_code' | 'event_date'>): string => {
    const athlete = String(run.athlete_code ?? '').trim();
    const date = String(run.event_date ?? '').trim();
    return `${athlete}::${date}`;
};

// Map list keys to API endpoints
const listApiEndpoints: { [key: string]: string } = {
    fastest_runs: 'https://hello-world-9yb9.onrender.com/api/lists/fastest_runs',
    fastest_runs_last_year: 'https://hello-world-9yb9.onrender.com/api/lists/fastest_runs',
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

const useMediaQuery = (query: string): boolean => {
    const getMatch = () => {
        if (typeof window === 'undefined' || typeof window.matchMedia === 'undefined') {
            return false;
        }
        return window.matchMedia(query).matches;
    };
    const [matches, setMatches] = useState<boolean>(getMatch);
    useEffect(() => {
        if (typeof window === 'undefined' || typeof window.matchMedia === 'undefined') {
            return;
        }
        const mediaQueryList = window.matchMedia(query);
        const listener = () => setMatches(mediaQueryList.matches);
        listener();
        if (typeof mediaQueryList.addEventListener === 'function') {
            mediaQueryList.addEventListener('change', listener);
            return () => mediaQueryList.removeEventListener('change', listener);
        }
        mediaQueryList.addListener(listener);
        return () => mediaQueryList.removeListener(listener);
    }, [query]);
    return matches;
};

const Lists: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const isMobile = useMediaQuery('(max-width: 640px)');
    const [viewport, setViewport] = useState<ListsViewport>(() => getListsViewportForWidth(window.innerWidth));

    useEffect(() => {
        const onResize = () => setViewport(getListsViewportForWidth(window.innerWidth));
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    useEffect(() => {
        document.body.classList.add('lists-page-lock-scroll');
        return () => {
            document.body.classList.remove('lists-page-lock-scroll');
        };
    }, []);

    // Get layout placements for all UI elements (absolute positioning)
    const pTitle = getListsElementPlacement('lists.title', viewport);
    const pStatusLabel = getListsElementPlacement('lists.statusLabel', viewport);
    const pListLabel = getListsElementPlacement('lists.listLabel', viewport);
    const pListSelect = getListsElementPlacement('lists.listSelect', viewport);
    const pCourseAdjLabel = getListsElementPlacement('lists.courseAdjLabel', viewport);
    const pCourseAdjSelect = getListsElementPlacement('lists.courseAdjSelect', viewport);
    const pOtherAdjLabel = getListsElementPlacement('lists.otherAdjLabel', viewport);
    const pOtherAdjSelect = getListsElementPlacement('lists.otherAdjSelect', viewport);
    const pTableContainer = getListsElementPlacement('lists.tableContainer', viewport);

    const titleElement = getListsElementById('lists.title');
    const statusLabelElement = getListsElementById('lists.statusLabel');
    const listLabelElement = getListsElementById('lists.listLabel');
    const courseAdjLabelElement = getListsElementById('lists.courseAdjLabel');
    const otherAdjLabelElement = getListsElementById('lists.otherAdjLabel');
    const controlsTopOffset = isMobile ? '1.1cm' : '0cm';

    // Initialize selections from URL params or sessionStorage so state is preserved when navigating back
    const urlParamsInit = new URLSearchParams(location.search);
    const storedList = sessionStorage.getItem('lists:selectedList');
    const storedCourse = sessionStorage.getItem('lists:courseAdj');
    const storedOther = sessionStorage.getItem('lists:otherAdj');
    const storedSortKey = sessionStorage.getItem('lists:sortKey');
    const storedSortDir = sessionStorage.getItem('lists:sortDir');
    const initialList = urlParamsInit.get('list') || storedList || 'fastest_runs';
    const initialCourse = ((): '1' | '2' | '3' => {
        const v = urlParamsInit.get('courseAdj') || storedCourse;
        return v === '2' || v === '3' ? (v as '2' | '3') : '1';
    })();
    const initialOther = ((): '1' | '2' | '3' | '4' => {
        const v = urlParamsInit.get('otherAdj') || storedOther;
        return v === '2' || v === '3' || v === '4' ? (v as '2' | '3' | '4') : '1';
    })();
    const initialSortKey = urlParamsInit.get('sortKey') || storedSortKey || 'Rank';
    const initialSortDir: 'asc' | 'desc' = (urlParamsInit.get('sortDir') === 'desc' || storedSortDir === 'desc') ? 'desc' : 'asc';

    const [selectedList, setSelectedList] = useState<string>(initialList);
    const [runs, setRuns] = useState<Run[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [sortKey, setSortKey] = useState<string>(initialSortKey);
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>(initialSortDir);
    const [courseAdj, setCourseAdj] = useState<'1' | '2' | '3'>(initialCourse);
    const [otherAdj, setOtherAdj] = useState<'1' | '2' | '3' | '4'>(initialOther);
    const [returnScrollHighlightKey, setReturnScrollHighlightKey] = useState<string | null>(null);
    const [pendingScrollKey, setPendingScrollKey] = useState<string | null>(null);
    const tableWrapperRef = useRef<HTMLDivElement | null>(null);
    const showRetrievingStatus = loading || Boolean(pendingScrollKey);

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
                    if (selectedList === 'fastest_runs' || selectedList === 'fastest_runs_last_year') {
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
                            period: selectedList === 'fastest_runs_last_year' ? 'last_year' : 'all_time',
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
        params.set('sortKey', sortKey);
        params.set('sortDir', sortDir);
        // replace so history isn't noisy
        navigate(`${location.pathname}?${params.toString()}`, { replace: true });
        // persist selections so Back/Forward can restore even if URL entries differ
        sessionStorage.setItem('lists:selectedList', selectedList);
        sessionStorage.setItem('lists:courseAdj', courseAdj);
        sessionStorage.setItem('lists:otherAdj', otherAdj);
        sessionStorage.setItem('lists:sortKey', sortKey);
        sessionStorage.setItem('lists:sortDir', sortDir);
    }, [selectedList, courseAdj, otherAdj, sortKey, sortDir]);

    // When the location.search changes (e.g., user hits Back/Forward), restore selections
    React.useEffect(() => {
        const params = new URLSearchParams(location.search);
        const list = params.get('list') || null;
        const course = params.get('courseAdj') || null;
        const other = params.get('otherAdj') || null;
        const sortKeyParam = params.get('sortKey') || null;
        const sortDirParam = params.get('sortDir') || null;

        const savedList = sessionStorage.getItem('lists:selectedList');
        const savedCourse = sessionStorage.getItem('lists:courseAdj');
        const savedOther = sessionStorage.getItem('lists:otherAdj');
        const savedSortKey = sessionStorage.getItem('lists:sortKey');
        const savedSortDir = sessionStorage.getItem('lists:sortDir');

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

        if (sortKeyParam) {
            if (sortKeyParam !== sortKey) setSortKey(sortKeyParam);
        } else if (savedSortKey && savedSortKey !== sortKey) {
            setSortKey(savedSortKey);
        }

        if (sortDirParam === 'asc' || sortDirParam === 'desc') {
            if (sortDirParam !== sortDir) setSortDir(sortDirParam);
        } else if ((savedSortDir === 'asc' || savedSortDir === 'desc') && savedSortDir !== sortDir) {
            setSortDir(savedSortDir);
        }
    }, [location.search]);

    // Column definitions for sorting
    const columns = [
        { key: 'Rank', label: 'Rk', className: 'sticky-header sticky-corner-2-1' },
        { key: 'Name', label: 'Name', className: 'sticky-header sticky-col-2' },
        { key: 'Time', label: 'Time', className: 'sticky-header' },
        { key: 'Date', label: 'Date', className: 'sticky-header' },
        { key: 'Pos', label: 'Pos', className: 'sticky-header' },
        { key: 'CurveRank', label: 'Rank', className: 'sticky-header' },
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

    // Helper to get column width from layout config
    const getColumnWidth = (columnKey: string): string | undefined => {
        return getListsColumnWidth(columnKey, viewport);
    };

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
                case 'CurveRank': return run.rank ?? '';
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
            if (sortKey === 'Rank' || sortKey === 'Event' || sortKey === 'Pos' || sortKey === 'CurveRank') {
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
        if (selectedList !== 'fastest_runs' && selectedList !== 'fastest_runs_last_year') return '';
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
        try {
            window.sessionStorage.setItem(LISTS_RETURN_SCROLL_KEY, JSON.stringify({
                key: makeRunKey(run)
            }));
        } catch { /* ignore */ }
        navigateWithNavStack(navigate, location, `/races?${params.toString()}`, {
            state: {
                from: 'lists',
                returnTo: {
                    pathname: '/lists',
                    search: `?${new URLSearchParams({
                        list: selectedList,
                        courseAdj,
                        otherAdj,
                        sortKey,
                        sortDir
                    }).toString()}`
                }
            }
        });
    };

    // Navigation for name click
    const handleNameClick = (e: React.MouseEvent, run: Run) => {
        e.stopPropagation();
        const params = new URLSearchParams();
        params.set('athlete_code', String(run.athlete_code));
        params.set('from_list', '1');
        params.set('event_date', String(run.event_date)); // Pass the event date for highlighting
        // Preserve current list/course/other selections so they can be restored on return
        try {
            window.sessionStorage.setItem(LISTS_RETURN_SCROLL_KEY, JSON.stringify({
                key: makeRunKey(run)
            }));
        } catch { /* ignore */ }
        params.set('list', selectedList);
        params.set('courseAdj', courseAdj);
        params.set('otherAdj', otherAdj);
        navigateWithNavStack(navigate, location, `/athletes?${params.toString()}`, {
            state: {
                athleteCode: String(run.athlete_code),
                athleteName: String(run.name || ''),
                from: 'lists',
                returnTo: {
                    pathname: '/lists',
                    search: `?${new URLSearchParams({
                        list: selectedList,
                        courseAdj,
                        otherAdj,
                        sortKey,
                        sortDir
                    }).toString()}`
                }
            }
        });
    };

    const handleCourseClick = (e: React.MouseEvent, run: Run) => {
        e.stopPropagation();

        const eventCode = String(run.event_code ?? '').trim();
        const eventName = String(run.event_name || '').trim();
        if (!eventCode && !eventName) {
            return;
        }

        const params = new URLSearchParams();
        if (eventCode) {
            params.set('event_code', eventCode);
        }
        if (eventName) {
            params.set('event_name', eventName);
        }

        const returnSearch = `?${new URLSearchParams({
            list: selectedList,
            courseAdj,
            otherAdj,
            sortKey,
            sortDir
        }).toString()}`;

        try {
            window.sessionStorage.setItem(LISTS_RETURN_SCROLL_KEY, JSON.stringify({
                key: makeRunKey(run)
            }));
        } catch { /* ignore */ }

        navigateWithNavStack(navigate, location, `/courses_test?${params.toString()}`, {
            state: {
                eventCode: eventCode || undefined,
                eventName: eventName || undefined,
                from: 'lists',
                returnTo: {
                    pathname: '/lists',
                    search: returnSearch
                }
            }
        });
    };

    const handleClubClick = (e: React.MouseEvent, run: Run) => {
        e.stopPropagation();

        const club = String(run.club || '').trim();
        if (!club || club === '--' || club.toLowerCase() === '<no club>') {
            return;
        }

        const params = new URLSearchParams();
        params.set('club', club);

        const returnSearch = `?${new URLSearchParams({
            list: selectedList,
            courseAdj,
            otherAdj,
            sortKey,
            sortDir
        }).toString()}`;

        try {
            window.sessionStorage.setItem(LISTS_RETURN_SCROLL_KEY, JSON.stringify({
                key: makeRunKey(run)
            }));
        } catch { /* ignore */ }

        navigateWithNavStack(navigate, location, `/clubs?${params.toString()}`, {
            state: {
                from: 'lists',
                returnTo: {
                    pathname: '/lists',
                    search: returnSearch
                }
            }
        });
    };

    // Ref keeps the scroll target alive across re-renders, preventing race conditions
    // where the URL-sync effect calls navigate() and changes location.key a second time.
    const pendingScrollKeyRef = useRef<string | null>(null);

    const tryConsumeScrollKey = React.useCallback(() => {
        if (pendingScrollKeyRef.current) return; // already captured, wait for scroll effect
        let raw: string | null = null;
        try {
            raw = window.sessionStorage.getItem(LISTS_RETURN_SCROLL_KEY);
            if (!raw) return;
            window.sessionStorage.removeItem(LISTS_RETURN_SCROLL_KEY);
        } catch { return; }
        try {
            const parsed = JSON.parse(raw) as { key?: string };
            const k = String(parsed?.key || '').trim();
            if (k) {
                pendingScrollKeyRef.current = k;
                setPendingScrollKey(k);
            }
        } catch { /* ignore */ }
    }, []);

    // Fires on every location change — catches back-navigation even when component stays mounted.
    useEffect(() => { tryConsumeScrollKey(); }, [location.key, tryConsumeScrollKey]);

    // Fires when data loads — catches the case where runs weren't ready when we first arrived.
    useEffect(() => { if (runs.length) tryConsumeScrollKey(); }, [runs, tryConsumeScrollKey]);

    // Performs the actual scroll + highlight once both the key and data are available.
    useEffect(() => {
        if (!pendingScrollKey || !runs.length) return;
        const targetKey = pendingScrollKey;
        pendingScrollKeyRef.current = null;
        const scrollTimeout = window.setTimeout(() => {
            const wrapper = tableWrapperRef.current;
            const rowEl = wrapper
                ? Array.from(wrapper.querySelectorAll<HTMLTableRowElement>('tr[data-run-key]')).find(
                    (row) => String(row.dataset.runKey || '').trim() === targetKey
                ) ?? null
                : null;
            if (rowEl && wrapper) {
                const rowRect = rowEl.getBoundingClientRect();
                const wrapperRect = wrapper.getBoundingClientRect();
                const rowTop = rowRect.top - wrapperRect.top + wrapper.scrollTop;
                const rowHeight = rowRect.height;
                const wrapperHeight = wrapper.clientHeight;
                const targetScrollTop = rowTop - (wrapperHeight / 2) + (rowHeight / 2);
                wrapper.scrollTo({ top: Math.max(0, targetScrollTop), behavior: 'smooth' });
                setReturnScrollHighlightKey(targetKey);
            }
            setPendingScrollKey(null);
        }, 200);
        return () => {
            window.clearTimeout(scrollTimeout);
        };
    }, [pendingScrollKey, runs]);

    return (
        <div
            className="page-content athletes-page lists-page"
            style={{
                position: 'relative',
                overflow: 'hidden',
                height: 'calc(100dvh - 56px)',
                minHeight: 'calc(100dvh - 56px)',
                boxSizing: 'border-box'
            }}
        >
            {/* Control Panel - Absolute positioning based on layout config */}
            <div
                style={{
                    position: 'absolute',
                    left: 0,
                    top: controlsTopOffset,
                    width: '100%',
                    height: '3.0cm',
                    pointerEvents: 'none',
                    zIndex: 2147483000
                }}
            >
                {/* Title */}
                <div style={{ position: 'absolute', left: pTitle?.x, top: pTitle?.y, pointerEvents: 'auto' }}>
                    <h1 style={{
                        fontSize: titleElement?.style?.fontSize ?? '1.2rem',
                        fontWeight: titleElement?.style?.fontWeight ?? 700,
                        color: titleElement?.style?.color ?? '#111827',
                        lineHeight: titleElement?.style?.lineHeight ?? 1.2,
                        margin: 0,
                        padding: 0
                    }}>
                        {titleElement?.name || 'Top 1000 List'}
                    </h1>
                </div>

                {showRetrievingStatus && (
                    <div
                        style={{
                            position: 'absolute',
                            left: pStatusLabel?.x ?? pTitle?.x,
                            top: pStatusLabel?.y ?? `calc(${pTitle?.y ?? '2.5cm'} + 0.6cm)`,
                            pointerEvents: 'none'
                        }}
                        aria-live="polite"
                    >
                        <span
                            style={{
                                fontSize: statusLabelElement?.style?.fontSize ?? '0.76rem',
                                fontWeight: statusLabelElement?.style?.fontWeight ?? 600,
                                color: statusLabelElement?.style?.color ?? '#1d4ed8',
                                lineHeight: statusLabelElement?.style?.lineHeight ?? 1.1
                            }}
                        >
                            {statusLabelElement?.name || 'retrieving results'}
                        </span>
                    </div>
                )}

                {/* List Selection Label */}
                <div style={{ position: 'absolute', left: pListLabel?.x, top: pListLabel?.y, pointerEvents: 'auto' }}>
                    {listLabelElement?.helpLabel ? (
                        <span className="help-tooltip" style={{ display: 'inline-flex' }}>
                            <button
                                type="button"
                                className="help-trigger help-trigger-label"
                                onClick={(event) => {
                                    const rect = (event.currentTarget as HTMLButtonElement).getBoundingClientRect();
                                    requestUnifiedHelp(listLabelElement?.helpTarget || 'control-list-select', {
                                        x: rect.left,
                                        y: rect.bottom
                                    });
                                }}
                                title={`${String(listLabelElement?.name || 'List selection').replace(/:\s*$/, '')} help`}
                                aria-label={`${String(listLabelElement?.name || 'List selection').replace(/:\s*$/, '')} help`}
                            >
                                <span
                                    className="help-trigger-text"
                                    style={{
                                        fontSize: listLabelElement?.style?.fontSize ?? '0.8rem',
                                        fontWeight: listLabelElement?.style?.fontWeight ?? 600,
                                        color: listLabelElement?.style?.color ?? '#111827',
                                        lineHeight: listLabelElement?.style?.lineHeight ?? 1.0
                                    }}
                                >
                                    {listLabelElement?.name || 'List selection:'}
                                </span>
                            </button>
                        </span>
                    ) : (
                        <label htmlFor="lists-layout-list-select" style={{
                            fontSize: listLabelElement?.style?.fontSize ?? '0.8rem',
                            fontWeight: listLabelElement?.style?.fontWeight ?? 600,
                            color: listLabelElement?.style?.color ?? '#111827',
                            lineHeight: listLabelElement?.style?.lineHeight ?? 1.0
                        }}>
                            {listLabelElement?.name || 'List selection:'}
                        </label>
                    )}
                </div>

                {/* List Selection Dropdown */}
                <select
                    id="lists-layout-list-select"
                    value={selectedList}
                    onChange={handleListSelect}
                    aria-label="List selection"
                    style={{
                        position: 'absolute',
                        left: pListSelect?.x,
                        top: pListSelect?.y,
                        width: pListSelect?.width,
                        pointerEvents: 'auto'
                    }}
                >
                    <option value="fastest_runs">Fastest Athletes - All Time</option>
                    <option value="fastest_runs_last_year">Fastest Athletes - Over last 1 Year</option>
                </select>

                {/* Course Adjustment Label */}
                <div style={{ position: 'absolute', left: pCourseAdjLabel?.x, top: pCourseAdjLabel?.y, pointerEvents: 'auto' }}>
                    {courseAdjLabelElement?.helpLabel ? (
                        <span className="help-tooltip" style={{ display: 'inline-flex' }}>
                            <button
                                type="button"
                                className="help-trigger help-trigger-label"
                                onClick={(event) => {
                                    const rect = (event.currentTarget as HTMLButtonElement).getBoundingClientRect();
                                    requestUnifiedHelp(courseAdjLabelElement?.helpTarget || 'control-course-adj', {
                                        x: rect.left,
                                        y: rect.bottom
                                    });
                                }}
                                title={`${String(courseAdjLabelElement?.name || 'Course adj').replace(/:\s*$/, '')} help`}
                                aria-label={`${String(courseAdjLabelElement?.name || 'Course adj').replace(/:\s*$/, '')} help`}
                            >
                                <span
                                    className="help-trigger-text"
                                    style={{
                                        fontSize: courseAdjLabelElement?.style?.fontSize ?? '0.8rem',
                                        fontWeight: courseAdjLabelElement?.style?.fontWeight ?? 600,
                                        color: courseAdjLabelElement?.style?.color ?? '#111827',
                                        lineHeight: courseAdjLabelElement?.style?.lineHeight ?? 1.0
                                    }}
                                >
                                    {courseAdjLabelElement?.name || 'Course adj:'}
                                </span>
                            </button>
                        </span>
                    ) : (
                        <label htmlFor="lists-layout-course-adj-select" style={{
                            fontSize: courseAdjLabelElement?.style?.fontSize ?? '0.8rem',
                            fontWeight: courseAdjLabelElement?.style?.fontWeight ?? 600,
                            color: courseAdjLabelElement?.style?.color ?? '#111827',
                            lineHeight: courseAdjLabelElement?.style?.lineHeight ?? 1.0
                        }}>
                            {courseAdjLabelElement?.name || 'Course adj:'}
                        </label>
                    )}
                </div>

                {/* Course Adjustment Dropdown */}
                <select
                    id="lists-layout-course-adj-select"
                    value={courseAdj}
                    onChange={handleCourseAdjSelect}
                    aria-label="Course adjustment"
                    style={{
                        position: 'absolute',
                        left: pCourseAdjSelect?.x,
                        top: pCourseAdjSelect?.y,
                        width: pCourseAdjSelect?.width,
                        pointerEvents: 'auto'
                    }}
                >
                    <option value="1">no adjustment (default)</option>
                    <option value="2">seasonal adjustments</option>
                    <option value="3">full event adjustments</option>
                </select>

                {/* Other Adjustment Label */}
                <div style={{ position: 'absolute', left: pOtherAdjLabel?.x, top: pOtherAdjLabel?.y, pointerEvents: 'auto' }}>
                    {otherAdjLabelElement?.helpLabel ? (
                        <span className="help-tooltip" style={{ display: 'inline-flex' }}>
                            <button
                                type="button"
                                className="help-trigger help-trigger-label"
                                onClick={(event) => {
                                    const rect = (event.currentTarget as HTMLButtonElement).getBoundingClientRect();
                                    requestUnifiedHelp(otherAdjLabelElement?.helpTarget || 'control-other-adj', {
                                        x: rect.left,
                                        y: rect.bottom
                                    });
                                }}
                                title={`${String(otherAdjLabelElement?.name || 'Other adj').replace(/:\s*$/, '')} help`}
                                aria-label={`${String(otherAdjLabelElement?.name || 'Other adj').replace(/:\s*$/, '')} help`}
                            >
                                <span
                                    className="help-trigger-text"
                                    style={{
                                        fontSize: otherAdjLabelElement?.style?.fontSize ?? '0.8rem',
                                        fontWeight: otherAdjLabelElement?.style?.fontWeight ?? 600,
                                        color: otherAdjLabelElement?.style?.color ?? '#111827',
                                        lineHeight: otherAdjLabelElement?.style?.lineHeight ?? 1.0
                                    }}
                                >
                                    {otherAdjLabelElement?.name || 'Other adj:'}
                                </span>
                            </button>
                        </span>
                    ) : (
                        <label htmlFor="lists-layout-other-adj-select" style={{
                            fontSize: otherAdjLabelElement?.style?.fontSize ?? '0.8rem',
                            fontWeight: otherAdjLabelElement?.style?.fontWeight ?? 600,
                            color: otherAdjLabelElement?.style?.color ?? '#111827',
                            lineHeight: otherAdjLabelElement?.style?.lineHeight ?? 1.0
                        }}>
                            {otherAdjLabelElement?.name || 'Other adj:'}
                        </label>
                    )}
                </div>

                {/* Other Adjustment Dropdown */}
                <select
                    id="lists-layout-other-adj-select"
                    value={otherAdj}
                    onChange={handleOtherAdjSelect}
                    aria-label="Other adjustment"
                    style={{
                        position: 'absolute',
                        left: pOtherAdjSelect?.x,
                        top: pOtherAdjSelect?.y,
                        width: pOtherAdjSelect?.width,
                        pointerEvents: 'auto'
                    }}
                >
                    <option value="1">no adjustment (default)</option>
                    <option value="2">age adjustments</option>
                    <option value="3">sex adjustments</option>
                    <option value="4">age & sex adjustment</option>
                </select>
            </div>

            {/* Table Section - Positioned below controls */}
            <section
                className="athlete-runs-section"
                style={{
                    position: 'absolute',
                    left: pTableContainer?.x,
                    top: `calc(${pTableContainer?.y ?? '3.0cm'} + ${controlsTopOffset})`,
                    width: pTableContainer?.width ?? 'fit-content',
                    maxWidth: pTableContainer?.maxWidth ?? 'calc(100% - 0.2cm)',
                    right: 0
                }}
            >
                <div
                    ref={tableWrapperRef}
                    className="athlete-runs-table-wrapper"
                    style={{
                        ['--lists-table-max-height' as any]: pTableContainer?.maxHeight,
                        ['--lists-table-max-width' as any]: pTableContainer?.maxWidth,
                        ['--list-col1-width' as any]: getColumnWidth('Rank') ?? '0.8cm',
                        ['--list-col2-width' as any]: getColumnWidth('Name') ?? '2.0cm',
                        width: pTableContainer?.width ?? 'fit-content',
                        maxWidth: pTableContainer?.maxWidth,
                        maxHeight: pTableContainer?.maxHeight
                    }}
                >
                    {loading && <p>Loading...</p>}
                    {error && <p style={{ color: 'red' }}>Error: {error}</p>}
                    {!loading && !error && (
                        <table className="athlete-runs-table lists-table">
                            <colgroup>
                                {columns.map((col) => {
                                    const colWidth = getColumnWidth(col.key);
                                    return (
                                        <col
                                            key={`col-${col.key}`}
                                            style={{
                                                width: colWidth,
                                                minWidth: colWidth,
                                                maxWidth: colWidth
                                            }}
                                        />
                                    );
                                })}
                            </colgroup>
                            <thead>
                                <tr>
                                    {columns.map(col => {
                                        const isSorted = sortKey === col.key;
                                        const sortIndicator = isSorted ? (sortDir === 'asc' ? '▲' : '▼') : '';
                                        const activeKey = getActiveHeaderKey();
                                        const extraClass = (col.key === activeKey) ? ' active-selected-header' : '';
                                        const colWidth = getColumnWidth(col.key);
                                        return (
                                            <th
                                                key={col.key}
                                                className={col.className + extraClass}
                                                onClick={() => handleSort(col.key)}
                                                style={{
                                                    cursor: 'pointer',
                                                    userSelect: 'none',
                                                    width: colWidth,
                                                    minWidth: colWidth,
                                                    maxWidth: colWidth
                                                }}
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
                                {sortedRuns.map((run, index) => {
                                    const runKey = makeRunKey(run);
                                    const isReturnTarget = returnScrollHighlightKey === runKey;
                                    return (
                                    <tr
                                        key={runKey}
                                        data-run-key={runKey}
                                        onClick={() => handleRowClick(run)}
                                        style={{
                                            cursor: 'pointer',
                                            ...(isReturnTarget ? {
                                                outline: '2px solid #3b82f6',
                                                outlineOffset: '-2px',
                                                backgroundColor: '#dbeafe'
                                            } : {})
                                        }}
                                        title="Click to view this event"
                                    >
                                        <td className="sticky-col" style={{ width: getColumnWidth('Rank'), minWidth: getColumnWidth('Rank'), maxWidth: getColumnWidth('Rank') }}>{run.originalRank ?? (index + 1)}</td>
                                        <td
                                            className="sticky-col-2"
                                            style={{ width: getColumnWidth('Name'), minWidth: getColumnWidth('Name'), maxWidth: getColumnWidth('Name'), color: '#0077cc', textDecoration: 'underline', cursor: 'pointer' }}
                                            title={run.name}
                                            onClick={e => handleNameClick(e, run)}
                                        >
                                            {run.name}
                                        </td>
                                        <td style={{ width: getColumnWidth('Time'), minWidth: getColumnWidth('Time'), maxWidth: getColumnWidth('Time') }}>{run.time}</td>
                                        <td style={{ width: getColumnWidth('Date'), minWidth: getColumnWidth('Date'), maxWidth: getColumnWidth('Date') }}>{formatDate(run.event_date)}</td>
                                        <td style={{ width: getColumnWidth('Pos'), minWidth: getColumnWidth('Pos'), maxWidth: getColumnWidth('Pos') }}>{run.position}</td>
                                        <td style={{ width: getColumnWidth('CurveRank'), minWidth: getColumnWidth('CurveRank'), maxWidth: getColumnWidth('CurveRank') }}>{run.rank ?? ''}</td>
                                        <td style={{ width: getColumnWidth('Age Grd'), minWidth: getColumnWidth('Age Grd'), maxWidth: getColumnWidth('Age Grd') }}>{run.age_grade}</td>
                                        <td style={{ width: getColumnWidth('Age Grp'), minWidth: getColumnWidth('Age Grp'), maxWidth: getColumnWidth('Age Grp') }}>{run.age_group}</td>
                                        <td className="event-name-body-col" style={{ width: getColumnWidth('Event'), minWidth: getColumnWidth('Event'), maxWidth: getColumnWidth('Event') }}>
                                            {(String(run.event_name || run.event_code || '').trim()) ? (
                                                <button
                                                    type="button"
                                                    className="lists-link-button"
                                                    onPointerDown={(event) => {
                                                        event.stopPropagation();
                                                    }}
                                                    onClick={(event) => handleCourseClick(event, run)}
                                                    title={`Open course: ${String(run.event_name || run.event_code)}`}
                                                    aria-label={`Open course ${String(run.event_name || run.event_code)}`}
                                                >
                                                    {run.event_name || run.event_code}
                                                </button>
                                            ) : ''}
                                        </td>
                                        <td style={{ width: getColumnWidth('Comment'), minWidth: getColumnWidth('Comment'), maxWidth: getColumnWidth('Comment') }}>{run.comment}</td>
                                        <td style={{ width: getColumnWidth('Club'), minWidth: getColumnWidth('Club'), maxWidth: getColumnWidth('Club') }}>
                                            {(() => {
                                                const clubValue = String(run.club || '').trim();
                                                const canOpenClub = clubValue.length > 0 && clubValue !== '--' && clubValue.toLowerCase() !== '<no club>';
                                                return canOpenClub ? (
                                                    <button
                                                        type="button"
                                                        className="lists-link-button"
                                                        onPointerDown={(event) => {
                                                            event.stopPropagation();
                                                        }}
                                                        onClick={(event) => handleClubClick(event, run)}
                                                        title={`Open club: ${clubValue}`}
                                                        aria-label={`Open club ${clubValue}`}
                                                    >
                                                        {clubValue}
                                                    </button>
                                                ) : clubValue;
                                            })()}
                                        </td>
                                        <td style={{ width: getColumnWidth('Season'), minWidth: getColumnWidth('Season'), maxWidth: getColumnWidth('Season') }}>{run.season_adj_time ?? ''}</td>
                                        <td style={{ width: getColumnWidth('EventAdj'), minWidth: getColumnWidth('EventAdj'), maxWidth: getColumnWidth('EventAdj') }}>{run.event_adj_time ?? ''}</td>
                                        <td style={{ width: getColumnWidth('AgeAdj'), minWidth: getColumnWidth('AgeAdj'), maxWidth: getColumnWidth('AgeAdj') }}>{run.age_adj_time ?? ''}</td>
                                        <td style={{ width: getColumnWidth('SexAdj'), minWidth: getColumnWidth('SexAdj'), maxWidth: getColumnWidth('SexAdj') }}>{run.sex_adj_time ?? ''}</td>
                                        <td style={{ width: getColumnWidth('EventAgeAdj'), minWidth: getColumnWidth('EventAgeAdj'), maxWidth: getColumnWidth('EventAgeAdj') }}>{run.age_event_adj_time ?? ''}</td>
                                        <td style={{ width: getColumnWidth('EventSexAdj'), minWidth: getColumnWidth('EventSexAdj'), maxWidth: getColumnWidth('EventSexAdj') }}>{run.sex_event_adj_time ?? ''}</td>
                                        <td style={{ width: getColumnWidth('AgeSexAdj'), minWidth: getColumnWidth('AgeSexAdj'), maxWidth: getColumnWidth('AgeSexAdj') }}>{run.age_sex_adj_time ?? ''}</td>
                                        <td style={{ width: getColumnWidth('EventAgeSexAdj'), minWidth: getColumnWidth('EventAgeSexAdj'), maxWidth: getColumnWidth('EventAgeSexAdj') }}>{run.age_sex_event_adj_time ?? ''}</td>
                                    </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            </section>
        </div>
    );
};

export default Lists;
