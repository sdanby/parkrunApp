import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import quickStartTiles from '../config/quickStartTiles.json';
import { buildQuickStartHelpMarkerId, QUICK_START_HELP_STATE_KEY, QUICK_START_TOUR_STATE_KEY } from './UnifiedHelp';
import { navigateWithNavStack } from '../utils/navigationStack';
import './QuickStart.css';

type QuickTile = {
    id: string;
    label: string;
    icon?: string;
    category: string;
    route: string;
    params: Record<string, unknown>;
    keywords?: string[];
};

type QuickTileTarget = {
    pathname: string;
    search?: string;
};

const CATEGORY_ORDER = [
    'Event Analysis',
    'Course Insights',
    'Personal Stats',
    'Next Event',
    'Clubs',
    'Lists & Records'
] as const;

const QUICK_START_GUIDANCE_ENABLED_KEY = 'quickStart:guidanceEnabled';

const CATEGORY_ACCENTS: Record<string, string> = {
    'Event Analysis': 'quick-start-accent-fire',
    'Course Insights': 'quick-start-accent-coast',
    'Personal Stats': 'quick-start-accent-forest',
    'Next Event': 'quick-start-accent-sun',
    'Clubs': 'quick-start-accent-stone',
    'Lists & Records': 'quick-start-accent-ink'
};

const PAGE_LABEL_BY_ROUTE: Record<string, string> = {
    '/event-analysis': 'Event Analysis',
    '/course': 'Course',
    '/athletes': 'Participant',
    '/next-event': 'Next Event',
    '/clubs': 'Club',
    '/lists': 'Lists'
};

const normalizeQuickStartPeriod = (value: unknown): string | null => {
    const token = String(value ?? '').trim().toLowerCase();
    if (!token) return null;
    if (token === 'last-50') return 'last50';
    if (token === 'all-events') return 'all';
    if (token === 'month-seasonality') return 'Mseason';
    if (token === 'quarter-seasonality') return 'Qseason';
    if (token === 'annual') return 'Annual';
    return token;
};

const buildTileTarget = (tile: QuickTile): QuickTileTarget => {
    const params = tile.params || {};
    const search = new URLSearchParams();

    if (tile.route === '/course') {
        const view = String(params.view ?? '').trim();
        const period = normalizeQuickStartPeriod(params.period);
        const panel = String(params.panel ?? '').trim();
        const groupsMode = String(params.groupsMode ?? params.groups_mode ?? '').trim().toLowerCase();
        const sort = params.sort && typeof params.sort === 'object' ? params.sort as Record<string, unknown> : null;
        const sortColumn = String(sort?.column ?? '').trim();
        const sortDirection = String(sort?.direction ?? '').trim().toLowerCase();
        if (view) search.set('view', view);
        if (period) search.set('period', period);
        if (panel) search.set('panel', panel);
        if (groupsMode === 'type' || groupsMode === 'age' || groupsMode === 'both') search.set('groups_mode', groupsMode);
        if (sortColumn) search.set('sort', sortColumn);
        if (sortDirection === 'asc' || sortDirection === 'desc') search.set('dir', sortDirection);
    }

    if (tile.route === '/clubs') {
        const club = String(params.club ?? '').trim();
        const mode = String(params.club_mode ?? '').trim();
        if (club) search.set('club', club);
        if (mode) search.set('club_mode', mode);
    }

    if (tile.route === '/athletes') {
        const athleteCode = String(params.athlete_code ?? params.athleteCode ?? '').trim();
        const athleteName = String(params.athlete_name ?? params.athleteName ?? '').trim();
        const athletePanel = String(params.ath_panel ?? params.athPanel ?? '').trim().toLowerCase();
        const athleteCourseAdj = String(params.ath_course_adj ?? params.athCourseAdj ?? '').trim().toLowerCase();
        const athleteOtherAdj = String(params.ath_other_adj ?? params.athOtherAdj ?? '').trim().toLowerCase();
        const athletePlotEligibility = String(params.ath_plot_eligibility ?? params.athPlotEligibility ?? '').trim().toLowerCase();
        const athletePlotSeries = String(params.ath_plot_series ?? params.athPlotSeries ?? '').trim().toLowerCase();
        if (athleteCode) search.set('athlete_code', athleteCode);
        if (athleteName) search.set('athlete_name', athleteName);
        if (athletePanel === 'table' || athletePanel === 'profile' || athletePanel === 'plot') search.set('ath_panel', athletePanel);
        if (athleteCourseAdj === 'none' || athleteCourseAdj === 'seasonal' || athleteCourseAdj === 'full') search.set('ath_course_adj', athleteCourseAdj);
        if (athleteOtherAdj === 'none' || athleteOtherAdj === 'age' || athleteOtherAdj === 'sex' || athleteOtherAdj === 'age_sex') search.set('ath_other_adj', athleteOtherAdj);
        if (athletePlotEligibility === 'all' || athletePlotEligibility === 'eligible' || athletePlotEligibility === 'best') search.set('ath_plot_eligibility', athletePlotEligibility);
        if (athletePlotSeries === 'events_only' || athletePlotSeries === 'rank_only' || athletePlotSeries === 'both_series') search.set('ath_plot_series', athletePlotSeries);
    }

    if (tile.route === '/next-event') {
        const athleteCode = String(params.athlete_code ?? params.athleteCode ?? '').trim();
        const athleteName = String(params.athlete_name ?? params.athleteName ?? '').trim();
        const nextEventMode = String(params.mode ?? params.next_event_mode ?? '').trim().toLowerCase();
        const nextEventCourseCode = String(params.course_code ?? params.courseCode ?? '').trim();
        const nextEventCourseSeed = String(params.course_seed ?? params.courseSeed ?? '').trim().toLowerCase();
        const nextEventCycle = String(params.next_event_cycle ?? params.nextEventCycle ?? '').trim().toLowerCase();
        const nextEventCurveRankOpen = String(params.curve_rank_open ?? params.curveRankOpen ?? '').trim().toLowerCase();
        const nextEventCurveRankType = String(params.curve_rank_type ?? params.curveRankType ?? '').trim().toUpperCase();
        const nextEventAgeGroup = String(params.age_group ?? params.ageGroup ?? '').trim().toUpperCase();
        const nextEventAdjType = String(params.adj_type ?? params.adjType ?? '').trim().toUpperCase();
        if (athleteCode) search.set('athlete_code', athleteCode);
        if (athleteName) search.set('athlete_name', athleteName);
        if (nextEventMode === 'next_pr' || nextEventMode === 'next_ext') search.set('mode', nextEventMode);
        if (nextEventCourseCode) search.set('course_code', nextEventCourseCode);
        if (nextEventCourseSeed === 'default_or_freq') search.set('course_seed', nextEventCourseSeed);
        if (nextEventCycle === 'rank_reference') search.set('next_event_cycle', nextEventCycle);
        if (nextEventCurveRankOpen === '1' || nextEventCurveRankOpen === 'true') search.set('curve_rank_open', '1');
        if (nextEventCurveRankType === 'B' || nextEventCurveRankType === 'E' || nextEventCurveRankType === 'AE' || nextEventCurveRankType === 'ES' || nextEventCurveRankType === 'AES' || nextEventCurveRankType === 'BEST') search.set('curve_rank_type', nextEventCurveRankType);
        if (nextEventAgeGroup) search.set('age_group', nextEventAgeGroup);
        if (nextEventAdjType === 'B' || nextEventAdjType === 'E' || nextEventAdjType === 'AE' || nextEventAdjType === 'ES' || nextEventAdjType === 'AES') search.set('adj_type', nextEventAdjType);
    }

    if (tile.route === '/lists') {
        const listKey = String(params.list ?? params.list_key ?? params.listKey ?? '').trim();
        const courseAdj = String(params.courseAdj ?? params.course_adj ?? '').trim();
        const otherAdj = String(params.otherAdj ?? params.other_adj ?? '').trim();
        const participantFilter = String(params.participantFilter ?? params.participant_filter ?? '').trim();
        const filteredByAdjustments = String(params.filteredByAdjustments ?? params.filtered_by_adjustments ?? '').trim().toLowerCase();
        const sortKey = String(params.sortKey ?? params.sort_key ?? '').trim();
        const sortDir = String(params.sortDir ?? params.sort_dir ?? '').trim().toLowerCase();
        if (listKey) search.set('list', listKey);
        if (courseAdj === '1' || courseAdj === '2' || courseAdj === '3') search.set('courseAdj', courseAdj);
        if (otherAdj === '1' || otherAdj === '2' || otherAdj === '3' || otherAdj === '4') search.set('otherAdj', otherAdj);
        if (participantFilter === 'all_participants' || participantFilter === 'gt_50_total_runs' || participantFilter === 'gt_50_local_runs' || participantFilter === 'gt_10_local_runs_1y') search.set('participantFilter', participantFilter);
        if (filteredByAdjustments === '1' || filteredByAdjustments === '0' || filteredByAdjustments === 'true' || filteredByAdjustments === 'false') search.set('filteredByAdjustments', filteredByAdjustments === '1' || filteredByAdjustments === 'true' ? '1' : '0');
        if (sortKey) search.set('sortKey', sortKey);
        if (sortDir === 'asc' || sortDir === 'desc') search.set('sortDir', sortDir);
    }

    const searchText = search.toString();
    return {
        pathname: tile.route,
        search: searchText ? `?${searchText}` : ''
    };
};

const getTileDestinationLabel = (tile: QuickTile): string => {
    return PAGE_LABEL_BY_ROUTE[tile.route] || tile.route.replace('/', '').replace(/-/g, ' ') || 'Open page';
};

const typedTiles = quickStartTiles as QuickTile[];

const QuickStart: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [query, setQuery] = useState('');
    const [guidanceEnabled, setGuidanceEnabled] = useState<boolean>(() => {
        if (typeof window === 'undefined') {
            return true;
        }
        const storedValue = window.localStorage.getItem(QUICK_START_GUIDANCE_ENABLED_KEY);
        if (storedValue == null) {
            return true;
        }
        return storedValue !== 'false';
    });
    const [isMobile, setIsMobile] = useState<boolean>(() => window.innerWidth <= 1024);
    const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>(() => {
        const firstCategory = CATEGORY_ORDER[0];
        return CATEGORY_ORDER.reduce<Record<string, boolean>>((acc, category) => {
            acc[category] = category === firstCategory;
            return acc;
        }, {});
    });

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth <= 1024);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        window.localStorage.setItem(
            QUICK_START_GUIDANCE_ENABLED_KEY,
            guidanceEnabled ? 'true' : 'false'
        );
    }, [guidanceEnabled]);

    useEffect(() => {
        if (!isMobile) {
            setExpandedCategories(
                CATEGORY_ORDER.reduce<Record<string, boolean>>((acc, category) => {
                    acc[category] = true;
                    return acc;
                }, {})
            );
            return;
        }

        const firstCategory = CATEGORY_ORDER[0];
        setExpandedCategories((prev) => {
            const next: Record<string, boolean> = {};
            CATEGORY_ORDER.forEach((category) => {
                next[category] = prev[category] ?? category === firstCategory;
            });
            return next;
        });
    }, [isMobile]);

    const filteredTiles = useMemo(() => {
        const normalizedQuery = query.trim().toLowerCase();
        if (!normalizedQuery) {
            return typedTiles;
        }

        return typedTiles.filter((tile) => {
            const haystack = [tile.label, tile.category, ...(tile.keywords || [])]
                .join(' ')
                .toLowerCase();
            return haystack.includes(normalizedQuery);
        });
    }, [query]);

    const groupedTiles = useMemo(() => {
        return CATEGORY_ORDER.map((category) => ({
            category,
            tiles: filteredTiles.filter((tile) => tile.category === category)
        })).filter((section) => section.tiles.length > 0 || !query.trim());
    }, [filteredTiles, query]);

    const handleTileActivate = (tile: QuickTile) => {
        const target = buildTileTarget(tile);
        const navigationState: Record<string, unknown> = {
            ...tile.params
        };

        if (guidanceEnabled) {
            navigationState[QUICK_START_HELP_STATE_KEY] = {
                markerId: buildQuickStartHelpMarkerId(tile.id),
                query: tile.label
            };
            navigationState[QUICK_START_TOUR_STATE_KEY] = {
                tileId: tile.id
            };
        }

        const targetUrl = `${target.pathname}${target.search || ''}`;
        navigateWithNavStack(navigate, location, targetUrl, {
            state: navigationState
        });
    };

    const toggleCategory = (category: string) => {
        if (!isMobile) return;
        setExpandedCategories((prev) => ({
            ...prev,
            [category]: !prev[category]
        }));
    };

    return (
        <div className="quick-start-page">
            <section className="quick-start-hero">
                <div className="quick-start-hero-copy">
                    <div className="quick-start-hero-top">
                        <div className="quick-start-hero-heading">
                            <p className="quick-start-kicker">Fast Launch</p>
                            <h2>Quick Start</h2>
                        </div>
                        <label className="quick-start-guidance-toggle" htmlFor="quick-start-guidance-toggle">
                            <span className="quick-start-guidance-copy">
                                <span className="quick-start-guidance-title">Help tour</span>
                            </span>
                            <span className={`quick-start-guidance-switch ${guidanceEnabled ? 'is-on' : 'is-off'}`} aria-hidden="true">
                                <span className="quick-start-guidance-switch-track">
                                    <span className="quick-start-guidance-switch-knob" />
                                </span>
                                <span className="quick-start-guidance-switch-label">
                                    {guidanceEnabled ? 'On' : 'Off'}
                                </span>
                            </span>
                            <input
                                id="quick-start-guidance-toggle"
                                className="quick-start-guidance-input"
                                type="checkbox"
                                checked={guidanceEnabled}
                                onChange={(event) => setGuidanceEnabled(event.target.checked)}
                            />
                        </label>
                    </div>
                    <p>
                        Jump straight into the most useful views without rebuilding filters each time.
                        Search by analysis idea, then open the preset you want.
                    </p>
                </div>
                <div className="quick-start-search-shell">
                    <label className="quick-start-search-label" htmlFor="quick-start-search">Search tiles</label>
                    <input
                        id="quick-start-search"
                        className="quick-start-search"
                        type="search"
                        value={query}
                        placeholder="Try hardness, club, PB, next event..."
                        onChange={(event) => setQuery(event.target.value)}
                    />
                    <p className="quick-start-search-hint">Matches tile label, category and common keywords.</p>
                </div>
            </section>

            {groupedTiles.length === 0 ? (
                <section className="quick-start-empty-state">
                    <h3>No Quick Start tile found</h3>
                    <p>Want this added as a saved launcher?</p>
                    <Link className="quick-start-suggestion-link" to="/feedback">Request it on the Suggestions page</Link>
                </section>
            ) : (
                groupedTiles.map(({ category, tiles }) => {
                    const isOpen = !isMobile || query.trim().length > 0 || Boolean(expandedCategories[category]);
                    const accentClassName = CATEGORY_ACCENTS[category] || 'quick-start-accent-fire';

                    return (
                        <section key={category} className={`quick-start-section ${accentClassName}`}>
                            <button
                                type="button"
                                className="quick-start-section-header"
                                onClick={() => toggleCategory(category)}
                                aria-expanded={isOpen}
                            >
                                <span className="quick-start-section-title">{category}</span>
                                <span className="quick-start-section-meta">{tiles.length} tile{tiles.length === 1 ? '' : 's'}</span>
                                {isMobile ? (
                                    <span className="quick-start-section-toggle" aria-hidden="true">{isOpen ? '−' : '+'}</span>
                                ) : null}
                            </button>
                            {isOpen ? (
                                <div className="quick-start-grid">
                                    {tiles.map((tile) => (
                                        <button
                                            key={tile.id}
                                            type="button"
                                            className="quick-start-tile"
                                            onClick={() => handleTileActivate(tile)}
                                            title={tile.label}
                                        >
                                            <span className="quick-start-tile-topline">
                                                <span className="quick-start-tile-icon" aria-hidden="true">{tile.icon || '↗'}</span>
                                                <span className="quick-start-tile-category">{getTileDestinationLabel(tile)}</span>
                                            </span>
                                            <span className="quick-start-tile-label">{tile.label}</span>
                                        </button>
                                    ))}
                                </div>
                            ) : null}
                        </section>
                    );
                })
            )}
        </div>
    );
};

export default QuickStart;
