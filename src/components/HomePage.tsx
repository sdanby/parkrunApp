import React from 'react';
import '../styles/main.css';
import './HomePage.css';

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
                Last updated: <span id="last-updated">28-Dec-25</span>
            </p>

            <section className="features-section">
                <h2>Features & Issues to be addressed</h2>

                <div className="feature-table-container" aria-label="Features and issues list">
                    <table className="feature-table">
                        <thead>
                            <tr>
                                <th style={{width: '4rem'}}>No</th>
                                <th>Description</th>
                                <th style={{width: '8rem'}}>Type</th>
                                <th style={{width: '8rem'}}>Date Logged</th>
                                <th style={{width: '8rem'}}>Status</th>
                                <th style={{width: '8rem'}}>Date Complete</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td>1</td>
                                <td>Need to get the number of parkruns from the page collection per athlete - may have to rebuild from all pages again.
                                    1) will need to capture the new data historically in eventpositions table - as a one-off exercise
                                    2) then capture ongoing updates as part of regular data updates
                                    3) then update the athlete table to hold the total runs and when last updated
                                </td>
                                <td>enhancement</td>
                                <td>27-Dec-25</td>
                                <td>Complete</td>
                                <td>10-Jan-26</td>
                            </tr>
                            <tr>
                                <td>2</td>
                                <td>Is it possible to collect volunteers per event and store them by athlete code. Will require looping through scraping</td>
                                <td>enhancement</td>
                                <td>28-Dec-25</td>
                                <td>Complete</td>
                                <td>10-Jan-26</td>
                            </tr>
                            <tr>
                                <td>3</td>
                                <td>Add more data to Single Event page - make it toggleable.</td>
                                <td>enhancement</td>
                                <td>28-Dec-25</td>
                                <td>Complete</td>
                                <td>15-Jan-26</td>
                            </tr>
                            <tr>
                                <td>4</td>
                                <td>Make it filterable within Single Event page to reduce the number of athletes displayed.</td>
                                <td>enhancement</td>
                                <td>28-Dec-25</td>
                                <td>Complete</td>
                                <td>15-Jan-26</td>
                            </tr>
                            <tr>
                                <td>5</td>
                                <td>Link an athlete from Single Event - to show athlete's statistics.</td>
                                <td>enhancement</td>
                                <td>28-Dec-25</td>
                                <td>Pending</td>
                                <td>-</td>
                            </tr>
                            <tr>
                                <td>6</td>
                                <td>Link and event name from both Event Analysis and Single Event to a page for per event.</td>
                                <td>enhancement</td>
                                <td>28-Dec-25</td>
                                <td>Pending</td>
                                <td>-</td>
                            </tr>
                            <tr>
                                <td>7</td>
                                <td>Create a new Type in Event Analysis which shows deviation to average both actual and percentage</td>
                                <td>enhancement</td>
                                <td>28-Dec-25</td>
                                <td>Pending</td>
                                <td>-</td>
                            </tr>
                            <tr>
                                <td>8</td>
                                <td>The following enhancements to Event Analysis: 1) AggregatePeriods: Average, Median, Total, Range, Max and Min
                                    2) Improve the Help text 3) Age and Time need to work with the filter options 4) Times needs to work with hardness - see Time Adj
                                </td>
                                <td>enhancement</td>
                                <td>31-Dec-25</td>
                                <td>Pending</td>
                                <td>-</td>
                            </tr>
                            <tr>
                                <td>9</td>
                                <td>Need to be able to select an event or a date from the Single Event page - Should default to Brentwood and latest.
                                </td>
                                <td>enhancement</td>
                                <td>31-Dec-25</td>
                                <td>Pending</td>
                                <td>-</td>
                            </tr>
                            <tr>
                                <td>10</td>
                                <td>Single Event Page Hamburger - goes behind the table
                                </td>
                                <td>error</td>
                                <td>31-Dec-25</td>
                                <td>Pending</td>
                                <td>-</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
    );
};

export default HomePage;