import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  API_BASE_URL,
  fetchEventByNumber,
  fetchEventInfo,
  fetchEventPositions,
  fetchEventTimeAdjustment
} from '../api/backendAPI';
import { requestUnifiedHelp } from './UnifiedHelp';
import {
  EventLayoutElement,
  EventViewMode,
  EventViewport,
  getEventColumnsForView,
  getEventTableColumnByKey,
  getEventElementById,
  getEventElementInteraction,
  getEventElementPlacement,
  getEventLayoutConfig,
  getEventViewportForWidth
} from '../config/layout/eventsLayoutHelper';
import { navigateBackWithNavStack, navigateWithNavStack } from '../utils/navigationStack';
import './ResultsTable.css';

type CourseAdjOption = 'none' | 'seasonal' | 'full';
type OtherAdjOption = 'none' | 'age' | 'sex' | 'age_sex';
type HighlightSelection = { columnKey: string; token: string } | null;
type EventTestUiState = {
  search: string;
  viewMode: EventViewMode;
  courseAdj: CourseAdjOption;
  otherAdj: OtherAdjOption;
  sortKey: string | null;
  sortDir: 'asc' | 'desc';
};

const EVENT_TEST_UI_STATE_KEY = 'event_test_ui_state';

const adjustmentColumnMatrix: Record<CourseAdjOption, Record<OtherAdjOption, string[]>> = {
  none: {
    none: [],
    age: ['age_adj_time'],
    sex: ['sex_adj_time'],
    age_sex: ['age_sex_adj_time']
  },
  seasonal: {
    none: ['season_adj_time'],
    age: ['age_adj_time'],
    sex: ['sex_adj_time'],
    age_sex: ['age_sex_adj_time']
  },
  full: {
    none: ['event_adj_time'],
    age: ['age_event_adj_time'],
    sex: ['sex_event_adj_time'],
    age_sex: ['age_sex_event_adj_time']
  }
};

const getAdjustmentKeys = (course: CourseAdjOption, other: OtherAdjOption): string[] => {
  const courseMap = adjustmentColumnMatrix[course];
  if (!courseMap) return [];
  return courseMap[other] ?? [];
};

const adjustmentColumnKeys = new Set([
  'season_adj_time',
  'event_adj_time',
  'age_adj_time',
  'sex_adj_time',
  'age_event_adj_time',
  'sex_event_adj_time',
  'age_sex_adj_time',
  'age_sex_event_adj_time'
]);

const readRowValue = (row: any, key: string): any => {
  if (!row) return '';
  const camelKey = key.replace(/_([a-z])/g, (_m, c) => c.toUpperCase());
  return row[key] ?? row[camelKey] ?? '';
};

const parseNumeric = (value: any): number | null => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const formatHardnessPercent = (value: number | null): string => {
  if (value === null || !Number.isFinite(value)) return '--';
  const percentValue = Math.abs(value) <= 1 ? value * 100 : value;
  return `${percentValue.toFixed(2)}%`;
};

const parseTimeToSeconds = (value: any): number | null => {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;

  const raw = String(value).trim();
  if (!raw) return null;
  if (/^-?\d+(?:\.\d+)?$/.test(raw)) {
    const numeric = Number(raw);
    return Number.isFinite(numeric) ? numeric : null;
  }

  const parts = raw.split(':').map((part) => Number(part));
  if (parts.some((part) => Number.isNaN(part))) return null;
  if (parts.length === 3) {
    return (parts[0] * 3600) + (parts[1] * 60) + parts[2];
  }
  if (parts.length === 2) {
    return (parts[0] * 60) + parts[1];
  }
  if (parts.length === 1) {
    return parts[0];
  }
  return null;
};

const EventTest: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const requestedEventCode = params.get('event_code') || '1';
  const requestedDate = params.get('date') || '';
  const requestedEventNumber = params.get('event_number');
  const requestedHighlightAthlete = String(params.get('highlight_athlete') || '').trim();

  const [loading, setLoading] = useState(false);
  const [navLoading, setNavLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [eventName, setEventName] = useState('');
  const [eventCode, setEventCode] = useState<string>(requestedEventCode);
  const [eventNumber, setEventNumber] = useState<number | null>(requestedEventNumber ? Number(requestedEventNumber) : null);
  const [eventDate, setEventDate] = useState<string>(requestedDate);
  const [hardnessDisplay, setHardnessDisplay] = useState<string>('--');

  const [viewMode, setViewMode] = useState<EventViewMode>('basic');
  const [courseAdj, setCourseAdj] = useState<CourseAdjOption>('none');
  const [otherAdj, setOtherAdj] = useState<OtherAdjOption>('none');
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [highlightSelection, setHighlightSelection] = useState<HighlightSelection>(null);
  const [returnHighlightApplied, setReturnHighlightApplied] = useState(false);
  const [uiStateHydrated, setUiStateHydrated] = useState(false);

  const [viewport, setViewport] = useState<EventViewport>(() => getEventViewportForWidth(window.innerWidth));
  const layoutConfig = getEventLayoutConfig();
  const headerAnchorHeight = '3.0cm';

  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem(EVENT_TEST_UI_STATE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<EventTestUiState>;
      if (!parsed || typeof parsed !== 'object') return;
      if (String(parsed.search || '') !== String(location.search || '')) return;

      const parsedView = String(parsed.viewMode || '').trim();
      if (parsedView === 'basic' || parsedView === 'detailed' || parsedView === 'allTimeAdjustments') {
        setViewMode(parsedView);
      }

      const parsedCourse = String(parsed.courseAdj || '').trim();
      if (parsedCourse === 'none' || parsedCourse === 'seasonal' || parsedCourse === 'full') {
        setCourseAdj(parsedCourse);
      }

      const parsedOther = String(parsed.otherAdj || '').trim();
      if (parsedOther === 'none' || parsedOther === 'age' || parsedOther === 'sex' || parsedOther === 'age_sex') {
        setOtherAdj(parsedOther);
      }

      const parsedSortKey = parsed.sortKey === null ? null : String(parsed.sortKey || '').trim();
      setSortKey(parsedSortKey || null);

      const parsedSortDir = String(parsed.sortDir || '').trim();
      setSortDir(parsedSortDir === 'desc' ? 'desc' : 'asc');

    } catch (_err) {
    } finally {
      setUiStateHydrated(true);
    }
  }, [location.search]);

  useEffect(() => {
    if (!uiStateHydrated) return;

    const payload: EventTestUiState = {
      search: String(location.search || ''),
      viewMode,
      courseAdj,
      otherAdj,
      sortKey,
      sortDir
    };

    try {
      window.sessionStorage.setItem(EVENT_TEST_UI_STATE_KEY, JSON.stringify(payload));
    } catch (_err) {
    }
  }, [uiStateHydrated, location.search, viewMode, courseAdj, otherAdj, sortKey, sortDir]);

  const adjustmentKeys = useMemo(() => getAdjustmentKeys(courseAdj, otherAdj), [courseAdj, otherAdj]);
  const columns = useMemo(() => {
    const insertSelectedAdjustmentsAfterTime = (sourceColumns: ReturnType<typeof getEventColumnsForView>) => {
      if (adjustmentKeys.length === 0) {
        return sourceColumns;
      }

      const adjustmentCols = adjustmentKeys
        .map((key) => getEventTableColumnByKey(key))
        .filter((column): column is NonNullable<ReturnType<typeof getEventTableColumnByKey>> => Boolean(column));

      if (adjustmentCols.length === 0) {
        return sourceColumns;
      }

      const timeIndex = sourceColumns.findIndex((column) => column.key === 'time');
      const insertAt = timeIndex === -1 ? 0 : timeIndex + 1;
      return [
        ...sourceColumns.slice(0, insertAt),
        ...adjustmentCols,
        ...sourceColumns.slice(insertAt)
      ];
    };

    if (viewMode === 'detailed') {
      return insertSelectedAdjustmentsAfterTime(getEventColumnsForView('detailed'));
    }

    if (viewMode === 'allTimeAdjustments') {
      return insertSelectedAdjustmentsAfterTime(getEventColumnsForView('allTimeAdjustments'));
    }

    return insertSelectedAdjustmentsAfterTime(getEventColumnsForView('basic'));
  }, [viewMode, adjustmentKeys]);
  const stickyLeftByIndex = useMemo<Record<number, string>>(() => {
    const stickyWidths: string[] = [];
    const leftMap: Record<number, string> = {};

    columns.forEach((column, index) => {
      if (!column.sticky) return;
      leftMap[index] = stickyWidths.length === 0 ? '0px' : `calc(${stickyWidths.join(' + ')})`;
      stickyWidths.push(column[viewport]?.width || '0px');
    });

    return leftMap;
  }, [columns, viewport]);
  const leadingCol1Width = getEventTableColumnByKey('position')?.[viewport]?.width || 'auto';
  const leadingCol2Width = getEventTableColumnByKey('athlete')?.[viewport]?.width || 'auto';

  const snakeToCamel = (value: string) => value.replace(/_(.)/g, (_m, g1) => g1.toUpperCase());
  const getSortValue = (row: any, key: string) => {
    if (!row) return null;
    if (key === 'time') {
      const rawTime = row?.time ?? row?.time_seconds ?? row?.timeSeconds;
      return parseTimeToSeconds(rawTime);
    }
    if (key === 'athlete') {
      const athleteName = row?.name ?? row?.athlete_name ?? row?.athleteName;
      if (athleteName === null || athleteName === undefined) return null;
      return String(athleteName).trim().toLowerCase();
    }
    let rawValue = row[key];
    if (rawValue === undefined) rawValue = row[snakeToCamel(key)];
    if (rawValue === null || rawValue === undefined) return null;
    if (typeof rawValue === 'number') return rawValue;
    const text = String(rawValue).trim();
    if (/^-?\d+(?:\.\d+)?$/.test(text)) return Number(text);
    return text.toLowerCase();
  };

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortKey(key);
    setSortDir('asc');
  };

  const sortedRows = useMemo(() => {
    if (!rows || !sortKey) return rows;
    const copy = Array.isArray(rows) ? rows.slice() : [];
    copy.sort((a, b) => {
      const va = getSortValue(a, sortKey);
      const vb = getSortValue(b, sortKey);
      if (va === null && vb === null) return 0;
      if (va === null) return 1;
      if (vb === null) return -1;
      if (typeof va === 'number' && typeof vb === 'number') {
        return sortDir === 'asc' ? (va - vb) : (vb - va);
      }
      const sa = String(va);
      const sb = String(vb);
      if (sa < sb) return sortDir === 'asc' ? -1 : 1;
      if (sa > sb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return copy;
  }, [rows, sortKey, sortDir]);
  const viewLabelElement = getEventElementById('event.viewLabel');
  const viewLabelStyle = viewLabelElement?.style;
  const courseLabelElement = getEventElementById('event.courseLabel');
  const dateLabelElement = getEventElementById('event.dateLabel');
  const eventNoLabelElement = getEventElementById('event.eventNoLabel');
  const eventNoElement = getEventElementById('event.eventNo');
  const eventNoStyle = eventNoElement?.style;
  const upSortElement = getEventElementById('event.upSort');
  const downSortElement = getEventElementById('event.downSort');
  const courseAdjLabelElement = getEventElementById('event.courseAdjLabel');
  const courseAdjLabelStyle = courseAdjLabelElement?.style;
  const otherAdjLabelElement = getEventElementById('event.otherAdjLabel');
  const otherAdjLabelStyle = otherAdjLabelElement?.style;
  const hardnessLabelElement = getEventElementById('event.hardnessLabel');
  const hardnessValueElement = getEventElementById('event.hardnessValue');
  const hardnessValueStyle = hardnessValueElement?.style;

  const pLeftArrow = getEventElementPlacement('event.leftArrow', viewport);
  const pCourseLabel = getEventElementPlacement('event.courseLabel', viewport);
  const pCourse = getEventElementPlacement('event.course', viewport);
  const courseInteraction = getEventElementInteraction('event.course');
  const pDateLabel = getEventElementPlacement('event.dateLabel', viewport);
  const pDate = getEventElementPlacement('event.date', viewport);
  const pEventNoLabel = getEventElementPlacement('event.eventNoLabel', viewport);
  const pEventNo = getEventElementPlacement('event.eventNo', viewport);
  const pUp = getEventElementPlacement('event.upSort', viewport);
  const pDown = getEventElementPlacement('event.downSort', viewport);
  const pViewLabel = getEventElementPlacement('event.viewLabel', viewport);
  const pViewSelect = getEventElementPlacement('event.viewSelect', viewport);
  const pCourseAdjLabel = getEventElementPlacement('event.courseAdjLabel', viewport);
  const pCourseAdjSelect = getEventElementPlacement('event.courseAdjSelect', viewport);
  const pOtherAdjLabel = getEventElementPlacement('event.otherAdjLabel', viewport);
  const pOtherAdjSelect = getEventElementPlacement('event.otherAdjSelect', viewport);
  const pHardnessLabel = getEventElementPlacement('event.hardnessLabel', viewport);
  const pHardnessValue = getEventElementPlacement('event.hardnessValue', viewport);
  const pStatusMessage = getEventElementPlacement('event.statusMessage', viewport);
  const pTableCorner = getEventElementPlacement('event.table.corner', viewport);
  const tableRow1Element = getEventElementById('event.table.row1');
  const hardnessInteraction = getEventElementInteraction('event.hardnessValue');
  const tableRow1Sticky = tableRow1Element?.sticky !== false;
  const hardnessIsNavigable = Boolean(
    hardnessInteraction?.enabled &&
    hardnessInteraction?.action === 'navigate' &&
    String(hardnessInteraction?.target || '').trim()
  );

  const resolveLatestDate = async (code: string): Promise<string> => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/last_positions?event_code=${encodeURIComponent(code)}`);
      if (!response.ok) return '';
      const data = await response.json();
      if (!Array.isArray(data) || data.length === 0) return '';
      const sorted = data.sort((a: any, b: any) => {
        const da = String(a?.formatted_date || a?.event_date || '');
        const db = String(b?.formatted_date || b?.event_date || '');
        return db.localeCompare(da);
      });
      return String(sorted[0]?.event_date || sorted[0]?.eventDate || '');
    } catch (_err) {
      return '';
    }
  };

  useEffect(() => {
    const onResize = () => {
      setViewport(getEventViewportForWidth(window.innerWidth));
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const code = requestedEventCode;
        let date = requestedDate;
        let numberFromQuery = requestedEventNumber ? Number(requestedEventNumber) : null;

        if (!date && numberFromQuery && /^\d+$/.test(code)) {
          const byNumber = await fetchEventByNumber(Number(code), numberFromQuery);
          date = String(byNumber?.event_date || byNumber?.formatted_date || '');
        }

        if (!date && code) {
          date = await resolveLatestDate(code);
        }

        if (!date) {
          throw new Error('No event date available for Event_test.');
        }

        const [info, positionsRaw, adjustmentsRaw] = await Promise.all([
          fetchEventInfo(code, date),
          fetchEventPositions(code, date),
          fetchEventTimeAdjustment(code, date).catch(() => [])
        ]);

        const baseRows = Array.isArray(positionsRaw) ? positionsRaw : [];
        const adjustmentRows = Array.isArray(adjustmentsRaw) ? adjustmentsRaw : [];

        const keyFor = (athleteCode?: any, time?: any) => `${athleteCode ?? ''}__${time ?? ''}`;
        const adjMap = new Map(adjustmentRows.map((r: any) => [keyFor(r?.athlete_code, r?.time), r]));

        const mergedRows = baseRows.map((r: any) => ({
          ...r,
          ...(adjMap.get(keyFor(r?.athlete_code, r?.time)) || {})
        }));

        const fromRowsByTimeAdjustment = (() => {
          const adjustments = mergedRows
            .map((row: any) => {
              const rawTime = row?.time ?? row?.time_seconds ?? row?.timeSeconds;
              const rawEventAdj = row?.event_adj_time ?? row?.eventAdjTime;
              const timeSeconds = parseTimeToSeconds(rawTime);
              const eventAdjSeconds = parseTimeToSeconds(rawEventAdj);
              if (timeSeconds === null || eventAdjSeconds === null || eventAdjSeconds === 0) {
                return null;
              }
              return (timeSeconds / eventAdjSeconds) - 1;
            })
            .filter((value): value is number => value !== null && Number.isFinite(value));

          if (adjustments.length === 0) {
            return null;
          }

          return adjustments.reduce((sum, value) => sum + value, 0) / adjustments.length;
        })();

        const infoCombined = parseNumeric(info?.coeff_combined ?? info?.coeffCombined);
        const infoCoeff = parseNumeric(info?.coeff);
        const infoCoeffEvent = parseNumeric(info?.coeff_event ?? info?.coeffEvent);
        const fromInfo =
          infoCombined !== null
            ? infoCombined
            : (infoCoeff !== null && infoCoeffEvent !== null ? infoCoeff + infoCoeffEvent : null);

        const firstRow = mergedRows[0] || {};
        const rowCombined = parseNumeric(firstRow?.coeff_combined ?? firstRow?.coeffCombined);
        const rowCoeff = parseNumeric(firstRow?.coeff);
        const rowCoeffEvent = parseNumeric(firstRow?.coeff_event ?? firstRow?.coeffEvent);
        const fromRow =
          rowCombined !== null
            ? rowCombined
            : (rowCoeff !== null && rowCoeffEvent !== null ? rowCoeff + rowCoeffEvent : null);

        const combinedHardnessRaw = fromRowsByTimeAdjustment ?? fromInfo ?? fromRow;

        if (cancelled) return;

        setRows(mergedRows);
        setEventName(String(info?.event_name || info?.display_name || ''));
        setEventCode(String(info?.event_code || code));
        setEventDate(String(date));
        const finalNumber = Number(info?.event_number || numberFromQuery || 0);
        setEventNumber(Number.isFinite(finalNumber) && finalNumber > 0 ? finalNumber : null);
        setHardnessDisplay(formatHardnessPercent(combinedHardnessRaw));
      } catch (err: any) {
        if (!cancelled) {
          setRows([]);
          setHardnessDisplay('--');
          setError(String(err?.message || 'Failed to load Event_test data'));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [requestedDate, requestedEventCode, requestedEventNumber]);

  const changeEventNumber = async (delta: 1 | -1) => {
    if (!eventCode || !eventNumber) {
      setError('Event code/number unavailable — cannot change event number');
      return;
    }

    if (!/^\d+$/.test(String(eventCode))) {
      setError('Event code is not numeric — cannot change event number');
      return;
    }

    const currentNumber = Number(eventNumber);
    const next = currentNumber + delta;
    if (next < 1) return;

    setNavLoading(true);
    setError(null);
    try {
      const info = await fetchEventByNumber(Number(eventCode), next);
      const resolvedDate = String(info?.event_date || info?.eventDate || info?.formatted_date || '').trim();
      if (!resolvedDate) {
        setError('No event found for that event number');
        return;
      }

      const qs = new URLSearchParams();
      qs.set('event_code', String(eventCode));
      qs.set('event_number', String(next));
      navigate(`/races?${qs.toString()}`);
    } catch (e) {
      let status404 = false;
      try {
        if (e && typeof e === 'object' && 'response' in e) {
          const anyE: any = e;
          const resp = anyE.response;
          if (resp && typeof resp.status === 'number' && resp.status === 404) status404 = true;
        }
      } catch (_err) {
      }

      if (status404) {
        setError('No event found for that event number (likely at boundary)');
      } else {
        setError(String(e));
      }
    } finally {
      setNavLoading(false);
    }
  };

  const resolveInteractionToken = (value: string): string => {
    const tokenMap: Record<string, string> = {
      '$eventCode': String(eventCode || ''),
      '$eventName': String(eventName || ''),
      '$eventDate': String(eventDate || ''),
      '$eventNumber': String(eventNumber || ''),
      '$locationSearch': String(location.search || '')
    };

    if (tokenMap[value] !== undefined) {
      return tokenMap[value];
    }

    return value.replace(/\$[a-zA-Z][a-zA-Z0-9]*/g, (match) => tokenMap[match] ?? '');
  };

  const handleCourseInteraction = () => {
    const interaction = courseInteraction;
    if (!interaction?.enabled || interaction.action !== 'navigate') {
      return;
    }

    const target = String(interaction.target || '/courses_test');
    const params = new URLSearchParams();

    Object.entries(interaction.params || {}).forEach(([key, rawValue]) => {
      const resolved = resolveInteractionToken(String(rawValue || '')).trim();
      if (resolved) {
        params.set(key, resolved);
      }
    });

    const to = params.toString() ? `${target}?${params.toString()}` : target;

    if ((interaction.navMode || 'stack') === 'stack') {
      navigateWithNavStack(navigate, location, to, {
        state: {
          from: 'races',
          eventCode: eventCode || undefined,
          eventName: eventName || undefined,
          returnTo: {
            pathname: '/races',
            search: location.search || ''
          },
          ...(interaction.state || {})
        }
      });
      return;
    }

    navigate(to);
  };

  const handleConfiguredInteraction = (interaction?: ReturnType<typeof getEventElementInteraction>) => {
    if (!interaction?.enabled || interaction.action !== 'navigate') {
      return;
    }

    const target = String(interaction.target || '/courses_test');
    const params = new URLSearchParams();

    Object.entries(interaction.params || {}).forEach(([key, rawValue]) => {
      const resolved = resolveInteractionToken(String(rawValue || '')).trim();
      if (resolved) {
        params.set(key, resolved);
      }
    });

    const to = params.toString() ? `${target}?${params.toString()}` : target;

    if ((interaction.navMode || 'stack') === 'stack') {
      navigateWithNavStack(navigate, location, to, {
        state: {
          from: 'races',
          eventCode: eventCode || undefined,
          eventName: eventName || undefined,
          returnTo: {
            pathname: '/races',
            search: location.search || ''
          },
          ...(interaction.state || {})
        }
      });
      return;
    }

    navigate(to);
  };

  const resolveInteractionTokenForRow = (value: string, row: any): string => {
    const athleteCode = String(readRowValue(row, 'athlete_code') || '').trim();
    const athleteName = String(readRowValue(row, 'name') || readRowValue(row, 'athlete_name') || '').trim();
    const tokenMap: Record<string, string> = {
      '$eventCode': String(eventCode || ''),
      '$eventName': String(eventName || ''),
      '$eventDate': String(eventDate || ''),
      '$eventNumber': String(eventNumber || ''),
      '$athleteCode': athleteCode,
      '$athleteName': athleteName
    };

    if (tokenMap[value] !== undefined) {
      return tokenMap[value];
    }

    return value.replace(/\$[a-zA-Z][a-zA-Z0-9_.]*/g, (match) => {
      if (match.startsWith('$row.')) {
        const rowKey = match.slice(5);
        return String(readRowValue(row, rowKey) || '');
      }
      return tokenMap[match] ?? '';
    });
  };

  const handleConfiguredRowInteraction = (
    interaction: ReturnType<typeof getEventElementInteraction> | undefined,
    row: any,
    columnKey: string
  ) => {
    if (!interaction?.enabled || interaction.action !== 'navigate' || !String(interaction.target || '').trim()) {
      return;
    }

    const getHighlightTokenForColumn = (key: string, sourceRow: any): string => {
      if (key === 'athlete') {
        return String(readRowValue(sourceRow, 'athlete_code') || '').trim();
      }
      return String(readRowValue(sourceRow, key) || '').trim();
    };

    const highlightToken = getHighlightTokenForColumn(columnKey, row);
    if (highlightToken) {
      const payload = {
        eventCode: String(eventCode || ''),
        eventDate: String(eventDate || ''),
        columnKey,
        token: highlightToken
      };
      try {
        window.sessionStorage.setItem('event_test_return_highlight', JSON.stringify(payload));
      } catch (_err) {
      }
    }

    const target = String(interaction.target || '').trim();
    const params = new URLSearchParams();

    Object.entries(interaction.params || {}).forEach(([key, rawValue]) => {
      const resolved = resolveInteractionTokenForRow(String(rawValue || ''), row).trim();
      if (resolved) {
        params.set(key, resolved);
      }
    });

    const to = params.toString() ? `${target}?${params.toString()}` : target;

    if ((interaction.navMode || 'stack') === 'stack') {
      navigateWithNavStack(navigate, location, to, {
        state: {
          from: 'races',
          eventCode: eventCode || undefined,
          eventName: eventName || undefined,
          returnTo: {
            pathname: '/races',
            search: location.search || ''
          },
          ...(interaction.state || {})
        }
      });
      return;
    }

    navigate(to);
  };

  useEffect(() => {
    const eventCodeStr = String(eventCode || '').trim();
    const eventDateStr = String(eventDate || '').trim();
    if (!eventCodeStr || !eventDateStr) return;

    try {
      const raw = window.sessionStorage.getItem('event_test_return_highlight');
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return;

      const matchesContext =
        String(parsed.eventCode || '').trim() === eventCodeStr &&
        String(parsed.eventDate || '').trim() === eventDateStr;

      if (!matchesContext) return;

      const columnKey = String(parsed.columnKey || '').trim();
      const token = String(parsed.token || '').trim();
      if (!columnKey || !token) return;

      setHighlightSelection({ columnKey, token });
      setReturnHighlightApplied(true);
      window.sessionStorage.removeItem('event_test_return_highlight');
    } catch (_err) {
    }
  }, [eventCode, eventDate]);

  useEffect(() => {
    const eventCodeStr = String(eventCode || '').trim();
    const eventDateStr = String(eventDate || '').trim();
    if (!eventCodeStr || !eventDateStr) return;
    if (!requestedHighlightAthlete) return;
    if (returnHighlightApplied) return;

    setHighlightSelection({
      columnKey: 'athlete',
      token: requestedHighlightAthlete
    });
  }, [eventCode, eventDate, requestedHighlightAthlete, returnHighlightApplied]);

  useEffect(() => {
    if (!highlightSelection) return;
    const timer = window.setTimeout(() => {
      const target = document.querySelector('[data-highlight-cell="true"]') as HTMLElement | null;
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
      }
    }, 120);

    return () => window.clearTimeout(timer);
  }, [highlightSelection, sortedRows]);

  const getColumnStyle = (key: string, columnStyle?: any): React.CSSProperties | undefined => {
    const baseStyle = columnStyle || getEventTableColumnByKey(key)?.style;
    if (!baseStyle) return undefined;
    return {
      fontSize: baseStyle?.fontSize,
      fontWeight: baseStyle?.fontWeight,
      color: baseStyle?.color,
      lineHeight: baseStyle?.lineHeight,
      backgroundColor: baseStyle?.backgroundColor,
      textAlign: baseStyle?.textAlign
    };
  };

  const formatTimeValueForDisplay = (rawValue: any, columnStyle?: any): string => {
    const displayFormat = String(columnStyle?.timeDisplayFormat || 'raw').trim();
    if (displayFormat !== 'mm:ss') {
      return String(rawValue ?? '');
    }

    const totalSeconds = parseTimeToSeconds(rawValue);
    if (totalSeconds === null || !Number.isFinite(totalSeconds)) {
      return String(rawValue ?? '');
    }

    const sign = totalSeconds < 0 ? '-' : '';
    const absSeconds = Math.abs(Math.round(totalSeconds));
    const totalMinutes = Math.floor(absSeconds / 60);
    const seconds = absSeconds % 60;
    return `${sign}${totalMinutes}:${String(seconds).padStart(2, '0')}`;
  };

  const renderConfigLabel = (
    element: EventLayoutElement | undefined,
    placement: ReturnType<typeof getEventElementPlacement>,
    fallbackName: string,
    fallbackHelpTarget: string
  ) => {
    const labelName = element?.name || fallbackName;
    const labelStyle = element?.style;
    const helpTitleBase = String(labelName || fallbackName).replace(/:\s*$/, '');

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
                requestUnifiedHelp(element?.helpTarget || fallbackHelpTarget, {
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

  return (
    <div className="page-content">
      <div className="races-header" style={{ marginLeft: 0 }}>
        <div className="races-header-text" style={{ width: '100%' }}>
          <div style={{ position: 'relative', minHeight: headerAnchorHeight }}>
            <button
              type="button"
              onClick={() => {
                const popped = navigateBackWithNavStack(navigate, location.pathname);
                if (!popped) {
                  navigate('/results_test');
                }
              }}
              title="Back to Event Analysis"
              aria-label="Back to Event Analysis"
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

            <div
              className="races-header-title"
              style={{
                position: 'absolute',
                left: pCourse?.x,
                top: pCourse?.y,
                paddingLeft: 0,
                margin: 0,
                transform: 'none',
                fontWeight: 700
              }}
            >
              {courseInteraction?.enabled ? (
                <button
                  type="button"
                  className="races-athlete-button"
                  onClick={handleCourseInteraction}
                  title={`Open course: ${String(eventName || '').trim() || 'course'}`}
                  aria-label={`Open course ${String(eventName || '').trim() || ''}`}
                  style={{ fontSize: 'inherit', fontWeight: 700, padding: 0 }}
                >
                  {eventName || <em>none</em>}
                </button>
              ) : (
                eventName || <em>none</em>
              )}
            </div>

            {renderConfigLabel(courseLabelElement, pCourseLabel, 'Course:', 'control-course')}
            {renderConfigLabel(dateLabelElement, pDateLabel, 'Ev Date:', 'control-event-date')}
            {renderConfigLabel(eventNoLabelElement, pEventNoLabel, 'Ev Number:', 'control-event-number')}

            <div
              className="races-header-sub"
              style={{
                position: 'absolute',
                left: pDate?.x,
                top: pDate?.y,
                paddingLeft: 0,
                margin: 0,
                marginTop: 0,
                transform: 'none',
                display: 'block',
                color: '#444',
                fontWeight: 700,
                lineHeight: 1.1
              }}
            >
              {eventDate}
            </div>

            <div
              style={{
                position: 'absolute',
                left: pEventNo?.x,
                top: pEventNo?.y,
                fontWeight: eventNoStyle?.fontWeight,
                fontSize: eventNoStyle?.fontSize,
                color: eventNoStyle?.color,
                lineHeight: eventNoStyle?.lineHeight
              }}
            >
              {eventNumber ? `#${eventNumber}` : ''}
            </div>
            <button
              type="button"
              className="evnum-btn"
              style={{
                position: 'absolute',
                left: pUp?.x,
                top: pUp?.y,
                fontSize: upSortElement?.style?.fontSize,
                width: upSortElement?.style?.width,
                height: upSortElement?.style?.height,
                padding: upSortElement?.style?.padding
              }}
              onClick={() => changeEventNumber(1)}
              disabled={navLoading}
              title="Previous event"
            >
              ▲
            </button>
            <button
              type="button"
              className="evnum-btn"
              style={{
                position: 'absolute',
                left: pDown?.x,
                top: pDown?.y,
                fontSize: downSortElement?.style?.fontSize,
                width: downSortElement?.style?.width,
                height: downSortElement?.style?.height,
                padding: downSortElement?.style?.padding
              }}
              onClick={() => changeEventNumber(-1)}
              disabled={navLoading}
              title="Next event"
            >
              ▼
            </button>

            {renderConfigLabel(viewLabelElement, pViewLabel, 'View:', 'control-table-view')}
            <select
              id="event-test-view"
              style={{ position: 'absolute', left: pViewSelect?.x, top: pViewSelect?.y, width: pViewSelect?.width }}
              value={viewMode}
              onChange={(e) => {
                const v = e.target.value;
                const next: EventViewMode = v === 'detailed' ? 'detailed' : v === 'allTimeAdjustments' ? 'allTimeAdjustments' : 'basic';
                setViewMode(next);
              }}
            >
              <option value="basic">Basic</option>
              <option value="detailed">Detailed</option>
              <option value="allTimeAdjustments">All Time Adjustments</option>
            </select>

            {renderConfigLabel(courseAdjLabelElement, pCourseAdjLabel, 'Course adj:', 'control-course-adj')}
            <select
              id="event-test-course-adj"
              style={{ position: 'absolute', left: pCourseAdjSelect?.x, top: pCourseAdjSelect?.y, width: pCourseAdjSelect?.width }}
              value={courseAdj}
              onChange={(e) => setCourseAdj((e.target.value as any) || 'none')}
            >
              <option value="none">no adjustment (default)</option>
              <option value="seasonal">seasonal adjustments</option>
              <option value="full">full event adjustments</option>
            </select>

            {renderConfigLabel(otherAdjLabelElement, pOtherAdjLabel, 'Other adj:', 'control-other-adj')}
            <select
              id="event-test-other-adj"
              style={{ position: 'absolute', left: pOtherAdjSelect?.x, top: pOtherAdjSelect?.y, width: pOtherAdjSelect?.width }}
              value={otherAdj}
              onChange={(e) => setOtherAdj((e.target.value as any) || 'none')}
            >
              <option value="none">no adjustment (default)</option>
              <option value="age">age adjustments</option>
              <option value="sex">sex adjustments</option>
              <option value="age_sex">age & sex adjustment</option>
            </select>

            {renderConfigLabel(hardnessLabelElement, pHardnessLabel, 'Hardness adj:', 'control-hardness-adj')}
            <div
              style={{
                position: 'absolute',
                left: pHardnessValue?.x,
                top: pHardnessValue?.y,
                fontSize: hardnessValueStyle?.fontSize,
                fontWeight: hardnessValueStyle?.fontWeight,
                color: hardnessValueStyle?.color,
                lineHeight: hardnessValueStyle?.lineHeight
              }}
            >
              {hardnessIsNavigable ? (
                <button
                  type="button"
                  className="races-athlete-button"
                  onClick={() => handleConfiguredInteraction(hardnessInteraction)}
                  title="Open hardness context"
                  aria-label="Open hardness context"
                  style={{
                    fontSize: hardnessValueStyle?.fontSize ?? 'inherit',
                    fontWeight: hardnessValueStyle?.fontWeight ?? 700,
                    color: hardnessValueStyle?.color,
                    lineHeight: hardnessValueStyle?.lineHeight,
                    padding: 0
                  }}
                >
                  {hardnessDisplay}
                </button>
              ) : (
                hardnessDisplay
              )}
            </div>

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
              <div style={{ fontSize: '0.9em' }}>
                {loading ? 'Loading event positions…' : (error || `${rows.length} participant${rows.length === 1 ? '' : 's'}`)}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div
        className="results-table-container"
        style={{
          marginTop: pTableCorner?.y ? `calc(${pTableCorner.y} - ${headerAnchorHeight})` : '0.1cm',
          marginLeft: pTableCorner?.x ?? undefined
        }}
      >
        <table
          className="results-table races-table eventtest-table"
          style={{
            ['--col1-width' as any]: leadingCol1Width,
            ['--col2-width' as any]: leadingCol2Width
          }}
        >
          <thead>
            <tr>
              {columns.map((column, columnIndex) => (
                <th
                  key={`${column.key}-${columnIndex}`}
                  className={`eventtest-col ${column.sticky ? 'eventtest-sticky-col' : ''} ${adjustmentColumnKeys.has(column.key) ? 'sticky-header adjustment-header' : ''}`.trim()}
                  onClick={() => handleSort(column.key)}
                  onTouchEnd={(event) => {
                    event.preventDefault();
                    handleSort(column.key);
                  }}
                  style={{
                    ['--event-col-width' as any]: column[viewport]?.width || 'auto',
                    ['--event-col-left' as any]: column.sticky ? (stickyLeftByIndex[columnIndex] || '0px') : 'auto',
                    width: column[viewport]?.width || 'auto',
                    minWidth: column[viewport]?.width,
                    maxWidth: column[viewport]?.width,
                    position: (tableRow1Sticky || column.sticky) ? 'sticky' : 'static',
                    top: tableRow1Sticky ? 0 : undefined,
                    zIndex: column.sticky ? (tableRow1Sticky ? 260 : 160) : (tableRow1Sticky ? 200 : undefined),
                    cursor: 'pointer',
                    ...getColumnStyle(column.key, column.style)
                  }}
                >
                  <span className="eventtest-header-label">{column.headerName}</span>
                  <span className="eventtest-sort-indicator">{sortKey === column.key ? (sortDir === 'asc' ? '▲' : '▼') : ''}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(sortedRows ?? rows).map((row, idx) => (
              <tr key={`${readRowValue(row, 'athlete_code') || idx}-${readRowValue(row, 'position') || ''}`}>
                {columns.map((column, columnIndex) => {
                  const key = column.key;
                  const cellKey = `${key}-${columnIndex}`;
                  const cellClassName = column.sticky ? 'eventtest-col eventtest-sticky-col' : 'eventtest-col';
                  const resolvedColumnStyle = getColumnStyle(key, column.style);
                  const configuredWidth = column[viewport]?.width;
                  const cellWidthStyle: React.CSSProperties = {
                    ['--event-col-width' as any]: configuredWidth || 'auto',
                    ['--event-col-left' as any]: column.sticky ? (stickyLeftByIndex[columnIndex] || '0px') : 'auto',
                    width: configuredWidth,
                    minWidth: configuredWidth,
                    maxWidth: configuredWidth
                  };
                  const stickyCellStyle: React.CSSProperties = column.sticky
                    ? {
                        position: 'sticky',
                        zIndex: 120
                      }
                    : {};
                  const getCellHighlightToken = (columnKey: string, sourceRow: any): string => {
                    if (columnKey === 'athlete') {
                      return String(readRowValue(sourceRow, 'athlete_code') || '').trim();
                    }
                    return String(readRowValue(sourceRow, columnKey) || '').trim();
                  };
                  const isHighlightedCell = Boolean(
                    highlightSelection &&
                    highlightSelection.columnKey === key &&
                    getCellHighlightToken(key, row) === highlightSelection.token
                  );
                  const highlightedCellStyle: React.CSSProperties | undefined = isHighlightedCell
                    ? { backgroundColor: '#e6f3ff', fontWeight: 700 }
                    : undefined;

                  if (key === 'position') {
                    return <td key={cellKey} className={cellClassName} data-highlight-cell={isHighlightedCell ? 'true' : undefined} style={{ ...cellWidthStyle, ...stickyCellStyle, ...resolvedColumnStyle, ...highlightedCellStyle }}>{String(readRowValue(row, key) ?? '')}</td>;
                  }

                  if (key === 'athlete') {
                    const athleteLabel = String(readRowValue(row, 'name') || readRowValue(row, 'athlete_name') || 'Unknown athlete');
                    const athleteCode = readRowValue(row, 'athlete_code');
                    const athleteInteraction = column.interaction;
                    const athleteIsNavigable = Boolean(
                      athleteCode &&
                      athleteInteraction?.enabled &&
                      athleteInteraction?.action === 'navigate' &&
                      String(athleteInteraction?.target || '').trim()
                    );

                    const superTourVal = readRowValue(row, 'super_tourist');
                    const isSuperTour = (String(superTourVal) === 'T' || String(superTourVal) === '1' || superTourVal === 1);
                    const superReturnVal = readRowValue(row, 'super_returner');
                    const isCommentBold = (String(superReturnVal) === 'T' || String(superReturnVal) === '1' || superReturnVal === 1);
                    const eligibleRaw = readRowValue(row, 'event_eligible_appearances');
                    const localRaw = readRowValue(row, 'last_event_code_count_long');
                    const eligibleNum = Number(eligibleRaw) || 0;
                    const localNum = Number(localRaw) || 0;
                    const commentRaw = String(readRowValue(row, 'comment') || '');
                    const showCrown = ((eligibleNum > 10 || localNum > 20) && commentRaw === 'New PB!');
                    const otherRaw = readRowValue(row, 'distinct_courses_long');
                    const otherNum = Number(otherRaw) || 0;
                    const totalRaw = readRowValue(row, 'total_runs');
                    const isFirstTimerMatch = (commentRaw === 'First Timer!' && localNum === 1 && otherNum === 1);
                    const showFirstBadgeFirstEver = isFirstTimerMatch && (totalRaw == null || totalRaw === '');
                    const showFirstBadgeEventOnly = isFirstTimerMatch && !(totalRaw == null || totalRaw === '');

                    return (
                      <td key={cellKey} className={cellClassName} data-highlight-cell={isHighlightedCell ? 'true' : undefined} style={{ ...cellWidthStyle, ...stickyCellStyle, ...resolvedColumnStyle, ...highlightedCellStyle }}>
                        {athleteIsNavigable ? (
                          <button
                            type="button"
                            className="races-athlete-button"
                            onClick={() => handleConfiguredRowInteraction(athleteInteraction, row, key)}
                            title="View athlete details"
                            style={{
                              fontSize: resolvedColumnStyle?.fontSize ?? 'inherit',
                              fontWeight: resolvedColumnStyle?.fontWeight,
                              color: resolvedColumnStyle?.color,
                              lineHeight: resolvedColumnStyle?.lineHeight,
                              padding: 0
                            }}
                          >
                            {athleteLabel}
                          </button>
                        ) : athleteLabel}
                        {isSuperTour && (
                          <span title="Super Tourist" style={{ marginLeft: 6, fontSize: '0.55rem', color: '#0077cc', background: '#f0f0f0', padding: '1px 3px', borderRadius: 4, fontWeight: 700, display: 'inline-block' }}>ST</span>
                        )}
                        {isCommentBold && (
                          <span title="Returner" style={{ marginLeft: 6, fontSize: '0.68rem', display: 'inline-block' }}>👋</span>
                        )}
                        {showCrown && (
                          <span title="New PB" style={{ marginLeft: 6, fontSize: '0.58rem', color: '#b8860b', background: '#fff8e1', padding: '1px 3px', borderRadius: 4, fontWeight: 700, display: 'inline-block' }}>👑</span>
                        )}
                        {showFirstBadgeFirstEver && (
                          <span title="1st ever Parkrun" aria-label="First timer" role="img" style={{ marginLeft: 6, fontSize: '0.55rem', color: '#0077cc', background: '#f0f0f0', padding: '1px 3px', borderRadius: 4, fontWeight: 700, display: 'inline-block' }}>🥇 1st</span>
                        )}
                        {showFirstBadgeEventOnly && (
                          <span title="First time at this event" aria-label="First time at this event" role="img" style={{ marginLeft: 6, fontSize: '0.55rem', color: '#0077cc', background: '#f0f0f0', padding: '1px 3px', borderRadius: 4, fontWeight: 700, display: 'inline-block' }}>1st</span>
                        )}
                      </td>
                    );
                  }

                  if (key === 'club') {
                    const clubValue = String(readRowValue(row, key) || '').trim();
                    const clubInteraction = column.interaction;
                    const canOpen = Boolean(
                      clubValue &&
                      clubValue.toLowerCase() !== '<no club>' &&
                      clubInteraction?.enabled &&
                      clubInteraction?.action === 'navigate' &&
                      String(clubInteraction?.target || '').trim()
                    );
                    return (
                      <td key={cellKey} className={cellClassName} data-highlight-cell={isHighlightedCell ? 'true' : undefined} style={{ ...cellWidthStyle, ...stickyCellStyle, ...resolvedColumnStyle, ...highlightedCellStyle }}>
                        {canOpen ? (
                          <button type="button" className="races-athlete-button" onClick={() => handleConfiguredRowInteraction(clubInteraction, row, key)} title="View club details">
                            {clubValue}
                          </button>
                        ) : (clubValue || '')}
                      </td>
                    );
                  }

                  if (key === 'time') {
                    const rawTime = readRowValue(row, key);
                    return (
                      <td key={cellKey} className={cellClassName} data-highlight-cell={isHighlightedCell ? 'true' : undefined} style={{ ...cellWidthStyle, ...stickyCellStyle, ...resolvedColumnStyle, ...highlightedCellStyle }}>
                        {formatTimeValueForDisplay(rawTime, column.style)}
                      </td>
                    );
                  }

                  if (key === 'best_curve_ranking_current') {
                    const currentRankRaw = row?.best_curve_ranking_current ?? row?.bestCurveRankingCurrent ?? row?.rank;
                    const historicRankRaw = row?.best_curve_ranking_historic ?? row?.bestCurveRankingHistoric;
                    const rankTypeRaw = readRowValue(row, 'best_curve_ranking_current_type');
                    const rankSubFontSize = column?.style?.subFontSize || '0.62rem';

                    const toOptionalRankNumber = (value: unknown): number | null => {
                      if (value === null || value === undefined) return null;
                      const text = String(value).trim();
                      if (!text) return null;
                      const numeric = Number(text);
                      return Number.isFinite(numeric) ? numeric : null;
                    };

                    const currentRank = toOptionalRankNumber(currentRankRaw);
                    const historicRank = toOptionalRankNumber(historicRankRaw);
                    const hasCurrent = currentRank !== null;
                    const hasHistoric = historicRank !== null;

                    const rankType = hasCurrent ? (String(rankTypeRaw || '').trim() || '*') : '';
                    const delta = hasCurrent && hasHistoric ? (currentRank as number) - (historicRank as number) : null;
                    const deltaText = delta === null ? '' : `${delta >= 0 ? '+' : ''}${delta}`;

                    return (
                      <td key={cellKey} className={cellClassName} data-highlight-cell={isHighlightedCell ? 'true' : undefined} style={{ ...cellWidthStyle, ...stickyCellStyle, ...resolvedColumnStyle, ...highlightedCellStyle, textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                          <span>{hasCurrent ? String(currentRank) : ''}</span>
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

                  if (key === 'comment') {
                    const returnerVal = readRowValue(row, 'returner');
                    const superReturnerVal = readRowValue(row, 'super_returner');
                    const eligibleRaw = readRowValue(row, 'event_eligible_appearances');
                    const localRaw = readRowValue(row, 'last_event_code_count_long');
                    const eligibleNum = Number(eligibleRaw) || 0;
                    const localNum = Number(localRaw) || 0;
                    const commentRaw = String(readRowValue(row, 'comment') || '');
                    const showCrown = ((eligibleNum > 10 || localNum > 20) && commentRaw === 'New PB!');

                    const commentStyle: React.CSSProperties = {
                      ...cellWidthStyle,
                      ...getColumnStyle(key, column.style)
                    };

                    if (String(returnerVal) === 'T') {
                      commentStyle.backgroundColor = '#dff0d8';
                    }
                    if (String(superReturnerVal) === 'T') {
                      commentStyle.fontWeight = '700';
                    }
                    if (showCrown) {
                      commentStyle.fontWeight = '700';
                    }

                    return <td key={cellKey} className={cellClassName} data-highlight-cell={isHighlightedCell ? 'true' : undefined} style={{ ...commentStyle, ...stickyCellStyle, ...highlightedCellStyle }}>{commentRaw}</td>;
                  }

                  return <td key={cellKey} className={cellClassName} data-highlight-cell={isHighlightedCell ? 'true' : undefined} style={{ ...cellWidthStyle, ...stickyCellStyle, ...resolvedColumnStyle, ...highlightedCellStyle }}>{String(readRowValue(row, key) ?? '')}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default EventTest;
