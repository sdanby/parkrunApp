import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import AthleteSearch from '../components/AthleteSearch';
import NextEventProjectionTable, { type NextEventProjectionColumn, type NextEventProjectionRow } from '../components/NextEventProjectionTable';
import {
    fetchAthleteBestSummary,
    fetchAthleteRuns,
    fetchCurveRankReference,
    fetchEventOptions,
    fetchParkrunEvents,
    type CurveRankReferenceRow,
    type EventOption,
    type ParkrunEventRow
} from '../api/backendAPI';
import {
    getNextEventLayoutConfig,
    getNextEventElementById,
    getNextEventTableColumnByKey
} from '../config/layout/nextEventLayoutHelper';
import { requestUnifiedHelp } from './UnifiedHelp';
import { navigateBackWithNavStack } from '../utils/navigationStack';
import { useColumnHeaderMode } from '../utils/useColumnHeaderMode';
import { useGlobalWaitCursor } from '../utils/useGlobalWaitCursor';

type GenericRecord = Record<string, any>;
type AthleteRecord = GenericRecord;
type ModeKey = 'next_pr' | 'next_ext';
type SortDir = 'asc' | 'desc';
type RankMetricKey = 'B' | 'E' | 'AE' | 'ES' | 'AES';

type BestRankMetric = {
    metric: RankMetricKey;
    label: string;
    rank: number;
    order: number;
};

type NextEventSummarySource = {
    index: number;
    key: string;
    label: string;
    row: GenericRecord | null;
    fallbackTimeText?: string;
};

const formatDisplayedRank = (value: unknown): string => {
    const numeric = value === undefined || value === null || value === '' ? NaN : Number(value);
    return Number.isFinite(numeric) ? String(Math.round(numeric)) : '--';
};

const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const formatDateValue = (value: unknown): string => {
    if (value === undefined || value === null || value === '') return '';
    const raw = String(value).trim();
    const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (iso) {
        return `${iso[3]}${monthNames[Number(iso[2]) - 1] || iso[2]}${iso[1].slice(-2)}`;
    }
    const slash = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (slash) {
        return `${slash[1]}${monthNames[Number(slash[2]) - 1] || slash[2]}${slash[3].slice(-2)}`;
    }
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) {
        return `${String(parsed.getUTCDate()).padStart(2, '0')}${monthNames[parsed.getUTCMonth()] || ''}${String(parsed.getUTCFullYear()).slice(-2)}`;
    }
    return raw;
};

const secondsToTime = (seconds: number): string => {
    if (!Number.isFinite(seconds)) return '';
    const totalSeconds = Math.max(0, Math.round(seconds));
    const hours = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    const pad = (value: number) => String(value).padStart(2, '0');
    return hours > 0 ? `${hours}:${pad(mins)}:${pad(secs)}` : `${mins}:${pad(secs)}`;
};

const formatTimeValue = (value: unknown): string => {
    if (value === undefined || value === null || value === '') return '';
    if (typeof value === 'number') return secondsToTime(value);
    const raw = String(value).trim();
    if (!raw) return '';
    if (/^\d+(?:\.\d+)?$/.test(raw)) {
        return secondsToTime(Number(raw));
    }
    return raw;
};

const formatHardnessPercentValue = (value: number | null): string => {
    if (value === null || !Number.isFinite(value)) return '--';
    const percentValue = Math.abs(value) < 0.5 ? value * 100 : (value - 1) * 100;
    return `${percentValue.toFixed(1)}%`;
};

const parseDateMs = (value: unknown): number => {
    if (value === undefined || value === null || value === '') return 0;
    const raw = String(value).trim();
    if (!raw) return 0;

    const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (iso) {
        return Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    }

    const slash = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (slash) {
        return Date.UTC(Number(slash[3]), Number(slash[2]) - 1, Number(slash[1]));
    }

    const parsed = Date.parse(raw);
    return Number.isNaN(parsed) ? 0 : parsed;
};

const parseTimeSortValue = (value: unknown): number | null => {
    if (value === undefined || value === null || value === '') return null;
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    const raw = String(value).trim();
    if (!raw) return null;
    if (/^\d+(?:\.\d+)?$/.test(raw)) return Number(raw);
    const timeParts = raw.split(':').map((part) => Number(part));
    if (timeParts.length === 0 || timeParts.some((part) => Number.isNaN(part))) return null;
    return timeParts.reduce((total, part) => (total * 60) + part, 0);
};

const coerceNumber = (value: unknown): number | null => {
    if (value === undefined || value === null || value === '') return null;
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    const cleaned = String(value).replace(/[^0-9.-]/g, '').trim();
    if (!cleaned) return null;
    const parsed = Number(cleaned);
    return Number.isNaN(parsed) ? null : parsed;
};

const pickField = (row: GenericRecord | null | undefined, keys: string[]): any => {
    if (!row) return undefined;
    for (const key of keys) {
        if (Object.prototype.hasOwnProperty.call(row, key)) {
            const value = row[key];
            if (value !== undefined && value !== null && value !== '') {
                return value;
            }
        }
    }
    return undefined;
};

const getLoggedInUser = () => {
    try {
        const raw = localStorage.getItem('auth_user_v1');
        if (!raw) return {} as Record<string, any>;
        return JSON.parse(raw) || {};
    } catch (_err) {
        return {} as Record<string, any>;
    }
};

const useMediaQuery = (query: string): boolean => {
    const [matches, setMatches] = useState<boolean>(() => {
        if (typeof window === 'undefined') return false;
        return window.matchMedia(query).matches;
    });

    useEffect(() => {
        if (typeof window === 'undefined') return undefined;
        const mediaQuery = window.matchMedia(query);
        const listener = (event: MediaQueryListEvent) => setMatches(event.matches);
        setMatches(mediaQuery.matches);
        mediaQuery.addEventListener('change', listener);
        return () => mediaQuery.removeEventListener('change', listener);
    }, [query]);

    return matches;
};

const getRowTimeSeconds = (row: GenericRecord): number | null => {
    return parseTimeSortValue(pickField(row, ['time_seconds', 'timeSeconds', 'time', 'time_display', 'finish_time', 'gun_time']));
};

const getEventAdjustedSeconds = (row: GenericRecord): number | null => {
    const direct = parseTimeSortValue(pickField(row, ['event_adj_time_seconds', 'adj_time_seconds', 'event_adj_time', 'adj_time']));
    if (direct !== null) {
        return direct;
    }
    const rawSeconds = getRowTimeSeconds(row);
    const coeff = coerceNumber(pickField(row, ['coeff']));
    const coeffEvent = coerceNumber(pickField(row, ['coeff_event', 'coeffEvent']));
    const coeffProduct = coeff && coeffEvent ? coeff + coeffEvent - 1 : null;
    if (rawSeconds === null || !coeffProduct) {
        return rawSeconds;
    }
    return rawSeconds / coeffProduct;
};

const getHardnessValue = (row: GenericRecord): number | null => {
    const combined = coerceNumber(pickField(row, ['coeff_combined', 'coeffCombined']));
    if (combined) {
        return combined;
    }
    const coeff = coerceNumber(pickField(row, ['coeff']));
    const coeffEvent = coerceNumber(pickField(row, ['coeff_event', 'coeffEvent']));
    if (coeff && coeffEvent) {
        return coeff + coeffEvent - 1;
    }
    if (!coeffEvent) {
        return null;
    }
    return coeffEvent;
};

const getRankValue = (row: GenericRecord, mode: ModeKey): number | null => {
    if (mode === 'next_ext') {
        return coerceNumber(pickField(row, ['event_rank_ae', 'current_best_rank_ae']));
    }
    return coerceNumber(pickField(row, ['event_rank_b', 'current_best_rank_b']));
};

const getCurrentBestRankValue = (row: GenericRecord, mode: ModeKey): number | null => {
    if (mode === 'next_ext') {
        return coerceNumber(pickField(row, ['current_best_rank_ae', 'event_rank_ae']));
    }
    return coerceNumber(pickField(row, ['current_best_rank_b', 'event_rank_b']));
};

const getModeTimeSeconds = (row: GenericRecord, mode: ModeKey): number | null => {
    return mode === 'next_ext' ? getEventAdjustedSeconds(row) : getRowTimeSeconds(row);
};

const rankMetricDefinitions: Array<{ metric: RankMetricKey; label: string; order: number; keys: string[] }> = [
    { metric: 'B', label: '*', order: 1, keys: ['event_rank_b', 'current_best_rank_b'] },
    { metric: 'E', label: 'E', order: 2, keys: ['event_rank_e', 'current_best_rank_e'] },
    { metric: 'AE', label: 'AE', order: 3, keys: ['event_rank_ae', 'current_best_rank_ae'] },
    { metric: 'ES', label: 'ES', order: 4, keys: ['event_rank_es', 'current_best_rank_es'] },
    { metric: 'AES', label: 'AES', order: 5, keys: ['event_rank_aes', 'current_best_rank_aes'] }
];

const getBestRankMetric = (row: GenericRecord | null | undefined): BestRankMetric | null => {
    if (!row) return null;
    const candidates = rankMetricDefinitions
        .map((definition) => {
            const rank = coerceNumber(pickField(row, definition.keys));
            if (rank === null) return null;
            return {
                metric: definition.metric,
                label: definition.label,
                rank,
                order: definition.order
            } satisfies BestRankMetric;
        })
        .filter((item): item is BestRankMetric => Boolean(item));

    if (candidates.length === 0) return null;

    candidates.sort((left, right) => {
        if (right.rank !== left.rank) return right.rank - left.rank;
        return left.order - right.order;
    });

    return candidates[0] ?? null;
};

const getEventAdjustedMetric = (row: GenericRecord | null | undefined): BestRankMetric | null => {
    if (!row) return null;
    const rank = coerceNumber(pickField(row, ['event_rank_e', 'current_best_rank_e']));
    if (rank === null) return null;
    return {
        metric: 'E',
        label: 'E',
        rank,
        order: 2
    };
};

const findRunBySummaryDate = (summaryRow: GenericRecord | null | undefined, runRows: AthleteRecord[]): AthleteRecord | null => {
    if (!summaryRow || runRows.length === 0) return null;
    const targetDateMs = getRowDateMs(summaryRow);
    if (!targetDateMs) return null;
    return runRows.find((row) => getRowDateMs(row) === targetDateMs) ?? null;
};

const getNextEventResolvedMetric = (
    row: GenericRecord | null | undefined,
    matchedRun?: GenericRecord | null,
): BestRankMetric | null => {
    const bestMetric = getBestRankMetric(row);
    if (!bestMetric) return null;
    if (bestMetric.metric !== 'B') {
        return bestMetric;
    }
    return getEventAdjustedMetric(matchedRun ?? row) ?? bestMetric;
};

const getMetricAdjustedSeconds = (row: GenericRecord, metric: RankMetricKey): number | null => {
    const rawSeconds = getRowTimeSeconds(row);
    const hardness = getHardnessValue(row);
    if (rawSeconds === null) return null;
    if (metric === 'B') return rawSeconds;
    if (metric === 'E') {
        return hardness ? rawSeconds / hardness : null;
    }
    if (metric === 'AE') {
        return getEventAdjustedSeconds(row);
    }
    if (metric === 'ES' || metric === 'AES') {
        const ageRatioSex = coerceNumber(pickField(row, ['age_ratio_sex', 'ageRatioSex']));
        return hardness && ageRatioSex ? rawSeconds / (hardness * ageRatioSex) : null;
    }
    return null;
};

const roundUpHalf = (value: number): number => Math.ceil(value * 2) / 2;
const roundDownHalf = (value: number): number => Math.floor(value * 2) / 2;

const scoreOffsets = [1, 0, -1, -2, -3, -4, -5];
const columnKeys = ['rank_plus_1', 'rank_current', 'rank_minus_1', 'rank_minus_2', 'rank_minus_3', 'rank_minus_4', 'rank_minus_5'] as const;

const getCurveSecondsForScore = (rows: CurveRankReferenceRow[], score: number): number | null => {
    if (!Number.isFinite(score) || rows.length === 0) return null;
    const sorted = [...rows].sort((a, b) => (a.score_lower ?? 0) - (b.score_lower ?? 0));
    for (const row of sorted) {
        const lower = Number(row.score_lower ?? row.curved_rank_group ?? 0);
        const upper = Number(row.score_upper ?? row.curved_rank_group ?? lower);
        const maxSeconds = Number(row.max_seconds ?? row.min_seconds ?? NaN);
        const minSeconds = Number(row.min_seconds ?? row.max_seconds ?? NaN);
        if (!Number.isFinite(maxSeconds) || !Number.isFinite(minSeconds)) {
            continue;
        }
        if (score >= lower && score <= upper) {
            if (upper === lower) {
                return (minSeconds + maxSeconds) / 2;
            }
            const fraction = (score - lower) / (upper - lower);
            return maxSeconds + (fraction * (minSeconds - maxSeconds));
        }
    }

    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    if (score < Number(first?.score_lower ?? 0)) {
        return Number(first?.max_seconds ?? first?.min_seconds ?? NaN);
    }
    return Number(last?.min_seconds ?? last?.max_seconds ?? NaN);
};

const getRowDateMs = (row: GenericRecord): number => {
    const raw = pickField(row, ['formatted_date', 'event_date', 'date']);
    return parseDateMs(raw);
};

const getCourseCode = (row: GenericRecord): string => {
    return String(pickField(row, ['event_code', 'eventCode']) ?? '').trim();
};

const subtractMonthsUtc = (timeMs: number, months: number): number => {
    if (!Number.isFinite(timeMs) || timeMs <= 0) return 0;
    const date = new Date(timeMs);
    return Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - months, date.getUTCDate());
};

const pickBestRun = (runsToRank: AthleteRecord[], mode: ModeKey): AthleteRecord | null => {
    if (runsToRank.length === 0) return null;
    const ranked = [...runsToRank].sort((left, right) => {
        const leftRank = getRankValue(left, mode);
        const rightRank = getRankValue(right, mode);
        if (leftRank !== null && rightRank !== null && leftRank !== rightRank) {
            return rightRank - leftRank;
        }
        if (leftRank !== null && rightRank === null) return -1;
        if (leftRank === null && rightRank !== null) return 1;

        const leftTime = getModeTimeSeconds(left, mode) ?? Number.POSITIVE_INFINITY;
        const rightTime = getModeTimeSeconds(right, mode) ?? Number.POSITIVE_INFINITY;
        if (leftTime !== rightTime) {
            return leftTime - rightTime;
        }
        return getRowDateMs(right) - getRowDateMs(left);
    });
    return ranked[0] ?? null;
};

const pickFastestAbsoluteRun = (runsToRank: AthleteRecord[]): AthleteRecord | null => {
    if (runsToRank.length === 0) return null;
    const ranked = [...runsToRank].sort((left, right) => {
        const leftTime = getRowTimeSeconds(left) ?? Number.POSITIVE_INFINITY;
        const rightTime = getRowTimeSeconds(right) ?? Number.POSITIVE_INFINITY;
        if (leftTime !== rightTime) {
            return leftTime - rightTime;
        }
        return getRowDateMs(right) - getRowDateMs(left);
    });
    return ranked[0] ?? null;
};

const pickBestEventRun = (runsToRank: AthleteRecord[]): AthleteRecord | null => {
    if (runsToRank.length === 0) return null;
    const ranked = [...runsToRank].sort((left, right) => {
        const leftBestMetric = getBestRankMetric(left);
        const rightBestMetric = getBestRankMetric(right);
        if (leftBestMetric && rightBestMetric && leftBestMetric.rank !== rightBestMetric.rank) {
            return rightBestMetric.rank - leftBestMetric.rank;
        }
        if (leftBestMetric && !rightBestMetric) return -1;
        if (!leftBestMetric && rightBestMetric) return 1;
        if (leftBestMetric && rightBestMetric && leftBestMetric.order !== rightBestMetric.order) {
            return leftBestMetric.order - rightBestMetric.order;
        }

        const leftAdjusted = leftBestMetric ? (getMetricAdjustedSeconds(left, leftBestMetric.metric) ?? Number.POSITIVE_INFINITY) : Number.POSITIVE_INFINITY;
        const rightAdjusted = rightBestMetric ? (getMetricAdjustedSeconds(right, rightBestMetric.metric) ?? Number.POSITIVE_INFINITY) : Number.POSITIVE_INFINITY;
        if (leftAdjusted !== rightAdjusted) {
            return leftAdjusted - rightAdjusted;
        }

        const leftTime = getRowTimeSeconds(left) ?? Number.POSITIVE_INFINITY;
        const rightTime = getRowTimeSeconds(right) ?? Number.POSITIVE_INFINITY;
        if (leftTime !== rightTime) {
            return leftTime - rightTime;
        }

        return getRowDateMs(right) - getRowDateMs(left);
    });
    return ranked[0] ?? null;
};

const renderConfigControlLabel = (
    element: {
        helpLabel?: boolean;
        helpTarget?: string;
        name?: string;
        style?: {
            fontStyle?: string;
            backgroundColor?: string;
            padding?: string;
            width?: string;
            height?: string;
        };
    } | undefined,
    fallbackName: string,
    fallbackHelpTarget: string,
    textStyle?: React.CSSProperties,
    wrapperStyle?: React.CSSProperties,
    preferHelpLabel: boolean = false
) => {
    const labelText = element?.name || fallbackName;
    const helpTarget = element?.helpTarget || fallbackHelpTarget;
    const helpTitle = `${String(labelText).replace(/:\s*$/, '')} help`;
    const shouldRenderHelpLabel = element?.helpLabel ?? preferHelpLabel;

    if (shouldRenderHelpLabel) {
        const buttonStyle: React.CSSProperties = {
            fontStyle: element?.style?.fontStyle,
            background: element?.style?.backgroundColor,
            padding: element?.style?.padding,
            width: element?.style?.width,
            height: element?.style?.height
        };

        return (
            <span className="help-tooltip" style={wrapperStyle ?? { display: 'inline-flex' }}>
                <button
                    type="button"
                    className="help-trigger help-trigger-label"
                    style={buttonStyle}
                    onClick={(event) => {
                        const rect = (event.currentTarget as HTMLButtonElement).getBoundingClientRect();
                        requestUnifiedHelp(helpTarget, {
                            x: rect.left,
                            y: rect.bottom
                        });
                    }}
                    title={helpTitle}
                    aria-label={helpTitle}
                >
                    <span className="help-trigger-text" style={textStyle}>{labelText}</span>
                </button>
            </span>
        );
    }

    return (
        <span style={wrapperStyle ?? { display: 'inline-flex' }}>
            <span style={textStyle}>{labelText}</span>
        </span>
    );
};

const buildRankHeaderLabel = (score: number, suffix: string): string => `${score}${suffix}`;

const getRoundedBestRank = (row: GenericRecord | null | undefined): number | null => {
    const bestMetric = getBestRankMetric(row);
    return bestMetric ? Math.round(bestMetric.rank) : null;
};

const renderIndexSuffix = (indexes: number[], includeParens: boolean = false): React.ReactNode => {
    const text = indexes.join(',');
    return (
        <sup style={{ fontSize: '0.72em', lineHeight: 1, verticalAlign: 'super' }}>
            {includeParens ? `(${text})` : text}
        </sup>
    );
};

const buildIndexedLabel = (label: string, indexes: number[], includeParens: boolean = false): React.ReactNode => {
    if (indexes.length === 0) return label;
    return (
        <>
            {label}
            {renderIndexSuffix(indexes, includeParens)}
        </>
    );
};

const getCurrentRankSummary = (profileRows: GenericRecord[], runRows: AthleteRecord[], resolveStarMetric: boolean = true): { display: string; metricLabel: string; metric: RankMetricKey | null; anchorRank: number | null; sourceRun: AthleteRecord | null } => {
    const oneYearTypeToMetric: Record<string, { metric: string; order: number }> = {
        best_1y: { metric: 'B', order: 1 },
        event_1y: { metric: 'E', order: 2 },
        age_event_1y: { metric: 'AE', order: 3 },
        sex_event_1y: { metric: 'ES', order: 4 },
        age_sex_event_1y: { metric: 'AES', order: 5 }
    };

    const candidates = profileRows
        .map((row) => {
            const bestType = String(row?.best_type ?? '').trim();
            const mapping = oneYearTypeToMetric[bestType];
            if (!mapping) return null;
            const rankRaw = Number(row?.rank);
            if (!Number.isFinite(rankRaw)) return null;
            return {
                row,
                rank: rankRaw,
                metric: mapping.metric as RankMetricKey,
                order: mapping.order
            };
        })
        .filter((item): item is { row: GenericRecord; rank: number; metric: RankMetricKey; order: number } => Boolean(item));

    if (candidates.length === 0) {
        return {
            display: '--',
            metricLabel: '',
            metric: null,
            anchorRank: null,
            sourceRun: null
        };
    }

    candidates.sort((a, b) => {
        if (b.rank !== a.rank) return b.rank - a.rank;
        return a.order - b.order;
    });

    const best = candidates[0];
    const matchedRun = best.metric === 'B' ? findRunBySummaryDate(best.row, runRows) : null;
    const resolvedBest = resolveStarMetric ? getNextEventResolvedMetric(best.row, matchedRun) : null;
    const displayMetric = resolvedBest ? (resolvedBest.metric === 'B' ? '*' : resolvedBest.metric) : (best.metric === 'B' ? '*' : best.metric);
    const displayRank = resolvedBest?.rank ?? best.rank;
    const displayMetricKey = resolvedBest?.metric ?? best.metric;
    return {
        display: `${formatDisplayedRank(displayRank)} ${displayMetric}`,
        metricLabel: displayMetric,
        metric: displayMetricKey,
        anchorRank: Number.isFinite(displayRank) ? Math.round(displayRank) : null,
        sourceRun: matchedRun
    };
};

const buildRankSummaryFromRun = (run: AthleteRecord | null): { display: string; metricLabel: string; metric: RankMetricKey | null; anchorRank: number | null; sourceRun: AthleteRecord | null } | null => {
    if (!run) return null;
    const resolvedMetric = getNextEventResolvedMetric(run, run);
    if (!resolvedMetric) return null;
    const displayMetric = resolvedMetric.metric === 'B' ? '*' : resolvedMetric.metric;
    return {
        display: `${formatDisplayedRank(resolvedMetric.rank)} ${displayMetric}`,
        metricLabel: displayMetric,
        metric: resolvedMetric.metric,
        anchorRank: Math.round(resolvedMetric.rank),
        sourceRun: run
    };
};

const buildRankSummaryFromRunSet = (runsToRank: AthleteRecord[]): { display: string; metricLabel: string; metric: RankMetricKey | null; anchorRank: number | null; sourceRun: AthleteRecord | null } | null => {
    if (runsToRank.length === 0) return null;
    return buildRankSummaryFromRun(pickBestEventRun(runsToRank));
};

const getCurveThresholdSecondsForScore = (rows: CurveRankReferenceRow[], score: number): number | null => {
    if (!Number.isFinite(score) || rows.length === 0) return null;

    for (const row of rows) {
        const lower = Number(row.score_lower ?? row.curved_rank_group ?? NaN);
        const upper = Number(row.score_upper ?? row.curved_rank_group ?? lower);
        if (!Number.isFinite(lower) || !Number.isFinite(upper)) {
            continue;
        }
        if (score >= lower && score <= upper) {
            const thresholdSeconds = Number(row.max_seconds ?? row.min_seconds ?? NaN);
            if (Number.isFinite(thresholdSeconds)) {
                return thresholdSeconds;
            }
        }
    }

    return getCurveSecondsForScore(rows, score);
};

const getActualSecondsForRankTarget = (
    row: GenericRecord,
    metric: RankMetricKey,
    targetAdjustedSeconds: number,
    targetHardness: number,
): number | null => {
    if (!Number.isFinite(targetAdjustedSeconds) || !Number.isFinite(targetHardness) || targetHardness <= 0) {
        return null;
    }

    if (metric === 'B') return targetAdjustedSeconds;
    if (metric === 'E') return targetAdjustedSeconds * targetHardness;
    if (metric === 'AE') {
        const ageRatioMale = coerceNumber(pickField(row, ['age_ratio_male', 'ageRatioMale']));
        return ageRatioMale ? targetAdjustedSeconds * targetHardness * ageRatioMale : null;
    }
    if (metric === 'ES' || metric === 'AES') {
        const ageRatioSex = coerceNumber(pickField(row, ['age_ratio_sex', 'ageRatioSex']));
        return ageRatioSex ? targetAdjustedSeconds * targetHardness * ageRatioSex : null;
    }
    return null;
};

const NextEvent: React.FC = () => {
    const isMobile = useMediaQuery('(max-width: 640px)');
    const navigate = useNavigate();
    const location = useLocation();
    const locationState = (location.state && typeof location.state === 'object')
        ? location.state as Record<string, unknown>
        : {};
    const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
    const { mode: columnHeaderMode } = useColumnHeaderMode();

    const loggedInUser = getLoggedInUser();
    const loggedInAthleteCode = typeof loggedInUser.athleteCode === 'string' && loggedInUser.athleteCode.trim()
        ? loggedInUser.athleteCode.trim()
        : '';
    const loggedInDefaultCourseCode = typeof loggedInUser.defaultCourseCode === 'string' && loggedInUser.defaultCourseCode.trim()
        ? loggedInUser.defaultCourseCode.trim()
        : '';
    const loggedInDisplayName = typeof loggedInUser.displayName === 'string' && loggedInUser.displayName.trim()
        ? loggedInUser.displayName.trim()
        : '';

    const [selectedAthleteCode, setSelectedAthleteCode] = useState<string>(String(searchParams.get('athlete_code') || locationState.athleteCode || loggedInAthleteCode || ''));
    const [selectedCourseCode, setSelectedCourseCode] = useState<string>(searchParams.get('event_code') || loggedInDefaultCourseCode);
    const [mode, setMode] = useState<ModeKey>((searchParams.get('mode') === 'next_ext' ? 'next_ext' : 'next_pr'));
    const [runs, setRuns] = useState<AthleteRecord[]>([]);
    const [profileRows, setProfileRows] = useState<GenericRecord[]>([]);
    const [eventOptions, setEventOptions] = useState<EventOption[]>([]);
    const [courseEvents, setCourseEvents] = useState<ParkrunEventRow[]>([]);
    const [curveReferenceRows, setCurveReferenceRows] = useState<CurveRankReferenceRow[]>([]);
    const [curveLoading, setCurveLoading] = useState<boolean>(false);
    const [loading, setLoading] = useState<boolean>(false);
    const [sortKey, setSortKey] = useState<string>('hardness_band');
    const [sortDir, setSortDir] = useState<SortDir>('desc');
    const [rankShift, setRankShift] = useState<number>(0);

    const sortedRuns = useMemo(() => {
        return [...runs].sort((a, b) => getRowDateMs(b) - getRowDateMs(a));
    }, [runs]);

    const profileDisplayRankSummary = useMemo(() => getCurrentRankSummary(profileRows, sortedRuns, false), [profileRows, sortedRuns]);
    const profileEffectiveRankSummary = useMemo(() => getCurrentRankSummary(profileRows, sortedRuns, true), [profileRows, sortedRuns]);

    useGlobalWaitCursor(loading || curveLoading);

    const initialSearchQuery = String(searchParams.get('athlete_name') || locationState.athleteName || '').trim() || (selectedAthleteCode === loggedInAthleteCode ? loggedInDisplayName : undefined);
    const shouldSuppressInitialSearch = Boolean((initialSearchQuery && initialSearchQuery.trim()) || selectedAthleteCode);

    useEffect(() => {
        let cancelled = false;
        const loadEventOptions = async () => {
            try {
                const data = await fetchEventOptions();
                if (!cancelled) {
                    setEventOptions(data);
                }
            } catch (_err) {
                if (!cancelled) {
                    setEventOptions([]);
                }
            }
        };
        loadEventOptions();
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        let cancelled = false;
        if (!selectedAthleteCode) {
            setRuns([]);
            setLoading(false);
            return () => {
                cancelled = true;
            };
        }

        const loadRuns = async () => {
            try {
                setLoading(true);
                const payload = await fetchAthleteRuns(selectedAthleteCode);
                const nextRuns = Array.isArray(payload)
                    ? payload
                    : Array.isArray((payload as any)?.runs)
                        ? (payload as any).runs
                        : Array.isArray((payload as any)?.results)
                            ? (payload as any).results
                            : [];
                if (!cancelled) {
                    setRuns(nextRuns);
                }
            } catch (_err) {
                if (!cancelled) {
                    setRuns([]);
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };

        loadRuns();
        return () => {
            cancelled = true;
        };
    }, [selectedAthleteCode]);

    useEffect(() => {
        let cancelled = false;
        if (!selectedAthleteCode) {
            setProfileRows([]);
            return () => {
                cancelled = true;
            };
        }

        const loadProfileRows = async () => {
            try {
                const payload = await fetchAthleteBestSummary(selectedAthleteCode);
                if (!cancelled) {
                    setProfileRows(Array.isArray(payload) ? payload : []);
                }
            } catch (_err) {
                if (!cancelled) {
                    setProfileRows([]);
                }
            }
        };

        loadProfileRows();
        return () => {
            cancelled = true;
        };
    }, [selectedAthleteCode]);

    useEffect(() => {
        setRankShift(0);
    }, [selectedAthleteCode, mode]);

    useEffect(() => {
        let cancelled = false;
        if (!selectedCourseCode) {
            setCourseEvents([]);
            return () => {
                cancelled = true;
            };
        }

        const loadCourseEvents = async () => {
            try {
                const response = await fetchParkrunEvents(selectedCourseCode);
                if (!cancelled) {
                    setCourseEvents(Array.isArray(response) ? response : []);
                }
            } catch (_err) {
                if (!cancelled) {
                    setCourseEvents([]);
                }
            }
        };

        loadCourseEvents();
        return () => {
            cancelled = true;
        };
    }, [selectedCourseCode]);

    const currentAthleteName = useMemo(() => {
        const latestRun = sortedRuns[0] ?? null;
        const runName = latestRun
            ? String(pickField(latestRun, ['athlete_name', 'name', 'display_name']) ?? '').trim()
            : '';
        if (runName) {
            return runName;
        }
        const persistedName = String(searchParams.get('athlete_name') || locationState.athleteName || '').trim();
        if (persistedName) {
            return persistedName;
        }
        if (selectedAthleteCode === loggedInAthleteCode) {
            return loggedInDisplayName;
        }
        return '';
    }, [locationState.athleteName, loggedInAthleteCode, loggedInDisplayName, searchParams, selectedAthleteCode, sortedRuns]);

    useEffect(() => {
        if (selectedCourseCode || sortedRuns.length === 0) {
            return;
        }
        const latestRun = sortedRuns[0];
        const latestCourseCode = getCourseCode(latestRun);
        if (latestCourseCode) {
            setSelectedCourseCode(latestCourseCode);
        }
    }, [selectedCourseCode, sortedRuns]);

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        if (selectedAthleteCode) {
            params.set('athlete_code', selectedAthleteCode);
        } else {
            params.delete('athlete_code');
        }
        if (currentAthleteName) {
            params.set('athlete_name', currentAthleteName);
        } else {
            params.delete('athlete_name');
        }
        if (selectedCourseCode) {
            params.set('event_code', selectedCourseCode);
        } else {
            params.delete('event_code');
        }
        params.set('mode', mode);
        const nextSearch = params.toString();
        const currentSearch = location.search.startsWith('?') ? location.search.slice(1) : location.search;
        const nextState = {
            ...locationState,
            athleteCode: selectedAthleteCode || undefined,
            athleteName: currentAthleteName || undefined
        };
        const stateAthleteCode = String(locationState.athleteCode || '').trim();
        const stateAthleteName = String(locationState.athleteName || '').trim();
        const stateNeedsUpdate = stateAthleteCode !== String(selectedAthleteCode || '') || stateAthleteName !== currentAthleteName;
        if (nextSearch !== currentSearch || stateNeedsUpdate) {
            navigate({ pathname: location.pathname, search: nextSearch ? `?${nextSearch}` : '' }, { replace: true, state: nextState });
        }
    }, [currentAthleteName, location.pathname, location.search, locationState, mode, navigate, selectedAthleteCode, selectedCourseCode]);

    const selectedCourseRuns = useMemo(() => {
        if (!selectedCourseCode) {
            return sortedRuns;
        }
        return sortedRuns.filter((row) => getCourseCode(row) === selectedCourseCode);
    }, [selectedCourseCode, sortedRuns]);

    const bestRun = useMemo(() => {
        const candidates = selectedCourseRuns.length > 0 ? selectedCourseRuns : sortedRuns;
        return pickBestRun(candidates, mode);
    }, [mode, selectedCourseRuns, sortedRuns]);

    const lastRun = useMemo(() => {
        const candidates = selectedCourseRuns.length > 0 ? selectedCourseRuns : sortedRuns;
        return candidates[0] ?? null;
    }, [selectedCourseRuns, sortedRuns]);

    const bestSelectedCourseEventLastYear = useMemo(() => {
        const lastYearStartMs = subtractMonthsUtc(Date.now(), 12);
        const oneYearCourseRuns = selectedCourseRuns.filter((row) => getRowDateMs(row) >= lastYearStartMs);
        return pickBestEventRun(oneYearCourseRuns);
    }, [selectedCourseRuns]);

    const currentRankSummary = useMemo(() => {
        const selectedCourseSummary = buildRankSummaryFromRunSet(selectedCourseRuns);
        const overallSummary = buildRankSummaryFromRunSet(sortedRuns);
        return selectedCourseSummary ?? overallSummary ?? profileEffectiveRankSummary;
    }, [profileEffectiveRankSummary, selectedCourseRuns, sortedRuns]);

    useEffect(() => {
        let cancelled = false;
        const rankType = currentRankSummary.metric ?? (mode === 'next_ext' ? 'AE' : 'B');
        const loadCurve = async () => {
            try {
                setCurveLoading(true);
                const response = await fetchCurveRankReference(rankType);
                if (!cancelled) {
                    setCurveReferenceRows(Array.isArray(response?.rows) ? response.rows : []);
                }
            } catch (_err) {
                if (!cancelled) {
                    setCurveReferenceRows([]);
                }
            } finally {
                if (!cancelled) {
                    setCurveLoading(false);
                }
            }
        };
        loadCurve();
        return () => {
            cancelled = true;
        };
    }, [currentRankSummary.metric, mode]);

    const courseHistory = useMemo<GenericRecord[]>(() => {
        const source = courseEvents.length > 0 ? courseEvents : selectedCourseRuns;
        return [...source].sort((a, b) => getRowDateMs(b) - getRowDateMs(a));
    }, [courseEvents, selectedCourseRuns]);

    const nextEventSummarySources = useMemo<NextEventSummarySource[]>(() => {
        const courseLastEvent = courseHistory[0] ?? null;
        const lastYearStartMs = subtractMonthsUtc(Date.now(), 12);
        return [
            { index: 1, key: 'Course last event', label: 'Course last event', row: courseLastEvent, fallbackTimeText: '--' },
            { index: 2, key: 'Partic. last event', label: 'Partic. last event', row: selectedCourseRuns[0] ?? null },
            { index: 3, key: 'Partic. PB', label: 'Partic. PB', row: pickFastestAbsoluteRun(selectedCourseRuns) },
            { index: 4, key: 'Partic. best ever', label: 'Partic. best ever', row: pickBestEventRun(selectedCourseRuns) },
            { index: 5, key: 'Partic. best 1Y', label: 'Partic. best 1Y', row: pickBestEventRun(selectedCourseRuns.filter((row) => getRowDateMs(row) >= lastYearStartMs)) }
        ];
    }, [courseHistory, selectedCourseRuns]);

    const projectionContext = useMemo(() => {
        const referenceSource = currentRankSummary.sourceRun ?? bestRun ?? lastRun;
        if (!referenceSource) {
            return null;
        }
        const ageFactorSource = sortedRuns[0] ?? lastRun ?? referenceSource;

        const headerMetric = currentRankSummary.metric ?? (mode === 'next_ext' ? 'AE' : 'B');

        const currentBestRank = getCurrentBestRankValue(referenceSource, mode);
        const exactCurrentRank = currentRankSummary.anchorRank ?? currentBestRank ?? getRankValue(referenceSource, mode);
        const currentGroup = Math.max(0, Math.min(100, Math.round(exactCurrentRank ?? 0)));
        const exactRank = exactCurrentRank ?? currentGroup;
        const baseTimeSeconds = getModeTimeSeconds(referenceSource, mode);
        const bestHardness = getHardnessValue(currentRankSummary.sourceRun ?? bestRun ?? referenceSource);
        const lastHardness = getHardnessValue(lastRun ?? referenceSource);
        if (!baseTimeSeconds || !bestHardness || !exactRank) {
            const baseAnchorRank = currentRankSummary.anchorRank ?? currentGroup;
            const headerAnchorRank = Math.max(0, Math.min(100, baseAnchorRank + rankShift));
            return {
                referenceSource,
                ageFactorSource,
                headerMetric,
                exactRank,
                currentGroup,
                baseTimeSeconds,
                bestHardness,
                lastHardness,
                columns: columnKeys.map((key, index) => ({
                    key,
                    score: Math.max(0, Math.min(100, headerAnchorRank + scoreOffsets[index]))
                }))
            };
        }

        const latestDateMs = courseHistory.length > 0 ? getRowDateMs(courseHistory[0]) : 0;
        const recentWindowMs = latestDateMs > 0 ? subtractMonthsUtc(latestDateMs, 3) : 0;
        const recentHardnessPercents = courseHistory
            .filter((row) => {
                const rowDateMs = getRowDateMs(row);
                return rowDateMs > 0 && rowDateMs >= recentWindowMs && rowDateMs <= latestDateMs;
            })
            .map((row) => getHardnessValue(row))
            .filter((value): value is number => value !== null)
            .map((value) => (value - 1) * 100);

        const courseLastEvent = courseHistory[0] ?? null;
        const courseLastEventHardness = courseLastEvent ? getHardnessValue(courseLastEvent) : null;
        const fallbackBestPercent = (bestHardness - 1) * 100;
        const fallbackLastPercent = courseLastEventHardness !== null
            ? (courseLastEventHardness - 1) * 100
            : (lastHardness ? (lastHardness - 1) * 100 : fallbackBestPercent);
        const maxPercent = recentHardnessPercents.length > 0 ? Math.max(...recentHardnessPercents) : Math.max(fallbackBestPercent, fallbackLastPercent);
        const minPercent = recentHardnessPercents.length > 0 ? Math.min(...recentHardnessPercents) : Math.min(fallbackBestPercent, fallbackLastPercent);
        const high = roundUpHalf(maxPercent + 1);
        const low = Math.max(0, roundDownHalf(minPercent - 1));

        const summaryIndexGroups = new Map<string, number[]>();
        nextEventSummarySources.forEach((entry) => {
            if (!entry.row) return;
            const hardness = getHardnessValue(entry.row);
            if (hardness === null || !Number.isFinite(hardness)) return;
            const percent = Number(((hardness - 1) * 100).toFixed(1));
            const key = percent.toFixed(1);
            const indexes = summaryIndexGroups.get(key) ?? [];
            indexes.push(entry.index);
            summaryIndexGroups.set(key, indexes);
        });

        const projectedRows: Array<{ hardnessPercent: number; key: string; label: React.ReactNode }> = [];
        for (let step = Math.round(high * 2); step >= Math.round(low * 2); step -= 1) {
            const value = step / 2;
            const percentKey = value.toFixed(1);
            const indexes = summaryIndexGroups.get(percentKey) ?? [];
            projectedRows.push({
                hardnessPercent: Number(value.toFixed(1)),
                key: `hardness-${value.toFixed(1)}`,
                label: buildIndexedLabel(`${value.toFixed(1)}%`, indexes, true)
            });
        }

        const basePercentKeys = new Set(projectedRows.map((row) => row.hardnessPercent.toFixed(1)));
        const inserted = new Map<string, { hardnessPercent: number; key: string; label: React.ReactNode }>();
        summaryIndexGroups.forEach((indexes, percentKey) => {
            if (basePercentKeys.has(percentKey)) return;
            const hardnessPercent = Number(percentKey);
            inserted.set(`hardness-index-${percentKey}`, {
                hardnessPercent,
                key: `hardness-index-${percentKey}`,
                label: buildIndexedLabel(`${hardnessPercent.toFixed(1)}%`, indexes, true)
            });
        });

        const allRows = [...projectedRows, ...inserted.values()].sort((left, right) => right.hardnessPercent - left.hardnessPercent);
        const currentCurveSeconds = getCurveSecondsForScore(curveReferenceRows, exactRank);
        const baseAnchorRank = currentRankSummary.anchorRank ?? currentGroup;
        const headerAnchorRank = Math.max(0, Math.min(100, baseAnchorRank + rankShift));
        const columns = columnKeys.map((key, index) => ({
            key,
            score: Math.max(0, Math.min(100, headerAnchorRank + scoreOffsets[index]))
        }));

        return {
            referenceSource,
            ageFactorSource,
            headerMetric,
            exactRank,
            currentGroup,
            baseTimeSeconds,
            bestHardness,
            lastHardness,
            currentCurveSeconds,
            allRows,
            columns
        };
    }, [bestRun, courseHistory, currentRankSummary.anchorRank, currentRankSummary.metric, currentRankSummary.sourceRun, curveReferenceRows, lastRun, mode, nextEventSummarySources, rankShift, sortedRuns]);

    const projectionColumns = useMemo<NextEventProjectionColumn[]>(() => {
        const baseColumn = getNextEventTableColumnByKey('hardness_band');
        const columns: NextEventProjectionColumn[] = [{
            key: 'hardness_band',
            label: baseColumn?.headerName || 'Hardness',
            width: baseColumn?.[isMobile ? 'mobile' : 'laptop']?.width,
            helpTarget: baseColumn?.helpTarget
        }];

        const fallbackAnchorRank = Math.max(0, Math.min(100, (currentRankSummary.anchorRank ?? 0) + rankShift));
        const headerSuffix = currentRankSummary.metricLabel || (mode === 'next_ext' ? 'AE' : '*');
        const scores = projectionContext?.columns || columnKeys.map((key, index) => ({ key, score: Math.max(0, Math.min(100, fallbackAnchorRank + scoreOffsets[index])) }));
        scores.forEach((entry, index) => {
            const columnConfig = getNextEventTableColumnByKey(entry.key);
            columns.push({
                key: entry.key,
                label: buildRankHeaderLabel(entry.score, headerSuffix),
                width: columnConfig?.[isMobile ? 'mobile' : 'laptop']?.width,
                isCurrent: index === 1,
                helpTarget: columnConfig?.helpTarget
            });
        });

        return columns;
    }, [currentRankSummary.anchorRank, currentRankSummary.metricLabel, isMobile, mode, projectionContext, rankShift]);

    const projectionRows = useMemo<NextEventProjectionRow[]>(() => {
        if (!projectionContext || !('allRows' in projectionContext) || !Array.isArray(projectionContext.allRows)) {
            return [];
        }

        const courseLastEvent = nextEventSummarySources.find((entry) => entry.index === 1)?.row ?? null;
        const participantLastEvent = nextEventSummarySources.find((entry) => entry.index === 2)?.row ?? null;
        const courseLastEventHardnessPercent = courseLastEvent && getHardnessValue(courseLastEvent) !== null
            ? Number((((getHardnessValue(courseLastEvent) as number) - 1) * 100).toFixed(1))
            : null;
        const participantLastEventHardnessPercent = participantLastEvent && getHardnessValue(participantLastEvent) !== null
            ? Number((((getHardnessValue(participantLastEvent) as number) - 1) * 100).toFixed(1))
            : null;
        const participantLastEventRank = getRoundedBestRank(participantLastEvent);
        const maintainBest1YRank = currentRankSummary.anchorRank;
        const improvingBest1YRank = maintainBest1YRank !== null ? maintainBest1YRank + 1 : null;

        return projectionContext.allRows.map((row) => {
            const targetHardness = 1 + (row.hardnessPercent / 100);
            const cells: Record<string, { value: string; tone?: 'default' | 'best' | 'last' | 'improve' }> = {
                hardness_band: { value: '' }
            };

            projectionContext.columns.forEach((column) => {
                let value = 'NA';
                let tone: 'default' | 'best' | 'last' | 'improve' | undefined;
                const targetAdjustedSeconds = getCurveThresholdSecondsForScore(curveReferenceRows, column.score);
                if (targetAdjustedSeconds !== null) {
                    const projectedSeconds = getActualSecondsForRankTarget(
                        projectionContext.ageFactorSource,
                        projectionContext.headerMetric,
                        targetAdjustedSeconds,
                        targetHardness
                    );
                    if (projectedSeconds !== null) {
                        value = formatTimeValue(projectedSeconds);
                    }
                }

                if (participantLastEventHardnessPercent !== null
                    && row.hardnessPercent === participantLastEventHardnessPercent
                    && participantLastEventRank !== null
                    && column.score === participantLastEventRank) {
                    tone = 'last';
                } else if (courseLastEventHardnessPercent !== null
                    && row.hardnessPercent === courseLastEventHardnessPercent
                    && maintainBest1YRank !== null
                    && column.score === maintainBest1YRank) {
                    tone = 'best';
                } else if (courseLastEventHardnessPercent !== null
                    && row.hardnessPercent === courseLastEventHardnessPercent
                    && improvingBest1YRank !== null
                    && column.score === improvingBest1YRank) {
                    tone = 'improve';
                }

                cells[column.key] = { value, tone };
            });

            return {
                key: row.key,
                label: row.label,
                sortValue: row.hardnessPercent,
                cells
            };
        });
    }, [currentRankSummary.anchorRank, curveReferenceRows, nextEventSummarySources, projectionContext]);

    const sortedProjectionRows = useMemo(() => {
        const rows = [...projectionRows];
        rows.sort((left, right) => {
            if (sortKey === 'hardness_band') {
                return sortDir === 'asc' ? left.sortValue - right.sortValue : right.sortValue - left.sortValue;
            }
            const leftCell = left.cells[sortKey]?.value || '';
            const rightCell = right.cells[sortKey]?.value || '';
            const leftSeconds = parseTimeSortValue(leftCell);
            const rightSeconds = parseTimeSortValue(rightCell);
            if (leftSeconds !== null && rightSeconds !== null) {
                return sortDir === 'asc' ? leftSeconds - rightSeconds : rightSeconds - leftSeconds;
            }
            return sortDir === 'asc' ? leftCell.localeCompare(rightCell) : rightCell.localeCompare(leftCell);
        });
        return rows;
    }, [projectionRows, sortDir, sortKey]);

    const backButtonElement = getNextEventElementById('nextEvent.backButton');
    const athleteInputElement = getNextEventElementById('nextEvent.input');
    const athleteCodeLabelElement = getNextEventElementById('nextEvent.athleteCodeLabel');
    const athleteCodeElement = getNextEventElementById('nextEvent.athleteCode');
    const courseLabelElement = getNextEventElementById('nextEvent.courseLabel');
    const courseSelectElement = getNextEventElementById('nextEvent.courseSelect');
    const nextPrButtonElement = getNextEventElementById('nextEvent.nextPrButton');
    const summaryPanelElement = getNextEventElementById('nextEvent.summaryPanel');
    const tableContainerElement = getNextEventElementById('nextEvent.tableContainer');
    const rankLabelElement = getNextEventElementById('nextEvent.rankLabel');
    const rankValueElement = getNextEventElementById('nextEvent.rankValue');

    const activePlacementKey = isMobile ? 'mobile' : 'laptop';
    const backButtonPlacement = backButtonElement?.[activePlacementKey];
    const athleteInputPlacement = athleteInputElement?.[activePlacementKey];
    const athleteCodeLabelPlacement = athleteCodeLabelElement?.[activePlacementKey];
    const athleteCodePlacement = athleteCodeElement?.[activePlacementKey];
    const courseLabelPlacement = courseLabelElement?.[activePlacementKey];
    const courseSelectPlacement = courseSelectElement?.[activePlacementKey];
    const nextPrButtonPlacement = nextPrButtonElement?.[activePlacementKey];
    const summaryPanelPlacement = summaryPanelElement?.[activePlacementKey];
    const tableContainerPlacement = tableContainerElement?.[activePlacementKey];
    const rankLabelPlacement = rankLabelElement?.[activePlacementKey];
    const rankValuePlacement = rankValueElement?.[activePlacementKey];
    const summaryTableColumnConfig = useMemo(() => {
        const layoutConfig = getNextEventLayoutConfig() as any;
        const configured = Array.isArray(layoutConfig?.summaryTableColumns)
            ? layoutConfig.summaryTableColumns
            : [];
        const map: Record<string, string | undefined> = {};
        configured.forEach((column: any) => {
            const width = column?.[activePlacementKey]?.width;
            if (column?.key && width) {
                map[String(column.key)] = width;
            }
        });
        return map;
    }, [activePlacementKey]);

    const nextEventSummaryEntries = useMemo(() => {
        const entries: Array<{
            key: string;
            label: React.ReactNode;
            date: string;
            combinedHardness: string;
            time: string;
            adjTime: string;
            ranked: string;
        }> = [];

        const buildSummaryRow = (row: GenericRecord | null, label: string, index: number, fallbackTimeText?: string) => {
            if (!row) return;
            const bestMetric = getNextEventResolvedMetric(row);
            const timeText = formatTimeValue(getRowTimeSeconds(row));
            const adjustedText = bestMetric
                ? formatTimeValue(getMetricAdjustedSeconds(row, bestMetric.metric))
                : '';
            const rankedText = bestMetric
                ? `${Math.round(bestMetric.rank)} ${bestMetric.label}`
                : '--';
            const adjustedLabel = adjustedText && bestMetric
                ? `${adjustedText} ${bestMetric.label}`
                : '--';

            entries.push({
                key: `${label}-${index}`,
                label: buildIndexedLabel(label, [index]),
                date: formatDateValue(pickField(row, ['formatted_date', 'event_date', 'date'])),
                combinedHardness: formatHardnessPercentValue(getHardnessValue(row)),
                time: fallbackTimeText || timeText || '--',
                adjTime: adjustedLabel,
                ranked: rankedText
            });
        };

        nextEventSummarySources.forEach((entry) => {
            buildSummaryRow(entry.row, entry.label, entry.index, entry.fallbackTimeText);
        });

        return entries;
    }, [nextEventSummarySources]);

    const currentRankDisplay = profileDisplayRankSummary.display || currentRankSummary.display;

    const onHeaderActivate = (
        event: React.MouseEvent<HTMLTableCellElement> | React.KeyboardEvent<HTMLTableCellElement>,
        column: NextEventProjectionColumn
    ) => {
        if (columnHeaderMode === 'help') {
            const target = event.currentTarget as HTMLElement;
            const rect = target.getBoundingClientRect();
            requestUnifiedHelp(column.helpTarget || 'term-rank', { x: rect.left, y: rect.bottom }, column.label);
            return;
        }
        setSortKey((current) => {
            if (current === column.key) {
                setSortDir((direction) => direction === 'asc' ? 'desc' : 'asc');
                return current;
            }
            setSortDir(column.key === 'hardness_band' ? 'desc' : 'asc');
            return column.key;
        });
    };

    const handleBackNavigation = () => {
        const params = new URLSearchParams();
        if (selectedAthleteCode) {
            params.set('athlete_code', selectedAthleteCode);
        }
        if (currentAthleteName) {
            params.set('athlete_name', currentAthleteName);
        }
        navigate(params.toString() ? `/athletes?${params.toString()}` : '/athletes', {
            state: {
                athleteCode: selectedAthleteCode || undefined,
                athleteName: currentAthleteName || undefined,
                from: 'next-event'
            }
        });
    };

    return (
        <div className="athletes-page next-event-page" style={{ padding: isMobile ? '0.4rem 0 1rem' : '0.6rem 0 1rem' }}>
            <div
                style={{
                    position: 'relative',
                    minHeight: tableContainerPlacement?.y || (isMobile ? '3.4cm' : '3.1cm')
                }}
            >
                <button
                    type="button"
                    onClick={handleBackNavigation}
                    aria-label="Back"
                    title="Back"
                    style={{
                        fontSize: isMobile ? '1.35rem' : '1.2rem',
                        border: '1px solid #222',
                        borderRadius: '8px',
                        background: '#fff',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxSizing: 'border-box',
                        width: backButtonPlacement?.width ?? '30px',
                        height: backButtonPlacement?.height ?? '30px',
                        position: 'absolute',
                        left: backButtonPlacement?.x ?? '0cm',
                        top: backButtonPlacement?.y ?? '0cm',
                        zIndex: 30
                    }}
                >
                    ←
                </button>

                <div
                    style={{
                        position: 'absolute',
                        left: athleteInputPlacement?.x ?? '1.3cm',
                        top: athleteInputPlacement?.y ?? '0cm',
                        width: athleteInputPlacement?.width ?? '8.8cm',
                        zIndex: 40
                    }}
                >
                    <AthleteSearch
                        onSelect={(athleteCode) => setSelectedAthleteCode(athleteCode)}
                        initialQuery={initialSearchQuery}
                        suppressInitialSearch={shouldSuppressInitialSearch}
                        placeholder="Type participant name or code..."
                    />
                </div>

                {renderConfigControlLabel(
                    athleteCodeLabelElement,
                    'Athlete code:',
                    'control-athlete-code',
                    {
                        fontSize: athleteCodeLabelElement?.style?.fontSize ?? '0.75rem',
                        fontWeight: Number(athleteCodeLabelElement?.style?.fontWeight ?? 600),
                        color: athleteCodeLabelElement?.style?.color ?? '#111827',
                        lineHeight: Number(athleteCodeLabelElement?.style?.lineHeight ?? 0.9)
                    },
                    {
                        position: 'absolute',
                        left: athleteCodeLabelPlacement?.x ?? '1.2cm',
                        top: athleteCodeLabelPlacement?.y ?? '0.7cm',
                        display: 'inline-flex',
                        pointerEvents: 'auto'
                    },
                    true
                )}

                <div
                    style={{
                        position: 'absolute',
                        left: athleteCodePlacement?.x ?? '3.6cm',
                        top: athleteCodePlacement?.y ?? '0.7cm',
                        width: athleteCodePlacement?.width,
                        fontSize: '0.82rem',
                        color: '#374151',
                        fontWeight: 600
                    }}
                >
                    {selectedAthleteCode || '—'}
                </div>

                {renderConfigControlLabel(
                    rankLabelElement,
                    'Rank:',
                    'term-rank',
                    {
                        fontSize: rankLabelElement?.style?.fontSize ?? '0.75rem',
                        fontWeight: Number(rankLabelElement?.style?.fontWeight ?? 600),
                        color: rankLabelElement?.style?.color ?? '#111827',
                        lineHeight: Number(rankLabelElement?.style?.lineHeight ?? 0.9)
                    },
                    {
                        position: 'absolute',
                        left: rankLabelPlacement?.x ?? '6.4cm',
                        top: rankLabelPlacement?.y ?? '1.0cm',
                        display: 'inline-flex',
                        pointerEvents: 'auto'
                    },
                    true
                )}

                <div
                    style={{
                        position: 'absolute',
                        left: rankValuePlacement?.x ?? '8.1cm',
                        top: rankValuePlacement?.y ?? '1.1cm',
                        width: rankValuePlacement?.width,
                        fontSize: '0.82rem',
                        color: '#374151',
                        fontWeight: 600
                    }}
                >
                    {currentRankDisplay}
                </div>

                {renderConfigControlLabel(
                    courseLabelElement,
                    'Course:',
                    'page-course',
                    {
                        fontSize: courseLabelElement?.style?.fontSize ?? '0.75rem',
                        fontWeight: Number(courseLabelElement?.style?.fontWeight ?? 600),
                        color: courseLabelElement?.style?.color ?? '#111827',
                        lineHeight: Number(courseLabelElement?.style?.lineHeight ?? 0.9)
                    },
                    {
                        position: 'absolute',
                        left: courseLabelPlacement?.x ?? '1.8cm',
                        top: courseLabelPlacement?.y ?? '1.3cm',
                        display: 'inline-flex',
                        pointerEvents: 'auto'
                    },
                    true
                )}

                <select
                    value={selectedCourseCode}
                    onChange={(event) => setSelectedCourseCode(event.target.value)}
                    style={{
                        position: 'absolute',
                        left: courseSelectPlacement?.x ?? '3.6cm',
                        top: courseSelectPlacement?.y ?? '1.25cm',
                        width: courseSelectPlacement?.width ?? '6.6cm',
                        minWidth: courseSelectPlacement?.width ?? '6.6cm',
                        maxWidth: courseSelectPlacement?.width ?? '6.6cm',
                        fontSize: '0.82rem',
                        border: '1px solid #c7ced9',
                        borderRadius: '8px',
                        background: '#fff',
                        color: '#1f2937',
                        padding: '0.15rem 0.35rem'
                    }}
                >
                    <option value="">Select course</option>
                    {eventOptions.map((option) => (
                        <option key={option.eventCode} value={option.eventCode}>{option.eventName}</option>
                    ))}
                </select>

                <div
                    style={{
                        position: 'absolute',
                        left: `calc(${courseSelectPlacement?.x ?? '3.6cm'} + ${courseSelectPlacement?.width ?? '6.6cm'} + 0.15cm)`,
                        top: courseSelectPlacement?.y ?? '1.25cm',
                        display: 'inline-flex',
                        gap: '0.12rem',
                        alignItems: 'center'
                    }}
                >
                    <button
                        type="button"
                        onClick={() => setRankShift((current) => Math.min(100, current + 1))}
                        aria-label="Shift rank range higher"
                        title="Shift rank range higher"
                        style={{
                            width: '0.52cm',
                            height: '0.52cm',
                            border: '1px solid #9ca3af',
                            borderRadius: '6px',
                            background: '#fff',
                            color: '#111827',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.78rem',
                            lineHeight: 1,
                            padding: 0
                        }}
                    >
                        ←
                    </button>
                    <button
                        type="button"
                        onClick={() => setRankShift((current) => Math.max(-100, current - 1))}
                        aria-label="Shift rank range lower"
                        title="Shift rank range lower"
                        style={{
                            width: '0.52cm',
                            height: '0.52cm',
                            border: '1px solid #9ca3af',
                            borderRadius: '6px',
                            background: '#fff',
                            color: '#111827',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.78rem',
                            lineHeight: 1,
                            padding: 0
                        }}
                    >
                        →
                    </button>
                </div>

                <button
                    type="button"
                    onClick={() => setMode((current) => current === 'next_pr' ? 'next_ext' : 'next_pr')}
                    style={{
                        position: 'absolute',
                        left: nextPrButtonPlacement?.x ?? '-0.2cm',
                        top: nextPrButtonPlacement?.y ?? '1.0cm',
                        width: nextPrButtonPlacement?.width ?? '1cm',
                        height: nextPrButtonPlacement?.height ?? '1cm',
                        border: '1px solid #777',
                        borderRadius: '6px',
                        background: '#fff',
                        color: '#111827',
                        cursor: 'pointer',
                        fontSize: '0.48rem',
                        fontWeight: 700,
                        lineHeight: 1,
                        padding: 0
                    }}
                >
                    {mode === 'next_pr'
                        ? (nextPrButtonElement?.name || 'Next PR')
                        : 'Next Ext'}
                </button>

                {summaryPanelPlacement ? (
                    <div
                        style={{
                            position: 'absolute',
                            left: summaryPanelPlacement.x,
                            top: summaryPanelPlacement.y,
                            width: summaryPanelPlacement.width,
                            height: summaryPanelPlacement.height,
                            boxSizing: 'border-box',
                            border: '1px solid #d1d5db',
                            borderRadius: '14px',
                            background: '#ffffff',
                            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.08)',
                            padding: isMobile ? '0.22rem 0.45rem' : '0.45rem 0.7rem',
                            overflow: 'hidden',
                            zIndex: 10
                        }}
                    >
                        {nextEventSummaryEntries.length === 0 ? (
                            <div style={{ color: '#6b7280', fontSize: isMobile ? '0.74rem' : '0.8rem' }}>
                                Summary details will appear here once the athlete has course history.
                            </div>
                        ) : (
                            <table
                                style={{
                                    width: '100%',
                                    borderCollapse: 'collapse',
                                    tableLayout: 'fixed',
                                    fontSize: isMobile ? '0.67rem' : '0.78rem',
                                    color: '#111827'
                                }}
                            >
                                <thead>
                                    <tr style={{ background: '#e5e7eb' }}>
                                        <th style={{ textAlign: 'left', padding: isMobile ? '0.14rem 0.28rem' : '0.22rem 0.35rem', fontWeight: 700, width: summaryTableColumnConfig.label, minWidth: summaryTableColumnConfig.label, maxWidth: summaryTableColumnConfig.label }}>Key Events</th>
                                        <th style={{ textAlign: 'center', padding: isMobile ? '0.14rem 0.28rem' : '0.22rem 0.35rem', fontWeight: 700, width: summaryTableColumnConfig.date, minWidth: summaryTableColumnConfig.date, maxWidth: summaryTableColumnConfig.date }}>Date</th>
                                        <th style={{ textAlign: 'center', padding: isMobile ? '0.14rem 0.28rem' : '0.22rem 0.35rem', fontWeight: 700, width: summaryTableColumnConfig.combinedHardness, minWidth: summaryTableColumnConfig.combinedHardness, maxWidth: summaryTableColumnConfig.combinedHardness }}>Comb Hardness</th>
                                        <th style={{ textAlign: 'center', padding: isMobile ? '0.14rem 0.28rem' : '0.22rem 0.35rem', fontWeight: 700, width: summaryTableColumnConfig.time, minWidth: summaryTableColumnConfig.time, maxWidth: summaryTableColumnConfig.time }}>Time</th>
                                        <th style={{ textAlign: 'center', padding: isMobile ? '0.14rem 0.28rem' : '0.22rem 0.35rem', fontWeight: 700, width: summaryTableColumnConfig.adjTime, minWidth: summaryTableColumnConfig.adjTime, maxWidth: summaryTableColumnConfig.adjTime }}>Adj Time</th>
                                        <th style={{ textAlign: 'center', padding: isMobile ? '0.14rem 0.28rem' : '0.22rem 0.35rem', fontWeight: 700, width: summaryTableColumnConfig.ranked, minWidth: summaryTableColumnConfig.ranked, maxWidth: summaryTableColumnConfig.ranked }}>Ranked</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {nextEventSummaryEntries.map((entry) => (
                                        <tr key={entry.key} style={{ borderTop: '1px solid #e5e7eb' }}>
                                            <td style={{ padding: isMobile ? '0.12rem 0.28rem' : '0.18rem 0.35rem', fontWeight: 600, verticalAlign: 'top', width: summaryTableColumnConfig.label, minWidth: summaryTableColumnConfig.label, maxWidth: summaryTableColumnConfig.label }}>{entry.label}</td>
                                            <td style={{ textAlign: 'center', padding: isMobile ? '0.12rem 0.28rem' : '0.18rem 0.35rem', verticalAlign: 'top', width: summaryTableColumnConfig.date, minWidth: summaryTableColumnConfig.date, maxWidth: summaryTableColumnConfig.date }}>{entry.date || '--'}</td>
                                            <td style={{ textAlign: 'center', padding: isMobile ? '0.12rem 0.28rem' : '0.18rem 0.35rem', verticalAlign: 'top', width: summaryTableColumnConfig.combinedHardness, minWidth: summaryTableColumnConfig.combinedHardness, maxWidth: summaryTableColumnConfig.combinedHardness }}>{entry.combinedHardness}</td>
                                            <td style={{ textAlign: 'center', padding: isMobile ? '0.12rem 0.28rem' : '0.18rem 0.35rem', verticalAlign: 'top', width: summaryTableColumnConfig.time, minWidth: summaryTableColumnConfig.time, maxWidth: summaryTableColumnConfig.time }}>{entry.time}</td>
                                            <td style={{ textAlign: 'center', padding: isMobile ? '0.12rem 0.28rem' : '0.18rem 0.35rem', verticalAlign: 'top', width: summaryTableColumnConfig.adjTime, minWidth: summaryTableColumnConfig.adjTime, maxWidth: summaryTableColumnConfig.adjTime }}>{entry.adjTime}</td>
                                            <td style={{ textAlign: 'center', padding: isMobile ? '0.12rem 0.28rem' : '0.18rem 0.35rem', verticalAlign: 'top', width: summaryTableColumnConfig.ranked, minWidth: summaryTableColumnConfig.ranked, maxWidth: summaryTableColumnConfig.ranked }}>{entry.ranked}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                ) : null}
            </div>

            <div
                style={{
                    position: 'relative',
                    marginTop: tableContainerPlacement?.y ?? (isMobile ? '3.4cm' : '3.1cm'),
                    marginLeft: tableContainerPlacement?.x ?? '0cm',
                    width: tableContainerPlacement?.width
                        ? `min(${tableContainerPlacement.width}, calc(100vw - ${tableContainerPlacement?.x ?? '0cm'} - 0.6cm))`
                        : `calc(100vw - ${tableContainerPlacement?.x ?? '0cm'} - 0.6cm)`,
                    maxWidth: `calc(100vw - ${tableContainerPlacement?.x ?? '0cm'} - 0.6cm)`,
                    height: tableContainerPlacement?.height,
                    maxHeight: tableContainerPlacement?.height,
                    boxSizing: 'border-box',
                    overflow: 'hidden'
                }}
            >
                {sortedProjectionRows.length > 0 ? (
                    <NextEventProjectionTable
                        columns={projectionColumns}
                        rows={sortedProjectionRows}
                        sortKey={sortKey}
                        sortDir={sortDir}
                        onHeaderActivate={onHeaderActivate}
                        tableMinWidth={tableContainerPlacement?.width}
                    />
                ) : (
                    <div className="athlete-empty-state">
                        <h2>Next Event preview unavailable</h2>
                        <p>Select a participant and course with at least one usable run to build the first projection slice.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default NextEvent;