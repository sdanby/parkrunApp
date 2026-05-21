import React, { useEffect, useMemo, useRef, useState } from 'react';

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

const HELP_DOCUMENT = `# [top] Parkrun Help Manual
This is the single help source for Event Analysis and Single Event. Use links in the text to jump to any placemarker section.

## [glossary] Glossary of Terms
This section defines the key terms used in the help manual and the app. 
Understanding these terms will help you make the most of the features available.

[b]Event[/b] - A single parkrun occurrence on a specific date at a specific location.
[b]Course[/b] - The route taken for a parkrun event, which may have specific characteristics.
[b]Participant[/b] - A participant in parkrun events, identified by their athlete code.
[b]Club[/b] - A group of participants who are associated together, often by location or affiliation.
[b]Time[/b] - The recorded time for a participant to complete the course in an event.
[b]Age Grade[/b] - A percentage score that compares an athlete's performance to the world record for their age and gender.

## [page-event-analysis] Event Analysis
Event Analysis compares events over time and supports table and plot views.
Start with [[Calc|control-type]], then set [[Type|control-filter]], [[Period|control-period]] and [[Agg|control-agg]].

## [section-event-stats-comparison] Event statistics comparison
This plot compares selected event statistics across dates.
Use legend selection and zoom controls to focus on trends, outliers and cross-event differences.

## [page-single-event] Single Event
Single Event is the drill-down view for one event/date and is best used together with Event Analysis.
Use Event Analysis first, then inspect details in Single Event with the same intent for [[Calc|control-type]] and [[Type|control-filter]].

## [page-course] Course
Course provides course-level information and views for each parkrun location.
Use this page to understand route context before comparing performance trends.

## [page-participant] Participant
Participant shows run history and progression for individual athletes.
Use this page to review consistency, milestones and performance changes over time.

## [section-participant-profile] Participant Profile
Participant Profile summarises best performances and rank/date/time combinations.
Use this panel to quickly compare adjusted and unadjusted best results.

## [section-participant-time-by-date] Time by Date
Time by Date shows progression of times over event dates.
Use this plot to inspect trajectory, compare event contexts and identify best windows.

## [page-club] Club
Club groups participants by club affiliation for side-by-side comparison.
Use this page to explore participation patterns across clubs.

## [page-lists] Lists
Lists provides predefined collections and focused subsets of data.
Use this page when you want quick access to common filtered views.

## [control-type] Calc
Calc controls the metric family shown in the analysis.
Use it first because it determines how values are interpreted in other controls.

## [control-filter] Type
Type selects the subgroup or metric variant.
It works with Calc to decide what each cell means.

## [control-period] Period
Period controls the time window or aggregation period.
Changing Period can switch between granular events and grouped periods.

## [control-agg] Agg
Agg defines how values are summarised across selected events or periods.
Average is a common default, while Range and Growth are better for trend interpretation.

## [control-cell-agg] Cell Agg
Cell Agg controls how each matrix cell value is formed.
Use this when you want to switch between single-value and averaged cell behaviour.

## [control-time-adj] Time Adj
Time Adj applies optional adjustments for time-based analysis.
Use this only when comparing pace/time values across different conditions.

## [control-table-view] Table View
Table View enables the user to select different column sets, i.e. Basic (most important), Detailed (more columns) and All Time Adjustments (how times adjust according to analysis).

## [control-athlete-code] Athlete Code
Athlete Code shows the unique identifier for the selected participant.
Use it to confirm you are viewing the intended runner when switching between pages and links.

## [control-estimated-age] Estimated Age
Estimated Age shows the participant's current age estimate used for context in performance interpretation.
Use it to quickly understand age-related context when reviewing run history and adjustments.

## [control-total-runs] Total Runs
Total Runs shows the total number of runs recorded for the selected participant.
Use this value as quick context for how large the participant history is before interpreting trends or adjustments.

## [control-recent-club] Recent Club
Recent Club shows the latest known club affiliation for the selected participant.
Use it to confirm current club context before comparing participant runs or opening club-level pages.

## [control-freq-course] Freq Course
Freq Course shows the participant's most frequent course over the last 1 year.
It is derived from the row with the highest Event Count in that 1-year window.
If multiple courses tie on Event Count, the most recent course is used.
Use it as a quick shortcut to the course page most associated with the participant's recent running pattern.

## [control-course-adj] Course Adj
Course Adj controls whether course-condition factors are applied to the displayed results.
Use no adjustment (default) when you want the raw recorded values.
Use seasonal adjustments when you want to account for broad seasonal effects across the course.
Use full event adjustments when you want the strongest correction for event-level difficulty on that specific date.
For consistency, keep this setting fixed while comparing rows in the same table.

## [control-other-adj] Other Adj
Other Adj controls participant-level adjustment type applied in the table.
Use no adjustment (default) to keep the non-course-adjusted baseline.
Use age adjustments to normalize for age differences.
Use sex adjustments to normalize for sex differences.
Use age & sex adjustment to apply both factors together.
When comparing columns, keep Other Adj fixed so differences reflect the data rather than a setting change.

## [control-hardness-adj] Hardness Adj
Hardness Adj shows the combined hardness indicator for the selected event and settings.
Use it as context when interpreting adjusted time comparisons across events.
Higher hardness values generally indicate tougher conditions relative to the baseline.
Keep in mind that hardness is an explanatory indicator and should be read together with course and other adjustment choices.
Use the same Course Adj and Other Adj settings while comparing events so hardness context stays consistent.
Hardness Adj does not replace raw time interpretation; it is a companion metric to explain why adjusted columns may differ.
`;

type ManualSection = {
    markerId: string;
    title: string;
    paragraphs: string[];
};

const parseHelpDocument = (raw: string): ManualSection[] => {
    const lines = raw.split(/\r?\n/);
    const sections: ManualSection[] = [];

    let current: ManualSection | null = null;
    let paragraphBuffer: string[] = [];

    const flushParagraph = () => {
        if (!current) return;
        const text = paragraphBuffer.join('\n');
        if (text.trim()) current.paragraphs.push(text);
        paragraphBuffer = [];
    };

    lines.forEach((line) => {
        const headerMatch = line.match(/^#{1,2}\s+\[([^\]]+)\]\s+(.+)$/);
        if (headerMatch) {
            flushParagraph();
            if (current) sections.push(current);
            current = { markerId: headerMatch[1].trim(), title: headerMatch[2].trim(), paragraphs: [] };
            return;
        }

        if (!line.trim()) {
            flushParagraph();
            return;
        }

        paragraphBuffer.push(line);
    });

    flushParagraph();
    if (current) sections.push(current);

    return sections;
};

type InlinePart =
    | { kind: 'text'; value: string }
    | { kind: 'link'; label: string; markerId: string }
    | { kind: 'bold'; value: string };

const parseInlineLinks = (paragraph: string): InlinePart[] => {
    const parts: InlinePart[] = [];
    const regex = /\[\[([^\]|]+)\|([^\]]+)\]\]|\[b\]([\s\S]*?)\[\/b\]/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(paragraph)) !== null) {
        const [full, label, markerId, boldText] = match;
        if (match.index > lastIndex) {
            parts.push({ kind: 'text', value: paragraph.slice(lastIndex, match.index) });
        }

        if (label && markerId) {
            parts.push({ kind: 'link', label: label.trim(), markerId: markerId.trim() });
        } else {
            parts.push({ kind: 'bold', value: String(boldText || '') });
        }
        lastIndex = match.index + full.length;
    }

    if (lastIndex < paragraph.length) {
        parts.push({ kind: 'text', value: paragraph.slice(lastIndex) });
    }

    return parts;
};

type UnifiedHelpOverlayProps = {
    open: boolean;
    startMarkerId: string;
    anchor?: UnifiedHelpAnchor | null;
    onClose: () => void;
};

export const UnifiedHelpOverlay: React.FC<UnifiedHelpOverlayProps> = ({ open, startMarkerId, anchor, onClose }) => {
    const sections = useMemo(() => parseHelpDocument(HELP_DOCUMENT), []);
    const sectionById = useMemo(() => new Map(sections.map((section) => [section.markerId, section])), [sections]);
    const [currentMarkerId, setCurrentMarkerId] = useState<string>(startMarkerId || 'top');
    const scrollRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (!open) return;
        setCurrentMarkerId(startMarkerId || 'top');
    }, [open, startMarkerId]);

    useEffect(() => {
        if (!open) return;
        const container = scrollRef.current;
        if (!container) return;

        const target = container.querySelector(`[data-help-marker="${currentMarkerId}"]`) as HTMLElement | null;
        if (target) {
            target.scrollIntoView({ block: 'start', behavior: 'smooth' });
        }
    }, [open, currentMarkerId]);

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
                    <strong>{sectionById.get(currentMarkerId)?.title || 'Help'}</strong>
                    <button type="button" className="unified-help-close" onClick={onClose} aria-label="Close help">✕</button>
                </div>

                <div className="unified-help-body" ref={scrollRef}>
                    {sections.map((section) => (
                        <section
                            key={section.markerId}
                            data-help-marker={section.markerId}
                            className={`unified-help-section${currentMarkerId === section.markerId ? ' active' : ''}`}
                        >
                            <h3 className="unified-help-section-title">{section.title}</h3>
                            {section.paragraphs.map((paragraph) => {
                                const parts = parseInlineLinks(paragraph);
                                return (
                                    <p key={`${section.markerId}-${paragraph.slice(0, 30)}`}>
                                        {parts.map((part, idx) => (
                                            part.kind === 'text' ? (
                                                <React.Fragment key={`${section.markerId}-t-${idx}`}>{part.value}</React.Fragment>
                                            ) : part.kind === 'bold' ? (
                                                <strong key={`${section.markerId}-b-${idx}`}>{part.value}</strong>
                                            ) : (
                                                <button
                                                    key={`${section.markerId}-l-${idx}`}
                                                    type="button"
                                                    className="unified-help-link"
                                                    onClick={() => setCurrentMarkerId(part.markerId)}
                                                >
                                                    {part.label}
                                                </button>
                                            )
                                        ))}
                                    </p>
                                );
                            })}
                        </section>
                    ))}
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
