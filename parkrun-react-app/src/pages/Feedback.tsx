import React, { useEffect, useState } from 'react';
import '../components/HomePage.css';
import {
    AuthUser,
    createFeedbackRequest,
    fetchFeedbackRequests,
    updateFeedbackRequest,
    FeedbackRequestStatus
} from '../api/backendAPI';
import {
    getErrorElementById,
    getErrorViewportForWidth,
    type ErrorPositionSpec,
    type ErrorViewport
} from '../config/layout/errorLayoutHelper';

type RequestType = 'error' | 'suggestion';
type RequestStatus = FeedbackRequestStatus;
type RequestStatusSelect = RequestStatus | 'deleted';
const AUTH_USER_KEY = 'auth_user_v1';

const STATUS_OPTIONS: Array<{ value: RequestStatusSelect; label: string }> = [
    { value: 'logged', label: 'Logged' },
    { value: 'updated', label: 'Updated' },
    { value: 'in-progress', label: 'In Progress' },
    { value: 'prioritised', label: 'Prioritised' },
    { value: 'rejected', label: 'Rejected' },
    { value: 'on-hold', label: 'On-Hold' },
    { value: 'completed', label: 'Completed' },
    { value: 'deleted', label: 'Delete Request' }
];

const STATUS_LABELS: Record<RequestStatusSelect, string> = STATUS_OPTIONS.reduce((acc, option) => {
    acc[option.value] = option.label;
    return acc;
}, {} as Record<RequestStatusSelect, string>);

const STATUS_SORT_ORDER: RequestStatus[] = [
    'in-progress',
    'prioritised',
    'updated',
    'logged',
    'on-hold',
    'rejected',
    'completed'
];

const STATUS_RANK: Record<RequestStatus, number> = STATUS_SORT_ORDER.reduce((acc, status, index) => {
    acc[status] = index;
    return acc;
}, {} as Record<RequestStatus, number>);

type LoggedRequest = {
    id: number;
    type: RequestType;
    title: string;
    details: string;
    dateLogged: string;
    lastUpdated: string;
    status: RequestStatus;
    createdBy: string;
};

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

const formatDateForApi = (value: Date): string => {
    const yyyy = value.getFullYear();
    const mm = String(value.getMonth() + 1).padStart(2, '0');
    const dd = String(value.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
};

const parseDateValue = (value: string | null | undefined): Date | null => {
    if (!value) return null;
    const trimmedValue = value.trim();
    if (!trimmedValue) return null;

    const parsed = new Date(trimmedValue);
    if (!Number.isNaN(parsed.getTime())) {
        return parsed;
    }

    const dashMatch = trimmedValue.match(/^(\d{2})-([A-Za-z]{3})-(\d{2})$/);
    if (!dashMatch) {
        return null;
    }

    const [, dd, mon, yy] = dashMatch;
    const parsedDash = new Date(`${dd}-${mon}-20${yy}`);
    return Number.isNaN(parsedDash.getTime()) ? null : parsedDash;
};

const formatDateForDisplay = (value: string | null | undefined): string => {
    const parsedDate = parseDateValue(value);
    if (!parsedDate) {
        return String(value ?? '').trim() || 'N/A';
    }

    return parsedDate.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: '2-digit'
    }).replace(/ /g, '-');
};

const normalizeStatus = (value: unknown): RequestStatus => {
    const normalized = String(value ?? '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '-') as RequestStatus;

    return STATUS_LABELS[normalized] ? normalized : 'logged';
};

const normalizeStatusSelect = (value: unknown): RequestStatusSelect => {
    const normalized = String(value ?? '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '-') as RequestStatusSelect;
    return STATUS_LABELS[normalized] ? normalized : 'logged';
};

const getViewportWidth = (): number => {
    if (typeof window === 'undefined') {
        return 1024;
    }
    return window.innerWidth;
};

const toAbsoluteBoxStyle = (placement?: ErrorPositionSpec): React.CSSProperties => ({
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

const getBottomCm = (placement?: ErrorPositionSpec): number => cmToNumber(placement?.y) + cmToNumber(placement?.height);
const getRightCm = (placement?: ErrorPositionSpec): number => cmToNumber(placement?.x) + cmToNumber(placement?.width);

const sortRequests = (items: LoggedRequest[]): LoggedRequest[] => [...items].sort((left, right) => {
    const statusDiff = (STATUS_RANK[left.status] ?? Number.MAX_SAFE_INTEGER) - (STATUS_RANK[right.status] ?? Number.MAX_SAFE_INTEGER);
    if (statusDiff !== 0) {
        return statusDiff;
    }

    const leftDate = parseDateValue(left.dateLogged)?.getTime() ?? 0;
    const rightDate = parseDateValue(right.dateLogged)?.getTime() ?? 0;
    if (leftDate !== rightDate) {
        return rightDate - leftDate;
    }

    return right.id - left.id;
});

const Feedback: React.FC = () => {
    const currentUser = getLoggedInUser();
    const isAdmin = Boolean(currentUser?.isAdmin);
    const [requestType, setRequestType] = useState<RequestType>('error');
    const [requestStatus, setRequestStatus] = useState<RequestStatusSelect>('logged');
    const [requestTitle, setRequestTitle] = useState<string>('');
    const [requestDetails, setRequestDetails] = useState<string>('');
    const [requests, setRequests] = useState<LoggedRequest[]>([]);
    const [requestSyncError, setRequestSyncError] = useState<string | null>(null);
    const [editingRequestId, setEditingRequestId] = useState<number | null>(null);
    const [viewportWidth, setViewportWidth] = useState<number>(() => getViewportWidth());
    const canSubmitRequest = requestTitle.trim().length > 0 && requestDetails.trim().length > 0;

    useEffect(() => {
        if (typeof window === 'undefined') {
            return undefined;
        }

        const handleResize = () => setViewportWidth(window.innerWidth);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        const loadRequests = async () => {
            try {
                const data = await fetchFeedbackRequests();
                const normalized: LoggedRequest[] = data.map((item: any, index: number) => ({
                    id: Number(item.id) || index + 1,
                    type: item.type === 'error' ? 'error' : 'suggestion',
                    title: String(item.title ?? '').trim(),
                    details: String(item.details ?? '').trim(),
                    dateLogged: formatDateForDisplay(String(item.dateLogged ?? formatDateForApi(new Date()))),
                    lastUpdated: formatDateForDisplay(String(item.lastUpdated ?? item.dateLogged ?? formatDateForApi(new Date()))),
                    status: normalizeStatus(item.status),
                    createdBy: String(item.createdBy ?? '').trim() || 'Unknown'
                }));
                setRequests(sortRequests(normalized));
                setRequestSyncError(null);
            } catch (_err) {
                setRequestSyncError('Unable to load shared requests right now.');
            }
        };

        loadRequests();
    }, []);

    const resetEditor = () => {
        setEditingRequestId(null);
        setRequestType('error');
        setRequestStatus('logged');
        setRequestTitle('');
        setRequestDetails('');
    };

    const handleEditRequest = (request: LoggedRequest) => {
        if (!isAdmin) {
            return;
        }
        setEditingRequestId(request.id);
        setRequestType(request.type);
        setRequestStatus(request.status);
        setRequestTitle(request.title);
        setRequestDetails(request.details);
        setRequestSyncError(null);
    };

    const handleSubmitRequest = async (e: React.FormEvent) => {
        e.preventDefault();
        const title = requestTitle.trim();
        const details = requestDetails.trim();
        if (!title || !details) return;
        if (editingRequestId !== null && !isAdmin) return;

        try {
            if (editingRequestId !== null) {
                const updated = await updateFeedbackRequest(editingRequestId, {
                    type: requestType,
                    title,
                    details,
                    status: requestStatus as RequestStatus
                });
                if (updated?.deleted) {
                    setRequests((prev) => prev.filter((request) => request.id !== editingRequestId));
                    setRequestSyncError(null);
                    resetEditor();
                    return;
                }
                const normalizedUpdated: LoggedRequest = {
                    id: Number(updated.id) || editingRequestId,
                    type: updated.type === 'error' ? 'error' : 'suggestion',
                    title: String(updated.title ?? title),
                    details: String(updated.details ?? details),
                    dateLogged: formatDateForDisplay(String(updated.dateLogged ?? formatDateForApi(new Date()))),
                    lastUpdated: formatDateForDisplay(String(updated.lastUpdated ?? updated.dateLogged ?? formatDateForApi(new Date()))),
                    status: normalizeStatus(updated.status ?? requestStatus),
                    createdBy: String(updated.createdBy ?? '').trim() || 'Unknown'
                };
                setRequests((prev) => sortRequests(prev.map((request) => (
                    request.id === editingRequestId ? normalizedUpdated : request
                ))));
            } else {
                const created = await createFeedbackRequest({ type: requestType, title, details });
                const normalizedCreated: LoggedRequest = {
                    id: Number(created.id),
                    type: created.type === 'error' ? 'error' : 'suggestion',
                    title: String(created.title ?? title),
                    details: String(created.details ?? details),
                    dateLogged: formatDateForDisplay(String(created.dateLogged ?? formatDateForApi(new Date()))),
                    lastUpdated: formatDateForDisplay(String(created.lastUpdated ?? created.dateLogged ?? formatDateForApi(new Date()))),
                    status: normalizeStatus(created.status ?? 'logged'),
                    createdBy: String(created.createdBy ?? currentUser?.displayName ?? currentUser?.email ?? '').trim() || 'Unknown'
                };
                setRequests((prev) => sortRequests([...prev, normalizedCreated]));
            }
            setRequestSyncError(null);
            resetEditor();
        } catch (_err) {
            setRequestSyncError(editingRequestId !== null ? 'Unable to update request right now.' : 'Unable to save request right now.');
        }
    };

    const viewport: ErrorViewport = getErrorViewportForWidth(viewportWidth);
    const getPlacement = (id: string): ErrorPositionSpec | undefined => getErrorElementById(id)?.[viewport];

    const headerTitlePlacement = getPlacement('error.headerTitle');
    const headerIntroPlacement = getPlacement('error.headerIntro');
    const headerNotePlacement = getPlacement('error.headerNote');
    const syncErrorPlacement = getPlacement('error.syncError');
    const editBannerPlacement = getPlacement('error.editBanner');
    const typeFieldPlacement = getPlacement('error.typeField');
    const statusFieldPlacement = getPlacement('error.statusField');
    const titleFieldPlacement = getPlacement('error.titleField');
    const detailsFieldPlacement = getPlacement('error.detailsField');
    const submitButtonPlacement = getPlacement('error.submitButton');
    const clearButtonPlacement = getPlacement('error.clearButton');
    const tableContainerPlacement = getPlacement('error.tableContainer');

    const allPlacements = [
        headerTitlePlacement,
        headerIntroPlacement,
        headerNotePlacement,
        syncErrorPlacement,
        editBannerPlacement,
        typeFieldPlacement,
        statusFieldPlacement,
        titleFieldPlacement,
        detailsFieldPlacement,
        submitButtonPlacement,
        clearButtonPlacement,
        tableContainerPlacement
    ];

    const pageHeightCm = Math.max(...allPlacements.map((placement) => getBottomCm(placement)), 0) + 0.8;
    const pageWidthCm = Math.max(...allPlacements.map((placement) => getRightCm(placement)), 0) + 0.8;
    const formHeightCm = Math.max(
        getBottomCm(typeFieldPlacement),
        getBottomCm(statusFieldPlacement),
        getBottomCm(titleFieldPlacement),
        getBottomCm(detailsFieldPlacement),
        getBottomCm(submitButtonPlacement),
        getBottomCm(clearButtonPlacement)
    ) + 0.2;

    return (
        <div className="page-content">
            <div
                className="feedback-page"
                style={{
                    position: 'relative',
                    width: `${pageWidthCm}cm`,
                    maxWidth: '100%',
                    height: `${pageHeightCm}cm`,
                    minHeight: `${pageHeightCm}cm`
                }}
            >
                <div className="feedback-page-header" style={{ ...toAbsoluteBoxStyle(headerTitlePlacement), marginBottom: 0 }}>
                    <h2 style={{ margin: 0 }}>Log an Error or Suggestion</h2>
                </div>
                <div style={toAbsoluteBoxStyle(headerIntroPlacement)}>
                    <p style={{ margin: 0 }}>
                        Use this page to capture issues, data problems, and improvement ideas in one shared list.
                    </p>
                </div>
                <div className="feedback-page-note" style={toAbsoluteBoxStyle(headerNotePlacement)}>
                    <p style={{ margin: 0 }}>
                        {isAdmin ? 'Admins can amend existing requests and update their status.' : 'You can log new requests. Existing requests can only be amended by admins.'}
                    </p>
                </div>

                {requestSyncError ? (
                    <p style={{ ...toAbsoluteBoxStyle(syncErrorPlacement), margin: 0, color: '#b91c1c' }}>{requestSyncError}</p>
                ) : null}
                {isAdmin && editingRequestId !== null ? (
                    <div className="feedback-edit-banner" style={{ ...toAbsoluteBoxStyle(editBannerPlacement), boxSizing: 'border-box' }}>
                        <span>Editing request #{editingRequestId}</span>
                        <button type="button" className="feedback-cancel-button" onClick={resetEditor}>Cancel Edit</button>
                    </div>
                ) : null}

                <form
                    className="home-request-form"
                    onSubmit={handleSubmitRequest}
                    style={{
                        position: 'absolute',
                        left: 0,
                        top: 0,
                        width: `${pageWidthCm}cm`,
                        height: `${formHeightCm}cm`,
                        marginBottom: 0
                    }}
                >
                        <div className="home-request-row home-request-row-type" style={{ ...toAbsoluteBoxStyle(typeFieldPlacement), boxSizing: 'border-box' }}>
                            <label htmlFor="feedback-request-type">Type</label>
                            <select
                                id="feedback-request-type"
                                value={requestType}
                                onChange={(e) => setRequestType(e.target.value === 'error' ? 'error' : 'suggestion')}
                            >
                                <option value="error">Error</option>
                                <option value="suggestion">Suggestion</option>
                            </select>
                        </div>
                        {isAdmin && editingRequestId !== null ? (
                            <div className="home-request-row home-request-row-status" style={{ ...toAbsoluteBoxStyle(statusFieldPlacement), boxSizing: 'border-box' }}>
                                <label htmlFor="feedback-request-status">Status</label>
                                <select
                                    id="feedback-request-status"
                                    value={requestStatus}
                                    onChange={(e) => setRequestStatus(normalizeStatusSelect(e.target.value))}
                                >
                                    {STATUS_OPTIONS.map((option) => (
                                        <option key={option.value} value={option.value}>{option.label}</option>
                                    ))}
                                </select>
                            </div>
                        ) : null}
                        <div className="home-request-row home-request-row-title" style={{ ...toAbsoluteBoxStyle(titleFieldPlacement), boxSizing: 'border-box' }}>
                            <label htmlFor="feedback-request-title">Title</label>
                            <input
                                id="feedback-request-title"
                                type="text"
                                value={requestTitle}
                                onChange={(e) => setRequestTitle(e.target.value)}
                                placeholder="Short title"
                                required
                            />
                        </div>
                    <div className="home-request-row" style={{ ...toAbsoluteBoxStyle(detailsFieldPlacement), boxSizing: 'border-box' }}>
                        <label htmlFor="feedback-request-details">Details</label>
                        <textarea
                            id="feedback-request-details"
                            value={requestDetails}
                            onChange={(e) => setRequestDetails(e.target.value)}
                            placeholder="Describe the issue or suggestion"
                            rows={5}
                            required
                        />
                    </div>
                        <button
                            type="submit"
                            className="home-request-submit"
                            disabled={!canSubmitRequest}
                            style={{
                                ...toAbsoluteBoxStyle(submitButtonPlacement),
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                textAlign: 'center',
                                whiteSpace: 'nowrap',
                                lineHeight: 1,
                                padding: '0 0.8rem'
                            }}
                        >
                            {editingRequestId !== null ? 'Update Request' : 'Log Request'}
                        </button>
                        {isAdmin && editingRequestId !== null ? (
                            <button
                                type="button"
                                className="feedback-cancel-button"
                                onClick={resetEditor}
                                style={{
                                    ...toAbsoluteBoxStyle(clearButtonPlacement),
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    textAlign: 'center',
                                    whiteSpace: 'nowrap',
                                    lineHeight: 1,
                                    padding: '0 0.8rem'
                                }}
                            >
                                Clear
                            </button>
                        ) : null}
                </form>

                <div
                    className="home-request-table-container"
                    style={{
                        ...toAbsoluteBoxStyle(tableContainerPlacement),
                        boxSizing: 'border-box',
                        display: 'flex',
                        flexDirection: 'column',
                        overflow: 'hidden'
                    }}
                >
                  <div className="home-request-table-scroll" style={{ maxHeight: '100%', height: '100%', flex: '1 1 auto', overflowX: 'auto', overflowY: 'auto', width: '100%' }}>
                    <table className="home-request-table">
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Type</th>
                                <th>Title</th>
                                <th>Details</th>
                                <th>Logged By</th>
                                <th>Date Logged</th>
                                <th>Last Updated</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {requests.length === 0 ? (
                                <tr>
                                    <td colSpan={8}>No requests logged yet.</td>
                                </tr>
                            ) : (
                                requests.map((request) => (
                                    <tr
                                        key={request.id}
                                        className={editingRequestId === request.id ? 'feedback-request-row selected' : 'feedback-request-row'}
                                        onClick={() => handleEditRequest(request)}
                                        title={isAdmin ? 'Click to edit this request' : undefined}
                                        style={{ cursor: isAdmin ? 'pointer' : 'default' }}
                                    >
                                        <td>{request.id}</td>
                                        <td>{request.type === 'error' ? 'Error' : 'Suggestion'}</td>
                                        <td>{request.title}</td>
                                        <td>{request.details}</td>
                                        <td>{request.createdBy}</td>
                                        <td>{request.dateLogged}</td>
                                        <td>{request.lastUpdated}</td>
                                        <td>{STATUS_LABELS[request.status]}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                  </div>
                </div>
            </div>
        </div>
    );
};

export default Feedback;