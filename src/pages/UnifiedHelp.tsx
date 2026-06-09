import React, { useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';

export const UNIFIED_HELP_EVENT = 'parkrun:open-unified-help';

export type UnifiedHelpAnchor = {
    x: number;
    y: number;
};

export type UnifiedHelpRequestDetail = {
    markerId?: string;
    anchor?: UnifiedHelpAnchor | null;
    query?: string;
};

export const requestUnifiedHelp = (markerId: string = 'top', anchor?: UnifiedHelpAnchor | null, query?: string) => {
    window.dispatchEvent(new CustomEvent(UNIFIED_HELP_EVENT, { detail: { markerId, anchor: anchor || null, query: query || '' } }));
};

export const getPageMarkerForPath = (path: string): string | null => {
    if (path === '/results') return 'page-event-analysis';
    if (path === '/results_test') return 'page-event-analysis';
    if (path === '/races') return 'page-single-event';
    if (path === '/event_test') return 'page-single-event';
    if (path === '/courses') return 'page-course';
    if (path === '/courses_test') return 'page-course';
    if (path === '/athletes') return 'page-participant';
    if (path === '/clubs') return 'page-club';
    if (path === '/lists') return 'page-lists';
    if (path === '/feedback') return 'page-feedback-log';
    return null;
};

export const getMarkerForControlLabel = (label: string): string => {
    const key = String(label || '').trim().toLowerCase();
    const map: Record<string, string> = {
        type: 'control-type',
        calc: 'control-calc',
        filter: 'control-type',
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
    queryTerm?: string;
    anchor?: UnifiedHelpAnchor | null;
    onClose: () => void;
};

type PanelRect = {
    left: number;
    top: number;
    width: number;
    height: number;
};

type ResizeCorner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

const HELP_PANEL_MARGIN = 12;
const HELP_PANEL_TOP_MARGIN = 56;
const HELP_PANEL_MIN_WIDTH = 320;
const HELP_PANEL_MIN_HEIGHT = 260;

const getViewportSize = () => {
    if (typeof window === 'undefined') {
        return { width: 1200, height: 800 };
    }

    return { width: window.innerWidth, height: window.innerHeight };
};

const getDefaultPanelRect = (anchor?: UnifiedHelpAnchor | null): PanelRect => {
    const viewport = getViewportSize();
    const width = Math.min(704, Math.floor(viewport.width * 0.92));
    const height = Math.min(640, Math.max(360, Math.floor(viewport.height * 0.74)));

    const left = anchor && Number.isFinite(anchor.x)
        ? Math.max(HELP_PANEL_MARGIN, Math.min(anchor.x, viewport.width - width - HELP_PANEL_MARGIN))
        : Math.max(HELP_PANEL_MARGIN, Math.floor((viewport.width - width) / 2));

    const top = anchor && Number.isFinite(anchor.y)
        ? Math.max(HELP_PANEL_TOP_MARGIN, Math.min(anchor.y + 8, viewport.height - height - HELP_PANEL_MARGIN))
        : Math.max(HELP_PANEL_TOP_MARGIN, Math.floor(viewport.height * 0.08));

    return { left, top, width, height };
};

export const UnifiedHelpOverlay: React.FC<UnifiedHelpOverlayProps> = ({ open, startMarkerId, queryTerm, anchor, onClose }) => {
    const [markdown, setMarkdown] = useState<string>('Loading help...');
    const [searchTerm, setSearchTerm] = useState<string>('');
    const [searchMode, setSearchMode] = useState<'headers' | 'text'>('headers');
    const [searchCounter, setSearchCounter] = useState<{ current: number; total: number }>({ current: 0, total: 0 });
    const [lastSearchKey, setLastSearchKey] = useState<string>('');
    const [lastSearchIndex, setLastSearchIndex] = useState<number>(-1);
    const [panelRect, setPanelRect] = useState<PanelRect>(() => getDefaultPanelRect(anchor));
    const bodyRef = useRef<HTMLDivElement | null>(null);
    const panelRef = useRef<HTMLDivElement | null>(null);
    const highlightedRef = useRef<HTMLDivElement | null>(null);
    const inlineMatchRef = useRef<HTMLElement | null>(null);

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

    const clearInlineMatch = () => {
        const mark = inlineMatchRef.current;
        if (!mark || !mark.parentElement) {
            inlineMatchRef.current = null;
            return;
        }

        const parent = mark.parentElement;
        while (mark.firstChild) {
            parent.insertBefore(mark.firstChild, mark);
        }
        parent.removeChild(mark);
        parent.normalize();
        inlineMatchRef.current = null;
    };

    const highlightInlineMatch = (container: HTMLElement, term: string) => {
        clearInlineMatch();
        const token = String(term || '').trim().toLowerCase();
        if (!token) return;

        const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
        let current = walker.nextNode();
        while (current) {
            const textNode = current as Text;
            const value = String(textNode.nodeValue || '');
            const index = value.toLowerCase().indexOf(token);
            if (index >= 0) {
                const range = document.createRange();
                range.setStart(textNode, index);
                range.setEnd(textNode, index + token.length);

                const mark = document.createElement('mark');
                mark.className = 'unified-help-inline-match';
                range.surroundContents(mark);
                inlineMatchRef.current = mark;
                break;
            }

            current = walker.nextNode();
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

    const highlightSectionForElement = (target: HTMLElement) => {
        if (!bodyRef.current) return;

        clearHighlight();

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
    };

    const findElementByQuery = (query: string): HTMLElement | null => {
        if (!bodyRef.current) return null;
        const token = String(query || '').trim().toLowerCase();
        if (!token) return null;

        const candidates = bodyRef.current.querySelectorAll<HTMLElement>('h1, h2, h3, h4, h5, h6, p, li');
        for (const candidate of candidates) {
            const text = String(candidate.textContent || '').trim().toLowerCase();
            if (text.includes(token)) {
                return candidate;
            }
        }

        return null;
    };

    const getSearchCandidates = (mode: 'headers' | 'text') => {
        if (!bodyRef.current) return [] as HTMLElement[];
        if (mode === 'headers') {
            return Array.from(bodyRef.current.querySelectorAll<HTMLElement>('h1, h2, h3, h4, h5, h6'));
        }

        return Array.from(bodyRef.current.querySelectorAll<HTMLElement>('p, li, td, th'));
    };

    const findSearchMatches = (term: string, mode: 'headers' | 'text') => {
        const token = String(term || '').trim().toLowerCase();
        if (!token) return [] as HTMLElement[];

        return getSearchCandidates(mode).filter((candidate) => {
            const text = String(candidate.textContent || '').trim().toLowerCase();
            return text.includes(token);
        });
    };

    const runSearch = () => {
        if (!open) return;

        const token = String(searchTerm || '').trim();
        if (!token) {
            clearHighlight();
            clearInlineMatch();
            setSearchCounter({ current: 0, total: 0 });
            setLastSearchIndex(-1);
            return;
        }

        const key = `${searchMode}::${token.toLowerCase()}`;
        const matches = findSearchMatches(token, searchMode);
        if (!matches.length) {
            clearHighlight();
            clearInlineMatch();
            setSearchCounter({ current: 0, total: 0 });
            setLastSearchKey(key);
            setLastSearchIndex(-1);
            return;
        }

        const nextIndex = key === lastSearchKey
            ? (lastSearchIndex + 1) % matches.length
            : 0;

        const match = matches[nextIndex];
        clearHighlight();
        match.scrollIntoView({ block: 'center', behavior: scrollBehavior });
        setSearchCounter({ current: nextIndex + 1, total: matches.length });
        setLastSearchKey(key);
        setLastSearchIndex(nextIndex);

        // Apply inline highlight after state updates/rerender so it persists while iterating.
        requestAnimationFrame(() => {
            const refreshedMatches = findSearchMatches(token, searchMode);
            const refreshedTarget = refreshedMatches[nextIndex] || match;
            highlightInlineMatch(refreshedTarget, token);
        });
    };

    useEffect(() => {
        if (!open) return;

        const publicUrl = String(process.env.PUBLIC_URL || '').replace(/\/$/, '');
        const candidates = Array.from(new Set([
            `${publicUrl}/helptext.md`,
            './helptext.md',
            'helptext.md'
        ].filter((value) => value && value !== '/helptext.md' ? true : value === '/helptext.md')));

        let cancelled = false;

        const loadHelp = async () => {
            for (const candidate of candidates) {
                try {
                    const response = await fetch(candidate);
                    if (!response.ok) {
                        continue;
                    }

                    const text = await response.text();
                    if (!cancelled) {
                        setMarkdown(text);
                    }
                    return;
                } catch {
                    continue;
                }
            }

            if (!cancelled) {
                setMarkdown('Help file not found.');
            }
        };

        void loadHelp();

        return () => {
            cancelled = true;
        };
    }, [open]);

    useEffect(() => {
        if (!open) return;
        setSearchTerm('');
        setSearchMode('headers');
        setSearchCounter({ current: 0, total: 0 });
        setLastSearchKey('');
        setLastSearchIndex(-1);
        clearInlineMatch();
    }, [open]);

    useEffect(() => {
        if (!open) return;
        setPanelRect(getDefaultPanelRect(anchor));
    }, [anchor, open]);

    useEffect(() => {
        if (!open) return;

        const handleWindowResize = () => {
            const viewport = getViewportSize();
            setPanelRect((current) => {
                const width = Math.min(current.width, viewport.width - HELP_PANEL_MARGIN * 2);
                const height = Math.min(current.height, viewport.height - HELP_PANEL_TOP_MARGIN - HELP_PANEL_MARGIN);
                const left = Math.max(HELP_PANEL_MARGIN, Math.min(current.left, viewport.width - width - HELP_PANEL_MARGIN));
                const top = Math.max(HELP_PANEL_TOP_MARGIN, Math.min(current.top, viewport.height - height - HELP_PANEL_MARGIN));
                return { left, top, width, height };
            });
        };

        window.addEventListener('resize', handleWindowResize);
        return () => window.removeEventListener('resize', handleWindowResize);
    }, [open]);

    useEffect(() => {
        clearInlineMatch();
        setSearchCounter({ current: 0, total: 0 });
        setLastSearchKey('');
        setLastSearchIndex(-1);
    }, [searchTerm, searchMode]);

    useEffect(() => {
        if (!open) {
            clearHighlight();
            return;
        }

        if (!open || !bodyRef.current) return;

        let target: HTMLElement | null = null;
        const markerId = String(startMarkerId || '').trim();

        if (markerId && markerId !== 'top') {
            target = bodyRef.current.querySelector<HTMLElement>(`#${CSS.escape(markerId)}`);
        }

        if (!target) {
            target = findElementByQuery(queryTerm || '');
        }

        if (!target && markerId) {
            target = bodyRef.current.querySelector<HTMLElement>(`#${CSS.escape(markerId)}`);
        }

        if (!target) {
            bodyRef.current.scrollTo({ top: 0, behavior: scrollBehavior });
            return;
        }

        highlightSectionForElement(target);

        return () => {
            clearHighlight();
        };
    }, [markdown, open, queryTerm, scrollBehavior, startMarkerId]);

    const panelStyle = useMemo(() => ({
        position: 'fixed' as const,
        left: `${panelRect.left}px`,
        top: `${panelRect.top}px`,
        width: `${panelRect.width}px`,
        height: `${panelRect.height}px`,
        maxWidth: `calc(100vw - ${HELP_PANEL_MARGIN * 2}px)`,
        maxHeight: `calc(100vh - ${HELP_PANEL_TOP_MARGIN + HELP_PANEL_MARGIN}px)`
    }), [panelRect]);

    const startResize = (corner: ResizeCorner, event: React.MouseEvent<HTMLDivElement>) => {
        event.preventDefault();
        event.stopPropagation();

        const startX = event.clientX;
        const startY = event.clientY;
        const startRect = panelRef.current?.getBoundingClientRect();
        const origin = startRect
            ? { left: startRect.left, top: startRect.top, width: startRect.width, height: startRect.height }
            : panelRect;

        const viewport = getViewportSize();
        const rightEdge = origin.left + origin.width;
        const bottomEdge = origin.top + origin.height;

        const handleMouseMove = (moveEvent: MouseEvent) => {
            const deltaX = moveEvent.clientX - startX;
            const deltaY = moveEvent.clientY - startY;

            let nextLeft = origin.left;
            let nextTop = origin.top;
            let nextWidth = origin.width;
            let nextHeight = origin.height;

            if (corner.includes('left')) {
                nextLeft = Math.max(HELP_PANEL_MARGIN, Math.min(origin.left + deltaX, rightEdge - HELP_PANEL_MIN_WIDTH));
                nextWidth = rightEdge - nextLeft;
            } else {
                nextWidth = Math.max(HELP_PANEL_MIN_WIDTH, Math.min(origin.width + deltaX, viewport.width - origin.left - HELP_PANEL_MARGIN));
            }

            if (corner.includes('top')) {
                nextTop = Math.max(HELP_PANEL_TOP_MARGIN, Math.min(origin.top + deltaY, bottomEdge - HELP_PANEL_MIN_HEIGHT));
                nextHeight = bottomEdge - nextTop;
            } else {
                nextHeight = Math.max(HELP_PANEL_MIN_HEIGHT, Math.min(origin.height + deltaY, viewport.height - origin.top - HELP_PANEL_MARGIN));
            }

            setPanelRect({
                left: nextLeft,
                top: nextTop,
                width: nextWidth,
                height: nextHeight
            });
        };

        const handleMouseUp = () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    };

    if (!open) return null;

    return (
        <div className="unified-help-backdrop" onMouseDown={(event) => {
            if (event.target === event.currentTarget) onClose();
        }}>
            <div ref={panelRef} className="unified-help-panel" style={panelStyle} role="dialog" aria-hidden={!open}>
                <div className="unified-help-head">
                    <strong>Help Manual</strong>
                    <div className="unified-help-search-controls">
                        <input
                            type="text"
                            className="unified-help-search-input"
                            value={searchTerm}
                            onChange={(event) => setSearchTerm(event.target.value)}
                            onKeyDown={(event) => {
                                if (event.key === 'Enter') {
                                    event.preventDefault();
                                    runSearch();
                                }
                            }}
                            placeholder={searchMode === 'headers' ? 'Search headers' : 'Search text'}
                            aria-label="Search help"
                        />
                        <button type="button" className="unified-help-search-go" onClick={runSearch}>
                            Search
                        </button>
                        <button
                            type="button"
                            className={`unified-help-search-mode ${searchMode === 'headers' ? 'headers' : 'text'}`}
                            onClick={() => setSearchMode((prev) => prev === 'headers' ? 'text' : 'headers')}
                            aria-label="Toggle search mode"
                            title={`Mode: ${searchMode === 'headers' ? 'Headers' : 'Text'}`}
                        >
                            {searchMode === 'headers' ? 'Headers' : 'Text'}
                        </button>
                        <span className="unified-help-search-count" aria-live="polite">
                            {searchCounter.total > 0 ? `${searchCounter.current}/${searchCounter.total}` : ''}
                        </span>
                    </div>
                    <button type="button" className="unified-help-close" onClick={onClose} aria-label="Close help">✕</button>
                </div>
                <div
                    ref={bodyRef}
                    className="unified-help-body"
                    onClickCapture={(event) => {
                        const target = event.target as HTMLElement | null;
                        const anchorElement = target?.closest('a[href]') as HTMLAnchorElement | null;
                        if (!anchorElement) return;

                        const href = String(anchorElement.getAttribute('href') || '').trim();
                        if (!href.startsWith('#')) return;

                        event.preventDefault();
                        const id = href.slice(1);
                        if (!id || !bodyRef.current) return;

                        const jumpTarget = bodyRef.current.querySelector<HTMLElement>(`#${CSS.escape(id)}`);
                        if (!jumpTarget) return;

                        highlightSectionForElement(jumpTarget);
                    }}
                >
                    <ReactMarkdown rehypePlugins={[rehypeRaw as any]}>{markdown}</ReactMarkdown>
                </div>
                <div className="unified-help-resize-handle top-left" onMouseDown={(event) => startResize('top-left', event)} />
                <div className="unified-help-resize-handle top-right" onMouseDown={(event) => startResize('top-right', event)} />
                <div className="unified-help-resize-handle bottom-left" onMouseDown={(event) => startResize('bottom-left', event)} />
                <div className="unified-help-resize-handle bottom-right" onMouseDown={(event) => startResize('bottom-right', event)} />
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
