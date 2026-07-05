import type { NavigateFunction } from 'react-router-dom';

type LocationLike = {
    pathname: string;
    search?: string;
    state?: unknown;
};

type StackEntry = {
    pathname: string;
    search: string;
    state?: unknown;
    sessionSnapshot?: Record<string, string>;
    label: string;
    at: number;
};

const STACK_KEY = 'nav_stack_v1';
const STACK_MAX = 40;
export const NAV_STACK_EVENT = 'nav-stack-overlay';

const TRACKED_SESSION_KEY_PATTERNS: RegExp[] = [
    /^results_state_v1$/,
    /^races_/,
    /^courses_/,
    /^lists:/,
    /^clubs_/,
    /^athletes_/,
    /^nav_stack_v1$/
];

const labelByPath: Record<string, string> = {
    '/results': 'Event Analysis Old',
    '/results_test': 'Event Analysis',
    '/races': 'Event',
    '/courses': 'Course Old',
    '/courses_test': 'Course',
    '/clubs': 'Club',
    '/athletes': 'Participant',
    '/next-event': 'Next Event',
    '/lists': 'Lists',
    '/feedback': 'Error / Suggestion Log',
    '/': 'Home'
};

const canonicalizePathname = (pathname: string): string => {
    if (pathname === '/results') {
        return '/results_test';
    }
    return pathname;
};

const getLabel = (pathname: string): string => {
    return labelByPath[pathname] || pathname;
};

const asObject = (value: unknown): Record<string, any> => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return {};
    }
    return value as Record<string, any>;
};

const formatCompactDate = (value: string): string => {
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const raw = String(value || '').trim();
    if (!raw) return '';

    const slash = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (slash) {
        const day = slash[1];
        const month = monthNames[Number(slash[2]) - 1] || slash[2];
        const year = slash[3].slice(-2);
        return `${day}${month}${year}`;
    }

    const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (iso) {
        const day = iso[3];
        const month = monthNames[Number(iso[2]) - 1] || iso[2];
        const year = iso[1].slice(-2);
        return `${day}${month}${year}`;
    }

    return raw;
};

const buildContextLabel = (pathname: string, search: string, state: unknown): string => {
    const base = getLabel(pathname);
    const params = new URLSearchParams(search || '');
    const stateObj = asObject(state);
    const sourceEvent = asObject(stateObj.sourceEvent);

    if (pathname === '/courses') {
        const eventName = String(
            params.get('event_name')
            || stateObj.eventName
            || stateObj.activeEventName
            || ''
        ).trim();
        return eventName ? `${base} - ${eventName}` : base;
    }

    if (pathname === '/races') {
        const eventName = String(
            params.get('event_name')
            || sourceEvent.eventName
            || stateObj.eventName
            || params.get('event')
            || params.get('event_code')
            || ''
        ).trim();
        const dateRaw = String(
            params.get('date')
            || params.get('source_date')
            || sourceEvent.eventDate
            || ''
        ).trim();
        const dateLabel = formatCompactDate(dateRaw);

        if (dateLabel && eventName) return `${base} - ${dateLabel} - ${eventName}`;
        if (eventName) return `${base} - ${eventName}`;
        if (dateLabel) return `${base} - ${dateLabel}`;
        return base;
    }

    if (pathname === '/athletes') {
        const athleteName = String(
            stateObj.athleteName
            || stateObj.displayName
            || ''
        ).trim();
        const athleteCode = String(params.get('athlete_code') || stateObj.athleteCode || '').trim();
        if (athleteName) return `${base} - ${athleteName}`;
        if (athleteCode) return `${base} - ${athleteCode}`;
        return base;
    }

    if (pathname === '/clubs') {
        const clubName = String(params.get('club') || stateObj.club || '').trim();
        return clubName ? `${base} - ${clubName}` : base;
    }

    return base;
};

const safeClone = (value: unknown): unknown => {
    if (value === undefined) return undefined;
    try {
        return JSON.parse(JSON.stringify(value));
    } catch {
        return value;
    }
};

const getStack = (): StackEntry[] => {
    try {
        const raw = sessionStorage.getItem(STACK_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
};

const saveStack = (stack: StackEntry[]) => {
    try {
        sessionStorage.setItem(STACK_KEY, JSON.stringify(stack));
    } catch {
        // ignore
    }
};

const dispatchStackOverlay = (stack: StackEntry[], activeLabel?: string) => {
    const labels = stack.map((item) => item.label);
    if (activeLabel) {
        labels.push(activeLabel);
    }
    window.dispatchEvent(new CustomEvent(NAV_STACK_EVENT, {
        detail: {
            labels,
            depth: labels.length
        }
    }));
};

const isTrackedSessionKey = (key: string): boolean => {
    return TRACKED_SESSION_KEY_PATTERNS.some((pattern) => pattern.test(key));
};

const captureTrackedSessionSnapshot = (): Record<string, string> => {
    const snapshot: Record<string, string> = {};
    try {
        for (let index = 0; index < sessionStorage.length; index += 1) {
            const key = sessionStorage.key(index);
            if (!key || !isTrackedSessionKey(key)) {
                continue;
            }
            const value = sessionStorage.getItem(key);
            if (typeof value === 'string') {
                snapshot[key] = value;
            }
        }
    } catch {
        // ignore
    }
    return snapshot;
};

const restoreTrackedSessionSnapshot = (snapshot?: Record<string, string>) => {
    if (!snapshot) {
        return;
    }
    try {
        const keysToClear: string[] = [];
        for (let index = 0; index < sessionStorage.length; index += 1) {
            const key = sessionStorage.key(index);
            if (key && isTrackedSessionKey(key) && key !== STACK_KEY && !(key in snapshot)) {
                keysToClear.push(key);
            }
        }

        keysToClear.forEach((key) => {
            try {
                sessionStorage.removeItem(key);
            } catch {
                // ignore
            }
        });

        Object.entries(snapshot).forEach(([key, value]) => {
            if (key === STACK_KEY) {
                return;
            }
            try {
                sessionStorage.setItem(key, value);
            } catch {
                // ignore
            }
        });
    } catch {
        // ignore
    }
};

export const pushCurrentNavEntry = (location: LocationLike) => {
    const pathname = canonicalizePathname(String(location.pathname || '').trim());
    if (!pathname) return;

    const search = String(location.search || '');
    const nextEntry: StackEntry = {
        pathname,
        search,
        state: safeClone(location.state),
        sessionSnapshot: captureTrackedSessionSnapshot(),
        label: buildContextLabel(pathname, search, location.state),
        at: Date.now()
    };

    const stack = getStack();
    const last = stack[stack.length - 1];
    if (last && last.pathname === nextEntry.pathname && last.search === nextEntry.search) {
        stack[stack.length - 1] = nextEntry;
        saveStack(stack);
        return;
    }

    const updated = [...stack, nextEntry].slice(-STACK_MAX);
    saveStack(updated);
};

export const navigateWithNavStack = (
    navigate: NavigateFunction,
    location: LocationLike,
    to: string,
    options?: { replace?: boolean; state?: unknown }
) => {
    pushCurrentNavEntry(location);
    navigate(to, options as any);
};

export const navigateBackWithNavStack = (
    navigate: NavigateFunction,
    currentPathname?: string
): boolean => {
    const stack = getStack();
    if (stack.length === 0) {
        dispatchStackOverlay([], currentPathname ? getLabel(currentPathname) : undefined);
        return false;
    }

    const updated = [...stack];
    const target = updated.pop()!;
    saveStack(updated);
    dispatchStackOverlay(updated, target.label);

    restoreTrackedSessionSnapshot(target.sessionSnapshot);

    const to = `${canonicalizePathname(String(target.pathname || '').trim())}${target.search || ''}`;
    navigate(to, { state: target.state as any });
    return true;
};

export const clearNavStack = (activePathname?: string) => {
    saveStack([]);
    dispatchStackOverlay([], activePathname ? getLabel(activePathname) : undefined);
};
