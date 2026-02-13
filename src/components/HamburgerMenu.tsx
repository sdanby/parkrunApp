import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchAllResults } from '../api/backendAPI';
import './HamburgerMenu.css';

const HamburgerMenu: React.FC = () => {
    const [open, setOpen] = useState(false);
    const navigate = useNavigate();

    const handleMenuClick = async (path: string) => {
        if (path === '/races') {
            // Seed Single Event with event_code=1 and latest date using the last_positions API
            try {
                // Use the specific API endpoint to get the latest event for event_code=1
                const response = await fetch('https://hello-world-9yb9.onrender.com/api/last_positions?event_code=1');
                if (response.ok) {
                    const lastEventData = await response.json();
                    
                    if (lastEventData && lastEventData.length > 0) {
                        // Sort by formatted_date (ISO format) to get the truly latest event
                        const sortedEvents = lastEventData.sort((a: any, b: any) => {
                            const dateA = a.formatted_date || a.event_date;
                            const dateB = b.formatted_date || b.event_date;
                            return dateB.localeCompare(dateA); // Descending order (latest first)
                        });
                        
                        // Use the original event_date (dd/mm/yyyy) for the URL parameter
                        const latestEvent = sortedEvents[0];
                        const latestDate = latestEvent.event_date || latestEvent.eventDate;
                        if (latestDate) {
                            // Navigate with the latest date
                            navigate(`/races?event_code=1&date=${encodeURIComponent(latestDate)}`);
                            setOpen(false);
                            return;
                        }
                    }
                }
            } catch (error) {
                console.warn('Could not fetch latest event data, using defaults:', error);
            }
            // Fallback to just event_code=1 if we can't get the latest date
            navigate('/races?event_code=1');
        } else {
            navigate(path);
        }
        setOpen(false);
    };

    return (
        <div className="hamburger-menu">
            <button className="hamburger-button" onClick={() => setOpen(!open)}>
                ☰
            </button>
            {open && (
                <ul className="hamburger-list">
                    <li onClick={() => handleMenuClick('/')}>Home</li>
                    <li onClick={() => handleMenuClick('/login')}>Login</li>
                    <li onClick={() => handleMenuClick('/results')}>Event Analysis</li>
                    <li onClick={() => handleMenuClick('/races')}>Single Event</li>
                    <li onClick={() => handleMenuClick('/courses')}>Courses</li>
                    <li onClick={() => handleMenuClick('/athletes')}>Athletes - Run History</li>
                    <li onClick={() => handleMenuClick('/lists')}>Lists</li>
                </ul>
            )}
        </div>
    );
};

export default HamburgerMenu;