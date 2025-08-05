import React, { useState } from 'react';

const LoginPage: React.FC = () => {
    const [athleteCode, setAthleteCode] = useState('');
    const [password, setPassword] = useState('');
    const [homeCourse, setHomeCourse] = useState('');

    const handleLogin = () => {
        // Logic to handle login using backendAPI
        console.log('Logging in with:', { athleteCode, password, homeCourse });
    };

    return (
        <div className="login-page" >
            <div>
                <label htmlFor="athleteCode">Athlete Code:</label>
                <input
                    type="text"
                    id="athleteCode"
                    value={athleteCode}
                    onChange={(e) => setAthleteCode(e.target.value)}
                />
            </div>
            <div>
                <label htmlFor="password">Password:</label>
                <input
                    type="password"
                    id="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                />
            </div>
            <div>
                <label htmlFor="homeCourse">Home Course:</label>
                <input
                    type="text"
                    id="homeCourse"
                    value={homeCourse}
                    onChange={(e) => setHomeCourse(e.target.value)}
                />
            </div>
            <button onClick={handleLogin}>Login</button>
        </div>
    );
};

export default LoginPage;