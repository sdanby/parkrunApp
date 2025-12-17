import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './HamburgerMenu.css';

const HamburgerMenu: React.FC = () => {
    const [open, setOpen] = useState(false);
    const navigate = useNavigate();

    const handleMenuClick = (path: string) => {
        navigate(path);
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
                    <li onClick={() => handleMenuClick('/results')}>Events</li>
                    <li onClick={() => handleMenuClick('/races')}>Races</li>
                    <li onClick={() => handleMenuClick('/courses')}>Courses</li>
                    <li onClick={() => handleMenuClick('/athletes')}>Athletes</li>
                </ul>
            )}
        </div>
    );
};

export default HamburgerMenu;