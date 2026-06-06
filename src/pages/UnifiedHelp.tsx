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
    queryTerm?: string;
    anchor?: UnifiedHelpAnchor | null;
    onClose: () => void;
};

export const UnifiedHelpOverlay: React.FC<UnifiedHelpOverlayProps> = ({ open, startMarkerId, queryTerm, anchor, onClose }) => {
    const [markdown, setMarkdown] = useState<string>('Loading help...');
    const [searchTerm, setSearchTerm] = useState<string>('');
    const [searchMode, setSearchMode] = useState<'headers' | 'text'>('headers');
    const [searchCounter, setSearchCounter] = useState<{ current: number; total: number }>({ current: 0, total: 0 });
    const [lastSearchKey, setLastSearchKey] = useState<string>('');
    const [lastSearchIndex, setLastSearchIndex] = useState<number>(-1);
    const bodyRef = useRef<HTMLDivElement | null>(null);
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
        fetch('/helptext.md')
            .then((res) => res.text())
            .then(setMarkdown)
            .catch(() => setMarkdown('Help file not found.'));
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
                    style={{ overflowY: 'auto', maxHeight: '60vh' }}
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
