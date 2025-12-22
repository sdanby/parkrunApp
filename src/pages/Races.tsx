import React, { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { fetchEventPositions, fetchEventInfo } from '../api/backendAPI';
import './ResultsTable.css';

// Minimal Races page — shows the selected event/date (from query) and attempts to fetch event positions
const Races: React.FC = () => {
    const [rows, setRows] = useState<any[] | null>(null);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const location = useLocation();
    const containerRef = useRef<HTMLDivElement | null>(null);
    const tableRef = useRef<HTMLTableElement | null>(null);
    const isDraggingRef = useRef(false);
    const lastYRef = useRef<number | null>(null);
    const [thumbHeight, setThumbHeight] = useState<number>(0);
    const [thumbTop, setThumbTop] = useState<number>(0);
    const [scrollbarLeft, setScrollbarLeft] = useState<number | null>(null);
    const [scrollbarTop, setScrollbarTop] = useState<number | null>(null);
    const [scrollbarHeight, setScrollbarHeight] = useState<number | null>(null);
    const thumbDragRef = useRef(false);
    const thumbRef = useRef<HTMLDivElement | null>(null);

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
    const eventCodeOrName = params.get('event') || '';
    const [eventInfo, setEventInfo] = useState<{ event_name?: string; event_number?: number; event_code?: number } | null>(null);

    useEffect(() => {
        // If no params, do nothing — keep page minimal
        if (!eventCodeOrName && !date) return;
        const load = async () => {
            setLoading(true);
            setError(null);
            try {
                // Normalize date to DD/MM/YYYY expected by backend (accept YYYY-MM-DD or DD/MM/YYYY)
                let apiDate = date || '';
                if (/^\d{4}-\d{2}-\d{2}$/.test(apiDate)) {
                    const parts = apiDate.split('-');
                    apiDate = `${parts[2]}/${parts[1]}/${parts[0]}`;
                }
                // Use the centralized API helper which respects `API_BASE_URL`
                try {
                    console.log('[Races] fetchEventPositions params:', { eventCodeOrName, apiDate });
                    const data = await fetchEventPositions(eventCodeOrName, apiDate);
                    console.log('[Races] fetchEventPositions response:', Array.isArray(data) ? `rows:${data.length}` : data);
                    setRows(Array.isArray(data) ? data : []);
                } catch (err) {
                    console.error('[Races] fetchEventPositions failed:', err);
                    throw err;
                }
                try {
                    console.log('[Races] fetchEventInfo params:', { eventCodeOrName, apiDate });
                    const info = await fetchEventInfo(eventCodeOrName, apiDate);
                    console.log('[Races] fetchEventInfo response:', info);
                    setEventInfo(info && typeof info === 'object' ? info : null);
                } catch (e) {
                    console.warn('[Races] fetchEventInfo failed (optional):', e);
                    // ignore — optional info
                }
            } catch (err) {
                setError('Failed to fetch event positions — backend may not support this endpoint');
                setRows(null);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [eventCodeOrName, date]);

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
    // If the `event` query param is a numeric code, don't show it as the event name
    const isNumericIdentifier = (s: string) => /^[0-9]+$/.test(String(s || '').trim());
    const eventName = (eventInfo && eventInfo.event_name)
        ? eventInfo.event_name
        : ((rows && rows.length > 0 && (rows[0].event_name || rows[0].eventName))
            ? (rows[0].event_name || rows[0].eventName)
            : (isNumericIdentifier(eventCodeOrName) ? '' : (eventCodeOrName || '')));
    let eventNumberVal = (eventInfo && eventInfo.event_number)
        ? eventInfo.event_number
        : ((rows && rows.length > 0) ? (rows[0].event_number ?? rows[0].eventNumber ?? null) : null);
    // If we still don't have an event number but the `event` query param is numeric,
    // use it as a fallback so the header can at least show `#<code>` when backend info is missing.
    if ((eventNumberVal === null || eventNumberVal === undefined) && isNumericIdentifier(eventCodeOrName)) {
        try {
            eventNumberVal = Number(eventCodeOrName);
        } catch (e) {
            // ignore
        }
    }
    const displayDate = (() => {
        if (!date) return '';
        if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            const p = date.split('-');
            return `${p[2]}/${p[1]}/${p[0]}`;
        }
        return date;
    })();

    return (
        <div className="page-content">
            <div className="races-header" style={{ marginBottom: '0.6em' }}>
                <div style={{ fontWeight: 700 }}>{eventName || <em>none</em>}</div>
                <div style={{ color: '#444' }}>
                    {displayDate || ''}{eventNumberVal ? `  #${eventNumberVal}` : ''}
                </div>
            </div>
            {loading && <div>Loading event positions…</div>}
            {error && <div style={{ color: 'darkred' }}>{error}</div>}
            {rows && rows.length === 0 && <div>No positions returned for this event/date.</div>}
            {rows && rows.length > 0 && (
                <div className="results-table-container" ref={containerRef}>
                    <table className="results-table races-table" ref={tableRef}>
                        <thead>
                            {/* Top header row: first two sticky headers then the remaining column headers */}
                            <tr>
                                <th className="sticky-col sticky-corner" style={{ fontWeight: 700 }}>Pos</th>
                                    <th className="sticky-col-2 sticky-corner-2" style={{ fontWeight: 700, textAlign: 'left' }}>Athlete</th>
                                    {/* Use explicit column ordering with friendly labels */}
                                    {[
                                        { k: 'time', label: 'Time' },
                                        { k: 'age_group', label: 'Age group' },
                                        { k: 'age_grade', label: 'Age grade' },
                                        { k: 'club', label: 'Club' },
                                        { k: 'comment', label: 'Detail' }
                                    ].map(col => (
                                        <th key={col.k} className="sticky-header" style={{ fontWeight: 700 }}>{col.label}</th>
                                    ))}
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((r: any, i: number) => (
                                <tr key={r.athlete_code || i}>
                                    {/* First two sticky columns: position, name */}
                                    <td className="sticky-col">{String(r['position'] ?? '')}</td>
                                        <td className="sticky-col-2" style={{ textAlign: 'left' }}>{String(r['name'] ?? r['athlete_name'] ?? '')}</td>
                                    {/* Remaining columns in requested order */}
                                        <td>{String(r['time'] ?? '')}</td>
                                        <td>{String(r['age_group'] ?? '')}</td>
                                        <td>{String(r['age_grade'] ?? '')}</td>
                                        <td style={{ textAlign: 'left' }}>{String(r['club'] ?? '')}</td>
                                        <td style={{ textAlign: 'left' }}>{String(r['comment'] ?? r['detail'] ?? '')}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {/* fast-scroll overlay: click to jump, drag to scroll faster */}
                    <div
                        className="fast-scroll"
                        onMouseDown={onFastMouseDown}
                        onClick={onFastClick}
                        aria-hidden="true"
                    />
                    {/* custom scrollbar: always-visible thumb */}
                    <div
                        className="custom-scrollbar"
                        aria-hidden="true"
                        style={
                            scrollbarLeft !== null && scrollbarTop !== null && scrollbarHeight !== null
                                ? { position: 'fixed', left: `${scrollbarLeft}px`, top: `${scrollbarTop}px`, height: `${scrollbarHeight}px`, right: 'auto' }
                                : (scrollbarLeft !== null ? { left: `${scrollbarLeft}px`, right: 'auto' } : undefined)
                        }
                    >
                        <div
                            className="custom-thumb"
                            ref={thumbRef}
                            style={{ height: `${thumbHeight}px`, top: `${thumbTop}px` }}
                            onPointerDown={onThumbPointerDown}
                            onPointerMove={onThumbPointerMove}
                            onPointerUp={onThumbPointerUp}
                        />
                    </div>
                </div>
            )}
            {!loading && rows === null && !error && (
                <div>Click a cell in Results to view the selected event/date here.</div>
            )}
        </div>
    );
};

export default Races;
