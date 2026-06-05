import { useEffect } from 'react';

const WAIT_CURSOR_CLASS = 'app-wait-cursor';
const WAIT_CURSOR_COUNT_KEY = '__parkrun_wait_cursor_count__';

const getCount = (): number => {
    if (typeof window === 'undefined') return 0;
    const raw = (window as any)[WAIT_CURSOR_COUNT_KEY];
    const numeric = Number(raw);
    return Number.isFinite(numeric) && numeric > 0 ? numeric : 0;
};

const setCount = (value: number): void => {
    if (typeof window === 'undefined') return;
    (window as any)[WAIT_CURSOR_COUNT_KEY] = value;
};

const syncClass = (): void => {
    if (typeof document === 'undefined') return;
    const shouldShow = getCount() > 0;
    document.documentElement.classList.toggle(WAIT_CURSOR_CLASS, shouldShow);
    document.body.classList.toggle(WAIT_CURSOR_CLASS, shouldShow);
};

const acquireWaitCursor = (): void => {
    const next = getCount() + 1;
    setCount(next);
    syncClass();
};

const releaseWaitCursor = (): void => {
    const next = Math.max(0, getCount() - 1);
    setCount(next);
    syncClass();
};

export const useGlobalWaitCursor = (active: boolean): void => {
    useEffect(() => {
        if (!active) {
            return;
        }

        acquireWaitCursor();
        return () => {
            releaseWaitCursor();
        };
    }, [active]);
};
