import React, { useEffect, useState } from 'react';
import { fetchResults } from '../api/backendAPI';
import '../styles/ResultsPage.css'; // Import the CSS file

const ResultsPage: React.FC = () => {
    const [results, setResults] = useState<any[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const getResults = async () => {
            try {
                const data = await fetchResults();
                // Apply URL-driven filtering for participant pages
                const params = new URLSearchParams(window.location.search);
                const type = params.get('type');
                const filter = params.get('filter');

                let filtered = data;
                if (type === 'participants' && filter === 'Super Tourist') {
                    // Mirror Tourist behaviour but using super_tourist flag
                    filtered = data.filter((r: any) => !!r.super_tourist);
                }

                setResults(filtered);
            } catch (err) {
                setError('Failed to fetch results');
            } finally {
                setLoading(false);
            }
        };

        getResults();
    }, []);

    if (loading) {
        return <div style={{ marginTop: '80px' }}>Loading...</div>;
    }

    if (error) {
        return <div style={{ marginTop: '60px' }}>{error}</div>;
    }

    return (
        <div className="page-content">
            <h1>Latest Event Results</h1>
            <ul>
                {results.map((result) => (
                    <li key={result.id}>
                        {result.event_name} - {result.date}: {result.position} - {result.name}
                    </li>
                ))}
            </ul>
        </div>
    );
};

export default ResultsPage;
