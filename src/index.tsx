import React from 'react';
import ReactDOM from 'react-dom/client';
// Import the deprecation silencer first so it can filter React Router warnings
import './rr-deprecation-silencer';
import App from './App';
import './styles/main.css';
// Import a plain JS shim early to avoid TS parsing issues and ensure process.env exists at runtime
import './process-shim';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
);