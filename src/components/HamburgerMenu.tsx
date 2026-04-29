import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchAdminStatus, logoutSession } from '../api/backendAPI';
import './HamburgerMenu.css';

const AUTH_TOKEN_KEY = 'auth_token_v1';
const AUTH_USER_KEY = 'auth_user_v1';
const SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000;

const HamburgerMenu: React.FC = () => {
    const [open, setOpen] = useState(false);
    const [canSeeAdmin, setCanSeeAdmin] = useState(false);
    const navigate = useNavigate();
    const isAuthenticated = Boolean(localStorage.getItem(AUTH_TOKEN_KEY));

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
        if (path === '/races') {
            // Seed Single Event with event_code=1 and latest date using the last_positions API
            try {
                // Use the specific API endpoint to get the latest event for event_code=1
                const response = await fetch('https://hello-world-9yb9.onrender.com/api/last_positions?event_code=1');
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
                            navigate(`/races?event_code=1&date=${encodeURIComponent(latestDate)}`);
                            setOpen(false);
                            return;
                        }
                    }
                }
            } catch (error) {
                console.warn('Could not fetch latest event data, using defaults:', error);
            }
            // Fallback to just event_code=1 if we can't get the latest date
            navigate('/races?event_code=1');
        } else {
            navigate(path);
        }
        setOpen(false);
    };

    return (
        <div className="hamburger-menu">
            <button className="hamburger-button" onClick={handleHamburgerToggle}>
                ☰
            </button>
            {open && (
                <ul className="hamburger-list">
                    <li onClick={() => handleMenuClick('/')}>Home</li>
                    <li onClick={() => handleMenuClick('/results')}>Event Analysis</li>
                    <li onClick={() => handleMenuClick('/races')}>Single Event</li>
                    <li onClick={() => handleMenuClick('/courses')}>Courses</li>
                    <li onClick={() => handleMenuClick('/athletes')}>Athletes - Run History</li>
                    <li onClick={() => handleMenuClick('/clubs')}>Clubs</li>
                    <li onClick={() => handleMenuClick('/lists')}>Lists</li>
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