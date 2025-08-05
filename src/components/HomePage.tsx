import React from 'react';
import '../styles/main.css';

const HomePage: React.FC = () => {
    return (
        <div className="home-page" >
            <h1>Welcome to the Parkrun App</h1>
            <p>
                This application allows you to track your parkrun events, view results, and analyze your performance over time.
            </p>
            <p>
                Features include:
            </p>
            <ul>
                <li>Access to the latest event results</li>
                <li>Historical analysis of courses</li>
                <li>View athlete history and comparisons</li>
                <li>User-friendly interface for easy navigation</li>
            </ul>
            <p>
                Last updated: <span id="last-updated">[Insert Last Updated Date Here]</span>
            </p>
        </div>
    );
};

export default HomePage;