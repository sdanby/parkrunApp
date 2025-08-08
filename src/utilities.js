// UTILITIES
    export const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
    export const parseDate = (dateStr) => {
        const [day, month, year] = dateStr.split('/');
        return new Date(year, month - 1, day);
    };
    export function prevSatDate(eventDate,noPrev=true) {
        const date = new Date(eventDate);       
        // Check the day of the week (0 = Sunday, 6 = Saturday)
        const dayOfWeek = date.getDay();       
        // Calculate the previous Saturday's date
        let previousSaturday; 
        // If the day is Saturday, don't rollback 
        if (dayOfWeek === 6 || !noPrev) { 
            previousSaturday = date; 
        } else { 
        // Calculate the previous Saturday's date 
        previousSaturday = new Date(date); 
        previousSaturday.setDate(date.getDate() - dayOfWeek - 1); 
        }
        //  Extract day, month, and year 
        const day = String(previousSaturday.getDate()).padStart(2, '0'); // Ensuring two digits 
        const month = String(previousSaturday.getMonth() + 1).padStart(2, '0'); // Months are zero-based, so add 1 
        const year = previousSaturday.getFullYear(); // Format the date as DD/MM/YYYY 
        const newFormattedDate = `${day}/${month}/${year}`;        
        return newFormattedDate;
    }; 
    export const formatDate = (date) => {
        const day = date.getDate().toString().padStart(2, '0');
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`; // Return formatted date
    };
    export const formatDateToDDMMYYYY = (isoDateString) => {
        const date = new Date(isoDateString); // Create a Date object from the ISO string
        const day = date.getDate().toString().padStart(2, '0'); // Extract day and pad with zero if necessary
        const month = (date.getMonth() + 1).toString().padStart(2, '0'); // Extract month and pad with zero, months are 0-based
        const year = date.getFullYear(); // Extract year
        return `${day}/${month}/${year}`; // Return formatted date as DD/MM/YYYY
    };
    export const formatDate1 = (dateStr) => {
        const [day, month, year] = dateStr.split('/');
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const formattedDate = `${day}-${monthNames[parseInt(month) - 1]}-${year.slice(-2)}`; // e.g., "12-Apr-21"
        return formattedDate;
    };
        export const formatDate2 = (dateStr) => {
        const [day, month, year] = dateStr.split('/');
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const formattedDate = `${day}${monthNames[parseInt(month) - 1]}${year.slice(-2)}`; // e.g., "12Apr21"
        return formattedDate;
    };
    export const getJulianDateNumber = (date) => {
        // Extract date components
        const day = date.getDate();
        const month = date.getMonth() + 1; // Months are zero-based in JS
        const year = date.getFullYear();
    
        // Adjust for January and February being counted as months 13 and 14 of the previous year
        const p = month <= 2 ? 1 : 0;
        const adjustedYear = year + 4716 - p; // Adjust year for the formula
    
        // Calculate Julian Day Number
        const julianDateNumber =
            day +
            Math.floor((153 * (month + 12 * (1 - p)) + 2) / 5) +
            365 * adjustedYear +
            Math.floor(adjustedYear / 4) -
            Math.floor(adjustedYear / 100) +
            Math.floor(adjustedYear / 400) -
            32045;
    
        return julianDateNumber;
    };    
    export const formatTime = (time) => {
        if (!time) return 'N/A';
    
        // Check if the time contains tenths of a second
        const parts = time.split(':');
        if (parts.length === 3) { // mm:ss:tt format
            return `${parts[0]}:${parts[1]}`; // Convert to mm:ss by dropping tenths
        } else if (parts.length === 2) { // mm:ss format
            return time; // Already in mm:ss format
        } else {
            return 'Invalid time format'; // Handle unexpected formats
        }
    }
    export const calculateStats = (athletes) => {
        const numRunners = Math.max(...athletes.map(a => a.position));
        //const numVolunteers = 0; // Temporary placeholder, fetch from the server
         
        const numPBs = athletes.filter(a => a.comment.includes('New PB!')).length;
        const numFirstTimers = athletes.filter(a => a.comment.includes('First Timer!')).length;
    
        const times = athletes.map(a => {
            const parts = a.time.split(':').map(Number);
            return parts[0] * 60 + parts[1]; // Convert time to seconds for calculation
        });
          
        const averageTimeSec = times.reduce((a, b) => a + b, 0) / times.length;
        const averageTimeMin = Math.floor(averageTimeSec / 60);
        const averageTimeSecRem = Math.round(averageTimeSec % 60);
        const avgTime = `${averageTimeMin}:${averageTimeSecRem.toString().padStart(2, '0')}`;
          
        const stddevTimeSec = Math.sqrt(times.reduce((a, b) => a + (b - averageTimeSec) ** 2, 0) / times.length);
        const stddevTimeMin = Math.floor(stddevTimeSec / 60);
        const stddevTimeSecRem = Math.round(stddevTimeSec % 60);
        const stdDevTime = `${stddevTimeMin}:${stddevTimeSecRem.toString().padStart(2, '0')}`;
     
        const ageGrades = athletes.map(a => {
            // Check if age_grade is null or an empty string
            if (!a.age_grade || typeof a.age_grade !== 'string') {
                return 50; // Default to 0 if invalid
            }    
            const ageGradeStr = a.age_grade.replace('%', ''); // Remove percentage sign
            const ageGradeNum = parseFloat(ageGradeStr);   
            // Check if parsing was successful
            return isNaN(ageGradeNum) ? 0 : ageGradeNum; // Return 0 if parse failed
        });
        const maxAge = Math.max(...ageGrades) + '%';
         const avgAge = (ageGrades.reduce((a, b) => a + b, 0) / ageGrades.length).toFixed(2) + '%';
    
        return {
            numRunners,
            //numVolunteers,
            numPBs,
            numFirstTimers,
            avgTime,
            stdDevTime,
            maxAge,
            avgAge
        };
    };
    export const extractNumber = (text) => {
        const match = text.match(/Event (\d+) needs to be loaded/);
        return match ? match[1] : null;  // If a match is found, return the number; otherwise, return null
    };
    export const getFirstWord = (text) => {
        // Ensure that `text` is a string
        if (typeof text !== 'string') {
            console.warn("Expected a string, got:", typeof text, text);
            text = String(text); // Convert to string, if possible
        }   
        // Split the string and get the first word
        const words = text.split(' '); // Split by spaces
        return words[0]; // Return the first word
    };
    export const timeToSeconds = (time) => {
        const parts = time.split(':');
        return parseInt(parts[0]) * 60 + parseInt(parts[1]); // Convert minutes to seconds and add seconds
    };
    export const secondsToTime = (seconds) => {
        const minutes = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${minutes}:${secs < 10 ? '0' + secs : secs}`; // Format seconds as mm:ss
    };
