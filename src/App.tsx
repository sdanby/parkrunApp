import React from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import HamburgerMenu from './components/HamburgerMenu';
import Home from './pages/Home';
import Login from './pages/Login';
import Results from './pages/Results';
import Courses from './pages/Courses';
import Athletes from './pages/Athletes';
import './styles/main.css';

const headings: { [key: string]: string } = {
    '/': 'Home',
    '/login': 'Login',
    '/results': 'Event Analysis',
    '/courses': 'Courses',
    '/athletes': 'Athletes'
};

const TopBar: React.FC = () => {
    const location = useLocation();
    const heading = headings[location.pathname] || '';
    return (
        <div className="top-bar" style={{ display: 'flex', alignItems: 'center', padding: '10px 0' }}>
            <HamburgerMenu />
            <h1 style={{ marginLeft: '2cm', marginTop: '0.5cm',fontSize: '1.5em' }}>{heading}</h1>
        </div>
    );
};

const App: React.FC = () => {
    return (
        <Router>
            <TopBar />
            <div className="app">
                <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/results" element={<Results />} />
                    <Route path="/courses" element={<Courses />} />
                    <Route path="/athletes" element={<Athletes />} />
                </Routes>
            </div>
        </Router>
    );
};

export default App;
