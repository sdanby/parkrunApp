import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { createChatMessage, fetchChatMessages, trackPageVisit, type AuthUser, type ChatMessage } from '../api/backendAPI';
import { getChatElementById, getChatViewportForWidth, type ChatPositionSpec, type ChatViewport } from '../config/layout/chatLayoutHelper';

const AUTH_USER_KEY = 'auth_user_v1';
const AUTH_TOKEN_KEY = 'auth_token_v1';

const getLoggedInUser = (): AuthUser | null => {
    if (typeof window === 'undefined') {
        return null;
    }

    try {
        const raw = window.localStorage.getItem(AUTH_USER_KEY);
        if (!raw) {
            return null;
        }
        return JSON.parse(raw) as AuthUser;
    } catch (_err) {
        return null;
    }
};

const formatMessageTime = (value?: string | null): string => {
    if (!value) {
        return '';
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        return '';
    }
    return parsed.toLocaleString('en-GB', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
    });
};

const getViewportWidth = (): number => {
    if (typeof window === 'undefined') {
        return 1024;
    }
    return window.innerWidth;
};

const toAbsoluteBoxStyle = (placement?: ChatPositionSpec): React.CSSProperties => ({
    position: 'absolute',
    left: placement?.x ?? '0cm',
    top: placement?.y ?? '0cm',
    width: placement?.width ?? '100%',
    height: placement?.height,
    minHeight: placement?.minHeight,
    maxHeight: placement?.maxHeight,
    minWidth: placement?.minWidth,
    maxWidth: placement?.maxWidth
});

const cmToNumber = (value?: string): number => {
    if (!value) {
        return 0;
    }
    const match = String(value).trim().match(/^(-?\d+(?:\.\d+)?)cm$/i);
    return match ? Number(match[1]) : 0;
};

const getBottomCm = (placement?: ChatPositionSpec): number => cmToNumber(placement?.y) + cmToNumber(placement?.height);
const getRightCm = (placement?: ChatPositionSpec): number => cmToNumber(placement?.x) + cmToNumber(placement?.width);

const Chat: React.FC = () => {
    const location = useLocation();
    const currentUser = useMemo(() => getLoggedInUser(), []);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [draft, setDraft] = useState<string>('');
    const [loading, setLoading] = useState<boolean>(true);
    const [saving, setSaving] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [viewportWidth, setViewportWidth] = useState<number>(() => getViewportWidth());
    const listEndRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (typeof window === 'undefined') {
            return undefined;
        }
        const handleResize = () => setViewportWidth(window.innerWidth);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        const token = window.localStorage.getItem(AUTH_TOKEN_KEY) || undefined;
        const path = `${location.pathname}${location.search}`;
        trackPageVisit({
            token,
            path,
            enteredAt: new Date().toISOString(),
            leftAt: new Date().toISOString(),
            durationMs: 0,
            referrer: 'chat-enter'
        }).catch(() => undefined);
    }, [location.pathname, location.search]);

    const loadMessages = async (showLoading = false) => {
        if (showLoading) {
            setLoading(true);
        }
        try {
            const rows = await fetchChatMessages(200);
            setMessages(rows);
            setError(null);
        } catch (_err) {
            setError('Unable to load chat messages right now.');
        } finally {
            if (showLoading) {
                setLoading(false);
            }
        }
    };

    useEffect(() => {
        loadMessages(true);
        const timerId = window.setInterval(() => {
            loadMessages(false);
        }, 5000);
        return () => window.clearInterval(timerId);
    }, []);

    useEffect(() => {
        listEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }, [messages.length]);

    const viewport: ChatViewport = getChatViewportForWidth(viewportWidth);
    const mainBodyPlacement = getChatElementById('chat.mainBody')?.[viewport];
    const textRectanglePlacement = getChatElementById('chat.textRectangle')?.[viewport];
    const pageHeightCm = Math.max(getBottomCm(mainBodyPlacement), getBottomCm(textRectanglePlacement)) + 0.8;
    const pageWidthCm = Math.max(getRightCm(mainBodyPlacement), getRightCm(textRectanglePlacement)) + 0.8;
    const contentLeftCm = mainBodyPlacement?.x ?? textRectanglePlacement?.x ?? '0cm';

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        const messageText = draft.trim();
        if (!messageText || saving) {
            return;
        }

        try {
            setSaving(true);
            const created = await createChatMessage({ messageText });
            setMessages((current) => [...current, created]);
            setDraft('');
            setError(null);
            const token = window.localStorage.getItem(AUTH_TOKEN_KEY) || undefined;
            const path = `${location.pathname}${location.search}`;
            trackPageVisit({
                token,
                path,
                enteredAt: new Date().toISOString(),
                leftAt: new Date().toISOString(),
                durationMs: 0,
                referrer: 'chat-message'
            }).catch(() => undefined);
        } catch (_err) {
            setError('Unable to send message right now.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="page-content">
            <div style={{ width: `${pageWidthCm}cm`, maxWidth: '100%', margin: '0cm 0 0 0', padding: '0.15rem 0.2rem 1.4rem' }}>
                <div style={{ marginBottom: '0.2rem', padding: `0 0.2rem 0 ${contentLeftCm}` }}>
                    <p style={{ margin: 0, color: '#4b5563' }}>
                        Shared conversation for all logged-in users.
                    </p>
                    {currentUser?.displayName || currentUser?.email ? (
                        <p style={{ margin: '0.35rem 0 0', color: '#6b7280', fontSize: '0.9rem' }}>
                            Posting as {currentUser?.displayName || currentUser?.email}
                        </p>
                    ) : null}
                </div>

                {error ? (
                    <div style={{ marginBottom: '0.6rem', color: '#b91c1c', padding: `0 0.2rem 0 ${contentLeftCm}` }}>{error}</div>
                ) : null}

                <div style={{ position: 'relative', height: `${pageHeightCm}cm` }}>
                    <div
                        style={{
                            ...toAbsoluteBoxStyle(mainBodyPlacement),
                            border: '1px solid #d1d5db',
                            borderRadius: '14px',
                            background: '#f9fafb',
                            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.08)',
                            overflowY: 'auto',
                            padding: '0.9rem 0.9rem 0.5rem',
                            overflowX: 'hidden',
                            boxSizing: 'border-box'
                        }}
                    >
                        {loading ? (
                            <div style={{ color: '#6b7280' }}>Loading messages…</div>
                        ) : messages.length === 0 ? (
                            <div style={{ color: '#6b7280' }}>No chat messages yet.</div>
                        ) : (
                            messages.map((message) => (
                                <div
                                    key={message.id}
                                    style={{
                                        marginBottom: '0.75rem',
                                        padding: '0.65rem 0.8rem',
                                        borderRadius: '12px',
                                        background: '#ffffff',
                                        border: '1px solid #e5e7eb'
                                    }}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.8rem', marginBottom: '0.25rem' }}>
                                        <strong style={{ color: '#111827' }}>{message.createdBy || 'Unknown'}</strong>
                                        <span style={{ color: '#6b7280', fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
                                            {formatMessageTime(message.createdAt)}
                                        </span>
                                    </div>
                                    <div style={{ color: '#111827', whiteSpace: 'pre-wrap', lineHeight: 1.35 }}>
                                        {message.messageText}
                                    </div>
                                </div>
                            ))
                        )}
                        <div ref={listEndRef} />
                    </div>

                    <form
                        onSubmit={handleSubmit}
                        style={{
                            ...toAbsoluteBoxStyle(textRectanglePlacement),
                            border: '1px solid #d1d5db',
                            borderRadius: '14px',
                            background: '#fff',
                            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.08)',
                            padding: '0.8rem',
                            boxSizing: 'border-box',
                            overflow: 'hidden'
                        }}
                    >
                        <label htmlFor="chat-message-text" style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 600, color: '#111827' }}>
                            Message
                        </label>
                        <textarea
                            id="chat-message-text"
                            value={draft}
                            onChange={(event) => setDraft(event.target.value)}
                            rows={3}
                            maxLength={2000}
                            placeholder="Type your message here"
                            style={{
                                width: '100%',
                                boxSizing: 'border-box',
                                border: '1px solid #cbd5e1',
                                borderRadius: '10px',
                                padding: '0.7rem 0.8rem',
                                resize: 'vertical',
                                font: 'inherit'
                            }}
                        />
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginTop: '0.6rem' }}>
                            <span style={{ color: '#6b7280', fontSize: '0.84rem' }}>{draft.trim().length}/2000</span>
                            <button
                                type="submit"
                                disabled={!draft.trim() || saving}
                                style={{
                                    border: '1px solid #9ca3af',
                                    borderRadius: '8px',
                                    background: saving ? '#e5e7eb' : '#ffffff',
                                    color: '#111827',
                                    cursor: !draft.trim() || saving ? 'not-allowed' : 'pointer',
                                    padding: '0.55rem 1rem',
                                    fontWeight: 700
                                }}
                            >
                                {saving ? 'Sending...' : 'Send'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default Chat;