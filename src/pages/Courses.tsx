import React, { useEffect, useState } from 'react';
import { fetchCoursesData } from '../api/backendAPI';

// Define the course type
type Course = {
    id: number;
    name: string;
    description: string;
};

const Courses: React.FC<{ heading: string }> = ({ heading }) => {
    const [courses, setCourses] = useState<Course[]>([]);

    useEffect(() => {
        const getCourses = async () => {
            try {
                const data = await fetchCoursesData();
                setCourses(data);
            } catch (error) {
                console.error('Error fetching courses:', error);
            }
        };

        getCourses();
    }, []);

    return (
        <div className="page-content">
            <h1 style={{ marginLeft: '20px', fontSize: '1.5em' }}>{heading}</h1>

            <ul>
                {courses.map(course => (
                    <li key={course.id}>
                        <h2>{course.name}</h2>
                        <p>{course.description}</p>
                    </li>
                ))}
            </ul>
        </div>
    );
};

export default Courses;