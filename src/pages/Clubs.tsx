import React, { useEffect, useMemo, useState } from 'react';
import { fetchAthleteRuns } from '../api/backendAPI';
import { useLocation, useNavigate } from 'react-router-dom';
import { fetchClubMembers, fetchClubsSearch } from '../api/backendAPI';
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

type ClubColumn = {
    key: keyof ClubMember;
    label: string;
    align?: 'left' | 'center' | 'right';
    desktopWidth?: number;
    mobileWidth?: number;
};

const clubColumns: ClubColumn[] = [
    { key: 'name', label: 'Participants', align: 'left', desktopWidth: 115, mobileWidth: 115 },
    { key: 'club_runs_total', label: 'Club runs', align: 'center', desktopWidth: 62, mobileWidth: 60 },
    { key: 'club_runs_last_year', label: 'Club runs 1y', align: 'center', desktopWidth: 65, mobileWidth: 64 },
    { key: 'total_runs_all_clubs', label: 'All runs', align: 'center', desktopWidth: 60, mobileWidth: 60 },
    { key: 'first_club_run_date', label: '1st club run', align: 'center', desktopWidth: 75, mobileWidth: 73 },
    { key: 'last_club_run_date', label: 'Lst club run', align: 'center', desktopWidth: 75, mobileWidth: 73 },
    { key: 'fastest_time', label: 'Best time', align: 'center', desktopWidth: 60, mobileWidth: 58 },
    { key: 'best_event_adj_time', label: 'Ev adj', align: 'center', desktopWidth: 55, mobileWidth: 55 },
    { key: 'best_age_event_adj_time', label: 'AE adj', align: 'center', desktopWidth: 55, mobileWidth: 54 },
    { key: 'best_age_sex_event_adj_time', label: 'AES adj', align: 'center', desktopWidth: 57, mobileWidth: 55 },
    { key: 'best_curve_ranking_current', label: 'Cur rank', align: 'center', desktopWidth: 55, mobileWidth: 54 },
    { key: 'best_curve_ranking_historic', label: 'Hist rank', align: 'center', desktopWidth: 55, mobileWidth: 54 },
    { key: 'best_curve_ranking_current_type', label: 'Rank type', align: 'center', desktopWidth: 60, mobileWidth: 60 },
    { key: 'current_club', label: 'Current club', align: 'left', desktopWidth: 132, mobileWidth: 120 }
];

const clubSortableKeys = new Set<keyof ClubMember>(clubColumns.map((column) => column.key));

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
    const locationState = toClubsLocationState(location.state ?? {});
    const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
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
    const [drillHistory, setDrillHistory] = useState<ClubViewState[]>([]);
    const [localHighlightAthleteCode, setLocalHighlightAthleteCode] = useState<string>(highlightedAthleteCode);

    const activeHighlightAthleteCode = localHighlightAthleteCode || highlightedAthleteCode;

    const backTarget = useMemo(() => {
        if (locationState.returnTo?.pathname) {
            return `${locationState.returnTo.pathname}${locationState.returnTo.search ?? ''}`;
        }
        return '/results';
    }, [locationState.returnTo]);

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
        navigate(backTarget);
    };

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
                    setOpen(false);
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

    const chooseClub = (club: ClubOption) => {
        setSelectedClub(club);
        setQuery(club.club);
        setOpen(false);
        setHighlight(-1);
        setClubMode('members');
        setSortKey('club_runs_total');
        setSortDirection('desc');
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

    const handleToggleMode = () => {
        setClubMode((prev) => {
            const idx = modeOrder.indexOf(prev);
            return modeOrder[(idx + 1) % modeOrder.length];
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
        setLocalHighlightAthleteCode('');
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

        navigate(`/athletes?${params.toString()}`, {
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

    return (
        <div className="page-content clubs-page">
            <div className="clubs-header">
                <div className="clubs-left-controls">
                    <button
                        type="button"
                        className="clubs-back-button"
                        aria-label="Back to Event analysis"
                        title="Back to Event analysis"
                        onClick={handleBack}
                        onTouchEnd={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            handleBack();
                        }}
                    >
                        &#8592;
                    </button>
                    {selectedClub && (
                        <button
                            type="button"
                            className="clubs-mode-button"
                            title={`View: ${modeLabel(clubMode)} (click to change)`}
                            aria-label={`View: ${modeLabel(clubMode)} (click to change)`}
                            onClick={handleToggleMode}
                        >
                            {modeButtonLabel(clubMode)}
                        </button>
                    )}
                </div>
                <div className="clubs-header-main">
                    <div className="clubs-search-wrap">
                        <input
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
                                if (clubOptions.length > 0) {
                                    setOpen(true);
                                }
                            }}
                            onBlur={() => {
                                window.setTimeout(() => setOpen(false), 150);
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

                        {open && (loading || clubOptions.length > 0) && (
                            <div role="listbox" className="clubs-search-dropdown">
                                {loading && <div className="clubs-search-loading">Loading...</div>}
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
                            </div>
                        )}

                        {selectedClub && (
                            <div className="clubs-active-members">
                                {(selectedClub.athlete_count > 0 ? selectedClub.athlete_count : members.length)} active member{(selectedClub.athlete_count > 0 ? selectedClub.athlete_count : members.length) === 1 ? '' : 's'}.
                            </div>
                        )}

                        {selectedClub && (
                            <div className="clubs-mode-label">
                                View: {modeLabel(clubMode)}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {selectedClub && (clubMode === 'members' || clubMode === 'current_members') && (
                <div className="athlete-runs-table-wrapper clubs-members-table-wrap">
                    {membersLoading ? (
                        <div className="clubs-members-loading">Loading members...</div>
                    ) : (
                        <table className="athlete-runs-table" aria-label="Club members summary">
                            <thead>
                                <tr>
                                    {clubColumns.map((column) => {
                                        const alignStyle = {
                                            textAlign: column.align ?? 'left',
                                            width: column.desktopWidth ? `${column.desktopWidth}px` : undefined,
                                            minWidth: column.desktopWidth ? `${column.desktopWidth}px` : undefined
                                        } as React.CSSProperties;
                                        const headerClasses: string[] = ['athlete-table-header'];
                                        if (column.key === 'name') headerClasses.push('athlete-date-header');
                                        const isSorted = sortKey === column.key;
                                        return (
                                            <th
                                                key={String(column.key)}
                                                className={headerClasses.join(' ')}
                                                style={alignStyle}
                                                onClick={() => onSortColumn(column.key)}
                                                role="button"
                                                tabIndex={0}
                                                onKeyDown={(event) => {
                                                    if (event.key === 'Enter' || event.key === ' ') {
                                                        event.preventDefault();
                                                        onSortColumn(column.key);
                                                    }
                                                }}
                                                aria-sort={isSorted ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
                                            >
                                                <span>{column.label}</span>
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
                                                const alignmentStyle = { textAlign: column.align ?? 'left' } as React.CSSProperties;
                                                const value = member[column.key];
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
                                                return (
                                                    <td key={String(column.key)} style={alignmentStyle}>
                                                        {formatDisplayValue(column.key, value)}
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
                    <div className="clubs-members-loading">Events view is currently unavailable.</div>
                </div>
            )}
        </div>
    );
};

export default Clubs;
