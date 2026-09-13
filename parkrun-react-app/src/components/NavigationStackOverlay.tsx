import React, { useEffect, useRef, useState } from 'react';
import { NAV_STACK_EVENT } from '../utils/navigationStack';

type StackDetail = {
    labels?: string[];
    depth?: number;
};

const NavigationStackOverlay: React.FC = () => {
    const [labels, setLabels] = useState<string[]>([]);
    const [open, setOpen] = useState(false);
    const [isMobile, setIsMobile] = useState<boolean>(() => {
        if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
            return false;
        }
        return window.matchMedia('(max-width: 640px)').matches;
    });
    const timerRef = useRef<number | null>(null);

    useEffect(() => {
        if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
            return;
        }

        const mediaQuery = window.matchMedia('(max-width: 640px)');
        const syncMobile = () => setIsMobile(mediaQuery.matches);
        syncMobile();

        if (typeof mediaQuery.addEventListener === 'function') {
            mediaQuery.addEventListener('change', syncMobile);
            return () => mediaQuery.removeEventListener('change', syncMobile);
        }

        mediaQuery.addListener(syncMobile);
        return () => mediaQuery.removeListener(syncMobile);
    }, []);

    useEffect(() => {
        const onStackEvent = (event: Event) => {
            const customEvent = event as CustomEvent<StackDetail>;
            const nextLabels = Array.isArray(customEvent.detail?.labels) ? customEvent.detail!.labels! : [];
            setLabels(nextLabels);
            setOpen(true);

            if (timerRef.current) {
                window.clearTimeout(timerRef.current);
            }
            timerRef.current = window.setTimeout(() => {
                setOpen(false);
            }, 2000);
        };

        window.addEventListener(NAV_STACK_EVENT, onStackEvent as EventListener);
        return () => {
            window.removeEventListener(NAV_STACK_EVENT, onStackEvent as EventListener);
            if (timerRef.current) {
                window.clearTimeout(timerRef.current);
            }
        };
    }, []);

    if (!open) return null;

    return (
        <div
            aria-live="polite"
            style={{
                position: 'fixed',
                top: isMobile ? 'auto' : 58,
                bottom: isMobile ? 12 : 'auto',
                left: '50%',
                transform: isMobile ? 'translateX(-50%) translateY(0)' : 'translateX(-50%)',
                zIndex: 2147483647,
                minWidth: 210,
                width: 'min(92vw, 420px)',
                background: 'rgba(31, 41, 55, 0.96)',
                color: '#fff',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: 8,
                boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
                padding: '0.5rem 0.65rem'
            }}
        >
            <div style={{ fontSize: '0.78rem', fontWeight: 700, marginBottom: '0.25rem' }}>
                Navigation stack ({labels.length})
            </div>
            <div style={{ maxHeight: 180, overflowY: 'auto', fontSize: '0.74rem', lineHeight: 1.35 }}>
                {labels.length === 0 ? (
                    <div style={{ opacity: 0.9 }}>No previous pages</div>
                ) : labels.map((label, index) => (
                    <div key={`${label}-${index}`} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ opacity: 0.9 }}>{index + 1}.</span>
                        <span>{label}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default NavigationStackOverlay;
