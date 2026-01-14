import React, { useEffect, useRef, useState, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { fetchEventPositions, fetchEventInfo, fetchEventByNumber, fetchEventTimeAdjustment } from '../api/backendAPI';
import './ResultsTable.css';

// Minimal Races page — shows the selected event/date (from query) and attempts to fetch event positions
const Races: React.FC = () => {
    const navigate = useNavigate();
    const [rows, setRows] = useState<any[] | null>(null);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const location = useLocation();
    const containerRef = useRef<HTMLDivElement | null>(null);
    const tableRef = useRef<HTMLTableElement | null>(null);
    // Column widths in pixels for each table column (Pos, Athlete, ...)
    // Start with sensible defaults; we'll expand when switching to Detailed view.
    const defaultWidthsBase = [60, 240, 57, 57, 57, 57, 57];
    const [colWidths, setColWidths] = useState<number[]>(() => {
        try {
            const saved = sessionStorage.getItem('races_col_widths_v1');
            if (saved) return JSON.parse(saved);
        } catch (e) { /* ignore */ }
        return defaultWidthsBase.slice();
    });
    // View mode: 'basic' shows original columns, 'detailed' shows extra columns
    const [viewMode, setViewMode] = useState<'basic' | 'detailed' | 'allTimeAdjustments'>(() => {
        try {
            const s = sessionStorage.getItem('races_view_mode');
            return (s === 'detailed') ? 'detailed' : (s === 'allTimeAdjustments') ? 'allTimeAdjustments' : 'basic';
        } catch (e) { return 'basic'; }
    });
    // UI-only adjustment controls (no backend behavior wired yet)
    //const [groupsAdj, setGroupsAdj] = useState<string>('none');
    const [courseAdj, setCourseAdj] = useState<string>('none');
    const [otherAdj, setOtherAdj] = useState<string>('none');
    const resizingColRef = useRef<number | null>(null);
    const startXRef = useRef<number | null>(null);
    const startWidthRef = useRef<number | null>(null);
    const isDraggingRef = useRef(false);
    const lastYRef = useRef<number | null>(null);
    const [thumbHeight, setThumbHeight] = useState<number>(0);
    const [thumbTop, setThumbTop] = useState<number>(0);
    const [scrollbarLeft, setScrollbarLeft] = useState<number | null>(null);
    const [scrollbarTop, setScrollbarTop] = useState<number | null>(null);
    const [scrollbarHeight, setScrollbarHeight] = useState<number | null>(null);
    const thumbDragRef = useRef(false);
    const thumbRef = useRef<HTMLDivElement | null>(null);
    // Sorting state
    const [sortKey, setSortKey] = useState<string | null>(null);
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

    const snakeToCamel = (s: string) => s.replace(/_(.)/g, (_m, g1) => g1.toUpperCase());
    const getSortValue = (row: any, key: string) => {
        if (!row) return null;
        let v = row[key];
        if (v === undefined) v = row[snakeToCamel(key)];
        if (v === null || v === undefined) return null;
        if (typeof v === 'number') return v;
        const s = String(v).trim();
        // numeric?
        if (/^-?\d+(?:\.\d+)?$/.test(s)) return Number(s);
        return s.toLowerCase();
    };

    const handleSort = (key: string) => {
        if (sortKey === key) {
            setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortKey(key);
            setSortDir('asc');
        }
    };

    const sortedRows = useMemo(() => {
        if (!rows || !sortKey) return rows;
        const copy = (Array.isArray(rows) ? rows.slice() : []);
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

    // Start dragging on the fast-scroll overlay
    const onFastMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();
        isDraggingRef.current = true;
        lastYRef.current = e.clientY;
        document.addEventListener('mousemove', onFastMouseMove);
        document.addEventListener('mouseup', onFastMouseUp);
    };

    const onFastMouseMove = (e: MouseEvent) => {
        if (!isDraggingRef.current) return;
        const last = lastYRef.current ?? e.clientY;
        const dy = e.clientY - last;
        lastYRef.current = e.clientY;
        const el = containerRef.current;
        if (el) {
            // multiplier controls scroll speed when dragging
            const multiplier = 2.5;
            el.scrollTop += dy * multiplier;
        }
    };

    const onFastMouseUp = (_e: MouseEvent) => {
        isDraggingRef.current = false;
        lastYRef.current = null;
        document.removeEventListener('mousemove', onFastMouseMove);
        document.removeEventListener('mouseup', onFastMouseUp);
    };

    // Click on the overlay jumps to a proportional vertical position
    const onFastClick = (e: React.MouseEvent) => {
        const el = containerRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const y = e.clientY - rect.top;
        const target = (y / rect.height) * (el.scrollHeight - el.clientHeight);
        el.scrollTop = target;
    };

    // Custom scrollbar: update thumb size/position
    const updateThumb = () => {
        const el = containerRef.current;
        if (!el) return;
        const visible = el.clientHeight;
        const total = el.scrollHeight;
        // If we computed a fixed scrollbar track height, use that; otherwise
        // fall back to visible height. This keeps thumb position in sync with
        // the rendered track size (which may exclude padding).
        const trackHeight = scrollbarHeight ?? Math.max(20, Math.floor(visible - 12));
        const ratio = visible / total;
        const h = Math.max(30, Math.floor(ratio * trackHeight));
        const maxTop = Math.max(0, trackHeight - h);
        const scrollRatio = el.scrollTop / (total - visible || 1);
        const top = Math.floor(scrollRatio * maxTop);
        setThumbHeight(h);
        setThumbTop(top);
    };

    const updateScrollbarLeft = () => {
        const container = containerRef.current;
        const table = tableRef.current;
        if (!container || !table) {
            setScrollbarLeft(null);
            return;
        }
        const crect = container.getBoundingClientRect();
        const trect = table.getBoundingClientRect();
        // position the custom scrollbar just left of the table's right edge.
        const scrollbarWidth = 14; // match CSS .custom-scrollbar width
        // Use viewport coordinates so the scrollbar can be positioned `fixed`.
        let fixedLeft = Math.floor(trect.right - scrollbarWidth - 2);
        // Move the custom scrollbar slightly to the right so it doesn't cover the
        // last table column. Convert 5mm to pixels (assuming 96dpi) and apply.
        const mmToPx = (mm: number) => (mm * 96) / 25.4;
        const offsetPx = Math.round(mmToPx(5)); // ~19px
        fixedLeft = fixedLeft + offsetPx;
        // clamp to viewport bounds
        fixedLeft = Math.max(4, Math.min(fixedLeft, (window.innerWidth || document.documentElement.clientWidth) - scrollbarWidth - 4));
        // Compute a fixed-screen position (top) and height so the custom scrollbar
        // stays visible when the page scrolls or when the container scrolls.
        const top = Math.floor(crect.top + 6); // match CSS top:6px
        const height = Math.max(20, Math.floor(crect.height - 12));
        setScrollbarLeft(fixedLeft);
        setScrollbarTop(top);
        setScrollbarHeight(height);
    };

    // Thumb drag handlers — use Pointer Events and pointer capture so the thumb
    // follows the cursor directly and continues to receive events even if the
    // pointer leaves the element. This keeps the thumb under the cursor and
    // avoids flicker.
    const onThumbPointerDown = (e: React.PointerEvent) => {
        e.preventDefault();
        const thumbEl = thumbRef.current;
        const el = containerRef.current;
        if (!thumbEl || !el) return;
        thumbDragRef.current = true;
        // capture pointer so we keep receiving move/up events
        try {
            const target = e.target instanceof Element ? e.target : null;
            if (target && 'setPointerCapture' in target) {
                const anyTarget: any = target;
                anyTarget.setPointerCapture(e.pointerId);
            }
        } catch (err) {}
        // position immediately under cursor
        const trackEl = thumbEl.parentElement;
        if (!(trackEl instanceof HTMLElement)) return;
        const trackRect = trackEl.getBoundingClientRect();
        const y = e.clientY - trackRect.top;
        const h = Math.max(30, Math.floor((el.clientHeight / el.scrollHeight) * el.clientHeight));
        const maxTop = Math.max(0, trackRect.height - h);
        const newTop = Math.max(0, Math.min(maxTop, y - h / 2));
        // map to scroll
        const scrollRatio = newTop / (maxTop || 1);
        el.scrollTop = scrollRatio * (el.scrollHeight - el.clientHeight);
        thumbEl.style.top = `${newTop}px`;
        thumbEl.style.cursor = 'grabbing';
    };

    // Column resize handlers
    const onColResizerMouseDown = (e: React.MouseEvent, colIndex: number) => {
        e.preventDefault();
        resizingColRef.current = colIndex;
        startXRef.current = e.clientX;
        startWidthRef.current = colWidths[colIndex] ?? defaultWidthsBase[colIndex] ?? 100;
        document.addEventListener('mousemove', onColResizerMouseMove);
        document.addEventListener('mouseup', onColResizerMouseUp);
    };

    const onColResizerMouseMove = (e: MouseEvent) => {
        const col = resizingColRef.current;
        if (col === null) return;
        const startX = startXRef.current ?? e.clientX;
        const startW = startWidthRef.current ?? (colWidths[col] ?? defaultWidthsBase[col]);
        const dx = e.clientX - startX;
        //const newW = Math.max(40, Math.round(startW + dx));
        const newW = Math.max(40, Math.round(startW + dx));
        setColWidths(prev => {
            const copy = prev.slice();
            copy[col] = newW;
            return copy;
        });
    };

    const onColResizerMouseUp = (_e: MouseEvent) => {
        resizingColRef.current = null;
        startXRef.current = null;
        startWidthRef.current = null;
        document.removeEventListener('mousemove', onColResizerMouseMove);
        document.removeEventListener('mouseup', onColResizerMouseUp);
    };

    // Ensure any global listeners are removed on unmount
    useEffect(() => {
        return () => {
            try {
                document.removeEventListener('mousemove', onColResizerMouseMove);
                document.removeEventListener('mouseup', onColResizerMouseUp);
            } catch (e) {}
        };
    }, []);

    // Persist column widths when they change
    useEffect(() => {
        try { sessionStorage.setItem('races_col_widths_v1', JSON.stringify(colWidths)); } catch (e) { /* ignore */ }
    }, [colWidths]);

    const onThumbPointerMove = (e: React.PointerEvent) => {
        if (!thumbDragRef.current) return;
        const thumbEl = thumbRef.current;
        const el = containerRef.current;
        if (!thumbEl || !el) return;
        const trackEl = thumbEl.parentElement;
        if (!(trackEl instanceof HTMLElement)) return;
        const trackRect = trackEl.getBoundingClientRect();
        const y = e.clientY - trackRect.top;
        const visible = el.clientHeight;
        const total = el.scrollHeight;
        const h = Math.max(30, Math.floor((visible / total) * visible));
        const maxTop = Math.max(0, trackRect.height - h);
        const newTop = Math.max(0, Math.min(maxTop, y - h / 2));
        const scrollRatio = newTop / (maxTop || 1);
        el.scrollTop = scrollRatio * (total - visible);
        thumbEl.style.top = `${newTop}px`;
    };

    const onThumbPointerUp = (e: React.PointerEvent) => {
        if (!thumbDragRef.current) return;
        const thumbEl = thumbRef.current;
        const el = containerRef.current;
        if (!thumbEl || !el) return;
        thumbDragRef.current = false;
        try {
            const target = e.target instanceof Element ? e.target : null;
            if (target && 'releasePointerCapture' in target) {
                const anyTarget: any = target;
                anyTarget.releasePointerCapture(e.pointerId);
            }
        } catch (err) {}
        thumbEl.style.cursor = 'grab';
        // sync visual state into React
        updateThumb();
    };

    const params = new URLSearchParams(location.search);
    const date = params.get('date') || '';
    // Accept either `event` (legacy) or `event_code` (explicit) as the identifier
    const rawEventParam = params.get('event') || params.get('event_code') || '';
    // Accept an explicit event_number param so the page can display the
    // event number and show the ▲/▼ controls even when navigation used
    // `event_code`/`event_number` query params.
    const paramEventNumberRaw = params.get('event_number') || params.get('eventNumber') || null;
    const paramEventNumber = paramEventNumberRaw ? Number(paramEventNumberRaw) : null;
    const [eventInfo, setEventInfo] = useState<{ event_name?: string; event_number?: number; event_code?: number } | null>(null);
    const [navLoading, setNavLoading] = useState<boolean>(false);
    // If the URL doesn't include a `date`, we may resolve it from
    // `event_code` + `event_number` via the backend. Store the resolved
    // display date here (DD/MM/YYYY) so the header can show it.
    const [resolvedDateDisplay, setResolvedDateDisplay] = useState<string | null>(null);

    useEffect(() => {
    if (!rawEventParam && !date) return;

    const load = async () => {
        setLoading(true);
        setError(null);
        setEventInfo(null);
        setResolvedDateDisplay(null);

        try {
        // Resolve the DD/MM/YYYY date string expected by the backend
        let apiDate: string | null = date;
        if (apiDate && /^\d{4}-\d{2}-\d{2}$/.test(apiDate)) {
            const [yyyy, mm, dd] = apiDate.split('-');
            apiDate = `${dd}/${mm}/${yyyy}`;
        }

        if (!apiDate && rawEventParam && paramEventNumber) {
            try {
            const info = await fetchEventByNumber(Number(rawEventParam), Number(paramEventNumber));
            if (info?.event_date) {
                const d = String(info.event_date);
                if (/^\d{2}\/\d{2}\/\d{4}$/.test(d)) {
                apiDate = d;
                setResolvedDateDisplay(d);
                } else if (/^\d{4}-\d{2}-\d{2}$/.test(d)) {
                const [yyyy, mm, dd] = d.split('-');
                apiDate = `${dd}/${mm}/${yyyy}`;
                setResolvedDateDisplay(`${dd}/${mm}/${yyyy}`);
                } else {
                apiDate = d;
                setResolvedDateDisplay(d);
                }
            }
            } catch (err) {
            console.warn('fetchEventByNumber failed', err);
            }
        }

        if (!apiDate) throw new Error('Event date is unknown — cannot load event positions');

        const positionsPromise = fetchEventPositions(rawEventParam, apiDate);
        const adjustmentsPromise =
            viewMode === 'allTimeAdjustments' ? fetchEventTimeAdjustment(rawEventParam, apiDate) : Promise.resolve(null);

        const [positionsRaw, adjustmentsRaw] = await Promise.all([positionsPromise, adjustmentsPromise]);

        

        const baseRows = Array.isArray(positionsRaw) ? positionsRaw : [];

        const mergedRows =
            viewMode === 'allTimeAdjustments' && Array.isArray(adjustmentsRaw)
            ? (() => {
                const key = (athleteCode?: any, time?: any) => `${athleteCode ?? ''}__${time ?? ''}`;
                const adjMap = new Map(
                    adjustmentsRaw.map((row: any) => [key(row.athlete_code, row.time), row])
                );
                return baseRows.map((row) => {
                    const adj = adjMap.get(key(row.athlete_code, row.time));
                    return adj ? { ...row, ...adj } : row;
                });
                })()
            : baseRows;

        setRows(mergedRows);

        try {
            const info = await fetchEventInfo(rawEventParam, apiDate);
            setEventInfo(info && typeof info === 'object' ? info : null);
        } catch (infoErr) {
            console.warn('fetchEventInfo failed (optional):', infoErr);
        }
        } catch (err) {
        console.error('[Races] load failed:', err);
        setError('Failed to fetch event positions — backend may not support this endpoint');
        setRows(null);
        } finally {
        setLoading(false);
        }
    };

    load();
    }, [rawEventParam, date, paramEventNumber, viewMode]);

    // wire scroll/resize to update custom thumb
    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        updateThumb();
        updateScrollbarLeft();
        const onScroll = () => updateThumb();
        const onResize = () => {
            updateThumb();
            updateScrollbarLeft();
        };
        el.addEventListener('scroll', onScroll);
        // Also update scrollbar position/size when the page scrolls or container scrolls
        const onAnyScroll = () => updateScrollbarLeft();
        el.addEventListener('scroll', onAnyScroll);
        window.addEventListener('scroll', onAnyScroll);
        window.addEventListener('resize', onResize);
        return () => {
            el.removeEventListener('scroll', onScroll);
            window.removeEventListener('resize', onResize);
            el.removeEventListener('scroll', onAnyScroll);
            window.removeEventListener('scroll', onAnyScroll);
        };
    }, [rows]);

    // derive a friendly event name and number from fetched rows or the eventInfo API
    // If the identifier query param is numeric, don't show it as the event name
    const isNumericIdentifier = (s: string) => /^[0-9]+$/.test(String(s || '').trim());
    const eventName = (eventInfo && eventInfo.event_name)
        ? eventInfo.event_name
        : ((rows && rows.length > 0 && (rows[0].event_name || rows[0].eventName))
            ? (rows[0].event_name || rows[0].eventName)
            : (isNumericIdentifier(rawEventParam) ? '' : (rawEventParam || '')));
    // Prefer an explicit `event_number` query param when present because it
    // represents the navigation intent (e.g. `/races?event_code=1&event_number=472`).
    // Otherwise fall back to fetched `eventInfo` or the rows returned by the API.
    let eventNumberVal: number | null = null;
    if (paramEventNumber !== null) {
        eventNumberVal = paramEventNumber;
    } else {
        eventNumberVal = (eventInfo && eventInfo.event_number)
            ? eventInfo.event_number
            : ((rows && rows.length > 0) ? (rows[0].event_number ?? rows[0].eventNumber ?? null) : null);
    }

    // Keep any numeric event_code in a separate variable so we can display
    // it as a code (e.g. "code 3") rather than misstating it as an event_number.
    let eventCodeVal: number | null = null;
    // If we don't have a true event_number, try to read an event_code from
    // the fetched rows or the query param but don't assign it to
    // `eventNumberVal`.
    if (eventNumberVal === null || eventNumberVal === undefined) {
        if (rows && rows.length > 0) {
            const possibleCode = rows[0].event_code ?? rows[0].eventCode ?? null;
            if (possibleCode !== null && possibleCode !== undefined && possibleCode !== '') {
                const n = Number(possibleCode);
                if (!Number.isNaN(n)) eventCodeVal = n;
            }
        }
        if (eventCodeVal === null && isNumericIdentifier(rawEventParam)) {
            const n = Number(rawEventParam);
            if (!Number.isNaN(n)) eventCodeVal = n;
        }
    }
    const displayDate = (() => {
        // Prefer a resolved date (from fetchEventByNumber) if available.
        if (resolvedDateDisplay) return resolvedDateDisplay;
        if (!date) return '';
        if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            const p = date.split('-');
            return `${p[2]}/${p[1]}/${p[0]}`;
        }
        return date;
    })();
    

    // Change event number by delta (-1 or +1). Will look up the date for the
    // requested event number for the same event_code, then navigate/update.
    const changeEventNumber = async (delta: number) => {
        // Determine event_code to operate on
        const code = (eventInfo && eventInfo.event_code) ? Number(eventInfo.event_code) : (eventCodeVal ?? null);
        const currentNumber = eventNumberVal ? Number(eventNumberVal) : null;
        if (!code) {
            setError('Event code unknown — cannot change event number');
            return;
        }
        const candidate = (currentNumber || 0) + delta;
        if (candidate < 1) {
            setError('Already at the first event');
            return;
        }
        setNavLoading(true);
        setError(null);
        // changeEventNumber invocation logging removed
        try {
            const info = await fetchEventByNumber(code, candidate);
            // changeEventNumber fetchEventByNumber logging removed
            // Expecting event_date returned as DD/MM/YYYY or similar — convert to ISO YYYY-MM-DD for URL
            let newDate = info && (info.event_date || info.eventDate) ? String(info.event_date || info.eventDate) : '';
            if (!newDate) {
                setError('Event not found');
                return;
            }
            if (/^\d{2}\/\d{2}\/\d{4}$/.test(newDate)) {
                const p = newDate.split('/');
                newDate = `${p[2]}-${p[1]}-${p[0]}`;
            }
            // Navigate to the new event using only `event_code` + `event_number`.
            // The loader will resolve the date from these params.
            const qs = new URLSearchParams();
            qs.set('event_code', String(code));
            qs.set('event_number', String(candidate));
            navigate(`/races?${qs.toString()}`);
        } catch (e) {
            // If backend returned 404, surface a friendly message.
            // `e` is `unknown` in TS; narrow safely before accessing `response`.
            let status404 = false;
            try {
                if (e && typeof e === 'object' && 'response' in e) {
                    const anyE: any = e;
                    const resp = anyE.response;
                    if (resp && typeof resp.status === 'number' && resp.status === 404) status404 = true;
                }
            } catch (_err) {
                // ignore narrowing errors
            }
            if (status404) {
                setError('No event found for that event number (probably you are at the most recent event)');
            } else {
                setError(String(e));
            }
        } finally {
            setNavLoading(false);
        }
    };

    // Back button component placed in the header so users can return to Results

    const BackButton: React.FC = () => {
        const handleBack = () => {
            // Always navigate back to the Results page and ignore browser history entries.
            // Preserve Results UI state (if any) stored in sessionStorage under `results_state_v1`.
            try {
                const raw = sessionStorage.getItem('results_state_v1');
                const rs = new URLSearchParams();
                if (raw) {
                    const obj = JSON.parse(raw);
                    const keys = ['query','sortBy','sortDir','analysisType','avgType','filterType','aggType','cellAgg','scrollTop','scrollLeft'];
                    keys.forEach(k => {
                        if (obj && Object.prototype.hasOwnProperty.call(obj, k) && obj[k] !== undefined && obj[k] !== null) {
                            rs.set(`rs_${k}`, String(obj[k]));
                        }
                    });
                }
                const q = rs.toString();
                navigate(`/results${q ? `?${q}` : ''}`);
            } catch (e) {
                navigate('/results');
            }
        };
        return (
            <button
                type="button"
                aria-label="Back to Event Analysis"
                className="races-back-btn"
                onClick={handleBack}
                title="Back to Event Analysis"
            >
                ←
            </button>
        );
    };

    // Expose CSS variables for first two column widths so sticky offsets follow user resizing.
    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        try {
            el.style.setProperty('--col1-width', `${colWidths[0]}px`);
            el.style.setProperty('--col2-width', `${colWidths[1]}px`);
        } catch (e) {
            // ignore
        }
    }, [colWidths]);

    // Ensure header <th> widths match the rendered <col> widths so header and
    // body columns remain aligned even after resizing. Run after layout via
    // two RAFs to ensure the browser has applied col widths.
    useEffect(() => {
        const applyHeaderWidths = () => {
            const table = tableRef.current;
            if (!table) return;
            const cols = table.querySelectorAll<HTMLTableColElement>('col');
            const ths = table.querySelectorAll<HTMLTableCellElement>('thead th');
            for (let i = 0; i < cols.length; i++) {
                try {
                    const col = cols[i];
                    const rect = col.getBoundingClientRect();
                    const w = Math.max(0, Math.round(rect.width));
                    const th = ths[i];
                    if (th && th instanceof HTMLElement) {
                        // Apply pixel-exact widths on the header to mirror the <col>
                        th.style.minWidth = `${w}px`;
                        th.style.width = `${w}px`;
                        th.style.maxWidth = `${w}px`;
                    }
                } catch (e) {
                    // ignore measurement errors
                }
            }
        };

        // Defer until after layout; run two RAFs to be safer across browsers.
        let raf1 = 0;
        let raf2 = 0;
        raf1 = requestAnimationFrame(() => {
            raf2 = requestAnimationFrame(() => {
                try {
                    applyHeaderWidths();
                    // Ensure sticky second-column left offset exactly matches the
                    // rendered width of the first <col>. Using the measured width
                    // prevents overlap from rounding differences (don't use a
                    // visual shunt — it caused inconsistent overlap on mobile).
                    const table = tableRef.current;
                    if (table) {
                        const firstCol = table.querySelector<HTMLTableColElement>('col');
                        if (firstCol) {
                            const firstW = Math.max(0, Math.round(firstCol.getBoundingClientRect().width));
                            const leftPx = firstW; // position second sticky immediately after first
                            const sticky2 = table.querySelectorAll<HTMLElement>('.sticky-col-2, .sticky-corner-2-2');
                            sticky2.forEach(el => {
                                try { el.style.left = `${leftPx}px`; } catch (e) { /* ignore */ }
                            });
                        }
                    }
                } catch (err) {
                    // ignore
                }
            });
        });
        const onResize = () => {
            // Recompute after layout stabilises
            requestAnimationFrame(() => requestAnimationFrame(() => applyHeaderWidths()));
        };
        window.addEventListener('resize', onResize);
        window.addEventListener('orientationchange', onResize);

        return () => {
            window.removeEventListener('resize', onResize);
            window.removeEventListener('orientationchange', onResize);
            if (raf1) cancelAnimationFrame(raf1);
            if (raf2) cancelAnimationFrame(raf2);
        };
    }, [colWidths, rows]);

    // Column definitions: base (basic) and additional (detailed)
    const baseColumns = [
        { k: 'time', label: 'Time' },
        { k: 'age_group', label: 'Age group' },
        { k: 'age_grade', label: 'Age grade' },
        { k: 'club', label: 'Club' },
        { k: 'comment', label: 'Detail' }
    ];
    const extraColumns = [
        { k: 'total_runs', label: 'Total runs' },
        { k: 'last_event_code_count_long', label: 'Local recent' },
        { k: 'event_eligible_appearances', label: 'Eligible recent' },
        { k: 'distinct_courses_long', label: 'Other events' }

    ];
    const adjustmentColumns = [
    { k: 'season_adj_time', label: 'Season' },
    { k: 'event_adj_time', label: 'Event' },
    { k: 'age_adj_time', label: 'Age' },
    { k: 'sex_adj_time', label: 'Sex' },
    { k: 'age_event_adj_time', label: 'Event+Age' },
    { k: 'sex_event_adj_time', label: 'Event+Sex' },
    { k: 'age_sex_adj_time', label: 'Age+Sex' },
    { k: 'age_sex_event_adj_time', label: 'Event+Age+Sex' }
    ];
    // ...after adjustmentColumns definition
    const columns = useMemo(() => {
        if (viewMode === 'detailed') return [...baseColumns, ...extraColumns];
        if (viewMode === 'allTimeAdjustments') return [...baseColumns, ...adjustmentColumns];
        return baseColumns;
    }, [viewMode]);

    // keep colWidths aligned with the current column count
    useEffect(() => {
    const desired = 2 + columns.length;
    setColWidths(prev => {
        const copy = prev.slice(0, desired);
        while (copy.length < desired) copy.push(90);
        return copy;
    });
    }, [columns]);

    // Persist view mode
    useEffect(() => {
        try { sessionStorage.setItem('races_view_mode', viewMode); } catch (e) { /* ignore */ }
    }, [viewMode]);

    return (
        <div className="page-content">
            <div className="races-header" style={{ marginBottom: '0.0em', display: 'flex', alignItems: 'normal',marginLeft: '1.0em' }}>
                <BackButton />
                <div className="races-header-text">
                    <div className="races-header-title">{eventName || <em>none</em>}</div>
                    <div className="races-header-sub">
                        {displayDate || ''}
                        { (displayDate && (eventNumberVal || eventCodeVal)) && (
                            <span className="races-header-sep"></span>
                        ) }
                        { eventNumberVal ? (
                                <span style={{ display: 'inline-flex', alignItems: 'start', gap: 6 , transform: 'translateY(-0.5cm)' }}>
                                    <span style={{ marginLeft: '1.1rem',marginTop: '0.3cm'  }}>{`#${eventNumberVal}`}</span>  
                                    <span style={{ display: 'inline-flex', flexDirection: 'column' }}>
                                        <button
                                            type="button"
                                            onClick={() => changeEventNumber(1)}
                                            disabled={navLoading}
                                            title="Previous event"
                                            className="evnum-btn"
                                            style={{ padding: '2px 6px', fontSize: '0.7rem' }}
                                        >▲</button>
                                        <button
                                            type="button"
                                            onClick={() => changeEventNumber(-1)}
                                            disabled={navLoading}
                                            title="Next event"
                                            className="evnum-btn"
                                            style={{ padding: '2px 6px', fontSize: '0.7rem' }}
                                        >▼</button>
                                    </span>
                                    <span className="races-view-control">
                                        <div className="races-view-control-item">
                                            <label htmlFor="races-view-select">View:</label>
                                            <select
                                                id="races-view-select"
                                                value={viewMode}
                                                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                                                    const v = e.target.value;
                                                    setViewMode(v === 'detailed' ? 'detailed' : v === 'allTimeAdjustments' ? 'allTimeAdjustments' : 'basic');
                                                }}
                                                aria-label="Races view mode"
                                            >
                                                <option value="basic">Basic</option>
                                                <option value="detailed">Detailed</option>
                                                <option value="allTimeAdjustments">All Time Adjustments</option>
                                            </select>
                                         </div>

                                        <div className="races-view-control-item">
                                            <label htmlFor="course-adj-select">Course adj:</label>
                                            <select id="course-adj-select" value={courseAdj} onChange={(e) => setCourseAdj(e.target.value)} aria-label="Course adjustment">
                                                <option value="none">no adjustment (default)</option>
                                                <option value="seasonal">seasonal adjustments</option>
                                                <option value="full">full event adjustments</option>
                                            </select>
                                        </div>
                                        <div className="races-view-control-item">
                                            <label htmlFor="other-adj-select">Other adj:</label>
                                            <select id="other-adj-select" value={otherAdj} onChange={(e) => setOtherAdj(e.target.value)} aria-label="Other adjustment">
                                                <option value="none">no adjustment (default)</option>
                                                <option value="age">age adjustments</option>
                                                <option value="sex">sex adjustments</option>
                                                <option value="age_sex">age & sex adjustment</option>
                                            </select>
                                        </div>
                                    </span>
                                </span>
                            ) : (eventCodeVal ? `code ${eventCodeVal}` : '') }
                    </div>
                </div>
            </div>
            {loading && <div className="loading-message" style={{ color: 'darkred', position: 'absolute', top: 'calc(20% - 0.1cm)', left: '6%', transform: 'translate(-50%, -50%)' }}>Loading event positions…</div>}
            {error && <div className="error-message" style={{ color: 'darkred', position: 'absolute', top: 'calc(20% - 0.1cm)', left: '17%', transform: 'translate(-50%, -50%)' }}>{error}</div>}               {rows && rows.length === 0 && <div>No positions returned for this event/date.</div>}
            {rows && rows.length > 0 && (
                            <div className="results-table-container" ref={containerRef}>
                            <table
                                key={viewMode}                 // force remount when view changes
                                className="results-table races-table"
                                ref={tableRef}
                            >
                                {/* colgroup ... */}
                                <colgroup>
                                {Array.from({ length: 2 + columns.length }).map((_, i) => {
                                    const w = colWidths[i] ?? (defaultWidthsBase[i] ?? 90);
                                    return <col key={i} style={{ width: `${w}px` }} />;
                                })}
                                </colgroup>

                                {/* ... */}

                            <thead key={viewMode}>
                            {/* Top header row: first two sticky headers then the remaining column headers */}
                            <tr>
                                <th
                                    className="sticky-col sticky-header"
                                    style={{ fontWeight: 700, position: 'relative', cursor: 'pointer' }}
                                    onClick={() => handleSort('position')}
                                    onTouchEnd={(e) => { e.preventDefault(); handleSort('position'); }}
                                >
                                    <span>Pos{sortKey === 'position' ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''}</span>
                                    <div
                                        role="separator"
                                        aria-orientation="vertical"
                                        onMouseDown={(e) => onColResizerMouseDown(e, 0)}
                                        style={{ position: 'absolute', right: 0, top: 0, width: 8, height: '100%', cursor: 'col-resize' }}
                                    />
                                </th>
                                    <th
                                        className="sticky-col-2 sticky-header"
                                        style={{ fontWeight: 700, textAlign: 'left', cursor: 'pointer' }}
                                        onClick={() => handleSort('name')}
                                        onTouchEnd={(e) => { e.preventDefault(); handleSort('name'); }}
                                    >
                                        <span>Athlete{sortKey === 'name' ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''}</span>
                                        <div
                                            role="separator"
                                            aria-orientation="vertical"
                                            onMouseDown={(e) => onColResizerMouseDown(e, 1)}
                                            style={{ position: 'absolute', right: 0, top: 0, width: 8, height: '100%', cursor: 'col-resize' }}
                                        />
                                    </th>
                                    {/* Render columns based on selected view (basic/detailed) */}
                                    {columns.map((col, idx) => (
                                    <th
                                        key={col.k}
                                        className={`sticky-header ${adjustmentColumns.find(ac => ac.k === col.k) ? 'adjustment-header' : ''}`}
                                        style={{ fontWeight: 700, position: 'relative', cursor: 'pointer' }}
                                        onClick={() => handleSort(col.k)}
                                        onTouchEnd={(e) => { e.preventDefault(); handleSort(col.k); }}  // add this
                                    >
                                        <span>{col.label}{sortKey === col.k ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''}</span>
                                        <div
                                        role="separator"
                                        aria-orientation="vertical"
                                        onMouseDown={(e) => onColResizerMouseDown(e, idx + 2)}
                                        style={{ position: 'absolute', right: 0, top: 0, width: 8, height: '100%', cursor: 'col-resize' }}
                                        />
                                    </th>
                                    ))}
                                </tr>
                                </thead>
                        <tbody>
                            {(sortedRows ?? rows).map((r: any, i: number) => (
                                <tr key={r.athlete_code || i}>
                                    {/* First two sticky columns: position, name */}
                                    <td className="sticky-col">{String(r['position'] ?? '')}</td>
                                        {
                                            (() => {
                                                const athleteName = String(r['name'] ?? r['athlete_name'] ?? '');
                                                const superTourVal = r['super_tourist'] ?? r['super_tourist'.replace(/_(.)/g, (_m, g1) => g1.toUpperCase())] ?? '';
                                                const isSuperTour = (String(superTourVal) === 'T' || String(superTourVal) === '1' || superTourVal === 1);
                                                const superReturnVal = r['super_returner'] ?? r['super_returner'.replace(/_(.)/g, (_m, g1) => g1.toUpperCase())] ?? '';
                                                const isCommentBold = (String(superReturnVal) === 'T' || String(superReturnVal) === '1' || superReturnVal === 1);
                                                // Crown: when Eligible recent > 10 or Local recent > 20 and Detail equals 'New PB!'
                                                const eligibleRaw = r['event_eligible_appearances'] ?? r['eventEligibleAppearances'] ?? r['event_eligible_appearances'.replace(/_(.)/g, (_m, g1) => g1.toUpperCase())] ?? '';
                                                const localRaw = r['last_event_code_count_long'] ?? r['lastEventCodeCountLong'] ?? r['last_event_code_count_long'.replace(/_(.)/g, (_m, g1) => g1.toUpperCase())] ?? '';
                                                const eligibleNum = Number(eligibleRaw) || 0;
                                                const localNum = Number(localRaw) || 0;
                                                const commentRaw = String(r['comment'] ?? r['comment'.replace(/_(.)/g, (_m, g1) => g1.toUpperCase())] ?? '');
                                                const showCrown = ( (eligibleNum > 10 || localNum > 20) && commentRaw === 'New PB!' );
                                                const otherRaw = r['distinct_courses_long'] ?? r['distinctCoursesLong'] ?? r['distinct_courses_long'.replace(/_(.)/g, (_m, g1) => g1.toUpperCase())] ?? '';
                                                const otherNum = Number(otherRaw) || 0;
                                                const totalRaw = r['total_runs'] ?? r['totalRuns'] ?? r['total_runs'.replace(/_(.)/g, (_m, g1) => g1.toUpperCase())] ?? null;
                                                // First-timer badge conditions (shared match). Two variants:
                                                //  - firstEver: total_runs is null/absent → '1st ever Parkrun'
                                                //  - firstAtEvent: total_runs present → 'First time at this event'
                                                const isFirstTimerMatch = (commentRaw === 'First Timer!' && localNum === 1 && otherNum === 1);
                                                const showFirstBadgeFirstEver = isFirstTimerMatch && (totalRaw == null);
                                                const showFirstBadgeEventOnly = isFirstTimerMatch && (totalRaw != null);
                                                return (
                                                    <td className="sticky-col-2" style={{ textAlign: 'left' }}>
                                                        {athleteName}
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
                                            })()
                                        }
                                    {/* Render remaining columns dynamically */}
                                    {columns.map((col) => {
                                        const rawVal = r[col.k] ?? r[col.k.replace(/_(.)/g, (_m, g1) => g1.toUpperCase())] ?? '';
                                        const textAlign = (typeof rawVal === 'string') ? ((col.k === 'club' || col.k === 'comment') ? 'left' : undefined) : undefined;
                                        const cellStyle: React.CSSProperties = { textAlign };
                                        // If this is the Eligible recent column and the row is marked Regular === 'T', shade green
                                        if (col.k === 'event_eligible_appearances') {
                                            const regVal = r['regular'] ?? r['regular'.replace(/_(.)/g, (_m, g1) => g1.toUpperCase())] ?? '';
                                            if (String(regVal) === 'T') {
                                                cellStyle.backgroundColor = '#dff0d8';
                                            }
                                        }
                                        // If this is the Other events column and the row is marked Tourist === 'T', shade green
                                        if (col.k === 'distinct_courses_long') {
                                            const tourVal = r['tourist_flag'] ?? r['tourist_flag'.replace(/_(.)/g, (_m, g1) => g1.toUpperCase())] ?? '';
                                            if (String(tourVal) === 'T') {
                                                cellStyle.backgroundColor = '#dff0d8';
                                            }
                                            // If the row is marked as super_tourist, make the Other events cell bold
                                            const superTourVal = r['super_tourist'] ?? r['super_tourist'.replace(/_(.)/g, (_m, g1) => g1.toUpperCase())] ?? '';
                                            if (String(superTourVal) === 'T' || String(superTourVal) === '1' || superTourVal === 1) {
                                                cellStyle.fontWeight = '700';
                                            }
                                        }
                                        // If this is the Detail column and row has returner/super_returner flags, style accordingly
                                        if (col.k === 'comment') {
                                            const returnerVal = r['returner'] ?? r['returner'.replace(/_(.)/g, (_m, g1) => g1.toUpperCase())] ?? '';
                                            const superReturnerVal = r['super_returner'] ?? r['super_returner'.replace(/_(.)/g, (_m, g1) => g1.toUpperCase())] ?? '';
                                            if (String(returnerVal) === 'T') {
                                                cellStyle.backgroundColor = '#dff0d8';
                                            }
                                            if (String(superReturnerVal) === 'T') {
                                                cellStyle.fontWeight = '700';
                                            }
                                            // Also make the comment bold when the crown condition applies
                                            const eligibleRaw = r['event_eligible_appearances'] ?? r['eventEligibleAppearances'] ?? r['event_eligible_appearances'.replace(/_(.)/g, (_m, g1) => g1.toUpperCase())] ?? '';
                                            const localRaw = r['last_event_code_count_long'] ?? r['lastEventCodeCountLong'] ?? r['last_event_code_count_long'.replace(/_(.)/g, (_m, g1) => g1.toUpperCase())] ?? '';
                                            const eligibleNum = Number(eligibleRaw) || 0;
                                            const localNum = Number(localRaw) || 0;
                                            const commentRaw = String(r['comment'] ?? r['comment'.replace(/_(.)/g, (_m, g1) => g1.toUpperCase())] ?? '');
                                            const showCrown = ( (eligibleNum > 10 || localNum > 20) && commentRaw === 'New PB!' );
                                            if (showCrown) {
                                                cellStyle.fontWeight = '700';
                                            }
                                        }
                                        return (
                                            <td key={col.k} style={cellStyle}>
                                                {String(rawVal)}
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {/* Native scrollbars are used instead of custom fast-scroll/always-visible thumb. */}
                </div>
            )}
            {!loading && rows === null && !error && (
                <div>Click a cell in Event Analysis to view the selected event/date here.</div>
            )}
        </div>
    );
};

export default Races;
