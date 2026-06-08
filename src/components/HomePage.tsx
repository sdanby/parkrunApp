import React from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/main.css';
import './HomePage.css';
import { requestUnifiedHelp } from '../pages/UnifiedHelp';


const HomePage: React.FC = () => {
    const navigate = useNavigate();

    return (
        <div className="home-page home-page-welcome">
            <div className="home-top-region home-top-region-welcome">
                <h2>Welcome to the Parkrun App</h2>
                <p>
                    This application allows you to track your parkrun events, view event results, and analyze your performance over time.
                    <br />
                    It provides deeper analysis about the courses in your local area and ranking to compare yourself to other participants.
                    <br />
                    For those of you in a club, you can track your club statistics.
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
                    Last updated: <span id="last-updated">June 26</span>


                </p>
                 <h2>Laptop v Mobile</h2>
                <p>
                    This app was initially built for the laptop and then adapted for the mobile.
                    <br />
                    The same functionality is available on both devices but for serious analysis and usage, the laptop will be more rewarding.
                    <br />
                   <br />
                   For further help and detail click on the links below:
                </p>
                <p></p>
                <div className="home-help-entry">
                    <button
                        type="button"
                        className="home-help-link"
                        aria-label="Getting started"
                        onClick={() => requestUnifiedHelp('section-getting-started')}
                    >
                        <span className="home-help-icon" aria-hidden="true">🚀</span>
                        <span>Getting Started</span>
                    </button>
                </div>
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
                <div className="home-help-entry">
                    <button
                        type="button"
                        className="home-help-link"
                        aria-label="Open Error and Suggestion Log"
                        onClick={() => navigate('/feedback')}
                    >
                        <span className="home-help-icon" aria-hidden="true">📝</span>
                        <span>Log an Error or Suggestion</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default HomePage;