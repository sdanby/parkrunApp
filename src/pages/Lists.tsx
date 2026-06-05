import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { navigateWithNavStack } from '../utils/navigationStack';
import { useColumnHeaderMode } from '../utils/useColumnHeaderMode';
import { useGlobalWaitCursor } from '../utils/useGlobalWaitCursor';
import {
    getListsElementById,
    getListsElementPlacement,
    getListsLayoutConfig,
    getListsTableColumnByKey,
    getListsTableColumns,
    getListsViewportForWidth,
    getListsColumnWidth,
    type ListsViewport
} from '../config/layout/listLayoutHelper';
import { requestUnifiedHelp } from './UnifiedHelp';
import { useDelayedUnifiedHelp } from '../utils/useDelayedUnifiedHelp';
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
    ev_rank?: number | string;
    cur_rank?: number | string;
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
    total_runs_all_parkruns?: number;
    total_runs_local_parkruns?: number;
    total_runs_local_parkruns_1y?: number;
};

type ParticipantFilter =
    | 'all_participants'
    | 'gt_50_total_runs'
    | 'gt_50_local_runs'
    | 'gt_10_local_runs_1y';

const LISTS_RETURN_SCROLL_KEY = 'lists:return_scroll_v1';

const getDefaultSortForList = (listKey: string): { key: string; dir: 'asc' | 'desc' } | null => {
    if (listKey === 'fastest_runs' || listKey === 'fastest_runs_last_year') {
        return { key: 'Time', dir: 'asc' };
    }
    if (listKey === 'highest_total_runs') {
        return { key: 'TotalRuns', dir: 'desc' };
    }
    if (listKey === 'highest_local_runs') {
        return { key: 'TotalLocalRuns', dir: 'desc' };
    }
    if (listKey === 'highest_local_runs_1y') {
        return { key: 'LocalRuns1Y', dir: 'desc' };
    }
    return null;
};

const getRepresentativeSortField = (course: string, other: string): string => {
    if (course === '1' && other === '1') return 'time_seconds';
    if (course === '2') return 'season_adj_time_seconds';
    if (course === '3' && other === '1') return 'event_adj_time_seconds';
    if (course === '1' && other === '2') return 'age_adj_time_seconds';
    if (course === '3' && other === '2') return 'age_event_adj_time_seconds';
    if (course === '1' && other === '3') return 'sex_adj_time_seconds';
    if (course === '3' && other === '3') return 'sex_event_adj_time_seconds';
    if (course === '1' && other === '4') return 'age_sex_adj_time_seconds';
    if (course === '3' && other === '4') return 'age_sex_event_adj_time_seconds';
    return 'time_seconds';
};

const getTableSortForRepresentativeField = (field: string): { key: string; dir: 'asc' | 'desc' } => {
    if (field === 'season_adj_time_seconds') return { key: 'Season', dir: 'asc' };
    if (field === 'event_adj_time_seconds') return { key: 'EventAdj', dir: 'asc' };
    if (field === 'age_adj_time_seconds') return { key: 'AgeAdj', dir: 'asc' };
    if (field === 'sex_adj_time_seconds') return { key: 'SexAdj', dir: 'asc' };
    if (field === 'age_sex_adj_time_seconds') return { key: 'AgeSexAdj', dir: 'asc' };
    if (field === 'age_event_adj_time_seconds') return { key: 'EventAgeAdj', dir: 'asc' };
    if (field === 'sex_event_adj_time_seconds') return { key: 'EventSexAdj', dir: 'asc' };
    if (field === 'age_sex_event_adj_time_seconds') return { key: 'EventAgeSexAdj', dir: 'asc' };
    return { key: 'Time', dir: 'asc' };
};

const getDisplaySortForState = (
    listKey: string,
    filteredByAdjustments: boolean,
    course: '1' | '2' | '3',
    other: '1' | '2' | '3' | '4'
): { key: string; dir: 'asc' | 'desc' } | null => {
    if (!filteredByAdjustments) {
        return getDefaultSortForList(listKey);
    }
    const effectiveOther = course === '2' ? '1' : other;
    return getTableSortForRepresentativeField(getRepresentativeSortField(course, effectiveOther));
};

const getDefaultAdjustmentFilterForList = (listKey: string): boolean => {
    return listKey === 'fastest_runs' || listKey === 'fastest_runs_last_year';
};

const getBackendSortFieldForState = (
    listKey: string,
    filteredByAdjustments: boolean,
    representativeSortField: string
): string => {
    if ((listKey === 'fastest_runs' || listKey === 'fastest_runs_last_year') && filteredByAdjustments) {
        return representativeSortField;
    }
    if (listKey === 'highest_total_runs') {
        return 'total_runs_all_parkruns';
    }
    if (listKey === 'highest_local_runs') {
        return 'total_runs_local_parkruns';
    }
    if (listKey === 'highest_local_runs_1y') {
        return 'total_runs_local_parkruns_1y';
    }
    return 'time_seconds';
};

const getBackendDirectionForList = (listKey: string): 'asc' | 'desc' => {
    if (
        listKey === 'highest_total_runs'
        || listKey === 'highest_local_runs'
        || listKey === 'highest_local_runs_1y'
    ) {
        return 'desc';
    }
    return 'asc';
};

const shouldUseSelectedViewTop1000 = (listKey: string, filteredByAdjustments: boolean): boolean => {
    if (!filteredByAdjustments) {
        return false;
    }
    return (
        listKey === 'highest_total_runs'
        || listKey === 'highest_local_runs'
        || listKey === 'highest_local_runs_1y'
    );
};

const makeRunKey = (run: Pick<Run, 'athlete_code' | 'event_date'>): string => {
    const athlete = String(run.athlete_code ?? '').trim();
    const date = String(run.event_date ?? '').trim();
    return `${athlete}::${date}`;
};

// Map list keys to API endpoints
const listApiEndpoints: { [key: string]: string } = {
    fastest_runs: 'https://hello-world-9yb9.onrender.com/api/lists/fastest_runs',
    fastest_runs_last_year: 'https://hello-world-9yb9.onrender.com/api/lists/fastest_runs',
    highest_total_runs: 'https://hello-world-9yb9.onrender.com/api/lists/fastest_runs',
    highest_local_runs: 'https://hello-world-9yb9.onrender.com/api/lists/fastest_runs',
    highest_local_runs_1y: 'https://hello-world-9yb9.onrender.com/api/lists/fastest_runs',
    // Add other list endpoints here in the future
};

const getListSelectionLabel = (listKey: string): string => {
    if (listKey === 'fastest_runs') return 'Fastest Athletes - All Time';
    if (listKey === 'fastest_runs_last_year') return 'Fastest Athletes - Over last 1 Year';
    if (listKey === 'highest_total_runs') return 'Highest Total Runs';
    if (listKey === 'highest_local_runs') return 'Highest Local Runs';
    if (listKey === 'highest_local_runs_1y') return 'Highest Local Runs - Over last 1 Year';
    return 'selected list';
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
    const { isHelpMode } = useColumnHeaderMode();
    const isMobile = useMediaQuery('(max-width: 640px)');
    const [viewport, setViewport] = useState<ListsViewport>(() => getListsViewportForWidth(window.innerWidth));
    const listsLayoutConfig = React.useMemo(() => getListsLayoutConfig() as any, []);
    const tableHeaderHelpEnabled = listsLayoutConfig?.tableHelpTip?.enabled !== false;
    const tableHeaderHelpDelayMs = Number(listsLayoutConfig?.tableHelpTip?.delayMs) > 0
        ? Number(listsLayoutConfig.tableHelpTip.delayMs)
        : 2000;
    const delayedHeaderHelp = useDelayedUnifiedHelp(tableHeaderHelpEnabled, tableHeaderHelpDelayMs);

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
    const pParticipantFilterLabel = getListsElementPlacement('lists.participantFilterLabel', viewport);
    const pParticipantFilterSelect = getListsElementPlacement('lists.participantFilterSelect', viewport);
    const pCourseAdjLabel = getListsElementPlacement('lists.courseAdjLabel', viewport);
    const pCourseAdjSelect = getListsElementPlacement('lists.courseAdjSelect', viewport);
    const pOtherAdjLabel = getListsElementPlacement('lists.otherAdjLabel', viewport);
    const pOtherAdjSelect = getListsElementPlacement('lists.otherAdjSelect', viewport);
    const pAdjustmentFilterLabel = getListsElementPlacement('lists.adjustmentFilterLabel', viewport);
    const pAdjustmentFilterCheckbox = getListsElementPlacement('lists.adjustmentFilterCheckbox', viewport);
    const pAdjustmentControlsGroup = getListsElementPlacement('lists.adjustmentControlsGroup', viewport);
    const pTableContainer = getListsElementPlacement('lists.tableContainer', viewport);

    const titleElement = getListsElementById('lists.title');
    const statusLabelElement = getListsElementById('lists.statusLabel');
    const listLabelElement = getListsElementById('lists.listLabel');
    const listSelectElement = getListsElementById('lists.listSelect');
    const participantFilterLabelElement = getListsElementById('lists.participantFilterLabel');
    const courseAdjLabelElement = getListsElementById('lists.courseAdjLabel');
    const otherAdjLabelElement = getListsElementById('lists.otherAdjLabel');
    const adjustmentFilterLabelElement = getListsElementById('lists.adjustmentFilterLabel');
    const adjustmentControlsGroupElement = getListsElementById('lists.adjustmentControlsGroup');
    const controlsTopOffset = isMobile ? '1.1cm' : '0cm';
    const listLabelHelpEnabled = Boolean(listLabelElement?.helpLabel || listSelectElement?.helpLabel);
    const listLabelHelpTarget = listLabelElement?.helpTarget || listSelectElement?.helpTarget || 'control-list-select';
    const listLabelText = listLabelElement?.name || 'List selection:';
    const listLabelHelpText = String(listLabelText).replace(/:\s*$/, '');
    const participantFilterSelectElement = getListsElementById('lists.participantFilterSelect');
    const participantFilterHelpEnabled = Boolean(participantFilterLabelElement?.helpLabel || participantFilterSelectElement?.helpLabel);
    const participantFilterHelpTarget = participantFilterLabelElement?.helpTarget || participantFilterSelectElement?.helpTarget || 'control-participant-filter';
    const participantFilterLabelText = participantFilterLabelElement?.name || 'Participants:';
    const participantFilterHelpText = String(participantFilterLabelText).replace(/:\s*$/, '');

    // Initialize selections from URL params or sessionStorage so state is preserved when navigating back
    const urlParamsInit = new URLSearchParams(location.search);
    const storedList = sessionStorage.getItem('lists:selectedList');
    const storedCourse = sessionStorage.getItem('lists:courseAdj');
    const storedOther = sessionStorage.getItem('lists:otherAdj');
    const storedParticipantFilter = sessionStorage.getItem('lists:participantFilter');
    const storedAdjustmentFilter = sessionStorage.getItem('lists:filteredByAdjustments');
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
    const initialParticipantFilter = ((): ParticipantFilter => {
        const v = (urlParamsInit.get('participantFilter') || storedParticipantFilter || 'all_participants') as ParticipantFilter;
        return v === 'gt_50_total_runs' || v === 'gt_50_local_runs' || v === 'gt_10_local_runs_1y' ? v : 'all_participants';
    })();
    const initialFilteredByAdjustments = ((): boolean => {
        const v = urlParamsInit.get('filteredByAdjustments') || storedAdjustmentFilter;
        if (v === '1' || v === 'true') return true;
        if (v === '0' || v === 'false') return false;
        return getDefaultAdjustmentFilterForList(initialList);
    })();
    const initialDefaultSort = getDefaultSortForList(initialList);
    const initialSortKey = urlParamsInit.get('sortKey') || storedSortKey || initialDefaultSort?.key || 'Rank';
    const initialSortDir: 'asc' | 'desc' = (() => {
        const urlSortDir = urlParamsInit.get('sortDir');
        if (urlSortDir === 'asc' || urlSortDir === 'desc') return urlSortDir;
        if (storedSortDir === 'asc' || storedSortDir === 'desc') return storedSortDir;
        return initialDefaultSort?.dir || 'asc';
    })();

    const [selectedList, setSelectedList] = useState<string>(initialList);
    const [runs, setRuns] = useState<Run[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [sortKey, setSortKey] = useState<string>(initialSortKey);
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>(initialSortDir);
    const [courseAdj, setCourseAdj] = useState<'1' | '2' | '3'>(initialCourse);
    const [otherAdj, setOtherAdj] = useState<'1' | '2' | '3' | '4'>(initialOther);
    const [participantFilter, setParticipantFilter] = useState<ParticipantFilter>(initialParticipantFilter);
    const [filteredByAdjustments, setFilteredByAdjustments] = useState<boolean>(initialFilteredByAdjustments);
    const [selectionRefreshPending, setSelectionRefreshPending] = useState<boolean>(false);
    const [returnScrollHighlightKey, setReturnScrollHighlightKey] = useState<string | null>(null);
    const [pendingScrollKey, setPendingScrollKey] = useState<string | null>(null);
    const tableWrapperRef = useRef<HTMLDivElement | null>(null);
    const activeRequestIdRef = useRef(0);
    const showRetrievingStatus = loading || Boolean(pendingScrollKey);
    const processingMessage = React.useMemo(() => {
        if (pendingScrollKey) {
            return 'Restoring the previously selected row...';
        }
        if (loading) {
            return `Processing request. Refreshing ${getListSelectionLabel(selectedList)} results...`;
        }
        return statusLabelElement?.name || 'retrieving results';
    }, [loading, pendingScrollKey, selectedList, statusLabelElement?.name]);
    useGlobalWaitCursor(loading || selectionRefreshPending);

    useEffect(() => {
        if (!loading && selectionRefreshPending) {
            setSelectionRefreshPending(false);
        }
    }, [loading, selectionRefreshPending]);

    useEffect(() => {
        const requestId = activeRequestIdRef.current + 1;
        activeRequestIdRef.current = requestId;
        const abortController = new AbortController();

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
                    // view_sort chooses the representative row source. sort chooses how the
                    // backend ranks athletes before returning the top 1000.
                    let url = endpoint;
                    if (listApiEndpoints[selectedList]) {
                        const effectiveCourse = filteredByAdjustments ? courseAdj : '1';
                        const effectiveOther = filteredByAdjustments
                            ? (effectiveCourse === '2' ? '1' : otherAdj)
                            : '1';
                        const representativeSortField = getRepresentativeSortField(effectiveCourse, effectiveOther);
                        const backendSortField = getBackendSortFieldForState(
                            selectedList,
                            filteredByAdjustments,
                            representativeSortField
                        );
                        const backendDirection = getBackendDirectionForList(selectedList);
                        const selectionScope = shouldUseSelectedViewTop1000(selectedList, filteredByAdjustments)
                            ? 'selected_view_top_1000'
                            : 'all_eligible';
                        const period = (
                            selectedList === 'fastest_runs_last_year'
                            || selectedList === 'highest_local_runs_1y'
                        ) ? 'last_year' : 'all_time';

                        const params = new URLSearchParams({
                            sort: backendSortField,
                            view_sort: representativeSortField,
                            period,
                            participant_filter: participantFilter,
                            selection_scope: selectionScope,
                            direction: backendDirection,
                            limit: '1000'
                        });
                        url = `${endpoint}?${params.toString()}`;
                    }

                    const response = await fetch(url, { signal: abortController.signal });
                    if (!response.ok) {
                        throw new Error(`Failed to fetch data: ${response.statusText}`);
                    }
                    const data: Run[] = await response.json();
                    if (abortController.signal.aborted || activeRequestIdRef.current !== requestId) {
                        return;
                    }
                // Attach original rank to each run
                const ranked = data.map((run, idx) => ({ ...run, originalRank: idx + 1 }));
                setRuns(ranked);
            } catch (err: any) {
                if (abortController.signal.aborted || err?.name === 'AbortError') {
                    return;
                }
                setError(err.message || 'An unexpected error occurred.');
            } finally {
                if (activeRequestIdRef.current === requestId) {
                    setLoading(false);
                }
            }
        };

        fetchRuns();

        return () => {
            abortController.abort();
        };
    }, [selectedList, courseAdj, otherAdj, participantFilter, filteredByAdjustments]);

    const handleListSelect = (event: React.ChangeEvent<HTMLSelectElement>) => {
        setSelectionRefreshPending(true);
        const v = event.target.value;
        setSelectedList(v);
        const defaultAdjustmentFilter = getDefaultAdjustmentFilterForList(v);
        setFilteredByAdjustments(defaultAdjustmentFilter);
        const defaultSort = getDisplaySortForState(v, defaultAdjustmentFilter, courseAdj, otherAdj);
        if (defaultSort) {
            setSortKey(defaultSort.key);
            setSortDir(defaultSort.dir);
        }
        sessionStorage.setItem('lists:selectedList', v);
        sessionStorage.setItem('lists:filteredByAdjustments', defaultAdjustmentFilter ? '1' : '0');
    };

    const handleCourseAdjSelect = (event: React.ChangeEvent<HTMLSelectElement>) => {
        setSelectionRefreshPending(true);
        const v = event.target.value as '1' | '2' | '3';
        setCourseAdj(v);
        sessionStorage.setItem('lists:courseAdj', v);
        // If seasonal chosen, reset otherAdj to '1' (no adjustment)
        if (v === '2') {
            setOtherAdj('1');
            sessionStorage.setItem('lists:otherAdj', '1');
        }
        const nextOther = v === '2' ? '1' : otherAdj;
        const nextSort = getDisplaySortForState(selectedList, filteredByAdjustments, v, nextOther);
        if (nextSort) {
            setSortKey(nextSort.key);
            setSortDir(nextSort.dir);
        }
    };

    const handleOtherAdjSelect = (event: React.ChangeEvent<HTMLSelectElement>) => {
        setSelectionRefreshPending(true);
        const v = event.target.value as '1' | '2' | '3' | '4';
        setOtherAdj(v);
        sessionStorage.setItem('lists:otherAdj', v);
        const nextSort = getDisplaySortForState(selectedList, filteredByAdjustments, courseAdj, v);
        if (nextSort) {
            setSortKey(nextSort.key);
            setSortDir(nextSort.dir);
        }
    };

    const handleParticipantFilterSelect = (event: React.ChangeEvent<HTMLSelectElement>) => {
        setSelectionRefreshPending(true);
        const v = event.target.value as ParticipantFilter;
        setParticipantFilter(v);
        sessionStorage.setItem('lists:participantFilter', v);
    };

    const handleAdjustmentFilterToggle = (event: React.ChangeEvent<HTMLInputElement>) => {
        setSelectionRefreshPending(true);
        const checked = event.target.checked;
        setFilteredByAdjustments(checked);
        sessionStorage.setItem('lists:filteredByAdjustments', checked ? '1' : '0');
        const nextSort = getDisplaySortForState(selectedList, checked, courseAdj, otherAdj);
        if (nextSort) {
            setSortKey(nextSort.key);
            setSortDir(nextSort.dir);
        }
    };

    // Keep URL query params in sync so selections persist across navigation/back
    React.useEffect(() => {
        const params = new URLSearchParams(location.search);
        params.set('list', selectedList);
        params.set('courseAdj', courseAdj);
        params.set('otherAdj', otherAdj);
        params.set('participantFilter', participantFilter);
        params.set('filteredByAdjustments', filteredByAdjustments ? '1' : '0');
        params.set('sortKey', sortKey);
        params.set('sortDir', sortDir);
        const nextSearch = `?${params.toString()}`;
        if (nextSearch !== location.search) {
            // replace so history isn't noisy
            navigate(`${location.pathname}${nextSearch}`, { replace: true });
        }
        // persist selections so Back/Forward can restore even if URL entries differ
        sessionStorage.setItem('lists:selectedList', selectedList);
        sessionStorage.setItem('lists:courseAdj', courseAdj);
        sessionStorage.setItem('lists:otherAdj', otherAdj);
        sessionStorage.setItem('lists:participantFilter', participantFilter);
        sessionStorage.setItem('lists:filteredByAdjustments', filteredByAdjustments ? '1' : '0');
        sessionStorage.setItem('lists:sortKey', sortKey);
        sessionStorage.setItem('lists:sortDir', sortDir);
    }, [selectedList, courseAdj, otherAdj, participantFilter, filteredByAdjustments, sortKey, sortDir]);

    // When the location.search changes (e.g., user hits Back/Forward), restore selections
    React.useEffect(() => {
        const params = new URLSearchParams(location.search);
        const list = params.get('list') || null;
        const course = params.get('courseAdj') || null;
        const other = params.get('otherAdj') || null;
        const participantFilterParam = params.get('participantFilter') || null;
        const filteredByAdjustmentsParam = params.get('filteredByAdjustments') || null;
        const savedList = sessionStorage.getItem('lists:selectedList');
        const savedCourse = sessionStorage.getItem('lists:courseAdj');
        const savedOther = sessionStorage.getItem('lists:otherAdj');
        const savedParticipantFilter = sessionStorage.getItem('lists:participantFilter');
        const savedAdjustmentFilter = sessionStorage.getItem('lists:filteredByAdjustments');

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

        if (participantFilterParam) {
            const filter = participantFilterParam === 'gt_50_total_runs'
                || participantFilterParam === 'gt_50_local_runs'
                || participantFilterParam === 'gt_10_local_runs_1y'
                ? participantFilterParam as ParticipantFilter
                : 'all_participants';
            if (filter !== participantFilter) setParticipantFilter(filter);
        } else if (savedParticipantFilter && savedParticipantFilter !== participantFilter) {
            const filter = savedParticipantFilter === 'gt_50_total_runs'
                || savedParticipantFilter === 'gt_50_local_runs'
                || savedParticipantFilter === 'gt_10_local_runs_1y'
                ? savedParticipantFilter as ParticipantFilter
                : 'all_participants';
            setParticipantFilter(filter);
        }

        if (filteredByAdjustmentsParam === '1' || filteredByAdjustmentsParam === '0' || filteredByAdjustmentsParam === 'true' || filteredByAdjustmentsParam === 'false') {
            const checked = filteredByAdjustmentsParam === '1' || filteredByAdjustmentsParam === 'true';
            if (checked !== filteredByAdjustments) setFilteredByAdjustments(checked);
        } else if (savedAdjustmentFilter === '1' || savedAdjustmentFilter === '0' || savedAdjustmentFilter === 'true' || savedAdjustmentFilter === 'false') {
            const checked = savedAdjustmentFilter === '1' || savedAdjustmentFilter === 'true';
            if (checked !== filteredByAdjustments) setFilteredByAdjustments(checked);
        }

    }, [location.search]);

    const columnClassNameByKey: Record<string, string> = {
        Rank: 'sticky-header sticky-corner-2-1',
        Name: 'sticky-header sticky-col-2',
        Event: 'sticky-header event-name-header-col',
    };

    // Column order is driven by tableColumns in list.layout.json.
    const columns = React.useMemo(
        () => getListsTableColumns().map((column) => ({
            key: column.key,
            label: column.headerName || column.name,
            className: columnClassNameByKey[column.key] || 'sticky-header',
            helpTarget: (column as any)?.helpTarget,
            helpTipEnabled: typeof (column as any)?.helpTip === 'object'
                ? (column as any).helpTip.enabled !== false
                : (column as any)?.helpTip !== false,
            helpTipDelayMs: typeof (column as any)?.helpTip === 'object' && Number((column as any).helpTip.delayMs) > 0
                ? Number((column as any).helpTip.delayMs)
                : undefined
        })),
        []
    );

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
        const indexedRuns = runs.map((run, index) => ({ run, index }));
        const getValue = (run: Run, colKey: string, index: number) => {
            switch (colKey) {
                case 'Rank': return run.originalRank ?? (index + 1);
                case 'Name': return run.name;
                case 'Time': return run.time;
                case 'Date': return getIsoDate(run.event_date);
                case 'Event': return run.event_name || run.event_code;
                case 'Pos': return run.position;
                case 'EvRank': return run.ev_rank ?? '';
                case 'CurRank': return run.cur_rank ?? '';
                case 'Age Grd': return run.age_grade;
                case 'Age Grp': return run.age_group;
                case 'Comment': return run.comment;
                case 'TotalRuns': return run.total_runs_all_parkruns ?? 0;
                case 'TotalLocalRuns': return run.total_runs_local_parkruns ?? 0;
                case 'LocalRuns1Y': return run.total_runs_local_parkruns_1y ?? 0;
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
            if (
                sortKey === 'Rank'
                || sortKey === 'Event'
                || sortKey === 'Pos'
                || sortKey === 'EvRank'
                || sortKey === 'CurRank'
                || sortKey === 'TotalRuns'
                || sortKey === 'TotalLocalRuns'
                || sortKey === 'LocalRuns1Y'
            ) {
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
        return indexedRuns
            .slice()
            .sort((a, b) => compare(a.run, b.run, a.index, b.index))
            .map(({ run }) => run);
    }, [runs, sortKey, sortDir]);

    // The active header should always reflect the current display sort.
    const getActiveHeaderKey = (): string => {
        return sortKey;
    };

    const onHeaderActivate = (eventTarget: EventTarget | null, key: string, label: string, helpTarget?: string) => {
        if (!isHelpMode) {
            handleSort(key);
            return;
        }

        const element = eventTarget as HTMLElement | null;
        if (!element) {
            requestUnifiedHelp(helpTarget || 'top', null, label);
            return;
        }

        const rect = element.getBoundingClientRect();
        requestUnifiedHelp(helpTarget || 'top', { x: rect.left, y: rect.bottom }, label);
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

    const bodyColumnClassNameByKey: Record<string, string> = {
        Rank: 'sticky-col',
        Name: 'sticky-col-2',
        Event: 'event-name-body-col',
    };

    const renderTableCell = (run: Run, index: number, columnKey: string) => {
        const colWidth = getColumnWidth(columnKey);
        const columnStyle = getListsTableColumnByKey(columnKey)?.style;
        const commonStyle = {
            width: colWidth,
            minWidth: colWidth,
            maxWidth: colWidth,
            textAlign: columnStyle?.textAlign,
        };
        const className = bodyColumnClassNameByKey[columnKey];

        switch (columnKey) {
            case 'Rank':
                return <td className={className} style={commonStyle}>{run.originalRank ?? (index + 1)}</td>;
            case 'Name':
                return (
                    <td
                        className={className}
                        style={{ ...commonStyle, color: '#0077cc', textDecoration: 'underline', cursor: 'pointer' }}
                        title={run.name}
                        onClick={e => handleNameClick(e, run)}
                    >
                        {run.name}
                    </td>
                );
            case 'Time':
                return <td style={commonStyle}>{run.time}</td>;
            case 'Date':
                return <td style={commonStyle}>{formatDate(run.event_date)}</td>;
            case 'Pos':
                return <td style={commonStyle}>{run.position}</td>;
            case 'EvRank':
                return <td style={commonStyle}>{run.ev_rank === undefined || run.ev_rank === null || run.ev_rank === '' ? '' : Math.round(Number(run.ev_rank))}</td>;
            case 'CurRank':
                return <td style={commonStyle}>{run.cur_rank === undefined || run.cur_rank === null || run.cur_rank === '' ? '' : Math.round(Number(run.cur_rank))}</td>;
            case 'Age Grd':
                return <td style={commonStyle}>{run.age_grade}</td>;
            case 'Age Grp':
                return <td style={commonStyle}>{run.age_group}</td>;
            case 'Comment':
                return <td style={commonStyle}>{run.comment}</td>;
            case 'TotalRuns':
                return <td style={commonStyle}>{run.total_runs_all_parkruns ?? ''}</td>;
            case 'TotalLocalRuns':
                return <td style={commonStyle}>{run.total_runs_local_parkruns ?? ''}</td>;
            case 'LocalRuns1Y':
                return <td style={commonStyle}>{run.total_runs_local_parkruns_1y ?? ''}</td>;
            case 'Event':
                return (
                    <td className={className} style={commonStyle}>
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
                );
            case 'Club': {
                const clubValue = String(run.club || '').trim();
                const canOpenClub = clubValue.length > 0 && clubValue !== '--' && clubValue.toLowerCase() !== '<no club>';
                return (
                    <td style={commonStyle}>
                        {canOpenClub ? (
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
                        ) : clubValue}
                    </td>
                );
            }
            case 'Season':
                return <td style={commonStyle}>{run.season_adj_time ?? ''}</td>;
            case 'EventAdj':
                return <td style={commonStyle}>{run.event_adj_time ?? ''}</td>;
            case 'AgeAdj':
                return <td style={commonStyle}>{run.age_adj_time ?? ''}</td>;
            case 'SexAdj':
                return <td style={commonStyle}>{run.sex_adj_time ?? ''}</td>;
            case 'EventAgeAdj':
                return <td style={commonStyle}>{run.age_event_adj_time ?? ''}</td>;
            case 'EventSexAdj':
                return <td style={commonStyle}>{run.sex_event_adj_time ?? ''}</td>;
            case 'AgeSexAdj':
                return <td style={commonStyle}>{run.age_sex_adj_time ?? ''}</td>;
            case 'EventAgeSexAdj':
                return <td style={commonStyle}>{run.age_sex_event_adj_time ?? ''}</td>;
            default:
                return <td style={commonStyle} />;
        }
    };

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
                            {processingMessage}
                        </span>
                    </div>
                )}

                {/* List Selection Label */}
                <div style={{ position: 'absolute', left: pListLabel?.x, top: pListLabel?.y, pointerEvents: 'auto' }}>
                    {listLabelHelpEnabled ? (
                        <span className="help-tooltip" style={{ display: 'inline-flex' }}>
                            <button
                                type="button"
                                className="help-trigger help-trigger-label"
                                onClick={(event) => {
                                    const rect = (event.currentTarget as HTMLButtonElement).getBoundingClientRect();
                                    requestUnifiedHelp(listLabelHelpTarget, {
                                        x: rect.left,
                                        y: rect.bottom
                                    });
                                }}
                                title={`${listLabelHelpText} help`}
                                aria-label={`${listLabelHelpText} help`}
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
                                    {listLabelText}
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
                            {listLabelText}
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
                    <option value="highest_total_runs">Highest Total Runs</option>
                    <option value="highest_local_runs">Highest Local Runs</option>
                    <option value="highest_local_runs_1y">Highest Local Runs - Over last 1 Year</option>
                </select>

                <div style={{ position: 'absolute', left: pParticipantFilterLabel?.x, top: pParticipantFilterLabel?.y, pointerEvents: 'auto' }}>
                    {participantFilterHelpEnabled ? (
                        <span className="help-tooltip" style={{ display: 'inline-flex' }}>
                            <button
                                type="button"
                                className="help-trigger help-trigger-label"
                                onClick={(event) => {
                                    const rect = (event.currentTarget as HTMLButtonElement).getBoundingClientRect();
                                    requestUnifiedHelp(participantFilterHelpTarget, {
                                        x: rect.left,
                                        y: rect.bottom
                                    });
                                }}
                                title={`${participantFilterHelpText} help`}
                                aria-label={`${participantFilterHelpText} help`}
                            >
                                <span
                                    className="help-trigger-text"
                                    style={{
                                        fontSize: participantFilterLabelElement?.style?.fontSize ?? '0.8rem',
                                        fontWeight: participantFilterLabelElement?.style?.fontWeight ?? 600,
                                        color: participantFilterLabelElement?.style?.color ?? '#111827',
                                        lineHeight: participantFilterLabelElement?.style?.lineHeight ?? 1.0
                                    }}
                                >
                                    {participantFilterLabelText}
                                </span>
                            </button>
                        </span>
                    ) : (
                        <label htmlFor="lists-layout-participant-filter-select" style={{
                            fontSize: participantFilterLabelElement?.style?.fontSize ?? '0.8rem',
                            fontWeight: participantFilterLabelElement?.style?.fontWeight ?? 600,
                            color: participantFilterLabelElement?.style?.color ?? '#111827',
                            lineHeight: participantFilterLabelElement?.style?.lineHeight ?? 1.0
                        }}>
                            {participantFilterLabelText}
                        </label>
                    )}
                </div>

                <select
                    id="lists-layout-participant-filter-select"
                    value={participantFilter}
                    onChange={handleParticipantFilterSelect}
                    aria-label="Participant filter"
                    style={{
                        position: 'absolute',
                        left: pParticipantFilterSelect?.x,
                        top: pParticipantFilterSelect?.y,
                        width: pParticipantFilterSelect?.width,
                        pointerEvents: 'auto'
                    }}
                >
                    <option value="all_participants">all participants</option>
                    <option value="gt_50_total_runs">Participants &gt;50 total-runs</option>
                    <option value="gt_50_local_runs">Participants &gt; 50 local-runs</option>
                    <option value="gt_10_local_runs_1y">Participants &gt; 10 local_run_1y</option>
                </select>

                <div
                    aria-hidden="true"
                    style={{
                        position: 'absolute',
                        left: pAdjustmentControlsGroup?.x,
                        top: pAdjustmentControlsGroup?.y,
                        width: pAdjustmentControlsGroup?.width,
                        height: pAdjustmentControlsGroup?.height,
                        border: adjustmentControlsGroupElement?.style?.border ?? '1px solid #9ca3af',
                        borderColor: adjustmentControlsGroupElement?.style?.borderColor,
                        borderRadius: adjustmentControlsGroupElement?.style?.borderRadius ?? '0.22cm',
                        background: adjustmentControlsGroupElement?.style?.backgroundColor ?? 'transparent',
                        pointerEvents: 'none',
                        boxSizing: 'border-box'
                    }}
                />

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

                <div style={{ position: 'absolute', left: pAdjustmentFilterLabel?.x, top: pAdjustmentFilterLabel?.y, pointerEvents: 'auto' }}>
                    {adjustmentFilterLabelElement?.helpLabel ? (
                        <span className="help-tooltip" style={{ display: 'inline-flex' }}>
                            <button
                                type="button"
                                className="help-trigger help-trigger-label"
                                onClick={(event) => {
                                    const rect = (event.currentTarget as HTMLButtonElement).getBoundingClientRect();
                                    requestUnifiedHelp(adjustmentFilterLabelElement?.helpTarget || 'control-adjustment-filter', {
                                        x: rect.left,
                                        y: rect.bottom
                                    });
                                }}
                                title={`${String(adjustmentFilterLabelElement?.name || 'Use adj. filters').replace(/:\s*$/, '')} help`}
                                aria-label={`${String(adjustmentFilterLabelElement?.name || 'Use adj. filters').replace(/:\s*$/, '')} help`}
                            >
                                <span
                                    className="help-trigger-text"
                                    style={{
                                        fontSize: adjustmentFilterLabelElement?.style?.fontSize ?? '0.8rem',
                                        fontWeight: adjustmentFilterLabelElement?.style?.fontWeight ?? 600,
                                        color: adjustmentFilterLabelElement?.style?.color ?? '#111827',
                                        lineHeight: adjustmentFilterLabelElement?.style?.lineHeight ?? 1.0
                                    }}
                                >
                                    {adjustmentFilterLabelElement?.name || 'Use adj. filters:'}
                                </span>
                            </button>
                        </span>
                    ) : (
                        <label htmlFor="lists-layout-adjustment-filter-checkbox" style={{
                            fontSize: adjustmentFilterLabelElement?.style?.fontSize ?? '0.8rem',
                            fontWeight: adjustmentFilterLabelElement?.style?.fontWeight ?? 600,
                            color: adjustmentFilterLabelElement?.style?.color ?? '#111827',
                            lineHeight: adjustmentFilterLabelElement?.style?.lineHeight ?? 1.0
                        }}>
                            {adjustmentFilterLabelElement?.name || 'Use adj. filters:'}
                        </label>
                    )}
                </div>

                <input
                    id="lists-layout-adjustment-filter-checkbox"
                    type="checkbox"
                    checked={filteredByAdjustments}
                    onChange={handleAdjustmentFilterToggle}
                    aria-label="filtered by adjustments"
                    style={{
                        position: 'absolute',
                        left: pAdjustmentFilterCheckbox?.x,
                        top: pAdjustmentFilterCheckbox?.y,
                        width: pAdjustmentFilterCheckbox?.width,
                        height: pAdjustmentFilterCheckbox?.height,
                        pointerEvents: 'auto'
                    }}
                />
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
                    {loading && <p>{processingMessage}</p>}
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
                                                onClick={(event) => onHeaderActivate(event.currentTarget, col.key, col.label, col.helpTarget)}
                                                onMouseEnter={(event) => {
                                                    if (col.helpTipEnabled === false) {
                                                        return;
                                                    }
                                                    delayedHeaderHelp.schedule({
                                                        event,
                                                        label: col.label,
                                                        markerId: col.helpTarget,
                                                        delayMs: col.helpTipDelayMs
                                                    });
                                                }}
                                                onMouseLeave={delayedHeaderHelp.clear}
                                                onMouseDown={delayedHeaderHelp.clear}
                                                onTouchStart={delayedHeaderHelp.clear}
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
                                        {columns.map((col) => (
                                            <React.Fragment key={`${runKey}-${col.key}`}>
                                                {renderTableCell(run, index, col.key)}
                                            </React.Fragment>
                                        ))}
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
