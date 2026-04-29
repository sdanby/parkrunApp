import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import AthleteSearch from '../components/AthleteSearch';
import { fetchAuthConfig, linkAthleteCode, loginWithEmail, loginWithGoogle, logoutSession, registerWithEmail, type AuthUser } from '../api/backendAPI';

declare global {
    interface Window {
        google?: any;
    }
}

const AUTH_TOKEN_KEY = 'auth_token_v1';
const AUTH_USER_KEY = 'auth_user_v1';

type PendingLogin = {
    token: string;
    user: AuthUser;
};

const Login: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const googleBtnRef = useRef<HTMLDivElement | null>(null);
    const [mode, setMode] = useState<'signin' | 'register'>('signin');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [googleClientId, setGoogleClientId] = useState<string>(process.env.REACT_APP_GOOGLE_CLIENT_ID || '');
    const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => Boolean(localStorage.getItem(AUTH_TOKEN_KEY)));
    const [pendingLogin, setPendingLogin] = useState<PendingLogin | null>(null);
    const [selectedAthleteCode, setSelectedAthleteCode] = useState<string>('');

    const completeLogin = (token: string, user: any) => {
        const normalizedUser = (user || {}) as AuthUser;
        setPendingLogin({ token, user: normalizedUser });
        setSelectedAthleteCode(String(normalizedUser.athleteCode || ''));
    };

    const finalizeLogin = (token: string, user: AuthUser) => {
        localStorage.setItem(AUTH_TOKEN_KEY, token);
        localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
        setIsAuthenticated(true);
        setPendingLogin(null);
        navigate('/');
    };

    const handlePostLoginContinue = async () => {
        if (!pendingLogin) {
            return;
        }
        setError(null);
        setLoading(true);
        let userToStore: AuthUser = pendingLogin.user;
        try {
            const response = await linkAthleteCode(pendingLogin.token, selectedAthleteCode || undefined);
            if (response?.user) {
                userToStore = response.user;
            } else {
                userToStore = {
                    ...userToStore,
                    athleteCode: selectedAthleteCode || null,
                };
            }
        } catch (_err) {
            userToStore = {
                ...userToStore,
                athleteCode: selectedAthleteCode || null,
            };
        } finally {
            setLoading(false);
        }

        finalizeLogin(pendingLogin.token, userToStore);
    };

    const formatLastLogin = (user?: AuthUser) => {
        if (!user) return 'Not available';
        const value = user.previousLoginAt || user.lastLoginAt;
        if (!value) return 'Not available';
        const dt = new Date(value);
        if (Number.isNaN(dt.getTime())) return 'Not available';
        return dt.toLocaleString();
    };

    const handleLogout = async () => {
        setError(null);
        setLoading(true);
        const token = localStorage.getItem(AUTH_TOKEN_KEY) || undefined;
        try {
            await logoutSession(token);
        } catch (_err) {
            // ignore API errors and still clear local auth state
        } finally {
            localStorage.removeItem(AUTH_TOKEN_KEY);
            localStorage.removeItem(AUTH_USER_KEY);
            setIsAuthenticated(false);
            setLoading(false);
        }
    };

    useEffect(() => {
        const onStorage = () => setIsAuthenticated(Boolean(localStorage.getItem(AUTH_TOKEN_KEY)));
        window.addEventListener('storage', onStorage);
        return () => window.removeEventListener('storage', onStorage);
    }, []);

    useEffect(() => {
        const state: any = location.state;
        const sessionMessage = state?.sessionMessage;
        if (sessionMessage) {
            setError(String(sessionMessage));
            navigate(location.pathname, { replace: true, state: null });
        }
    }, [location.pathname, location.state, navigate]);

    useEffect(() => {
        if (googleClientId) {
            return;
        }
        let cancelled = false;
        const loadConfig = async () => {
            try {
                const config = await fetchAuthConfig();
                const runtimeClientId = String(config?.googleClientId || '').trim();
                if (!cancelled && runtimeClientId) {
                    setGoogleClientId(runtimeClientId);
                }
            } catch (_err) {
                // ignore, UI will keep fallback message
            }
        };
        loadConfig();
        return () => {
            cancelled = true;
        };
    }, [googleClientId]);

    useEffect(() => {
        if (!googleClientId) {
            return;
        }

        const existing = document.querySelector('script[data-google-identity="1"]') as HTMLScriptElement | null;
        const setupGoogle = () => {
            if (!window.google || !googleBtnRef.current) {
                return;
            }
            window.google.accounts.id.initialize({
                client_id: googleClientId,
                callback: async (response: any) => {
                    try {
                        setError(null);
                        setLoading(true);
                        const data = await loginWithGoogle(response?.credential);
                        completeLogin(data.token, data.user);
                    } catch (err: any) {
                        setError(err?.response?.data?.error || 'Google login failed.');
                    } finally {
                        setLoading(false);
                    }
                }
            });
            googleBtnRef.current.innerHTML = '';
            window.google.accounts.id.renderButton(googleBtnRef.current, {
                type: 'standard',
                shape: 'pill',
                theme: 'outline',
                text: 'continue_with',
                size: 'large',
                width: 280
            });
        };

        if (existing) {
            if (window.google) setupGoogle();
            return;
        }

        const script = document.createElement('script');
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.defer = true;
        script.dataset.googleIdentity = '1';
        script.onload = setupGoogle;
        document.head.appendChild(script);
    }, [googleClientId]);

    const handleEmailSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        setError(null);

        if (!email.trim() || !password.trim()) {
            setError('Email and password are required.');
            return;
        }

        if (mode === 'register' && password.trim().length < 8) {
            setError('Password must be at least 8 characters.');
            return;
        }

        try {
            setLoading(true);
            const data = mode === 'register'
                ? await registerWithEmail(email.trim(), password, displayName.trim())
                : await loginWithEmail(email.trim(), password);
            completeLogin(data.token, data.user);
        } catch (err: any) {
            setError(err?.response?.data?.error || 'Unable to sign in.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="page-content" style={{ display: 'flex', justifyContent: 'center', paddingTop: '1.2rem' }}>
            <div style={{ width: 'min(420px, 96vw)', background: '#fff', border: '1px solid #d5dae3', borderRadius: 12, padding: '1rem 1rem 1.2rem' }}>
                {isAuthenticated ? (
                    <div style={{ display: 'grid', gap: 10 }}>
                        <div style={{ fontWeight: 700, fontSize: '1rem' }}>You are currently logged in.</div>
                        <div style={{ color: '#475569' }}>Use logout below to test signing in again or linking an athlete.</div>
                        <button
                            type="button"
                            onClick={handleLogout}
                            disabled={loading}
                            style={{
                                marginTop: 4,
                                padding: '0.55rem 0.75rem',
                                borderRadius: 8,
                                border: '1px solid #1f2937',
                                background: '#111827',
                                color: '#fff',
                                fontWeight: 700,
                                cursor: loading ? 'default' : 'pointer',
                                opacity: loading ? 0.7 : 1
                            }}
                        >
                            {loading ? 'Please wait…' : 'Logout'}
                        </button>
                    </div>
                ) : pendingLogin ? (
                    <div style={{ display: 'grid', gap: 10 }}>
                        <div style={{ fontWeight: 700, fontSize: '1rem' }}>Confirm your profile</div>
                        <div><strong>Name:</strong> {pendingLogin.user.displayName || pendingLogin.user.email || 'Unknown user'}</div>
                        <div><strong>Last login:</strong> {formatLastLogin(pendingLogin.user)}</div>
                        <div><strong>Athlete code:</strong> {selectedAthleteCode || 'Not set'}</div>

                        <div>
                            <label htmlFor="login-athlete-search" style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>
                                Select new/Change parkrun athlete code
                            </label>
                            <AthleteSearch
                                inputId="login-athlete-search"
                                placeholder="Search athlete name or code..."
                                onSelect={(athleteCode) => setSelectedAthleteCode(String(athleteCode || ''))}
                            />
                        </div>

                        <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                            <button
                                type="button"
                                onClick={handlePostLoginContinue}
                                disabled={loading}
                                style={{
                                    flex: 1,
                                    padding: '0.55rem 0.75rem',
                                    borderRadius: 8,
                                    border: '1px solid #1f2937',
                                    background: '#111827',
                                    color: '#fff',
                                    fontWeight: 700,
                                    cursor: loading ? 'default' : 'pointer',
                                    opacity: loading ? 0.7 : 1
                                }}
                            >
                                {loading ? 'Please wait…' : 'Continue'}
                            </button>
                            <button
                                type="button"
                                onClick={() => setSelectedAthleteCode('')}
                                disabled={loading}
                                style={{
                                    flex: 1,
                                    padding: '0.55rem 0.75rem',
                                    borderRadius: 8,
                                    border: '1px solid #cbd5e1',
                                    background: '#fff',
                                    color: '#111827',
                                    fontWeight: 700,
                                    cursor: loading ? 'default' : 'pointer',
                                    opacity: loading ? 0.7 : 1
                                }}
                            >
                                Clear athlete code
                            </button>
                        </div>
                    </div>
                ) : (
                    <>
                <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                    <button
                        type="button"
                        onClick={() => setMode('signin')}
                        style={{
                            flex: 1,
                            padding: '0.45rem 0.5rem',
                            border: '1px solid #cbd5e1',
                            borderRadius: 8,
                            cursor: 'pointer',
                            background: mode === 'signin' ? '#e2e8f0' : '#fff',
                            fontWeight: 700
                        }}
                    >
                        Sign In
                    </button>
                    <button
                        type="button"
                        onClick={() => setMode('register')}
                        style={{
                            flex: 1,
                            padding: '0.45rem 0.5rem',
                            border: '1px solid #cbd5e1',
                            borderRadius: 8,
                            cursor: 'pointer',
                            background: mode === 'register' ? '#e2e8f0' : '#fff',
                            fontWeight: 700
                        }}
                    >
                        Register
                    </button>
                </div>

                <form onSubmit={handleEmailSubmit} style={{ display: 'grid', gap: 10 }}>
                    {mode === 'register' && (
                        <>
                            <label htmlFor="login-display-name" style={{ fontWeight: 600 }}>Display Name</label>
                            <input
                                id="login-display-name"
                                type="text"
                                value={displayName}
                                onChange={(e) => setDisplayName(e.target.value)}
                                placeholder="Your name"
                                style={{ padding: '0.45rem', border: '1px solid #cbd5e1', borderRadius: 8 }}
                            />
                        </>
                    )}

                    <label htmlFor="login-email" style={{ fontWeight: 600 }}>Email</label>
                    <input
                        id="login-email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        autoComplete="email"
                        style={{ padding: '0.45rem', border: '1px solid #cbd5e1', borderRadius: 8 }}
                    />

                    <label htmlFor="login-password" style={{ fontWeight: 600 }}>Password</label>
                    <input
                        id="login-password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder={mode === 'register' ? 'At least 8 characters' : 'Your password'}
                        autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                        style={{ padding: '0.45rem', border: '1px solid #cbd5e1', borderRadius: 8 }}
                    />

                    <button
                        type="submit"
                        disabled={loading}
                        style={{
                            marginTop: 4,
                            padding: '0.55rem 0.75rem',
                            borderRadius: 8,
                            border: '1px solid #1f2937',
                            background: '#111827',
                            color: '#fff',
                            fontWeight: 700,
                            cursor: loading ? 'default' : 'pointer',
                            opacity: loading ? 0.7 : 1
                        }}
                    >
                        {loading ? 'Please wait…' : mode === 'register' ? 'Create Account' : 'Sign In'}
                    </button>
                </form>

                <div style={{ margin: '14px 0', textAlign: 'center', color: '#64748b', fontSize: '0.85rem' }}>OR</div>

                {googleClientId ? (
                    <div ref={googleBtnRef} style={{ display: 'flex', justifyContent: 'center', minHeight: 42 }} />
                ) : (
                    <div style={{ color: '#b45309', background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 8, padding: '0.5rem' }}>
                        Google sign-in is unavailable until `REACT_APP_GOOGLE_CLIENT_ID` is configured.
                    </div>
                )}

                {error && (
                    <div style={{ marginTop: 12, color: '#b91c1c', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '0.45rem' }}>
                        {error}
                    </div>
                )}
                    </>
                )}
            </div>
        </div>
    );
};

export default Login;