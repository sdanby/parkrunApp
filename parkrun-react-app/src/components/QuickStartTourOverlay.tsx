import React, { useEffect, useMemo, useState } from 'react';
import quickStartLayout from '../config/QuickStartLayout.json';

type TourDirection = 'left' | 'right' | 'up' | 'down';
type TourSide = 'east' | 'west' | 'north' | 'south';

type TourPositionSpec = {
    x: string;
    y: string;
    side?: TourSide;
};

type TourStep = {
    id: string;
    text: string;
    direction?: TourDirection;
    side?: TourSide;
    laptop: TourPositionSpec;
    mobile: TourPositionSpec;
};

type TourDefinition = {
    tileId: string;
    steps: TourStep[];
};

type QuickStartLayoutConfig = {
    version: string;
    units: 'cm';
    viewports?: {
        mobile?: {
            breakpointMax?: number;
        };
    };
    tours: TourDefinition[];
};

type QuickStartTourOverlayProps = {
    tileId: string | null;
    open: boolean;
    onClose: () => void;
};

const typedLayout = quickStartLayout as QuickStartLayoutConfig;
const ARROW_REACH = 58;

const getViewportMode = (): 'laptop' | 'mobile' => {
    if (typeof window === 'undefined') {
        return 'laptop';
    }

    const breakpoint = typedLayout.viewports?.mobile?.breakpointMax ?? 640;
    return window.innerWidth <= breakpoint ? 'mobile' : 'laptop';
};

const normalizeTourSide = (value: string | undefined): TourSide => {
    const token = String(value || '').trim().toLowerCase();
    if (token === 'west' || token === 'left') return 'west';
    if (token === 'north' || token === 'up') return 'north';
    if (token === 'south' || token === 'down') return 'south';
    return 'east';
};

const getStepPosition = (x: string, y: string): React.CSSProperties => ({
    left: x,
    top: y
});

const getCardStyle = (side: TourSide): React.CSSProperties => {
    if (side === 'west') {
        return {
            left: `${ARROW_REACH}px`,
            top: '50%',
            transform: 'translateY(-50%)'
        };
    }

    if (side === 'north') {
        return {
            left: '50%',
            top: `${ARROW_REACH}px`,
            transform: 'translateX(-50%)'
        };
    }

    if (side === 'south') {
        return {
            left: '50%',
            bottom: `${ARROW_REACH}px`,
            transform: 'translateX(-50%)'
        };
    }

    return {
        right: `${ARROW_REACH}px`,
        top: '50%',
        transform: 'translateY(-50%)'
    };
};

const renderArrowSvg = (side: TourSide) => {
    if (side === 'west') {
        return (
            <svg className="quick-start-tour-arrow quick-start-tour-arrow-west" viewBox="0 0 58 34" aria-hidden="true">
                <line className="quick-start-tour-arrow-line" x1="58" y1="17" x2="14" y2="17" />
                <polygon className="quick-start-tour-arrow-head" points="0,17 22,4 22,30" />
            </svg>
        );
    }

    if (side === 'north') {
        return (
            <svg className="quick-start-tour-arrow quick-start-tour-arrow-north" viewBox="0 0 34 58" aria-hidden="true">
                <line className="quick-start-tour-arrow-line" x1="17" y1="58" x2="17" y2="14" />
                <polygon className="quick-start-tour-arrow-head" points="17,0 4,22 30,22" />
            </svg>
        );
    }

    if (side === 'south') {
        return (
            <svg className="quick-start-tour-arrow quick-start-tour-arrow-south" viewBox="0 0 34 58" aria-hidden="true">
                <line className="quick-start-tour-arrow-line" x1="17" y1="0" x2="17" y2="44" />
                <polygon className="quick-start-tour-arrow-head" points="17,58 4,36 30,36" />
            </svg>
        );
    }

    return (
        <svg className="quick-start-tour-arrow quick-start-tour-arrow-east" viewBox="0 0 58 34" aria-hidden="true">
            <line className="quick-start-tour-arrow-line" x1="0" y1="17" x2="44" y2="17" />
            <polygon className="quick-start-tour-arrow-head" points="58,17 36,4 36,30" />
        </svg>
    );
};

const QuickStartTourOverlay: React.FC<QuickStartTourOverlayProps> = ({ tileId, open, onClose }) => {
    const [stepIndex, setStepIndex] = useState(0);
    const [viewportMode, setViewportMode] = useState<'laptop' | 'mobile'>(() => getViewportMode());

    const tour = useMemo(() => {
        if (!tileId) {
            return null;
        }
        return typedLayout.tours.find((entry) => entry.tileId === tileId) || null;
    }, [tileId]);

    const steps = tour?.steps || [];
    const activeStep = steps[stepIndex] || null;

    useEffect(() => {
        setStepIndex(0);
    }, [tileId, open]);

    useEffect(() => {
        if (!open) {
            return;
        }

        const handleResize = () => setViewportMode(getViewportMode());
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [open]);

    if (!open || !tileId || !activeStep) {
        return null;
    }

    const placement = activeStep[viewportMode];
    const side = normalizeTourSide(placement.side || activeStep.side || activeStep.direction || 'east');
    const stepStyle = getStepPosition(placement.x, placement.y);
    const cardStyle = getCardStyle(side);

    return (
        <div
            className="quick-start-tour-backdrop"
            onClick={() => {
                if (stepIndex >= steps.length - 1) {
                    onClose();
                    return;
                }
                setStepIndex((current) => current + 1);
            }}
            role="presentation"
        >
            <button
                type="button"
                className="quick-start-tour-skip"
                onClick={(event) => {
                    event.stopPropagation();
                    onClose();
                }}
            >
                Skip tour
            </button>
            <div className={`quick-start-tour-step quick-start-tour-step-${side}`} style={stepStyle}>
                {renderArrowSvg(side)}
                <div className="quick-start-tour-card" style={cardStyle}>
                    <div className="quick-start-tour-kicker">Quick Start tour {stepIndex + 1}/{steps.length}</div>
                    <p className="quick-start-tour-copy">{activeStep.text}</p>
                    <div className="quick-start-tour-cta">Click anywhere to continue</div>
                </div>
            </div>
        </div>
    );
};

export default QuickStartTourOverlay;