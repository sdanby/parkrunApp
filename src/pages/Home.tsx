import React from 'react';
import HomePage from '../components/HomePage';
import HamburgerMenu from '../components/HamburgerMenu';

const Home: React.FC = () => {
    return (
        <div className="page-content">
            <HamburgerMenu />
            <HomePage />
        </div>
    );
};

export default Home;