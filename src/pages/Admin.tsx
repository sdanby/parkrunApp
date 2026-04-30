import React, { useEffect, useMemo, useState } from 'react';
import { fetchAdminActivity, fetchAdminStatus, fetchAdminUsers, fetchEventOptions, setAdminUserDefaultCourse, setAdminUserFlag, type AdminActivityRecord, type AdminUser, type EventOption } from '../api/backendAPI';
import './Admin.css';

const AUTH_TOKEN_KEY = 'auth_token_v1';
const AUTH_USER_KEY = 'auth_user_v1';

type AdminPanelSection = 'admin-setup' | 'activity';

type UserFilters = {
    email: string;
    name: string;
    athlete: string;
    created: string;
    lastLogin: string;
    admin: string;
};

type ActivityFilters = {
    when: string;
    type: string;
    user: string;
    detail: string;
    pageTime: string;
    from: string;
    device: string;
};

const formatDateTime = (value?: string | null): string => {
    if (!value) return '—';
    const dt = new Date(value);
    if (Number.isNaN(dt.getTime())) return value;
    return dt.toLocaleString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
};

const escapeForRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const matchesSqlLike = (rawValue: string, rawFilter: string): boolean => {
    const value = String(rawValue || '');
    const filter = String(rawFilter || '').trim();
    if (!filter) return true;

    if (filter.includes('%') || filter.includes('_')) {
        const regexPattern = escapeForRegex(filter)
            .replace(/%/g, '.*')
            .replace(/_/g, '.');
        return new RegExp(regexPattern, 'i').test(value);
    }

    return value.toLowerCase().includes(filter.toLowerCase());
};

const Admin: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [canAccess, setCanAccess] = useState(false);
    const [bootstrapOpen, setBootstrapOpen] = useState(false);
    const [adminCount, setAdminCount] = useState(0);
    const [users, setUsers] = useState<AdminUser[]>([]);
    const [courseOptions, setCourseOptions] = useState<EventOption[]>([]);
    const [savingUserId, setSavingUserId] = useState<number | null>(null);
    const [savingCourseUserId, setSavingCourseUserId] = useState<number | null>(null);
    const [section, setSection] = useState<AdminPanelSection>('admin-setup');
    const [activity, setActivity] = useState<AdminActivityRecord[]>([]);
    const [activityLoading, setActivityLoading] = useState(false);
    const [userFilters, setUserFilters] = useState<UserFilters>({
        email: '',
        name: '',
        athlete: '',
        created: '',
        lastLogin: '',
        admin: ''
    });
    const [activityFilters, setActivityFilters] = useState<ActivityFilters>({
        when: '',
        type: '',
        user: '',
        detail: '',
        pageTime: '',
        from: '',
        device: ''
    });
    const token = useMemo(() => localStorage.getItem(AUTH_TOKEN_KEY) || '', []);

    const normalizeAdminUsers = (rawUsers: any[]): AdminUser[] => {
        const usersList = Array.isArray(rawUsers) ? rawUsers : [];
        const normalized = usersList.map((row: any) => ({
            id: Number(row?.id),
            email: String(row?.email || ''),
            displayName: row?.displayName ?? row?.display_name ?? null,
            athleteCode: row?.athleteCode ?? row?.athlete_code ?? null,
            defaultCourseCode: row?.defaultCourseCode ?? row?.default_course_code ?? null,
            defaultCourseName: row?.defaultCourseName ?? row?.default_course_name ?? null,
            isAdmin: Boolean(row?.isAdmin ?? row?.is_admin),
            createdAt: row?.createdAt ?? row?.created_at ?? null,
            lastLoginAt: row?.lastLoginAt ?? row?.last_login_at ?? null
        }));

        try {
            const rawAuth = localStorage.getItem(AUTH_USER_KEY);
            if (!rawAuth) return normalized;
            const authUser = JSON.parse(rawAuth) || {};
            const authId = Number(authUser.id);
            const authEmail = String(authUser.email || '').toLowerCase();
            const authDefaultCode = String(authUser.defaultCourseCode || authUser.default_course_code || '').trim();
            const authDefaultName = String(authUser.defaultCourseName || authUser.default_course_name || '').trim();
            if (!authDefaultCode && !authDefaultName) return normalized;

            return normalized.map((entry) => {
                const idMatch = Number.isFinite(authId) && Number(entry.id) === authId;
                const emailMatch = authEmail && String(entry.email || '').toLowerCase() === authEmail;
                if (!idMatch && !emailMatch) return entry;

                return {
                    ...entry,
                    defaultCourseCode: entry.defaultCourseCode || authDefaultCode || null,
                    defaultCourseName: entry.defaultCourseName || authDefaultName || null
                };
            });
        } catch (_err) {
            return normalized;
        }
    };

    const loadData = async () => {
        if (!token) {
            setCanAccess(false);
            setError('Missing login session.');
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            setError(null);
            const status = await fetchAdminStatus(token);
            setCanAccess(Boolean(status.canAccessAdmin));
            setBootstrapOpen(Boolean(status.bootstrapOpen));
            setAdminCount(Number(status.adminCount || 0));

            if (!status.canAccessAdmin) {
                setUsers([]);
                return;
            }

            const response = await fetchAdminUsers(token);
            setUsers(normalizeAdminUsers(response.users));
            const options = await fetchEventOptions();
            setCourseOptions(Array.isArray(options) ? options : []);
            setAdminCount(Number(response.adminCount || 0));
            setBootstrapOpen(Boolean(response.bootstrapOpen));
        } catch (err: any) {
            setError(err?.response?.data?.error || 'Unable to load admin data.');
        } finally {
            setLoading(false);
        }
    };

    const loadActivity = async () => {
        if (!token) return;
        try {
            setActivityLoading(true);
            setError(null);
            const response = await fetchAdminActivity(token, 500);
            setActivity(Array.isArray(response.activity) ? response.activity : []);
        } catch (err: any) {
            setError(err?.response?.data?.error || 'Unable to load activity.');
        } finally {
            setActivityLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (!canAccess || section !== 'activity') {
            return;
        }
        loadActivity();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [canAccess, section]);

    const onUserFilterChange = (field: keyof UserFilters, value: string) => {
        setUserFilters((prev) => ({ ...prev, [field]: value }));
    };

    const onActivityFilterChange = (field: keyof ActivityFilters, value: string) => {
        setActivityFilters((prev) => ({ ...prev, [field]: value }));
    };

    const clearUserFilter = (field: keyof UserFilters) => {
        setUserFilters((prev) => ({ ...prev, [field]: '' }));
    };

    const clearActivityFilter = (field: keyof ActivityFilters) => {
        setActivityFilters((prev) => ({ ...prev, [field]: '' }));
    };

    const getActivityColumns = (row: AdminActivityRecord) => {
        const detail = row.activityType === 'page_visit'
            ? (row.pagePath || 'Page visit')
            : `Login${row.provider ? ` (${row.provider})` : ''}${row.success === false ? ' failed' : ' success'}`;
        const pageTime = row.durationMs != null ? `${row.durationMs} ms` : '';
        const referrerRaw = String(row.referrerPath || '').trim();
        const from = referrerRaw ? `from ${referrerRaw}` : '';
        const device = row.userAgent || (row.ipAddress ? `IP ${row.ipAddress}` : '');

        return { detail, pageTime, from, device };
    };

    const filteredUsers = useMemo(() => users.filter((row) => (
        matchesSqlLike(row.email || '', userFilters.email)
        && matchesSqlLike(row.displayName || '', userFilters.name)
        && matchesSqlLike(row.athleteCode || '', userFilters.athlete)
        && matchesSqlLike(formatDateTime(row.createdAt), userFilters.created)
        && matchesSqlLike(formatDateTime(row.lastLoginAt), userFilters.lastLogin)
        && matchesSqlLike(row.isAdmin ? 'yes' : 'no', userFilters.admin)
    )), [users, userFilters]);

    const filteredActivity = useMemo(() => activity.filter((row) => {
        const userLabel = row.displayName || row.email || 'Unknown';
        const columns = getActivityColumns(row);

        return (
            matchesSqlLike(formatDateTime(row.activityAt), activityFilters.when)
            && matchesSqlLike(String(row.activityType || ''), activityFilters.type)
            && matchesSqlLike(userLabel, activityFilters.user)
            && matchesSqlLike(columns.detail, activityFilters.detail)
            && matchesSqlLike(columns.pageTime, activityFilters.pageTime)
            && matchesSqlLike(columns.from, activityFilters.from)
            && matchesSqlLike(columns.device, activityFilters.device)
        );
    }), [activity, activityFilters]);

    const handleAdminToggle = async (row: AdminUser, checked: boolean) => {
        if (!token || savingUserId !== null) {
            return;
        }
        try {
            setSavingUserId(row.id);
            setError(null);
            const response = await setAdminUserFlag(token, row.id, checked);
            const updatedUser = response?.user;
            setUsers((prev) => prev.map((entry) => (entry.id === row.id ? { ...entry, isAdmin: Boolean(updatedUser?.isAdmin ?? checked) } : entry)));
            setAdminCount(Number(response.adminCount || 0));
            setBootstrapOpen(Boolean(response.bootstrapOpen));

            try {
                const raw = localStorage.getItem(AUTH_USER_KEY);
                if (raw) {
                    const currentUser = JSON.parse(raw) || {};
                    if (Number(currentUser.id) === Number(row.id)) {
                        localStorage.setItem(AUTH_USER_KEY, JSON.stringify({
                            ...currentUser,
                            isAdmin: Boolean(updatedUser?.isAdmin ?? checked)
                        }));
                    }
                }
            } catch (_err) {
                // ignore local storage parsing errors
            }
        } catch (err: any) {
            setError(err?.response?.data?.error || 'Unable to update admin flag.');
        } finally {
            setSavingUserId(null);
        }
    };

    const handleDefaultCourseChange = async (row: AdminUser, nextCode: string) => {
        if (!token || savingCourseUserId !== null) {
            return;
        }
        const syntheticNamePrefix = '__name__:';
        const isSyntheticName = nextCode.startsWith(syntheticNamePrefix);
        const selectedName = isSyntheticName ? nextCode.slice(syntheticNamePrefix.length) : undefined;
        const selected = courseOptions.find((opt) => opt.eventCode === nextCode);
        try {
            setSavingCourseUserId(row.id);
            setError(null);
            const response = await setAdminUserDefaultCourse(
                token,
                row.id,
                isSyntheticName ? undefined : (nextCode || undefined),
                selected?.eventName || selectedName || undefined
            );
            const updated = response?.user;
            setUsers((prev) => prev.map((entry) => (
                entry.id === row.id
                    ? {
                        ...entry,
                        defaultCourseCode: String(updated?.defaultCourseCode || ''),
                        defaultCourseName: String(updated?.defaultCourseName || '')
                    }
                    : entry
            )));
        } catch (err: any) {
            setError(err?.response?.data?.error || 'Unable to update default course.');
        } finally {
            setSavingCourseUserId(null);
        }
    };

    if (loading) {
        return <div className="page-content admin-page"><div className="admin-status">Loading admin panel...</div></div>;
    }

    if (!canAccess) {
        return <div className="page-content admin-page"><div className="admin-status">Admin page is restricted to admins.</div></div>;
    }

    return (
        <div className="page-content admin-page">
            <div className="admin-shell">
                <aside className="admin-sidebar">
                    <button
                        type="button"
                        className={section === 'admin-setup' ? 'admin-nav-btn active' : 'admin-nav-btn'}
                        onClick={() => setSection('admin-setup')}
                    >
                        Admin Set-up
                    </button>
                    <button
                        type="button"
                        className={section === 'activity' ? 'admin-nav-btn active' : 'admin-nav-btn'}
                        onClick={() => setSection('activity')}
                    >
                        Activity
                    </button>
                </aside>

                <section className="admin-main">
                    {section === 'admin-setup' ? (
                        <>
                            <h2>Admin Set-up</h2>
                            <div className="admin-meta">
                                <span>Admins: {adminCount}</span>
                                <span>{bootstrapOpen ? 'Bootstrap mode: open to all logged-in users' : 'Admin mode: restricted to admins'}</span>
                            </div>

                            {error && <div className="admin-error">{error}</div>}

                            <div className="admin-table-wrap">
                                <table className="admin-table">
                                    <thead>
                                        <tr>
                                            <th>Email</th>
                                            <th>Name</th>
                                            <th>Athlete</th>
                                            <th>Default Course</th>
                                            <th>Created</th>
                                            <th>Last Login</th>
                                            <th>Admin</th>
                                        </tr>
                                        <tr className="admin-filter-row">
                                            <th>
                                                <div className="admin-filter-cell">
                                                    <input className="admin-filter-input" value={userFilters.email} onChange={(e) => onUserFilterChange('email', e.target.value)} />
                                                    {userFilters.email && <button type="button" className="admin-filter-clear" onClick={() => clearUserFilter('email')}>x</button>}
                                                </div>
                                            </th>
                                            <th>
                                                <div className="admin-filter-cell">
                                                    <input className="admin-filter-input" value={userFilters.name} onChange={(e) => onUserFilterChange('name', e.target.value)} />
                                                    {userFilters.name && <button type="button" className="admin-filter-clear" onClick={() => clearUserFilter('name')}>x</button>}
                                                </div>
                                            </th>
                                            <th>
                                                <div className="admin-filter-cell">
                                                    <input className="admin-filter-input" value={userFilters.athlete} onChange={(e) => onUserFilterChange('athlete', e.target.value)} />
                                                    {userFilters.athlete && <button type="button" className="admin-filter-clear" onClick={() => clearUserFilter('athlete')}>x</button>}
                                                </div>
                                            </th>
                                            <th>
                                                <div className="admin-filter-cell" style={{ justifyContent: 'center' }}>
                                                    <span style={{ color: '#64748b', fontSize: '0.75rem' }}>select</span>
                                                </div>
                                            </th>
                                            <th>
                                                <div className="admin-filter-cell">
                                                    <input className="admin-filter-input" value={userFilters.created} onChange={(e) => onUserFilterChange('created', e.target.value)} />
                                                    {userFilters.created && <button type="button" className="admin-filter-clear" onClick={() => clearUserFilter('created')}>x</button>}
                                                </div>
                                            </th>
                                            <th>
                                                <div className="admin-filter-cell">
                                                    <input className="admin-filter-input" value={userFilters.lastLogin} onChange={(e) => onUserFilterChange('lastLogin', e.target.value)} />
                                                    {userFilters.lastLogin && <button type="button" className="admin-filter-clear" onClick={() => clearUserFilter('lastLogin')}>x</button>}
                                                </div>
                                            </th>
                                            <th>
                                                <div className="admin-filter-cell">
                                                    <input className="admin-filter-input" value={userFilters.admin} onChange={(e) => onUserFilterChange('admin', e.target.value)} />
                                                    {userFilters.admin && <button type="button" className="admin-filter-clear" onClick={() => clearUserFilter('admin')}>x</button>}
                                                </div>
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredUsers.length === 0 ? (
                                            <tr>
                                                <td colSpan={7} className="admin-empty">No matching users found.</td>
                                            </tr>
                                        ) : filteredUsers.map((row) => (
                                            <tr key={row.id}>
                                                <td>{row.email}</td>
                                                <td>{row.displayName || '—'}</td>
                                                <td>{row.athleteCode || '—'}</td>
                                                <td>
                                                    {(() => {
                                                        const currentCode = String(row.defaultCourseCode || '').trim();
                                                        const currentName = String(row.defaultCourseName || '').trim();
                                                        const syntheticNameValue = currentName ? `__name__:${currentName}` : '';
                                                        const hasCodeOption = currentCode
                                                            ? courseOptions.some((opt) => opt.eventCode === currentCode)
                                                            : false;
                                                        const hasNameOption = currentName
                                                            ? courseOptions.some((opt) => opt.eventName.toLowerCase() === currentName.toLowerCase())
                                                            : false;
                                                        const currentValue = currentCode
                                                            ? currentCode
                                                            : (currentName ? syntheticNameValue : '');

                                                        return (
                                                    <select
                                                        value={currentValue}
                                                        onChange={(event) => handleDefaultCourseChange(row, event.target.value)}
                                                        disabled={savingCourseUserId === row.id}
                                                        style={{ width: '100%', minWidth: 180 }}
                                                        aria-label={`Default course for ${row.email}`}
                                                    >
                                                        <option value="">Not set</option>
                                                        {currentCode && !hasCodeOption && (
                                                            <option value={currentCode}>{currentName || `Course ${currentCode}`} ({currentCode})</option>
                                                        )}
                                                        {!currentCode && currentName && !hasNameOption && (
                                                            <option value={syntheticNameValue}>{currentName}</option>
                                                        )}
                                                        {courseOptions.map((opt) => (
                                                            <option key={opt.eventCode} value={opt.eventCode}>
                                                                {opt.eventName} ({opt.eventCode})
                                                            </option>
                                                        ))}
                                                    </select>
                                                        );
                                                    })()}
                                                </td>
                                                <td>{formatDateTime(row.createdAt)}</td>
                                                <td>{formatDateTime(row.lastLoginAt)}</td>
                                                <td>
                                                    <input
                                                        type="checkbox"
                                                        checked={Boolean(row.isAdmin)}
                                                        disabled={savingUserId === row.id}
                                                        onChange={(event) => handleAdminToggle(row, event.target.checked)}
                                                        aria-label={`Set admin for ${row.email}`}
                                                    />
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    ) : (
                        <>
                            <h2>Activity</h2>
                            <div className="admin-meta">
                                <span>Rolling log</span>
                                <span>Newest first</span>
                            </div>

                            {error && <div className="admin-error">{error}</div>}

                            <div className="admin-table-wrap">
                                <table className="admin-table admin-activity-table">
                                    <thead>
                                        <tr>
                                            <th className="admin-activity-when">When</th>
                                            <th className="admin-activity-type">Type</th>
                                            <th className="admin-activity-user">User</th>
                                            <th className="admin-activity-detail">Detail</th>
                                            <th className="admin-activity-meta-1">Page Time</th>
                                            <th className="admin-activity-meta-2">from</th>
                                            <th className="admin-activity-meta-3">device</th>
                                        </tr>
                                        <tr className="admin-filter-row">
                                            <th className="admin-activity-when">
                                                <div className="admin-filter-cell">
                                                    <input className="admin-filter-input" value={activityFilters.when} onChange={(e) => onActivityFilterChange('when', e.target.value)} />
                                                    {activityFilters.when && <button type="button" className="admin-filter-clear" onClick={() => clearActivityFilter('when')}>x</button>}
                                                </div>
                                            </th>
                                            <th className="admin-activity-type">
                                                <div className="admin-filter-cell">
                                                    <input className="admin-filter-input" value={activityFilters.type} onChange={(e) => onActivityFilterChange('type', e.target.value)} />
                                                    {activityFilters.type && <button type="button" className="admin-filter-clear" onClick={() => clearActivityFilter('type')}>x</button>}
                                                </div>
                                            </th>
                                            <th className="admin-activity-user">
                                                <div className="admin-filter-cell">
                                                    <input className="admin-filter-input" value={activityFilters.user} onChange={(e) => onActivityFilterChange('user', e.target.value)} />
                                                    {activityFilters.user && <button type="button" className="admin-filter-clear" onClick={() => clearActivityFilter('user')}>x</button>}
                                                </div>
                                            </th>
                                            <th className="admin-activity-detail">
                                                <div className="admin-filter-cell">
                                                    <input className="admin-filter-input" value={activityFilters.detail} onChange={(e) => onActivityFilterChange('detail', e.target.value)} />
                                                    {activityFilters.detail && <button type="button" className="admin-filter-clear" onClick={() => clearActivityFilter('detail')}>x</button>}
                                                </div>
                                            </th>
                                            <th className="admin-activity-meta-1">
                                                <div className="admin-filter-cell">
                                                    <input className="admin-filter-input" value={activityFilters.pageTime} onChange={(e) => onActivityFilterChange('pageTime', e.target.value)} />
                                                    {activityFilters.pageTime && <button type="button" className="admin-filter-clear" onClick={() => clearActivityFilter('pageTime')}>x</button>}
                                                </div>
                                            </th>
                                            <th className="admin-activity-meta-2">
                                                <div className="admin-filter-cell">
                                                    <input className="admin-filter-input" value={activityFilters.from} onChange={(e) => onActivityFilterChange('from', e.target.value)} />
                                                    {activityFilters.from && <button type="button" className="admin-filter-clear" onClick={() => clearActivityFilter('from')}>x</button>}
                                                </div>
                                            </th>
                                            <th className="admin-activity-meta-3">
                                                <div className="admin-filter-cell">
                                                    <input className="admin-filter-input" value={activityFilters.device} onChange={(e) => onActivityFilterChange('device', e.target.value)} />
                                                    {activityFilters.device && <button type="button" className="admin-filter-clear" onClick={() => clearActivityFilter('device')}>x</button>}
                                                </div>
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {activityLoading ? (
                                            <tr>
                                                <td colSpan={7} className="admin-empty">Loading activity...</td>
                                            </tr>
                                        ) : filteredActivity.length === 0 ? (
                                            <tr>
                                                <td colSpan={7} className="admin-empty">No matching activity found.</td>
                                            </tr>
                                        ) : filteredActivity.map((row, idx) => {
                                            const userLabel = row.displayName || row.email || 'Unknown';
                                            const { detail, pageTime, from, device } = getActivityColumns(row);

                                            return (
                                                <tr key={`${row.activityAt || 'na'}-${idx}`}>
                                                    <td className="admin-activity-when" title={formatDateTime(row.activityAt)}>{formatDateTime(row.activityAt)}</td>
                                                    <td className="admin-activity-type" title={String(row.activityType || '—')}>{row.activityType}</td>
                                                    <td className="admin-activity-user" title={userLabel}>{userLabel}</td>
                                                    <td className="admin-activity-detail" title={detail}>{detail}</td>
                                                    <td className="admin-activity-meta-1" title={pageTime || '—'}>{pageTime || '—'}</td>
                                                    <td className="admin-activity-meta-2" title={from || '—'}>
                                                        <div className="admin-activity-scroll-x">{from || '—'}</div>
                                                    </td>
                                                    <td className="admin-activity-meta-3" title={device || '—'}>
                                                        <div className="admin-activity-scroll-x">{device || '—'}</div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    )}
                </section>
            </div>
        </div>
    );
};

export default Admin;
