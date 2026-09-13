import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { API_BASE_URL, fetchAdminStatus, fetchChatUnreadStatus, logoutSession } from '../api/backendAPI';
import { clearNavStack } from '../utils/navigationStack';
import './HamburgerMenu.css';

const AUTH_TOKEN_KEY = 'auth_token_v1';
const AUTH_USER_KEY = 'auth_user_v1';
const SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const CHAT_UNREAD_STATUS_CHANGED_EVENT = 'chat-unread-status-changed';

const HamburgerMenu: React.FC = () => {
    const [open, setOpen] = useState(false);
    const [canSeeAdmin, setCanSeeAdmin] = useState(false);
    const [hasUnreadChat, setHasUnreadChat] = useState(false);
    const menuRef = useRef<HTMLDivElement | null>(null);
    const navigate = useNavigate();
    const location = useLocation();
    const isAuthenticated = Boolean(localStorage.getItem(AUTH_TOKEN_KEY));

    useEffect(() => {
        if (!open) return;

        const handleOutsidePointer = (event: MouseEvent | TouchEvent) => {
            const targetNode = event.target as Node | null;
            if (!menuRef.current || !targetNode) return;
            if (!menuRef.current.contains(targetNode)) {
                setOpen(false);
            }
        };

        document.addEventListener('mousedown', handleOutsidePointer);
        document.addEventListener('touchstart', handleOutsidePointer, { passive: true });

        return () => {
            document.removeEventListener('mousedown', handleOutsidePointer);
            document.removeEventListener('touchstart', handleOutsidePointer);
        };
    }, [open]);

    useEffect(() => {
        let cancelled = false;

        const loadAdminAccess = async () => {
            if (!isAuthenticated) {
                if (!cancelled) setCanSeeAdmin(false);
                return;
            }
            const token = localStorage.getItem(AUTH_TOKEN_KEY) || '';
            if (!token) {
                if (!cancelled) setCanSeeAdmin(false);
                return;
            }

            try {
                const status = await fetchAdminStatus(token);
                if (!cancelled) {
                    setCanSeeAdmin(Boolean(status.canAccessAdmin));
                    if (status.user) {
                        localStorage.setItem(AUTH_USER_KEY, JSON.stringify(status.user));
                    }
                }
            } catch (_err) {
                if (!cancelled) {
                    setCanSeeAdmin(false);
                }
            }
        };

        loadAdminAccess();
        return () => {
            cancelled = true;
        };
    }, [isAuthenticated, open]);

    useEffect(() => {
        let cancelled = false;

        const refreshChatUnreadStatus = async () => {
            if (!isAuthenticated) {
                if (!cancelled) {
                    setHasUnreadChat(false);
                }
                return;
            }

            try {
                const status = await fetchChatUnreadStatus();
                if (!cancelled) {
                    setHasUnreadChat(Boolean(status.hasUnread));
                }
            } catch (_err) {
                if (!cancelled) {
                    setHasUnreadChat(false);
                }
            }
        };

        refreshChatUnreadStatus();
        const intervalId = window.setInterval(refreshChatUnreadStatus, 5000);
        const handleChatUnreadStatusChanged = () => {
            refreshChatUnreadStatus();
        };
        window.addEventListener(CHAT_UNREAD_STATUS_CHANGED_EVENT, handleChatUnreadStatusChanged);

        return () => {
            cancelled = true;
            window.clearInterval(intervalId);
            window.removeEventListener(CHAT_UNREAD_STATUS_CHANGED_EVENT, handleChatUnreadStatusChanged);
        };
    }, [isAuthenticated, location.pathname, location.search]);

    const handleLogout = async () => {
        const token = localStorage.getItem(AUTH_TOKEN_KEY) || undefined;
        try {
            await logoutSession(token);
        } catch (_err) {
            // ignore logout API errors and still clear local auth state
        }

        localStorage.removeItem(AUTH_TOKEN_KEY);
        localStorage.removeItem(AUTH_USER_KEY);
        setCanSeeAdmin(false);
        setOpen(false);
        navigate('/login');
    };

    const getLastLoginTime = (): number | null => {
        try {
            const raw = localStorage.getItem(AUTH_USER_KEY);
            if (!raw) return null;
            const parsed = JSON.parse(raw) || {};
            const value = parsed.lastLoginAt;
            if (!value) return null;
            const dt = new Date(String(value));
            if (Number.isNaN(dt.getTime())) return null;
            return dt.getTime();
        } catch (_err) {
            return null;
        }
    };

    const handleHamburgerToggle = async () => {
        if (!isAuthenticated) {
            setOpen((prev) => !prev);
            return;
        }

        const lastLoginTs = getLastLoginTime();
        if (lastLoginTs && (Date.now() - lastLoginTs) > SESSION_MAX_AGE_MS) {
            const token = localStorage.getItem(AUTH_TOKEN_KEY) || undefined;
            try {
                await logoutSession(token);
            } catch (_err) {
                // ignore API errors and still clear local auth state
            }
            localStorage.removeItem(AUTH_TOKEN_KEY);
            localStorage.removeItem(AUTH_USER_KEY);
            setCanSeeAdmin(false);
            setOpen(false);
            navigate('/login', {
                state: {
                    sessionMessage: 'Your session is older than 24 hours. Please log in again.'
                }
            });
            return;
        }

        setOpen((prev) => !prev);
    };

    const handleMenuClick = async (path: string) => {
        clearNavStack(path);

        if (path === '/next-event' && location.pathname === '/athletes') {
            const currentParams = new URLSearchParams(location.search || '');
            const stateObj = (location.state && typeof location.state === 'object')
                ? location.state as Record<string, unknown>
                : {};
            const athleteCode = String(currentParams.get('athlete_code') || stateObj.athleteCode || '').trim();
            const athleteName = String(currentParams.get('athlete_name') || stateObj.athleteName || '').trim();
            const nextParams = new URLSearchParams();
            if (athleteCode) {
                nextParams.set('athlete_code', athleteCode);
            }
            if (athleteName) {
                nextParams.set('athlete_name', athleteName);
            }
            const nextSearch = nextParams.toString();
            navigate(nextSearch ? `${path}?${nextSearch}` : path, {
                state: {
                    athleteCode: athleteCode || undefined,
                    athleteName: athleteName || undefined,
                    from: 'athletes'
                }
            });
            setOpen(false);
            return;
        }

        if (path === '/athletes' && location.pathname === '/next-event') {
            const currentParams = new URLSearchParams(location.search || '');
            const stateObj = (location.state && typeof location.state === 'object')
                ? location.state as Record<string, unknown>
                : {};
            const athleteCode = String(currentParams.get('athlete_code') || stateObj.athleteCode || '').trim();
            const athleteName = String(currentParams.get('athlete_name') || stateObj.athleteName || '').trim();
            const nextParams = new URLSearchParams();
            if (athleteCode) {
                nextParams.set('athlete_code', athleteCode);
            }
            if (athleteName) {
                nextParams.set('athlete_name', athleteName);
            }
            const nextSearch = nextParams.toString();
            navigate(nextSearch ? `${path}?${nextSearch}` : path, {
                state: {
                    athleteCode: athleteCode || undefined,
                    athleteName: athleteName || undefined,
                    from: 'next-event'
                }
            });
            setOpen(false);
            return;
        }

        if (path === '/races' || path === '/event_old') {
            const getPreferredEventCode = (): string => {
                try {
                    const raw = localStorage.getItem(AUTH_USER_KEY);
                    if (!raw) return '1';
                    const parsed = JSON.parse(raw) || {};
                    const candidate = String(parsed.defaultCourseCode ?? parsed.default_course_code ?? '').trim();
                    if (/^\d+$/.test(candidate)) {
                        return candidate;
                    }
                    return '1';
                } catch (_err) {
                    return '1';
                }
            };

            const preferredEventCode = getPreferredEventCode();

            // Seed Single Event with preferred event_code and latest date using the last_positions API
            try {
                // Use the specific API endpoint to get the latest event for the chosen event code
                const response = await fetch(`${API_BASE_URL}/api/last_positions?event_code=${encodeURIComponent(preferredEventCode)}`);
                if (response.ok) {
                    const lastEventData = await response.json();
                    
                    if (lastEventData && lastEventData.length > 0) {
                        // Sort by formatted_date (ISO format) to get the truly latest event
                        const sortedEvents = lastEventData.sort((a: any, b: any) => {
                            const dateA = a.formatted_date || a.event_date;
                            const dateB = b.formatted_date || b.event_date;
                            return dateB.localeCompare(dateA); // Descending order (latest first)
                        });
                        
                        // Use the original event_date (dd/mm/yyyy) for the URL parameter
                        const latestEvent = sortedEvents[0];
                        const latestDate = latestEvent.event_date || latestEvent.eventDate;
                        if (latestDate) {
                            // Navigate with the latest date
                            navigate(`${path}?event_code=${encodeURIComponent(preferredEventCode)}&date=${encodeURIComponent(latestDate)}`);
                            setOpen(false);
                            return;
                        }
                    }
                }
            } catch (error) {
                console.warn('Could not fetch latest event data, using defaults:', error);
            }
            // Fallback to event_code=1 when no preferred course is set, else preferred code
            navigate(`${path}?event_code=${encodeURIComponent(preferredEventCode)}`);
        } else {
            if (path === '/results_test') {
                navigate(path, { state: { fromHamburgerMenu: true, resetSortDefaults: true } });
            } else {
                navigate(path);
            }
        }
        setOpen(false);
    };

    return (
        <div className="hamburger-menu" ref={menuRef}>
            <button className="hamburger-button" onClick={handleHamburgerToggle}>
                ☰
            </button>
            {open && (
                <ul className="hamburger-list">
                    <li onClick={() => handleMenuClick('/')}>Home</li>
                    <li onClick={() => handleMenuClick('/quick-start')}>Quick Start</li>
                    <li onClick={() => handleMenuClick('/results_test')}>Event Analysis</li>
                    <li onClick={() => handleMenuClick('/races')}>Event</li>
                    <li onClick={() => handleMenuClick('/courses_test')}>Course</li>
                    <li onClick={() => handleMenuClick('/athletes')}>Participant</li>
                    <li onClick={() => handleMenuClick('/next-event')}>Next Event</li>
                    <li onClick={() => handleMenuClick('/clubs')}>Club</li>
                    <li onClick={() => handleMenuClick('/lists')}>Lists</li>
                    <li className={hasUnreadChat ? 'hamburger-chat-unread' : undefined} onClick={() => handleMenuClick('/chat')}>
                        {hasUnreadChat ? 'Chat*' : 'Chat'}
                    </li>
                    <li onClick={() => handleMenuClick('/feedback')}>Log Error / Suggestion</li>
                    {canSeeAdmin && <li onClick={() => handleMenuClick('/admin')}>Admin</li>}
                    <li onClick={() => (isAuthenticated ? handleLogout() : handleMenuClick('/login'))}>
                        {isAuthenticated ? 'Logout' : 'Login'}
                    </li>
                </ul>
            )}
        </div>
    );
};

export default HamburgerMenu;