import React, { useEffect, useState } from 'react';
import { fetchAthleteData } from '../api/backendAPI';

// Define the athlete type
type Athlete = {
    id: number;
    name: string;
    history: string;
    comparison: string;
};

const Athletes: React.FC = () => {
    const [athletes, setAthletes] = useState<Athlete[]>([]);

    useEffect(() => {
        const getAthleteData = async () => {
            try {
                const data = await fetchAthleteData();
                setAthletes(data);
            } catch (error) {
                console.error('Error fetching athlete data:', error);
            }
        };

        getAthleteData();
    }, []);

    return (
        <div className="page-content">
            <h1>Athletes</h1>
            <ul>
                {athletes.map((athlete) => (
                    <li key={athlete.id}>
                        <h2>{athlete.name}</h2>
                        <p>History: {athlete.history}</p>
                        <p>Comparison: {athlete.comparison}</p>
                    </li>
                ))}
            </ul>
        </div>
    );
};

export default Athletes;