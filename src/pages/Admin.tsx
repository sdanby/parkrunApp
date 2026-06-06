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
    day: string;
    person: string;
    device: string;
    type: string;
    typeVisit: string;
    hits: string;
    minutes: string;
};

type ActivitySummaryRow = {
    id: string;
    day: string;
    person: string;
    device: string;
    type: string;
    typeVisit: string;
    hitCount: number;
    totalDurationMs: number;
    rows: AdminActivityRecord[];
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

const formatDay = (value?: string | null): string => {
    if (!value) return 'Unknown day';
    const dt = new Date(value);
    if (Number.isNaN(dt.getTime())) return String(value).slice(0, 10) || 'Unknown day';
    return dt.toLocaleDateString('en-CA');
};

const formatDurationTotalMinutes = (durationMs: number): string => {
    const safeMs = Number.isFinite(durationMs) ? Math.max(0, Math.round(durationMs)) : 0;
    const totalMinutes = safeMs / 60000;
    return `${totalMinutes.toFixed(2)} min`;
};

const inferDeviceLabel = (userAgent?: string | null): string => {
    const ua = String(userAgent || '').toLowerCase();
    if (!ua) return 'Unknown';
    if (ua.includes('ipad') || ua.includes('tablet')) return 'Tablet';
    if (ua.includes('iphone') || ua.includes('android') || ua.includes('mobile')) return 'Mobile';
    return 'Desktop';
};

const getTypeVisitLabel = (row: AdminActivityRecord): string => {
    const activityType = String(row.activityType || '').toLowerCase();
    if (activityType !== 'page_visit') {
        return activityType || 'other';
    }

    const path = String(row.pagePath || '').trim().toLowerCase();
    if (!path) return 'unknown';
    if (path.startsWith('/races') || path.startsWith('/event_test')) return 'races';
    if (path.startsWith('/admin')) return 'admin';
    if (path.startsWith('/feedback')) return 'feedback';
    if (path.startsWith('/results') || path.startsWith('/results_test')) return 'results';
    if (path.startsWith('/lists')) return 'lists';
    if (path.startsWith('/clubs')) return 'clubs';
    if (path.startsWith('/courses') || path.startsWith('/courses_test')) return 'course';
    if (path.startsWith('/athletes')) return 'participants';
    if (path.startsWith('/login')) return 'login';
    return path.replace(/^\//, '').split('/')[0] || 'other';
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
        day: '',
        person: '',
        device: '',
        type: '',
        typeVisit: '',
        hits: '',
        minutes: ''
    });
    const [selectedSummaryRow, setSelectedSummaryRow] = useState<ActivitySummaryRow | null>(null);
    const [selectedDetailRow, setSelectedDetailRow] = useState<AdminActivityRecord | null>(null);
    const oneMonthStartIso = useMemo(() => {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
        return start.toISOString();
    }, []);
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
            const response = await fetchAdminActivity(token, 5000, oneMonthStartIso);
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
    }, [canAccess, oneMonthStartIso, section]);

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
        const pageTime = row.durationMs != null ? formatDurationTotalMinutes(Number(row.durationMs || 0)) : '';
        const referrerRaw = String(row.referrerPath || '').trim();
        const from = referrerRaw ? `from ${referrerRaw}` : '';
        const device = row.userAgent || (row.ipAddress ? `IP ${row.ipAddress}` : '');

        return { detail, pageTime, from, device };
    };

    const selectedDetailColumns = useMemo(() => {
        if (!selectedDetailRow) return null;
        return getActivityColumns(selectedDetailRow);
    }, [selectedDetailRow]);

    const selectedDetailDeviceCapture = useMemo(() => {
        if (!selectedDetailRow) return [] as Array<{ label: string; value: string }>;

        const inferredDevice = inferDeviceLabel(selectedDetailRow.userAgent);
        const userAgent = String(selectedDetailRow.userAgent || '').trim() || '—';
        const ipAddress = String(selectedDetailRow.ipAddress || '').trim() || '—';
        const referrerPath = String(selectedDetailRow.referrerPath || '').trim() || '—';
        const provider = String(selectedDetailRow.provider || '').trim() || '—';
        const activityType = String(selectedDetailRow.activityType || '').trim() || '—';
        const success = selectedDetailRow.success == null
            ? '—'
            : (selectedDetailRow.success ? 'true' : 'false');
        const durationMs = selectedDetailRow.durationMs == null
            ? '—'
            : `${Math.max(0, Number(selectedDetailRow.durationMs || 0))} ms`;

        return [
            { label: 'Inferred device', value: inferredDevice },
            { label: 'User agent', value: userAgent },
            { label: 'IP address', value: ipAddress },
            { label: 'Referrer path', value: referrerPath },
            { label: 'Provider', value: provider },
            { label: 'Activity type', value: activityType },
            { label: 'Success', value: success },
            { label: 'Duration (raw)', value: durationMs }
        ];
    }, [selectedDetailRow]);

    const filteredUsers = useMemo(() => users.filter((row) => (
        matchesSqlLike(row.email || '', userFilters.email)
        && matchesSqlLike(row.displayName || '', userFilters.name)
        && matchesSqlLike(row.athleteCode || '', userFilters.athlete)
        && matchesSqlLike(formatDateTime(row.createdAt), userFilters.created)
        && matchesSqlLike(formatDateTime(row.lastLoginAt), userFilters.lastLogin)
        && matchesSqlLike(row.isAdmin ? 'yes' : 'no', userFilters.admin)
    )), [users, userFilters]);

    const windowedActivity = useMemo(() => activity.filter((row) => {
        const activityAtMs = new Date(row.activityAt || '').getTime();
        const windowStartMs = new Date(oneMonthStartIso).getTime();
        if (Number.isFinite(activityAtMs) && Number.isFinite(windowStartMs) && activityAtMs < windowStartMs) {
            return false;
        }
        return true;
    }), [activity, oneMonthStartIso]);

    const aggregatedRows = useMemo<ActivitySummaryRow[]>(() => {
        const buckets = new Map<string, ActivitySummaryRow>();

        for (const row of windowedActivity) {
            const day = formatDay(row.activityAt);
            const person = row.displayName || row.email || 'Unknown';
            const device = inferDeviceLabel(row.userAgent);
            const type = String(row.activityType || 'unknown');
            const typeVisit = getTypeVisitLabel(row);
            const id = [day, person, device, type, typeVisit].join('|');

            if (!buckets.has(id)) {
                buckets.set(id, {
                    id,
                    day,
                    person,
                    device,
                    type,
                    typeVisit,
                    hitCount: 0,
                    totalDurationMs: 0,
                    rows: []
                });
            }

            const bucket = buckets.get(id)!;
            bucket.hitCount += 1;
            bucket.totalDurationMs += Number(row.durationMs || 0);
            bucket.rows.push(row);
        }

        const sorted = Array.from(buckets.values()).sort((a, b) => {
            if (a.day !== b.day) return b.day.localeCompare(a.day);
            if (a.person !== b.person) return a.person.localeCompare(b.person);
            if (a.device !== b.device) return a.device.localeCompare(b.device);
            if (a.type !== b.type) return a.type.localeCompare(b.type);
            return a.typeVisit.localeCompare(b.typeVisit);
        });

        for (const row of sorted) {
            row.rows.sort((a, b) => {
                const left = new Date(a.activityAt || '').getTime();
                const right = new Date(b.activityAt || '').getTime();
                return (Number.isFinite(left) ? left : 0) - (Number.isFinite(right) ? right : 0);
            });
        }

        return sorted;
    }, [windowedActivity]);

    const filteredAggregatedRows = useMemo(() => {
        return aggregatedRows.filter((row) => (
            matchesSqlLike(row.day, activityFilters.day)
            && matchesSqlLike(row.person, activityFilters.person)
            && matchesSqlLike(row.device, activityFilters.device)
            && matchesSqlLike(row.type, activityFilters.type)
            && matchesSqlLike(row.typeVisit, activityFilters.typeVisit)
            && matchesSqlLike(String(row.hitCount), activityFilters.hits)
            && matchesSqlLike(formatDurationTotalMinutes(row.totalDurationMs), activityFilters.minutes)
        ));
    }, [activityFilters.day, activityFilters.device, activityFilters.hits, activityFilters.minutes, activityFilters.person, activityFilters.type, activityFilters.typeVisit, aggregatedRows]);

    const selectedSummaryTitle = useMemo(() => {
        if (!selectedSummaryRow) return '';

        const summarizeUnique = (values: string[]) => {
            const unique = Array.from(new Set(values.map((item) => String(item || '').trim() || 'unknown')));
            return unique.length === 1 ? unique[0] : 'All';
        };

        const dateValue = summarizeUnique(selectedSummaryRow.rows.map((row) => formatDay(row.activityAt)));
        const userValue = summarizeUnique(selectedSummaryRow.rows.map((row) => row.displayName || row.email || 'Unknown'));
        const typeValue = summarizeUnique(selectedSummaryRow.rows.map((row) => String(row.activityType || 'unknown')));
        const deviceValue = summarizeUnique(selectedSummaryRow.rows.map((row) => inferDeviceLabel(row.userAgent)));
        const typeVisitValue = summarizeUnique(selectedSummaryRow.rows.map((row) => getTypeVisitLabel(row)));

        return `Date: ${dateValue}; User: ${userValue}; Type: ${typeValue}; Device: ${deviceValue}; type-visit: ${typeVisitValue}`;
    }, [selectedSummaryRow]);

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
                                <span>Showing at least one month (from start of previous month)</span>
                            </div>

                            <div className="admin-activity-filter-inline">
                                <input className="admin-filter-input" placeholder="day" value={activityFilters.day} onChange={(e) => onActivityFilterChange('day', e.target.value)} />
                                <input className="admin-filter-input" placeholder="person" value={activityFilters.person} onChange={(e) => onActivityFilterChange('person', e.target.value)} />
                                <input className="admin-filter-input" placeholder="device" value={activityFilters.device} onChange={(e) => onActivityFilterChange('device', e.target.value)} />
                                <input className="admin-filter-input" placeholder="type" value={activityFilters.type} onChange={(e) => onActivityFilterChange('type', e.target.value)} />
                                <input className="admin-filter-input" placeholder="type-visit" value={activityFilters.typeVisit} onChange={(e) => onActivityFilterChange('typeVisit', e.target.value)} />
                                <input className="admin-filter-input" placeholder="total hits" value={activityFilters.hits} onChange={(e) => onActivityFilterChange('hits', e.target.value)} />
                                <input className="admin-filter-input" placeholder="total minutes" value={activityFilters.minutes} onChange={(e) => onActivityFilterChange('minutes', e.target.value)} />
                            </div>

                            {error && <div className="admin-error">{error}</div>}

                            <div className="admin-table-wrap">
                                <table className="admin-table admin-activity-summary-table">
                                    <thead>
                                        <tr>
                                            <th>Day</th>
                                            <th>Person</th>
                                            <th>Device</th>
                                            <th>Type</th>
                                            <th>Type-visit</th>
                                            <th>Total Hits</th>
                                            <th>Total Minutes</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {activityLoading ? (
                                            <tr>
                                                <td colSpan={7} className="admin-empty">Loading activity...</td>
                                            </tr>
                                        ) : filteredAggregatedRows.length === 0 ? (
                                            <tr>
                                                <td colSpan={7} className="admin-empty">No matching activity found.</td>
                                            </tr>
                                        ) : filteredAggregatedRows.map((row) => (
                                            <tr
                                                key={row.id}
                                                className="admin-summary-row"
                                                onClick={() => setSelectedSummaryRow(row)}
                                                role="button"
                                                tabIndex={0}
                                                onKeyDown={(event) => {
                                                    if (event.key === 'Enter' || event.key === ' ') {
                                                        event.preventDefault();
                                                        setSelectedSummaryRow(row);
                                                    }
                                                }}
                                                aria-label={`Open details for ${row.day} ${row.person} ${row.typeVisit}`}
                                            >
                                                <td title={row.day}>{row.day}</td>
                                                <td title={row.person}>{row.person}</td>
                                                <td title={row.device}>{row.device}</td>
                                                <td title={row.type}>{row.type}</td>
                                                <td title={row.typeVisit}>{row.typeVisit}</td>
                                                <td>{row.hitCount}</td>
                                                <td>{formatDurationTotalMinutes(row.totalDurationMs)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {selectedSummaryRow && (
                                <div className="admin-activity-modal-backdrop" onMouseDown={(event) => {
                                    if (event.target === event.currentTarget) {
                                        setSelectedDetailRow(null);
                                        setSelectedSummaryRow(null);
                                    }
                                }}>
                                    <div className="admin-activity-modal" role="dialog" aria-modal="true" aria-label="Activity detail">
                                        <div className="admin-activity-modal-head">
                                            <strong>{selectedSummaryTitle}</strong>
                                            <button
                                                type="button"
                                                className="admin-activity-modal-close"
                                                onClick={() => {
                                                    setSelectedDetailRow(null);
                                                    setSelectedSummaryRow(null);
                                                }}
                                                aria-label="Close detail"
                                            >
                                                x
                                            </button>
                                        </div>
                                        <div className="admin-table-wrap admin-activity-modal-table-wrap">
                                            <table className="admin-table admin-activity-detail-table">
                                                <thead>
                                                    <tr>
                                                        <th>Time</th>
                                                        <th>Detail</th>
                                                        <th>Page Time</th>
                                                        <th>from</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {selectedSummaryRow.rows.length === 0 ? (
                                                        <tr>
                                                            <td colSpan={4} className="admin-empty">No detail rows found.</td>
                                                        </tr>
                                                    ) : selectedSummaryRow.rows.map((row, idx) => {
                                                        const columns = getActivityColumns(row);
                                                        return (
                                                            <tr
                                                                key={`${selectedSummaryRow.id}-${idx}`}
                                                                className="admin-detail-row"
                                                                onClick={() => setSelectedDetailRow(row)}
                                                                role="button"
                                                                tabIndex={0}
                                                                onKeyDown={(event) => {
                                                                    if (event.key === 'Enter' || event.key === ' ') {
                                                                        event.preventDefault();
                                                                        setSelectedDetailRow(row);
                                                                    }
                                                                }}
                                                                aria-label={`Open full detail for ${formatDateTime(row.activityAt)}`}
                                                            >
                                                                <td title={formatDateTime(row.activityAt)}>{formatDateTime(row.activityAt)}</td>
                                                                <td title={columns.detail}>{columns.detail}</td>
                                                                <td title={columns.pageTime || '—'}>{columns.pageTime || '—'}</td>
                                                                <td title={columns.from || '—'}>{columns.from || '—'}</td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {selectedDetailRow && selectedDetailColumns && (
                                <div className="admin-activity-modal-backdrop admin-activity-submodal-backdrop" onMouseDown={(event) => {
                                    if (event.target === event.currentTarget) {
                                        setSelectedDetailRow(null);
                                    }
                                }}>
                                    <div className="admin-activity-modal admin-activity-submodal" role="dialog" aria-modal="true" aria-label="Full activity detail">
                                        <div className="admin-activity-modal-head">
                                            <strong>Full Detail and Device Capture</strong>
                                            <button type="button" className="admin-activity-modal-close" onClick={() => setSelectedDetailRow(null)} aria-label="Close full detail">x</button>
                                        </div>
                                        <div className="admin-activity-submodal-content">
                                            <div className="admin-activity-submodal-section">
                                                <h3>Full detail</h3>
                                                <div className="admin-activity-full-detail-box" title={selectedDetailColumns.detail}>{selectedDetailColumns.detail || '—'}</div>
                                            </div>

                                            <div className="admin-activity-submodal-section">
                                                <h3>Detailed device capture</h3>
                                                <div className="admin-activity-device-grid">
                                                    {selectedDetailDeviceCapture.map((item) => (
                                                        <React.Fragment key={item.label}>
                                                            <div className="admin-activity-device-label">{item.label}</div>
                                                            <div className="admin-activity-device-value" title={item.value}>{item.value}</div>
                                                        </React.Fragment>
                                                    ))}
                                                </div>
                                            </div>

                                            <div className="admin-activity-submodal-section">
                                                <h3>Record context</h3>
                                                <div className="admin-activity-device-grid">
                                                    <div className="admin-activity-device-label">Time</div>
                                                    <div className="admin-activity-device-value">{formatDateTime(selectedDetailRow.activityAt)}</div>
                                                    <div className="admin-activity-device-label">Page time</div>
                                                    <div className="admin-activity-device-value">{selectedDetailColumns.pageTime || '—'}</div>
                                                    <div className="admin-activity-device-label">From</div>
                                                    <div className="admin-activity-device-value" title={selectedDetailColumns.from || '—'}>{selectedDetailColumns.from || '—'}</div>
                                                    <div className="admin-activity-device-label">Raw device</div>
                                                    <div className="admin-activity-device-value" title={selectedDetailColumns.device || '—'}>{selectedDetailColumns.device || '—'}</div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </section>
            </div>
        </div>
    );
};

export default Admin;
