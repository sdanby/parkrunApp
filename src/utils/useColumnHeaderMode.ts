import { useCallback, useEffect, useState } from 'react';

export type ColumnHeaderMode = 'sort' | 'help';

export const COLUMN_HEADER_MODE_STORAGE_KEY = 'column_header_mode_v1';
export const COLUMN_HEADER_MODE_EVENT = 'parkrun:column-header-mode-changed';

const normalizeColumnHeaderMode = (value: unknown): ColumnHeaderMode => {
    return String(value || '').trim().toLowerCase() === 'help' ? 'help' : 'sort';
};

export const getStoredColumnHeaderMode = (): ColumnHeaderMode => {
    if (typeof window === 'undefined') {
        return 'sort';
    }
    return normalizeColumnHeaderMode(window.localStorage.getItem(COLUMN_HEADER_MODE_STORAGE_KEY));
};

export const setStoredColumnHeaderMode = (mode: ColumnHeaderMode): ColumnHeaderMode => {
    const normalized = normalizeColumnHeaderMode(mode);
    if (typeof window === 'undefined') {
        return normalized;
    }

    window.localStorage.setItem(COLUMN_HEADER_MODE_STORAGE_KEY, normalized);
    window.dispatchEvent(new CustomEvent(COLUMN_HEADER_MODE_EVENT, { detail: { mode: normalized } }));
    return normalized;
};

export const useColumnHeaderMode = () => {
    const [mode, setModeState] = useState<ColumnHeaderMode>(() => getStoredColumnHeaderMode());

    useEffect(() => {
        const syncFromStorage = () => {
            setModeState(getStoredColumnHeaderMode());
        };

        const onModeEvent = (event: Event) => {
            const customEvent = event as CustomEvent<{ mode?: ColumnHeaderMode }>;
            setModeState(normalizeColumnHeaderMode(customEvent?.detail?.mode));
        };

        window.addEventListener('storage', syncFromStorage);
        window.addEventListener(COLUMN_HEADER_MODE_EVENT, onModeEvent as EventListener);

        return () => {
            window.removeEventListener('storage', syncFromStorage);
            window.removeEventListener(COLUMN_HEADER_MODE_EVENT, onModeEvent as EventListener);
        };
    }, []);

    const setMode = useCallback((nextMode: ColumnHeaderMode) => {
        const normalized = setStoredColumnHeaderMode(nextMode);
        setModeState(normalized);
    }, []);

    const toggleMode = useCallback(() => {
        setMode(mode === 'help' ? 'sort' : 'help');
    }, [mode, setMode]);

    return {
        mode,
        isHelpMode: mode === 'help',
        setMode,
        toggleMode
    };
};
