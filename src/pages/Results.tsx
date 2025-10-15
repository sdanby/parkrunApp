import React, { useEffect, useState, useRef } from 'react';
import { fetchResults ,fetchAllResults} from '../api/parkrunAPI';
import './ResultsTable.css'; // Create this CSS file for sticky headers
import { formatDate,formatDate1,formatDate2,formatAvgTime,formatDateToDDMMYYYY } from '../utilities'; // Utility function to format dates

const queryOptions = [
    { value: 'recent', label: 'Recent Events' },
    { value: 'last50', label: 'Last 50 Events' },
    { value: 'since-lockdown', label: 'Since Lockdown' },
    { value: 'all', label: 'All Events' },
    { value: 'Annual', label: 'Annual'},
    { value: 'Qseason', label: 'Qtr Seasonality'},
    { value: 'Mseason', label: 'Mnth Seasonality'},
    // Add more options here as needed
];
const analysisOptions = [
    { value: 'participants', label: 'Participants' },
    { value: '%Participants', label: '%Participants' },
    { value: '%Total', label: '%Total' },
    { value: 'Times', label: 'Times' },
    { value: 'Age', label: 'Age' },

    // Add more options here as needed
];
// Short help text for various option values. Use these in the hover tooltip.
const helpTextMap: { [key: string]: string } = {
    participants: 'Number of parkrunners/walkers recorded at each event. Aggregations operate on counts.',
    '%Participants': 'Dive.',
    Times: 'The participants event times - aggregated across the event using - Average, Maximum, Minimum etc.',
    Age: 'The participants calculated age* - aggregated across the event using - Average, Maximum, Minimum etc. * note that age is approximate and accuracy depends on the number of observations',
    all: 'All participants at the event.',
    Tourist: 'Participants flagged as tourists (visitors). A tourist run is assigned to a parkrunner if over a period of 15 previous events, it is not the most frequetly attended event',
    volunteers: 'Number of volunteers recorded for the event.',
    eventNumber: 'Event-specific number identifier (only numeric). Not suitable for percent mode.',
    coeff: 'Seasonal hardness coefficient. This is calculated by comparing the ratio of the fastest run in',
    avg: 'Average aggregation (mean).',
    total: 'Sum across selected dates or events.',
    max: 'Maximum value observed across the selected period.',
    min: 'Minimum value observed across the selected period.',
    range: 'Difference between maximum and minimum values (presented as percent points for %Participants).',
    growth: 'Linear slope (least-squares) showing trend across the selected dates.'
};

// Small tooltip component that shows short help text for control options and supports a 'More' drilldown
const HelpTooltip: React.FC<{ label: string; options: { value: string; label: string }[] }> = ({ label, options }) => {
    const [expanded, setExpanded] = useState<string | null>(null);
    const [open, setOpen] = useState(false);
    const wrapperRef = useRef<HTMLSpanElement | null>(null);

    useEffect(() => {
        const onDocClick = (e: any) => {
            if (!open) return;
            if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
                setOpen(false);
            }
        };
        document.addEventListener('click', onDocClick);
        return () => document.removeEventListener('click', onDocClick);
    }, [open]);

    const toggle = (e: React.MouseEvent) => {
        e.stopPropagation();
        setOpen(s => !s);
    };

    return (
        <span className={`help-tooltip${open ? ' open' : ''}`} ref={wrapperRef}>
            <button
                type="button"
                aria-label={`${label} help`}
                aria-expanded={open}
                className="help-trigger"
                onClick={toggle}
                onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false); }}
            >
                ?
            </button>
            <div className="help-content" role="dialog" aria-hidden={!open}>
                <div className="help-title">{label} - quick help</div>
                <div className="close-x" onClick={() => setOpen(false)} aria-label="Close">✕</div>
                <div style={{ marginTop: 6 }}>
                    {options.slice(0, 8).map(opt => (
                        <div key={opt.value} className="help-item"><span className="help-key">{opt.label}</span><span className="help-desc">{helpTextMap[opt.value] || ''}</span></div>
                    ))}
                </div>
                {expanded ? (
                    <div style={{ marginTop: 6 }}>
                        <div style={{ fontSize: '0.85em' }}>{helpTextMap[expanded]}</div>
                        <div className="more-link" onClick={() => setExpanded(null)}>Less</div>
                    </div>
                ) : (
                    <div className="more-link" onClick={() => setExpanded(options[0]?.value || null)}>More...</div>
                )}
            </div>
        </span>
    );
};
const filterOptions = [
    { value: 'all', label: 'All' },
    { value: 'sex', label: 'Sex' },
    { value: 'tourist', label: 'Tourist'},
    { value: 'volunteers', label: 'Volunteers' },
    { value: 'eventNumber', label: 'Event Number' },
    { value: 'coeff', label: 'Seasonal Hardness' },
    { value: 'regs', label: 'Regulars' },
    { value: 'sTourist', label: 'Super Tourist'},
    // removed super-regular filter
    { value: '1time', label: 'First Timers' },
    { value: 'returners', label: 'Returners'},
    { value: 'clubs', label: 'Clubs' },
    { value: 'top10n', label: 'Top 10' },
    { value: 'top10p', label: 'Top 10%'},
    { value: 'last25n', label: 'Last 25' },
    { value: 'last25p', label: 'Last 25%' },
    { value: '15pc', label: '15% consistency' },
    { value: '10pc', label: '10% consistency'},
    { value: '5pc', label: '5% consistency' },
    { value: 'unknown', label: 'Unknown'},  
];
// Specific filter lists per analysis Type
const participantFilterOptions = [
    { value: 'all', label: 'All' },
    { value: 'eventNumber', label: 'Event Number' },
    { value: 'coeff', label: 'Seasonal Hardness' },
    { value: 'volunteers', label: 'Volunteers' },
    { value: 'tourist', label: 'Tourists' },
    { value: 'sTourist', label: 'Super Tourists' },
    { value: '1time', label: 'First Timers' },
    { value: 'clubs', label: 'Clubbers' },
    { value: 'pb', label: 'PBs' },
    { value: 'recentBest', label: 'Recent Bests' },
    { value: 'regs', label: 'Regulars' },
    { value: 'returners', label: 'Returners' },
    { value: 'eligible_time', label: 'Eligible Times' },
    { value: 'unknown', label: 'Unknowns' }
];
// For %Participants and %Total show the same filter list as Participants per requirement
const percentParticipantFilterOptions = participantFilterOptions.slice();
const percentTotalFilterOptions = participantFilterOptions.slice();
const timesFilterOptions = [
    { value: 'all', label: 'All' },
    { value: 'tourist', label: 'Tourist' },
    { value: 'regs', label: 'Regulars' },
    { value: 'sTourist', label: 'Super Tourists' },
    // removed super-regular filter
    { value: '1time', label: 'First Timers' },
    { value: 'returners', label: 'Returners' },
    { value: 'clubs', label: 'Clubs' },
    { value: 'top10n', label: 'Top 10' },
    { value: 'top10p', label: 'Top 10%' },
    { value: 'last25n', label: 'Last 25' },
    { value: 'last25p', label: 'Last 25%' },
    { value: '15pc', label: '15% consistency' },
    { value: '10pc', label: '10% consistency' },
    { value: '5pc', label: '5% consistency' },
    { value: 'unknown', label: 'Unknown' },
];
// For Age analysis exclude volunteers, eventNumber and seasonal hardness
const ageFilterOptions = participantFilterOptions.filter(o => !['volunteers', 'eventNumber', 'coeff'].includes(o.value));
const avgOptions = [
    { value: 'none', label: 'No Adjustment' },
    { value: 'hardness', label: 'Hardness Adjusted' },
    { value: 'age', label: 'Age Adjusted' },
    { value: 'both', label: 'Hardness and Age Adjusted' },
];
const aggOptions = [
    { value: 'avg', label: 'Average' },
    { value: 'total', label: 'Total' },
    { value: 'max', label: 'Maximum' },
    { value: 'min', label: 'Minimum' },
    { value: 'range', label: 'Range' },
    { value: 'growth', label: 'Growth' },
];
const cellAggOptions = [
    { value: 'single', label: 'Single Value' },
    { value: 'avg', label: 'Average' },
];
const eventMilestones = new Set([50, 100, 150, 200, 250, 300, 400, 500, 600, 700, 750, 800, 900, 1000]);


// Aggregate an array of result rows by month (seasonality). Each returned row represents one event_code for a month name (Jan..Dec)
function aggregateResultsByMonth(rows: any[]): any[] {
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const byEventMonth: { [key: string]: any[] } = {};
    rows.forEach(r => {
        let mon = '';
        try {
            // If event_date is DD/MM/YYYY
            if (typeof r.event_date === 'string' && r.event_date.includes('/')) {
                const parts = r.event_date.split('/');
                mon = months[Number(parts[1]) - 1];
            } else if (typeof r.event_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.event_date)) {
                // ISO YYYY-MM-DD
                const m = Number(r.event_date.slice(5,7));
                mon = months[m - 1];
            }
        } catch (e) {
            mon = '';
        }
        const key = `${r.event_code}::${mon}`;
        if (!byEventMonth[key]) byEventMonth[key] = [];
        byEventMonth[key].push(r);
    });
    const out: any[] = [];
    Object.keys(byEventMonth).forEach(key => {
        const parts = key.split('::');
        const code = parts[0];
        const mon = parts[1];
        const group = byEventMonth[key];
    const numericFields = ['last_position', 'volunteers', 'event_number', 'coeff', 'obs', 'coeff_event', 'avg_time', 'avgtimelim12', 'avgtimelim5', 'tourist_count', 'super_tourist_count', 'regulars', 'avg_age'];
        const agg: any = {
            event_code: code,
            event_name: group[0]?.event_name || code,
            event_date: mon // use month name
        };
        numericFields.forEach(f => {
            const rawVals = group.map((g: any) => g[f]).filter((v: any) => {
                if (v === null || v === undefined || v === '') return false;
                const num = Number(v);
                if (isNaN(num)) return false;
                if (f === 'event_number') {
                    return num > 0 && num <= 10000;
                }
                return true;
            });
            const vals = rawVals.map((v: any) => Number(v));
            agg[f] = vals.length > 0 ? (vals.reduce((a: number, b: number) => a + b, 0) / vals.length) : null;
        });
        out.push(agg);
    });
    // Ensure month order Jan..Dec
    const monthsOrder = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    out.sort((a,b) => monthsOrder.indexOf(a.event_date) - monthsOrder.indexOf(b.event_date));
    return out;
}

// Aggregate rows by quarter (Q1..Q4)
function aggregateResultsByQuarter(rows: any[]): any[] {
    const quarters = ['Q1','Q2','Q3','Q4'];
    const byEventQuarter: { [key: string]: any[] } = {};
    rows.forEach(r => {
        let q = '';
        try {
            if (typeof r.event_date === 'string' && r.event_date.includes('/')) {
                const parts = r.event_date.split('/');
                const m = Number(parts[1]);
                const qi = Math.max(1, Math.min(4, Math.ceil(m / 3)));
                q = quarters[qi - 1];
            } else if (typeof r.event_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.event_date)) {
                const m = Number(r.event_date.slice(5,7));
                const qi = Math.max(1, Math.min(4, Math.ceil(m / 3)));
                q = quarters[qi - 1];
            }
        } catch (e) {
            q = '';
        }
        const key = `${r.event_code}::${q}`;
        if (!byEventQuarter[key]) byEventQuarter[key] = [];
        byEventQuarter[key].push(r);
    });
    const out: any[] = [];
    Object.keys(byEventQuarter).forEach(key => {
        const parts = key.split('::');
        const code = parts[0];
        const quarter = parts[1];
        const group = byEventQuarter[key];
    const numericFields = ['last_position', 'volunteers', 'event_number', 'coeff', 'obs', 'coeff_event', 'avg_time', 'avgtimelim12', 'avgtimelim5', 'tourist_count', 'super_tourist_count', 'regulars', 'avg_age'];
        const agg: any = {
            event_code: code,
            event_name: group[0]?.event_name || code,
            event_date: quarter // use quarter label
        };
        numericFields.forEach(f => {
            const rawVals = group.map((g: any) => g[f]).filter((v: any) => {
                if (v === null || v === undefined || v === '') return false;
                const num = Number(v);
                if (isNaN(num)) return false;
                if (f === 'event_number') {
                    return num > 0 && num <= 10000;
                }
                return true;
            });
            const vals = rawVals.map((v: any) => Number(v));
            agg[f] = vals.length > 0 ? (vals.reduce((a: number, b: number) => a + b, 0) / vals.length) : null;
        });
        out.push(agg);
    });
    // Ensure quarter order Q1..Q4
    out.sort((a,b) => ['Q1','Q2','Q3','Q4'].indexOf(a.event_date) - ['Q1','Q2','Q3','Q4'].indexOf(b.event_date));
    return out;
}
// Aggregate an array of result rows by year. Each returned row represents one event_code for a year.
function aggregateResultsByYear(rows: any[]): any[] {
    // rows expected to have event_date like 'DD/MM/YYYY' or ISO; try to extract year robustly
    const byEventYear: { [key: string]: any[] } = {};
    rows.forEach(r => {
        let yr = '';
        try {
            // If event_date is DD/MM/YYYY
            if (typeof r.event_date === 'string' && r.event_date.includes('/')) {
                const parts = r.event_date.split('/');
                yr = parts[2];
            } else if (typeof r.event_date === 'string' && r.event_date.length >= 4) {
                // ISO-like YYYY-MM-DD
                yr = r.event_date.slice(0, 4);
            }
        } catch (e) {
            yr = '';
        }
        const key = `${r.event_code}::${yr}`;
        if (!byEventYear[key]) byEventYear[key] = [];
        byEventYear[key].push(r);
    });

    const out: any[] = [];
    Object.keys(byEventYear).forEach(key => {
        const parts = key.split('::');
        const code = parts[0];
        const year = parts[1];
        const group = byEventYear[key];
        // Aggregate numeric fields by average
    const numericFields = ['last_position', 'volunteers', 'event_number', 'coeff', 'obs', 'coeff_event', 'avg_time', 'avgtimelim12', 'avgtimelim5', 'tourist_count', 'super_tourist_count', 'regulars', 'avg_age'];
        const agg: any = {
            event_code: code,
            event_name: group[0]?.event_name || code,
            event_date: year // use year as the date value for the table
        };
        numericFields.forEach(f => {
            // collect raw values, ignore null/undefined/empty and non-numeric
            // For event_number specifically, also ignore absurdly large values > 10000
            const rawVals = group.map((g: any) => g[f]).filter((v: any) => {
                if (v === null || v === undefined || v === '') return false;
                const num = Number(v);
                if (isNaN(num)) return false;
                if (f === 'event_number') {
                    return num > 0 && num <= 10000;
                }
                return true;
            });
            const vals = rawVals.map((v: any) => Number(v));
            // if no valid values, set to null so display logic treats it as missing
            agg[f] = vals.length > 0 ? (vals.reduce((a: number, b: number) => a + b, 0) / vals.length) : null;
        });
        out.push(agg);
    });
    // Sort years descending so latest years appear first in the table
    out.sort((a, b) => Number(b.event_date) - Number(a.event_date));
    return out;
}

// Safely format header date values. If `query` is 'Annual' we expect year strings and return them directly.
function formatHeaderDate(date: any, query: string): string {
    // For Annual (year strings) and Monthly seasonality (month names) return the value directly
    if (query === 'Annual' || query === 'Mseason' || query === 'Qseason') return String(date ?? '');
    if (!date) return '';
    // If date is not a string, coerce to string to avoid downstream errors
    if (typeof date !== 'string') return String(date);
    // If date looks like a year-only string (4 digits), just return it
    if (/^\d{4}$/.test(date)) return date;
    // If date is ISO (YYYY-MM-DD), convert to DD/MM/YYYY for formatDate2
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return formatDateToDDMMYYYY(date);
    }
    // Otherwise assume it's DD/MM/YYYY already and return formatted version via formatDate2
    try {
        return formatDate2(date);
    } catch (e) {
        // fallback to a safe string
        return String(date);
    }
}

const Results: React.FC = () => {
    const [results, setResults] = useState<any[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
        const [error, setError] = useState<string | null>(null);
    const [query, setQuery] = useState<string>('recent');
    const [sortBy, setSortBy] = useState<'event' | 'total'>('event');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
    //nst [aggregation, setAggregation] = useState<'total' | 'average'>('total');
    const [analysisType, setAnalysisType] = useState<string>('participants');
    const [avgType, setAvgType] = useState<string>('none');
    const [filterType, setFilterType] = useState<string>('all');
    const [aggType, setAggType] = useState<string>('avg');
    const [cellAgg, setCellAgg] = useState<string>('single');

    useEffect(() => {
        const getResults = async () => {
            setLoading(true);
            try {
                let data;
                if (query === 'all') {
                    data = await fetchAllResults();
                } else if (query === 'Annual') {
                    // Fetch all results then aggregate by year
                    const all = await fetchAllResults();
                    data = aggregateResultsByYear(Array.isArray(all) ? all : []);
                    // default Cell Agg to average for annual view
                    setCellAgg('avg');
                } else if (query === 'Mseason') {
                    // Monthly seasonality: fetch all and aggregate by month
                    const all = await fetchAllResults();
                    data = aggregateResultsByMonth(Array.isArray(all) ? all : []);
                    setCellAgg('avg');
                } else if (query === 'Qseason') {
                    // Quarterly seasonality: fetch all and aggregate by quarter
                    const all = await fetchAllResults();
                    data = aggregateResultsByQuarter(Array.isArray(all) ? all : []);
                    setCellAgg('avg');
                } else if (query === 'last50') {
                    data = await fetchResults(50);
                } else if (query === 'since-lockdown') {
                    // fetch results from 2021-07-24 onwards
                    data = await fetchResults('2021-07-24');
                } else {
                    data = await fetchResults();
                }
                setResults(Array.isArray(data) ? data : []);
            } catch (err) {
                setError('Failed to fetch results');
            } finally {
                setLoading(false);
            }
        };
        getResults();
    }, [query]);
    useEffect(() => {
        // When analysis type is not Times, force no time adjustment and reset filter to safe default
        if (analysisType !== 'Times' && avgType !== 'none') {
            setAvgType('none');
            setFilterType('all');
        }
    }, [analysisType, avgType]);
    useEffect(() => {
        // Ensure aggType remains valid when analysisType or filterType change
        // Implemented inline here so the hook order is stable (must run before any early returns)  
        let allowed: string[];
    if (analysisType === 'Times') {
            allowed = ['avg', 'max', 'min'];
            // allow growth for numeric aggregates (Times uses slope of avg_time)
            allowed.push('growth');
        } else if (filterType === 'eventNumber') {
                allowed = ['avg', 'max', 'min', 'range'];
                allowed.push('growth');
        } else if (analysisType === 'participants' && filterType === 'coeff') {
            allowed = ['avg', 'max', 'min', 'range'];
        } else {
                allowed = ['avg', 'total', 'max', 'min', 'range'];
                allowed.push('growth');
        }
        if (!allowed.includes(aggType)) {
            setAggType(allowed[0]);
        }
    }, [analysisType, filterType]);
    useEffect(() => {
            // Reset filterType if it isn't valid for the selected analysisType
        const allowedFilters = analysisType === 'Times'
            ? timesFilterOptions.map(o => o.value)
            : (analysisType === 'Age' ? ageFilterOptions.map(o => o.value) : participantFilterOptions.map(o => o.value));
        if (!allowedFilters.includes(filterType)) {
            setFilterType(allowedFilters[0]);
        }
    }, [analysisType]);
    useEffect(() => {
    // Default cellAgg based on analysisType when Type changes.
    // Do not override when viewing Annual/Mseason/Qseason (these force 'avg').
    if (['Annual', 'Mseason', 'Qseason'].includes(query)) return;
    setCellAgg(analysisType === 'Times' ? 'avg' : 'single');
    }, [analysisType]);

    // When Period is Annual, force Cell Agg to 'avg' and keep it consistent
    useEffect(() => {
        if (['Annual', 'Mseason', 'Qseason'].includes(query)) {
            setCellAgg('avg');
        }
    }, [query]);

    if (loading) return <div>Loading...</div>;
    if (error) return <div>{error}</div>;
    if (!results.length) return <div>No results found.</div>;


// Helper function to get allowed aggTypes
function getAllowedAggTypes(analysisType: string, filterType: string): string[] {
    // For %Participants and %Total we don't allow Total or Growth (percent-of-column should be a simple aggregate)
    if (analysisType === '%Participants') {
        // allow growth for %Participants to show trend of the percentage over time
        return ['avg', 'max', 'min', 'range', 'growth'];
    }
    if (analysisType === '%Total') {
        // allow Total for %Total mode
        return ['avg', 'total', 'max', 'min', 'range'];
    }
    if (analysisType === 'Times') {
        return ['avg', 'max', 'min', 'growth'];
    }
    // For Age, don't allow 'total' as it doesn't make sense for averages
    if (analysisType === 'Age') {
        return ['avg', 'max', 'min', 'range', 'growth'];
    }
    // When filtering by event number we can't show 'total'
    if (filterType === 'eventNumber') {
        return ['avg', 'max', 'min', 'range', 'growth']; // 'total' not allowed
    }
    // Don't allow 'total' when viewing Participants with Seasonal Hardness (coeff)
    if (analysisType === 'participants' && filterType === 'coeff') {
        return ['avg', 'max', 'min', 'range', 'growth'];
    }
    return ['avg', 'total', 'max', 'min', 'range', 'growth'];
}  
// Helper to compute the second-column header label (short forms for Range/Growth)
function getSecondColumnHeaderLabel(analysisType: string, aggType: string): string {
    if (aggType === 'growth') return 'Grth';
    if (aggType === 'range') return 'Rng';
    // Use short labels for both Times and Participants
    if (aggType === 'avg') return 'Avg';
    if (aggType === 'total') return 'Total';
    if (aggType === 'max') return 'Max';
    if (aggType === 'min') return 'Min';
    return '';
}
function getAggregatedValueForDate(
    lookup: { [date: string]: { [code: string]: number } },
    date: string,
    eventCodes: string[],
    aggregation: string
    , precision?: number
): number {
    let values;
    // Special filter for event_number
    // Collect raw values (accept numbers or numeric strings), ignore null/undefined/empty
    // Build raw values, excluding codes where there was no event (when in granular view)
    const rawVals = eventCodes
        .map(code => ({ code, val: lookup[date]?.[code], en: event_number?.[date]?.[code] }))
        .filter(item => {
            // ignore truly missing values
            if (item.val === null || item.val === undefined) return false;
            if (typeof item.val === 'string' && item.val === '') return false;
            // If we're in a granular view, ignore codes/dates with no event_number (no event)
            if (!['Annual', 'Mseason', 'Qseason'].includes(query)) {
                if (typeof item.en !== 'number') return false;
            }
            return true;
        })
        .map(item => item.val);
    if (lookup === event_number) {
        // event_number: coerce and ignore zeros and absurd values
        values = rawVals
            .map(v => Number(v))
            .filter(v => !isNaN(v) && v !== 0 && v <= 10000);
    } else {
        // For other lookups, coerce numeric-like values and include zeros
        values = rawVals
            .map(v => Number(v))
            .filter(v => !isNaN(v));
    }

    const sum = values.reduce((acc, val) => acc + val, 0);
    const count = values.length;

    if (aggregation === 'average' || aggregation === 'avg') {
        if (lookup === coeff) {
            // For coeff, keep two decimals
            return count > 0 ? Number((sum / count).toFixed(4)) : 0;
        } else {
            // For others, round to whole number unless precision provided
            if (typeof precision === 'number') {
                return count > 0 ? Number((sum / count).toFixed(precision)) : 0;
            }
            return count > 0 ? Math.round(sum / count) : 0;
        }
    } else if (aggregation === 'max') {
        return count > 0 ? Math.max(...values) : 0;
        } else if (aggregation === 'min') {
            return count > 0 ? Math.min(...values) : 0;
        } else if (aggregation === 'range') {
            if (count > 0) {
                const rangeVal = Math.max(...values) - Math.min(...values);
                // For coeff (seasonal hardness) we want a coefficient-like result
                // so add 1 to the range (e.g. 0.04 -> 1.04) so formatCoeff yields a positive percent
                return lookup === coeff ? rangeVal + 1 : rangeVal;
            }
            return 0;
    } else {
        return sum;
    }
}
function getAggregatedTotalForCode(
    lookup: { [date: string]: { [code: string]: number } },
    eventDates: string[],
    code: string,
    aggregation: string
    , precision?: number
): number {
    let values;
    // Collect raw per-date values for this code; accept numeric or numeric strings
    // Build per-date raw values for this code, excluding dates with no event in granular view
    const rawVals2 = eventDates
        .map(d => ({ date: d, val: lookup[d]?.[code], en: event_number?.[d]?.[code] }))
        .filter(item => {
            if (item.val === null || item.val === undefined) return false;
            if (typeof item.val === 'string' && item.val === '') return false;
            if (!['Annual', 'Mseason', 'Qseason'].includes(query)) {
                if (typeof item.en !== 'number') return false;
            }
            return true;
        })
        .map(item => item.val);
    if (lookup === event_number) {
        values = rawVals2
            .map(v => Number(v))
            .filter(v => !isNaN(v) && v !== 0 && v <= 10000);
    } else {
        values = rawVals2
            .map(v => Number(v))
            .filter(v => !isNaN(v));
    }

    const sum = values.reduce((acc, val) => acc + val, 0);

    if (aggregation === 'average' || aggregation === 'avg') {
        // For coeff, keep two decimals; for others, round to whole number
        if (lookup === coeff) {
            return values.length > 0 ? (sum / values.length) : 0;
        } else if (typeof precision === 'number') {
            return values.length > 0 ? Number((sum / values.length).toFixed(precision)) : 0;
        } else {
            return values.length > 0 ? Math.round(sum / values.length) : 0;
        }
    }
    if (aggregation === 'max') {
        return values.length > 0 ? Math.max(...values) : 0;
    }
    if (aggregation === 'min') {
        return values.length > 0 ? Math.min(...values) : 0;
    }
    if (aggregation === 'growth') {
        // compute linear slope (right-to-left). eventDates are latest-first so reverse for chronological
        if (values.length < 2) return 0;
        const xs = values.map((_, i) => i); // simple indices as x
        const ys = values.slice().reverse(); // chronological left-to-right
        // compute slope using least-squares
        const n = ys.length;
        const meanX = (n - 1) / 2;
        const meanY = ys.reduce((a, b) => a + b, 0) / n;
        let num = 0, den = 0;
        for (let i = 0; i < n; i++) {
            num += (i - meanX) * (ys[i] - meanY);
            den += (i - meanX) * (i - meanX);
        }
        const slope = den !== 0 ? num / den : 0;
        return slope;
    } else if (aggregation === 'range') {
        if (values.length > 0) {
            const rangeVal = Math.max(...values) - Math.min(...values);
            return lookup === coeff ? rangeVal + 1 : rangeVal;
        }
        return 0;
    }
    return sum;
}
function getCellValue({
    analysisType,
    avgType: _avgType,
    filterType,
    date,
    code,
    avgTimeLim12Lookup,
    avgTimeLim5Lookup,
    avgTimeLookup,
    volunteers,
    tourists,
    coeff,
    positionLookup,
    event_number,
    formatAvgTime
    ,
    cellAgg,
    avgAgeLookup
}: {
    analysisType: string;
    avgType: string;
    filterType: string;
    date: string;
    code: string;
    avgTimeLim12Lookup: { [key: string]: { [key: string]: number } };
    avgTimeLim5Lookup: { [key: string]: { [key: string]: number } };
    avgTimeLookup: { [key: string]: { [key: string]: number } };
volunteers: { [key: string]: { [key: string]: number } };
tourists: { [key: string]: { [key: string]: number } };
coeff: { [key: string]: { [key: string]: number } };
    positionLookup: { [key: string]: { [key: string]: number } };
    event_number: { [key: string]: { [key: string]: number } };
    formatAvgTime: (val: number) => string;
    cellAgg?: string;
    avgAgeLookup?: { [key: string]: { [key: string]: number | null } };
}): string | number {
    // ...existing code...
    // If we're viewing granular event dates (not Annual/Mseason/Qseason) and the event_number is missing for this date/code,
    // treat it as 'no event' -> show blank. This avoids displaying zeros where there was no event.
    if (!['Annual', 'Mseason', 'Qseason'].includes(query)) {
        const en = event_number?.[date]?.[code];
        if (typeof en !== 'number') return '';
    }
    // Age analysis: if avgAgeLookup provided, return raw numeric age (renderer will format)
    if (analysisType === 'Age') {
        const v = avgAgeLookup && avgAgeLookup[date] ? avgAgeLookup[date][code] : null;
        return typeof v === 'number' ? v : '';
    }
    if (analysisType === 'Times') {
        // cellAgg controls which per-cell avg to show when Type=Times
        let val: number | undefined;
        if (cellAgg === 'lt12') {
            val = avgTimeLim12Lookup[date]?.[code];
        } else if (cellAgg === 'lt5') {
            val = avgTimeLim5Lookup[date]?.[code];
        } else {
            // 'avg' or undefined
            val = avgTimeLookup[date]?.[code];
        }
        return (typeof val === 'number' && !isNaN(val)) ? formatAvgTime(val) : '';
    } else if (analysisType === '%Participants') {
        // compute percentage = (filterCount / participants) * 100
        const participants = positionLookup[date]?.[code];
        if (!participants || participants === 0) return '';
        let count: number | null = null;
                if (filterType === 'tourist') count = (tourists[date] && typeof tourists[date][code] === 'number') ? tourists[date][code] : null;
                else if (filterType === '1time') count = (firstTimers[date] && typeof firstTimers[date][code] === 'number') ? firstTimers[date][code] : null;
            else if (filterType === 'sTourist') count = (superTourists[date] && typeof superTourists[date][code] === 'number') ? superTourists[date][code] : null;
            else if (filterType === 'volunteers') count = (volunteers[date] && typeof volunteers[date][code] === 'number') ? volunteers[date][code] : null;
            else if (filterType === '1time') count = (firstTimers[date] && typeof firstTimers[date][code] === 'number') ? firstTimers[date][code] : null;
        else if (filterType === 'regs') count = (regulars[date] && typeof regulars[date][code] === 'number') ? regulars[date][code] : null;
        else if (filterType === 'all') count = participants;
        else {
            // for other filters fallback to positionLookup
            count = (positionLookup[date] && typeof positionLookup[date][code] === 'number') ? positionLookup[date][code] : null;
        }
        if (count === null) return '';
        const pct = (Number(count) / Number(participants)) * 100;
        return formatPercent(pct, filterType === 'sTourist' ? 1 : 0);
    } else if (filterType === 'volunteers') {
        const val = volunteers[date]?.[code];
        if (typeof val === 'number') {
            return analysisType === 'participants' ? (showOneDecimalCells ? roundTo1(val) : Math.round(val)) : val;
        }
        return '';
    } else if (filterType === 'tourist') {
        const val = tourists[date]?.[code];
        if (typeof val === 'number') {
            return analysisType === 'participants' ? (showOneDecimalCells ? roundTo1(val) : Math.round(val)) : val;
        }
        return '';
    } else if (filterType === 'sTourist') {
        const val = superTourists[date]?.[code];
        if (typeof val === 'number') {
            return analysisType === 'participants' ? (showOneDecimalCells ? roundTo1(val) : Math.round(val)) : val;
        }
        return '';
    } else if (filterType === '1time') {
        const val = firstTimers[date]?.[code];
        // debug: log when we read firstTimers value
        console.log('[debug-cell] firstTimers cell', { date, code, val });
        if (typeof val === 'number') {
            return analysisType === 'participants' ? (showOneDecimalCells ? roundTo1(val) : Math.round(val)) : val;
        }
        // debug: fallback to positionLookup
        console.log('[debug-cell] firstTimers fallback to positionLookup', { date, code, fallback: positionLookup[date]?.[code] });
        return '';
    } else if (filterType === 'regs') {
        const val = regulars[date]?.[code];
        if (typeof val === 'number') {
            return analysisType === 'participants' ? (showOneDecimalCells ? roundTo1(val) : Math.round(val)) : val;
        }
        return '';
    } else if (filterType === 'eventNumber') {
        const val = event_number[date]?.[code];
        if (typeof val === 'number' && val !== 0 && val <= 10000) {
            return analysisType === 'participants' ? (showOneDecimalCells ? roundTo1(val) : Math.round(val)) : val;
        }
        return '';
    } else if (filterType === 'coeff') {
        const val = coeff[date]?.[code];
        return (typeof val === 'number' && val !== 0) ? formatCoeff(val) : '';
    } else {
        const val = positionLookup[date]?.[code];
        if (typeof val === 'number' && val !== 0) {
            return analysisType === 'participants' ? (showOneDecimalCells ? roundTo1(val) : Math.round(val)) : val;
        }
        return '';
    }
}
// Handle Age cells
function formatAge(val: number | null | undefined): string {
    if (val === null || val === undefined) return '';
    if (typeof val === 'number' && !isNaN(val)) return (Math.round(val * 10) / 10).toFixed(1);
    return '';
}
// Round value to `sig` significant figures (e.g. sig=2: 123 -> 120, 4.345 -> 4.3)
function roundToSignificant(val: number, sig = 2): number {
    if (!isFinite(val) || val === 0) return val === 0 ? 0 : NaN;
    const abs = Math.abs(val);
    const digits = Math.floor(Math.log10(abs)) + 1;
    const shift = sig - digits;
    const factor = Math.pow(10, shift);
    return Math.round(val * factor) / factor;
}

// Round to 1 decimal after first rounding to 2 significant figures
function roundTo1(val: number): number {
    const sigRounded = roundToSignificant(val, 2);
    return Math.round(sigRounded * 10) / 10;
}
// Return numeric value for a cell (unformatted) to allow comparisons/highlighting
function getCellNumericValue({
    analysisType,
    avgType: _avgType,
    filterType,
    date,
    code,
    avgTimeLim12Lookup,
    avgTimeLim5Lookup,
    avgTimeLookup,
    volunteers,
    tourists,
    coeff,
    positionLookup,
    event_number,
    cellAgg
}: {
    analysisType: string;
    avgType: string;
    filterType: string;
    date: string;
    code: string;
    avgTimeLim12Lookup: { [key: string]: { [key: string]: number } };
    avgTimeLim5Lookup: { [key: string]: { [key: string]: number } };
    avgTimeLookup: { [key: string]: { [key: string]: number } };
volunteers: { [key: string]: { [key: string]: number } };
tourists: { [key: string]: { [key: string]: number } };
coeff: { [key: string]: { [key: string]: number } };
positionLookup: { [key: string]: { [key: string]: number } };
    event_number: { [key: string]: { [key: string]: number } };
    avgAgeLookup?: { [key: string]: { [key: string]: number | null } };
    cellAgg?: string;
}): number | null {
    // If granular view and the event_number is missing, return null to indicate missing cell
    if (!['Annual', 'Mseason', 'Qseason'].includes(query)) {
        const en = event_number?.[date]?.[code];
        if (typeof en !== 'number') return null;
    }
    if (analysisType === 'Times') {
        if (cellAgg === 'lt12') {
            const v = avgTimeLim12Lookup[date]?.[code];
            return typeof v === 'number' && !isNaN(v) ? v : null;
        } else if (cellAgg === 'lt5') {
            const v = avgTimeLim5Lookup[date]?.[code];
            return typeof v === 'number' && !isNaN(v) ? v : null;
        } else {
            const v = avgTimeLookup[date]?.[code];
            return typeof v === 'number' && !isNaN(v) ? v : null;
        }
    }
    if (analysisType === '%Participants') {
        const participants = positionLookup[date]?.[code];
        if (!participants || participants === 0) return null;
        let count: number | null = null;
        if (filterType === 'tourist') count = (tourists[date] && typeof tourists[date][code] === 'number') ? tourists[date][code] : null;
        else if (filterType === 'sTourist') count = (superTourists[date] && typeof superTourists[date][code] === 'number') ? superTourists[date][code] : null;
        else if (filterType === 'volunteers') count = (volunteers[date] && typeof volunteers[date][code] === 'number') ? volunteers[date][code] : null;
        else if (filterType === 'regs') count = (regulars[date] && typeof regulars[date][code] === 'number') ? regulars[date][code] : null;
    else if (filterType === '1time') count = (firstTimers[date] && typeof firstTimers[date][code] === 'number') ? firstTimers[date][code] : null;
        else if (filterType === 'all') count = participants;
        else count = (positionLookup[date] && typeof positionLookup[date][code] === 'number') ? positionLookup[date][code] : null;
        if (count === null) return null;
        const pct = (Number(count) / Number(participants)) * 100;
        return isFinite(pct) ? (filterType === 'sTourist' ? pct : Math.round(pct)) : null;
    }
    if (filterType === 'volunteers') {
        const v = volunteers[date]?.[code];
        return typeof v === 'number' ? v : null;
    }
    if (filterType === 'tourist') {
        const v = tourists[date]?.[code];
        return typeof v === 'number' ? v : null;
    }
    if (filterType === '1time') {
        const v = firstTimers[date]?.[code];
        return typeof v === 'number' ? v : null;
    }
    if (filterType === 'sTourist') {
        const v = superTourists[date]?.[code];
        return typeof v === 'number' ? v : null;
    }
    if (filterType === 'regs') {
        const v = regulars[date]?.[code];
        return typeof v === 'number' ? v : null;
    }
    if (filterType === 'eventNumber') {
        const v = event_number[date]?.[code];
        return (typeof v === 'number' && v <= 10000) ? v : null;
    }
    // Age analysis: use precomputed avg_age per event (if available)
    if (analysisType === 'Age') {
        const v = avgAgeLookup && avgAgeLookup[date] ? avgAgeLookup[date][code] : null;
        return typeof v === 'number' ? v : null;
    }
    if (filterType === 'coeff') {
        const v = coeff[date]?.[code];
        return typeof v === 'number' ? v : null;
    }
    const v = positionLookup[date]?.[code];
    return typeof v === 'number' ? v : null;
}
function formatCoeff(val: number): string | number {
    const percent = ((val - 1) * 100).toFixed(2);
    return percent === "0.00" ? '0%' : `${percent}%`;
}
function formatPercent(val: number | null | undefined, precision = 0): string {
    if (val === null || val === undefined || !isFinite(Number(val))) return '';
    const n = Number(val);
    if (precision <= 0) return `${Math.round(n)}%`;
    return `${n.toFixed(precision)}%`;
}
// Format a number with `sig` significant figures and a leading '+' for positive values
function formatSigned(val: number, sig = 2): string {
    if (val === null || val === undefined || !isFinite(val)) return '';
    // Convert to a numeric then to precision and back to number to avoid scientific notation when possible
    const p = Number(Number(val).toPrecision(sig));
    // Remove trailing .0 where possible
    let s = p.toString();
    // Ensure we keep negative sign if present
    if (val > 0) s = `+${s}`;
    return s;
}
// Format a number with fixed decimal places and a leading '+' for positive values
function formatSignedFixed(val: number, decimals = 2): string {
    if (val === null || val === undefined || !isFinite(val)) return '';
    const s = Number(val).toFixed(decimals);
    return val > 0 ? `+${s}` : s;
}

interface AnalysisControlsProps {
    value: string;
    setValue: (val: string) => void;
    options: { value: string; label: string }[];
    label1: string;
    label2: string;
    value2: string;
    setValue2: (val: string) => void;
    options2?: { value: string; label: string }[];
    disabled?: boolean;
    disabled2?: boolean;
    pos1?: string;
    pos2?: string;
    }
const AnalysisControls: React.FC<AnalysisControlsProps> = ({
    value,
    setValue,
    options,
    label1,
    label2,
    value2,
    setValue2,
    options2,
    disabled = false,
    disabled2 = false,
    pos1 = '0.2cm',
    pos2 = '0.8em'
    }) => (
    <div style={{ marginBottom: '0.5em', marginLeft: '0.4cm', display: 'flex', alignItems: 'center' }}>

            <div style={{ display: 'flex', alignItems: 'center', marginRight: pos1 }}>
                <HelpTooltip label={label1} options={options} />
                <label htmlFor={`${label1}-select`} style={{ fontSize: '0.85em', marginLeft: '0.4em' }}>{label1}</label>
            </div>
            <select
                id={`${label1}-select`}
                value={value}
                onChange={e => setValue(e.target.value)}
                style={{ width: '125px' }}
                disabled={disabled}
            >
                {options.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
            </select>
 
     
            <label htmlFor={`${label2}-select`} style={{ margin: '0 0.5em 0 '+pos2, fontSize: '0.85em'}}>{label2}</label>
            <select
                id={`${label2}-select`}
                value={value2}
                onChange={e => setValue2(e.target.value)}
                style={{ width: '125px' }}
                disabled={disabled2}
            >
                {(options2 ?? []).map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
            </select>
            {/* Place help icons after right-side controls when provided */}
            {label2 === 'Period' || label2 === 'Cell Agg' || label2 === 'Time Adj' ? (
                <div style={{ marginLeft: '0.4em' }}><HelpTooltip label={label2} options={options2 ?? []} /></div>
            ) : null}
        
    </div>
    );
// Use setAggType directly from component state to update aggregation type
// Get unique event_codes and event_dates
const eventCodes = Array.from(new Set(results.map(r => r.event_code)))
    .sort((a, b) => Number(a) - Number(b));
let eventDates = Array.from(new Set(results.map(r => r.event_date)));
    if (query === 'Mseason') {
        // Ensure months are in calendar order Jan..Dec
        const monthsOrder = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        eventDates = eventDates.sort((a, b) => monthsOrder.indexOf(a) - monthsOrder.indexOf(b));
    } else if (query === 'Qseason') {
        const qOrder = ['Q1','Q2','Q3','Q4'];
        eventDates = eventDates.sort((a, b) => qOrder.indexOf(a) - qOrder.indexOf(b));
    } else {
        eventDates = eventDates.sort((a, b) => new Date(b).getTime() - new Date(a).getTime()); // Latest first
    }
    // Aggregates (top row and left column): for Type=Participants and Filter=Super Tourists
    // show 1 decimal + 2 significant figures only for Periods: All, Recent, Last50, Since-lockdown
    // (for other periods aggregates may still use other formatting rules elsewhere)
    // Aggregates: for Type=Participants and Filter=Super Tourists, always show 1 decimal (2 significant figures)
    const showOneDecimalForAnnual = String(analysisType).toLowerCase() === 'participants' && filterType === 'sTourist';
    // Cells: for Type=Participants and filter = Super Tourists, show 1 decimal (2 significant figures)
    // for Annual, Qtr Seasonality and Monthly Seasonality; otherwise show integers
    const showOneDecimalCells = String(analysisType).toLowerCase() === 'participants' && filterType === 'sTourist' && ['Annual', 'Qseason', 'Mseason'].includes(query);
// Build a lookup for last_position
const positionLookup: { [key: string]: { [key: string]: number } } = {};
    results.forEach(r => {
        if (!positionLookup[r.event_date]) positionLookup[r.event_date] = {};
        positionLookup[r.event_date][r.event_code] = r.last_position;
    });
const volunteers: { [key: string]: { [key: string]: number } } = {};
    results.forEach(r => {
        if (!volunteers[r.event_date]) volunteers[r.event_date] = {};
        volunteers[r.event_date][r.event_code] = r.volunteers;
    });
    // Build a lookup for tourist_count
const tourists: { [key: string]: { [key: string]: number } } = {};
    results.forEach(r => {
            if (!tourists[r.event_date]) tourists[r.event_date] = {};
            tourists[r.event_date][r.event_code] = r.tourist_count;
    });
    // Build a lookup for first timers count (parkrun_events.first_timers_count)
    const firstTimers: { [key: string]: { [key: string]: number } } = {};
    results.forEach(r => {
        if (!firstTimers[r.event_date]) firstTimers[r.event_date] = {};
        const ft = (r.first_timers_count !== undefined && r.first_timers_count !== null) ? r.first_timers_count : (r.first_timer_count !== undefined && r.first_timer_count !== null ? r.first_timer_count : 0);
        firstTimers[r.event_date][r.event_code] = typeof ft === 'number' ? ft : Number(ft) || 0;
    });
    // Debug: sample check to verify firstTimers lookup contains backend values
    try {
        const sampleRow = results && results.length ? results[0] : null;
        if (sampleRow) {
            const sd = sampleRow.event_date;
            const sc = sampleRow.event_code;
            console.log('[debug] firstTimers sample', { sample_date: sd, sample_code: sc, firstTimers_value: firstTimers[sd]?.[sc], raw_row: sampleRow });
            // also show how many distinct dates and codes were captured
            console.log('[debug] firstTimers summary', { dates: Object.keys(firstTimers).length, sample_dates: Object.keys(firstTimers).slice(0,5) });
        }
    } catch (e) {
        // swallow debug errors in production
    }
    // Build a lookup for super_tourist_count (parkrun_events.super_tourist_count)
    const superTourists: { [key: string]: { [key: string]: number } } = {};
        results.forEach(r => {
            if (!superTourists[r.event_date]) superTourists[r.event_date] = {};
            // accept multiple possible keys from backend: prefer r.super_tourist_count, fallback to r.super_tourist or 0
            const sc = (r.super_tourist_count !== undefined && r.super_tourist_count !== null) ? r.super_tourist_count : (r.super_tourist !== undefined && r.super_tourist !== null ? r.super_tourist : 0);
            superTourists[r.event_date][r.event_code] = typeof sc === 'number' ? sc : Number(sc) || 0;
        });
    // Build a lookup for regulars (parkrun_events.regulars) so the UI can show Regulars filter
    const regulars: { [key: string]: { [key: string]: number } } = {};
        results.forEach(r => {
            if (!regulars[r.event_date]) regulars[r.event_date] = {};
            // accept multiple possible keys from backend: prefer r.regulars, fallback to r.regs or 0
            const rr = (r.regulars !== undefined && r.regulars !== null) ? r.regulars : (r.regs !== undefined ? r.regs : 0);
            regulars[r.event_date][r.event_code] = typeof rr === 'number' ? rr : Number(rr) || 0;
        });
const coeff: { [key: string]: { [key: string]: number } } = {};
    results.forEach(r => {
        if (!coeff[r.event_date]) coeff[r.event_date] = {};
        coeff[r.event_date][r.event_code] = r.coeff;
    });  
const event_number: { [key: string]: { [key: string]: number } } = {};
    results.forEach(r => {
        const en = r.event_number;
        // only store valid positive numeric event numbers (ignore null/undefined/0 and non-numeric)
        if (typeof en === 'number' && !isNaN(en) && en > 0 && en <= 10000) {
            if (!event_number[r.event_date]) event_number[r.event_date] = {};
            event_number[r.event_date][r.event_code] = en;
        }
    });
// Build a lookup for avg_time
const avgTimeLookup: { [key: string]: { [key: string]: number } } = {};
    results.forEach(r => {
        if (!avgTimeLookup[r.event_date]) avgTimeLookup[r.event_date] = {};
        //if (r.event_code == 1) console.log('r.avg_time:', r.event_code, r.event_date,r.avg_time);
        avgTimeLookup[r.event_date][r.event_code] = r.avg_time;
    });
// Add after avgTimeLookup
const avgTimeLim12Lookup: { [key: string]: { [key: string]: number } } = {};
    //console.log('results:', results);
    results.forEach(r => {
        if (!avgTimeLim12Lookup[r.event_date]) avgTimeLim12Lookup[r.event_date] = {};
        //if (r.event_code == 1) console.log('r.avg_time:', r.event_code, r.event_date,r.avgTimeLim12);
        avgTimeLim12Lookup[r.event_date][r.event_code] = r.avgtimelim12;
    });
// Add after avgTimeLookup
const avgTimeLim5Lookup: { [key: string]: { [key: string]: number } } = {};
    //console.log('results:', results);
    results.forEach(r => {
        if (!avgTimeLim5Lookup[r.event_date]) avgTimeLim5Lookup[r.event_date] = {};
        //if (r.event_code == 1) console.log('r.avg_time:', r.event_code, r.event_date,r.avgtimelim5);
        avgTimeLim5Lookup[r.event_date][r.event_code] = r.avgtimelim5;
    });
// Build a lookup for avg_age (parkrun_events.avg_age). Accept multiple possible key names from backend.
const avgAgeLookup: { [key: string]: { [key: string]: number | null } } = {};
results.forEach(r => {
    if (!avgAgeLookup[r.event_date]) avgAgeLookup[r.event_date] = {};
    const v = r.avg_age ?? r.avgAge ?? null;
    const num = (v === null || v === undefined || v === '') ? null : Number(v);
    avgAgeLookup[r.event_date][r.event_code] = (num !== null && !isNaN(Number(num))) ? Number(num) : null;
});
// Debug: when user selects Age, log the avgAgeLookup sample to console to help debug blank cells
if (typeof window !== 'undefined') {
    // Defer logging until UI mounts; attach a small helper to window for manual inspection
    // Expose debug lookup for manual inspection in the browser console
    const _w: any = window;
    _w['__debug_avgAgeLookup'] = avgAgeLookup;
}
//console.log('avgTimeLookup:', avgTimeLookup);
const eventTotals: { [code: string]: number } = {};
// Compute totals/aggregates per event code. For Times use the selected avgType lookup and respect aggType.
    // Precompute column totals (sum across eventCodes for each date) for %Total mode.
    // Use the currently selected filter to build column totals so %Total divides by the correct base.
    const columnTotals: { [date: string]: number } = {};
    eventDates.forEach(d => {
        let colSum = 0;
        eventCodes.forEach(c => {
            let v = 0;
            if (filterType === 'volunteers') v = volunteers[d]?.[c] || 0;
            else if (filterType === 'tourist') v = tourists[d]?.[c] || 0;
            else if (filterType === 'sTourist') v = superTourists[d]?.[c] || 0;
            else if (filterType === '1time') v = firstTimers[d]?.[c] || 0;
            else if (filterType === 'regs') v = regulars[d]?.[c] || 0;
            else if (filterType === 'all') v = positionLookup[d]?.[c] || 0;
            else v = positionLookup[d]?.[c] || 0;
            colSum += Number(v) || 0;
        });
        columnTotals[d] = colSum;
    });
    const grandTotalSum = Object.values(columnTotals).reduce((a, b) => a + b, 0);

    eventCodes.forEach(code => {
        if (analysisType === 'Times') {
            // Use cellAgg (per-cell aggregation choice) to compute the row totals and header aggregates
            let lookup;
            if (cellAgg === 'lt12') {
                lookup = avgTimeLim12Lookup;
            } else if (cellAgg === 'lt5') {
                lookup = avgTimeLim5Lookup;
            } else {
                lookup = avgTimeLookup;
            }
            eventTotals[code] = getAggregatedTotalForCode(lookup, eventDates, code, aggType);
        } else if (analysisType === 'Age') {
            // Use the precomputed per-event avg age values directly. getAggregatedTotalForCode will ignore nulls.
            const ageLookupAny: any = avgAgeLookup;
            eventTotals[code] = getAggregatedTotalForCode(ageLookupAny, eventDates, code, aggType, 1);
        } else {
            // Special handling for the new "%Participants" analysis: compute per-date percentages then aggregate those percentages
        if (analysisType === '%Participants' || analysisType === '%Total') {
                const pcts: number[] = [];
                let rowSum = 0; // sum of numerators for this row across dates (used for %Total left aggregate)
                eventDates.forEach(d => {
                    const denom = analysisType === '%Total' ? columnTotals[d] : positionLookup[d]?.[code];
                    if (!denom || denom === 0) return;
                    let numer = 0;
                    if (filterType === 'volunteers') numer = volunteers[d]?.[code] || 0;
                    else if (filterType === 'tourist') numer = tourists[d]?.[code] || 0;
                    else if (filterType === 'sTourist') numer = superTourists[d]?.[code] || 0;
                    else if (filterType === 'regs') numer = regulars[d]?.[code] || 0;
                    else if (filterType === '1time') numer = firstTimers[d]?.[code] || 0;
                    else if (filterType === 'all') numer = positionLookup[d]?.[code] || 0;
                    else numer = positionLookup[d]?.[code] || 0;
                    // accumulate rowSum for %Total left-aggregate
                    if (analysisType === '%Total') rowSum += Number(numer) || 0;
                    const pct = (Number(numer) / Number(denom)) * 100;
                    if (isFinite(pct)) pcts.push(pct);
                });
                if (pcts.length === 0) {
                    eventTotals[code] = 0;
                } else if (aggType === 'total') {
                    // For %Total, left aggregate is rowSum as a percent of grand total
                    if (analysisType === '%Total') {
                        eventTotals[code] = grandTotalSum ? (rowSum / grandTotalSum) * 100 : 0;
                    } else {
                        // For non-%Total, fall back to summing pcts
                        const totalPct = pcts.reduce((a, b) => a + b, 0);
                        eventTotals[code] = Math.round(totalPct);
                    }
                } else if (aggType === 'avg' || aggType === 'average') {
                    const s = pcts.reduce((a, b) => a + b, 0) / pcts.length;
                    // Preserve decimals for %Total or sTourist; otherwise keep integer
                    eventTotals[code] = (analysisType === '%Total' || filterType === 'sTourist') ? s : Math.round(s);
                } else if (aggType === 'max') {
                    const m = Math.max(...pcts);
                    eventTotals[code] = (analysisType === '%Total' || filterType === 'sTourist') ? m : Math.round(m);
                } else if (aggType === 'min') {
                    const m = Math.min(...pcts);
                    eventTotals[code] = (analysisType === '%Total' || filterType === 'sTourist') ? m : Math.round(m);
                } else if (aggType === 'range') {
                    const r = Math.max(...pcts) - Math.min(...pcts);
                    eventTotals[code] = (analysisType === '%Total' || filterType === 'sTourist') ? r : Math.round(r);
                } else if (aggType === 'growth') {
                    // Compute slope on chronological percentages (left-to-right)
                    const ys = pcts.slice().reverse();
                    const n = ys.length;
                    if (n < 2) {
                        eventTotals[code] = 0;
                    } else {
                        const meanX = (n - 1) / 2;
                        const meanY = ys.reduce((a, b) => a + b, 0) / n;
                        let num = 0, den = 0;
                        for (let i = 0; i < n; i++) {
                            num += (i - meanX) * (ys[i] - meanY);
                            den += (i - meanX) * (i - meanX);
                        }
                        const slope = den !== 0 ? num / den : 0;
                        eventTotals[code] = slope; // keep slope as numeric (percent points per period)
                    }
                } else {
                    // Fallback: ratio of aggregated totals
                    const numLookup = filterType === 'volunteers' ? volunteers : (filterType === 'tourist' ? tourists : (filterType === 'sTourist' ? superTourists : (filterType === 'regs' ? regulars : (filterType === '1time' ? firstTimers : positionLookup))));
                    const numer = getAggregatedTotalForCode(numLookup, eventDates, code, aggType);
                    const denom = getAggregatedTotalForCode(positionLookup, eventDates, code, aggType);
                    eventTotals[code] = denom ? (filterType === 'sTourist' ? (Number(numer) / Number(denom)) * 100 : Math.round((Number(numer) / Number(denom)) * 100)) : 0;
                }
            } else {
                let lookup;
                                                            if (filterType === 'volunteers') {
                                                                lookup = volunteers;
                                                            } else if (filterType === 'tourist') {
                                                                lookup = tourists;
                                                            } else if (filterType === 'sTourist') {
                                                                lookup = superTourists;
                                                            } else if (filterType === 'regs') {
                                                                lookup = regulars;
                                                            } else if (filterType === '1time') {
                                                                lookup = firstTimers;
                } else if (filterType === 'eventNumber') {
                    lookup = event_number;
                } else if (filterType === 'coeff') {
                    lookup = coeff;
                } else {
                    lookup = positionLookup;
                }
                eventTotals[code] = getAggregatedTotalForCode(lookup, eventDates, code, aggType, (showOneDecimalForAnnual && (lookup === positionLookup || filterType === 'sTourist')) ? 1 : undefined);
            }
        }
    });    
const sortedEventCodes = [...eventCodes].sort((a, b) => {
    if (sortBy === 'event') {
        const nameA = (results.find(r => r.event_code === a)?.event_name || a).toLowerCase();
        const nameB = (results.find(r => r.event_code === b)?.event_name || b).toLowerCase();
        return sortDir === 'asc' ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
    } else {
        return sortDir === 'asc'
            ? eventTotals[a] - eventTotals[b]
            : eventTotals[b] - eventTotals[a];
    }
    });

    return (
        <div className="page-content">

        <AnalysisControls
            value={analysisType}
            setValue={setAnalysisType}
            options={analysisOptions}
            label1="Type"
            label2="Period"
            value2={query}
            setValue2={setQuery}
            options2={queryOptions}
            pos2='1.6em'
        />
        <AnalysisControls
            value={filterType}
            setValue={setFilterType}
            options={analysisType === 'Times' ? timesFilterOptions : (analysisType === '%Participants' ? percentParticipantFilterOptions : (analysisType === '%Total' ? percentTotalFilterOptions : (analysisType === 'Age' ? ageFilterOptions : participantFilterOptions)))}
            label1="Filter"
            label2="Cell Agg"
            value2={cellAgg}
            setValue2={setCellAgg}
            options2={analysisType === 'Times'
                ? [
                    { value: 'avg', label: 'Average' },
                    { value: 'lt12', label: 'avg (Times < 12%)' },
                    { value: 'lt5', label: 'avg (Times < 5%)' }
                ]
                : (['Annual', 'Mseason', 'Qseason'].includes(query) ? [{ value: 'avg', label: 'Average' }] : [{ value: 'single', label: 'Single Value' }])
            }
            pos2='0.7em'
        />
        <AnalysisControls
            value={aggType}
            setValue={setAggType}
            options={aggOptions.filter(opt => getAllowedAggTypes(analysisType, filterType).includes(opt.value))}
            label1="Agg"
            label2="Time Adj"
            value2={avgType}
            setValue2={setAvgType}
            options2={analysisType === 'Times' ? avgOptions : [{ value: 'none', label: 'No Adjustment' }]}
            disabled={filterType === 'eventNumber' && aggType === 'total'}
            disabled2={analysisType !== 'Times'}
            pos1="0.4cm"
            pos2 ="0.5em"
        />
            <div className="results-table-container">
                <table className={query === 'Qseason' ? 'results-table compact' : 'results-table'}>
                    <thead>
                        <tr>
                            <th
                                colSpan={2}
                                className="sticky-corner-wide"
                                style={{ textAlign: 'center' }}
                            >
                                Participation
                            </th>
                            {eventDates.filter(Boolean).map(date => (
                                <th key={date} className="sticky-header">{formatHeaderDate(date, query)}</th>
                            ))}
                        </tr>
                        <tr>
                            <th
                                className="sticky-col sticky-corner-2-1"
                                style={{ cursor: 'pointer' }}
                                onClick={() => {
                                    setSortBy('event');
                                    setSortDir(sortBy === 'event' && sortDir === 'asc' ? 'desc' : 'asc');
                                }}
                            >
                                Event {sortBy === 'event'
                                    ? (sortDir === 'asc' ? '▲' : '▼')
                                    : <span style={{ opacity: 0.3 }}>▲▼</span>}
                            </th>
                            <th
                                className="sticky-col-2 sticky-corner-2-2"
                                style={{ cursor: 'pointer' }}
                                onClick={() => {
                                    setSortBy('total');
                                    setSortDir(sortBy === 'total' && sortDir === 'asc' ? 'desc' : 'asc');
                                }}
                            >
                                {getSecondColumnHeaderLabel(analysisType, aggType)}
                                {sortBy === 'total'
                                    ? (sortDir === 'asc' ? '▲' : '▼')
                                    : <span style={{ opacity: 0.3 }}>▲▼</span>}
                            </th>
                            {eventDates.map(date => {
                                let lookup;
                                if (analysisType === 'Age') {
                                    const _ageLookupAny: any = avgAgeLookup;
                                    const hdrVal = getAggregatedValueForDate(_ageLookupAny, date, eventCodes, aggType, 1);
                                    return (
                                        <th key={date} className="sticky-header second-row">{hdrVal ? formatAge(hdrVal) : ''}</th>
                                    );
                                }
                                if (analysisType === 'Times') {
                                                        // header aggregates follow cellAgg selection
                                                        if (cellAgg === 'lt12') {
                                                            lookup = avgTimeLim12Lookup;
                                                        } else if (cellAgg === 'lt5') {
                                                            lookup = avgTimeLim5Lookup;
                                                        } else {
                                                            lookup = avgTimeLookup;
                                                        }
                                    // For Times, format as time (mm:ss)
                                    const value = getAggregatedValueForDate(lookup, date, eventCodes, aggType, showOneDecimalForAnnual ? 1 : undefined);
                                    return (
                                        <th key={date} className="sticky-header second-row">
                                            {typeof value === 'number' && value !== 0 ? formatAvgTime(value) : ''}
                                        </th>
                                    );
                                } else {
                                    // For Participants, Volunteers, etc.
                                                            if (filterType === 'volunteers') {
                                                                lookup = volunteers;
                                                            } else if (filterType === 'tourist') {
                                                                lookup = tourists;
                                                            } else if (filterType === 'sTourist') {
                                                                lookup = superTourists;
                                                            } else if (filterType === 'regs') {
                                                                lookup = regulars;
                                    } else if (filterType === 'eventNumber') {
                                        lookup = event_number;
                                    } else if (filterType === '1time') {
                                        lookup = firstTimers;
                                    } else if (filterType === 'coeff') {
                                        lookup = coeff;
                                    } else {
                                        lookup = positionLookup;
                                    }
                                    if (aggType === 'growth') {
                                        return <th key={date} className="sticky-header second-row"> </th>;
                                    }
                                    const value = getAggregatedValueForDate(lookup, date, eventCodes, aggType, (showOneDecimalForAnnual && (lookup === positionLookup || filterType === 'sTourist')) ? 1 : undefined);
                                    // For %Participants mode compute per-event percentages for this date then aggregate those
                                    if (analysisType === '%Participants' || analysisType === '%Total') {
                                        const pcts: number[] = [];
                                        eventCodes.forEach(code => {
                                            const denom = analysisType === '%Total' ? columnTotals[date] : positionLookup[date]?.[code];
                                            if (!denom || denom === 0) return;
                                            let numer = 0;
                                            if (filterType === 'volunteers') numer = volunteers[date]?.[code] || 0;
                                            else if (filterType === 'tourist') numer = tourists[date]?.[code] || 0;
                                            else if (filterType === 'sTourist') numer = superTourists[date]?.[code] || 0;
                                            else if (filterType === 'regs') numer = regulars[date]?.[code] || 0;
                                            else if (filterType === '1time') numer = firstTimers[date]?.[code] || 0;
                                            else if (filterType === 'all') numer = positionLookup[date]?.[code] || 0;
                                            else numer = positionLookup[date]?.[code] || 0;
                                            const pct = (Number(numer) / Number(denom)) * 100;
                                            if (isFinite(pct)) pcts.push(pct);
                                        });
                                        if (pcts.length === 0) {
                                            return <th key={date} className="sticky-header second-row"> </th>;
                                        }
                                        if (aggType === 'avg' || aggType === 'average') {
                                            const s = pcts.reduce((a, b) => a + b, 0) / pcts.length;
                                            const outVal = (filterType === 'sTourist' || showOneDecimalForAnnual) ? roundTo1(s) : Math.round(s);
                                            return <th key={date} className="sticky-header second-row">{formatPercent(outVal, (filterType === 'sTourist' || analysisType === '%Total' || showOneDecimalForAnnual) ? 1 : 0)}</th>;
                                        }
                                        if (aggType === 'total') {
                                            const totalPct = pcts.reduce((a, b) => a + b, 0);
                                            const outVal = (filterType === 'sTourist' || showOneDecimalForAnnual) ? roundTo1(totalPct) : Math.round(totalPct);
                                            return <th key={date} className="sticky-header second-row">{formatPercent(outVal, (filterType === 'sTourist' || analysisType === '%Total' || showOneDecimalForAnnual) ? 1 : 0)}</th>;
                                        }
                                        if (aggType === 'max') {
                                            const m = Math.max(...pcts);
                                            const outVal = (filterType === 'sTourist' || showOneDecimalForAnnual) ? roundTo1(m) : Math.round(m);
                                            return <th key={date} className="sticky-header second-row">{formatPercent(outVal, (filterType === 'sTourist' || analysisType === '%Total' || showOneDecimalForAnnual) ? 1 : 0)}</th>;
                                        }
                                        if (aggType === 'min') {
                                            const m = Math.min(...pcts);
                                            const outVal = (filterType === 'sTourist' || showOneDecimalForAnnual) ? roundTo1(m) : Math.round(m);
                                            return <th key={date} className="sticky-header second-row">{formatPercent(outVal, (filterType === 'sTourist' || analysisType === '%Total' || showOneDecimalForAnnual) ? 1 : 0)}</th>;
                                        }
                                        if (aggType === 'range') {
                                            const r = Math.max(...pcts) - Math.min(...pcts);
                                            const outVal = (filterType === 'sTourist' || showOneDecimalForAnnual) ? roundTo1(r) : Math.round(r);
                                            return <th key={date} className="sticky-header second-row">{formatPercent(outVal, (filterType === 'sTourist' || analysisType === '%Total' || showOneDecimalForAnnual) ? 1 : 0)}</th>;
                                        }
                                        // growth not shown at header-level for percent mode
                                        return <th key={date} className="sticky-header second-row"> </th>;
                                    }
                                    // For Participants and participant-like filters, round aggregates for these agg types
                                    const participantLike = analysisType === 'participants' && ['all', 'tourist', 'sTourist', 'eventNumber', 'volunteers', 'regs', '1time'].includes(filterType);
                                    const roundAggs = ['total', 'max', 'min', 'range'];
                                    // Compute displayValue: for sTourist or Annual-seasonal participants show 1 decimal
                                    let displayValue: any;
                                    if (participantLike && filterType !== 'coeff') {
                                        if (filterType === 'sTourist' || showOneDecimalForAnnual) {
                                            // show one decimal for sTourist and the annual-season special case
                                            displayValue = Number(roundTo1(Number(value || 0))).toFixed(1);
                                        } else if (roundAggs.includes(aggType)) {
                                            displayValue = Math.round(value);
                                        } else {
                                            displayValue = value;
                                        }
                                    } else {
                                        displayValue = value;
                                    }
                                    return (
                                        <th key={date} className="sticky-header second-row">
                                            {filterType === 'coeff' ? formatCoeff(value) : displayValue}
                                        </th>
                                    );
                                }
                            })}
                        </tr>
                    </thead>
                    <tbody>
                        {sortedEventCodes.map(code => (
                            <tr key={code}>
                                <td className="sticky-col">
                                    {results.find(r => r.event_code === code)?.event_name || code}
                                </td>
                                <td className="sticky-col-2">
                                    {(() => {
                                        // compute left aggregate display
                                        if (analysisType === '%Participants' || analysisType === '%Total') {
                                            if (aggType === 'growth') return formatSignedFixed(Number(eventTotals[code]), 2);
                                            return formatPercent(eventTotals[code], (analysisType === '%Total' || filterType === 'sTourist' || showOneDecimalForAnnual) ? 1 : 0);
                                        }
                                        if (aggType === 'growth') return formatSignedFixed(Number(eventTotals[code]), 2);
                                        if (filterType === 'coeff') return formatCoeff(eventTotals[code]);
                                        if (analysisType === 'Times') return formatAvgTime(eventTotals[code]);
                                        if (analysisType === 'Age') return formatAge(eventTotals[code]);
                                        // participants numeric aggregates
                                        // For participants when the special one-decimal annual view is active,
                                        // always show a rounded 1-decimal value (significant decimal), except for growth/Times/Age/coeff handled above.
                                        if (analysisType === 'participants' && showOneDecimalForAnnual) {
                                            return Number(roundTo1(Number(eventTotals[code] || 0))).toFixed(1);
                                        }
                                        if (analysisType === 'participants' && ['total', 'max', 'min', 'range'].includes(aggType)) {
                                            return Math.round(Number(eventTotals[code] || 0));
                                        }
                                        return eventTotals[code];
                                    })()}
                                </td>
                                {eventDates.map(date => {
                                    // compute numeric cell value for comparison/highlighting
                                    const numeric = getCellNumericValue({
                                        analysisType,
                                        avgType,
                                        filterType,
                                        date,
                                        code,
                                        avgTimeLim12Lookup,
                                        avgTimeLim5Lookup,
                                        avgTimeLookup,
                                        volunteers,
                                        tourists,
                                        coeff,
                                        positionLookup,
                                        event_number,
                                        avgAgeLookup,
                                        cellAgg
                                    });
                                    // compare numeric values; for sTourist percent mode compare formatted values (1dp) to avoid float mismatches
                                    let isEqual = false;
                                    if (numeric !== null && typeof eventTotals[code] === 'number' && aggType !== 'growth') {
                                    if (analysisType === '%Participants' && filterType === 'sTourist') {
                                        // compare as displayed with 1 decimal
                                        const a = formatPercent(numeric, 1);
                                        const b = formatPercent(eventTotals[code], 1);
                                        isEqual = a === b;
                                    } else if (analysisType === '%Total') {
                                        // compute per-cell percent (numer / column total) and compare as displayed with 1 decimal
                                        const denom = columnTotals[date] || 0;
                                        if (denom && typeof numeric === 'number') {
                                            const pct = (Number(numeric) / Number(denom)) * 100;
                                            const a = formatPercent(pct, 1);
                                            const b = formatPercent(eventTotals[code], 1);
                                            isEqual = a === b;
                                        } else {
                                            isEqual = false;
                                        }
                                    } else {
                                        isEqual = Math.abs(numeric - eventTotals[code]) < 0.0001;
                                    }
                                    }
                                    const cellStyle = isEqual
                                        ? (aggType === 'max' ? { backgroundColor: '#d4f5d4' }
                                            : aggType === 'min' ? { backgroundColor: '#ffdce6' }
                                            : undefined)
                                        : undefined;
                                    return (
                                        <td key={date} style={cellStyle}>
                                            {(() => {
                                                const participantLike = analysisType === 'participants' && ['all', 'tourist', 'sTourist', 'eventNumber', 'volunteers', 'regs'].includes(filterType);
                                                let val: any = '';
                                                if (filterType === 'eventNumber') {
                                                    // For per-code cells show the raw event_number for that date/code
                                                    // If missing (e.g., Annual view uses year keys) fall back to the aggregated cell value
                                                    const raw = event_number[date]?.[code];
                                                    if (typeof raw === 'number' && raw !== 0 && raw <= 10000) {
                                                        val = raw;
                                                    } else {
                                                        // Only attempt fallbacks for the Annual view; avoid polluting Recent/other views
                                                        if (query === 'Annual') {
                                                            const fallback = getCellValue({
                                                                analysisType,
                                                                avgType,
                                                                filterType,
                                                                date,
                                                                code,
                                                                avgTimeLim12Lookup,
                                                                avgTimeLim5Lookup,
                                                                avgTimeLookup,
                                                                volunteers,
                                                                tourists,
                                                                coeff,
                                                                positionLookup,
                                                                event_number,
                                                                formatAvgTime,
                                                                cellAgg,
                                                                avgAgeLookup
                                                            });
                                                            if (fallback !== '' && fallback !== null && typeof fallback !== 'undefined') {
                                                                val = fallback;
                                                            } else {
                                                                const aggRow = results.find(r => String(r.event_code) === String(code) && String(r.event_date) === String(date));
                                                                const aggVal = aggRow ? aggRow.event_number : null;
                                                                if (typeof aggVal === 'number' && !isNaN(aggVal) && aggVal !== 0) val = aggVal;
                                                            }
                                                        }
                                                    }
                                                } else {
                                                    val = getCellValue({
                                                        analysisType,
                                                        avgType,
                                                        filterType,
                                                        date,
                                                        code,
                                                        avgTimeLim12Lookup,
                                                        avgTimeLim5Lookup,
                                                        avgTimeLookup,
                                                        volunteers,
                                                        tourists,
                                                        coeff,
                                                        event_number,
                                                        positionLookup,
                                                        formatAvgTime,
                                                        cellAgg,
                                                        avgAgeLookup
                                                    });
                                                }
                                                // If this is the Age analysis, prefer avgAgeLookup and format with two decimals
                                                if (analysisType === 'Age') {
                                                    // Try avgAgeLookup first (per-event precomputed average)
                                                    const ageVal = (avgAgeLookup && avgAgeLookup[date]) ? avgAgeLookup[date][code] : null;
                                                    if (typeof ageVal === 'number') return formatAge(ageVal);
                                                    // Fallback to whatever val contains (might be numeric)
                                                    if (typeof val === 'number') return formatAge(val);
                                                    return '';
                                                }
                                                // If this is the new %Total analysis, show each cell as percent of the column total
                                                if (analysisType === '%Total') {
                                                    // use the precomputed numeric 'numeric' where available, otherwise try val
                                                    let numer: number | null = null;
                                                    if (typeof numeric === 'number') numer = Number(numeric);
                                                    else if (typeof val === 'number') numer = Number(val);
                                                    const denom = columnTotals[date] || 0;
                                                    if (!denom || numer === null) return '';
                                                    const pct = (Number(numer) / Number(denom)) * 100;
                                                    return formatPercent(pct, 1);
                                                }
                                                // If numeric and participant-like, round to integer for display
                                                if (participantLike && typeof val === 'number' && !isNaN(val)) {
                                                    if (showOneDecimalCells) {
                                                        const r1 = roundTo1(val);
                                                        // Only bold milestone numbers when filtering by Event Number (use rounded integer check)
                                                        if (String(filterType) === 'eventNumber' && eventMilestones.has(Math.round(r1))) return <span style={{ fontWeight: 'bold' }}>{r1.toFixed(1)}</span>;
                                                        return r1.toFixed(1);
                                                    }
                                                    const rounded = Math.round(val);
                                                    // Only bold milestone numbers when filtering by Event Number
                                                    if (String(filterType) === 'eventNumber' && eventMilestones.has(rounded)) return <span style={{ fontWeight: 'bold' }}>{rounded}</span>;
                                                    return rounded;
                                                }
                                                // If val is still numeric but not participant-like, return as-is
                                                return val ?? '';
                                            })()}
                                        </td>
                                    );
                                })}

                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default Results;