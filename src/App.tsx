import React from 'react';
import { createBrowserRouter, RouterProvider, Outlet, useLocation } from 'react-router-dom';
import HamburgerMenu from './components/HamburgerMenu';
import Home from './pages/Home';
import Login from './pages/Login';
import Results from './pages/Results';
import Races from './pages/Races';
import Courses from './pages/Courses';
import Athletes from './pages/Athletes';
import './styles/main.css';

const headings: { [key: string]: string } = {
    '/': 'Home',
    '/login': 'Login',
    '/results': 'Event Analysis',
    '/races': 'Races',
    '/courses': 'Courses',
    '/athletes': 'Athletes'
};

const TopBar: React.FC = () => {
    const location = useLocation();
    const heading = headings[location.pathname] || '';
    return (
        <div className="top-bar" style={{  padding: '0px 0' }}>
            <HamburgerMenu />
            <h1 style={{ marginLeft: '2cm', marginTop: '0.8cm', fontSize: '1.5em' }}>{heading}</h1>
        </div>
    );
};

const RootLayout: React.FC = () => (
    <>
        <TopBar />
        <div className="app">
            <Outlet />
        </div>
    </>
);

// Build router options with a lenient `any` type so we can pass
// future flags that the installed router type definitions may not
// yet include (this silences runtime deprecation warnings).
const _futureOptions: any = { future: { v7_relativeSplatPath: true, v7_startTransition: true } };

const router = createBrowserRouter([
    {
        path: '/',
        element: <RootLayout />,
        children: [
            { index: true, element: <Home /> },
            { path: 'login', element: <Login /> },
            { path: 'results', element: <Results /> },
            { path: 'races', element: <Races /> },
            { path: 'courses', element: <Courses /> },
            { path: 'athletes', element: <Athletes /> }
        ]
    }
], _futureOptions);

const App: React.FC = () => {
    return (
        <RouterProvider router={router} />
    );
};

export default App;
