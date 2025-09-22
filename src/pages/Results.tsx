import React, { useEffect, useState } from 'react';
import { fetchResults ,fetchAllResults} from '../api/parkrunAPI';
import './ResultsTable.css'; // Create this CSS file for sticky headers
import { formatDate,formatDate1,formatDate2,formatAvgTime } from '../utilities'; // Utility function to format dates

const queryOptions = [
    { value: 'recent', label: 'Recent Events' },
    { value: 'last50', label: 'Last 50 Events' },
    { value: 'all', label: 'All Events' },
    { value: 'Annual', label: 'Annual'},
    { value: 'Qseason', label: 'Qtr Seasonality'},
    { value: 'Mseason', label: 'Mnth Seasonality'},
    // Add more options here as needed
];
const analysisOptions = [
    { value: 'participants', label: 'Participants' },
    { value: 'Times', label: 'Times' },
    { value: 'Age', label: 'Age' },

    // Add more options here as needed
];
const filterOptions = [
    { value: 'all', label: 'All' },
    { value: 'sex', label: 'Sex' },
    { value: 'tourist', label: 'Tourist'},
    { value: 'volunteers', label: 'Volunteers' },
    { value: 'eventNumber', label: 'Event Number' },
    { value: 'coeff', label: 'Seasonal Hardness' },
    { value: 'regs', label: 'Regulars' },
    { value: 'sTourist', label: 'Super Tourist'},
    { value: 'sRegs', label: 'Super Regular' },
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
    { value: 'tourist', label: 'Tourist' },
    { value: 'volunteers', label: 'Volunteer' },
    { value: 'eventNumber', label: 'Event Number' },
    { value: 'coeff', label: 'Seasonal Hardness' },
    { value: 'regs', label: 'Regulars' },
    { value: 'sTourist', label: 'Super Tourists' },
    { value: 'sRegs', label: 'Super Regulars' },
    { value: '1time', label: 'First Timers' },
    { value: 'returners', label: 'Returners' },
    { value: 'clubs', label: 'Clubs' },
    { value: '15pc', label: '15% consistency' },
    { value: '10pc', label: '10% consistency' },
    { value: '5pc', label: '5% consistency' },
    { value: 'unknown', label: 'Unknown' },
];
const timesFilterOptions = [
    { value: 'all', label: 'All' },
    { value: 'tourist', label: 'Tourist' },
    { value: 'regs', label: 'Regulars' },
    { value: 'sTourist', label: 'Super Tourists' },
    { value: 'sRegs', label: 'Super Regulars' },
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
                } else if (query === 'last50') {
                    data = await fetchResults(50);
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
        if (analysisType === 'participants' && avgType !== 'none') {
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
        const allowedFilters = analysisType === 'Times' ? timesFilterOptions.map(o => o.value) : participantFilterOptions.map(o => o.value);
        if (!allowedFilters.includes(filterType)) {
            setFilterType(allowedFilters[0]);
        }
    }, [analysisType]);
    useEffect(() => {
            // Default cellAgg based on analysisType when Type changes
        setCellAgg(analysisType === 'Times' ? 'avg' : 'single');
    }, [analysisType]);

    if (loading) return <div>Loading...</div>;
    if (error) return <div>{error}</div>;
    if (!results.length) return <div>No results found.</div>;


// Helper function to get allowed aggTypes
function getAllowedAggTypes(analysisType: string, filterType: string): string[] {
    if (analysisType === 'Times') {
        return ['avg', 'max', 'min', 'growth'];
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
function getAggregatedValueForDate(
    lookup: { [date: string]: { [code: string]: number } },
    date: string,
    eventCodes: string[],
    aggregation: string
): number {
    let values;
    // Special filter for event_number
    if (lookup === event_number) {
        values = eventCodes
            .map(code => lookup[date]?.[code])
            .filter(val => typeof val === 'number' && val !== 0 && val <= 10000);
    } else {
        values = eventCodes
            .map(code => lookup[date]?.[code])
            .filter(val => typeof val === 'number' && val !== 0);
    }

    const sum = values.reduce((acc, val) => acc + val, 0);
    const count = values.length;

    if (aggregation === 'average' || aggregation === 'avg') {
        if (lookup === coeff) {
            // For coeff, keep two decimals
            return count > 0 ? Number((sum / count).toFixed(4)) : 0;
        } else {
            // For others, round to whole number
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
): number {
    let values;
    if (lookup === event_number) {
        values = eventDates
            .map(date => lookup[date]?.[code])
            .filter(val => typeof val === 'number' && val !== 0 && val <= 10000)
            .map(val => Number(val));
    } else {
        values = eventDates
            .map(date => lookup[date]?.[code])
            .filter(val => typeof val === 'number' && val !== 0)
            .map(val => Number(val));
    }

    const sum = values.reduce((acc, val) => acc + val, 0);

    if (aggregation === 'average' || aggregation === 'avg') {
        // For coeff, keep two decimals; for others, round to whole number
        if (lookup === coeff) {
            return values.length > 0 ? (sum / values.length) : 0;
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
    formatAvgTime
    ,
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
    formatAvgTime: (val: number) => string;
    cellAgg?: string;
}): string | number {
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
    } else if (filterType === 'volunteers') {
        const val = volunteers[date]?.[code];
        return (typeof val === 'number' && val !== 0) ? val : '';
    } else if (filterType === 'tourist') {
        const val = tourists[date]?.[code];
        return (typeof val === 'number' && val !== 0) ? val : '';
    } else if (filterType === 'eventNumber') {
        const val = event_number[date]?.[code];
        return (typeof val === 'number' && val !== 0 && val <= 10000) ? val : '';
    } else if (filterType === 'coeff') {
        const val = coeff[date]?.[code];
        return (typeof val === 'number' && val !== 0) ? formatCoeff(val) : '';
    } else {
        const val = positionLookup[date]?.[code];
        return (typeof val === 'number' && val !== 0) ? val : '';
    }
}
// Return numeric value for a cell (unformatted) to allow comparisons/highlighting
function getCellNumericValue({
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
    cellAgg?: string;
}): number | null {
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
    if (filterType === 'volunteers') {
        const v = volunteers[date]?.[code];
        return typeof v === 'number' ? v : null;
    }
    if (filterType === 'tourist') {
        const v = tourists[date]?.[code];
        return typeof v === 'number' ? v : null;
    }
    if (filterType === 'eventNumber') {
        const v = event_number[date]?.[code];
        return (typeof v === 'number' && v <= 10000) ? v : null;
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
    pos1 = '0.2cm',
    pos2 = '0.8em'
    }) => (
    <div style={{ marginBottom: '0.5em', marginLeft: '0.4cm', display: 'flex', alignItems: 'center' }}>

            <label htmlFor={`${label1}-select`} style={{ fontSize: '0.85em', marginRight: pos1 }}>{label1}</label>
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
            >
                {(options2 ?? []).map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
            </select>
        
    </div>
    );
const handleAggTypeChange = (val: string) => {
    setAggType(val);
    console.log('aggType changed to', val);
    };
// Get unique event_codes and event_dates
const eventCodes = Array.from(new Set(results.map(r => r.event_code)))
    .sort((a, b) => Number(a) - Number(b));
const eventDates = Array.from(new Set(results.map(r => r.event_date)))
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime()); // Latest first
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
const coeff: { [key: string]: { [key: string]: number } } = {};
    results.forEach(r => {
        if (!coeff[r.event_date]) coeff[r.event_date] = {};
        coeff[r.event_date][r.event_code] = r.coeff;
    });  
const event_number: { [key: string]: { [key: string]: number } } = {};
    results.forEach(r => {
        if (r.event_number <= 10000) {
            if (!event_number[r.event_date]) event_number[r.event_date] = {};
            event_number[r.event_date][r.event_code] = r.event_number;
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
//console.log('avgTimeLookup:', avgTimeLookup);
const eventTotals: { [code: string]: number } = {};
// Compute totals/aggregates per event code. For Times use the selected avgType lookup and respect aggType.
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
        } else {
            let lookup;
            if (filterType === 'volunteers') {
                lookup = volunteers;
            } else if (filterType === 'tourist') {
                lookup = tourists;
            } else if (filterType === 'eventNumber') {
                lookup = event_number;
            } else if (filterType === 'coeff') {
                lookup = coeff;
            } else {
                lookup = positionLookup;
            }
            eventTotals[code] = getAggregatedTotalForCode(lookup, eventDates, code, aggType);
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
            pos2='2.0em'
        />
        <AnalysisControls
            value={filterType}
            setValue={setFilterType}
            options={analysisType === 'Times' ? timesFilterOptions : participantFilterOptions}
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
                : [{ value: 'single', label: 'Single Value' }]
            }
            pos2='1.1em'
        />
        <AnalysisControls
            value={aggType}
            setValue={handleAggTypeChange}
            options={aggOptions.filter(opt => getAllowedAggTypes(analysisType, filterType).includes(opt.value))}
            label1="Agg"
            label2="Time Adj"
            value2={avgType}
            setValue2={setAvgType}
            options2={avgOptions}
            disabled={filterType === 'eventNumber' && aggType === 'total'}
            pos1="0.4cm"
        />
            <div className="results-table-container">
                <table className="results-table">
                    <thead>
                        <tr>
                            <th
                                colSpan={2}
                                className="sticky-corner-wide"
                                style={{ textAlign: 'center' }}
                            >
                                Participation
                            </th>
                            {eventDates.map(date => (
                                <th key={date} className="sticky-header">{formatDate2(date)}</th>
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
                                {analysisType === 'Times'
                                    ? (aggType === 'avg' ? 'Avg Time'
                                        : aggType === 'max' ? 'Max Time'
                                        : aggType === 'min' ? 'Min Time'
                                        : aggType === 'range' ? 'Range'
                                        : aggType === 'total' ? 'Total Time'
                                        : '')
                                    : (aggType === 'avg' ? 'Avg'
                                        : aggType === 'total' ? 'Total'
                                        : aggType === 'max' ? 'Max'
                                        : aggType === 'min' ? 'Min'
                                        : '')}
                                {sortBy === 'total'
                                    ? (sortDir === 'asc' ? '▲' : '▼')
                                    : <span style={{ opacity: 0.3 }}>▲▼</span>}
                            </th>
                            {eventDates.map(date => {
                                let lookup;
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
                                    const value = getAggregatedValueForDate(lookup, date, eventCodes, aggType);
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
                                    } else if (filterType === 'eventNumber') {
                                        lookup = event_number;
                                    } else if (filterType === 'coeff') {
                                        lookup = coeff;
                                    } else {
                                        lookup = positionLookup;
                                    }
                                    if (aggType === 'growth') {
                                        return <th key={date} className="sticky-header second-row"> </th>;
                                    }
                                    const value = getAggregatedValueForDate(lookup, date, eventCodes, aggType);
                                    return (
                                        <th key={date} className="sticky-header second-row">
                                            {filterType === 'coeff' ? formatCoeff(value) : value}
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
                                    {aggType === 'growth'
                                        ? formatSignedFixed(Number(eventTotals[code]), 2)
                                        : filterType === 'coeff'
                                            ? formatCoeff(eventTotals[code])
                                            : analysisType === 'Times'
                                                ? formatAvgTime(eventTotals[code])
                                                : eventTotals[code]}
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
                                        cellAgg
                                    });
                                    // compare numeric values with small tolerance to avoid float equality misses
                                    const isEqual = aggType !== 'growth' && numeric !== null && typeof eventTotals[code] === 'number' && Math.abs(numeric - eventTotals[code]) < 0.0001;
                                    const cellStyle = isEqual
                                        ? (aggType === 'max' ? { backgroundColor: '#d4f5d4' }
                                            : aggType === 'min' ? { backgroundColor: '#ffdce6' }
                                            : undefined)
                                        : undefined;
                                    return (
                                    <td key={date} style={cellStyle}>
                                        {filterType === 'eventNumber'
                                                ? (() => {
                                                    // For per-code cells show the raw event_number for that date/code
                                                    // (using aggregation like 'range' across a single code returns 0,
                                                    // which hides the cell — we want the actual event number here)
                                                    const raw = event_number[date]?.[code];
                                                    if (typeof raw === 'number' && raw !== 0 && raw <= 10000) {
                                                        if (eventMilestones.has(raw)) {
                                                            return <span style={{ fontWeight: 'bold' }}>{raw}</span>;
                                                        }
                                                        return raw;
                                                    }
                                                    return '';
                                                })()
                                                : (() => getCellValue({
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
                                                    cellAgg
                                                }))()
                                        }
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