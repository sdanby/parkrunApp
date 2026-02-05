import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { fetchAthleteRuns } from '../api/backendAPI';

type AthleteRecord = { [key: string]: any };

type AthletesLocationState = {
    athleteCode?: string;
    from?: string;
    returnTo?: { pathname: string; search?: string };
};

const toAthletesLocationState = (value: unknown): AthletesLocationState => {
    if (!value || typeof value !== 'object') {
        return {};
    }
    const possible: any = value;
    const next: AthletesLocationState = {};
    if (typeof possible.athleteCode === 'string') {
        next.athleteCode = possible.athleteCode;
    }
    if (typeof possible.from === 'string') {
        next.from = possible.from;
    }
    if (possible.returnTo && typeof possible.returnTo === 'object') {
        const rt: any = possible.returnTo;
        if (typeof rt.pathname === 'string') {
            next.returnTo = {
                pathname: rt.pathname,
                search: typeof rt.search === 'string' ? rt.search : undefined
            };
        }
    }
    return next;
};

const pickField = (athlete: AthleteRecord | null | undefined, keys: string[]): any => {
    if (!athlete) return undefined;
    for (const key of keys) {
        if (Object.prototype.hasOwnProperty.call(athlete, key)) {
            const value = athlete[key];
            if (value !== undefined && value !== null && value !== '') {
                return value;
            }
        }
    }
    return undefined;
};

type AthleteSummary = {
    athlete_code?: string;
    athlete_name?: string;
    club?: string;
    current_age_estimate?: number | string;
    sex?: string;
    total_runs?: number;
};

type SummaryField = 'athlete_code' | 'athlete_name' | 'club' | 'current_age_estimate' | 'sex' | 'total_runs';

type AthleteRunsNormalized = {
    runs: AthleteRecord[];
    summary: AthleteSummary | null;
};

const nestedArrayKeys = ['runs', 'results', 'records', 'rows', 'items', 'data', 'events'];

const extractRunsArray = (payload: any): AthleteRecord[] => {
    if (Array.isArray(payload)) {
        return payload;
    }
    if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
        const obj: AthleteRecord = payload;
        for (const key of nestedArrayKeys) {
            const candidate = obj[key];
            if (Array.isArray(candidate)) {
                return candidate;
            }
        }
        for (const key of nestedArrayKeys) {
            const candidate = obj[key];
            if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) {
                const nested = extractRunsArray(candidate);
                if (nested.length > 0) {
                    return nested;
                }
            }
        }
    }
    return [];
};

const normalizeAthleteResponse = (payload: any, fallbackCode?: string): AthleteRunsNormalized => {
    const runs = extractRunsArray(payload);
    const summarySources: AthleteRecord[] = [];
    if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
        const obj: AthleteRecord = payload;
        summarySources.push(obj);
        ['summary', 'athlete', 'profile', 'details', 'meta'].forEach((key) => {
            const candidate = obj[key];
            if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) {
                const source: AthleteRecord = candidate;
                summarySources.push(source);
            }
        });
    }
    if (runs.length > 0) {
        summarySources.push(runs[0]);
    }

    const summary: AthleteSummary = {};
    const fill = (field: SummaryField, keys: string[], fallback?: any) => {
        if (summary[field] !== undefined && summary[field] !== null && summary[field] !== '') {
            return;
        }
        for (const source of summarySources) {
            if (!source) continue;
            const value = pickField(source, keys);
            if (value !== undefined && value !== null && value !== '') {
                summary[field] = value;
                return;
            }
        }
        if (fallback !== undefined) {
            summary[field] = fallback;
        }
    };

    fill('athlete_code', ['athlete_code', 'athleteCode', 'runner_code', 'code', 'id'], fallbackCode);
    fill('athlete_name', ['athlete_name', 'name', 'display_name']);
    fill('club', ['club', 'athlete_club']);
    fill('sex', ['sex', 'gender']);
    fill('current_age_estimate', ['current_age_estimate', 'age_estimate', 'age']);
    fill('total_runs', ['total_runs', 'totalRuns', 'run_count', 'runs']);

    if (summary.total_runs === undefined && runs.length > 0) {
        summary.total_runs = runs.length;
    }

    const hasValue = Object.values(summary).some((value) => value !== undefined && value !== null && value !== '');
    return {
        runs,
        summary: hasValue ? summary : (fallbackCode ? { athlete_code: fallbackCode } : null)
    };
};

const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const formatDateValue = (value: unknown): string => {
    if (value === undefined || value === null) return '';
    const raw = String(value).trim();
    const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (iso) {
        const year = iso[1];
        const month = monthNames[Number(iso[2]) - 1] || iso[2];
        const day = iso[3];
        return `${day} ${month} ${year}`;
    }
    const slash = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (slash) {
        const day = slash[1];
        const month = monthNames[Number(slash[2]) - 1] || slash[2];
        const year = slash[3];
        return `${day} ${month} ${year}`;
    }
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) {
        return parsed.toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        });
    }
    return raw;
};

const formatAgeGradeValue = (value: unknown): string => {
    if (value === undefined || value === null || value === '') return '';
    if (typeof value === 'number' && Number.isFinite(value)) {
        return `${value.toFixed(1)}%`;
    }
    const raw = String(value).trim();
    if (raw.endsWith('%')) {
        return raw;
    }
    const numeric = Number(raw);
    if (!Number.isNaN(numeric)) {
        return `${numeric.toFixed(1)}%`;
    }
    return raw;
};

const secondsToTime = (seconds: number): string => {
    if (!Number.isFinite(seconds)) return '';
    const totalSeconds = Math.max(0, Math.round(seconds));
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    const pad = (num: number) => String(num).padStart(2, '0');
    if (hrs > 0) {
        return `${hrs}:${pad(mins)}:${pad(secs)}`;
    }
    return `${mins}:${pad(secs)}`;
};

const formatTimeValue = (value: unknown): string => {
    if (value === undefined || value === null || value === '') return '';
    if (typeof value === 'number') {
        return secondsToTime(value);
    }
    const trimmed = String(value).trim();
    if (trimmed === '') return '';
    if (/^\d+(?:\.\d+)?$/.test(trimmed)) {
        return secondsToTime(Number(trimmed));
    }
    return trimmed;
};

const formatAgeEstimate = (value: unknown): string | undefined => {
    if (value === undefined || value === null || value === '') return undefined;
    const numeric = Number(value);
    if (!Number.isNaN(numeric)) {
        return Number.isInteger(numeric) ? `${numeric}` : numeric.toFixed(1);
    }
    return String(value);
};

const Athletes: React.FC = () => {
    const [runs, setRuns] = useState<AthleteRecord[]>([]);
    const [summary, setSummary] = useState<AthleteSummary | null>(null);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const location = useLocation();
    const navigate = useNavigate();
    const locationState = toAthletesLocationState(location.state ?? {});
    const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
    const selectedCode = locationState.athleteCode || searchParams.get('athlete_code') || undefined;
    const fromRaces = locationState.from === 'races';
    const returnTarget = locationState.returnTo;

    useEffect(() => {
        let cancelled = false;
        if (!selectedCode) {
            setRuns([]);
            setSummary(null);
            setError(null);
            setLoading(false);
            return () => {
                cancelled = true;
            };
        }

        const loadAthlete = async () => {
            try {
                setLoading(true);
                setError(null);
                const payload = await fetchAthleteRuns(selectedCode);
                if (!cancelled) {
                    const normalized = normalizeAthleteResponse(payload, selectedCode);
                    setRuns(normalized.runs);
                    setSummary(normalized.summary);
                }
            } catch (err) {
                if (!cancelled) {
                    console.error('Error fetching athlete runs:', err);
                    setError('Unable to load athlete runs right now.');
                    setRuns([]);
                    setSummary(selectedCode ? { athlete_code: selectedCode } : null);
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };

        loadAthlete();
        return () => {
            cancelled = true;
        };
    }, [selectedCode]);

    const handleBackToRaces = () => {
        if (returnTarget?.pathname) {
            navigate(`${returnTarget.pathname}${returnTarget.search || ''}`);
        } else {
            navigate('/races');
        }
    };

    const latestRun = useMemo(() => (runs.length > 0 ? runs[runs.length - 1] : null), [runs]);
    const rawLatestAge = pickField(latestRun, ['current_age_estimate', 'currentAgeEstimate', 'age_estimate', 'age']) ??
        summary?.current_age_estimate;
    const formattedLatestAge = formatAgeEstimate(rawLatestAge);

    const headerSex = pickField(latestRun, ['sex']) || summary?.sex;
    const sexSymbol = (() => {
        if (!headerSex) return '';
        const normalized = String(headerSex).trim().toUpperCase();
        if (normalized === 'F' || normalized === 'FEMALE' || normalized === 'W') return '♀';
        if (normalized === 'M' || normalized === 'MALE') return '♂';
        return '';
    })();

    const totalRunsCount = summary?.total_runs ?? (runs.length > 0 ? runs.length : undefined);

    const headerName = pickField(latestRun, ['athlete_name', 'name']) || summary?.athlete_name;
    const fallbackName = summary?.athlete_code ? `Athlete ${summary.athlete_code}` : selectedCode ? `Athlete ${selectedCode}` : 'Athlete';
    const detailTitle = headerName || fallbackName;

    const showHeader = Boolean(selectedCode);
    const headerCode = pickField(latestRun, ['athlete_code', 'athleteCode', 'runner_code', 'code']) || summary?.athlete_code || selectedCode || '';
    const headerClubRaw = pickField(latestRun, ['club']) || summary?.club;
    const headerClub = headerClubRaw ? String(headerClubRaw) : '<no club>';

    const renderCell = (value: unknown): string => {
        if (value === undefined || value === null) return '--';
        const str = String(value);
        return str.trim() === '' ? '--' : str;
    };

    return (
        <div className="page-content athletes-page">
            {showHeader && (
                <div className="athlete-header">
                    {fromRaces && (
                        <button
                            type="button"
                            className="athletes-back-button"
                            aria-label="Back to race"
                            title="Back to race"
                            onClick={handleBackToRaces}
                        >
                            ←
                        </button>
                    )}
                    <div className="athlete-header-text">
                        <div className="athlete-header-title" title="Athlete Name">
                            {detailTitle}
                            {sexSymbol && <span className="athlete-header-sex" aria-label="Athlete sex"> {sexSymbol}</span>}
                        </div>
                        {headerCode && (
                            <div className="athlete-header-code" title="Athlete Code">
                                {headerCode}
                            </div>
                        )}
                        <div className="athlete-header-club" title="Athlete's Club">
                            {headerClub}
                        </div>
                        {formattedLatestAge && (
                            <div className="athlete-header-age" title="Estimated Age">
                                Estm.Age: {formattedLatestAge}
                            </div>
                        )}
                        {totalRunsCount !== undefined && (
                            <div className="athlete-header-total-runs" title="Total runs recorded">
                                Total runs: {totalRunsCount}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {selectedCode && loading && <p>Loading athlete data…</p>}
            {error && <p className="athlete-error">{error}</p>}

            {!selectedCode && !loading && !error && (
                <div className="athlete-empty-state">
                    <h2>Find an athlete</h2>
                    <p>Select a runner from the Races page to view their profile and run history here.</p>
                </div>
            )}

            {!loading && !error && selectedCode && (
                <>
                    <section className="athlete-runs-section">
                        <div className="athlete-runs-header">
                            <h3>Run history</h3>
                        </div>
                        <div className="athlete-runs-table-wrapper">
                            {runs.length > 0 ? (
                                <table className="athlete-runs-table">
                                    <thead>
                                        <tr>
                                            <th>Date</th>
                                            <th>Event code</th>
                                            <th>Position</th>
                                            <th>Age group</th>
                                            <th>Age grade</th>
                                            <th>Time</th>
                                            <th>Comment</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {runs.map((row, index) => {
                                            const date = formatDateValue(pickField(row, ['formatted_date', 'event_date', 'date']));
                                            const eventCode = pickField(row, ['event_code', 'eventCode', 'course_code', 'event']);
                                            const position = pickField(row, ['position', 'overall_position']);
                                            const ageGroup = pickField(row, ['age_group', 'ageGroup']);
                                            const ageGrade = formatAgeGradeValue(pickField(row, ['age_grade', 'ageGrade']));
                                            const timeValue = formatTimeValue(
                                                pickField(row, ['time', 'time_display', 'finish_time', 'gun_time']) ??
                                                    pickField(row, ['time_seconds', 'adj_time_seconds'])
                                            );
                                            const comment = pickField(row, ['comment', 'notes', 'note', 'remark']);

                                            const keyParts = [
                                                pickField(row, ['event_code', 'eventCode']),
                                                pickField(row, ['formatted_date', 'event_date']),
                                                index
                                            ];

                                            return (
                                                <tr key={keyParts.filter(Boolean).join('-') || index}>
                                                    <td>{renderCell(date)}</td>
                                                    <td>{renderCell(eventCode)}</td>
                                                    <td>{renderCell(position)}</td>
                                                    <td>{renderCell(ageGroup)}</td>
                                                    <td>{renderCell(ageGrade)}</td>
                                                    <td>{renderCell(timeValue)}</td>
                                                    <td className="comment-cell">{renderCell(comment)}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            ) : (
                                <p className="athlete-runs-empty">No run data returned for this athlete.</p>
                            )}
                        </div>
                    </section>
                </>
            )}
        </div>
    );
};

export default Athletes;