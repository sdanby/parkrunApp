import { useCallback, useEffect, useRef } from 'react';
import type React from 'react';
import { getMarkerForControlLabel, requestUnifiedHelp } from '../pages/UnifiedHelp';

type DelayedHelpScheduleArgs = {
    event: React.MouseEvent<HTMLElement>;
    label: string;
    markerId?: string;
    query?: string;
    delayMs?: number;
};

export const useDelayedUnifiedHelp = (enabled: boolean, defaultDelayMs: number = 2000) => {
    const timerRef = useRef<number | null>(null);

    const clear = useCallback(() => {
        if (timerRef.current !== null) {
            window.clearTimeout(timerRef.current);
            timerRef.current = null;
        }
    }, []);

    useEffect(() => {
        return () => clear();
    }, [clear]);

    const schedule = useCallback((args: DelayedHelpScheduleArgs) => {
        if (!enabled || typeof window === 'undefined') {
            return;
        }

        const label = String(args.label || '').trim();
        if (!label) {
            return;
        }

        const delay = Number.isFinite(args.delayMs) && Number(args.delayMs) > 0
            ? Number(args.delayMs)
            : defaultDelayMs;

        clear();

        const rect = args.event.currentTarget.getBoundingClientRect();
        const marker = String(args.markerId || '').trim() || getMarkerForControlLabel(label);
        const query = String(args.query || label).trim();

        timerRef.current = window.setTimeout(() => {
            requestUnifiedHelp(marker || 'top', {
                x: rect.left,
                y: rect.bottom
            }, query);
            timerRef.current = null;
        }, Math.max(250, delay));
    }, [clear, defaultDelayMs, enabled]);

    return {
        schedule,
        clear
    };
};
