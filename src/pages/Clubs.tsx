import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ClubCourseSummaryRecord, fetchAthleteRuns } from '../api/backendAPI';
import { useLocation, useNavigate } from 'react-router-dom';
import { fetchClubCourseSummary, fetchClubMembers, fetchClubsSearch } from '../api/backendAPI';
import { navigateBackWithNavStack, navigateWithNavStack } from '../utils/navigationStack';
import { useColumnHeaderMode } from '../utils/useColumnHeaderMode';
import { useGlobalWaitCursor } from '../utils/useGlobalWaitCursor';
import {
    getClubsColumnsForView,
    getClubsElementById,
    getClubsElementPlacement,
    getClubsLayoutConfig,
    getClubsViewportForWidth,
    type ClubsTableColumn,
    type ClubsViewport
} from '../config/layout/clubsLayoutHelper';
import { useDelayedUnifiedHelp } from '../utils/useDelayedUnifiedHelp';
import { requestUnifiedHelp } from './UnifiedHelp';
import './ResultsTable.css';
import './Clubs.css';

type ClubsLocationState = {
    returnTo?: { pathname: string; search?: string };
};

const toClubsLocationState = (value: unknown): ClubsLocationState => {
    if (!value || typeof value !== 'object') {
        return {};
    }
    const possible: any = value;
    if (possible.returnTo && typeof possible.returnTo === 'object' && typeof possible.returnTo.pathname === 'string') {
        return {
            returnTo: {
                pathname: possible.returnTo.pathname,
                search: typeof possible.returnTo.search === 'string' ? possible.returnTo.search : undefined
            }
        };
    }
    return {};
};

type ClubOption = {
    club: string;
    athlete_count: number;
};

type ClubMember = {
    athlete_code: string;
    name: string;
    current_club: string | null;
    latest_age_group: string | null;
    club_runs_total: number | null;
    club_runs_last_year: number | null;
    first_club_run_date: string | null;
    last_club_run_date: string | null;
    fastest_time: string | null;
    fastest_time_seconds: number | null;
    best_event_adj_time: string | null;
    best_event_adj_time_seconds: number | null;
    best_age_event_adj_time: string | null;
    best_age_event_adj_time_seconds: number | null;
    best_age_sex_event_adj_time: string | null;
    best_age_sex_event_adj_time_seconds: number | null;
    best_curve_ranking_current: number | null;
    best_curve_ranking_historic: number | null;
    best_curve_ranking_current_type: string | null;
    total_runs_all_clubs: number | null;
};

type ClubSortDirection = 'asc' | 'desc';
type ClubMode = 'members' | 'current_members' | 'events';

type ClubViewState = {
    club: string;
    mode: ClubMode;
    sortKey: keyof ClubMember;
    sortDirection: ClubSortDirection;
    highlightAthleteCode?: string;
};

const clubColumns = getClubsColumnsForView('members');
const clubCourseSummaryColumns = getClubsColumnsForView('events');

const clubSortableKeys = new Set<keyof ClubMember>(clubColumns.map((column) => column.key as keyof ClubMember));
const clubCourseSummarySortableKeys = new Set<keyof ClubCourseSummaryRecord>([
    ...clubCourseSummaryColumns.map((column) => (column.key === 'club_runs_last_year_summary' ? 'club_runs_last_year' : column.key) as keyof ClubCourseSummaryRecord)
]);

const CLUBS_MOBILE_BREAKPOINT = 768;

const getClubColumnStyle = (column: ClubsTableColumn, isMobileViewport: boolean): React.CSSProperties => {
    const width = isMobileViewport
        ? (column.mobile?.width ?? column.laptop?.width)
        : (column.laptop?.width ?? column.mobile?.width);
    return {
        textAlign: column.style?.textAlign ?? 'left',
        width,
        minWidth: width,
        maxWidth: width
    };
};

const normalizeClubName = (value: string | null | undefined): string => {
    return String(value ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
};

const modeOrder: ClubMode[] = ['members', 'current_members', 'events'];

const modeLabel = (mode: ClubMode): string => {
    if (mode === 'current_members') return 'Current Members';
    if (mode === 'events') return 'Events';
    return 'Members';
};

const modeButtonLabel = (mode: ClubMode): string => {
    if (mode === 'current_members') return 'Current\nMembers';
    if (mode === 'events') return 'Events';
    return 'Members';
};

const getNextMode = (mode: ClubMode): ClubMode => {
    const idx = modeOrder.indexOf(mode);
    return modeOrder[(idx + 1) % modeOrder.length];
};

const formatSqlDate = (value: string | null | undefined): string => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return value;
    }
    return date.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: '2-digit'
    }).replace(/\s/g, '-');
};

const parseNumber = (value: unknown): number | null => {
    if (value === null || value === undefined || value === '') return null;
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    const parsed = Number(String(value).trim());
    return Number.isFinite(parsed) ? parsed : null;
};

const parseDateSortValue = (value: unknown): number | null => {
    if (value === null || value === undefined || value === '') return null;
    const parsed = Date.parse(String(value));
    return Number.isNaN(parsed) ? null : parsed;
};

const parseTimeToSeconds = (value: unknown): number | null => {
    if (value === null || value === undefined || value === '') return null;
    const raw = String(value).trim();
    const mmss = raw.match(/^(\d+):(\d{1,2})$/);
    if (!mmss) return null;
    return Number(mmss[1]) * 60 + Number(mmss[2]);
};

const formatDisplayValue = (key: keyof ClubMember, value: unknown): string => {
    if (value === null || value === undefined) return '';
    if (key === 'first_club_run_date' || key === 'last_club_run_date') {
        return formatSqlDate(String(value));
    }
    if (key === 'best_curve_ranking_current' || key === 'best_curve_ranking_historic') {
        const numericValue = parseNumber(value);
        return numericValue === null ? '' : String(Math.round(numericValue));
    }
    return String(value);
};

const compareClubValues = (a: ClubMember, b: ClubMember, key: keyof ClubMember, direction: ClubSortDirection): number => {
    const left = a[key];
    const right = b[key];

    const leftDate = parseDateSortValue(left);
    const rightDate = parseDateSortValue(right);
    if ((key === 'first_club_run_date' || key === 'last_club_run_date') && leftDate !== null && rightDate !== null) {
        return direction === 'asc' ? leftDate - rightDate : rightDate - leftDate;
    }

    const leftNumber = parseNumber(left);
    const rightNumber = parseNumber(right);
    if (leftNumber !== null && rightNumber !== null) {
        return direction === 'asc' ? leftNumber - rightNumber : rightNumber - leftNumber;
    }

    const leftTime = parseTimeToSeconds(left);
    const rightTime = parseTimeToSeconds(right);
    if (leftTime !== null && rightTime !== null) {
        return direction === 'asc' ? leftTime - rightTime : rightTime - leftTime;
    }

    const leftText = left === null || left === undefined ? '' : String(left).toLowerCase();
    const rightText = right === null || right === undefined ? '' : String(right).toLowerCase();
    const result = leftText.localeCompare(rightText);
    return direction === 'asc' ? result : -result;
};

const compareClubCourseSummaryValues = (
    a: ClubCourseSummaryRecord,
    b: ClubCourseSummaryRecord,
    key: keyof ClubCourseSummaryRecord,
    direction: ClubSortDirection
): number => {
    const left = a[key];
    const right = b[key];

    const leftNumber = parseNumber(left);
    const rightNumber = parseNumber(right);
    if (leftNumber !== null && rightNumber !== null) {
        return direction === 'asc' ? leftNumber - rightNumber : rightNumber - leftNumber;
    }

    const leftText = left === null || left === undefined ? '' : String(left).toLowerCase();
    const rightText = right === null || right === undefined ? '' : String(right).toLowerCase();
    const result = leftText.localeCompare(rightText);
    return direction === 'asc' ? result : -result;
};

const pickStringField = (value: unknown, keys: string[]): string | null => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return null;
    }
    const obj: any = value;
    for (const key of keys) {
        const candidate = obj[key];
        if (typeof candidate === 'string' && candidate.trim()) {
            return candidate.trim();
        }
    }
    return null;
};

const extractRunsArray = (payload: unknown): any[] => {
    if (Array.isArray(payload)) {
        return payload;
    }
    if (!payload || typeof payload !== 'object') {
        return [];
    }

    const obj: any = payload;
    const nestedArrayKeys = ['runs', 'results', 'records', 'rows', 'items', 'data', 'events'];
    for (const key of nestedArrayKeys) {
        const candidate = obj[key];
        if (Array.isArray(candidate)) {
            return candidate;
        }
    }

    return [];
};

const getMostRecentClubFromAthletePayload = (payload: unknown): string | null => {
    const runs = extractRunsArray(payload);
    const latestRun = runs.length > 0 ? runs[runs.length - 1] : null;
    const latestRunClub = pickStringField(latestRun, ['club']);
    if (latestRunClub) {
        return latestRunClub;
    }

    const summaryClub = pickStringField((payload as any)?.summary, ['club', 'athlete_club'])
        || pickStringField(payload, ['club', 'athlete_club']);
    return summaryClub || null;
};

const Clubs: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { isHelpMode } = useColumnHeaderMode();
    const locationState = toClubsLocationState(location.state ?? {});
    const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
    const clubsLayoutConfig = useMemo(() => getClubsLayoutConfig() as any, []);
    const tableHeaderHelpEnabled = clubsLayoutConfig?.tableHelpTip?.enabled !== false;
    const tableHeaderHelpDelayMs = Number(clubsLayoutConfig?.tableHelpTip?.delayMs) > 0
        ? Number(clubsLayoutConfig.tableHelpTip.delayMs)
        : 2000;
    const delayedHeaderHelp = useDelayedUnifiedHelp(tableHeaderHelpEnabled, tableHeaderHelpDelayMs);

    const onHeaderActivate = (
        eventTarget: EventTarget | null,
        label: string,
        onSort: () => void,
        helpTarget?: string
    ) => {
        if (!isHelpMode) {
            onSort();
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
    const initialClubFromUrl = (searchParams.get('club') || '').trim();
    const [userClub, setUserClub] = useState<string | null>(null);
    const initialClub = initialClubFromUrl || userClub || '';

    // If there is no club in URL, default to logged-in athlete's most recent club.
    useEffect(() => {
        if (initialClubFromUrl) {
            return;
        }

        let cancelled = false;
        const loadLoggedInAthleteClub = async () => {
            try {
                const raw = localStorage.getItem('auth_user_v1');
                if (!raw) {
                    return;
                }
                const parsed = JSON.parse(raw);
                const athleteCode = typeof parsed?.athleteCode === 'string' ? parsed.athleteCode.trim() : '';
                if (!athleteCode) {
                    return;
                }

                const payload = await fetchAthleteRuns(athleteCode);
                const club = getMostRecentClubFromAthletePayload(payload);
                if (!cancelled && club) {
                    setUserClub(club);
                }
            } catch {
                // Ignore default-club lookup failures and allow manual entry.
            }
        };

        loadLoggedInAthleteClub();
        return () => {
            cancelled = true;
        };
    }, [initialClubFromUrl]);
    const initialSortKeyParam = searchParams.get('club_sort') || 'club_runs_total';
    const initialSortDirectionParam = searchParams.get('club_dir');
    const initialClubModeParam = searchParams.get('club_mode');
    const highlightedAthleteCode = searchParams.get('highlight_athlete') || '';

    const initialSortKey: keyof ClubMember = clubSortableKeys.has(initialSortKeyParam as keyof ClubMember)
        ? (initialSortKeyParam as keyof ClubMember)
        : 'club_runs_total';
    const initialSortDirection: ClubSortDirection = initialSortDirectionParam === 'asc' ? 'asc' : 'desc';
    const initialClubMode: ClubMode = initialClubModeParam === 'events'
        ? 'events'
        : initialClubModeParam === 'current_members'
            ? 'current_members'
            : 'members';

    const [query, setQuery] = useState(initialClub);
    const [clubOptions, setClubOptions] = useState<ClubOption[]>([]);
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [highlight, setHighlight] = useState(-1);
    const [selectedClub, setSelectedClub] = useState<ClubOption | null>(initialClub ? { club: initialClub, athlete_count: 0 } : null);
    const [clubMode, setClubMode] = useState<ClubMode>(initialClubMode);
    const [members, setMembers] = useState<ClubMember[]>([]);
    const [membersLoading, setMembersLoading] = useState(false);
    const [sortKey, setSortKey] = useState<keyof ClubMember>(initialSortKey);
    const [sortDirection, setSortDirection] = useState<ClubSortDirection>(initialSortDirection);
    const [courseSummaryRows, setCourseSummaryRows] = useState<ClubCourseSummaryRecord[]>([]);
    const [courseSummaryLoading, setCourseSummaryLoading] = useState(false);
    const waitCursorLoading = loading || (clubMode === 'events' ? courseSummaryLoading : membersLoading);
    useGlobalWaitCursor(waitCursorLoading);
    const [courseSummarySortKey, setCourseSummarySortKey] = useState<keyof ClubCourseSummaryRecord>('club_runs_all_history');
    const [courseSummarySortDirection, setCourseSummarySortDirection] = useState<ClubSortDirection>('desc');
    const [drillHistory, setDrillHistory] = useState<ClubViewState[]>([]);
    const [localHighlightAthleteCode, setLocalHighlightAthleteCode] = useState<string>(highlightedAthleteCode);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const inputRef = useRef<HTMLInputElement | null>(null);
    const dropdownRef = useRef<HTMLDivElement | null>(null);
    const [dropdownTop, setDropdownTop] = useState(0);
    const [dropdownLeft, setDropdownLeft] = useState(0);
    const [dropdownWidth, setDropdownWidth] = useState(0);
    const [layoutViewport, setLayoutViewport] = useState<ClubsViewport>(() => {
        if (typeof window === 'undefined') {
            return 'laptop';
        }
        return getClubsViewportForWidth(window.innerWidth);
    });
    const [isMobileViewport, setIsMobileViewport] = useState(() => {
        if (typeof window === 'undefined') {
            return false;
        }
        return window.innerWidth <= CLUBS_MOBILE_BREAKPOINT;
    });

    useEffect(() => {
        const handleResize = () => {
            setIsMobileViewport(window.innerWidth <= CLUBS_MOBILE_BREAKPOINT);
            setLayoutViewport(getClubsViewportForWidth(window.innerWidth));
        };

        handleResize();
        window.addEventListener('resize', handleResize);
        return () => {
            window.removeEventListener('resize', handleResize);
        };
    }, []);

    const clubLabelElement = getClubsElementById('clubs.clubLabel');
    const clubLabelHelpTarget = clubLabelElement?.helpTarget || 'control-recent-club';
    const membersTitleElement = getClubsElementById('clubs.membersTitle');
    const currentMembersTitleElement = getClubsElementById('clubs.currentMembersTitle');
    const eventsTitleElement = getClubsElementById('clubs.eventsTitle');
    const pClubLabel = getClubsElementPlacement('clubs.clubLabel', layoutViewport);
    const pMembersTitle = getClubsElementPlacement('clubs.membersTitle', layoutViewport);
    const pCurrentMembersTitle = getClubsElementPlacement('clubs.currentMembersTitle', layoutViewport);
    const pEventsTitle = getClubsElementPlacement('clubs.eventsTitle', layoutViewport);

    const activeHighlightAthleteCode = localHighlightAthleteCode || highlightedAthleteCode;

    const backTarget = useMemo(() => {
        if (locationState.returnTo?.pathname) {
            return `${locationState.returnTo.pathname}${locationState.returnTo.search ?? ''}`;
        }
        return '/results';
    }, [locationState.returnTo]);

    const persistEventReturnHighlight = () => {
        if (locationState.returnTo?.pathname !== '/races') {
            return;
        }

        const clubToken = String(selectedClub?.club || '').trim();
        if (!clubToken) {
            return;
        }

        const params = new URLSearchParams(locationState.returnTo?.search || '');
        const eventCode = String(params.get('event_code') || params.get('eventCode') || '').trim();
        const eventDate = String(params.get('date') || params.get('event_date') || params.get('eventDate') || '').trim();
        if (!eventCode || !eventDate) {
            return;
        }

        try {
            window.sessionStorage.setItem('event_test_return_highlight', JSON.stringify({
                eventCode,
                eventDate,
                columnKey: 'club',
                token: clubToken
            }));
        } catch (_err) {
        }
    };

    const handleBack = () => {
        if (drillHistory.length > 0) {
            const previous = drillHistory[drillHistory.length - 1];
            setDrillHistory((prev) => prev.slice(0, -1));
            setSelectedClub({ club: previous.club, athlete_count: 0 });
            setQuery(previous.club);
            setClubMode(previous.mode);
            setSortKey(previous.sortKey);
            setSortDirection(previous.sortDirection);
            setLocalHighlightAthleteCode(previous.highlightAthleteCode || '');
            return;
        }

        persistEventReturnHighlight();

        if (navigateBackWithNavStack(navigate, location.pathname)) {
            return;
        }
        navigate(backTarget);
    };

    useEffect(() => {
        const onWindowClick = (event: MouseEvent) => {
            const target = event.target as Node;
            const clickedInsideInput = Boolean(containerRef.current && containerRef.current.contains(target));
            const clickedInsideDropdown = Boolean(dropdownRef.current && dropdownRef.current.contains(target));
            if (!clickedInsideInput && !clickedInsideDropdown) {
                setOpen(false);
            }
        };
        window.addEventListener('click', onWindowClick);
        return () => {
            window.removeEventListener('click', onWindowClick);
        };
    }, []);

    useEffect(() => {
        const trimmed = query.trim();
        if (trimmed.length === 0) {
            setClubOptions([]);
            setLoading(false);
            setOpen(false);
            setHighlight(-1);
            return;
        }

        const isExactSelectedClub = Boolean(
            selectedClub?.club && normalizeClubName(trimmed) === normalizeClubName(selectedClub.club)
        );
        if (isExactSelectedClub) {
            setOpen(false);
            setHighlight(-1);
            return;
        }

        let cancelled = false;
        setLoading(true);
        setOpen(true);
        setHighlight(-1);
        const timer = window.setTimeout(async () => {
            try {
                const data = await fetchClubsSearch(trimmed, 25);
                if (!cancelled) {
                    setClubOptions(Array.isArray(data) ? data : []);
                    setOpen(true);
                    setHighlight(-1);
                }
            } catch (_err) {
                if (!cancelled) {
                    setClubOptions([]);
                    setOpen(true);
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        }, 180);

        return () => {
            cancelled = true;
            window.clearTimeout(timer);
        };
    }, [query, selectedClub]);

    useEffect(() => {
        if (!open || query.trim().length === 0) {
            return;
        }

        const updateDropdownPosition = () => {
            if (!inputRef.current) {
                return;
            }
            const rect = inputRef.current.getBoundingClientRect();
            const viewportTopOffset = window.visualViewport ? window.visualViewport.offsetTop : 0;
            const viewportLeftOffset = window.visualViewport ? window.visualViewport.offsetLeft : 0;
            setDropdownTop(rect.bottom + 4 + viewportTopOffset);
            setDropdownLeft(rect.left + viewportLeftOffset);
            setDropdownWidth(Math.max(rect.width, 220) + 38);
        };

        updateDropdownPosition();
        window.addEventListener('resize', updateDropdownPosition);
        window.addEventListener('scroll', updateDropdownPosition, true);

        return () => {
            window.removeEventListener('resize', updateDropdownPosition);
            window.removeEventListener('scroll', updateDropdownPosition, true);
        };
    }, [open, query]);

    const chooseClub = (club: ClubOption) => {
        setSelectedClub(club);
        setQuery(club.club);
        setOpen(false);
        setHighlight(-1);
        setClubMode('members');
        setSortKey('club_runs_total');
        setSortDirection('desc');
        setCourseSummarySortKey('club_runs_all_history');
        setCourseSummarySortDirection('desc');
        setDrillHistory([]);
        setLocalHighlightAthleteCode('');
    };

    useEffect(() => {
        if (!initialClub) {
            return;
        }
        setSelectedClub((prev) => {
            if (prev && prev.club === initialClub) {
                return prev;
            }
            return { club: initialClub, athlete_count: prev?.athlete_count ?? 0 };
        });
        setQuery((prev) => (prev && prev.trim().length > 0 ? prev : initialClub));
        setLocalHighlightAthleteCode(highlightedAthleteCode || '');
    }, [initialClub]);

    useEffect(() => {
        if (!selectedClub) {
            return;
        }

        let cancelled = false;
        setMembersLoading(true);
        fetchClubMembers(selectedClub.club)
            .then((data) => {
                if (!cancelled) {
                    setMembers(Array.isArray(data) ? data : []);
                }
            })
            .catch(() => {
                if (!cancelled) {
                    setMembers([]);
                }
            })
            .finally(() => {
                if (!cancelled) {
                    setMembersLoading(false);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [selectedClub]);

    useEffect(() => {
        if (!selectedClub) {
            return;
        }

        let cancelled = false;
        setCourseSummaryLoading(true);
        fetchClubCourseSummary(selectedClub.club)
            .then((data) => {
                if (!cancelled) {
                    setCourseSummaryRows(Array.isArray(data) ? data : []);
                }
            })
            .catch(() => {
                if (!cancelled) {
                    setCourseSummaryRows([]);
                }
            })
            .finally(() => {
                if (!cancelled) {
                    setCourseSummaryLoading(false);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [selectedClub]);

    const sortedMembers = useMemo(() => {
        const copy = [...members];
        copy.sort((left, right) => compareClubValues(left, right, sortKey, sortDirection));
        return copy;
    }, [members, sortDirection, sortKey]);

    const onSortColumn = (key: keyof ClubMember) => {
        if (sortKey === key) {
            setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
            return;
        }
        setSortKey(key);
        setSortDirection('asc');
    };

    const onSortCourseSummaryColumn = (key: keyof ClubCourseSummaryRecord) => {
        if (!clubCourseSummarySortableKeys.has(key)) {
            return;
        }
        if (courseSummarySortKey === key) {
            setCourseSummarySortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
            return;
        }
        setCourseSummarySortKey(key);
        setCourseSummarySortDirection('asc');
    };

    const rowsToRender = useMemo(() => {
        if (clubMode !== 'current_members') {
            return sortedMembers;
        }
        const selectedClubName = normalizeClubName(selectedClub?.club);
        if (!selectedClubName) {
            return sortedMembers;
        }
        return sortedMembers.filter((member) => normalizeClubName(member.current_club) === selectedClubName);
    }, [clubMode, selectedClub?.club, sortedMembers]);

    const sortedCourseSummaryRows = useMemo(() => {
        const copy = [...courseSummaryRows];
        copy.sort((left, right) => compareClubCourseSummaryValues(left, right, courseSummarySortKey, courseSummarySortDirection));
        return copy;
    }, [courseSummaryRows, courseSummarySortDirection, courseSummarySortKey]);

    const activeMembersCount = selectedClub
        ? (selectedClub.athlete_count > 0 ? selectedClub.athlete_count : members.length)
        : 0;

    const handleToggleMode = () => {
        setClubMode((prev) => {
            return getNextMode(prev);
        });
    };

    const handleCurrentClubOpen = (member: ClubMember) => {
        const targetClub = String(member.current_club || '').trim();
        const fromClub = String(selectedClub?.club || '').trim();
        if (!targetClub || !fromClub || normalizeClubName(targetClub) === normalizeClubName(fromClub)) {
            return;
        }

        setDrillHistory((prev) => ([
            ...prev,
            {
                club: fromClub,
                mode: clubMode,
                sortKey,
                sortDirection,
                highlightAthleteCode: member.athlete_code ? String(member.athlete_code) : undefined
            }
        ]));

        setSelectedClub({ club: targetClub, athlete_count: 0 });
        setQuery(targetClub);
        setClubMode('members');
        setSortKey('club_runs_total');
        setSortDirection('desc');
        setCourseSummarySortKey('club_runs_all_history');
        setCourseSummarySortDirection('desc');
        setLocalHighlightAthleteCode('');
    };

    const handleCourseOpen = (row: ClubCourseSummaryRecord) => {
        const eventCode = String(row.event_code ?? '').trim();
        const eventName = String(row.event_name ?? '').trim();
        if (!eventCode) {
            return;
        }

        const params = new URLSearchParams();
        params.set('event_code', eventCode);
        if (eventName) {
            params.set('event_name', eventName);
        }

        const returnParams = new URLSearchParams();
        if (selectedClub?.club) {
            returnParams.set('club', selectedClub.club);
        }
        returnParams.set('club_mode', 'events');

        navigateWithNavStack(navigate, location, `/courses_test?${params.toString()}`, {
            state: {
                eventCode,
                eventName,
                from: 'clubs',
                returnTo: {
                    pathname: '/clubs',
                    search: `?${returnParams.toString()}`
                }
            }
        });
    };

    const handleParticipantOpen = (member: ClubMember) => {
        const athleteCode = member.athlete_code;
        if (!athleteCode) {
            return;
        }

        const params = new URLSearchParams();
        params.set('athlete_code', String(athleteCode));

        const returnParams = new URLSearchParams();
        if (selectedClub?.club) {
            returnParams.set('club', selectedClub.club);
        }
        returnParams.set('club_mode', clubMode);
        returnParams.set('club_sort', String(sortKey));
        returnParams.set('club_dir', sortDirection);
        returnParams.set('highlight_athlete', String(athleteCode));
        const returnSearch = `?${returnParams.toString()}`;

        navigateWithNavStack(navigate, location, `/athletes?${params.toString()}`, {
            state: {
                athleteCode: String(athleteCode),
                athleteName: member.name ? String(member.name) : undefined,
                from: 'clubs',
                returnTo: {
                    pathname: '/clubs',
                    search: returnSearch
                }
            }
        });
    };

    useEffect(() => {
        if (!activeHighlightAthleteCode || !rowsToRender.length || clubMode === 'events') {
            return;
        }
        const scrollTimeout = window.setTimeout(() => {
            const highlightedRow = document.querySelector('.clubs-highlighted-row');
            if (highlightedRow) {
                highlightedRow.scrollIntoView({
                    behavior: 'smooth',
                    block: 'center'
                });
            }
        }, 120);

        return () => window.clearTimeout(scrollTimeout);
    }, [clubMode, activeHighlightAthleteCode, rowsToRender]);

    const nextClubMode = getNextMode(clubMode);

    return (
        <div className="page-content clubs-page" style={{ position: 'relative' }}>
            <div className="clubs-header">
                <div className="clubs-left-controls">
                    <button
                        type="button"
                        className="clubs-back-button"
                        aria-label="Back to Event analysis"
                        title="Back to Event analysis"
                        onClick={handleBack}
                    >
                        &#8592;
                    </button>
                    {selectedClub && (
                        <button
                            type="button"
                            className="clubs-mode-button"
                            title={`Switch to ${modeLabel(nextClubMode)}`}
                            aria-label={`Switch to ${modeLabel(nextClubMode)}`}
                            onClick={handleToggleMode}
                        >
                            {modeButtonLabel(nextClubMode)}
                        </button>
                    )}
                </div>
                <div className="clubs-header-main">
                    <div className="clubs-search-stack">
                        <span className="help-tooltip" style={{ display: 'inline-flex' }}>
                            <button
                                type="button"
                                className="help-trigger help-trigger-label clubs-search-label"
                                onClick={(event) => {
                                    const rect = (event.currentTarget as HTMLButtonElement).getBoundingClientRect();
                                    requestUnifiedHelp(clubLabelHelpTarget, {
                                        x: rect.left,
                                        y: rect.bottom
                                    });
                                }}
                                title={`${clubLabelElement?.name || 'Recent club'} help`}
                                aria-label={`${clubLabelElement?.name || 'Recent club'} help`}
                                style={{
                                    fontSize: clubLabelElement?.style?.fontSize ?? '0.75rem',
                                    fontWeight: clubLabelElement?.style?.fontWeight ?? 600,
                                    color: clubLabelElement?.style?.color ?? '#111827',
                                    lineHeight: Number(clubLabelElement?.style?.lineHeight ?? 0.9),
                                    marginTop: pClubLabel?.y ?? clubLabelElement?.[layoutViewport]?.y ?? undefined
                                }}
                            >
                                <span className="help-trigger-text">{clubLabelElement?.name || 'Recent club:'}</span>
                            </button>
                        </span>
                        <div className="clubs-search-wrap" ref={containerRef}>
                            <input
                                ref={inputRef}
                                id="clubs-search-input"
                                aria-label="Search clubs"
                                placeholder="Enter Search"
                                value={query}
                                onChange={(event) => {
                                    setQuery(event.target.value);
                                    setSelectedClub(null);
                                    setMembers([]);
                                }}
                                onFocus={() => {
                                    if (query.trim().length > 0) {
                                        setOpen(true);
                                    }
                                }}
                                onKeyDown={(event) => {
                                    if (!open) return;
                                    if (event.key === 'ArrowDown') {
                                        event.preventDefault();
                                        setHighlight((prev) => Math.min(prev + 1, clubOptions.length - 1));
                                    } else if (event.key === 'ArrowUp') {
                                        event.preventDefault();
                                        setHighlight((prev) => Math.max(prev - 1, 0));
                                    } else if (event.key === 'Enter') {
                                        if (highlight >= 0 && highlight < clubOptions.length) {
                                            chooseClub(clubOptions[highlight]);
                                        } else if (clubOptions.length > 0) {
                                            chooseClub(clubOptions[0]);
                                        }
                                    } else if (event.key === 'Escape') {
                                        setOpen(false);
                                    }
                                }}
                                className="clubs-search-input"
                            />

                            {open && query.trim().length > 0 && createPortal(
                                <div
                                    ref={dropdownRef}
                                    role="listbox"
                                    className="clubs-search-dropdown"
                                    style={{
                                        position: 'fixed',
                                        zIndex: 2147483647,
                                        top: dropdownTop,
                                        left: dropdownLeft,
                                        width: dropdownWidth
                                    }}
                                >
                                    {loading && <div className="clubs-search-loading">Loading...</div>}
                                    {!loading && clubOptions.length === 0 && (
                                        <div className="clubs-search-loading">No clubs found</div>
                                    )}
                                    {!loading && clubOptions.map((opt, idx) => (
                                        <div
                                            key={`${opt.club}-${idx}`}
                                            role="option"
                                            aria-selected={highlight === idx}
                                            onMouseDown={(event) => event.preventDefault()}
                                            onClick={() => chooseClub(opt)}
                                            onMouseEnter={() => setHighlight(idx)}
                                            className={highlight === idx ? 'clubs-search-option clubs-search-option--highlight' : 'clubs-search-option'}
                                        >
                                            <span className="clubs-search-option-name">{opt.club}</span>
                                            <span className="clubs-search-option-count">{opt.athlete_count}</span>
                                        </div>
                                    ))}
                                </div>,
                                document.body
                            )}
                        </div>

                    </div>
                </div>
            </div>

            {selectedClub && (
                <div className="clubs-members-info-strip">
                    <div className="clubs-active-members">
                        {activeMembersCount} active member{activeMembersCount === 1 ? '' : 's'}.
                    </div>
                </div>
            )}

            {selectedClub && clubMode === 'members' && membersTitleElement && (
                <div
                    style={{
                        position: 'absolute',
                        left: pMembersTitle?.x ?? membersTitleElement?.[layoutViewport]?.x ?? '0.3cm',
                        top: pMembersTitle?.y ?? membersTitleElement?.[layoutViewport]?.y ?? '3.2cm',
                        width: pMembersTitle?.width ?? membersTitleElement?.[layoutViewport]?.width,
                        color: membersTitleElement?.style?.color ?? '#111827',
                        fontSize: membersTitleElement?.style?.fontSize ?? '0.95rem',
                        fontWeight: membersTitleElement?.style?.fontWeight ?? 700,
                        lineHeight: Number(membersTitleElement?.style?.lineHeight ?? 1),
                        zIndex: 100,
                        pointerEvents: 'none'
                    }}
                >
                    {membersTitleElement?.name || 'Current & Historic Membership'}
                </div>
            )}

            {selectedClub && clubMode === 'current_members' && currentMembersTitleElement && (
                <div
                    style={{
                        position: 'absolute',
                        left: pCurrentMembersTitle?.x ?? currentMembersTitleElement?.[layoutViewport]?.x ?? '0.3cm',
                        top: pCurrentMembersTitle?.y ?? currentMembersTitleElement?.[layoutViewport]?.y ?? '3.2cm',
                        width: pCurrentMembersTitle?.width ?? currentMembersTitleElement?.[layoutViewport]?.width,
                        color: currentMembersTitleElement?.style?.color ?? '#111827',
                        fontSize: currentMembersTitleElement?.style?.fontSize ?? '0.95rem',
                        fontWeight: currentMembersTitleElement?.style?.fontWeight ?? 700,
                        lineHeight: Number(currentMembersTitleElement?.style?.lineHeight ?? 1),
                        zIndex: 100,
                        pointerEvents: 'none'
                    }}
                >
                    {currentMembersTitleElement?.name || 'Current Membership'}
                </div>
            )}

            {selectedClub && clubMode === 'events' && eventsTitleElement && (
                <div
                    style={{
                        position: 'absolute',
                        left: pEventsTitle?.x ?? eventsTitleElement?.[layoutViewport]?.x ?? '0.3cm',
                        top: pEventsTitle?.y ?? eventsTitleElement?.[layoutViewport]?.y ?? '3.2cm',
                        width: pEventsTitle?.width ?? eventsTitleElement?.[layoutViewport]?.width,
                        color: eventsTitleElement?.style?.color ?? '#111827',
                        fontSize: eventsTitleElement?.style?.fontSize ?? '0.95rem',
                        fontWeight: eventsTitleElement?.style?.fontWeight ?? 700,
                        lineHeight: Number(eventsTitleElement?.style?.lineHeight ?? 1),
                        zIndex: 100,
                        pointerEvents: 'none'
                    }}
                >
                    {eventsTitleElement?.name || 'Course popularity'}
                </div>
            )}

            {selectedClub && (clubMode === 'members' || clubMode === 'current_members') && (
                <div className="athlete-runs-table-wrapper clubs-members-table-wrap">
                    {membersLoading ? (
                        <div className="clubs-members-loading">Loading members...</div>
                    ) : (
                        <table className="athlete-runs-table" aria-label="Club members summary">
                            <thead>
                                <tr>
                                    {clubColumns.map((column) => {
                                        const alignStyle = getClubColumnStyle(column, isMobileViewport);
                                        const headerClasses: string[] = ['athlete-table-header'];
                                        if (column.key === 'name') headerClasses.push('athlete-date-header');
                                        const isSorted = sortKey === column.key;
                                        const sortIndicator = isSorted ? (sortDirection === 'asc' ? '▲' : '▼') : '';
                                        const headerLabel = column.headerName || column.name || String(column.key);
                                        return (
                                            <th
                                                key={String(column.key)}
                                                className={headerClasses.join(' ')}
                                                style={alignStyle}
                                                onClick={(event) => onHeaderActivate(event.currentTarget, headerLabel, () => onSortColumn(column.key as keyof ClubMember), (column as any)?.helpTarget)}
                                                onMouseEnter={(event) => {
                                                    delayedHeaderHelp.schedule({
                                                        event,
                                                        label: headerLabel,
                                                        markerId: (column as any)?.helpTarget
                                                    });
                                                }}
                                                onMouseLeave={delayedHeaderHelp.clear}
                                                onMouseDown={delayedHeaderHelp.clear}
                                                onTouchStart={delayedHeaderHelp.clear}
                                                role="button"
                                                tabIndex={0}
                                                onKeyDown={(event) => {
                                                    if (event.key === 'Enter' || event.key === ' ') {
                                                        event.preventDefault();
                                                        onHeaderActivate(event.currentTarget, headerLabel, () => onSortColumn(column.key as keyof ClubMember), (column as any)?.helpTarget);
                                                    }
                                                }}
                                                aria-sort={isSorted ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
                                            >
                                                <span>{headerLabel}</span>
                                                {sortIndicator && <span style={{ marginLeft: 4 }}>{sortIndicator}</span>}
                                            </th>
                                        );
                                    })}
                                </tr>
                            </thead>
                            <tbody>
                                {rowsToRender.length === 0 ? (
                                    <tr>
                                        <td colSpan={clubColumns.length} className="clubs-members-empty">No members found.</td>
                                    </tr>
                                ) : rowsToRender.map((member) => {
                                    // Assume a linked participant is one where member.current_club matches selectedClub.club (customize as needed)
                                    const isLinked = normalizeClubName(member.current_club) === normalizeClubName(selectedClub?.club);
                                    const rowClass = [
                                        isLinked ? 'clubs-linked-athlete-row' : '',
                                        activeHighlightAthleteCode && String(member.athlete_code) === String(activeHighlightAthleteCode) ? 'clubs-highlighted-row' : ''
                                    ].filter(Boolean).join(' ');
                                    return (
                                        <tr
                                            key={member.athlete_code}
                                            className={rowClass}
                                        >
                                            {clubColumns.map((column) => {
                                                const alignmentStyle = getClubColumnStyle(column, isMobileViewport);
                                                const key = column.key as keyof ClubMember;
                                                const value = member[key];
                                                if (column.key === 'name') {
                                                    return (
                                                        <th key={String(column.key)} scope="row" className="athlete-date-cell" style={alignmentStyle}>
                                                            <button
                                                                type="button"
                                                                className={isLinked ? 'clubs-athlete-button clubs-linked-athlete-button' : 'clubs-athlete-button'}
                                                                onClick={() => handleParticipantOpen(member)}
                                                                title="Open athlete run history"
                                                                aria-label={`Open run history for ${member.name || member.athlete_code}`}
                                                            >
                                                                {member.name || member.athlete_code}
                                                            </button>
                                                        </th>
                                                    );
                                                }
                                                if (column.key === 'current_club') {
                                                    const currentClubValue = String(value || '').trim();
                                                    const isClickable = currentClubValue.length > 0 && normalizeClubName(currentClubValue) !== normalizeClubName(selectedClub?.club);
                                                    return (
                                                        <td key={String(column.key)} style={alignmentStyle}>
                                                            {isClickable ? (
                                                                <button
                                                                    type="button"
                                                                    className="clubs-current-club-button"
                                                                    onClick={() => handleCurrentClubOpen(member)}
                                                                    title={`Open ${currentClubValue}`}
                                                                    aria-label={`Open club ${currentClubValue}`}
                                                                >
                                                                    {currentClubValue}
                                                                </button>
                                                            ) : formatDisplayValue(column.key, value)}
                                                        </td>
                                                    );
                                                }

                                                if (column.key === 'best_curve_ranking_current') {
                                                    const currentRankRaw = member.best_curve_ranking_current;
                                                    const historicRankRaw = member.best_curve_ranking_historic;
                                                    const rankTypeRaw = member.best_curve_ranking_current_type;
                                                    const rankSubFontSize = String((column as any)?.style?.subFontSize || '0.62rem');

                                                    const currentRank = parseNumber(currentRankRaw);
                                                    const historicRank = parseNumber(historicRankRaw);
                                                    const hasCurrent = currentRank !== null;
                                                    const hasHistoric = historicRank !== null;

                                                    const rankType = hasCurrent ? (String(rankTypeRaw ?? '').trim() || '*') : '';
                                                    const currentRankInt = hasCurrent ? Math.round(currentRank) : null;
                                                    const historicRankInt = hasHistoric ? Math.round(historicRank) : null;
                                                    const displayedRankInt = currentRankInt ?? historicRankInt;
                                                    const delta = currentRankInt !== null && historicRankInt !== null
                                                        ? currentRankInt - historicRankInt
                                                        : null;
                                                    const deltaText = delta === null ? '' : `${delta >= 0 ? '+' : ''}${delta}`;

                                                    return (
                                                        <td key={String(column.key)} style={{ ...alignmentStyle, textAlign: 'center' }}>
                                                            <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                                                                <span>{displayedRankInt !== null ? String(displayedRankInt) : ''}</span>
                                                                {(rankType || deltaText) ? (
                                                                    <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', lineHeight: 1.02 }}>
                                                                        <span style={{ fontSize: rankSubFontSize, opacity: 0.9 }}>{rankType}</span>
                                                                        <span style={{ fontSize: rankSubFontSize, opacity: 0.9 }}>{deltaText}</span>
                                                                    </span>
                                                                ) : null}
                                                            </div>
                                                        </td>
                                                    );
                                                }

                                                return (
                                                    <td key={String(column.key)} style={alignmentStyle}>
                                                        {formatDisplayValue(key, value)}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            )}

            {selectedClub && clubMode === 'events' && (
                <div className="athlete-runs-table-wrapper clubs-members-table-wrap">
                    {courseSummaryLoading ? (
                        <div className="clubs-members-loading">Loading course summary...</div>
                    ) : (
                        <table className="athlete-runs-table" aria-label="Club course summary">
                            <thead>
                                <tr>
                                    {clubCourseSummaryColumns.map((column) => {
                                        const alignStyle = getClubColumnStyle(column, isMobileViewport);
                                        const headerClasses: string[] = ['athlete-table-header'];
                                        if (column.key === 'event_name') headerClasses.push('athlete-date-header');
                                        const sortKey = (column.key === 'club_runs_last_year_summary' ? 'club_runs_last_year' : column.key) as keyof ClubCourseSummaryRecord;
                                        const isSorted = courseSummarySortKey === sortKey;
                                        const sortIndicator = isSorted ? (courseSummarySortDirection === 'asc' ? '▲' : '▼') : '';
                                        const headerLabel = column.headerName || column.name || String(column.key);
                                        return (
                                            <th
                                                key={String(column.key)}
                                                className={headerClasses.join(' ')}
                                                style={alignStyle}
                                                onClick={(event) => onHeaderActivate(event.currentTarget, headerLabel, () => onSortCourseSummaryColumn(sortKey), (column as any)?.helpTarget)}
                                                onMouseEnter={(event) => {
                                                    delayedHeaderHelp.schedule({
                                                        event,
                                                        label: headerLabel,
                                                        markerId: (column as any)?.helpTarget
                                                    });
                                                }}
                                                onMouseLeave={delayedHeaderHelp.clear}
                                                onMouseDown={delayedHeaderHelp.clear}
                                                onTouchStart={delayedHeaderHelp.clear}
                                                role="button"
                                                tabIndex={0}
                                                onKeyDown={(event) => {
                                                    if (event.key === 'Enter' || event.key === ' ') {
                                                        event.preventDefault();
                                                        onHeaderActivate(event.currentTarget, headerLabel, () => onSortCourseSummaryColumn(sortKey), (column as any)?.helpTarget);
                                                    }
                                                }}
                                                aria-sort={isSorted ? (courseSummarySortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
                                            >
                                                <span>{headerLabel}</span>
                                                {sortIndicator && <span style={{ marginLeft: 4 }}>{sortIndicator}</span>}
                                            </th>
                                        );
                                    })}
                                </tr>
                            </thead>
                            <tbody>
                                {sortedCourseSummaryRows.length === 0 ? (
                                    <tr>
                                        <td colSpan={clubCourseSummaryColumns.length} className="clubs-members-empty">No course summary found.</td>
                                    </tr>
                                ) : sortedCourseSummaryRows.map((row) => (
                                    <tr key={`${row.event_code}-${row.event_name}`}>
                                        {clubCourseSummaryColumns.map((column) => {
                                            const alignmentStyle = getClubColumnStyle(column, isMobileViewport);
                                            const dataKey = (column.key === 'club_runs_last_year_summary' ? 'club_runs_last_year' : column.key) as keyof ClubCourseSummaryRecord;
                                            const value = row[dataKey];
                                            if (column.key === 'event_name') {
                                                return (
                                                    <th key={String(column.key)} scope="row" className="athlete-date-cell" style={alignmentStyle}>
                                                        <button
                                                            type="button"
                                                            className="clubs-current-club-button"
                                                            onClick={() => handleCourseOpen(row)}
                                                            title={`Open course ${String(value ?? '')}`}
                                                            aria-label={`Open course ${String(value ?? '')}`}
                                                        >
                                                            {String(value ?? '')}
                                                        </button>
                                                    </th>
                                                );
                                            }
                                            return (
                                                <td key={String(column.key)} style={alignmentStyle}>
                                                    {value === null || value === undefined ? '' : String(value)}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            )}
        </div>
    );
};

export default Clubs;
