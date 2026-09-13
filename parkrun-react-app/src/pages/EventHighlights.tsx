import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  fetchEventHighlights,
  type EventHighlightsPerson,
  type EventHighlightsResponse
} from '../api/backendAPI';
import { navigateBackWithNavStack } from '../utils/navigationStack';

const palette = {
  purple: '#454180',
  gold: '#f1c84d',
  page: '#f5f1e8',
  white: '#ffffff',
  participant: '#3f447f',
  personalBest: '#46a3e5',
  firstTimers: '#18b6a7',
  volunteers: '#8dc74a',
  male: '#48a7e8',
  female: '#ef7a4d',
  unknown: '#cfd6df',
  ever: '#1fad8f',
  here: '#efc454',
  milestone10: '#46a3e5',
  milestone100: '#ef7a4d',
  milestone250: '#18b6a7',
  milestone500: '#8dc74a',
  milestone1000: '#454180',
  milestone50: '#e03d32',
  milestone25: '#8a42c7',
  chartBar: '#4d4b8a',
  chartPeak: '#e7be4d',
  ink: '#25304b',
  lightInk: '#52617e',
  panel: '#f8fbfe',
  border: '#d4d9e4'
} as const;

const buttonStyle: React.CSSProperties = {
  border: '1px solid rgba(0, 0, 0, 0.7)',
  background: '#ffffff',
  color: '#1f2937',
  borderRadius: '8px',
  padding: '0.45rem 0.85rem',
  fontSize: '0.9rem',
  fontWeight: 700,
  cursor: 'pointer'
};

const backButtonStyle: React.CSSProperties = {
  border: '1px solid rgba(0, 0, 0, 0.7)',
  background: '#ffffff',
  color: '#1f2937',
  borderRadius: '8px',
  width: '30px',
  height: '30px',
  padding: 0,
  fontSize: '1.05rem',
  fontWeight: 700,
  lineHeight: 1,
  display: 'inline-grid',
  placeItems: 'center',
  cursor: 'pointer'
};

const posterPanelStyle: React.CSSProperties = {
  background: palette.white,
  borderRadius: '8px',
  border: `1px solid ${palette.border}`,
  padding: '0.35rem 0.45rem'
};

const sectionTitleStyle: React.CSSProperties = {
  margin: '0 0 0.35rem',
  color: palette.purple,
  fontSize: '0.7rem',
  fontWeight: 900,
  letterSpacing: '0.02em',
  lineHeight: 1,
  fontFamily: 'Trebuchet MS, Segoe UI, sans-serif',
  textAlign: 'center',
  textTransform: 'uppercase'
};

const formatMetric = (value: number | string | null | undefined, decimals = 0): string => {
  if (value === null || value === undefined || value === '') return '--';
  if (typeof value === 'number') {
    return decimals > 0 ? value.toFixed(decimals) : String(Math.round(value));
  }
  const numeric = Number(value);
  if (Number.isFinite(numeric)) {
    return decimals > 0 ? numeric.toFixed(decimals) : String(Math.round(numeric));
  }
  return String(value);
};

const asCount = (value: number | string | null | undefined): number => {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
};

const titleCase = (value: string): string => {
  return value.replace(/(^|\s)([a-z])/g, (_match, prefix, char) => `${prefix}${String(char).toUpperCase()}`);
};

const joinNames = (names: string[]): string => names.filter(Boolean).join(', ');

const firstNameOnly = (name: string): string => {
  const trimmed = String(name || '').trim();
  if (!trimmed) return '';
  return trimmed.split(/\s+/)[0] || trimmed;
};

const firstNameAndSurnameInitial = (name: string): string => {
  const trimmed = String(name || '').trim();
  if (!trimmed) return '';
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0];
  const firstName = parts[0];
  const surname = parts[parts.length - 1];
  const initial = surname.charAt(0).toUpperCase();
  return initial ? `${firstName} ${initial}` : firstName;
};

const formatPercentValue = (value: number | string | null | undefined, decimals = 2): string => {
  if (value === null || value === undefined || value === '') return '--';
  const raw = String(value).trim();
  if (!raw) return '--';
  if (raw.endsWith('%')) return raw;
  const numeric = Number(raw);
  if (Number.isFinite(numeric)) {
    return `${numeric.toFixed(decimals)}%`;
  }
  return raw;
};

const ParkrunMark: React.FC = () => (
  <img
    src={`${process.env.PUBLIC_URL}/parkrun-wordmark.png`}
    alt="parkrun"
    style={{
      display: 'block',
      width: '1.42cm',
      height: 'auto'
    }}
  />
);

const DonutChart: React.FC<{
  total: number;
  centerValue: string;
  centerLabel: string;
  segments: Array<{ value: number; color: string }>;
  legends?: Array<{ label: string; value: number; color: string }>;
}> = ({ total, centerValue, centerLabel, segments, legends = [] }) => {
  const radius = 27;
  const circumference = 2 * Math.PI * radius;
  let running = 0;
  return (
    <div style={{ display: 'grid', justifyItems: 'center', gap: '0.1rem' }}>
      <svg width="69" height="69" viewBox="0 0 69 69" role="img" aria-label={centerLabel}>
        <circle cx="34.5" cy="34.5" r={radius} fill="none" stroke="#eef2f7" strokeWidth="10" />
        {segments.map((segment, index) => {
          const fraction = total > 0 ? segment.value / total : 0;
          const dash = fraction * circumference;
          const offset = -running * circumference;
          running += fraction;
          return (
            <circle
              key={`${segment.color}-${index}`}
              cx="34.5"
              cy="34.5"
              r={radius}
              fill="none"
              stroke={segment.color}
              strokeWidth="10"
              strokeDasharray={`${dash} ${circumference - dash}`}
              strokeDashoffset={offset}
              transform="rotate(-90 34.5 34.5)"
              strokeLinecap="butt"
            />
          );
        })}
        <circle cx="34.5" cy="34.5" r="17" fill="#ffffff" />
        <text x="34.5" y="32" textAnchor="middle" style={{ fill: palette.purple, fontWeight: 800, fontSize: '14px' }}>{centerValue}</text>
        <text x="34.5" y="41" textAnchor="middle" style={{ fill: palette.lightInk, fontWeight: 700, fontSize: '6.5px' }}>{centerLabel}</text>
      </svg>
      {legends.length > 0 ? (
        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.16rem', flexWrap: 'wrap' }}>
          {legends.map((legend) => (
            <span key={`${centerLabel}-${legend.label}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.1rem', background: legend.color, color: '#fff', borderRadius: '999px', padding: '0.02rem 0.14rem', fontSize: '0.36rem', fontWeight: 700, lineHeight: 1.2 }}>
              <span>{legend.label}</span>
              <span>{legend.value}</span>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
};

const MinuteBarChart: React.FC<{ buckets: Array<{ minute: number; label: string; count: number }> }> = ({ buckets }) => {
  const maxCount = buckets.reduce((best, row) => Math.max(best, row.count || 0), 0);
  const width = 330;
  const height = 112;
  const barWidth = buckets.length > 0 ? width / buckets.length : width;
  const peakMinute = buckets.reduce((best, row) => (row.count > best.count ? row : best), { minute: 0, label: '', count: -1 } as { minute: number; label: string; count: number });

  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Finishers per minute">
      <rect x="0" y="0" width={width} height={height} fill="#f6f7fb" rx="8" />
      {buckets.map((bucket, index) => {
        const h = maxCount > 0 ? Math.max(4, (bucket.count / maxCount) * 82) : 4;
        const x = index * barWidth + 1;
        const y = 88 - h;
        const isPeak = bucket.minute === peakMinute.minute && bucket.count === peakMinute.count;
        return <rect key={bucket.minute} x={x} y={y} width={Math.max(3, barWidth - 2)} height={h} rx="1.5" fill={isPeak ? palette.chartPeak : palette.chartBar} />;
      })}
      {buckets.filter((_bucket, index) => index % Math.max(1, Math.ceil(buckets.length / 7)) === 0).map((bucket, index) => {
        const x = buckets.length > 0 ? (index === 0 ? 3 : (buckets.findIndex((candidate) => candidate.minute === bucket.minute) * barWidth + 3)) : 0;
        return <text key={`tick-${bucket.minute}`} x={x} y="101" style={{ fontSize: '8px', fill: palette.lightInk, fontWeight: 700 }}>{bucket.label}</text>;
      })}
      <text x={width / 2} y="109" textAnchor="middle" style={{ fontSize: '8px', fill: palette.purple, fontWeight: 700 }}>Finish time (minutes)</text>
    </svg>
  );
};

const MilestoneRows: React.FC<{ items: EventHighlightsPerson[]; suffix: 'runs' | 'vols'; emptyText: string }> = ({ items, suffix, emptyText }) => {
  const groups = useMemo(() => {
    const grouped = new Map<number, EventHighlightsPerson[]>();
    items.forEach((item) => {
      const level = Number(item.milestone_level || 0);
      if (!level) return;
      const existing = grouped.get(level) || [];
      existing.push(item);
      grouped.set(level, existing);
    });
    return Array.from(grouped.entries()).sort((a, b) => b[0] - a[0]);
  }, [items]);

  if (groups.length === 0) {
    return <div style={{ ...posterPanelStyle, color: palette.lightInk, fontSize: '0.68rem' }}>{emptyText}</div>;
  }

  return (
    <div style={{ display: 'grid', gap: '0.22rem' }}>
      {groups.map(([level, people]) => (
        <div key={`${suffix}-${level}`} style={{ display: 'grid', gridTemplateColumns: '0.85cm 1fr', background: '#f4f5fb', borderRadius: '5px', border: '1px solid #dfe5f0', overflow: 'hidden' }}>
          <div style={{ background: level >= 50 ? palette.milestone50 : palette.milestone25, color: '#fff', fontWeight: 800, fontSize: '0.72rem', display: 'grid', placeItems: 'center', padding: '0.2rem 0.1rem' }}>{level}</div>
          <div style={{ padding: '0.18rem 0.32rem' }}>
            <div style={{ color: palette.lightInk, fontSize: '0.5rem', fontWeight: 700 }}>{level} {suffix}</div>
            <div style={{ color: palette.ink, fontSize: '0.68rem', fontWeight: 700, lineHeight: 1.15 }}>{people.map((person) => person.name).join(', ')}</div>
          </div>
        </div>
      ))}
    </div>
  );
};

const FirstFinisherRow: React.FC<{ label: string; color: string; person?: EventHighlightsPerson | null }> = ({ label, color, person }) => (
  <div style={{ display: 'grid', gridTemplateColumns: '0.85cm 1fr', background: '#f9fbff', borderRadius: '5px', border: `1px solid ${color}`, overflow: 'hidden' }}>
    <div style={{ background: color, color: '#fff', display: 'grid', placeItems: 'center', fontSize: '0.54rem', fontWeight: 800, textTransform: 'capitalize' }}>{label}</div>
    <div style={{ padding: '0.18rem 0.32rem' }}>
      <div style={{ color: palette.ink, fontSize: '0.7rem', fontWeight: 800, lineHeight: 1.1 }}>{person?.name || '--'}</div>
      <div style={{ color: palette.lightInk, fontSize: '0.58rem', fontWeight: 800, lineHeight: 1.1 }}>
        {[person?.age_group, person?.age_grade, person?.time].filter(Boolean).join('  •  ') || '--'}
      </div>
    </div>
  </div>
);

const EventHighlights: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const requestedEventCode = String(params.get('event_code') || '').trim();
  const requestedEventName = String(params.get('event_name') || '').trim();
  const requestedEventDate = String(params.get('event_date') || params.get('date') || '').trim();
  const requestedEventNumber = String(params.get('event_number') || '').trim();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<EventHighlightsResponse | null>(null);
  const [zoomPercent, setZoomPercent] = useState(100);

  useEffect(() => {
    if (!requestedEventDate || (!requestedEventCode && !requestedEventName)) {
      setError('Event course and date are required to load high-lights.');
      setData(null);
      return;
    }

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetchEventHighlights({
          eventCode: requestedEventCode || null,
          eventName: requestedEventName || null,
          eventDate: requestedEventDate
        });
        if (!cancelled) {
          setData(response);
        }
      } catch (err: any) {
        if (!cancelled) {
          setData(null);
          setError(String(err?.response?.data?.error || err?.message || 'Failed to load event high-lights'));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [requestedEventCode, requestedEventDate, requestedEventName]);

  const fallbackBackTarget = useMemo(() => {
    const nextParams = new URLSearchParams();
    const eventCodeValue = String(data?.event_code || requestedEventCode || '').trim();
    const eventDateValue = String(data?.event_date || requestedEventDate || '').trim();
    const eventNumberValue = String(data?.event_number || requestedEventNumber || '').trim();
    if (eventCodeValue) {
      nextParams.set('event_code', eventCodeValue);
    }
    if (eventDateValue) {
      nextParams.set('date', eventDateValue);
    }
    if (eventNumberValue) {
      nextParams.set('event_number', eventNumberValue);
    }
    return `/races${nextParams.toString() ? `?${nextParams.toString()}` : ''}`;
  }, [data?.event_code, data?.event_date, data?.event_number, requestedEventCode, requestedEventDate, requestedEventNumber]);

  const finishersByMinute = useMemo(() => {
    const buckets = data?.finishers_by_minute;
    return Array.isArray(buckets) ? buckets : [];
  }, [data?.finishers_by_minute]);
  const participants = asCount(data?.last_position ?? data?.participants);
  const volunteers = asCount(data?.volunteers);
  const pbTotal = asCount(data?.pb_breakdown?.total ?? data?.pb_count);
  const firstTimerTotal = asCount(data?.first_timer_breakdown?.total ?? data?.first_timers_count);
  const milestoneTotal = asCount(data?.milestone_breakdown?.total);
  const genderBreakdown = data?.gender_breakdown || {};
  const pbBreakdown = data?.pb_breakdown || {};
  const firstTimerBreakdown = data?.first_timer_breakdown || {};
  const milestoneBreakdown = data?.milestone_breakdown || {};
  const volunteerMilestoneItems = data?.volunteer_milestones || [];
  const milestoneItems = data?.milestone_people || [];
  const firstFinishers = data?.first_finishers || {};
  const firstTimerNames = data?.first_timer_names || data?.first_timers?.map((person) => person.name) || [];
  const volunteerNames = data?.volunteer_names || data?.volunteer_roster?.map((person) => person.name) || [];
  const posterDate = data?.event_date || requestedEventDate;
  const posterNumber = data?.event_number || requestedEventNumber;
  const posterName = titleCase(String(data?.event_name || requestedEventName || 'parkrun'));
  const topAgeGradeValue = data?.top_age_grade?.age_grade ?? data?.top_age_grade?.age_grade_value;
  const distanceCoveredKm = asCount(data?.distance_covered_km);
  const relayDays = distanceCoveredKm > 0 ? Math.round(distanceCoveredKm / 22.738095) : 0;
  const milestoneChartSegments = [
    { value: asCount(milestoneBreakdown['10']), color: palette.milestone10 },
    { value: asCount(milestoneBreakdown['25']), color: palette.milestone25 },
    { value: asCount(milestoneBreakdown['50']), color: palette.milestone50 },
    { value: asCount(milestoneBreakdown['100']), color: palette.milestone100 },
    { value: asCount(milestoneBreakdown['250']), color: palette.milestone250 },
    { value: asCount(milestoneBreakdown['500']), color: palette.milestone500 },
    { value: asCount(milestoneBreakdown['1000']), color: palette.milestone1000 }
  ].filter((segment) => segment.value > 0);
  const milestoneLegends = [
    { label: '10', value: asCount(milestoneBreakdown['10']), color: palette.milestone10 },
    { label: '25', value: asCount(milestoneBreakdown['25']), color: palette.milestone25 },
    { label: '50', value: asCount(milestoneBreakdown['50']), color: palette.milestone50 },
    { label: '100', value: asCount(milestoneBreakdown['100']), color: palette.milestone100 },
    { label: '250', value: asCount(milestoneBreakdown['250']), color: palette.milestone250 },
    { label: '500', value: asCount(milestoneBreakdown['500']), color: palette.milestone500 },
    { label: '1000', value: asCount(milestoneBreakdown['1000']), color: palette.milestone1000 }
  ].filter((legend) => legend.value > 0);

  return (
    <div className="page-content" style={{ padding: '0.9rem 0.75rem 2rem', background: palette.page, minHeight: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: '0.75rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => {
            const popped = navigateBackWithNavStack(navigate, location.pathname);
            if (!popped) {
              navigate(fallbackBackTarget);
            }
          }}
          title="Back"
          aria-label="Back"
          style={backButtonStyle}
        >
          ←
        </button>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', background: '#ffffff', border: '1px solid #d4d9e4', borderRadius: '999px', padding: '0.25rem 0.45rem' }}>
          <button
            type="button"
            onClick={() => setZoomPercent((current) => Math.max(60, current - 10))}
            style={{ ...buttonStyle, padding: '0.18rem 0.45rem', fontSize: '0.82rem', lineHeight: 1 }}
          >
            -
          </button>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', color: palette.ink, fontSize: '0.82rem', fontWeight: 700 }}>
            Zoom
            <input
              type="range"
              min={60}
              max={140}
              step={10}
              value={zoomPercent}
              onChange={(event) => setZoomPercent(Number(event.target.value))}
              style={{ width: '5.5rem' }}
            />
          </label>
          <div style={{ minWidth: '2.3rem', textAlign: 'right', color: palette.purple, fontSize: '0.82rem', fontWeight: 800 }}>{zoomPercent}%</div>
          <button
            type="button"
            onClick={() => setZoomPercent((current) => Math.min(140, current + 10))}
            style={{ ...buttonStyle, padding: '0.18rem 0.45rem', fontSize: '0.82rem', lineHeight: 1 }}
          >
            +
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ ...posterPanelStyle, color: '#334155', width: '9.3cm', maxWidth: 'calc(100vw - 1rem)', margin: '0' }}>Loading event high-lights…</div>
      ) : null}

      {!loading && error ? (
        <div style={{ ...posterPanelStyle, color: '#991b1b', width: '9.3cm', maxWidth: 'calc(100vw - 1rem)', margin: '0' }}>{error}</div>
      ) : null}

      {!loading && !error && data ? (
        <div style={{ width: '9.74cm', maxWidth: 'calc(100vw - 0.6rem)', minHeight: '19.5cm', margin: '0', background: palette.page, color: palette.ink, boxShadow: '0 10px 24px rgba(15, 23, 42, 0.16)', fontFamily: 'Trebuchet MS, Segoe UI, sans-serif', zoom: `${zoomPercent}%`, transformOrigin: 'top left' }}>
          <div style={{ background: palette.purple, color: '#fff', minHeight: '1.9cm', height: '1.9cm', padding: '0.18rem 0.55rem 0.22rem', borderBottom: `3px solid ${palette.gold}`, display: 'grid', alignContent: 'center', justifyItems: 'center', gap: '0.04rem', boxSizing: 'border-box' }}>
            <ParkrunMark />
            <div style={{ textAlign: 'center', fontSize: '0.88rem', fontWeight: 800, lineHeight: 1.05 }}>{posterName} parkrun</div>
            <div style={{ textAlign: 'center', fontSize: '0.64rem', fontWeight: 800, color: palette.gold, lineHeight: 1 }}>{posterNumber ? `#${posterNumber}` : ''} {posterNumber ? '•' : ''} {posterDate}</div>
          </div>

          <div style={{ padding: '0.38rem', display: 'grid', gap: '0.45rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.14rem' }}>
              {[
                { label: 'Participants', value: participants, color: palette.participant },
                { label: 'Personal Best', value: pbTotal, color: palette.personalBest },
                { label: 'First Timers', value: firstTimerTotal, color: palette.firstTimers },
                { label: 'Hi-Viz Heroes', value: volunteers, color: palette.volunteers }
              ].map((card) => (
                <div key={card.label} style={{ background: card.color, color: '#fff', borderRadius: '5px', padding: '0.16rem 0.15rem 0.18rem', textAlign: 'center', minHeight: '0.98cm', display: 'grid', alignContent: 'center' }}>
                  <div style={{ fontSize: '1.18rem', fontWeight: 900, lineHeight: 1 }}>{card.value}</div>
                  <div style={{ fontSize: '0.45rem', fontWeight: 700, lineHeight: 1.15 }}>{card.label}</div>
                </div>
              ))}
            </div>

            <div style={{ borderTop: `2px solid ${palette.gold}`, paddingTop: '0.24rem', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.06rem' }}>
              <DonutChart
                total={participants}
                centerValue={String(participants)}
                centerLabel="Gender"
                segments={[
                  { value: asCount(genderBreakdown.male), color: palette.male },
                  { value: asCount(genderBreakdown.female), color: palette.female },
                  { value: asCount(genderBreakdown.unknown), color: palette.unknown }
                ]}
                legends={[
                  { label: 'M', value: asCount(genderBreakdown.male), color: palette.male },
                  { label: 'F', value: asCount(genderBreakdown.female), color: palette.female }
                ]}
              />
              <DonutChart
                total={Math.max(1, pbTotal)}
                centerValue={String(pbTotal)}
                centerLabel="PBs"
                segments={[
                  { value: asCount(pbBreakdown.male), color: palette.male },
                  { value: asCount(pbBreakdown.female), color: palette.female }
                ]}
                legends={[
                  { label: 'M', value: asCount(pbBreakdown.male), color: palette.male },
                  { label: 'F', value: asCount(pbBreakdown.female), color: palette.female }
                ]}
              />
              <DonutChart
                total={Math.max(1, firstTimerTotal)}
                centerValue={String(firstTimerTotal)}
                centerLabel="1st Timers"
                segments={[
                  { value: asCount(firstTimerBreakdown.ever), color: palette.ever },
                  { value: asCount(firstTimerBreakdown.here), color: palette.here }
                ]}
                legends={[
                  { label: 'Ever', value: asCount(firstTimerBreakdown.ever), color: palette.ever },
                  { label: 'Here', value: asCount(firstTimerBreakdown.here), color: palette.here }
                ]}
              />
              <DonutChart
                total={Math.max(1, milestoneTotal)}
                centerValue={String(milestoneTotal)}
                centerLabel="Milestones"
                segments={milestoneChartSegments.length > 0 ? milestoneChartSegments : [{ value: 1, color: '#eef2f7' }]}
                legends={milestoneLegends}
              />
            </div>

            <div style={{ borderTop: `2px solid ${palette.gold}`, borderBottom: `2px solid ${palette.gold}`, padding: '0.22rem 0' }}>
              <div style={{ ...posterPanelStyle, background: '#eef9fb', borderColor: '#36b3a6', paddingTop: '0.2rem' }}>
                <div style={{ color: '#36b3a6', fontSize: '0.7rem', fontWeight: 800, textAlign: 'center', lineHeight: 1.1, marginBottom: '0.12rem' }}>
                  First timers at {posterName} parkrun
                </div>
                <div style={{ fontSize: '0.63rem', lineHeight: 1.2, fontWeight: 700, color: palette.ink }}>
                  {joinNames(firstTimerNames.map(firstNameOnly)) || 'No first timers recorded.'}
                </div>
              </div>
            </div>

            <div>
              <div style={sectionTitleStyle}>Milestones</div>
              <MilestoneRows items={milestoneItems} suffix="runs" emptyText="No participant milestones recorded." />
            </div>

            <div style={{ borderTop: `2px solid ${palette.gold}`, paddingTop: '0.28rem' }}>
              <div style={sectionTitleStyle}>First finishers</div>
              <div style={{ display: 'grid', gap: '0.18rem' }}>
                <FirstFinisherRow label="Male" color={palette.male} person={firstFinishers.male} />
                <FirstFinisherRow label="Female" color={palette.female} person={firstFinishers.female} />
              </div>
            </div>

            <div style={{ borderTop: `2px solid ${palette.gold}`, paddingTop: '0.28rem' }}>
              <div style={sectionTitleStyle}>Finishers per minute</div>
              <div style={{ ...posterPanelStyle, padding: '0.28rem 0.22rem' }}>
                <MinuteBarChart buckets={finishersByMinute} />
              </div>
            </div>

            <div style={{ borderTop: `2px solid ${palette.gold}`, paddingTop: '0.28rem' }}>
              <div style={sectionTitleStyle}>Statistics</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.18rem', alignItems: 'end' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ color: palette.purple, fontSize: '0.98rem', fontWeight: 900 }}>{formatPercentValue(topAgeGradeValue, 2)}</div>
                  <div style={{ color: palette.lightInk, fontSize: '0.46rem', fontWeight: 800, letterSpacing: '0.01em' }}>Top Age Grade</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ color: palette.purple, fontSize: '0.98rem', fontWeight: 900 }}>{formatMetric(data?.avg_age, 0)}</div>
                  <div style={{ color: palette.lightInk, fontSize: '0.46rem', fontWeight: 800, letterSpacing: '0.01em' }}>Average Age</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ color: palette.purple, fontSize: '0.98rem', fontWeight: 900 }}>{volunteers}</div>
                  <div style={{ color: palette.lightInk, fontSize: '0.46rem', fontWeight: 800, letterSpacing: '0.01em' }}>Hi-Viz Heroes</div>
                </div>
              </div>
            </div>

            <div style={{ borderTop: `2px solid ${palette.gold}`, paddingTop: '0.34rem' }}>
              <div style={sectionTitleStyle}>Volunteers</div>
              <div style={{ ...posterPanelStyle, background: '#f7fbff', fontSize: '0.62rem', lineHeight: 1.2, fontWeight: 700 }}>{joinNames(volunteerNames.map(firstNameAndSurnameInitial)) || 'Volunteer roster unavailable.'}</div>
            </div>

            <div>
              <div style={sectionTitleStyle}>Volunteer milestones</div>
              <MilestoneRows items={volunteerMilestoneItems} suffix="vols" emptyText="No volunteer milestones recorded." />
            </div>
          </div>

          <div style={{ background: palette.purple, color: '#fff', textAlign: 'center', padding: '0.36rem 0.4rem 0.42rem', marginTop: '0.2rem', minHeight: '1.35cm', display: 'grid', alignContent: 'center' }}>
            <div style={{ fontSize: '0.54rem', fontWeight: 700, opacity: 0.88 }}>Together we covered</div>
            <div style={{ fontSize: '0.98rem', fontWeight: 900, lineHeight: 1 }}>{formatMetric(distanceCoveredKm)}km today.</div>
            <div style={{ fontSize: '0.62rem', fontWeight: 800, color: '#ffffff', lineHeight: 1.1, marginTop: '0.08rem' }}>
              Enough to complete a relay
            </div>
            <div style={{ fontSize: '0.86rem', fontWeight: 900, color: palette.gold, lineHeight: 1.1 }}>
              around the Earth in {relayDays} days!
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default EventHighlights;