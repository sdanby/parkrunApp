import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchAuthConfig, loginWithEmail, loginWithGoogle, registerWithEmail } from '../api/backendAPI';

declare global {
    interface Window {
        google?: any;
    }
}

const AUTH_TOKEN_KEY = 'auth_token_v1';
const AUTH_USER_KEY = 'auth_user_v1';

const Login: React.FC = () => {
    const navigate = useNavigate();
    const googleBtnRef = useRef<HTMLDivElement | null>(null);
    const [mode, setMode] = useState<'signin' | 'register'>('signin');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [googleClientId, setGoogleClientId] = useState<string>(process.env.REACT_APP_GOOGLE_CLIENT_ID || '');

    const completeLogin = (token: string, user: any) => {
        localStorage.setItem(AUTH_TOKEN_KEY, token);
        localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
        navigate('/results');
    };

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
            </div>
        </div>
    );
};

export default Login;