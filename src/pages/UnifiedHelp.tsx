import React, { useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';

export const UNIFIED_HELP_EVENT = 'parkrun:open-unified-help';

export type UnifiedHelpAnchor = {
    x: number;
    y: number;
};

export const requestUnifiedHelp = (markerId: string = 'top', anchor?: UnifiedHelpAnchor | null) => {
    window.dispatchEvent(new CustomEvent(UNIFIED_HELP_EVENT, { detail: { markerId, anchor: anchor || null } }));
};

export const getPageMarkerForPath = (path: string): string | null => {
    if (path === '/results') return 'page-event-analysis';
    if (path === '/results_test') return 'page-event-analysis';
    if (path === '/races') return 'page-single-event';
    if (path === '/event_test') return 'page-single-event';
    if (path === '/courses') return 'page-course';
    if (path === '/athletes') return 'page-participant';
    if (path === '/clubs') return 'page-club';
    if (path === '/lists') return 'page-lists';
    return null;
};

export const getMarkerForControlLabel = (label: string): string => {
    const key = String(label || '').trim().toLowerCase();
    const map: Record<string, string> = {
        type: 'control-filter',
        calc: 'control-type',
        filter: 'control-filter',
        view: 'control-table-view',
        'table view': 'control-table-view',
        'athlete code': 'control-athlete-code',
        'estimated age': 'control-estimated-age',
        'total runs': 'control-total-runs',
        'recent club': 'control-recent-club',
        'freq course': 'control-freq-course',
        'course adj': 'control-course-adj',
        'other adj': 'control-other-adj',
        'hardness adj': 'control-hardness-adj',
        period: 'control-period',
        agg: 'control-agg',
        'cell agg': 'control-cell-agg',
        'time adj': 'control-time-adj'
    };
    return map[key] || 'top';
};

// HELP_DOCUMENT removed: now loaded from /helptext.md







type UnifiedHelpOverlayProps = {
    open: boolean;
    startMarkerId: string;
    anchor?: UnifiedHelpAnchor | null;
    onClose: () => void;
};

export const UnifiedHelpOverlay: React.FC<UnifiedHelpOverlayProps> = ({ open, startMarkerId, anchor, onClose }) => {
    const [markdown, setMarkdown] = useState<string>('Loading help...');
    const bodyRef = useRef<HTMLDivElement | null>(null);
    const highlightedRef = useRef<HTMLDivElement | null>(null);

    const scrollBehavior = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 'auto'
        : 'smooth';

    const clearHighlight = () => {
        if (highlightedRef.current?.parentElement) {
            const wrapper = highlightedRef.current;
            const parent = wrapper.parentElement;

            if (!parent) {
                highlightedRef.current = null;
                return;
            }

            while (wrapper.firstChild) {
                parent.insertBefore(wrapper.firstChild, wrapper);
            }

            parent.removeChild(wrapper);
            highlightedRef.current = null;
        }
    };

    const getHighlightTarget = (anchorElement: HTMLElement) => {
        const nextElement = anchorElement.nextElementSibling;
        if (nextElement instanceof HTMLElement && /^H[1-6]$/.test(nextElement.tagName)) {
            return nextElement;
        }

        if (/^H[1-6]$/.test(anchorElement.tagName)) {
            return anchorElement;
        }

        let current: HTMLElement | null = anchorElement;
        while (current) {
            if (current.firstElementChild instanceof HTMLElement) {
                current = current.firstElementChild;
            } else {
                while (current && !current.nextElementSibling) {
                    current = current.parentElement;
                    if (current === bodyRef.current) {
                        current = null;
                        break;
                    }
                }

                if (current?.nextElementSibling instanceof HTMLElement) {
                    current = current.nextElementSibling;
                }
            }

            if (current && /^H[1-6]$/.test(current.tagName)) {
                return current;
            }
        }

        return anchorElement;
    };

    const getSectionElements = (sectionStart: HTMLElement) => {
        const elements: HTMLElement[] = [sectionStart];
        let nextElement = sectionStart.nextElementSibling;

        while (nextElement instanceof HTMLElement) {
            if (/^H[1-6]$/.test(nextElement.tagName)) {
                break;
            }

            if (nextElement.id) {
                break;
            }

            elements.push(nextElement);
            nextElement = nextElement.nextElementSibling;
        }

        return elements;
    };

    useEffect(() => {
        if (!open) return;
        fetch('/helptext.md')
            .then((res) => res.text())
            .then(setMarkdown)
            .catch(() => setMarkdown('Help file not found.'));
    }, [open]);

    useEffect(() => {
        if (!open) {
            clearHighlight();
            return;
        }

        if (!open || !bodyRef.current) return;

        clearHighlight();

        const target = bodyRef.current.querySelector<HTMLElement>(`#${CSS.escape(startMarkerId || 'top')}`);
        if (!target) {
            bodyRef.current.scrollTo({ top: 0, behavior: scrollBehavior });
            return;
        }

        const highlightTarget = getHighlightTarget(target);
        const sectionElements = getSectionElements(highlightTarget);

        const highlightWrapper = document.createElement('div');
        highlightWrapper.className = 'unified-help-target-highlight';
        sectionElements[0].parentElement?.insertBefore(highlightWrapper, sectionElements[0]);
        sectionElements.forEach((element) => {
            highlightWrapper.appendChild(element);
        });

        highlightWrapper.scrollIntoView({ block: 'start', behavior: scrollBehavior });
        highlightedRef.current = highlightWrapper;

        return () => {
            clearHighlight();
        };
    }, [markdown, open, scrollBehavior, startMarkerId]);

    const panelStyle = useMemo(() => {
        if (!anchor || !Number.isFinite(anchor.x) || !Number.isFinite(anchor.y)) return undefined;

        const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1200;
        const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 800;
        const panelWidth = Math.min(704, Math.floor(viewportWidth * 0.92));
        const margin = 12;

        const left = Math.max(margin, Math.min(anchor.x, viewportWidth - panelWidth - margin));
        const top = Math.max(56, Math.min(anchor.y + 8, viewportHeight - 120));
        const maxHeight = Math.max(240, viewportHeight - top - margin);

        return {
            position: 'fixed' as const,
            left: `${left}px`,
            top: `${top}px`,
            maxHeight: `${maxHeight}px`
        };
    }, [anchor]);

    if (!open) return null;

    return (
        <div className="unified-help-backdrop" onMouseDown={(event) => {
            if (event.target === event.currentTarget) onClose();
        }}>
            <div className="unified-help-panel" style={panelStyle} role="dialog" aria-hidden={!open}>
                <div className="unified-help-head">
                    <strong>Help Manual</strong>
                    <button type="button" className="unified-help-close" onClick={onClose} aria-label="Close help">✕</button>
                </div>
                <div ref={bodyRef} className="unified-help-body" style={{ overflowY: 'auto', maxHeight: '60vh' }}>
                    <ReactMarkdown rehypePlugins={[rehypeRaw as any]}>{markdown}</ReactMarkdown>
                </div>
            </div>
        </div>
    );
};

const UnifiedHelpManualRoute: React.FC = () => {
    useEffect(() => {
        requestUnifiedHelp('top');
    }, []);

    return <div className="page-content" />;
};

export default UnifiedHelpManualRoute;
