import React, { useEffect, useState } from 'react';
import '../styles/main.css';
import './HomePage.css';
import { requestUnifiedHelp } from '../pages/UnifiedHelp';
import { createFeedbackRequest, fetchFeedbackRequests } from '../api/backendAPI';

type RequestType = 'error' | 'suggestion';

type LoggedRequest = {
    id: number;
    type: RequestType;
    title: string;
    details: string;
    dateLogged: string;
    status: string;
};

const formatDate = (value: Date): string => {
    const yyyy = value.getFullYear();
    const mm = String(value.getMonth() + 1).padStart(2, '0');
    const dd = String(value.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
};


const HomePage: React.FC = () => {
    const [requestType, setRequestType] = useState<RequestType>('error');
    const [requestTitle, setRequestTitle] = useState<string>('');
    const [requestDetails, setRequestDetails] = useState<string>('');
    const [requests, setRequests] = useState<LoggedRequest[]>([]);
    const canSubmitRequest = requestTitle.trim().length > 0 && requestDetails.trim().length > 0;
    const [requestSyncError, setRequestSyncError] = useState<string | null>(null);

    useEffect(() => {
        const loadRequests = async () => {
            try {
                const data = await fetchFeedbackRequests();
                const normalized: LoggedRequest[] = data.map((item: any, index: number) => ({
                    id: Number(item.id) || index + 1,
                    type: item.type === 'error' ? 'error' : 'suggestion',
                    title: String(item.title ?? '').trim(),
                    details: String(item.details ?? '').trim(),
                    dateLogged: String(item.dateLogged ?? formatDate(new Date())),
                    status: String(item.status ?? 'Logged')
                }));
                setRequests(normalized);
                setRequestSyncError(null);
            } catch (_err) {
                setRequestSyncError('Unable to load shared requests right now.');
            }
        };

        loadRequests();
    }, []);

    const handleSubmitRequest = async (e: React.FormEvent) => {
        e.preventDefault();
        const title = requestTitle.trim();
        const details = requestDetails.trim();
        if (!title || !details) return;

        try {
            const created = await createFeedbackRequest({ type: requestType, title, details });
            const normalizedCreated: LoggedRequest = {
                id: Number(created.id),
                type: created.type === 'error' ? 'error' : 'suggestion',
                title: String(created.title ?? title),
                details: String(created.details ?? details),
                dateLogged: String(created.dateLogged ?? formatDate(new Date())),
                status: String(created.status ?? 'Logged')
            };
            setRequests(prev => [...prev, normalizedCreated]);
            setRequestSyncError(null);
            setRequestType('error');
            setRequestTitle('');
            setRequestDetails('');
        } catch (_err) {
            setRequestSyncError('Unable to save request right now.');
        }
    };

    return (
        <div className="home-page">
            <div className="home-top-region">
                <h2>Welcome to the Parkrun App</h2>
                <p>
                    This application allows you to track your parkrun events, view event results, and analyze your performance over time.
                    <br />
                    It provides deeper analysis about the courses in your local area and ranking to compare yourself to other participants.
                    <br />
                    For those of you in a club, you can track you club statistics.
                </p>
                <h2>What makes this app different?</h2>
                <p>
                    We use bespoke analytics to adjust times for course hardness, age and sex, creating fair like-for-like rankings.
                    <br />
                    This helps you compare performance over time independent of course conditions and see whether you are improving or maintaining.
                    <br />
                    You can also benchmark against local participants and explore insights such as super-tourists, returners and consistency.
                </p>
                <p>
                    Features include:
                </p>
                <ul>
                    <li>Access to the latest event analysis - unique statistical number crunching</li>
                    <li>Deeper analysis into the participants perfomance in an event</li>
                    <li>Dynamic charting show historical participant trends</li>
                    <li>User-friendly interface for easy navigation</li>
                </ul>
                <p>
                    Last updated: <span id="last-updated">29-Apr-25</span>
                </p>
                <div className="home-help-entry">
                    <button
                        type="button"
                        className="home-help-link"
                        aria-label="Open Help Manual"
                        onClick={() => requestUnifiedHelp('top')}
                    >
                        <span className="home-help-icon" aria-hidden="true">📘</span>
                        <span>Open Help Manual</span>
                    </button>
                </div>
                <div className="home-help-entry">
                    <button
                        type="button"
                        className="home-help-link"
                        aria-label="Open Glossary"
                        onClick={() => requestUnifiedHelp('glossary')}
                    >
                        <span className="home-help-icon" aria-hidden="true">📗</span>
                        <span>Glossary</span>
                    </button>
                </div>
            </div>

            <div className="home-bottom-region">
                <h2>Log an Error or Suggestion</h2>
                {requestSyncError ? <p>{requestSyncError}</p> : null}
                <form className="home-request-form" onSubmit={handleSubmitRequest}>
                    <div className="home-request-inline-row">
                        <div className="home-request-row home-request-row-type">
                            <label htmlFor="home-request-type">Type</label>
                            <select
                                id="home-request-type"
                                value={requestType}
                                onChange={(e) => setRequestType((e.target.value === 'error' ? 'error' : 'suggestion'))}
                            >
                                <option value="error">Error</option>
                                <option value="suggestion">Suggestion</option>
                            </select>
                        </div>
                        <div className="home-request-row">
                            <label htmlFor="home-request-title">Title</label>
                            <input
                                id="home-request-title"
                                type="text"
                                value={requestTitle}
                                onChange={(e) => setRequestTitle(e.target.value)}
                                placeholder="Short title"
                                required
                            />
                        </div>
                    </div>
                    <div className="home-request-row">
                        <label htmlFor="home-request-details">Details</label>
                        <textarea
                            id="home-request-details"
                            value={requestDetails}
                            onChange={(e) => setRequestDetails(e.target.value)}
                            placeholder="Describe the issue or suggestion"
                            rows={5}
                            required
                        />
                    </div>
                    <button type="submit" className="home-request-submit" disabled={!canSubmitRequest}>Log Request</button>
                </form>

                <div className="home-request-table-container">
                    <table className="home-request-table">
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Type</th>
                                <th>Title</th>
                                <th>Details</th>
                                <th>Date</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {requests.length === 0 ? (
                                <tr>
                                    <td colSpan={6}>No requests logged yet.</td>
                                </tr>
                            ) : (
                                requests.map((request) => (
                                    <tr key={request.id}>
                                        <td>{request.id}</td>
                                        <td>{request.type === 'error' ? 'Error' : 'Suggestion'}</td>
                                        <td>{request.title}</td>
                                        <td>{request.details}</td>
                                        <td>{request.dateLogged}</td>
                                        <td>{request.status}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default HomePage;