import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import HamburgerMenu from './components/HamburgerMenu';
//import Home from './pages/Home';
//import Login from './pages/Login';
//import Results from './pages/Results';
//import Courses from './pages/Courses';
//import Athletes from './pages/Athletes';
import './styles/main.css';

const App: React.FC = () => {
    return (
        <Router>
            <div className="app">
                <HamburgerMenu />
                <Routes>

                </Routes>
            </div>
        </Router>
    );
};

export default App;
//                      <Route path="/" element={<Home />} />
//                    <Route path="/login" element={<Login />} />
//                    <Route path="/results" element={<Results />} />
//                    <Route path="/courses" element={<Courses />} />
//                    <Route path="/athletes" element={<Athletes />} />
