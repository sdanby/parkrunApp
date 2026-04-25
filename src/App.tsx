import React, { useEffect, useRef } from 'react';
import { createBrowserRouter, RouterProvider, Outlet, useLocation, Navigate } from 'react-router-dom';
import HamburgerMenu from './components/HamburgerMenu';
import Home from './pages/Home';
import Login from './pages/Login';
import Results from './pages/Results';
import Races from './pages/Races';
import Courses from './pages/Courses';
import Athletes from './pages/Athletes';
import Lists from './pages/Lists';
import { API_BASE_URL } from './api/backendAPI';
import './styles/main.css';

const AUTH_TOKEN_KEY = 'auth_token_v1';

const headings: { [key: string]: string } = {
    '/': 'Home',
    '/login': 'Login',
    '/results': 'Event Analysis',
    '/races': 'Single Event',
    '/courses': 'Courses',
    '/athletes': 'Athletes - Run History',
    '/lists': 'Lists'
};

const getTopBarUserLabel = (): string => {
    try {
        const raw = localStorage.getItem('auth_user_v1');
        if (!raw) return '';
        const parsed = JSON.parse(raw) || {};
        const displayName = String(parsed.displayName || parsed.email || '').trim();
        const athleteCode = String(parsed.athleteCode || '').trim();
        if (!displayName && !athleteCode) return '';
        if (displayName && athleteCode) return `Logged in as: ${displayName} [${athleteCode}]`;
        return `Logged in as: ${displayName || athleteCode}`;
    } catch (_err) {
        return '';
    }
};

const TopBar: React.FC = () => {
    const location = useLocation();
    const heading = headings[location.pathname] || '';
    const userLabel = getTopBarUserLabel();
    return (
        <div className="top-bar" style={{ padding: '0px 0', display: 'flex', alignItems: 'center', position: 'relative' }}>
            <HamburgerMenu />
            <h1 style={{ marginLeft: '2cm', marginTop: '0.8cm', fontSize: '1.5em' }}>{heading}</h1>
            {userLabel && (
                <div
                    style={{
                        position: 'absolute',
                        left: '2cm',
                        marginTop: '1.55cm',
                        fontSize: '0.72rem',
                        color: '#6b7280',
                        fontStyle: 'italic',
                        whiteSpace: 'nowrap',
                    }}
                    title="Logged in user"
                >
                    {userLabel}
                </div>
            )}
        </div>
    );
};

const PageActivityTracker: React.FC = () => {
    const location = useLocation();
    const currentPathRef = useRef(`${location.pathname}${location.search}`);
    const enteredAtRef = useRef<number>(Date.now());

    const sendUsage = (path: string, enteredAt: number, leftAt: number, referrer: string) => {
        const durationMs = Math.max(0, leftAt - enteredAt);
        const token = localStorage.getItem('auth_token_v1') || undefined;
        const payload = {
            token,
            path,
            enteredAt: new Date(enteredAt).toISOString(),
            leftAt: new Date(leftAt).toISOString(),
            durationMs,
            referrer,
        };

        try {
            fetch(`${API_BASE_URL}/api/analytics/page-visit`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                keepalive: true,
            }).catch(() => undefined);
        } catch (_err) {
            // ignore analytics failures
        }
    };

    useEffect(() => {
        const nextPath = `${location.pathname}${location.search}`;
        const prevPath = currentPathRef.current;
        if (nextPath !== prevPath) {
            const leftAt = Date.now();
            sendUsage(prevPath, enteredAtRef.current, leftAt, nextPath);
            currentPathRef.current = nextPath;
            enteredAtRef.current = leftAt;
        }
    }, [location.pathname, location.search]);

    useEffect(() => {
        const handleVisibility = () => {
            if (document.visibilityState === 'hidden') {
                const leftAt = Date.now();
                sendUsage(currentPathRef.current, enteredAtRef.current, leftAt, document.referrer || 'hidden');
                enteredAtRef.current = leftAt;
            }
        };

        const handleBeforeUnload = () => {
            const leftAt = Date.now();
            sendUsage(currentPathRef.current, enteredAtRef.current, leftAt, 'unload');
            enteredAtRef.current = leftAt;
        };

        document.addEventListener('visibilitychange', handleVisibility);
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => {
            document.removeEventListener('visibilitychange', handleVisibility);
            window.removeEventListener('beforeunload', handleBeforeUnload);
        };
    }, []);

    return null;
};

const RootLayout: React.FC = () => (
    <>
        <PageActivityTracker />
        <TopBar />
        <div className="app">
            <Outlet />
        </div>
    </>
);

const RequireAuthLayout: React.FC = () => {
    const location = useLocation();
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    if (!token) {
        return <Navigate to="/login" replace state={{ from: location }} />;
    }
    return <RootLayout />;
};

const LoginOnlyRoute: React.FC = () => {
    return <Login />;
};

// Build router options with a lenient `any` type so we can pass
// future flags that the installed router type definitions may not
// yet include (this silences runtime deprecation warnings).
const _futureOptions: any = { future: { v7_relativeSplatPath: true, v7_startTransition: true } };

const router = createBrowserRouter([
    {
        path: '/',
        element: <RequireAuthLayout />,
        children: [
            { index: true, element: <Home /> },
            { path: 'results', element: <Results /> },
            { path: 'races', element: <Races /> },
            { path: 'courses', element: <Courses /> },
            { path: 'athletes', element: <Athletes /> },
            { path: 'lists', element: <Lists /> }
        ]
    },
    {
        path: '/login',
        element: <LoginOnlyRoute />
    }
], _futureOptions);

const App: React.FC = () => {
    return (
        <RouterProvider router={router} />
    );
};

export default App;
