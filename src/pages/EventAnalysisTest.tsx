import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import ReactECharts from 'echarts-for-react';
import { fetchAllResults, fetchResults } from '../api/backendAPI';
import { requestUnifiedHelp } from './UnifiedHelp';
import {
  EventAnalysisViewport,
  EventAnalysisLayoutElement,
  getEventAnalysisLayoutConfig,
  getEventAnalysisElementById,
  getEventAnalysisElements,
  getEventAnalysisElementPlacement,
  getEventAnalysisViewportForWidth
} from '../config/layout/eventAnalysisLayoutHelper';
import { formatAvgTime, formatDate2 } from '../utilities';
import { navigateBackWithNavStack, navigateWithNavStack } from '../utils/navigationStack';
import { useGlobalWaitCursor } from '../utils/useGlobalWaitCursor';
import { useDelayedUnifiedHelp } from '../utils/useDelayedUnifiedHelp';
import './ResultsTable.css';

const EVENT_ANALYSIS_TEST_STATE_KEY = 'event_analysis_test_state_v1';
const PLOT_COLOR_PALETTE = ['#1f77b4', '#d62728', '#2ca02c', '#f1c40f', '#9467bd'];
const MAX_PLOT_HIGHLIGHTED_SERIES = 5;

const readRowValue = (row: any, key: string): any => {
  if (!row) return '';
  const camelKey = key.replace(/_([a-z])/g, (_m, c) => c.toUpperCase());
  return row[key] ?? row[camelKey] ?? '';
};

const parseNumeric = (value: any): number | null => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (/^(na|n\/a|null|none)$/i.test(trimmed)) return null;
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const normalizeControlToken = (value: string): string =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');

const normalizePeriodMode = (value: string): 'recent' | 'last50' | 'since-lockdown' | 'all' | 'Annual' | 'Qseason' | 'Mseason' => {
  const token = normalizeControlToken(value);
  if (token === 'annual') return 'Annual';
  if (token === 'qseason' || token === 'qtrseasonality') return 'Qseason';
  if (token === 'mseason' || token === 'mnthseasonality' || token === 'monthseasonality') return 'Mseason';
  if (token === 'sincelockdown') return 'since-lockdown';
  if (token === 'last50' || token === 'last50events') return 'last50';
  if (token === 'all' || token === 'allevents') return 'all';
  return 'recent';
};

const normalizeAnalysisType = (value: string): 'participants' | '%Participants' | '%Total' | '%Deviation' | '#Actual Deviation' | 'Times' | 'Age' => {
  const raw = String(value || '').trim().toLowerCase();
  if (raw === 'actual%' || raw === 'actual %') return '%Participants';
  if (raw === '%total' || raw === '% total') return '%Total';
  if (raw === '%deviation' || raw === '% deviation') return '%Deviation';
  const token = normalizeControlToken(value);
  if (token === 'actual' || token === 'participants') return 'participants';
  if (token === 'actualpercent' || token === 'participantspercent' || token === 'percentparticipants') return '%Participants';
  if (token === 'percenttotal' || token === 'totalpercent') return '%Total';
  if (token === 'percentdeviation' || token === 'deviationpercent' || token === 'deviation') return '%Deviation';
  if (token === 'actualdeviation' || token === 'numberactualdeviation') return '#Actual Deviation';
  if (token === 'times' || token === 'time') return 'Times';
  if (token === 'age') return 'Age';
  return 'participants';
};

const normalizeFilterType = (value: string): string => {
  const token = normalizeControlToken(value);
  if (token === 'all' || token === 'participants' || token === 'allparticipants') return 'all';
  if (token === 'times' || token === 'time') return 'times';
  if (token === 'age') return 'age';
  if (token === 'eventnumber') return 'eventNumber';
  if (token === 'seasonalhardness' || token === 'coeff') return 'coeff';
  if (token === 'eventhardness' || token === 'coeffevent') return 'coeff_event';
  if (token === 'combinedhardness' || token === 'coeffcombined') return 'coeff_combined';
  if (token === 'volunteers' || token === 'volunteer') return 'volunteers';
  if (token === 'tourists' || token === 'tourist') return 'tourist';
  if (token === 'supertourists' || token === 'supertourist' || token === 'stourist') return 'sTourist';
  if (token === 'firsttimers' || token === 'firsttimer' || token === '1sttimers' || token === '1sttimer' || token === '1time') return '1time';
  if (token === 'clubbers' || token === 'clubs') return 'clubs';
  if (token === 'pbs' || token === 'pb') return 'pb';
  if (token === 'recentbests' || token === 'recentbest') return 'recentBest';
  if (token === 'regulars' || token === 'regs') return 'regs';
  if (token === 'returners' || token === 'returner') return 'returners';
  if (token === 'eligibletimes' || token === 'eligibletime') return 'eligible_time';
  if (token === 'unknowns' || token === 'unknown') return 'unknown';
  return 'all';
};

const normalizeAggType = (value: string): 'avg' | 'total' | 'max' | 'min' | 'range' | 'growth' => {
  const token = normalizeControlToken(value);
  if (token === 'total') return 'total';
  if (token === 'maximum' || token === 'max') return 'max';
  if (token === 'minimum' || token === 'min') return 'min';
  if (token === 'range') return 'range';
  if (token === 'growth') return 'growth';
  return 'avg';
};

const normalizeCellAgg = (value: string): 'single' | 'avg' | 'min' | 'max' => {
  const token = normalizeControlToken(value);
  if (token === 'minimum' || token === 'min') return 'min';
  if (token === 'maximum' || token === 'max') return 'max';
  if (token === 'average' || token === 'avg') return 'avg';
  return 'single';
};

const normalizeTimeAdj = (value: string): 'none' | 'hardness' | 'age' | 'both' => {
  const token = normalizeControlToken(value);
  if (token === 'hardnessadjusted' || token === 'hardness') return 'hardness';
  if (token === 'ageadjusted' || token === 'age') return 'age';
  if (token === 'hardnessandageadjusted' || token === 'both') return 'both';
  return 'none';
};

const parseEventDate = (value: any): Date | null => {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  const str = String(value).trim();
  const slash = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(str);
  if (slash) {
    const day = Number(slash[1]);
    const month = Number(slash[2]) - 1;
    const year = Number(slash[3]);
    const date = new Date(year, month, day);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const iso = /^\d{4}-\d{2}-\d{2}$/.exec(str);
  if (iso) {
    const date = new Date(str);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
};

const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const quarterNames = ['Q1', 'Q2', 'Q3', 'Q4'];

const toPeriodKey = (eventDate: any, periodMode: string): string => {
  const date = parseEventDate(eventDate);
  if (!date) return String(eventDate ?? '');
  if (periodMode === 'Annual') return String(date.getFullYear());
  if (periodMode === 'Qseason') return quarterNames[Math.floor(date.getMonth() / 3)];
  if (periodMode === 'Mseason') return monthNames[date.getMonth()];
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
};

const formatPeriodHeader = (periodKey: string, periodMode: string): string => {
  if (periodMode === 'Annual' || periodMode === 'Qseason' || periodMode === 'Mseason') return periodKey;
  return formatDate2(periodKey);
};

const sortPeriodKeys = (keys: string[], periodMode: string): string[] => {
  if (periodMode === 'Mseason') {
    return [...keys].sort((a, b) => monthNames.indexOf(a) - monthNames.indexOf(b));
  }
  if (periodMode === 'Qseason') {
    return [...keys].sort((a, b) => quarterNames.indexOf(a) - quarterNames.indexOf(b));
  }
  if (periodMode === 'Annual') {
    return [...keys].sort((a, b) => Number(b) - Number(a));
  }
  return [...keys].sort((a, b) => {
    const ad = parseEventDate(a);
    const bd = parseEventDate(b);
    if (!ad || !bd) return String(b).localeCompare(String(a));
    return bd.getTime() - ad.getTime();
  });
};

const getFilterField = (filterType: string): string => {
  switch (filterType) {
    case 'all': return 'last_position';
    case 'eventNumber': return 'event_number';
    case 'coeff': return 'coeff';
    case 'coeff_event': return 'coeff_event';
    case 'coeff_combined': return 'coeff_combined';
    case 'volunteers': return 'volunteers';
    case 'tourist': return 'tourist_count';
    case 'sTourist': return 'super_tourist_count';
    case '1time': return 'first_timers_count';
    case 'clubs': return 'club_count';
    case 'pb': return 'pb_count';
    case 'recentBest': return 'recentbest_count';
    case 'regs': return 'regulars';
    case 'returners': return 'returners_count';
    case 'eligible_time': return 'eligible_time_count';
    case 'unknown': return 'unknown_count';
    default: return 'last_position';
  }
};

const isHardnessFilter = (filterType: string): boolean =>
  filterType === 'coeff' || filterType === 'coeff_event' || filterType === 'coeff_combined';

const parseCoefficient = (rawValue: any): number | null => {
  const numeric = parseNumeric(rawValue);
  if (numeric === null || !Number.isFinite(numeric)) return null;
  return Math.abs(numeric) < 0.5 ? (1 + numeric) : numeric;
};

const parseCombinedDeviation = (row: any): number | null => {
  const coeff = parseCoefficient(readRowValue(row, 'coeff'));
  const coeffEvent = parseCoefficient(
    readRowValue(row, 'coeff_event')
    ?? readRowValue(row, 'coefEvent')
    ?? readRowValue(row, 'coeffEvent')
    ?? readRowValue(row, 'coeffevent')
  );

  if (coeff !== null && coeffEvent !== null) {
    return (coeff - 1) + (coeffEvent - 1);
  }

  const directCombined = parseNumeric(readRowValue(row, 'coeff_combined') ?? readRowValue(row, 'coeffCombined'));
  if (directCombined === null || !Number.isFinite(directCombined)) return null;
  if (Math.abs(directCombined) < 0.5) return directCombined;
  if (directCombined >= 0.5 && directCombined <= 1.5) return directCombined - 1;
  return directCombined / 100;
};

// Fields where a value of 0 means "no data" rather than a legitimate zero measurement.
// These are counts/positions that must be a positive integer to be meaningful.
const POSITIVE_ONLY_FIELDS = new Set([
  'last_position', 'event_number', 'avg_age',
  'avg_time', 'avgtimelim12', 'avgtimelim5'
]);

const parseCountValue = (raw: any, field: string): number | null => {
  const value = parseNumeric(raw);
  if (value === null) return null;
  if (POSITIVE_ONLY_FIELDS.has(field) && value <= 0) return null;
  return value;
};

const getRawMetricValue = (row: any, analysisType: string, filterType: string, timeAdj: string): number | null => {
  if (analysisType === 'Times') {
    const timeField = timeAdj === 'hardness'
      ? 'avgtimelim12'
      : (timeAdj === 'age' || timeAdj === 'both')
        ? 'avgtimelim5'
        : 'avg_time';
    return parseCountValue(readRowValue(row, timeField), timeField);
  }
  if (analysisType === 'Age') {
    return parseCountValue(readRowValue(row, 'avg_age'), 'avg_age');
  }
  if (filterType === 'coeff') {
    const coeff = parseCoefficient(readRowValue(row, 'coeff'));
    return coeff === null ? null : (coeff - 1);
  }
  if (filterType === 'coeff_event') {
    const coeffEvent = parseCoefficient(
      readRowValue(row, 'coeff_event')
      ?? readRowValue(row, 'coefEvent')
      ?? readRowValue(row, 'coeffEvent')
      ?? readRowValue(row, 'coeffevent')
    );
    return coeffEvent === null ? null : (coeffEvent - 1);
  }
  if (filterType === 'coeff_combined') {
    return parseCombinedDeviation(row);
  }
  const field = getFilterField(filterType);
  const value = parseCountValue(readRowValue(row, field), field);
  if (value !== null) return value;
  if (field === 'first_timers_count') return parseCountValue(readRowValue(row, 'first_timer_count'), 'first_timers_count');
  return null;
};

const aggregateValues = (values: number[], aggType: string, analysisType?: string): number | null => {
  const valid = values.filter((value) => Number.isFinite(value));
  if (valid.length === 0) return null;
  const validForExtrema = (analysisType === 'Times' && (aggType === 'min' || aggType === 'max'))
    ? valid.filter((value) => !isUnavailableTimesValue(value))
    : valid;
  if (validForExtrema.length === 0) return null;
  if (aggType === 'total') return valid.reduce((sum, value) => sum + value, 0);
  if (aggType === 'max') return Math.max(...validForExtrema);
  if (aggType === 'min') return Math.min(...validForExtrema);
  if (aggType === 'range') return Math.max(...valid) - Math.min(...valid);
  if (aggType === 'growth') {
    if (valid.length < 2) return 0;
    return (valid[valid.length - 1] - valid[0]) / (valid.length - 1);
  }
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
};

const percentOneDecimalFilters = ['sTourist', 'pb', 'recentBest', 'regs', 'returners', 'unknown'];

const formatPercent = (value: number | null | undefined, precision = 0): string => {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return '';
  const numeric = Number(value);
  if (precision <= 0) return `${Math.round(numeric)}%`;
  return `${numeric.toFixed(precision)}%`;
};

const getPercentParticipantsPrecision = (filterType?: string): number =>
  (filterType && percentOneDecimalFilters.includes(filterType)) ? 1 : 0;

const formatSignedPercent = (value: number | null | undefined, decimals = 0): string => {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return '';
  const numeric = Number(value);
  const out = decimals <= 0 ? `${Math.round(numeric)}%` : `${numeric.toFixed(decimals)}%`;
  return numeric > 0 ? `+${out}` : out;
};

const formatSignedNumber = (value: number | null | undefined, decimals = 0): string => {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return '';
  const numeric = Number(value);
  const out = decimals <= 0 ? `${Math.round(numeric)}` : `${numeric.toFixed(decimals)}`;
  return numeric > 0 ? `+${out}` : out;
};

const getDeviationColor = (value: number | null | undefined, filterType?: string): string => {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return 'inherit';
  const numeric = Number(value);
  const isCoeff = Boolean(filterType && String(filterType).startsWith('coeff'));
  if (numeric > 0) return isCoeff ? 'red' : 'blue';
  if (numeric < 0) return isCoeff ? 'blue' : 'red';
  return 'inherit';
};

const isUnavailableTimesValue = (value: number): boolean => {
  if (!Number.isFinite(value)) return true;
  return value === 0 || value === (59 * 60 + 59);
};

const formatByType = (value: number | null, analysisType: string, filterType?: string): string => {
  if (value === null || !Number.isFinite(value)) return '';
  if (filterType && isHardnessFilter(filterType)) return `${(value * 100).toFixed(2)}%`;
  if (analysisType === 'Times') {
    if (isUnavailableTimesValue(value)) return 'NA';
    return formatAvgTime(value);
  }
  if (analysisType === 'Age') return Number(value).toFixed(1);
  if (analysisType === '%Participants') return formatPercent(value, getPercentParticipantsPrecision(filterType));
  if (analysisType === '%Total') return `${value.toFixed(1)}%`;
  if (analysisType === '%Deviation') return formatSignedPercent(value, 0);
  if (analysisType === '#Actual Deviation') {
    if (filterType && isHardnessFilter(filterType)) return formatSignedPercent(value * 100, 1);
    return formatSignedNumber(value, 0);
  }
  return `${Math.round(value)}`;
};

const formatSignedFixed = (value: number | null, decimals = 2): string => {
  if (value === null || !Number.isFinite(value)) return '';
  const out = Number(value).toFixed(decimals);
  return value > 0 ? `+${out}` : out;
};

const formatAggregateValue = (value: number | null, analysisType: string, aggType: string, filterType?: string): string => {
  if (aggType === 'growth') {
    if (filterType && isHardnessFilter(filterType)) {
      if (value === null || !Number.isFinite(value)) return '';
      const out = `${(value * 100).toFixed(2)}%`;
      return value > 0 ? `+${out}` : out;
    }
    return formatSignedFixed(value, 2);
  }
  if (analysisType === '%Participants') {
    return formatPercent(value, getPercentParticipantsPrecision(filterType));
  }
  return formatByType(value, analysisType, filterType);
};

const shrinkWidthByCm = (width: string, deltaCm: number): string => {
  const raw = String(width || '').trim();
  const match = raw.match(/^(-?\d*\.?\d+)\s*cm$/i);
  if (!match) return width;
  const numeric = Number(match[1]);
  if (!Number.isFinite(numeric)) return width;
  const next = Math.max(0.6, numeric - deltaCm);
  return `${next}cm`;
};

const formatRowAggregateForDeviation = (value: number | null, filterType?: string): string => {
  if (value === null || !Number.isFinite(value)) return '';
  if (filterType && isHardnessFilter(filterType)) return `${(value * 100).toFixed(2)}%`;
  return `${Math.round(value)}`;
};

const aggHeaderLabel = (aggType: string): string => {
  if (aggType === 'growth') return 'Grth';
  if (aggType === 'range') return 'Rng';
  if (aggType === 'total') return 'Total';
  if (aggType === 'max') return 'Max';
  if (aggType === 'min') return 'Min';
  return 'Avg';
};

const analysisHeaderLabel = (analysisType: string): string => {
  if (analysisType === 'participants') return 'Participation';
  return analysisType;
};

const participantFilters = ['all', 'times', 'age', 'eventNumber', 'coeff', 'coeff_event', 'coeff_combined', 'volunteers', 'tourist', 'sTourist', '1time', 'clubs', 'pb', 'recentBest', 'regs', 'returners', 'eligible_time', 'unknown'];
const actualPercentFilters = ['all', 'volunteers', 'tourist', 'sTourist', '1time', 'clubs', 'pb', 'recentBest', 'regs', 'returners', 'eligible_time', 'unknown'];
const timesFilters = ['all', 'times', 'age', 'tourist', 'regs', 'sTourist', '1time', 'returners', 'clubs', 'unknown'];
const ageFilters = ['all', 'times', 'age', 'tourist', 'sTourist', '1time', 'clubs', 'pb', 'recentBest', 'regs', 'returners', 'eligible_time', 'unknown'];

const getAllowedAggTypes = (analysisType: string, filterType: string): string[] => {
  if (analysisType === '#Actual Deviation' || analysisType === '%Deviation') return ['avg', 'max', 'min'];
  if (analysisType === '%Participants') return ['avg', 'max', 'min', 'range', 'growth'];
  if (analysisType === '%Total') return ['avg', 'total', 'max', 'min', 'range'];
  if (analysisType === 'Times') return ['avg', 'max', 'min', 'growth'];
  if (analysisType === 'Age') return ['avg', 'max', 'min', 'range', 'growth'];
  if (filterType === 'eventNumber') return ['avg', 'max', 'min', 'range', 'growth'];
  if (analysisType === 'participants' && ['coeff', 'coeff_event', 'coeff_combined'].includes(filterType)) return ['avg', 'max', 'min', 'range', 'growth'];
  return ['avg', 'total', 'max', 'min', 'range', 'growth'];
};

const matchesCanonical = (option: string, canonical: string, normalizer: (value: string) => string) =>
  normalizer(String(option || '').trim()) === canonical;

const selectDisplayOption = (
  options: string[],
  canonical: string,
  normalizer: (value: string) => string
): string => {
  const found = options.find((option) => matchesCanonical(option, canonical, normalizer));
  return found || options[0] || canonical;
};

const EventAnalysisTest: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const byAliases = (ids: string[]): EventAnalysisLayoutElement | undefined => ids.map((id) => getEventAnalysisElementById(id)).find(Boolean);
  const typeLabelElement = byAliases(['eventAnalysis.type']);
  const typeSelectElement = byAliases(['eventAnalysis.typeSelect']);
  const filterLabelElement = byAliases(['eventAnalysis.filterLabel']);
  const filterSelectElement = byAliases(['eventAnalysis.filterSelect']);
  const periodLabelElement = byAliases(['eventAnalysis.periodLabel', 'eventAnalysis.windowLabel']);
  const periodSelectElement = byAliases(['eventAnalysis.periodSelect', 'eventAnalysis.windowSelect']);
  const aggLabelElement = byAliases(['eventAnalysis.aggLabel']);
  const aggSelectElement = byAliases(['eventAnalysis.aggSelect']);
  const cellAggLabelElement = byAliases(['eventAnalysis.cellAggLabel']);
  const cellAggSelectElement = byAliases(['eventAnalysis.cellAggSelect']);
  const timeAdjLabelElement = byAliases(['eventAnalysis.timeAdjLabel']);
  const timeAdjSelectElement = byAliases(['eventAnalysis.timeAdjSelect']);
  const viewSelectElement = byAliases(['eventAnalysis.viewSelect', 'eventAnalysis.tableViewSelect']);
  const expandSelectElement = byAliases(['eventAnalysis.expandSelect']);
  const plotPanelElement = byAliases(['eventAnalysis.plotPanel']);

  const allElements = getEventAnalysisElements();

  const readPersistedState = (): { controlValues?: Record<string, string>; sortKey?: string | null; sortDir?: 'asc' | 'desc'; showPlot?: boolean; isPlotExpanded?: boolean } | null => {
    try {
      const raw = sessionStorage.getItem(EVENT_ANALYSIS_TEST_STATE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return null;
      return parsed as { controlValues?: Record<string, string>; sortKey?: string | null; sortDir?: 'asc' | 'desc'; showPlot?: boolean; isPlotExpanded?: boolean };
    } catch {
      return null;
    }
  };

  const buildInitialControlValues = (): Record<string, string> => {
    const persisted = readPersistedState();
    const initial: Record<string, string> = {};
    allElements
      .filter((element) => element.type === 'select')
      .forEach((element) => {
        const options = (element.options || []).map((option) => String(option).trim()).filter(Boolean);
        const configured = String(element.name || '').trim();
        if (configured && options.includes(configured)) {
          initial[element.id] = configured;
        } else if (options.length > 0) {
          initial[element.id] = options[0];
        }

        const persistedValue = String(persisted?.controlValues?.[element.id] || '').trim();
        if (persistedValue && options.includes(persistedValue)) {
          initial[element.id] = persistedValue;
        }
      });
    return initial;
  };

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<any[]>([]);
  useGlobalWaitCursor(loading);

  const [controlValues, setControlValues] = useState<Record<string, string>>(() => buildInitialControlValues());
  const [sortKey, setSortKey] = useState<string | null>(() => {
    const persisted = readPersistedState();
    const next = persisted?.sortKey;
    return typeof next === 'string' && next.trim() ? next : 'col1';
  });
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>(() => {
    const persisted = readPersistedState();
    return persisted?.sortDir === 'desc' ? 'desc' : 'asc';
  });
  const [showPlot, setShowPlot] = useState<boolean>(() => {
    const persisted = readPersistedState();
    return Boolean(persisted?.showPlot);
  });
  const [isPlotExpanded, setIsPlotExpanded] = useState<boolean>(() => {
    const persisted = readPersistedState();
    return Boolean(persisted?.isPlotExpanded);
  });

  const [viewport, setViewport] = useState<EventAnalysisViewport>(() => getEventAnalysisViewportForWidth(window.innerWidth));
  const tableContainerRef = useRef<HTMLDivElement | null>(null);
  const tableRef = useRef<HTMLTableElement | null>(null);
  const plotChartRef = useRef<any>(null);
  const [horizontalScrollLeft, setHorizontalScrollLeft] = useState(0);
  const [horizontalScrollMax, setHorizontalScrollMax] = useState(0);
  const [row2StickyTopPx, setRow2StickyTopPx] = useState<number | null>(null);
  const [plotXZoom, setPlotXZoom] = useState<{ start: number; end: number }>({ start: 0, end: 100 });
  const [plotYZoom, setPlotYZoom] = useState<{ start: number; end: number }>({ start: 0, end: 100 });
  const [plotDisplayMode, setPlotDisplayMode] = useState<'per_event' | 'cumulative'>('per_event');
  const [plotSeriesColorMap, setPlotSeriesColorMap] = useState<Record<string, string>>({});
  const [plotSelectionOrder, setPlotSelectionOrder] = useState<string[]>([]);

  const headerAnchorHeight = '2.8cm';

  useEffect(() => {
    const onResize = () => setViewport(getEventAnalysisViewportForWidth(window.innerWidth));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    try {
      sessionStorage.setItem(
        EVENT_ANALYSIS_TEST_STATE_KEY,
        JSON.stringify({
          controlValues,
          sortKey,
          sortDir,
          showPlot,
          isPlotExpanded
        })
      );
    } catch {
      // ignore
    }
  }, [controlValues, isPlotExpanded, showPlot, sortDir, sortKey]);

  useEffect(() => {
    const state = location.state as { fromHamburgerMenu?: boolean; resetSortDefaults?: boolean } | null;
    if (!state?.fromHamburgerMenu || !state?.resetSortDefaults) return;
    setSortKey('col1');
    setSortDir('asc');
    setShowPlot(false);
    setIsPlotExpanded(false);
  }, [location.key, location.state]);

  const periodMode = ((): 'recent' | 'last50' | 'since-lockdown' | 'all' | 'Annual' | 'Qseason' | 'Mseason' => {
    const key = periodSelectElement?.id || 'eventAnalysis.periodSelect';
    const value = String(controlValues[key] || '').trim();
    return normalizePeriodMode(value);
  })();

  const baseAnalysisType = ((): 'participants' | '%Participants' | '%Total' | '%Deviation' | '#Actual Deviation' | 'Times' | 'Age' => {
    const key = typeSelectElement?.id || 'eventAnalysis.typeSelect';
    const value = String(controlValues[key] || '').trim();
    return normalizeAnalysisType(value);
  })();

  const filterType = ((): string => {
    const key = filterSelectElement?.id || 'eventAnalysis.filterSelect';
    const value = String(controlValues[key] || '').trim();
    return normalizeFilterType(value);
  })();

  const analysisType: 'participants' | '%Participants' | '%Total' | '%Deviation' | '#Actual Deviation' | 'Times' | 'Age' =
    filterType === 'times'
      ? 'Times'
      : filterType === 'age'
        ? 'Age'
        : baseAnalysisType;

  const aggType = ((): string => {
    const key = aggSelectElement?.id || 'eventAnalysis.aggSelect';
    const value = String(controlValues[key] || '').trim();
    return normalizeAggType(value);
  })();

  const cellAgg = ((): string => {
    const key = cellAggSelectElement?.id || 'eventAnalysis.cellAggSelect';
    const value = String(controlValues[key] || '').trim();
    return normalizeCellAgg(value);
  })();

  const timeAdj = ((): string => {
    const key = timeAdjSelectElement?.id || 'eventAnalysis.timeAdjSelect';
    const value = String(controlValues[key] || '').trim();
    return normalizeTimeAdj(value);
  })();

  const allowedFilters = useMemo(() => {
    if (analysisType === '%Participants') return actualPercentFilters;
    if (analysisType === 'Times') return timesFilters;
    if (analysisType === 'Age') return ageFilters;
    return participantFilters;
  }, [analysisType]);

  const allowedAnalysisTypes = useMemo<ReturnType<typeof normalizeAnalysisType>[]>(() => {
    if (filterType === 'times' || filterType === 'age') {
      return ['participants'];
    }
    return ['participants', '%Participants', '%Total', '%Deviation', '#Actual Deviation'];
  }, [filterType]);

  const allowedAggTypes = useMemo(() => getAllowedAggTypes(analysisType, filterType), [analysisType, filterType]);

  useEffect(() => {
    const updates: Record<string, string> = {};

    if (typeSelectElement && typeSelectElement.type === 'select') {
      const typeOptions = (typeSelectElement.options || []).map((option) => String(option).trim()).filter(Boolean);
      const currentCanonicalType = normalizeAnalysisType(controlValues[typeSelectElement.id] || '');
      if (!allowedAnalysisTypes.some((option) => option === currentCanonicalType) && typeOptions.length > 0) {
        updates[typeSelectElement.id] = selectDisplayOption(typeOptions, allowedAnalysisTypes[0], normalizeAnalysisType);
      }
    }

    if (filterSelectElement && filterSelectElement.type === 'select') {
      const filterOptions = (filterSelectElement.options || []).map((option) => String(option).trim()).filter(Boolean);
      const currentCanonicalFilter = normalizeFilterType(controlValues[filterSelectElement.id] || '');
      if (!allowedFilters.includes(currentCanonicalFilter) && filterOptions.length > 0) {
        const fallbackCanonical = allowedFilters[0];
        updates[filterSelectElement.id] = selectDisplayOption(filterOptions, fallbackCanonical, normalizeFilterType);
      }
    }

    if (aggSelectElement && aggSelectElement.type === 'select') {
      const aggOptions = (aggSelectElement.options || []).map((option) => String(option).trim()).filter(Boolean);
      const currentCanonicalAgg = normalizeAggType(controlValues[aggSelectElement.id] || '');
      if (!allowedAggTypes.includes(currentCanonicalAgg) && aggOptions.length > 0) {
        updates[aggSelectElement.id] = selectDisplayOption(aggOptions, allowedAggTypes[0], normalizeAggType);
      }
    }

    if (timeAdjSelectElement && timeAdjSelectElement.type === 'select' && analysisType !== 'Times') {
      const currentCanonicalAdj = normalizeTimeAdj(controlValues[timeAdjSelectElement.id] || '');
      if (currentCanonicalAdj !== 'none') {
        const options = (timeAdjSelectElement.options || []).map((option) => String(option).trim()).filter(Boolean);
        updates[timeAdjSelectElement.id] = selectDisplayOption(options, 'none', normalizeTimeAdj);
      }
    }

    if (cellAggSelectElement && cellAggSelectElement.type === 'select') {
      const allowedCellAgg = ['Annual', 'Qseason', 'Mseason'].includes(periodMode)
        ? ['avg', 'min', 'max']
        : (analysisType === 'Times' ? ['avg'] : ['single']);
      const currentCanonicalCellAgg = normalizeCellAgg(controlValues[cellAggSelectElement.id] || '');
      if (!allowedCellAgg.includes(currentCanonicalCellAgg)) {
        const options = (cellAggSelectElement.options || []).map((option) => String(option).trim()).filter(Boolean);
        updates[cellAggSelectElement.id] = selectDisplayOption(options, allowedCellAgg[0], normalizeCellAgg);
      }
    }

    if (Object.keys(updates).length > 0) {
      setControlValues((prev) => ({
        ...prev,
        ...updates
      }));
    }
  }, [
    aggSelectElement,
    allowedAnalysisTypes,
    allowedAggTypes,
    allowedFilters,
    analysisType,
    cellAggSelectElement,
    controlValues,
    filterSelectElement,
    periodMode,
    typeSelectElement,
    timeAdjSelectElement
  ]);

  const layoutConfig = useMemo(() => getEventAnalysisLayoutConfig(), []);
  const tableHeaderHelpEnabled = (layoutConfig as any)?.tableHelpTip?.enabled !== false;
  const tableHeaderHelpDelayMs = Number((layoutConfig as any)?.tableHelpTip?.delayMs) > 0
    ? Number((layoutConfig as any).tableHelpTip.delayMs)
    : 2000;
  const delayedHeaderHelp = useDelayedUnifiedHelp(tableHeaderHelpEnabled, tableHeaderHelpDelayMs);
  const tableModel = layoutConfig.tableModel;
  const tableColumns = layoutConfig.tableColumns ?? [];

  const col1Width = useMemo(() => {
    const modelWidth = tableModel?.col1?.[viewport]?.width;
    if (modelWidth) return viewport === 'mobile' ? shrinkWidthByCm(modelWidth, 0.2) : modelWidth;
    const col = tableColumns.find((column) => column.name === 'col1');
    const base = col?.[viewport]?.width || '4cm';
    return viewport === 'mobile' ? shrinkWidthByCm(base, 0.2) : base;
  }, [tableColumns, tableModel, viewport]);

  const col2Width = useMemo(() => {
    const modelWidth = tableModel?.col2?.[viewport]?.width;
    if (modelWidth) return viewport === 'mobile' ? shrinkWidthByCm(modelWidth, 0.2) : modelWidth;
    const col = tableColumns.find((column) => column.name === 'col2');
    const base = col?.[viewport]?.width || '2.5cm';
    return viewport === 'mobile' ? shrinkWidthByCm(base, 0.2) : base;
  }, [tableColumns, tableModel, viewport]);

  const col1TextAlign = useMemo(() => {
    const modelAlign = tableModel?.col1?.style?.textAlign;
    if (modelAlign) return modelAlign;
    const colAlign = tableColumns.find((column) => column.name === 'col1')?.style?.textAlign;
    return colAlign || 'left';
  }, [tableColumns, tableModel]);

  const col2TextAlign = useMemo(() => {
    const modelAlign = tableModel?.col2?.style?.textAlign;
    if (modelAlign) return modelAlign;
    return 'center';
  }, [tableModel]);

  const periodColumnWidth = useMemo(() => {
    const modelWidth = tableModel?.periodColumns?.[viewport]?.width;
    return modelWidth || '2.0cm';
  }, [tableModel, viewport]);

  const periodColumnTextAlign = useMemo(() => {
    const modelAlign = tableModel?.periodColumns?.style?.textAlign;
    return modelAlign || 'center';
  }, [tableModel]);

  const periodColumnTextColor = useMemo(() => {
    const modelColor = tableModel?.periodColumns?.style?.color;
    return modelColor || '#111111';
  }, [tableModel]);

  const periodColumnLinkStyle = useMemo(() => ({
    color: tableModel?.periodColumns?.link?.style?.color || periodColumnTextColor,
    textDecoration: tableModel?.periodColumns?.link?.style?.textDecoration || 'none'
  }), [periodColumnTextColor, tableModel]);

  const tableMaxVisibleWidth = useMemo(() => {
    const viewportCfg = tableModel?.viewport;
    if (!viewportCfg) return undefined;
    if (viewport === 'mobile') return viewportCfg.mobile?.maxVisibleWidth || viewportCfg.maxVisibleWidth;
    return viewportCfg.laptop?.maxVisibleWidth || viewportCfg.maxVisibleWidth;
  }, [tableModel, viewport]);

  const tableScrollSliderEnabled = Boolean(tableModel?.viewport?.slider?.enabled);

  useEffect(() => {
    const container = tableContainerRef.current;
    if (!container) return;

    const syncMetrics = () => {
      const max = Math.max(0, container.scrollWidth - container.clientWidth);
      setHorizontalScrollLeft(container.scrollLeft);
      setHorizontalScrollMax(max);
    };

    const onScroll = () => syncMetrics();
    syncMetrics();
    container.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', syncMetrics);

    return () => {
      container.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', syncMetrics);
    };
  }, [
    rows.length,
    periodMode,
    tableMaxVisibleWidth,
    periodColumnWidth,
    col1Width,
    col2Width,
    viewport
  ]);

  useEffect(() => {
    const table = tableRef.current;
    if (!table) return;

    const updateRow2Offset = () => {
      const row1 = table.tHead?.rows?.[0];
      if (!row1) return;
      const measured = Math.ceil(row1.getBoundingClientRect().height);
      if (Number.isFinite(measured) && measured > 0) {
        setRow2StickyTopPx(measured);
      }
    };

    updateRow2Offset();

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => updateRow2Offset());
      resizeObserver.observe(table);
      const row1 = table.tHead?.rows?.[0];
      if (row1) resizeObserver.observe(row1);
    }

    window.addEventListener('resize', updateRow2Offset);
    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener('resize', updateRow2Offset);
    };
  }, [
    viewport,
    periodMode,
    analysisType,
    filterType,
    aggType,
    cellAgg,
    timeAdj,
    rows.length
  ]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        let data: any[] = [];
        if (periodMode === 'all') {
          const result = await fetchAllResults();
          data = Array.isArray(result) ? result : [];
        } else if (periodMode === 'last50') {
          const result = await fetchResults(50);
          data = Array.isArray(result) ? result : [];
        } else if (periodMode === 'since-lockdown') {
          const result = await fetchResults('2021-07-24');
          data = Array.isArray(result) ? result : [];
        } else if (periodMode === 'Annual' || periodMode === 'Qseason' || periodMode === 'Mseason') {
          const result = await fetchAllResults();
          data = Array.isArray(result) ? result : [];
        } else {
          const result = await fetchResults();
          data = Array.isArray(result) ? result : [];
        }

        if (!cancelled) {
          setRows(data);
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(String(e?.message || e || 'Failed to fetch event analysis data'));
          setRows([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [periodMode]);

  const pivot = useMemo(() => {
    const coursePeriodValues: Record<string, Record<string, number[]>> = {};
    const participantValues: Record<string, Record<string, number[]>> = {};
    const coursePeriodHasEvent: Record<string, Record<string, boolean>> = {};
    const courseMeta: Record<string, { event_code: string; event_name: string }> = {};
    const coursePeriodMeta: Record<string, Record<string, { event_code: string; event_name: string; event_number: string; periodDate: string }>> = {};

    rows.forEach((row) => {
      const course = String(readRowValue(row, 'event_name') || readRowValue(row, 'event_code') || '').trim();
      if (!course) return;
      const periodKey = toPeriodKey(readRowValue(row, 'event_date'), periodMode);
      if (!periodKey) return;

      const rawMetric = getRawMetricValue(row, analysisType, filterType, timeAdj);
      const participants = parseNumeric(readRowValue(row, 'last_position'));
      const eventNumber = parseNumeric(readRowValue(row, 'event_number'));

      if (!coursePeriodValues[course]) coursePeriodValues[course] = {};
      if (!coursePeriodValues[course][periodKey]) coursePeriodValues[course][periodKey] = [];
      if (rawMetric !== null) coursePeriodValues[course][periodKey].push(rawMetric);

      if (!participantValues[course]) participantValues[course] = {};
      if (!participantValues[course][periodKey]) participantValues[course][periodKey] = [];
      if (participants !== null) participantValues[course][periodKey].push(participants);

      if (!coursePeriodHasEvent[course]) coursePeriodHasEvent[course] = {};
      if (!Object.prototype.hasOwnProperty.call(coursePeriodHasEvent[course], periodKey)) {
        coursePeriodHasEvent[course][periodKey] = false;
      }
      if (eventNumber !== null && Number.isFinite(eventNumber) && eventNumber > 0 && eventNumber <= 10000) {
        coursePeriodHasEvent[course][periodKey] = true;
      }

      if (!coursePeriodMeta[course]) coursePeriodMeta[course] = {};
      if (!coursePeriodMeta[course][periodKey]) {
        coursePeriodMeta[course][periodKey] = {
          event_code: String(readRowValue(row, 'event_code') || ''),
          event_name: String(readRowValue(row, 'event_name') || course),
          event_number: String(readRowValue(row, 'event_number') || ''),
          periodDate: periodMode === 'Annual' || periodMode === 'Qseason' || periodMode === 'Mseason'
            ? ''
            : periodKey
        };
      }

      if (!courseMeta[course]) {
        courseMeta[course] = {
          event_code: String(readRowValue(row, 'event_code') || ''),
          event_name: course
        };
      }
    });

    const periodKeys = sortPeriodKeys(
      Array.from(
        new Set(
          rows
            .map((row) => toPeriodKey(readRowValue(row, 'event_date'), periodMode))
            .filter(Boolean)
        )
      ),
      periodMode
    );

    const courses = Object.keys(coursePeriodValues);

    const pickCellValue = (values: number[]): number | null => {
      if (!values || values.length === 0) return null;
      if (cellAgg === 'avg') return aggregateValues(values, 'avg', analysisType);
      if (cellAgg === 'min') return aggregateValues(values, 'min', analysisType);
      if (cellAgg === 'max') return aggregateValues(values, 'max', analysisType);
      return values[values.length - 1];
    };

    const rawCell: Record<string, Record<string, number | null>> = {};
    const participantCell: Record<string, Record<string, number | null>> = {};

    courses.forEach((course) => {
      rawCell[course] = {};
      participantCell[course] = {};
      periodKeys.forEach((periodKey) => {
        rawCell[course][periodKey] = pickCellValue(coursePeriodValues[course]?.[periodKey] || []);
        participantCell[course][periodKey] = pickCellValue(participantValues[course]?.[periodKey] || []);
      });
    });

    const columnTotalsRaw: Record<string, number> = {};
    const columnAggRaw: Record<string, number | null> = {};
    periodKeys.forEach((periodKey) => {
      const vals = courses
        .map((course) => rawCell[course]?.[periodKey])
        .filter((value): value is number => value !== null && Number.isFinite(value));
      columnTotalsRaw[periodKey] = vals.reduce((sum, value) => sum + value, 0);
      columnAggRaw[periodKey] = aggregateValues(vals, aggType, analysisType);
    });

    const transformedCell: Record<string, Record<string, number | null>> = {};
    const rowBaselineAvg: Record<string, number | null> = {};

    courses.forEach((course) => {
      const vals = periodKeys
        .map((periodKey) => rawCell[course]?.[periodKey])
        .filter((value): value is number => value !== null && Number.isFinite(value));
      rowBaselineAvg[course] = vals.length ? (vals.reduce((sum, value) => sum + value, 0) / vals.length) : null;
    });

    courses.forEach((course) => {
      transformedCell[course] = {};
      periodKeys.forEach((periodKey) => {
        if (!['Annual', 'Qseason', 'Mseason'].includes(periodMode)) {
          const hasEvent = Boolean(coursePeriodHasEvent[course]?.[periodKey]);
          if (!hasEvent) {
            transformedCell[course][periodKey] = null;
            return;
          }
        }

        const base = rawCell[course]?.[periodKey];
        if (base === null || !Number.isFinite(base)) {
          transformedCell[course][periodKey] = null;
          return;
        }

        if (analysisType === '%Participants') {
          // Actual%: per-event percentage for this date (e.g. volunteers / participants).
          const denom = participantCell[course]?.[periodKey];
          transformedCell[course][periodKey] = denom && denom !== 0 ? (base / denom) * 100 : null;
          return;
        }

        if (analysisType === '%Total') {
          const denom = columnTotalsRaw[periodKey];
          transformedCell[course][periodKey] = denom !== 0 ? (base / denom) * 100 : null;
          return;
        }

        if (analysisType === '#Actual Deviation') {
          const baseline = rowBaselineAvg[course];
          transformedCell[course][periodKey] = baseline !== null ? base - baseline : null;
          return;
        }

        if (analysisType === '%Deviation') {
          const baseline = rowBaselineAvg[course];
          transformedCell[course][periodKey] = baseline && baseline !== 0 ? ((base - baseline) / baseline) * 100 : null;
          return;
        }

        transformedCell[course][periodKey] = base;
      });
    });

    const rowAggValue: Record<string, number | null> = {};
    courses.forEach((course) => {
      const vals = (analysisType === '%Deviation' || analysisType === '#Actual Deviation' ? periodKeys
        .map((periodKey) => rawCell[course]?.[periodKey])
        : periodKeys.map((periodKey) => transformedCell[course]?.[periodKey]))
        .filter((value): value is number => value !== null && Number.isFinite(value));
      rowAggValue[course] = aggregateValues(vals, aggType, analysisType);
    });

    const colAggValue: Record<string, number | null> = {};
    periodKeys.forEach((periodKey) => {
      const vals = courses
        .map((course) => transformedCell[course]?.[periodKey])
        .filter((value): value is number => value !== null && Number.isFinite(value));
      colAggValue[periodKey] = aggType === 'growth' ? null : aggregateValues(vals, aggType, analysisType);
    });

    return {
      courses,
      periodKeys,
      rawCell,
      coursePeriodHasEvent,
      transformedCell,
      rowAggValue,
      colAggValue,
      courseMeta,
      coursePeriodMeta
    };
  }, [rows, periodMode, analysisType, filterType, timeAdj, cellAgg, aggType]);

  const onSort = (key: string) => {
    const sortingEnabled = tableModel?.sort?.enabled !== false;
    if (!sortingEnabled) return;

    if (sortKey === key) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      return;
    }

    setSortKey(key);
    setSortDir('asc');
  };

  const sortingEnabled = tableModel?.sort?.enabled !== false;
  const dateHeadersSortable = sortingEnabled && tableModel?.periodColumns?.sortable !== false;
  const showInactiveSortArrows = tableModel?.sort?.showInactiveArrows !== false;
  const sortActiveColor = tableModel?.sort?.activeColor || '#111827';
  const sortInactiveColor = tableModel?.sort?.inactiveColor || '#9ca3af';

  const renderSortIndicator = (key: string) => {
    const isDateHeader = key.startsWith('period:');
    const isLeadHeader = key === 'col1' || key === 'col2';
    if (!sortingEnabled) return null;
    if (isDateHeader && !dateHeadersSortable) return null;
    if (!isDateHeader && !isLeadHeader) return null;
    const active = sortKey === key;
    if (!active && viewport === 'mobile') return null;
    if (!active && !showInactiveSortArrows) return null;

    const upColor = active && sortDir === 'asc' ? sortActiveColor : sortInactiveColor;
    const downColor = active && sortDir === 'desc' ? sortActiveColor : sortInactiveColor;

    return (
      <span className="ea-sort-indicator" aria-hidden="true">
        <span style={{ color: upColor }}>▲</span>
        <span style={{ color: downColor }}>▼</span>
      </span>
    );
  };

  const sortedCourses = useMemo(() => {
    const courses = [...pivot.courses];
    courses.sort((a, b) => {
      let av: number | string | null = null;
      let bv: number | string | null = null;

      if (!sortKey || sortKey === 'col1') {
        av = a;
        bv = b;
      } else if (sortKey === 'col2') {
        av = pivot.rowAggValue[a];
        bv = pivot.rowAggValue[b];
      } else if (sortKey.startsWith('period:')) {
        const periodKey = sortKey.slice('period:'.length);
        av = pivot.transformedCell[a]?.[periodKey] ?? null;
        bv = pivot.transformedCell[b]?.[periodKey] ?? null;
      }

      if (typeof av === 'number' || typeof bv === 'number') {
        const an = typeof av === 'number' ? av : Number.NEGATIVE_INFINITY;
        const bn = typeof bv === 'number' ? bv : Number.NEGATIVE_INFINITY;
        if (an < bn) return sortDir === 'asc' ? -1 : 1;
        if (an > bn) return sortDir === 'asc' ? 1 : -1;
        return 0;
      }

      const as = String(av ?? '').toLowerCase();
      const bs = String(bv ?? '').toLowerCase();
      if (as < bs) return sortDir === 'asc' ? -1 : 1;
      if (as > bs) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

    return courses;
  }, [pivot, sortDir, sortKey]);

  const clampZoom = (next: { start: number; end: number }) => {
    const start = Math.max(0, Math.min(100, next.start));
    const end = Math.max(0, Math.min(100, next.end));
    if (end < start) {
      return { start: end, end: start };
    }
    return { start, end };
  };

  const handlePlotLegendToggle = (seriesName: string) => {
    setPlotSeriesColorMap((prev) => {
      const next = { ...prev };
      if (next[seriesName]) {
        delete next[seriesName];
        setPlotSelectionOrder((current) => current.filter((name) => name !== seriesName));
        return next;
      }

      if (Object.keys(next).length >= MAX_PLOT_HIGHLIGHTED_SERIES) {
        return next;
      }

      const used = new Set(Object.values(next));
      const fallback = PLOT_COLOR_PALETTE[Object.keys(next).length % PLOT_COLOR_PALETTE.length];
      const color = PLOT_COLOR_PALETTE.find((candidate) => !used.has(candidate)) || fallback;
      next[seriesName] = color;
      setPlotSelectionOrder((current) => [...current.filter((name) => name !== seriesName), seriesName]);
      return next;
    });
  };

  const handlePlotDataZoom = (params: any) => {
    const events = Array.isArray(params?.batch) && params.batch.length > 0 ? params.batch : [params];
    events.forEach((event: any) => {
      if (!event) return;
      const start = Number(event.start);
      const end = Number(event.end);
      if (!Number.isFinite(start) || !Number.isFinite(end)) return;
      const axisIndex = Number(event.xAxisIndex ?? event.yAxisIndex ?? -1);
      if (axisIndex === 0 && event.xAxisIndex !== undefined) {
        setPlotXZoom(clampZoom({ start, end }));
      }
      if (axisIndex === 0 && event.yAxisIndex !== undefined) {
        setPlotYZoom(clampZoom({ start, end }));
      }
    });
  };

  const zoomAxisIn = (axis: 'x' | 'y') => {
    const current = axis === 'x' ? plotXZoom : plotYZoom;
    const width = Math.max(8, (current.end - current.start) * 0.8);
    const center = (current.start + current.end) / 2;
    const next = clampZoom({ start: center - width / 2, end: center + width / 2 });
    if (axis === 'x') setPlotXZoom(next);
    else setPlotYZoom(next);
  };

  const zoomAxisOut = (axis: 'x' | 'y') => {
    const current = axis === 'x' ? plotXZoom : plotYZoom;
    const width = Math.min(100, Math.max(12, (current.end - current.start) * 1.25));
    const center = (current.start + current.end) / 2;
    const next = clampZoom({ start: center - width / 2, end: center + width / 2 });
    if (axis === 'x') setPlotXZoom(next);
    else setPlotYZoom(next);
  };

  const shiftAxisLeft = (axis: 'x' | 'y') => {
    const current = axis === 'x' ? plotXZoom : plotYZoom;
    const width = current.end - current.start;
    const step = Math.max(2, width * 0.15);
    const next = clampZoom({ start: current.start - step, end: current.end - step });
    if (axis === 'x') setPlotXZoom(next);
    else setPlotYZoom(next);
  };

  const shiftAxisRight = (axis: 'x' | 'y') => {
    const current = axis === 'x' ? plotXZoom : plotYZoom;
    const width = current.end - current.start;
    const step = Math.max(2, width * 0.15);
    const next = clampZoom({ start: current.start + step, end: current.end + step });
    if (axis === 'x') setPlotXZoom(next);
    else setPlotYZoom(next);
  };

  const shiftYAxisUp = () => shiftAxisLeft('y');
  const shiftYAxisDown = () => shiftAxisRight('y');
  const resetPlotZoom = () => {
    setPlotXZoom({ start: 0, end: 100 });
    setPlotYZoom({ start: 0, end: 100 });
  };

  const isLaptopLayout = viewport === 'laptop';
  const basePlotSpec = plotPanelElement?.[viewport];
  const expandedPlotSpec = viewport === 'mobile' ? plotPanelElement?.mobileExpanded : plotPanelElement?.laptopExpanded;
  const activePlotSpec = (isPlotExpanded && expandedPlotSpec)
    ? { ...basePlotSpec, ...expandedPlotSpec }
    : basePlotSpec;
  const plotChartHeight = activePlotSpec?.height || plotPanelElement?.style?.height || (isLaptopLayout ? '13.3cm' : '10.3cm');
  const plotChartMinWidth = (isPlotExpanded && activePlotSpec?.width)
    ? String(activePlotSpec.width)
    : (isLaptopLayout ? '18cm' : '10cm');

  const plotOption = useMemo(() => {
    const lineColor = '#c4c7cf';
    const axisPeriodKeys = (() => {
      if (periodMode === 'Annual') {
        return [...pivot.periodKeys].sort((a, b) => Number(a) - Number(b));
      }
      if (periodMode === 'Mseason') {
        return [...pivot.periodKeys].sort((a, b) => monthNames.indexOf(String(a)) - monthNames.indexOf(String(b)));
      }
      if (periodMode === 'Qseason') {
        return [...pivot.periodKeys].sort((a, b) => quarterNames.indexOf(String(a)) - quarterNames.indexOf(String(b)));
      }
      return [...pivot.periodKeys].sort((a, b) => {
        const ad = parseEventDate(a);
        const bd = parseEventDate(b);
        if (!ad || !bd) return String(a).localeCompare(String(b));
        return ad.getTime() - bd.getTime();
      });
    })();
    const xLabels = axisPeriodKeys.map((periodKey) => formatPeriodHeader(periodKey, periodMode));
    const monthTickIndices = (() => {
      if (['Annual', 'Mseason', 'Qseason'].includes(periodMode)) {
        return xLabels.map((_label, index) => index);
      }

      const firstIndexPerMonth = new Map<string, number>();
      axisPeriodKeys.forEach((periodKey, index) => {
        const parsed = parseEventDate(periodKey);
        if (!parsed) return;
        const monthKey = `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}`;
        if (!firstIndexPerMonth.has(monthKey)) {
          firstIndexPerMonth.set(monthKey, index);
        }
      });

      const monthStartIndices = Array.from(firstIndexPerMonth.values()).sort((a, b) => a - b);

      if (monthStartIndices.length === 0) {
        return [0];
      }

      const targetCount = Math.max(3, Math.min(12, monthStartIndices.length));
      if (monthStartIndices.length <= targetCount) {
        return monthStartIndices;
      }

      const sampled: number[] = [];
      const step = (monthStartIndices.length - 1) / (targetCount - 1);
      for (let i = 0; i < targetCount; i += 1) {
        sampled.push(monthStartIndices[Math.round(i * step)]);
      }
      return Array.from(new Set(sampled)).sort((a, b) => a - b);
    })();

    const monthTickIndexSet = new Set<number>(monthTickIndices);
    const monthLabelByIndex = new Map<number, string>();
    monthTickIndices.forEach((index) => {
      const parsed = parseEventDate(String(axisPeriodKeys[index] || ''));
      if (parsed) {
        monthLabelByIndex.set(index, parsed.toLocaleDateString(undefined, { month: 'short', year: '2-digit' }));
      } else {
        monthLabelByIndex.set(index, String(xLabels[index] || ''));
      }
    });
    const plotRows = sortedCourses
      .map((course) => {
        const label = String(course);
        const data = axisPeriodKeys.map((periodKey) => {
          const value = pivot.transformedCell[course]?.[periodKey] ?? null;
          if (value === null || !Number.isFinite(value)) return null;
          return Number(value.toFixed(3));
        });
        const hasData = data.some((value) => value !== null);
        if (!hasData) return null;
        return { code: String(course), label, data };
      })
      .filter((entry): entry is { code: string; label: string; data: Array<number | null> } => entry !== null);

    const lineSeries = plotRows.map((row) => {
      const selectedColor = plotSeriesColorMap[row.label];
      const activeColor = selectedColor || lineColor;
      const priorityIndex = plotSelectionOrder.indexOf(row.label);
      const isSelectedSeries = priorityIndex >= 0;
      return {
        name: row.label,
        type: 'line',
        connectNulls: false,
        symbol: 'circle',
        symbolSize: 4,
        showSymbol: true,
        lineStyle: { color: activeColor, width: isSelectedSeries ? 1.6 : 1 },
        itemStyle: { color: activeColor, borderColor: activeColor, borderWidth: 1 },
        emphasis: { disabled: true },
        zlevel: isSelectedSeries ? 1 : 0,
        z: isSelectedSeries ? (20 + priorityIndex) : 1,
        data: row.data
      };
    });

    const getLastNonNull = (arr: Array<number | null>) => {
      for (let index = arr.length - 1; index >= 0; index -= 1) {
        const value = arr[index];
        if (typeof value === 'number' && Number.isFinite(value)) {
          return value;
        }
      }
      return Number.NEGATIVE_INFINITY;
    };

    const cumulativeRows = [...plotRows].sort((a, b) => getLastNonNull(b.data) - getLastNonNull(a.data));
    const cumulativeSeries = cumulativeRows.map((row) => {
      const selectedColor = plotSeriesColorMap[row.label];
      const isSelectedSeries = Boolean(selectedColor);
      const priorityIndex = plotSelectionOrder.indexOf(row.label);
      return {
        name: row.label,
        type: 'bar',
        stack: 'total',
        barMaxWidth: 22,
        itemStyle: {
          color: selectedColor || '#d1d5db',
          borderColor: selectedColor || '#9ca3af',
          borderWidth: 1
        },
        emphasis: { disabled: true },
        zlevel: isSelectedSeries ? 1 : 0,
        z: isSelectedSeries ? (20 + Math.max(priorityIndex, 0)) : 1,
        data: row.data
      };
    });

    const activeSeries = plotDisplayMode === 'cumulative' ? cumulativeSeries : lineSeries;

    return {
      animation: false,
      grid: { left: 0, right: 20, top: 10, bottom: isLaptopLayout ? 140 : 150 },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: plotDisplayMode === 'cumulative' ? 'shadow' : 'line' },
        confine: true,
        textStyle: { fontSize: 11, lineHeight: 14 },
        formatter: (params: any) => {
          const rows = Array.isArray(params) ? params : [params];
          if (!rows.length) return '';

          const toNumeric = (value: any): number => {
            if (Array.isArray(value)) {
              const last = value[value.length - 1];
              const parsed = Number(last);
              return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY;
            }
            const parsed = Number(value);
            return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY;
          };

          const sorted = [...rows].sort((a, b) => toNumeric(b?.value) - toNumeric(a?.value));
          const header = String(sorted[0]?.axisValueLabel ?? sorted[0]?.name ?? '');

          const lines = sorted.map((item: any) => {
            const raw = toNumeric(item?.value);
            const displayValue = Number.isFinite(raw)
              ? formatByType(raw, analysisType, filterType)
              : '-';
            return `${item?.marker || ''}${String(item?.seriesName || '')}: ${displayValue}`;
          });

          return [header, ...lines].join('<br/>');
        }
      },
      xAxis: {
        type: 'category',
        data: xLabels,
        boundaryGap: plotDisplayMode === 'cumulative',
        name: 'Date',
        nameTextStyle: { fontWeight: 'bold' },
        nameLocation: 'middle',
        nameGap: 26,
        axisLine: { lineStyle: { color: '#9ca3af', width: 1 } },
        axisTick: {
          alignWithLabel: true,
          interval: (index: number) => monthTickIndexSet.has(index)
        },
        splitLine: { show: true, lineStyle: { color: '#d1d5db', width: 0.7 } },
        axisLabel: {
          color: '#4b5563',
          fontSize: 11,
          rotate: 0,
          interval: (index: number) => monthTickIndexSet.has(index),
          formatter: (_value: string, index: number) => monthLabelByIndex.get(index) || ''
        }
      },
      yAxis: {
        type: 'value',
        name: String(aggHeaderLabel(aggType) || 'Value'),
        nameLocation: 'middle',
        nameGap: 42,
        axisLabel: { color: '#4b5563', fontSize: 11 },
        splitLine: { lineStyle: { color: '#e5e7eb' } }
      },
      legend: {
        show: true,
        type: 'plain',
        bottom: isLaptopLayout ? 0 : -23,
        left: isLaptopLayout ? 56 : 0,
        right: 16,
        itemWidth: 10,
        itemHeight: isLaptopLayout ? 6 : 5,
        itemGap: isLaptopLayout ? 6 : 4,
        selected: Object.fromEntries(activeSeries.map((s: any) => [s.name, true])),
        textStyle: { fontSize: 12, color: '#6b7280' }
      },
      dataZoom: [
        { id: 'xZoom', type: 'inside', xAxisIndex: 0, filterMode: 'none', start: plotXZoom.start, end: plotXZoom.end },
        { id: 'yZoom', type: 'inside', yAxisIndex: 0, filterMode: 'none', start: plotYZoom.start, end: plotYZoom.end }
      ],
      series: activeSeries
    };
  }, [aggType, isLaptopLayout, periodMode, pivot.periodKeys, pivot.transformedCell, plotDisplayMode, plotSelectionOrder, plotSeriesColorMap, plotXZoom.end, plotXZoom.start, plotYZoom.end, plotYZoom.start, sortedCourses]);

  const leftArrowElement = getEventAnalysisElementById('eventAnalysis.leftArrow');
  const pLeftArrow = getEventAnalysisElementPlacement('eventAnalysis.leftArrow', viewport);
  const pTitle = getEventAnalysisElementPlacement('eventAnalysis.title', viewport);
  const pTypeLabel = getEventAnalysisElementPlacement(typeLabelElement?.id || 'eventAnalysis.type', viewport);
  const pTypeSelect = getEventAnalysisElementPlacement(typeSelectElement?.id || 'eventAnalysis.typeSelect', viewport);
  const pFilterLabel = getEventAnalysisElementPlacement(filterLabelElement?.id || 'eventAnalysis.filterLabel', viewport);
  const pFilterSelect = getEventAnalysisElementPlacement(filterSelectElement?.id || 'eventAnalysis.filterSelect', viewport);
  const pPeriodLabel = getEventAnalysisElementPlacement(periodLabelElement?.id || 'eventAnalysis.periodLabel', viewport);
  const pPeriodSelect = getEventAnalysisElementPlacement(periodSelectElement?.id || 'eventAnalysis.periodSelect', viewport);
  const pAggLabel = getEventAnalysisElementPlacement(aggLabelElement?.id || 'eventAnalysis.aggLabel', viewport);
  const pAggSelect = getEventAnalysisElementPlacement(aggSelectElement?.id || 'eventAnalysis.aggSelect', viewport);
  const pCellAggLabel = getEventAnalysisElementPlacement(cellAggLabelElement?.id || 'eventAnalysis.cellAggLabel', viewport);
  const pCellAggSelect = getEventAnalysisElementPlacement(cellAggSelectElement?.id || 'eventAnalysis.cellAggSelect', viewport);
  const pTimeAdjLabel = getEventAnalysisElementPlacement(timeAdjLabelElement?.id || 'eventAnalysis.timeAdjLabel', viewport);
  const pTimeAdjSelect = getEventAnalysisElementPlacement(timeAdjSelectElement?.id || 'eventAnalysis.timeAdjSelect', viewport);
  const statusMessageElement = getEventAnalysisElementById('eventAnalysis.statusMessage');
  const pStatusMessage = getEventAnalysisElementPlacement('eventAnalysis.statusMessage', viewport);
  const pViewSelect = getEventAnalysisElementPlacement(viewSelectElement?.id || 'eventAnalysis.viewSelect', viewport);
  const pExpandSelect = getEventAnalysisElementPlacement(expandSelectElement?.id || 'eventAnalysis.expandSelect', viewport);
  const pPlotPanel = getEventAnalysisElementPlacement(plotPanelElement?.id || 'eventAnalysis.plotPanel', viewport);
  const pTableCorner = getEventAnalysisElementPlacement('eventAnalysis.table.corner', viewport);
  const pTableRow2 = getEventAnalysisElementPlacement('eventAnalysis.table.row2', viewport);
  const tableRow1Element = getEventAnalysisElementById('eventAnalysis.table.row1');
  const tableRow2Element = getEventAnalysisElementById('eventAnalysis.table.row2');
  const tableRow1Sticky = tableRow1Element?.sticky !== false;
  const tableRow2Sticky = tableRow2Element?.sticky !== false;
  const stickyLeadCol1 = tableModel?.sticky?.leadingColumns?.includes('col1') ?? true;
  const stickyLeadCol2 = tableModel?.sticky?.leadingColumns?.includes('col2') ?? true;
  const titleElement = getEventAnalysisElementById('eventAnalysis.title');

  const renderConfigLabel = (
    element: EventAnalysisLayoutElement | undefined,
    placement: ReturnType<typeof getEventAnalysisElementPlacement>,
    fallbackName?: string,
    fallbackHelpTarget?: string
  ) => {
    if (!element && !fallbackName) return null;
    const labelName = element?.name || fallbackName || '';
    const labelStyle = element?.style;
    const helpTitleBase = String(labelName).replace(/:\s*$/, '');

    return (
      <div
        style={{
          position: 'absolute',
          left: placement?.x,
          top: placement?.y,
          margin: 0,
          padding: 0,
          whiteSpace: 'nowrap',
          zIndex: 2
        }}
      >
        {element?.helpLabel ? (
          <span className="help-tooltip" style={{ display: 'inline-flex' }}>
            <button
              type="button"
              className="help-trigger help-trigger-label"
              onClick={(event) => {
                const rect = (event.currentTarget as HTMLButtonElement).getBoundingClientRect();
                requestUnifiedHelp(element?.helpTarget || fallbackHelpTarget || 'top', {
                  x: rect.left,
                  y: rect.bottom
                });
              }}
              title={`${helpTitleBase} help`}
              aria-label={`${helpTitleBase} help`}
            >
              <span
                className="help-trigger-text"
                style={{
                  lineHeight: labelStyle?.lineHeight ?? 1.1,
                  fontWeight: labelStyle?.fontWeight ?? 700,
                  fontSize: labelStyle?.fontSize,
                  color: labelStyle?.color ?? '#111827'
                }}
              >
                {labelName}
              </span>
            </button>
          </span>
        ) : (
          <label
            style={{
              margin: 0,
              padding: 0,
              lineHeight: labelStyle?.lineHeight ?? 1.1,
              fontWeight: labelStyle?.fontWeight ?? 700,
              fontSize: labelStyle?.fontSize,
              color: labelStyle?.color ?? '#111827'
            }}
          >
            {labelName}
          </label>
        )}
      </div>
    );
  };

  const renderConfigSelect = (
    element: EventAnalysisLayoutElement | undefined,
    placement: ReturnType<typeof getEventAnalysisElementPlacement>,
    fallbackOptions: string[] = [],
    optionsOverride?: string[],
    disabled?: boolean
  ) => {
    if (!element || element.type !== 'select') return null;
    const options = ((optionsOverride || element.options || fallbackOptions) || []).map((option) => String(option).trim()).filter(Boolean);
    if (options.length === 0) return null;
    const selected = String(controlValues[element.id] || '').trim();
    const currentValue = options.includes(selected) ? selected : options[0];

    return (
      <select
        value={currentValue}
        onChange={(event) => {
          const value = String(event.target.value || '').trim();
          setSortKey('col1');
          setSortDir('asc');
          setControlValues((prev) => ({
            ...prev,
            [element.id]: value
          }));
        }}
        disabled={disabled}
        style={{
          position: 'absolute',
          left: placement?.x,
          top: placement?.y,
          width: placement?.width,
          opacity: disabled ? 0.65 : 1,
          cursor: disabled ? 'not-allowed' : 'pointer'
        }}
      >
        {options.map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
    );
  };

  const onCourseClick = (course: string) => {
    const linkCfg = tableModel?.col1?.link;
    if (!linkCfg?.enabled || !linkCfg?.target) return;
    const meta = pivot.courseMeta[course];
    const params = new URLSearchParams();
    const eventName = String(meta?.event_name || course || '');
    const eventCode = String(meta?.event_code || '');
    if (eventCode) params.set('event_code', eventCode);
    if (eventName) params.set('event_name', eventName);
    const targetUrl = params.toString() ? `${linkCfg.target}?${params.toString()}` : linkCfg.target;

    if (linkCfg.navMode === 'stack') {
      navigateWithNavStack(navigate, location, targetUrl, {
        state: {
          eventCode,
          eventName,
          from: 'results_test',
          returnTo: {
            pathname: location.pathname,
            search: location.search
          }
        }
      });
      return;
    }

    navigate(targetUrl);
  };

  const onPeriodCellClick = (course: string, periodKey: string) => {
    const linkCfg = tableModel?.periodColumns?.link;
    if (!linkCfg?.enabled || !linkCfg?.target) return;
    if (periodMode === 'Annual' || periodMode === 'Qseason' || periodMode === 'Mseason') return;

    const meta = pivot.coursePeriodMeta[course]?.[periodKey] || {
      event_code: pivot.courseMeta[course]?.event_code || '',
      event_name: pivot.courseMeta[course]?.event_name || course,
      event_number: '',
      periodDate: periodKey
    };

    const params = new URLSearchParams();
    if (meta.periodDate) params.set('date', meta.periodDate);
    if (meta.event_code) params.set('event_code', meta.event_code);
    if (meta.event_name) params.set('event_name', meta.event_name);
    if (meta.event_number) params.set('event_number', meta.event_number);
    const targetUrl = params.toString() ? `${linkCfg.target}?${params.toString()}` : linkCfg.target;

    if (linkCfg.navMode === 'stack') {
      navigateWithNavStack(navigate, location, targetUrl, {
        state: {
          eventCode: meta.event_code || undefined,
          eventName: meta.event_name || undefined,
          from: 'results_test',
          returnTo: {
            pathname: location.pathname,
            search: location.search
          }
        }
      });
      return;
    }
    navigate(targetUrl);
  };

  const status = loading
    ? 'Loading event analysis…'
    : (
      error
      || (['Annual', 'Qseason', 'Mseason'].includes(periodMode)
        ? 'cannot click a cell to see event details for aggregation periods'
        : (statusMessageElement?.name || ''))
    );

  return (
    <div className="page-content">
      <div className="races-header" style={{ marginLeft: 0 }}>
        <div className="races-header-text" style={{ width: '100%' }}>
          <div style={{ position: 'relative', minHeight: headerAnchorHeight }}>
            {leftArrowElement ? (
              <button
                type="button"
                onClick={() => {
                  const popped = navigateBackWithNavStack(navigate, location.pathname);
                  if (!popped) {
                    navigate('/');
                  }
                }}
                title="Back to Home"
                aria-label="Back to Home"
                style={{
                  position: 'absolute',
                  left: pLeftArrow?.x ?? '0cm',
                  top: pLeftArrow?.y ?? '0cm',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '30px',
                  height: '30px',
                  margin: 0,
                  border: '1px solid rgba(0,0,0,1)',
                  background: 'white',
                  color: '#333',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '1.05rem',
                  lineHeight: 1,
                  fontWeight: 1000,
                  transform: 'none'
                }}
              >
                ←
              </button>
            ) : null}

            {typeLabelElement?.type === 'label' ? renderConfigLabel(typeLabelElement, pTypeLabel, 'Type:', 'control-eventAnalysis-type') : null}
            {typeLabelElement?.type === 'select' ? renderConfigSelect(typeLabelElement, pTypeLabel) : null}
            {renderConfigSelect(
              typeSelectElement,
              pTypeSelect,
              ['Actual'],
              typeSelectElement?.options?.filter((option) => {
                const normalized = normalizeAnalysisType(String(option));
                return allowedAnalysisTypes.some((allowed) => allowed === normalized);
              })
            )}

            {titleElement ? (
              <div
                className="races-header-title"
                style={{
                  position: 'absolute',
                  left: pTitle?.x,
                  top: pTitle?.y,
                  paddingLeft: 0,
                  margin: 0,
                  transform: 'none',
                  fontWeight: titleElement.style?.fontWeight ?? 700,
                  fontSize: titleElement.style?.fontSize,
                  color: titleElement.style?.color,
                  lineHeight: titleElement.style?.lineHeight
                }}
              >
                {titleElement.name}
              </div>
            ) : null}

            {filterLabelElement ? renderConfigLabel(filterLabelElement, pFilterLabel, 'Filter', 'control-type') : null}
            {renderConfigSelect(
              filterSelectElement,
              pFilterSelect,
              ['All Participants', 'Returners'],
              filterSelectElement?.options?.filter((option) => allowedFilters.includes(normalizeFilterType(String(option))))
            )}

            {periodLabelElement ? renderConfigLabel(periodLabelElement, pPeriodLabel, 'Period', 'control-period') : null}
            {renderConfigSelect(periodSelectElement, pPeriodSelect, ['Recent Events', 'Last 50 Events', 'Since Lockdown', 'All Events'])}

            {aggLabelElement ? renderConfigLabel(aggLabelElement, pAggLabel, 'Agg', 'control-agg') : null}
            {renderConfigSelect(
              aggSelectElement,
              pAggSelect,
              ['Average', 'Total', 'Maximum', 'Minimum', 'Range', 'Growth'],
              aggSelectElement?.options?.filter((option) => allowedAggTypes.includes(normalizeAggType(String(option))))
            )}

            {cellAggLabelElement ? renderConfigLabel(cellAggLabelElement, pCellAggLabel, 'Cell Agg', 'control-cellagg') : null}
            {renderConfigSelect(cellAggSelectElement, pCellAggSelect, ['Single Value', 'Average'])}

            {timeAdjLabelElement ? renderConfigLabel(timeAdjLabelElement, pTimeAdjLabel, 'Time Adj', 'control-timeadj') : null}
            {renderConfigSelect(timeAdjSelectElement, pTimeAdjSelect, ['No Adjustment', 'Hardness Adjusted', 'Age Adjusted', 'Hardness and Age Adjusted'], undefined, analysisType !== 'Times')}

            {viewSelectElement?.type === 'button' ? (
              <button
                type="button"
                onClick={() => setShowPlot((prev) => !prev)}
                title={`Show ${showPlot ? 'table' : 'plot'}`}
                aria-label={`Show ${showPlot ? 'table' : 'plot'}`}
                style={{
                  position: 'absolute',
                  left: pViewSelect?.x,
                  top: pViewSelect?.y,
                  width: pViewSelect?.width || viewSelectElement?.style?.width || '1cm',
                  height: pViewSelect?.height || viewSelectElement?.style?.height || '1cm',
                  border: '1px solid #777',
                  borderRadius: '6px',
                  background: '#fff',
                  cursor: 'pointer',
                  fontSize: viewSelectElement?.style?.fontSize || '0.5rem',
                  fontWeight: viewSelectElement?.style?.fontWeight || 700,
                  lineHeight: Number(viewSelectElement?.style?.lineHeight || 1),
                  padding: 0
                }}
              >
                {showPlot ? 'Table' : (viewSelectElement?.name || 'Plot')}
              </button>
            ) : null}

            {expandSelectElement?.type === 'button' && showPlot ? (
              <button
                type="button"
                onClick={() => setIsPlotExpanded((prev) => !prev)}
                title={isPlotExpanded ? 'Reduce plot panel' : 'Expand plot panel'}
                aria-label={isPlotExpanded ? 'Reduce plot panel' : 'Expand plot panel'}
                style={{
                  position: 'absolute',
                  left: pExpandSelect?.x,
                  top: pExpandSelect?.y,
                  width: pExpandSelect?.width || expandSelectElement?.style?.width || '1.8cm',
                  height: pExpandSelect?.height || expandSelectElement?.style?.height || '0.7cm',
                  border: '1px solid #777',
                  borderRadius: '6px',
                  background: '#fff',
                  cursor: 'pointer',
                  fontSize: expandSelectElement?.style?.fontSize || '0.5rem',
                  fontWeight: expandSelectElement?.style?.fontWeight || 700,
                  lineHeight: Number(expandSelectElement?.style?.lineHeight || 1),
                  padding: 0
                }}
              >
                {isPlotExpanded ? 'Reduce' : (expandSelectElement?.name || 'Expand')}
              </button>
            ) : null}

            {status ? (
              <div
                style={{
                  position: 'absolute',
                  left: pStatusMessage?.x,
                  top: pStatusMessage?.y,
                  width: pStatusMessage?.width,
                  margin: 0,
                  pointerEvents: 'none'
                }}
              >
                <div
                  style={{
                    fontSize: statusMessageElement?.style?.fontSize,
                    fontStyle: statusMessageElement?.style?.fontStyle,
                    fontWeight: statusMessageElement?.style?.fontWeight,
                    color: statusMessageElement?.style?.color,
                    lineHeight: statusMessageElement?.style?.lineHeight,
                    textAlign: statusMessageElement?.style?.textAlign as any
                  }}
                >
                  {status}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {showPlot ? (
        <div
          className="eventanalysis-plot-container"
          style={{
            marginTop: activePlotSpec?.y ? `calc(${activePlotSpec.y} - ${headerAnchorHeight})` : (pTableCorner?.y ? `calc(${pTableCorner.y} - ${headerAnchorHeight})` : '0.1cm'),
            marginLeft: activePlotSpec?.x ?? pTableCorner?.x ?? undefined,
            ['--ea-max-visible-width' as any]: activePlotSpec?.width || tableMaxVisibleWidth || '100%'
          }}
        >
          {sortedCourses.length === 0 || pivot.periodKeys.length === 0 ? (
            <div style={{ color: '#6b7280', fontSize: '0.9rem' }}>No data to plot.</div>
          ) : (
            <div
              style={{
                width: '100%',
                margin: '0',
                marginTop: '-0.2cm',
                border: 'none',
                borderRadius: '10px',
                background: '#fff',
                overflow: 'hidden',
                boxShadow: 'none'
              }}
            >
              <div
                style={{
                  background: '#e5e7eb',
                  borderBottom: '1px solid #d1d5db',
                  padding: '0.35rem 0.0rem',
                  fontSize: '1.05rem',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.35rem'
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    lineHeight: 1.15
                  }}
                >
                  <span>Event statistics comparison</span>
                  <span style={{ fontSize: '0.68rem', fontWeight: 500 }}>
                    Legend courses can be selected to highlight
                  </span>
                </div>
                <button
                  type="button"
                  className="top-bar-help-btn"
                  aria-label="Event statistics comparison help"
                  title="Event statistics comparison help"
                  onClick={(event) => {
                    const rect = (event.currentTarget as HTMLButtonElement).getBoundingClientRect();
                    requestUnifiedHelp('section-event-stats-comparison', {
                      x: rect.left,
                      y: rect.bottom
                    });
                  }}
                >
                  📖
                </button>
              </div>
              <div style={{ padding: '0.6rem 0.8rem 0.8rem 0.8rem' }}>
                <ReactECharts
                  ref={plotChartRef}
                  option={plotOption as any}
                  notMerge
                  lazyUpdate
                  onEvents={{
                    datazoom: handlePlotDataZoom,
                    legendselectchanged: (params: any) => {
                      const name = String(params?.name || '');
                      if (name) {
                        handlePlotLegendToggle(name);
                      }
                    }
                  }}
                  style={{ width: '100%', minWidth: plotChartMinWidth, height: plotChartHeight }}
                />
                <div
                  style={{
                    marginTop: isLaptopLayout ? '0.45rem' : 'calc(0.45rem + 0.0cm)',
                    display: 'flex',
                    flexDirection: isLaptopLayout ? 'row' : 'column',
                    alignItems: 'flex-start',
                    gap: isLaptopLayout ? '0.45rem' : '0.3rem',
                    overflow: 'hidden'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: isLaptopLayout ? '0.45rem' : '0.25rem', flexWrap: 'nowrap', overflow: 'hidden' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: isLaptopLayout ? '0.22rem' : '0.15rem', border: '1px solid #9ca3af', borderRadius: '6px', background: '#f9fafb', padding: isLaptopLayout ? '0.12rem 0.2rem' : '0.1rem 0.15rem' }}>
                      <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#374151', marginRight: '0.08rem' }}>Date</span>
                      <button type="button" onClick={() => zoomAxisIn('x')} style={{ minWidth: 'calc(1.35rem + 1mm)', height: 'calc(1.35rem + 2mm)', border: '1px solid #9ca3af', borderRadius: '4px', background: '#fff', fontWeight: 700, cursor: 'pointer' }}>+</button>
                      <button type="button" onClick={() => zoomAxisOut('x')} style={{ minWidth: 'calc(1.35rem + 1mm)', height: 'calc(1.35rem + 2mm)', border: '1px solid #9ca3af', borderRadius: '4px', background: '#fff', fontWeight: 700, cursor: 'pointer' }}>-</button>
                      <button type="button" onClick={() => shiftAxisLeft('x')} style={{ minWidth: 'calc(1.35rem + 1mm)', height: 'calc(1.35rem + 2mm)', border: '1px solid #9ca3af', borderRadius: '4px', background: '#fff', fontWeight: 700, cursor: 'pointer' }}>{'←'}</button>
                      <button type="button" onClick={() => shiftAxisRight('x')} style={{ minWidth: 'calc(1.35rem + 1mm)', height: 'calc(1.35rem + 2mm)', border: '1px solid #9ca3af', borderRadius: '4px', background: '#fff', fontWeight: 700, cursor: 'pointer' }}>{'→'}</button>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: isLaptopLayout ? '0.22rem' : '0.15rem', border: '1px solid #9ca3af', borderRadius: '6px', background: '#f9fafb', padding: isLaptopLayout ? '0.12rem 0.2rem' : '0.1rem 0.15rem' }}>
                      <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#374151', marginRight: '0.08rem' }}>Time</span>
                      <button type="button" onClick={() => zoomAxisIn('y')} style={{ minWidth: 'calc(1.35rem + 1mm)', height: 'calc(1.35rem + 2mm)', border: '1px solid #9ca3af', borderRadius: '4px', background: '#fff', fontWeight: 700, cursor: 'pointer' }}>+</button>
                      <button type="button" onClick={() => zoomAxisOut('y')} style={{ minWidth: 'calc(1.35rem + 1mm)', height: 'calc(1.35rem + 2mm)', border: '1px solid #9ca3af', borderRadius: '4px', background: '#fff', fontWeight: 700, cursor: 'pointer' }}>-</button>
                      <button type="button" onClick={shiftYAxisUp} style={{ minWidth: 'calc(1.35rem + 1mm)', height: 'calc(1.35rem + 2mm)', border: '1px solid #9ca3af', borderRadius: '4px', background: '#fff', fontWeight: 700, cursor: 'pointer' }}>{'↑'}</button>
                      <button type="button" onClick={shiftYAxisDown} style={{ minWidth: 'calc(1.35rem + 1mm)', height: 'calc(1.35rem + 2mm)', border: '1px solid #9ca3af', borderRadius: '4px', background: '#fff', fontWeight: 700, cursor: 'pointer' }}>{'↓'}</button>
                    </div>
                  </div>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: isLaptopLayout ? '0.45rem' : '0.25rem', flexWrap: 'nowrap', flexShrink: 0 }}>
                    <button
                      type="button"
                      onClick={resetPlotZoom}
                      style={{
                        height: '1.35rem',
                        border: '1px solid #9ca3af',
                        borderRadius: '6px',
                        background: '#fff',
                        color: '#111827',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        padding: isLaptopLayout ? '0 0.4rem' : '0 0.3rem'
                      }}
                    >
                      pan-out
                    </button>
                    <button
                      type="button"
                      onClick={() => setPlotDisplayMode((prev) => (prev === 'cumulative' ? 'per_event' : 'cumulative'))}
                      style={{
                        height: '1.35rem',
                        border: '1px solid #9ca3af',
                        borderRadius: '6px',
                        background: '#fff',
                        color: '#111827',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        padding: isLaptopLayout ? '0 0.45rem' : '0 0.32rem'
                      }}
                    >
                      {plotDisplayMode === 'cumulative' ? 'per event' : 'cumulative'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
      <div
        className="results-table-container eventanalysis-test-container"
        ref={tableContainerRef}
        style={{
          marginTop: pTableCorner?.y ? `calc(${pTableCorner.y} - ${headerAnchorHeight})` : '0.1cm',
          marginLeft: pTableCorner?.x ?? undefined,
          height: pTableCorner?.height,
          minHeight: pTableCorner?.minHeight,
          maxHeight: pTableCorner?.maxHeight,
          ['--ea-max-visible-width' as any]: tableMaxVisibleWidth || '100%'
        }}
      >
        <table
          ref={tableRef}
          className="results-table races-table eventtest-table"
          style={{
            ['--col1-width' as any]: col1Width,
            ['--col2-width' as any]: col2Width,
            ['--ea-period-col-width' as any]: periodColumnWidth,
            ['--ea-col1-align' as any]: col1TextAlign,
            ['--ea-col2-align' as any]: col2TextAlign,
            ['--ea-row2-top' as any]: row2StickyTopPx !== null ? `${row2StickyTopPx}px` : (pTableRow2?.y || '25px')
          }}
        >
          <thead>
            <tr>
              <th
                colSpan={2}
                className="sticky-corner-wide"
                onMouseEnter={(event) => {
                  delayedHeaderHelp.schedule({
                    event,
                    label: analysisHeaderLabel(analysisType)
                  });
                }}
                onMouseLeave={delayedHeaderHelp.clear}
                onMouseDown={delayedHeaderHelp.clear}
                onTouchStart={delayedHeaderHelp.clear}
                style={{
                  position: tableRow1Sticky ? 'sticky' : 'static',
                  top: tableRow1Sticky ? 0 : undefined,
                  zIndex: 32,
                  textAlign: 'center'
                }}
              >
                {analysisHeaderLabel(analysisType)}
              </th>
              {pivot.periodKeys.map((periodKey) => (
                <th
                  key={`h-${periodKey}`}
                  className="sticky-header"
                  onClick={() => onSort(`period:${periodKey}`)}
                  onMouseEnter={(event) => {
                    delayedHeaderHelp.schedule({
                      event,
                      label: formatPeriodHeader(periodKey, periodMode)
                    });
                  }}
                  onMouseLeave={delayedHeaderHelp.clear}
                  onMouseDown={delayedHeaderHelp.clear}
                  onTouchStart={delayedHeaderHelp.clear}
                  style={{
                    cursor: dateHeadersSortable ? 'pointer' : 'default',
                    minWidth: periodColumnWidth,
                    maxWidth: periodColumnWidth,
                    width: periodColumnWidth,
                    textAlign: periodColumnTextAlign,
                    color: periodColumnTextColor
                  }}
                >
                  <span>{formatPeriodHeader(periodKey, periodMode)}</span>
                  {renderSortIndicator(`period:${periodKey}`)}
                </th>
              ))}
            </tr>
            <tr>
              <th
                className={`sticky-col sticky-corner-2-1 eventanalysis-col1 eventanalysis-row2-corner ${stickyLeadCol1 ? '' : ''}`.trim()}
                onClick={() => onSort('col1')}
                onMouseEnter={(event) => {
                  delayedHeaderHelp.schedule({
                    event,
                    label: String(tableModel?.col1?.label || 'Event')
                  });
                }}
                onMouseLeave={delayedHeaderHelp.clear}
                onMouseDown={delayedHeaderHelp.clear}
                onTouchStart={delayedHeaderHelp.clear}
                style={{
                  cursor: sortingEnabled ? 'pointer' : 'default',
                  textAlign: col1TextAlign,
                  color: sortKey === 'col1' ? sortActiveColor : undefined
                }}
              >
                <span>{(tableModel?.col1?.label || 'Event')}</span>
                {renderSortIndicator('col1')}
              </th>
              <th
                className={`sticky-col-2 sticky-corner-2-2 eventanalysis-col2 eventanalysis-row2-corner ${stickyLeadCol2 ? '' : ''}`.trim()}
                onClick={() => onSort('col2')}
                onMouseEnter={(event) => {
                  delayedHeaderHelp.schedule({
                    event,
                    label: aggHeaderLabel(aggType)
                  });
                }}
                onMouseLeave={delayedHeaderHelp.clear}
                onMouseDown={delayedHeaderHelp.clear}
                onTouchStart={delayedHeaderHelp.clear}
                style={{
                  cursor: sortingEnabled ? 'pointer' : 'default',
                  textAlign: col2TextAlign,
                  color: sortKey === 'col2' ? sortActiveColor : undefined
                }}
              >
                <span>{aggHeaderLabel(aggType)}</span>
                {renderSortIndicator('col2')}
              </th>
              {pivot.periodKeys.map((periodKey) => (
                <th
                  key={`p-${periodKey}`}
                  className={`sticky-header ${tableRow2Sticky ? 'second-row' : ''}`.trim()}
                  onMouseEnter={(event) => {
                    delayedHeaderHelp.schedule({
                      event,
                      label: formatPeriodHeader(periodKey, periodMode)
                    });
                  }}
                  onMouseLeave={delayedHeaderHelp.clear}
                  onMouseDown={delayedHeaderHelp.clear}
                  onTouchStart={delayedHeaderHelp.clear}
                  style={{
                    cursor: 'default',
                    position: tableRow2Sticky ? 'sticky' : 'static',
                    top: tableRow2Sticky ? 25 : undefined,
                    zIndex: tableRow2Sticky ? 19 : undefined,
                    minWidth: periodColumnWidth,
                    maxWidth: periodColumnWidth,
                    width: periodColumnWidth,
                    textAlign: periodColumnTextAlign,
                    color: (analysisType === '%Deviation' || analysisType === '#Actual Deviation')
                      ? getDeviationColor(pivot.colAggValue[periodKey], filterType)
                      : periodColumnTextColor
                  }}
                >
                  <span>{formatAggregateValue(pivot.colAggValue[periodKey], analysisType, aggType, filterType)}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedCourses.map((course) => (
              <tr key={`course-${course}`}>
                <td className="sticky-col eventanalysis-col1" style={{ textAlign: col1TextAlign }}>
                  {tableModel?.col1?.link?.enabled ? (
                    <button
                      type="button"
                      className="athletes-event-link"
                      onClick={() => onCourseClick(course)}
                      style={{ display: 'block', width: '100%', textAlign: col1TextAlign }}
                    >
                      {course}
                    </button>
                  ) : (
                    course
                  )}
                </td>
                <td
                  className="sticky-col-2 eventanalysis-col2"
                  style={{
                    textAlign: col2TextAlign
                  }}
                >
                  {(analysisType === '%Deviation' || analysisType === '#Actual Deviation')
                    ? formatRowAggregateForDeviation(pivot.rowAggValue[course], filterType)
                    : formatAggregateValue(pivot.rowAggValue[course], analysisType, aggType, filterType)}
                </td>
                {pivot.periodKeys.map((periodKey) => (
                  (() => {
                    const cellRaw = pivot.transformedCell[course]?.[periodKey] ?? null;
                    const rowAggRaw = pivot.rowAggValue[course] ?? null;
                    const hasEvent = ['Annual', 'Qseason', 'Mseason'].includes(periodMode)
                      ? true
                      : Boolean(pivot.coursePeriodHasEvent?.[course]?.[periodKey]);
                    const out = formatByType(cellRaw, analysisType, filterType);
                    const rowAggDisplay = (() => {
                      if ((analysisType === '%Deviation' || analysisType === '#Actual Deviation') && (aggType === 'max' || aggType === 'min')) {
                        const rowVals = pivot.periodKeys
                          .map((pk) => pivot.transformedCell[course]?.[pk])
                          .filter((value): value is number => value !== null && Number.isFinite(value));
                        if (!rowVals.length) return '';
                        const target = aggType === 'max' ? Math.max(...rowVals) : Math.min(...rowVals);
                        return formatByType(target, analysisType, filterType);
                      }
                      return formatByType(rowAggRaw, analysisType, filterType);
                    })();
                    const deviationColor = (analysisType === '%Deviation' || analysisType === '#Actual Deviation')
                      ? getDeviationColor(cellRaw, filterType)
                      : periodColumnTextColor;
                    const displayOut = hasEvent ? out : '';
                    const isMaxMinMatch = hasEvent && (aggType === 'max' || aggType === 'min') && displayOut && rowAggDisplay && displayOut === rowAggDisplay;
                    const cellStyle = isMaxMinMatch
                      ? (aggType === 'max' ? { backgroundColor: '#d4f5d4' } : { backgroundColor: '#ffdce6' })
                      : undefined;
                    const canLink = Boolean(
                      hasEvent &&
                      displayOut &&
                      tableModel?.periodColumns?.link?.enabled &&
                      periodMode !== 'Annual' &&
                      periodMode !== 'Qseason' &&
                      periodMode !== 'Mseason'
                    );

                    return (
                      <td
                        key={`c-${course}-${periodKey}`}
                        style={{
                          ...(cellStyle || {}),
                          minWidth: periodColumnWidth,
                          maxWidth: periodColumnWidth,
                          width: periodColumnWidth,
                          textAlign: periodColumnTextAlign,
                          color: deviationColor
                        }}
                      >
                        {!canLink ? displayOut : (
                          <button
                            type="button"
                            onClick={() => onPeriodCellClick(course, periodKey)}
                            style={{
                              border: 'none',
                              background: 'none',
                              padding: 0,
                              margin: 0,
                              cursor: 'pointer',
                              color: (analysisType === '%Deviation' || analysisType === '#Actual Deviation') ? deviationColor : periodColumnLinkStyle.color,
                              textDecoration: periodColumnLinkStyle.textDecoration,
                              font: 'inherit'
                            }}
                          >
                            {displayOut}
                          </button>
                        )}
                      </td>
                    );
                  })()
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}

      {!showPlot && tableScrollSliderEnabled && horizontalScrollMax > 0 ? (
        <div
          className="eventanalysis-scroll-slider"
          style={{
            marginLeft: pTableCorner?.x ?? undefined,
            maxWidth: tableMaxVisibleWidth || '100%'
          }}
        >
          <input
            type="range"
            min={0}
            max={Math.max(1, Math.round(horizontalScrollMax))}
            step={1}
            value={Math.min(Math.round(horizontalScrollLeft), Math.max(1, Math.round(horizontalScrollMax)))}
            onChange={(event) => {
              const next = Number(event.target.value || 0);
              const container = tableContainerRef.current;
              if (!container) return;
              container.scrollTo({ left: next, behavior: 'auto' });
              setHorizontalScrollLeft(next);
            }}
            aria-label="Horizontal table scroll"
            style={{ width: '100%' }}
          />
        </div>
      ) : null}
    </div>
  );
};

export default EventAnalysisTest;
