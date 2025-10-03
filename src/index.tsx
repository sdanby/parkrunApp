import React from 'react';
import ReactDOM from 'react-dom/client';
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