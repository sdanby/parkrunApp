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
                <h2>
                    Welcome to{' '}
                    <span className="home-brand-presto">
                        <img
                            src={`${process.env.PUBLIC_URL}/apple-touch-icon.png`}
                            alt=""
                            aria-hidden="true"
                            className="home-brand-presto-logo"
                        />
                        <span>PRESTO</span>
                    </span>
                </h2>
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
                <h2>Using Help Inside the App</h2>
                <p>
                    Throughout using this app, click the help icon{' '}
                    <span
                        aria-label="Page help icon"
                        role="img"
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '1.7rem',
                            height: '1.7rem',
                            border: '1px solid #b8a95a',
                            borderRadius: '999px',
                            background: '#fff8cc',
                            color: '#1f2937',
                            lineHeight: 1,
                            fontSize: '0.95rem'
                        }}
                    >
                        📖
                    </span>{' '}
                    to get more detailed page help.
                </p>
                <p>
                    You can also use the built-in help labels and table help in two other ways.
                </p>
                <ul>
                    <li>
                        Click a label such as{' '}
                        <span
                            style={{
                                display: 'inline-block',
                                padding: '0.08rem 0.55rem',
                                border: '1px solid #93c5fd',
                                borderRadius: '999px',
                                background: '#eff6ff',
                                color: '#111827',
                                fontWeight: 600,
                                lineHeight: 1.2
                            }}
                        >
                            Type:
                        </span>{' '}
                        to get access to selection help.
                    </li>
                    <li>Hold your cursor over a table column for about 3 seconds to get column help for that table.</li>
                </ul>
                <p>
                    This means help is available at three levels: page help from the main help icon, selection help from clickable labels, and column help from table headers.
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
                <h2>Parkruns Courses included in this app</h2>
                <p>
                    This app has been built with local parkrun to Essex only. This was a prototype app, and the amount of web scrapping and processes required us to keep it small enough and cheap enough for this purpose was necessary.
                    <br />
                    This can be fully expanded to analyse all parkrun but that will need a wider commitment.
                    <br />
                    As such, a number of Tourists will have very limited information on them and local participants will have no infomation on parkruns outside of the local parkruns in scope.
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