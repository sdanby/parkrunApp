import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import AthleteSearch from '../components/AthleteSearch';
import EventSearch from '../components/EventSearch';
import { confirmPasswordReset, fetchAuthConfig, fetchEventOptions, linkAthleteCode, loginWithEmail, loginWithGoogle, logoutSession, registerWithEmail, requestPasswordReset, validatePasswordResetToken, type AuthUser, type EventOption } from '../api/backendAPI';

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

type LoginMode = 'signin' | 'register' | 'forgot' | 'reset';

const Login: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const googleBtnRef = useRef<HTMLDivElement | null>(null);
    const [mode, setMode] = useState<LoginMode>('signin');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [googleClientId, setGoogleClientId] = useState<string>(process.env.REACT_APP_GOOGLE_CLIENT_ID || '');
    const [passwordResetEnabled, setPasswordResetEnabled] = useState<boolean>(true);
    const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => Boolean(localStorage.getItem(AUTH_TOKEN_KEY)));
    const [pendingLogin, setPendingLogin] = useState<PendingLogin | null>(null);
    const [selectedAthleteCode, setSelectedAthleteCode] = useState<string>('');
    const [selectedDefaultCourseCode, setSelectedDefaultCourseCode] = useState<string>('');
    const [selectedDefaultCourseName, setSelectedDefaultCourseName] = useState<string>('');
    const [courseOptions, setCourseOptions] = useState<EventOption[]>([]);
    const [resetToken, setResetToken] = useState<string>('');
    const [resetTokenValid, setResetTokenValid] = useState<boolean>(false);
    const [resetValidationLoading, setResetValidationLoading] = useState<boolean>(false);
    const [resetPassword, setResetPassword] = useState('');
    const [resetPasswordConfirm, setResetPasswordConfirm] = useState('');
    const [infoMessage, setInfoMessage] = useState<string | null>(null);

    const completeLogin = (token: string, user: any) => {
        const normalizedUser = (user || {}) as AuthUser;
        setPendingLogin({ token, user: normalizedUser });
        setSelectedAthleteCode(String(normalizedUser.athleteCode || ''));
        setSelectedDefaultCourseCode(String(normalizedUser.defaultCourseCode || ''));
        setSelectedDefaultCourseName(String(normalizedUser.defaultCourseName || ''));
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
            const response = await linkAthleteCode(
                pendingLogin.token,
                selectedAthleteCode || undefined,
                selectedDefaultCourseCode || undefined,
                selectedDefaultCourseName || undefined
            );
            if (response?.user) {
                userToStore = response.user;
            } else {
                userToStore = {
                    ...userToStore,
                    athleteCode: selectedAthleteCode || null,
                    defaultCourseCode: selectedDefaultCourseCode || null,
                    defaultCourseName: selectedDefaultCourseName || null,
                };
            }
        } catch (_err) {
            userToStore = {
                ...userToStore,
                athleteCode: selectedAthleteCode || null,
                defaultCourseCode: selectedDefaultCourseCode || null,
                defaultCourseName: selectedDefaultCourseName || null,
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
        let cancelled = false;
        const loadCourseOptions = async () => {
            try {
                const options = await fetchEventOptions();
                if (!cancelled) {
                    setCourseOptions(options);
                }
            } catch (_err) {
                if (!cancelled) {
                    setCourseOptions([]);
                }
            }
        };
        loadCourseOptions();
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        const state: any = location.state;
        const sessionMessage = state?.sessionMessage;
        if (sessionMessage) {
            setInfoMessage(String(sessionMessage));
            navigate(location.pathname, { replace: true, state: null });
        }
    }, [location.pathname, location.state, navigate]);

    useEffect(() => {
        const params = new URLSearchParams(location.search || '');
        const token = String(params.get('reset_token') || '').trim();
        setResetToken(token);
        if (token) {
            setMode('reset');
            setInfoMessage(null);
            setError(null);
            return;
        }
        setResetTokenValid(false);
        setResetPassword('');
        setResetPasswordConfirm('');
        setResetValidationLoading(false);
        setMode((current) => (current === 'reset' ? 'signin' : current));
    }, [location.search]);

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
                if (!cancelled) {
                    setPasswordResetEnabled(config?.passwordResetEnabled !== false);
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
        if (!resetToken) {
            return;
        }

        let cancelled = false;
        const checkResetToken = async () => {
            try {
                setResetValidationLoading(true);
                const validation = await validatePasswordResetToken(resetToken);
                if (cancelled) {
                    return;
                }
                setResetTokenValid(Boolean(validation.valid));
                if (!validation.valid) {
                    setError('This password reset link is invalid or has expired.');
                }
            } catch (_err) {
                if (!cancelled) {
                    setResetTokenValid(false);
                    setError('Unable to validate this password reset link right now.');
                }
            } finally {
                if (!cancelled) {
                    setResetValidationLoading(false);
                }
            }
        };

        checkResetToken();
        return () => {
            cancelled = true;
        };
    }, [resetToken]);

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
        setInfoMessage(null);

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

    const handleForgotPasswordSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        setError(null);
        setInfoMessage(null);

        if (!email.trim()) {
            setError('Email is required.');
            return;
        }

        try {
            setLoading(true);
            const response = await requestPasswordReset(email.trim());
            setInfoMessage(response?.message || 'If that email address is registered, a password reset link has been sent.');
        } catch (err: any) {
            setError(err?.response?.data?.error || 'Unable to send a password reset email right now.');
        } finally {
            setLoading(false);
        }
    };

    const handlePasswordResetConfirm = async (event: React.FormEvent) => {
        event.preventDefault();
        setError(null);
        setInfoMessage(null);

        if (!resetToken) {
            setError('This password reset link is invalid or has expired.');
            return;
        }
        if (resetPassword.trim().length < 8) {
            setError('Password must be at least 8 characters.');
            return;
        }
        if (resetPassword !== resetPasswordConfirm) {
            setError('Passwords do not match.');
            return;
        }

        try {
            setLoading(true);
            const response = await confirmPasswordReset(resetToken, resetPassword);
            setResetPassword('');
            setResetPasswordConfirm('');
            navigate('/login', {
                replace: true,
                state: { sessionMessage: response?.message || 'Your password has been updated. Please sign in.' }
            });
        } catch (err: any) {
            setError(err?.response?.data?.error || 'Unable to update your password right now.');
        } finally {
            setLoading(false);
        }
    };

    const resetToSignIn = () => {
        setMode('signin');
        setError(null);
        setInfoMessage(null);
        setPassword('');
        setResetPassword('');
        setResetPasswordConfirm('');
        if (resetToken) {
            navigate('/login', { replace: true });
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
                        <div><strong>Default course:</strong> {selectedDefaultCourseName || selectedDefaultCourseCode || 'Not set'}</div>

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

                        <div>
                            <label htmlFor="login-default-course-search" style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>
                                Select new/Change default course
                            </label>
                            <EventSearch
                                inputId="login-default-course-search"
                                options={courseOptions}
                                initialQuery={selectedDefaultCourseName}
                                placeholder="Search course name or code..."
                                inputWidth="100%"
                                dropdownWidth="100%"
                                onSelect={(eventCode, eventName) => {
                                    setSelectedDefaultCourseCode(String(eventCode || ''));
                                    setSelectedDefaultCourseName(String(eventName || ''));
                                }}
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
                                onClick={() => {
                                    setSelectedAthleteCode('');
                                    setSelectedDefaultCourseCode('');
                                    setSelectedDefaultCourseName('');
                                }}
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
                                Clear selections
                            </button>
                        </div>
                    </div>
                ) : (
                    <>
                <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                    <button
                        type="button"
                        onClick={() => {
                            setMode('signin');
                            setError(null);
                            setInfoMessage(null);
                        }}
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
                        onClick={() => {
                            setMode('register');
                            setError(null);
                            setInfoMessage(null);
                        }}
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

                {mode === 'forgot' ? (
                    <form onSubmit={handleForgotPasswordSubmit} style={{ display: 'grid', gap: 10 }}>
                        <div style={{ fontWeight: 700, fontSize: '1rem' }}>Reset your password</div>
                        <div style={{ color: '#475569' }}>Enter your email address and we will send you a reset link.</div>
                        <label htmlFor="forgot-email" style={{ fontWeight: 600 }}>Email</label>
                        <input
                            id="forgot-email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="you@example.com"
                            autoComplete="email"
                            style={{ padding: '0.45rem', border: '1px solid #cbd5e1', borderRadius: 8 }}
                        />
                        <button
                            type="submit"
                            disabled={loading || !passwordResetEnabled}
                            style={{
                                marginTop: 4,
                                padding: '0.55rem 0.75rem',
                                borderRadius: 8,
                                border: '1px solid #1f2937',
                                background: '#111827',
                                color: '#fff',
                                fontWeight: 700,
                                cursor: loading || !passwordResetEnabled ? 'default' : 'pointer',
                                opacity: loading || !passwordResetEnabled ? 0.7 : 1
                            }}
                        >
                            {loading ? 'Please wait…' : 'Send Reset Email'}
                        </button>
                        <button
                            type="button"
                            onClick={resetToSignIn}
                            style={{
                                padding: '0.55rem 0.75rem',
                                borderRadius: 8,
                                border: '1px solid #cbd5e1',
                                background: '#fff',
                                color: '#111827',
                                fontWeight: 700,
                                cursor: 'pointer'
                            }}
                        >
                            Back to Sign In
                        </button>
                    </form>
                ) : mode === 'reset' ? (
                    <form onSubmit={handlePasswordResetConfirm} style={{ display: 'grid', gap: 10 }}>
                        <div style={{ fontWeight: 700, fontSize: '1rem' }}>Choose a new password</div>
                        <div style={{ color: '#475569' }}>Set your new password for this account.</div>
                        <label htmlFor="reset-password" style={{ fontWeight: 600 }}>New Password</label>
                        <input
                            id="reset-password"
                            type="password"
                            value={resetPassword}
                            onChange={(e) => setResetPassword(e.target.value)}
                            placeholder="At least 8 characters"
                            autoComplete="new-password"
                            style={{ padding: '0.45rem', border: '1px solid #cbd5e1', borderRadius: 8 }}
                        />
                        <label htmlFor="reset-password-confirm" style={{ fontWeight: 600 }}>Confirm Password</label>
                        <input
                            id="reset-password-confirm"
                            type="password"
                            value={resetPasswordConfirm}
                            onChange={(e) => setResetPasswordConfirm(e.target.value)}
                            placeholder="Repeat new password"
                            autoComplete="new-password"
                            style={{ padding: '0.45rem', border: '1px solid #cbd5e1', borderRadius: 8 }}
                        />
                        <button
                            type="submit"
                            disabled={loading || resetValidationLoading || !resetTokenValid}
                            style={{
                                marginTop: 4,
                                padding: '0.55rem 0.75rem',
                                borderRadius: 8,
                                border: '1px solid #1f2937',
                                background: '#111827',
                                color: '#fff',
                                fontWeight: 700,
                                cursor: loading || resetValidationLoading || !resetTokenValid ? 'default' : 'pointer',
                                opacity: loading || resetValidationLoading || !resetTokenValid ? 0.7 : 1
                            }}
                        >
                            {resetValidationLoading ? 'Checking link…' : loading ? 'Please wait…' : 'Update Password'}
                        </button>
                        <button
                            type="button"
                            onClick={resetToSignIn}
                            style={{
                                padding: '0.55rem 0.75rem',
                                borderRadius: 8,
                                border: '1px solid #cbd5e1',
                                background: '#fff',
                                color: '#111827',
                                fontWeight: 700,
                                cursor: 'pointer'
                            }}
                        >
                            Back to Sign In
                        </button>
                    </form>
                ) : (
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

                    {mode === 'signin' && (
                        <button
                            type="button"
                            onClick={() => {
                                setMode('forgot');
                                setError(null);
                                setInfoMessage(null);
                            }}
                            style={{
                                justifySelf: 'start',
                                padding: 0,
                                border: 'none',
                                background: 'transparent',
                                color: '#1d4ed8',
                                cursor: 'pointer',
                                fontWeight: 600
                            }}
                        >
                            Forgot password?
                        </button>
                    )}

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
                )}

                {(mode === 'signin' || mode === 'register') && (
                    <>
                <div style={{ margin: '14px 0', textAlign: 'center', color: '#64748b', fontSize: '0.85rem' }}>OR</div>

                {googleClientId ? (
                    <div ref={googleBtnRef} style={{ display: 'flex', justifyContent: 'center', minHeight: 42 }} />
                ) : (
                    <div style={{ color: '#b45309', background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 8, padding: '0.5rem' }}>
                        Google sign-in is unavailable until `REACT_APP_GOOGLE_CLIENT_ID` is configured.
                    </div>
                )}
                    </>
                )}

                {infoMessage && (
                    <div style={{ marginTop: 12, color: '#166534', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '0.45rem' }}>
                        {infoMessage}
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