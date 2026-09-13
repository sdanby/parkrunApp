from __future__ import annotations

import itertools
from flask import Flask, jsonify, request
from scripts.database_helpers import connections, update_coefficients,with_sections,flatten_sql,debug_sql_render_named,get_single_section_sql
from datetime import datetime,timedelta
import numpy as np  # Import numpy for numerical calculations
from collections import defaultdict
from psycopg2.extras import execute_values,execute_batch
#app = Flask(__name__)
#app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///C:/Users/stevi/flask-backend/myapp/parkrun.db'
#db = SQLAlchemy(app)

import csv

def to_yyyy_mm_dd(date_str):
    """Convert DD/MM/YYYY to YYYY-MM-DD"""
    return datetime.strptime(date_str, "%d/%m/%Y").strftime("%Y-%m-%d")
def to_dd_mm_yyyy(date_str):
    """Convert YYYY-MM-DD to DD/MM/YY"""
    dt = datetime.strptime(date_str, "%Y-%m-%d")
    return dt.strftime("%d/%m/%Y")
def write_to_csv(data, filename="C:/Users/stevi/Documents/output.csv"):
    """
    Write data to a CSV file.
    :param data: A list of dictionaries or rows to write to the CSV.
    :param filename: The name of the CSV file.
    """
    try:
        # Open the file in write mode
        with open(filename, mode='w', newline='', encoding='utf-8') as file:
            # Create a CSV writer object
            writer = csv.writer(file)

            # If data is a list of dictionaries, write headers and rows
            if isinstance(data, list) and isinstance(data[0], dict):
                # Write the header row
                writer.writerow(data[0].keys())
                # Write the data rows
                for row in data:
                    writer.writerow(row.values())
            else:
                # If data is a list of lists, write rows directly
                for row in data:
                    writer.writerow(row)

        print(f"Data successfully written to {filename}")
    except Exception as e:
        print(f"Error writing to CSV: {e}")
def timeToSeconds(time_str):
    """Convert a time string in mm:ss or hh:mm:ss format to total seconds."""
    if time_str:
        parts = list(map(int, time_str.split(':')))
        if len(parts) == 2:
            minutes, seconds = parts
            return minutes * 60 + seconds
        elif len(parts) == 3:
            hours, minutes, seconds = parts
            return hours * 3600 + minutes * 60 + seconds
    return 0  # Return 0 if time_str is None or invalid
def secondsToTime(seconds):
    """
    Convert time in seconds to a formatted string in mm:ss format.
    :param seconds: Time in seconds (integer or float).
    :return: Formatted time string in mm:ss.
    """
    try:
        minutes = int(seconds // 60)  # Calculate the number of minutes
        remaining_seconds = int(seconds % 60)  # Calculate the remaining seconds
        return f"{minutes}:{remaining_seconds:02d}"  # Format as mm:ss
    except Exception as e:
        print(f"Error in secondsToTime: {e}")
        return "00:00"  # Return a default value in case of an error   
def safe_replace_year(dt, new_year):
    try:
        return dt.replace(year=new_year)
    except ValueError:
        # Handle Feb 29 for non-leap years
        if dt.month == 2 and dt.day == 29:
            return dt.replace(year=new_year, day=28)
        raise
def calculate_standard_deviations(pivot, timeType='time', eligible_only=False):
    """Calculate standard deviations for each athlete."""
    standard_deviations = {}
    for athlete_code, events in pivot.items():
        times = [
            event[timeType]
            for event in events.values()
            if (timeType in event and isinstance(event[timeType], (int, float)))  # Ensure timeType exists and is numeric
            and (not eligible_only or event['eligible'])  # Apply eligibility filter
        ]
        # Calculate standard deviation for the times
        if len(times) == 0:
            standard_deviations[athlete_code] = None
        elif len(times) == 1:
            standard_deviations[athlete_code] = None 
        else:
            stdev = np.std(times) / np.mean(times)*1000
            standard_deviations[athlete_code] = stdev
        #if (athlete_code == '45587' and timeType == 'adjtime'):
            #print("times", times)
            #print("stdev",stdev)
            #write_to_csv(standard_deviations, filename=f"C:/Users/stevi/StdDev.csv")
            #print("Standard deviations:", standard_deviations[athlete_code])

    return standard_deviations
def calculate_weighted_mean_stdev(new_stdevs, counts):
    """
    Calculate the weighted mean of standard deviations.
    :param new_stdevs: Dictionary of standard deviations for each athlete.
    :param counts: Dictionary of event counts for each athlete.
    :return: Weighted mean of standard deviations.
    """
    weighted_sum = 0
    total_count = 0

    for athlete_code, stdev in new_stdevs.items():
        count = counts.get(athlete_code, 0)  # Get the count for the athlete, default to 0
        if stdev is not None and count > 0: 
            weighted_sum += stdev * count  # Multiply stdev by the count
            total_count += count  # Sum the counts

    # Avoid division by zero
    if total_count == 0:
        return 0
    return weighted_sum / total_count  # Return the weighted mean
def calculate_average_coefficient(event_date, event_code, week_count):
    """
    Calculate the average coefficient for a given event_code over a date range.
    :param event_date: The starting event date (format: 'YYYY-MM-DD').
    :param event_code: The event code to filter by.
    :param week_count: The number of weeks to include in the date range.
    :return: The average coefficient or None if no data is found.
    """
    try:
        # Connect to the database
        conn, cursor, _, _ = connections()

        # Convert event_date to the correct format (YYYY-MM-DD)
        formatted_event_date = datetime.strptime(event_date, '%d/%m/%Y').strftime('%Y-%m-%d')

        # Calculate the start date based on the week_count
        start_date = (datetime.strptime(event_date, '%d/%m/%Y') - timedelta(days=7 * week_count)).strftime('%Y-%m-%d')

        # Define the SQL query
        query = f'''
            SELECT AVG(coeff) AS avg_coeff
            FROM parkrun_events
            WHERE event_code = ?
            AND DATE(SUBSTR(event_date, 7, 4) || '-' || SUBSTR(event_date, 4, 2) || '-' || SUBSTR(event_date, 1, 2)) >= ?
            AND DATE(SUBSTR(event_date, 7, 4) || '-' || SUBSTR(event_date, 4, 2) || '-' || SUBSTR(event_date, 1, 2)) <= ?;
        '''

        # Execute the query
        cursor.execute(query, (event_code, start_date, formatted_event_date))

        # Fetch the result
        result = cursor.fetchone()
        avg_coeff = result[0] if result else None
        print(f"Average coefficient for event_code {event_code} from {start_date} to {event_date}: {avg_coeff}")
        # Close the database connection
        conn.close()

        return avg_coeff

    except Exception as e:
        print(f"Error calculating average coefficient: {e}")
        return None
def normalize_coefficients( up_to_date):
    """
    Normalize coefficients in the parkrun_events table so that the lowest coefficient up to the given date is 1,
    and all other coefficients are proportionally higher.
    :param up_to_date: The date up to which coefficients should be normalized (format: YYYY-MM-DD).
    """
    try:
        # Connect to the database
        conn, sqlite_cursor, render_db_conn, render_cursor = connections()
        formatted_date = datetime.strptime(up_to_date, '%d/%m/%Y').strftime('%Y-%m-%d')
        # Step 1: Find the lowest coefficient up to the given date
        sqlite_cursor.execute('''
            SELECT MIN(coeff) AS min_coeff
            FROM parkrun_events
        ''')
        # WHERE DATE(substr(event_date, 7, 4) || '-' || substr(event_date, 4, 2) || '-' || substr(event_date, 1, 2)) <= ?

        result = sqlite_cursor.fetchone()
        min_coeff = result[0]
        if not min_coeff:
            print("No coefficients found up to the given date.")
            return
        print(f"Lowest coefficient up to {formatted_date}: {min_coeff}")

        #if min_coeff >1:
        if min_coeff >0:
            min_coeff=1.0
        # Step 2: Update all coefficients by dividing them by the lowest coefficient
        sqlite_cursor.execute('''
            UPDATE parkrun_events
            SET coeff = coeff / ?
            WHERE DATE(substr(event_date, 7, 4) || '-' || substr(event_date, 4, 2) || '-' || substr(event_date, 1, 2)) <= ?
        ''', (min_coeff, formatted_date))
        # Commit the changes
        sqlite_cursor.connection.commit()
        print(f"Coefficients normalized up to {formatted_date}. All coefficients are now proportional to the lowest coefficient.")
        render_cursor.execute('''
            UPDATE parkrun_events
            SET coeff = coeff / %s
			WHERE TO_DATE(event_date, 'DD-MM-YYYY') <= %s
        ''', (min_coeff, formatted_date))
        render_cursor.connection.commit()
        print(f"PostgreSQL: Coefficients normalized up to {formatted_date}.")

        # Close the database connection
        conn.close()
    except Exception as e:
        print(f"Error normalizing coefficients: {e}")
def fetch_coefficients(event_date):
    """
    Fetch coefficients for all event_codes on the given event_date from the parkrun_events table.
    :param event_date: The event date to filter by.
    :return: A dictionary of {event_code: coeff}.
    """
    try:
        # Connect to the database
        conn, cursor, _, _ = connections()

        # Query to fetch coefficients for the given event_date
        cursor.execute('''
            SELECT event_code, coeff
            FROM parkrun_events
            WHERE event_date = ?
        ''', (event_date,))

        # Fetch the results
        rows = cursor.fetchall()

        # Close the database connection
        conn.close()

        # Convert the results into a dictionary
        return {row[0]: row[1] for row in rows}

    except Exception as e:
        print(f"Error fetching coefficients: {e}")
        return {}
def fetch_all_coefficients(event_dates):
    """
    Fetch coefficients for all event_dates in a single query.
    :param event_dates: A set of event dates to filter by.
    :return: A dictionary of {event_date: {event_code: coeff}}.
    """
    try:
        # Connect to the database
        conn, cursor, _, _ = connections()

        # Convert event_dates to a tuple for use in the SQL query
        event_dates_tuple = tuple(event_dates)

        # Query to fetch coefficients for all event_dates
        query = f'''
            SELECT event_date, event_code, coeff
            FROM parkrun_events
            WHERE event_date IN ({','.join(['?'] * len(event_dates_tuple))})
        '''
        cursor.execute(query, event_dates_tuple)

        # Fetch the results
        rows = cursor.fetchall()

        # Close the database connection
        conn.close()

        # Convert the results into a nested dictionary
        coeffs = {}
        for event_date, event_code, coeff in rows:
            if event_date not in coeffs:
                coeffs[event_date] = {}
            coeffs[event_date][event_code] = coeff

        return coeffs

    except Exception as e:
        print(f"Error fetching coefficients: {e}")
        return {}    
def fetch_event_data(startDate):
    print("Fetching event data")
    try:
        # Connect to your database
        conn, cursor, render_db_conn, render_cursor = connections()
        print("Start date for coefficients:", startDate)
        # Define your SQL query
        cursor.execute('''
        WITH first_15_dates AS (
            SELECT DISTINCT event_date 
            FROM parkrun_events
            WHERE date(substr(event_date, 7, 4) || '-' || substr(event_date, 4, 2) || '-' || substr(event_date, 1, 2)) >= date(?)
            ORDER BY date(substr(event_date, 7, 4) || '-' || substr(event_date, 4, 2) || '-' || substr(event_date, 1, 2))
            LIMIT 15)
        SELECT event_code, event_date, time, athlete_code 
        FROM eventpositions
        WHERE event_date IN (SELECT event_date FROM first_15_dates)
        ORDER BY athlete_code;
        ''',(startDate,))

        # Fetch the data
        rows = cursor.fetchall()   
        #print("Rows fetched:", len(rows))     
        columns = [column[0] for column in cursor.description]
        data = [dict(zip(columns, row)) for row in rows]

        # Initialize structures for processing the data
        pivot = {}
        lowest_times = {}
        counts = {}
        #standard_deviations = {}

        # Fetch coefficients for all event dates
        event_dates = {event['event_date'] for event in data}
        coeffs = fetch_all_coefficients(event_dates)
        #print("Coefficients fetched for event dates:", coeffs.keys())
        for event in data:
            athlete_code = event['athlete_code']
            event_date = event['event_date']
            time = event['time']
            event_code = event['event_code']
            #print(f"Processing athlete_code: {athlete_code}, event_date: {event_date}, time: {time}, event_code: {event_code}")

            if athlete_code not in pivot:
                pivot[athlete_code] = {}
                lowest_times[athlete_code] = time
                counts[athlete_code] = 1
            else:
                # Update lowest time
                if time < lowest_times[athlete_code]:
                    lowest_times[athlete_code] = time
                counts[athlete_code] += 1
            #print(f"Current lowest time for athlete_code {athlete_code}: {lowest_times[athlete_code]}")
            # Store the time in seconds alongside the event code for reference
            time_in_seconds = timeToSeconds(time)       
            #print(f"Storing time for athlete_code: {athlete_code}, event_date: {event_date}, time_in_seconds: {time_in_seconds}, event_code: {event_code}")    
            pivot[athlete_code][event_date] = {
                'time': time_in_seconds,  # Store time in seconds
                'adjtime': time_in_seconds,  # Store time in seconds
                'event': event_code,  # Store event code
                'display': f"{time} ({event_code})", # Store formatted time for display
                'adjDisplay': f"{time} ({event_code})",  # Store formatted time for display
                'eligible': True  # Include a flag for eligibility
            }
            #print("Success")    
        #print("Pivot data constructed with athletes and events:", len(pivot))
        # Recalculate adjusted times using stored coefficients
        for event_date, event_coeffs in coeffs.items():
            for event_code, coeff in event_coeffs.items():
                recalcTimes(pivot, event_date, event_code, coeff)
        #print("Adjusted times recalculated using coefficients.")
        standard_deviations_all_actual = calculate_standard_deviations(pivot, 'time')
        standard_deviations_eligible_actual = calculate_standard_deviations(pivot, 'time', eligible_only=True)
        stdevs_all_adjusted = calculate_standard_deviations(pivot, 'adjtime')
        stdevs_eligible_adjusted = calculate_standard_deviations(pivot, 'adjtime', eligible_only=True)
        #print("Standard deviations calculated for adjusted and actual times.")
        response_data = {
            'pivot': pivot,
            'lowest_times': lowest_times,
            'counts': counts,
            'counts_eligible': {
                athlete_code: sum(1 for event in events.values() if event['eligible'])
                for athlete_code, events in pivot.items()
            },
            'stdDev_all_actual': standard_deviations_all_actual,
            'stdDev_eligible_actual': standard_deviations_eligible_actual,
            'stdDev_all_adjusted': stdevs_all_adjusted,
            'stdDev_eligible_adjusted': stdevs_eligible_adjusted
        }
        #print("Response data count:", response_data['counts_eligible'])
        # Close the database connection
        conn.close()

        return jsonify(response_data), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500  
def get_transformed_event_data(pivot, lowest_times, counts, cutoff=None):
    """Transform the pivot data based on the cutoff and return the result."""
    print("Transforming event data")
    try:
        countElig = {}
        # Apply cutoff filtering if specified
        print("cutoff", cutoff)
        if cutoff is not None and 2.0 <= cutoff <= 9.9:
            for athlete_code in list(pivot.keys()):  # Using list() to allow modification during iteration
                time_limit = timeToSeconds(lowest_times[athlete_code]) * (1 + cutoff / 100)

                # Initialize count for the current athlete after filtering
                current_count = 0
                elig_count=0

                # Filter out entries based on cutoff
                #print("transformed", list(pivot[athlete_code].keys()))
                for event_date in list(pivot[athlete_code].keys()):  # Updated to use keys directly
                    event_data = pivot[athlete_code][event_date]
                    event_time_in_seconds = event_data['time']  # Access the new time value
                    if event_time_in_seconds > time_limit:
                        #del pivot[athlete_code][event_date]  # Remove entry exceeding limit
                        event_data['eligible']=False  # Remove entry exceeding limit
                    else:
                        # Increment the count for valid entries
                        elig_count += 1
                    current_count += 1

                # Update the counts dictionary with the new count
                counts[athlete_code] = current_count
                countElig[athlete_code] = elig_count
        else:
            countElig=counts.copy()  # If no cutoff, copy counts directly
        # Prepare the response data

        standard_deviations_all_adjusted = calculate_standard_deviations(pivot, 'adjtime')
        standard_deviations_eligible_adjusted = calculate_standard_deviations(pivot, 'adjtime', eligible_only=True)
        standard_deviations_all_actual = calculate_standard_deviations(pivot, 'time')
        standard_deviations_eligible_actual = calculate_standard_deviations(pivot, 'time', eligible_only=True)

        response_data = {
            'pivot': pivot,
            'lowest_times': lowest_times,
            'counts': counts,
            'counts_eligible': countElig,
       #     'counts_eligible': {
       #         athlete_code: sum(1 for event in events.values() if event['eligible'])
       #         for athlete_code, events in pivot.items()
       #     },
            'stdDev_all_adjusted': standard_deviations_all_adjusted,
            'stdDev_eligible_adjusted': standard_deviations_eligible_adjusted,
            'stdDev_all_actual': standard_deviations_all_actual,
            'stdDev_eligible_actual': standard_deviations_eligible_actual
        }
        print('count=',sum(counts.values()),'countElig=',sum(countElig.values()))
        
        return response_data
    except Exception as e:
        print(f"Error in get_transformed_event_data: {e}")
        raise   
def recalcTimes(pivot_data, event_date, event_code, coeff):
    """Recalculate event times based on the specified event date and event code."""
    try:
        recalculated_times = {}  # Store recalculated times for all matching events

        for athlete_code, events in pivot_data.items():
            if event_date in events:
                if events[event_date]['event'] == event_code:
                    # Update 'adjtime' using the current coefficient
                    events[event_date]['adjtime'] = events[event_date]['time'] / coeff
                    events[event_date]['adjDisplay']=f"{secondsToTime(events[event_date]['adjtime']) } ({event_code})"

    except Exception as e:
        print(f"Error in recalcTimes: {e}")
        raise
def optimize_event_times_logic(pivot_data, change_value, event_date, counts,sqlite_cursor, render_cursor):
    """
    Optimize event times by adjusting the coefficient (coeff) to minimize the weighted standard deviation.
    Loops through all event_codes for the given event_date and stores coefficients for each event_code.
    """
    try:
        # Initialize a dictionary to store coefficients for each event_code
        coeffs = fetch_coefficients(event_date)
        print("==============================================")
        print("Optimizing starting")
        # Extract all unique event_codes for the given event_date
        event_codes = set(
            event_data['event']
            for athlete_code, events in pivot_data.items()
            for date, event_data in events.items()
            if date == event_date and 'event' in event_data
        )
        print("Event codes:", event_codes)
        print(f"Event_date: {event_date}, Event_codes: {event_codes}")
        print(f"Initial coefficients: {coeffs}") 

        # Check for event_codes in coefficients but not in event_codes
        for event_code in coeffs.keys():
            if event_code not in event_codes:
                # If the event_code is missing from event_codes, set its coefficient to None
                print(f"Event_code {event_code} is missing from event_codes. Setting coeff to None.")
                coeffs[event_code] = None

        # Loop through each event_code
        for event_code in event_codes:
            print(f"Optimizing for event_code: {event_code} on event_date: {event_date}")
               # Check if there are any athletes for this event_code on the given event_date
            athletes_for_event = [
                athlete_code
                for athlete_code, events in pivot_data.items()
                if event_date in events and events[event_date]['event'] == event_code
            ]

            if not athletes_for_event:
                # If no athletes are found, set the coefficient to None and skip optimization
                print(f"No athletes found for event_code {event_code} on event_date {event_date}. Setting coeff to None.")
                coeffs[event_code] = None
                continue  # Skip to the next event_code

            # need to calculate the previous averge coeff
            avg_coeff = calculate_average_coefficient(event_date, event_code, 15)
             # Initialize variables for optimization
            #coeff = coeffs[event_code]  # Start with an initial coefficient
            coeff = avg_coeff  # Start with an initial coefficient
            #print("pre-std",calculate_standard_deviations(pivot_data,'adjtime',eligible_only=True))
            recalcTimes(pivot_data,event_date,event_code,coeff)
            #for athlete_code, events in itertools.islice(pivot_data.items(), 2):
            #    print(f"Athlete Code: {athlete_code}, Events: {events}")
            new_stdevs = calculate_standard_deviations(pivot_data,'adjtime',eligible_only=True)
            original_stdev_weighted = calculate_weighted_mean_stdev(new_stdevs, counts)  # Compute mean stdev
            improved = True  # Flag to control the optimization loop
            first=True
            direction = 1  # 1 for increasing coeff, -1 for decreasing coeff
            print(f"Initial coefficient {coeff} and standard deviation {original_stdev_weighted}")    
            coeff +=change_value  # Initial coefficient value
            # Optimization loop for the current event_code
            while improved:
                    improved = False
                    recalcTimes(pivot_data,event_date,event_code,coeff)
                    # Calculate new standard deviations
                    new_stdevs = calculate_standard_deviations(pivot_data,'adjtime',eligible_only=True)
                    new_stdev_weighted = calculate_weighted_mean_stdev(new_stdevs, counts)
                    # Compare the new stdev with the original stdev weighted
                    print(f"event_code: {event_code}, New coefficient1: {coeff}, new stdev: {new_stdev_weighted}, original stdev: {original_stdev_weighted}")
                    if new_stdev_weighted < original_stdev_weighted:
                        # If new stdev is lower, we take the current coeff and prepare for the next iteration
                        improved = True
                        original_stdev_weighted = new_stdev_weighted
                        coeff += change_value * direction  # Update the coefficient
                        first=False
                    else:
                        # If no improvement, break the loop
                        print(f"Optimization complete for direction: {direction} on first: {first}")
                        if direction==1 and first:
                            direction = -1
                            coeff += change_value * direction*2
                            improved = True
                        else:
                            improved = False
                            if direction==1:
                                coeff -=change_value
                            else:
                                coeff +=change_value  
                    #################################################  
                            if coeff < 1:
                                coeff = 1.0;
                            recalcTimes(pivot_data,event_date,event_code,coeff)
            print(f"event_code: {event_code},New coefficient2: {coeff}, new stdev: {new_stdev_weighted}, original stdev: {original_stdev_weighted}")
            coeffs[event_code] = coeff  # Store the optimized coefficient for the current event_code
        print(f"coeff matrix: {coeffs}")
        for athlete_code, events in pivot_data.items():
            for ev_date, event_data in events.items():
                time = event_data['adjtime']
                ev_code = event_data['event']
                if ev_code == event_code and ev_date == event_date:
                    pivot_data[athlete_code][ev_date]['display'] = f"{int(time // 60)}:{int(time % 60):02d} ({ev_code})"  # Update the display field
                    pivot_data[athlete_code][ev_date]['adjtime'] = time # Update the display field


        new_stdevs_all_adjusted = calculate_standard_deviations(pivot_data, 'adjtime')
        new_stdevs_eligible_adjusted = calculate_standard_deviations(pivot_data, 'adjtime', eligible_only=True)
        new_stdevs_all_actual = calculate_standard_deviations(pivot_data, 'time')
        new_stdevs_eligible_actual = calculate_standard_deviations(pivot_data, 'time', eligible_only=True)

        new_stdevs = calculate_standard_deviations(pivot_data,'adjtime',eligible_only=True)
        original_stdev_weighted = calculate_weighted_mean_stdev(new_stdevs, counts)  # Compute mean stdev
        print("==============================================")
        #print(f"New coefficient3: {coeff}, new stdev: {original_stdev_weighted}")
        # Recalculate adjusted times using stored coefficients
       

        # Return the optimized results as a response
        response_data = {
            'pivot': pivot_data,

            'lowest_times': {
                athlete_code: secondsToTime(np.min([event['time'] for event in events.values()]))
                for athlete_code, events in pivot_data.items() if events
            },
            'counts': {
                athlete_code: len(events)
                for athlete_code, events in pivot_data.items()
            },
            'counts_eligible': {
                athlete_code: sum(1 for event in events.values() if event['eligible'])
                for athlete_code, events in pivot_data.items()
            },
            'stdDev_all_adjusted': new_stdevs_all_adjusted,
            'stdDev_eligible_adjusted': new_stdevs_eligible_adjusted,
            'stdDev_all_actual': new_stdevs_all_actual,
            'stdDev_eligible_actual': new_stdevs_eligible_actual,
            'coefficients': coeffs
        }
        update_coefficients(sqlite_cursor, render_cursor, response_data['coefficients'], event_date)

        return response_data  # Return a plain dictionary
    except Exception as e:
        print(f"Error in optimize_event_times_logic: {e}")
        raise
def coeffStartDate():
    try:
        # Connect to your database
        conn, cursor, render_db_conn, render_cursor = connections()

        # Define your SQL query
        cursor.execute('''
        SELECT COALESCE(
            (SELECT DATE(MIN(DATE(SUBSTR(event_date, 7, 4) || '-' || SUBSTR(event_date, 4, 2) || '-' || SUBSTR(event_date, 1, 2))) , '-98 days')
            FROM parkrun_events
            WHERE coeff <> 1.0),
            (SELECT DATE(MIN(DATE(SUBSTR(event_date, 7, 4) || '-' || SUBSTR(event_date, 4, 2) || '-' || SUBSTR(event_date, 1, 2))))
            FROM parkrun_events)
        ) AS date_15_weeks_earlier;
            ''')
        rows = cursor.fetchall()

        # Close the database connection
        conn.close()

        # Convert the results into a dictionary
        return rows[0][0] if rows else None

    except Exception as e:
        print(f"Error fetching coefficients: {e}")
        return None

def copy_table_to_postgres(
    table_name,
    key_columns,
    fields,
    earliest_date=None,
    date_column="event_date",
    date_is_iso: bool = False,
    updateOnly: bool = False,
    exact_date: bool = False,
    start_date: str = None,
    end_date: str = None,
    event_code: int = None,
 ):
    """
    Generic function to copy specified fields from SQLite to PostgreSQL for all rows
    in a table from earliest_date onwards (inclusive), matching on key columns.
    :param table_name: Name of the table (e.g. 'parkrun_events', 'eventpositions')
    :param key_columns: List of key columns for WHERE clause (e.g. ['event_code', 'event_date', 'event_number'])
    :param fields: List of field names to copy (e.g. ['coeff', 'obs'])
    :param earliest_date: string, format 'YYYY-MM-DD'
    :param date_column: Name of the date column (default 'event_date')
    """
    conn, cursor, render_db_conn, render_cursor = connections()

    # Safety guard: eventpositions requires `position` for inserts/upserts.
    # Some ad-hoc callers omit it in `fields`, which causes NOT NULL violations.
    if table_name == "eventpositions":
        normalized_keys = {str(c).lower() for c in key_columns}
        normalized_fields = {str(c).lower() for c in fields}
        if "position" not in normalized_keys and "position" not in normalized_fields:
            fields = ["position", *list(fields)]
            try:
                print("copy_table_to_postgres: auto-added required field 'position' for eventpositions.")
            except Exception:
                pass

    select_fields = ", ".join(key_columns + fields)
    update_set = ", ".join([f"{field} = %s" for field in fields])
    # Use >= for the date key so the update/where logic matches the SELECT date_filter semantics
    where_clause_parts = []
    for col in key_columns:
        if col == date_column:
            where_clause_parts.append(f"{col} >= %s")
        else:
            where_clause_parts.append(f"{col} = %s")
    where_clause = " AND ".join(where_clause_parts)

    # Build the date filter for the main date column.
    # If exact_date is True, copy/overwrite only rows for the supplied date (equality).
    # Otherwise preserve historical behavior (>= earliest_date).
    if exact_date:
        if date_is_iso:
            date_filter = f"{date_column} = ?"
        else:
            date_filter = f"substr({date_column}, 7, 4) || '-' || substr({date_column}, 4, 2) || '-' || substr({date_column}, 1, 2) = ?"
    else:
        if date_is_iso:
            # date is already in ISO format YYYY-MM-DD (or comparable); use direct comparison
            date_filter = f"{date_column} >= ?"
        else:
            # default: date in DD/MM/YYYY format stored as text; convert to ISO for comparison
            date_filter = f"substr({date_column}, 7, 4) || '-' || substr({date_column}, 4, 2) || '-' || substr({date_column}, 1, 2) >= ?"

    # If caller hasn't provided an earliest_date or an explicit start/end range,
    # fall back to a very early date so the SELECT returns rows rather than
    # raising a TypeError when callers omitted the required parameter in older code.
    if earliest_date is None and (start_date is None or end_date is None):
        # Only warn when the caller truly omitted an earliest_date and no range supplied
        if start_date is None and end_date is None:
            try:
                print(f"Warning: copy_table_to_postgres called without earliest_date; defaulting to '1900-01-01'.")
            except Exception:
                pass
            earliest_date = '1900-01-01'

    # If explicit start_date/end_date are provided use those to build the selection
    # range. Otherwise, if a per-event selected range table exists in SQLite
    # (`tmp_selected_eventRange`), use that to select rows within each event's
    # start/end date range. This allows updating all rows for an event between
    # start_date and end_date.
    # prepare a human-readable range for logging when rows are empty
    display_range = earliest_date

    try:
        has_range = False
        try:
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='tmp_selected_eventRange';")
            has_range = bool(cursor.fetchone())
        except Exception:
            has_range = False

        # Build optional event_code filter (restrict selection when provided)
        event_filter = ""
        if event_code is not None:
            try:
                ec = int(event_code)
                event_filter = f" AND {table_name}.event_code = {ec}"
            except Exception:
                # if casting fails, ignore the filter
                event_filter = ""

        if start_date is not None and end_date is not None:
            # use the provided start/end values (assumed ISO YYYY-MM-DD)
            rng_start = start_date
            rng_end = end_date
            display_range = f"{rng_start}..{rng_end}"
            # build a date expression for the target table's date column
            if date_is_iso:
                date_expr = f"{table_name}.{date_column}"
            else:
                date_expr = f"(substr({table_name}.{date_column}, 7, 4) || '-' || substr({table_name}.{date_column}, 4, 2) || '-' || substr({table_name}.{date_column}, 1, 2))"
            select_sql = f"SELECT {select_fields} FROM {table_name} WHERE {date_expr} BETWEEN '{rng_start}' AND '{rng_end}'{event_filter} ORDER BY {', '.join(key_columns)}"
            cursor.execute(select_sql)
        elif has_range:
            # build a date expression for the target table's date column (convert DD/MM/YYYY to ISO when needed)
            if date_is_iso:
                date_expr = f"{table_name}.{date_column}"
            else:
                date_expr = f"(substr({table_name}.{date_column}, 7, 4) || '-' || substr({table_name}.{date_column}, 4, 2) || '-' || substr({table_name}.{date_column}, 1, 2))"

            # join on event_code if present in key_columns, otherwise join on any matching column names
            if 'event_code' in key_columns:
                join_on = f"{table_name}.event_code = tmp_selected_eventRange.event_code"
            else:
                # fallback: try to join on the first key column
                join_on = f"{table_name}.{key_columns[0]} = tmp_selected_eventRange.{key_columns[0]}"

            select_sql = f"SELECT {select_fields} FROM {table_name} JOIN tmp_selected_eventRange ON {join_on} WHERE {date_expr} BETWEEN tmp_selected_eventRange.start_date AND tmp_selected_eventRange.end_date{event_filter} ORDER BY {', '.join(key_columns)}"
            cursor.execute(select_sql)
        else:
            cursor.execute(f"""
        SELECT {select_fields}
        FROM {table_name}
        WHERE {date_filter}{event_filter}
        ORDER BY {', '.join(key_columns)}
    """, (earliest_date,))
    except Exception as e:
        # fallback to original single-table select on error
        try:
            cursor.execute(f"""
        SELECT {select_fields}
        FROM {table_name}
        WHERE {date_filter}{event_filter}
        ORDER BY {', '.join(key_columns)}
    """, (earliest_date,))
        except Exception:
            raise
    rows = cursor.fetchall()

    try:
        mode_label = "updateOnly" if updateOnly else "upsert"
        range_label = display_range if 'display_range' in locals() and display_range is not None else earliest_date
        print(
            f"copy_table_to_postgres: table={table_name}, mode={mode_label}, "
            f"selected_rows={len(rows)}, range={range_label}, exact_date={exact_date}, "
            f"event_code={event_code if event_code is not None else 'all'}"
        )
    except Exception:
        pass

    # Attempt to get column names from the SQLite cursor so we can map by name
    col_names = None
    col_names_lc = None
    try:
        if hasattr(cursor, 'description') and cursor.description:
            col_names = [d[0] for d in cursor.description]
            # also keep a lowercase mapping for robust lookups (SQLite may return mixed-case aliases)
            col_names_lc = [d[0].lower() for d in cursor.description]
    except Exception:
        col_names = None
        col_names_lc = None

    # Coercion helper used by both UPDATE-only and UPSERT/temp-table paths.
    # Keep this defined unconditionally so non-updateOnly paths can reuse it.
    def _coerce_for_pg(val, dtype):
        try:
            if val is None:
                return None
            # normalize empty strings
            if isinstance(val, str):
                v = val.strip()
                if v == '':
                    return None
                if dtype:
                    dt = dtype.lower()
                    # boolean
                    if dt == 'boolean':
                        if v.upper() in ('T', 'TRUE', '1'):
                            return True
                        if v.upper() in ('F', 'FALSE', '0'):
                            return False
                        return None
                    # integer types
                    if dt in ('integer', 'bigint', 'smallint'):
                        if v.isdigit() or (v.startswith('-') and v[1:].isdigit()):
                            return int(v)
                        if v.upper() in ('T', 'TRUE'):
                            return 1
                        if v.upper() in ('F', 'FALSE'):
                            return 0
                        return None
                    # numeric types
                    if dt in ('double precision', 'real', 'numeric', 'decimal'):
                        try:
                            return float(v)
                        except Exception:
                            return None
            # non-strings: return as-is
            return val
        except Exception:
            return None

    # Debug printing removed to reduce noise in normal runs.

    updated_count = 0
    update_sql = f"""UPDATE {table_name}
        SET {update_set}
        WHERE {where_clause}
    """

    # If no rows to process, short-circuit
    if not rows:
        try:
            # print the effective range used for selection
            dr = display_range if 'display_range' in locals() and display_range is not None else earliest_date
            print(f"No rows to copy for {table_name} from {dr} onwards.")
        except Exception:
            print(f"No rows to copy for {table_name} (no range available).")
        conn.close()
        render_db_conn.close()
        return

    # If caller requested UPDATE-only behavior, perform an UPDATE from VALUES (no INSERTs)
    if updateOnly:
        try:
            # Build CTE columns in the same order as select_fields (key_columns + fields)
            all_columns = key_columns + fields
            v_cols = ", ".join(all_columns)
            # Attempt to discover Postgres target column types so we can cast
            # the VALUES-derived CTE columns to the proper types. This avoids
            # errors like: column "age_ratio_male" is of type real but expression is of type text
            pg_types = {}
            try:
                render_cursor.execute(
                    "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = %s",
                    (table_name,)
                )
                for col_name, data_type in render_cursor.fetchall():
                    if col_name:
                        # Normalize to lower-case keys for robust lookup regardless of field casing
                        pg_types[col_name.lower()] = data_type
            except Exception:
                pg_types = {}

            # Helper to decide whether to cast based on Postgres data_type
            def _cast_expr(col):
                # look up using lower-case key to match information_schema output
                dtype = pg_types.get(col.lower())
                if not dtype:
                    return f"v.{col}"
                # treat common numeric types as needing cast
                numeric_types = {"real", "double precision", "numeric", "integer", "bigint", "smallint", "decimal"}
                if dtype.lower() in numeric_types:
                    return f"v.{col}::" + dtype
                # for other types (text, varchar, boolean, date, timestamp) let Postgres coerce or leave as-is
                return f"v.{col}"

            # Build SET clause mapping each field to the CTE value (with casts where appropriate)
            set_clause = ", ".join([f"{f} = {_cast_expr(f)}" for f in fields])
            # Build join clause between target and CTE
            join_clause = " AND ".join([f"{table_name}.{k} = v.{k}" for k in key_columns])

            # Prepare update SQL template using a VALUES placeholder compatible with execute_values
            update_sql = f"WITH v({v_cols}) AS (VALUES %s) UPDATE {table_name} SET {set_clause} FROM v WHERE {join_clause}"

            # Prepare the rows for VALUES: prefer name-mapped order when available
            all_columns = key_columns + fields
            # Coercion helper using Postgres types discovered in `pg_types`
            def _coerce_for_pg(val, dtype):
                try:
                    if val is None:
                        return None
                    # normalize empty strings
                    if isinstance(val, str):
                        v = val.strip()
                        if v == '':
                            return None
                        if dtype:
                            dt = dtype.lower()
                            # boolean
                            if dt == 'boolean':
                                if v.upper() in ('T', 'TRUE', '1'):
                                    return True
                                if v.upper() in ('F', 'FALSE', '0'):
                                    return False
                                return None
                            # integer types
                            if dt in ('integer', 'bigint', 'smallint'):
                                if v.isdigit() or (v.startswith('-') and v[1:].isdigit()):
                                    return int(v)
                                if v.upper() in ('T', 'TRUE'):
                                    return 1
                                if v.upper() in ('F', 'FALSE'):
                                    return 0
                                return None
                            # numeric types
                            if dt in ('double precision', 'real', 'numeric', 'decimal'):
                                try:
                                    return float(v)
                                except Exception:
                                    return None
                    # non-strings: return as-is
                    return val
                except Exception:
                    return None

            if col_names is not None:
                prepared_rows = []
                for r in rows:
                    rm = dict(zip(col_names_lc, r))
                    coerced = []
                    for c in all_columns:
                        dtype = pg_types.get(c.lower()) if 'pg_types' in locals() else None
                        coerced.append(_coerce_for_pg(rm.get(c.lower()), dtype))
                    prepared_rows.append(tuple(coerced))
            else:
                prepared_rows = [tuple(r) for r in rows]

            # Execute in batches to avoid huge single-statement VALUES lists
            batch_size = 500
            total = len(rows)
            total_batches = max(1, (total + batch_size - 1) // batch_size)
            for batch_index, start in enumerate(range(0, total, batch_size), start=1):
                end = min(start + batch_size, total)
                chunk = prepared_rows[start:end]
                execute_values(render_cursor, update_sql, chunk)
                render_db_conn.commit()
                print(
                    f"Updated existing rows (updateOnly) in {table_name}: "
                    f"batch {batch_index}/{total_batches}, rows {start+1}-{end} of {total}."
                )

            conn.close()
            render_db_conn.close()
            return
        except Exception as e:
            print(f"UPDATE-only sync failed for {table_name}: {e}")
            try:
                render_db_conn.rollback()
            except Exception:
                pass
            # fall through to normal upsert fallback behavior

    # Prepare data for batch update/insert
    # rows may be returned as (key_columns..., fields...) OR (fields..., key_columns...)
    # For INSERT/UPSERT we need rows in (key_columns..., fields...) order; for UPDATE-from-values we need (fields..., key_columns...)
    expected_len = len(key_columns) + len(fields)
    print(f"copy_table_to_postgres: selected {len(rows)} rows; expecting {expected_len} columns per row (keys+fields).")
    if rows:
        print("sample row:", rows[0])

    # If we have column names from the cursor, use them to map values by name
    # which is much more reliable than guessing ordering.
    if col_names is not None:
        # Build rows ordered as key_columns + fields (suitable for INSERT/UPSERT)
        all_columns = key_columns + fields
        ordered_rows = [tuple(dict(zip(col_names_lc, r)).get(c.lower()) for c in all_columns) for r in rows]
        # Build update_data (fields..., key_columns...) for UPDATE-from-values
        update_data = [tuple(r[len(key_columns):] + r[:len(key_columns)]) for r in ordered_rows]
        ordering = 'mapped_by_name'
    else:
        # Auto-detect ordering robustly by validating which candidate (keys_then_fields
        # or fields_then_keys) produces plausible key values. This prevents column
        # misalignment where, for example, a text flag lands in a bigint column.
        def _looks_like_date(val):
            return isinstance(val, str) and ('/' in val or '-' in val)

        def _is_int_like(val):
            if val is None:
                return None
            if isinstance(val, int):
                return True
            if isinstance(val, float):
                return False
            if isinstance(val, str):
                return val.isdigit()
            return False

        def score_candidate(ordering, sample_rows, key_columns, date_column_to_check):
            # ordering: 'keys_then_fields' or 'fields_then_keys'
            key_count = len(key_columns)
            checks = 0
            passes = 0
            for r in sample_rows:
                if len(r) != expected_len:
                    continue
                if ordering == 'keys_then_fields':
                    key_vals = r[:key_count]
                else:
                    key_vals = r[-key_count:]

                for k_idx, k in enumerate(key_columns):
                    v = key_vals[k_idx]
                    # date-like key check
                    if k == date_column_to_check or 'date' in k.lower():
                        if v is None:
                            continue
                        checks += 1
                        if _looks_like_date(v):
                            passes += 1
                    else:
                        # numeric key check for typical id columns
                        if v is None:
                            continue
                        checks += 1
                        il = _is_int_like(v)
                        if il is True:
                            passes += 1
            if checks == 0:
                return 0.0
            return passes / checks

        # If we do not have column names, evaluate both orderings on up to 20 sample rows
        if col_names is None:
            sample = rows[:20]
            score_keys_first = score_candidate('keys_then_fields', sample, key_columns, date_column)
            score_fields_first = score_candidate('fields_then_keys', sample, key_columns, date_column)

            # prefer the ordering with higher plausibility score; require at least 60% match
            if score_fields_first > score_keys_first and score_fields_first > 0.6:
                ordering = 'fields_then_keys'
            else:
                ordering = 'keys_then_fields'

    if col_names is None:
        if ordering == 'keys_then_fields':
            update_data = [(*row[len(key_columns):], *row[:len(key_columns)]) for row in rows]
            # insert_rows (for INSERT/UPSERT) should be keys_then_fields
            insert_rows = [tuple(row) for row in rows]
        else:
            # rows already in (fields..., key_columns...)
            update_data = [tuple(row) for row in rows]
            # convert to insert order (key_columns..., fields...)
            insert_rows = [(*row[-len(key_columns):], *row[:-len(key_columns)]) for row in rows]
    else:
        # When mapped by name we already prepared `ordered_rows`
        insert_rows = ordered_rows

    # Safety check
    if any(len(r) != expected_len for r in update_data):
        print("Warning: some update_data rows do not match expected length; aborting to avoid malformed SQL.")
        print("First mismatched update_data row:", next((r for r in update_data if len(r) != expected_len), None))
        conn.close()
        render_db_conn.close()
        return

    batch_size = 500
    total = len(update_data)

    # If render DB supports upsert, perform INSERT ... ON CONFLICT DO UPDATE
    try:
        # Verify that a UNIQUE constraint or index exists on the key_columns in Postgres.
        # If not present and no duplicate keys exist, attempt to create a unique constraint so ON CONFLICT will work.
        has_unique = False
        try:
            render_cursor.execute("SELECT indexname, indexdef FROM pg_indexes WHERE tablename = %s", (table_name,))
            idx_rows = render_cursor.fetchall()
            for idx in idx_rows:
                idxdef = idx[1] or ''
                if 'UNIQUE' in idxdef and all(k in idxdef for k in key_columns):
                    has_unique = True
                    break
        except Exception:
            # If the pg_indexes query fails (e.g., not a Postgres DB), fall back to attempting upsert and handling failure
            has_unique = False

        if not has_unique:
            # Check for duplicate keys in the target table
            dup_check_sql = f"SELECT {', '.join(key_columns)}, count(*) FROM {table_name} GROUP BY {', '.join(key_columns)} HAVING count(*)>1"
            try:
                render_cursor.execute(dup_check_sql)
                dup_rows = render_cursor.fetchall()
            except Exception:
                dup_rows = []

            if dup_rows:
                print(f"Cannot create unique constraint on {table_name}; duplicate key values exist. Falling back to temp-table sync.")
                raise Exception("duplicate_keys_present")
            else:
                # Safe to create unique constraint
                try:
                    constraint_name = f"uniq_{table_name}_{'_'.join(key_columns)}"
                    render_cursor.execute(f"ALTER TABLE {table_name} ADD CONSTRAINT {constraint_name} UNIQUE ({', '.join(key_columns)})")
                    render_db_conn.commit()
                    has_unique = True
                    print(f"Created unique constraint {constraint_name} on {table_name}({', '.join(key_columns)})")
                except Exception as e:
                    print(f"Failed to create unique constraint on {table_name}: {e}. Falling back to temp-table sync.")
                    # ensure rollback before proceeding to fallback
                    try:
                        render_db_conn.rollback()
                    except Exception:
                        pass
                    raise

        # If we don't have a unique constraint on the key_columns, force the temp-table fallback
        if not has_unique:
            raise Exception("no_unique_index")

        # Inspect target Postgres column types for sensible coercion
        try:
            render_cursor.execute(
                "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = %s",
                (table_name,)
            )
            ins_col_rows = render_cursor.fetchall()
            ins_col_type_map = {r[0].lower(): r[1] for r in ins_col_rows}
        except Exception:
            ins_col_type_map = {}

        # Coercion helper for inserts (reuse logic)
        def _coerce_insert_row(row_tuple):
            coerced = []
            for i, c in enumerate(all_columns):
                dtype = ins_col_type_map.get(c.lower())
                val = row_tuple[i]
                coerced.append(_coerce_for_pg(val, dtype))
            return tuple(coerced)

        # Build an INSERT ... ON CONFLICT statement
        all_columns = key_columns + fields
        insert_cols = ", ".join(all_columns)
        placeholders = ", ".join(["%s"] * len(all_columns))
        conflict_cols = ", ".join(key_columns)
        update_assign = ", ".join([f"{f} = EXCLUDED.{f}" for f in fields])
        insert_sql = f"INSERT INTO {table_name} ({insert_cols}) VALUES ({placeholders}) ON CONFLICT ({conflict_cols}) DO UPDATE SET {update_assign}"

        # execute_batch expects params tuples in the same order as placeholders
        # rows currently are (key_cols..., fields...) so we need to reorder to (key_cols..., fields...)
        # which matches insert_sql, so use rows directly
        for start in range(0, total, batch_size):
            end = min(start + batch_size, total)
            batch = insert_rows[start:end]
            batch_coerced = [ _coerce_insert_row(b) for b in batch ]
            execute_batch(render_cursor, insert_sql, batch_coerced)
            print(f"Upserted rows {start+1} to {end} of {total} into {table_name}...")

        render_cursor.connection.commit()
        print(f"Upserted {total} rows to PostgreSQL for fields {fields} from {earliest_date} onwards in {table_name}.")

    except Exception as e:
        # Fallback: rollback the aborted transaction, then use a temp table to upsert
        print(f"Upsert failed ({e}), attempting temp-table fallback for {table_name}.")
        try:
            # rollback any aborted transaction on the render DB connection
            try:
                render_db_conn.rollback()
            except Exception:
                pass

            # create a temporary table for batch sync
            tmp_table = "tmp_sync_rows"
            all_columns = key_columns + fields
            insert_cols = ", ".join(all_columns)
            placeholders = ", ".join(["%s"] * len(all_columns))

            # Inspect target Postgres column types for sensible temp-table column types
            try:
                render_cursor.execute(
                    "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = %s AND column_name = ANY(%s)",
                    (table_name, list(all_columns)),
                )
                col_rows = render_cursor.fetchall()
                col_type_map = {r[0]: r[1] for r in col_rows}
            except Exception:
                col_type_map = {}

            def _pg_type_for(information_type: str) -> str:
                if information_type is None:
                    return 'text'
                t = information_type.lower()
                if t in ('integer', 'bigint', 'smallint'):
                    return 'bigint'
                if t in ('double precision', 'real', 'numeric', 'decimal'):
                    return 'double precision'
                if 'character' in t or t.startswith('varchar') or t == 'text':
                    return 'text'
                if t == 'boolean':
                    return 'boolean'
                # fallback
                return 'text'

            tmp_cols = []
            for c in all_columns:
                pg_type = _pg_type_for(col_type_map.get(c))
                tmp_cols.append(f"{c} {pg_type}")

            render_cursor.execute(f"CREATE TEMP TABLE {tmp_table} ({', '.join(tmp_cols)}) ON COMMIT DROP;")

            # bulk insert into temp table (rows are in the form (key_cols..., fields...))
            for start in range(0, total, batch_size):
                end = min(start + batch_size, total)
                batch = insert_rows[start:end]
                # coerce batch for temp table according to col_type_map
                coerced_batch = []
                for row_tuple in batch:
                    coerced = []
                    for i, c in enumerate(all_columns):
                        dtype = col_type_map.get(c)
                        coerced.append(_coerce_for_pg(row_tuple[i], dtype))
                    coerced_batch.append(tuple(coerced))
                insert_tmp_sql = f"INSERT INTO {tmp_table} ({insert_cols}) VALUES ({placeholders})"
                execute_batch(render_cursor, insert_tmp_sql, coerced_batch)

            # 1) Update matching target rows from temp table
            set_clause = ", ".join([f"{f} = tmp.{f}" for f in fields])
            join_clause = " AND ".join([f"{table_name}.{k} = tmp.{k}" for k in key_columns])
            update_from_tmp = f"UPDATE {table_name} SET {set_clause} FROM {tmp_table} tmp WHERE {join_clause}"
            render_cursor.execute(update_from_tmp)

            # 2) Insert rows that don't exist in target
            tmp_select_cols = ", ".join([f"tmp.{c}" for c in all_columns])
            not_exists_clause = " AND ".join([f"t.{k} = tmp.{k}" for k in key_columns])
            insert_from_tmp = (
                f"INSERT INTO {table_name} ({insert_cols}) SELECT {tmp_select_cols} FROM {tmp_table} tmp "
                f"WHERE NOT EXISTS (SELECT 1 FROM {table_name} t WHERE {not_exists_clause})"
            )
            render_cursor.execute(insert_from_tmp)

            render_db_conn.commit()
            print(f"Temp-table sync completed for {total} rows to {table_name}.")
        except Exception as e2:
            print(f"Temp-table fallback failed for {table_name}: {e2}")
            try:
                render_db_conn.rollback()
            except Exception:
                pass

    conn.close()
    render_db_conn.close()

def copy_athletes_to_postgres(end_date: str = None,
                              updateFrom: str | None = None,
                              batch_size: int = 500,
                              cast_timestamps: bool = False,
                              run_age_update: bool = False):
    """
    Copy `athletes` from SQLite -> Postgres with optional filtering and an age update step.

    Parameters
    - end_date: unused for the copy but kept for parity with other callers (optional)
    - updateFrom: if set (string yyyy-mm-dd), only source rows with last_updated >= updateFrom
      will be selected for upsert. This implements your "updateFrom" gating requirement.
    - batch_size: how many rows to upsert per batch
    - cast_timestamps: if True, cast last_updated comparisons to timestamp in Postgres
    - run_age_update: if True, run a Postgres UPDATE that computes `current_age_estimate`
      from `tmp_final_age_updates` using the logic you supplied (translated to Postgres).

    Notes:
    - This function uses the repo `connections()` helper to obtain both SQLite and
      Postgres cursors. It expects `athlete_code` to be a unique key in Postgres.
    - The Postgres age-update expects a table `tmp_final_age_updates` in Postgres with
      columns: athlete_code, final_min_dob, final_max_dob, final_last_updated.
      The SQL uses `::date` casts and the difference in days divided by 365.2425.
    """
    conn_sqlite, cur_sqlite, conn_pg, cur_pg = connections()
    try:
        cols = [
            "athlete_code",
            "name",
            "min_dob",
            "max_dob",
            "last_updated",
            "club",
            "sex",
            "last_age_estimate",
            "current_age_estimate",
            "total_runs",
            "total_vols",
            "recent_runs",
        ]

        select_sql = "SELECT " + ", ".join(cols) + " FROM athletes"
        params = None
        if updateFrom:
            # SQLite placeholder is ?
            select_sql += " WHERE date(last_updated) >= date(?)"
            params = (updateFrom,)

        if params:
            cur_sqlite.execute(select_sql, params)
        else:
            cur_sqlite.execute(select_sql)

        rows = cur_sqlite.fetchall()
        if not rows:
            print("No athlete rows to copy (after updateFrom filter).")
            return

        # build upsert statement
        placeholders = ", ".join(["%s"] * len(cols))
        update_assign = ", ".join([f"{c} = EXCLUDED.{c}" for c in cols if c != "athlete_code"])

        # guard updates by last_updated when existing value is newer
        if cast_timestamps:
            last_cmp = "(EXCLUDED.last_updated::timestamp >= athletes.last_updated::timestamp OR athletes.last_updated IS NULL)"
        else:
            last_cmp = "(EXCLUDED.last_updated >= athletes.last_updated OR athletes.last_updated IS NULL)"

        insert_sql = (
            f"INSERT INTO athletes ({', '.join(cols)}) VALUES ({placeholders}) "
            f"ON CONFLICT (athlete_code) DO UPDATE SET {update_assign} WHERE {last_cmp}"
        )

        def _coerce_row(r):
            coerced = []
            for v in r:
                if isinstance(v, str) and v.strip() == "":
                    coerced.append(None)
                else:
                    coerced.append(v)
            return tuple(coerced)

        prepared = [_coerce_row(r) for r in rows]

        total = len(prepared)
        for start in range(0, total, batch_size):
            batch = prepared[start : start + batch_size]
            execute_batch(cur_pg, insert_sql, batch, page_size=batch_size)
            print(f"Upserted athletes {start+1}-{min(start+batch_size,total)} of {total}")

        conn_pg.commit()
        print(f"Completed copying {total} athletes to Postgres.")

        if run_age_update:
            # Postgres SQL translating your SQLite julianday logic to Postgres date arithmetic
            # Now derive ages directly from the `athletes` table columns:
            # - min_dob  <- athletes.min_dob
            # - max_dob  <- athletes.max_dob
            # - last_updated <- athletes.last_updated
            age_sql = """
            UPDATE athletes a
            SET current_age_estimate = sub.new_age
            FROM (
                SELECT fu.athlete_code,
                    CASE
                        WHEN fu.min_dob IS NULL AND fu.max_dob IS NULL THEN NULL
                        WHEN fu.min_dob IS NULL THEN ROUND(((now()::date - fu.max_dob::date)::numeric / 365.2425)::numeric, 2)
                        WHEN fu.max_dob IS NULL THEN ROUND(((now()::date - fu.min_dob::date)::numeric / 365.2425)::numeric, 2)
                        ELSE ROUND((((now()::date - fu.max_dob::date) + (now()::date - fu.min_dob::date))::numeric / (2.0 * 365.2425))::numeric, 2)
                    END AS new_age
                FROM athletes fu
            ) sub
            WHERE a.athlete_code = sub.athlete_code
                AND sub.new_age IS NOT NULL
            """
            try:
                cur_pg.execute(age_sql)
                conn_pg.commit()
                print("Updated current_age_estimate in Postgres from athletes.")
            except Exception as e:
                print(f"Error running age update SQL: {e}")
                try:
                    conn_pg.rollback()
                except Exception:
                    pass

    finally:
        try:
            conn_sqlite.close()
        except Exception:
            pass
            pass
        try:
            conn_pg.close()
        except Exception:
            pass


def build_maxDate_query() -> tuple[str, dict]:
    sql = with_sections(
        names=["max_date_cte", "max_event_row"],
        tail_name="final_maxFlag_select",
        filename="sql/pipeline_sections/SQL.sql",
    )
    params = {}
    return sql, params
def build_coeff_query(event_code: int, event_number: int) -> tuple[str, dict]:
    sql = with_sections(
        names=["selected_eventRange",
                "athletesInEventRange",
                "athletesStatsInEventRange",
                "ratiosInEventRange"
                ], 
        tail_name="medianCalcsandUpdate",
        filename="sql/pipeline_sections/SQL.sql",
    )
    params = {"event_code": event_code, "event_number": event_number}
    return sql, params
def build_timeRatio_query(event_code: int, event_number: int) -> tuple[str, dict]:
    sql = with_sections(
        names=["selected_eventRange",
                "athletesInEventRange",
                "athletesStatsInEventRange",
                "ratiosInEventRange1"
                ],
        tail_name="final_selectRatios",
        filename="sql/pipeline_sections/SQL.sql",
    )
    params = {"event_code": event_code, "event_number": event_number}
    return sql, params
def build_wghtCoeff_query(event_date: str) -> tuple[str, dict]:
    sql = get_single_section_sql("weightedAvgTimeRatioCoeff")
    params = {"event_date": event_date}
    return sql, params
def build_wghtCoeffUpdate_query(event_code: int, formatted_date: str, normalized_weighted_avg_time_ratio: float) -> tuple[str, dict]:
    sql=get_single_section_sql("weightedAvgTimeRatioCoeffUpdate")
    params = {"event_code": event_code, "formatted_date": formatted_date, "normalized_weighted_avg_time_ratio": normalized_weighted_avg_time_ratio}
    return sql, params
def build_getEvents_query(event_code: int) -> tuple[str, dict]:
    sql = get_single_section_sql("final_getEvents")
    params = {"event_code": event_code}
    return sql, params
def build_getEventsDates_query() -> tuple[str, dict]:
    sql = get_single_section_sql("final_getEventDates")
    params = {}
    return sql, params
def build_CoeffEvents_query() -> tuple[str, dict]:
    sql = get_single_section_sql("final_calcCoeffEvent")
    params = {}
    return sql, params
def build_AvgTimePerEvent_query(event_date: str) -> tuple[str, dict]:
    sql = get_single_section_sql("final_AvgTimePerEvent")
    params = {"event_date": event_date}
    return sql, params
def build_eligibleAthletes_query(start_date: str, end_date: str) -> tuple[str, dict]:
    sql = with_sections(
        names=["athleteAdjTimesSec",
                "athletesAdjPBforRange",
                "eligibleWithinRange",
                ], 
        tail_name="eligibleAthletes",
        filename="sql/pipeline_sections/SQL.sql",
    )
    params = {"start_date": start_date, "end_date": end_date}
    return sql, params
def build_touristCalcs(event_date: str, formatted_date: str) -> tuple[str, dict]:
    sql = get_single_section_sql("final_TouristCalc")
    params = {"event_date": event_date, "formatted_date": formatted_date}
    return sql, params
def build_touristFlag(start_date: str, end_date: str) -> tuple[str, dict]:
    sql = get_single_section_sql("final_TouristFlag")
    params = {"start_date": start_date, "end_date": end_date}
    return sql, params
def build_ageAndDOB(start_date: str, end_date: str) -> tuple[str, dict]:
    # corrected section name: final_AgeCalculation exists in SQL.sql
    sql = get_single_section_sql("final_AgeCalculation")
    params = {"start_date": start_date, "end_date": end_date}
    return sql, params
def build_ageAvg_query() -> tuple[str, dict]:
    sql = get_single_section_sql("final_AvgAgePerEvent")  
    params = {}
    return sql, params
def build_regulars_query(formatted_date:str) -> tuple[str, dict]:
    sql = get_single_section_sql("final_regulars_new_update")
    #sql = get_single_section_sql("final_regularAthletesCount")
    params = {"start_date": formatted_date}
    return sql, params
def build_superTourist_query(formatted_date:str) -> tuple[str, dict]:
    sql = get_single_section_sql("final_superTourist")
    params = {"formatted_date": formatted_date}
    return sql, params
def build_superTouristCount_query(start_date: str, end_date: str) -> tuple[str, dict]:
    sql = get_single_section_sql("final_superTouristCount")
    params = {"start_date": start_date, "end_date": end_date}
    return sql, params
def build_parkruners_query(formatted_date: str) -> tuple[str, dict]:
    sql = get_single_section_sql("final_event_counts_update")
    params = {"formatted_date": formatted_date}
    return sql, params

def build_unknowns_query(event_date: str) -> tuple[str, dict]:
    sql = get_single_section_sql("final_unknowns_update")
    params = {"event_date": event_date}
    return sql, params
def interpolate_age_ratio(formatted_date, age, min_dob, max_dob, found, foundNext):
    fd = datetime.strptime(formatted_date, "%Y-%m-%d")
    min_dob_dt = datetime.strptime(min_dob, "%Y-%m-%d")
    max_dob_dt = datetime.strptime(max_dob, "%Y-%m-%d")

    birthday_max = safe_replace_year(max_dob_dt, max_dob_dt.year + age)
    birthday_min_next = safe_replace_year(min_dob_dt, min_dob_dt.year + age + 1)

    interval_days = (birthday_min_next - birthday_max).days
    days_since_birthday_max = (fd - birthday_max).days
    x = max(0, min(1, days_since_birthday_max / interval_days if interval_days > 0 else 0))

    #next_age = age + 1
    #next_found = None

    # Try current age_group first
    #for ac in agecat_by_group.get(found['age_group'], []):
    #    if ac['age'] == next_age:
    #        next_found = ac
    #        break

    # If not found, try next_age_group if provided
    #if not next_found and next_age_group:
    #    for ac in agecat_by_group.get(next_age_group['age_group'], []):
    #        if ac['age'] == next_age:
    #            next_found = ac
    #            break

    if not foundNext:
        male_age_ratio_new = found['male_age_ratio']
        sex_age_ratio_new = found['sex_age_ratio']
    else:
        next_male_age_ratio = foundNext['male_age_ratio']
        next_sex_age_ratio = foundNext['sex_age_ratio']
        male_age_ratio_new = next_male_age_ratio * x + found['male_age_ratio'] * (1 - x)
        sex_age_ratio_new = next_sex_age_ratio * x + found['sex_age_ratio'] * (1 - x)

    return male_age_ratio_new, sex_age_ratio_new
def update_avg_age_estimate():
    """
    Reads athletes table, extracting relevant columns.
    For now, returns nothing.
    """
    conn, cursor, *_ = connections()

    print("Updating athletes avg_age_estimate from last_age_estimate...")
    try:
        sql, params = build_ageAvg_query()
        # build_ageAvg_query may return multiple SQL statements (CREATE TEMP TABLE, INSERT, UPDATE, DROP)
        # Use flatten_sql to substitute params and executescript to run multiple statements in SQLite.
        flat_sql = flatten_sql(sql, params)
        cursor.executescript(flat_sql)
        conn.commit()
        print('Avg age_estimate updated.')
    except Exception as e:
        print(f'Error updating avg_age_estimate: {e}')
        conn.rollback()
    finally:
        conn.close()
def update_regulars(formatted_date=None):
    """
    Reads athletes table, extracting relevant columns.
    For now, returns nothing.
    """
    conn, cursor, *_ = connections()

    earliest_date = None
    try:
        # If the parkrun_events table contains no non-NULL regulars values,
        # ignore any provided formatted_date and start at MIN(event_date) + 15 weeks.
        try:
            # Count rows with non-null, non-zero regulars; treat 0 as 'no data'
            cursor.execute("SELECT COUNT(*) FROM parkrun_events WHERE regulars IS NOT NULL AND regulars <> 0")
            reg_count = cursor.fetchone()[0]
        except Exception:
            # If the regulars column doesn't exist or query fails, treat as if regulars are present
            reg_count = 1
        if reg_count == 0:
            # compute earliest event_date (ISO) and add 15 weeks
            try:
                cursor.execute("SELECT MIN(substr(event_date,7,4) || '-' || substr(event_date,4,2) || '-' || substr(event_date,1,2)) FROM parkrun_events")
                min_iso = cursor.fetchone()[0]
                if min_iso:
                    min_dt = datetime.strptime(min_iso, '%Y-%m-%d')
                    start_dt = min_dt + timedelta(weeks=15)
                    formatted_date = start_dt.strftime('%Y-%m-%d')
                    print(f"No existing regulars found; starting from {formatted_date} (min + 15 weeks).")
                else:
                    print("parkrun_events has no dates; nothing to do.")
                    return None
            except Exception as e:
                print(f"Error computing min event_date for regulars fallback: {e}")
                # fall through to normal behavior
                pass
        # Determine list of event_dates to process
        if formatted_date is not None:
            # If any parkrun_events rows have regulars IS NULL, start from the earliest such date
            cursor.execute("SELECT COUNT(*) FROM parkrun_events WHERE regulars IS NULL")
            null_count = cursor.fetchone()[0]
            if null_count > 0:
                cursor.execute("SELECT DISTINCT substr(event_date,7,4) || '-' || substr(event_date,4,2) || '-' || substr(event_date,1,2) AS formatted_date FROM parkrun_events WHERE regulars IS NULL and last_position>0 ORDER BY formatted_date ASC")
                dates_to_process = [r[0] for r in cursor.fetchall()]
                print(f"Found {len(dates_to_process)} dates with NULL regulars; starting from {dates_to_process[0]}.")
            else:
                # No NULLs present: default to skipping first 15
                cursor.execute("SELECT DISTINCT formatted_date FROM parkrun_events_view ORDER BY DATE(formatted_date) ASC")
                all_dates = [r[0] for r in cursor.fetchall()]
                if len(all_dates) <= 15:
                    print("Not enough dates to process regulars (need more than 15).")
                    return
                dates_to_process = all_dates[15:]  # start at 16th date
                print(f"No formatted_date provided. Starting regulars update from {dates_to_process[0]} and processing {len(dates_to_process)} weeks.")
        else:
            # Use provided formatted_date as the minimum date (inclusive)
            # Normalize to the stored format if necessary (expecting 'YYYY-MM-DD' or 'DD/MM/YYYY')
            # We'll compare by converting stored event_date to ISO in SQL
            cursor.execute("SELECT event_date,count(*) as reg_count FROM parkrun_events WHERE regulars IS NULL group by event_date having reg_count>=26 order by event_number")
            dates_to_process = [r[0] for r in cursor.fetchall()]
            if not dates_to_process:
                print(f"No event dates found on or after {formatted_date}. Nothing to do.")
                return
            print(f"Starting regulars update from provided date {dates_to_process[0]} and processing {len(dates_to_process)} weeks.")

        # Process each date sequentially, executing the SQL section for that date
        for ev_date in dates_to_process:
            try:
                print(f"Processing regulars for event_date {ev_date}...")
                #ev_iso = to_yyyy_mm_dd(ev_date)
                ev_iso=ev_date
                sql, params = build_regulars_query(ev_iso)
                # flatten_sql will expand multiple statements; use executescript for SQLite
                flat_sql = flatten_sql(sql, params)
                cursor.executescript(flat_sql)
                conn.commit()
                print(f"Regulars flag updated for {ev_date}.")
                # Track earliest formatted_date processed (convert ev_date to ISO)
                try:
                    ev_iso = to_yyyy_mm_dd(ev_date)
                except Exception:
                    # If conversion fails, assume ev_date is already ISO
                    ev_iso = ev_date
                if earliest_date is None or ev_iso < earliest_date:
                    earliest_date = ev_iso
            except Exception as inner_e:
                print(f"Error updating regulars for {ev_date}: {inner_e}")
                conn.rollback()

    except Exception as e:
        print(f'Error in update_regulars: {e}')
        try:
            conn.rollback()
        except Exception:
            pass
    finally:
        conn.close()
    return earliest_date
def update_super_tourists():
    """
    Reads athletes table, extracting relevant columns.
    For now, returns nothing.
    """
    conn, cursor, *_ = connections()

    earliest_date = None
    try:
        # Find the last formatted_date where the sum(super_tourist) > 0 in eventpositions
        # New approach: find earliest formatted_date where ALL rows have super_tourist = 0.
        # If found, process from that date (inclusive) forward. Otherwise fall back to
        # previous logic which resuming after the last positive value or from the first date.
        try:
            cursor.execute('''
        SELECT MIN(formatted_date) AS earliest_all_zero
                FROM (
                  SELECT formatted_date,
                         SUM(CASE WHEN COALESCE(super_tourist,0) <> 0 THEN 1 ELSE 0 END) AS non_zero_count,
                         COUNT(*) AS total_count
                  FROM eventpositions_view
				  where formatted_date>'2022-01-01'
                  GROUP BY formatted_date
                  HAVING total_count > 0 AND non_zero_count = 0)
            ''')
            earliest_all_zero = cursor.fetchone()[0]
        except Exception:
            earliest_all_zero = None

        if earliest_all_zero:
            cursor.execute("SELECT DISTINCT formatted_date FROM eventpositions_view WHERE formatted_date >= ? ORDER BY DATE(formatted_date) ASC", (earliest_all_zero,))
            dates_to_process = [r[0] for r in cursor.fetchall()]
            if not dates_to_process:
                print(f"No dates found on or after {earliest_all_zero} to process for super_tourist.")
                conn.close()
                return None
            print(f"Resuming super_tourist processing from {dates_to_process[0]} (starting at earliest all-zero date={earliest_all_zero}).")
        else:
            # Fallback to prior behavior: resume after the last positive date, or start from first
            try:
                cursor.execute("SELECT MAX(formatted_date) FROM eventpositions_view WHERE COALESCE(super_tourist,0) > 0")
                max_positive_date = cursor.fetchone()[0]
            except Exception:
                max_positive_date = None

            if max_positive_date:
                cursor.execute("SELECT DISTINCT formatted_date FROM eventpositions_view WHERE formatted_date > ? ORDER BY DATE(formatted_date) ASC", (max_positive_date,))
                future_dates = [r[0] for r in cursor.fetchall()]
                if not future_dates:
                    print(f"No dates after {max_positive_date} to process for super_tourist.")
                    conn.close()
                    return None
                dates_to_process = future_dates
                print(f"Resuming super_tourist processing from {dates_to_process[0]} (after last_positive_date={max_positive_date}).")
            else:
                cursor.execute("SELECT DISTINCT formatted_date FROM eventpositions_view ORDER BY DATE(formatted_date) ASC")
                all_dates = [r[0] for r in cursor.fetchall()]
                if not all_dates:
                    print("No dates available in eventpositions_view to process super_tourist.")
                    conn.close()
                    return None
                dates_to_process = all_dates
                print(f"No existing super_tourist values found; starting from {dates_to_process[0]} and processing {len(dates_to_process)} weeks.")

        # Loop over dates and run the SQL section to compute super_tourist for each date
        for ev_date in dates_to_process:
            try:
                print(f"Processing super_tourist for event_date {ev_date}...")
                sql, params = build_superTourist_query(ev_date)
                flat_sql = flatten_sql(sql, params)
                cursor.executescript(flat_sql)
                conn.commit()
                print(f"super_tourist updated for {ev_date}.")
                # Track earliest ISO date processed
                try:
                    ev_iso = to_yyyy_mm_dd(ev_date)
                except Exception:
                    ev_iso = ev_date
                if earliest_date is None or ev_iso < earliest_date:
                    earliest_date = ev_iso
            except Exception as inner_e:
                print(f"Error updating super_tourist for {ev_date}: {inner_e}")
                conn.rollback()

    except Exception as e:
        print(f'Error in update_super_tourists: {e}')
        try:
            conn.rollback()
        except Exception:
            pass
    finally:
        conn.close()
    return earliest_date
def update_super_Tourists_count():
    """
    Compute super_tourist_count across a date range and sync results to Postgres (UPDATE-only).

    Behavior:
    - Determine start_date as the latest event_date in `parkrun_events` where
      COALESCE(super_tourist_count,0) > 0. If none exists, fall back to the MIN event_date.
    - Determine end_date as the MAX event_date in `parkrun_events`.
    - Build a list of distinct formatted_date values between start_date and end_date
      and process them in batches of 500 dates. For each batch run the
      `final_superTouristCount` SQL (via `build_superTouristCount_query`) using
      `flatten_sql` + `executescript`, commit, then call
      `copy_table_to_postgres(..., updateOnly=True)` to push `super_tourist_count` updates.

    Returns the earliest ISO date processed (as a string) or None.
    """
    conn, cursor, *_ = connections()

    earliest_date = None
    try:
        # Find latest date with non-zero super_tourist_count
        try:
            cursor.execute(
                "SELECT MAX(substr(event_date,7,4) || '-' || substr(event_date,4,2) || '-' || substr(event_date,1,2)) FROM parkrun_events WHERE COALESCE(super_tourist_count,0) > 0"
            )
            start_iso = cursor.fetchone()[0]
        except Exception:
            start_iso = None

        # End date is max event_date in parkrun_events
        cursor.execute(
            "SELECT MAX(substr(event_date,7,4) || '-' || substr(event_date,4,2) || '-' || substr(event_date,1,2)) FROM parkrun_events"
        )
        end_iso = cursor.fetchone()[0]

        if end_iso is None:
            print("No events in parkrun_events; nothing to do.")
            conn.close()
            return None

        if start_iso is None:
            # No prior values: start from earliest available date
            cursor.execute(
                "SELECT MIN(substr(event_date,7,4) || '-' || substr(event_date,4,2) || '-' || substr(event_date,1,2)) FROM parkrun_events"
            )
            start_iso = cursor.fetchone()[0]
            if start_iso is None:
                print("No dates found in parkrun_events.")
                conn.close()
                return None
            print(f"No existing super_tourist_count values found; starting from {start_iso} to {end_iso}.")
        else:
            print(f"Resuming super_tourist_count processing from {start_iso} to {end_iso}.")

        # Get distinct formatted_date values from parkrun_events_view in the window
        cursor.execute(
            "SELECT DISTINCT formatted_date FROM parkrun_events_view WHERE formatted_date >= ? AND formatted_date <= ? ORDER BY DATE(formatted_date) ASC",
            (start_iso, end_iso),
        )
        dates = [r[0] for r in cursor.fetchall()]

        if not dates:
            print("No formatted dates found in range; nothing to do.")
            conn.close()
            return None

        # Process in batches of 500 dates
        batch_size = 500
        total = len(dates)
        for start in range(0, total, batch_size):
            batch_dates = dates[start : start + batch_size]
            batch_start = batch_dates[0]
            batch_end = batch_dates[-1]
            try:
                print(f"Processing super_tourist_count for {batch_start} -> {batch_end} ({start+1}-{min(start+batch_size, total)})")
                sql, params = build_superTouristCount_query(batch_start, batch_end)
                flat_sql = flatten_sql(sql, params)
                cursor.executescript(flat_sql)
                conn.commit()
                print(f"Computed super_tourist_count for {batch_start} -> {batch_end}.")

                # Computation committed to SQLite; Postgres sync intentionally omitted here

                # track earliest ISO date processed
                ev_iso = batch_start
                if earliest_date is None or ev_iso < earliest_date:
                    earliest_date = ev_iso
            except Exception as inner_e:
                print(f"Error updating super_tourist_count for {batch_start}->{batch_end}: {inner_e}")
                try:
                    conn.rollback()
                except Exception:
                    pass

    except Exception as e:
        print(f'Error in update_super_Tourists_count: {e}')
        try:
            conn.rollback()
        except Exception:
            pass
    finally:
        conn.close()

    return earliest_date
def update_parkrunners_stats():
    """
    Compute per-event per-date counts (first timers, returners, club members, PBs, recent bests, eligible times)
    and update `parkrun_events` for each date that needs populating.

    Steps:
    1) Find the earliest formatted_date in parkrun_events where the sum of all target columns = 0
       (i.e. the first date that appears to be unpopulated). If none, resume after the last date
       with any non-zero value, or process all dates if table is empty.
    2) Build an ordered list of formatted_date values to process (from start to max available).
    3) For each formatted_date call `build_parkruners_query(formatted_date)`, execute the generated SQL
       (via flatten_sql + executescript) to populate counts in SQLite, then call
       `copy_table_to_postgres(..., updateOnly=True)` to push updates to Postgres.
    4) Print progress and return the earliest ISO date processed (or None).
    """
    conn, cursor, *_ = connections()

    earliest_date = None
    try:
        # 1) Find earliest formatted_date where all counts sum to zero (unpopulated)
        try:
            cursor.execute('''
            SELECT MIN(formatted_date) AS earliest_all_zero 
            FROM ( 
                SELECT substr(event_date,7,4) || '-' || substr(event_date,4,2) || '-' || substr(event_date,1,2) AS formatted_date, 
                SUM(COALESCE(first_timers_count,0) + COALESCE(returners_count,0) + COALESCE(club_count,0) + COALESCE(pb_count,0) + COALESCE(recentBest_count,0) + COALESCE(eligible_time_count,0)) AS total_count_sum 
                FROM parkrun_events 
                where event_number<10000
                GROUP BY formatted_date 
                HAVING total_count_sum = 0 );
            ''')
            start_iso = cursor.fetchone()[0]
        except Exception:
            start_iso = None

        # If we didn't find an all-zero date, fall back to resuming after the last positive date
        if not start_iso:
            try:
                cursor.execute('''
                    SELECT MAX(substr(event_date,7,4) || '-' || substr(event_date,4,2) || '-' || substr(event_date,1,2))
                    FROM parkrun_events
                    WHERE (COALESCE(first_timers_count,0) + COALESCE(returners_count,0) + COALESCE(club_count,0) + COALESCE(pb_count,0) + COALESCE(recentBest_count,0) + COALESCE(eligible_time_count,0)) > 0
                ''')
                max_positive = cursor.fetchone()[0]
            except Exception:
                max_positive = None

            if max_positive:
                # Start after the last positive date
                cursor.execute("SELECT DISTINCT formatted_date FROM parkrun_events_view WHERE formatted_date > ? ORDER BY DATE(formatted_date) ASC", (max_positive,))
                dates_to_process = [r[0] for r in cursor.fetchall()]
                print(f"Resuming parkrunners stats from after last positive date {max_positive}; {len(dates_to_process)} dates to consider.")
            else:
                # No positive values anywhere: process from the earliest available formatted_date
                cursor.execute("SELECT DISTINCT formatted_date FROM parkrun_events_view ORDER BY DATE(formatted_date) ASC")
                dates_to_process = [r[0] for r in cursor.fetchall()]
                print(f"No existing parkrunners stats found; will process {len(dates_to_process)} dates starting at {dates_to_process[0] if dates_to_process else 'N/A'}.")
        else:
            # We found an earliest all-zero date; process from there
            cursor.execute("SELECT DISTINCT formatted_date FROM parkrun_events_view WHERE formatted_date >= ? ORDER BY DATE(formatted_date) ASC", (start_iso,))
            dates_to_process = [r[0] for r in cursor.fetchall()]
            print(f"Starting parkrunners stats from earliest all-zero date {start_iso}; {len(dates_to_process)} dates to consider.")

        if not dates_to_process:
            print("No dates to process for parkrunners stats.")
            conn.close()
            return None

        # 3) Loop through dates (process in batches to avoid long runs)
        batch_size = 500
        fields = ['first_timers_count','returners_count','club_count','pb_count','recentBest_count','eligible_time_count']
        total = len(dates_to_process)
        for start in range(0, total, batch_size):
            end = min(start + batch_size, total)
            batch = dates_to_process[start:end]
            for ev_date in batch:
                try:
                    print(f"Processing parkrunners stats for {ev_date}...")
                    sql, params = build_parkruners_query(ev_date)
                    flat_sql = flatten_sql(sql, params)
                    # executescript since SQL section may contain multiple statements
                    cursor.executescript(flat_sql)
                    conn.commit()
                    # track earliest processed (as ISO)
                    if earliest_date is None or ev_date < earliest_date:
                        earliest_date = ev_date
                except Exception as inner_e:
                    print(f"Error updating parkrunners stats for {ev_date}: {inner_e}")
                    try:
                        conn.rollback()
                    except Exception:
                        pass
        # 4) print latest update date
        if earliest_date:
            print(f"Parkrunners stats updated; earliest date processed: {earliest_date}")
        else:
            print("Parkrunners stats update finished; no dates were updated.")

        return earliest_date

    except Exception as e:
        print(f"Error in update_parkrunners_stats: {e}")
        try:
            conn.rollback()
        except Exception:
            pass
    finally:
        conn.close()
def update_athletes_dob_and_age_impacts1(start_date="2011-01-01"):
    """
    Reads age_category and eventpositions tables, extracting relevant columns.
    For now, returns nothing.
    """

    # Instead of using the provided start_date parameter, determine the earliest
    # formatted_date for which ALL rows have age_ratio_male IS NULL, and use that
    # as the start_date for DOB/age impact calculations. This matches the logic
    # that we only need to compute Age/DOB from the first date that lacks any
    # age_ratio_male values.
    conn, cursor, *_ = connections()
    try:
        cursor.execute('''
            SELECT MIN(formatted_date) AS earliest_all_null
            FROM (
              SELECT formatted_date,
                     SUM(CASE WHEN age_ratio_male IS NOT NULL THEN 1 ELSE 0 END) AS non_null_count,
                     COUNT(*) AS total_count
              FROM eventpositions_view
              GROUP BY formatted_date
              HAVING total_count > 0 AND non_null_count = 0
            )
        ''')
        row = cursor.fetchone()
        computed_start = row[0] if row and len(row) > 0 else None

        if not computed_start:
            # Nothing to compute
            print('No formatted_date found where all age_ratio_male are NULL; nothing to do.')
            return None

        # Use computed_start as the start_date and iterate over every formatted_date
        # in eventpositions_view from computed_start up to today. For each date,
        # run the AgeAndDOB SQL (scoped to that date) and commit.
        start_iso = computed_start
        end_date = datetime.now().strftime('%Y-%m-%d')
        print(f"Updating athletes min_dob, max_dob and age_estimate from eventpositions from {start_iso} onwards (per-date)...")

        # Get list of distinct formatted_date values in the window
        cursor.execute(
            "SELECT DISTINCT formatted_date FROM eventpositions_view WHERE formatted_date >= ? AND formatted_date <= ? ORDER BY DATE(formatted_date) ASC",
            (start_iso, end_date),
        )
        dates = [r[0] for r in cursor.fetchall()]
        if not dates:
            print(f"No event positions dates found between {start_iso} and {end_date}.")
            return None

        earliest = None
        for ev_date in dates:
            try:
                print(f"Processing AgeAndDOB for date {ev_date}...")
                sql, params = build_ageAndDOB(ev_date, ev_date)
                flat_sql = flatten_sql(sql, params)
                cursor.executescript(flat_sql)
                conn.commit()
                print(f"AgeAndDOB SQL executed and committed for {ev_date}.")

                # Track earliest ISO date processed
                try:
                    ev_iso = to_yyyy_mm_dd(ev_date)
                except Exception:
                    ev_iso = ev_date
                if earliest is None or ev_iso < earliest:
                    earliest = ev_iso
            except Exception as inner_e:
                print(f"Error executing AgeAndDOB for {ev_date}: {inner_e}")
                try:
                    conn.rollback()
                except Exception:
                    pass

        return earliest
    except Exception as e:
        print(f'Error determining computed start date for Age/DOB impacts: {e}')
        return None
    finally:
        conn.close()
def update_athletes_dob_and_age_impacts(start_date="2011-01-01"):
    """
    Reads age_category and eventpositions tables, extracting relevant columns.
    For now, returns nothing.
    """

    if start_date is None:
        print("No start_date provided, skipping athlete DOB/age update.")
        return
    conn, cursor, *_ = connections()

    print(f"Updating athletes min_dob, max_dob and age_estimate from eventpositions from {start_date} onwards...")
    # Read age_category table
    cursor.execute("""
        SELECT age, age_max, sex, age_group, lower_bound, target_bound, upper_bound, male_age_ratio, sex_age_ratio
        FROM age_category
    """)
    age_category_rows = cursor.fetchall()
    age_category_columns = [desc[0] for desc in cursor.description]
    age_categories = [dict(zip(age_category_columns, row)) for row in age_category_rows]

    # Read athletes table
    cursor.execute("""
        SELECT athlete_code, name, min_dob, max_dob, last_updated, last_age_estimate
        FROM athletes
    """)
    athletes_rows = cursor.fetchall()
    athletes_columns = [desc[0] for desc in cursor.description]
    athletes = {row[0]: dict(zip(athletes_columns, row)) for row in athletes_rows}

    # Prepare age_category lookup by age_group
    agecat_by_group = defaultdict(list)
    for ac in age_categories:
        agecat_by_group[ac['age_group']].append(ac)

    # Before batch processing, get total rows to process
    cursor.execute("""
        SELECT COUNT(*) FROM eventpositions_view
        WHERE formatted_date >= ?
    """, (start_date,))
    total_rows = cursor.fetchone()[0]
    print(f"Total rows to process: {total_rows}")

    # Batch process eventpositions table
    cursor.execute("""
        SELECT event_code, event_date, formatted_date, athlete_code, age_group, age_grade, time_seconds
        FROM eventpositions_view
        WHERE formatted_date >= ?
        ORDER BY formatted_date
    """, (start_date,))
    eventpositions_columns = [desc[0] for desc in cursor.description]
    batch_size = 50000
    ep_temp = []  # Temporary dataset for calculated fields


    # Then inside your batch loop:
    processed_rows = 0

    while True:
        rows = cursor.fetchmany(batch_size)
        if not rows:
            break
        eventpositions_batch = [dict(zip(eventpositions_columns, row)) for row in rows]
        for ep in eventpositions_batch:           

            # Calculate age_group_decimal
            age_grade_str = ep.get('age_grade')
            if age_grade_str != "Unknown":
                if not age_grade_str or not ep.get('time_seconds'):
                    continue
                age_grade_decimal = float(age_grade_str.replace('%', '')) / 100.0

                # Calculate lookup_value
                lookup_value = round(age_grade_decimal * ep['time_seconds'] * 2, 0)

                # Find matching age_category record
                age_group = ep['age_group']
                ac_list = agecat_by_group.get(age_group, [])
                found = None
                found_idx = None

                for idx, ac in enumerate(ac_list):
                    if ac['lower_bound'] <= lookup_value <= ac['upper_bound']:
                        found = ac
                        found_idx = idx
                        break

                if not found:
                    continue  # Skip if no match

                # Efficiently get the next record in ac_list
                foundNext = None
                if found_idx is not None and found_idx + 1 < len(ac_list):
                    foundNext = ac_list[found_idx + 1]
                else:
                    # Optionally, handle next group logic here if needed
                    pass

                # Get age (min), age_max, male_age_ratio, sex_age_ratio
                age_min = found['age']
                age_max = found['age_max']
                male_age_ratio = found['male_age_ratio']
                sex_age_ratio = found['sex_age_ratio']

                # Calculate min_dob and max_dob
                event_date = ep['event_date']
                formatted_date = ep['formatted_date']
                dt = datetime.strptime(event_date, "%d/%m/%Y") if '/' in event_date else datetime.strptime(event_date, "%Y-%m-%d")
                min_dob = (safe_replace_year(dt, dt.year - age_max - 1) + timedelta(days=1)).strftime("%Y-%m-%d")
                max_dob = safe_replace_year(dt, dt.year - age_min).strftime("%Y-%m-%d")

                # Update athlete min_dob/max_dob if needed
                athlete_code = ep['athlete_code']
                athlete = athletes.get(athlete_code)
                if athlete:
                    # Update min_dob if new min_dob > stored min_dob
                    if athlete['min_dob'] is None or athlete['min_dob'] < min_dob:
                        athlete['min_dob'] = min_dob
                    # Update max_dob if new max_dob < stored max_dob
                    if athlete['max_dob'] is None or athlete['max_dob'] > max_dob:
                        athlete['max_dob'] = max_dob
                    athlete['last_updated'] = formatted_date
                    athlete['last_age_estimate'] = age_max  # Update age_estimate when min_dob is updated
                else:
                    athletes[athlete_code] = {
                        'athlete_code': athlete_code,
                        'name': ep.get('name', ''),
                        'min_dob': min_dob,
                        'max_dob': max_dob,
                      #  'last_updated': datetime.now().strftime("%Y-%m-%d"),
                        'last_updated': formatted_date,
                        'last_age_estimate': age_max
                    }

                if athlete and athlete['min_dob'] and athlete['max_dob']:
                    male_age_ratio_new, sex_age_ratio_new = interpolate_age_ratio(
                        formatted_date, age_max, athlete['min_dob'], athlete['max_dob'], found, foundNext
                    )
                else:
                    # Handle missing athlete or missing DOBs
                    male_age_ratio_new = found['male_age_ratio']
                    sex_age_ratio_new = found['sex_age_ratio']

                # Store calculated fields in ep_temp
                ep_temp.append({
                    'event_code': ep['event_code'],
                    'event_date': ep['event_date'],
                    'formatted_date': ep['formatted_date'],
                    'athlete_code': ep['athlete_code'],
                    'age_group': ep['age_group'],
                    'age_grade': ep['age_grade'],
                    'age_ratio_male': male_age_ratio_new,
                    'age_ratio_sex': sex_age_ratio_new,
                    'min_dob': min_dob,
                    'max_dob': max_dob
                })


        processed_rows += len(eventpositions_batch)
        print(f"{processed_rows}/{total_rows} processed")


    # Update eventpositions table with age_ratio_male and age_ratio_sex
    print(f"Updating eventpositions: {len(ep_temp)} rows to update...")
    batch_size = 50000
    total_rows = len(ep_temp)
    for start in range(0, total_rows, batch_size):
        end = min(start + batch_size, total_rows)
        batch = ep_temp[start:end]
        update_data = [
            (ep['age_ratio_male'], ep['age_ratio_sex'], ep['event_code'], ep['event_date'], ep['athlete_code'])
            for ep in batch
        ]
        cursor.executemany("""
            UPDATE eventpositions
            SET age_ratio_male = ?, age_ratio_sex = ?
            WHERE event_code = ? AND event_date = ? AND athlete_code = ?
        """, update_data)
        print(f"Updated eventpositions {start+1} to {end} of {total_rows}...")

    # Update athletes table with min_dob, max_dob, age_estimate
    print(f"Updating athletes: {len(athletes)} rows to update...")
    batch_size = 50000
    athlete_list = list(athletes.values())
    total_athletes = len(athlete_list)
    for start in range(0, total_athletes, batch_size):
        end = min(start + batch_size, total_athletes)
        batch = athlete_list[start:end]
        for athlete in batch:
            cursor.execute("""
                UPDATE athletes
                SET min_dob = ?,
                    max_dob = ?,
                    last_age_estimate = ?,
                    last_updated = ?,
                    current_age_estimate = MAX(
                        CAST((strftime('%Y', 'now') - strftime('%Y', max_dob)) - (strftime('%m-%d', 'now') < strftime('%m-%d', max_dob)) AS INTEGER),
                        ?
                    )
                WHERE athlete_code = ?
            """, (
                athlete['min_dob'],
                athlete['max_dob'],
                athlete['last_age_estimate'],
                athlete['last_updated'],
                athlete['last_age_estimate'],  # Pass last_age_estimate for MAX()
                athlete['athlete_code']
            ))
        print(f"Updated athletes {start+1} to {end} of {total_athletes}...")
        conn.commit()

    # For now, do nothing
    conn.close()
    return
def update_tourist_flag_for_all_weeks(earliest_date_param: str):
    """
    For each event_date in parkrun_events (reverse order, skipping first 15),
    if count(event_code_count) in eventpositions_view for that date is 0,
    run buildTouristFlags for that date 
    """
    conn, cursor, *_ = connections()

    # Get all event_dates ordered ascending
    cursor.execute("SELECT DISTINCT event_date FROM parkrun_events ORDER BY DATE(substr(event_date, 7, 4) || '-' || substr(event_date, 4, 2) || '-' || substr(event_date, 1, 2)) ASC")
    all_dates = [row[0] for row in cursor.fetchall()]

    # Skip the first 15 dates
    if len(all_dates) <= 15:
        print("Not enough dates to process (need more than 15).")
        conn.close()
        return None

    dates_to_process = all_dates[15:]  # skip first 15
    earliest_date = earliest_date_param

    for event_date in reversed(dates_to_process):
        # Check if event_code_count is missing for this date
        cursor.execute("SELECT COUNT(last_event_code_count) FROM eventpositions_view WHERE event_date = ?", (event_date,))
        count = cursor.fetchone()[0]
        if count > 0:
            print(f"Tourist fields already present for {event_date}, stopping further processing.")
            break

        # Calculate start_date (15 weeks before event_date)
        end_date_obj = datetime.strptime(event_date, "%d/%m/%Y")
        start_date_obj = end_date_obj - timedelta(weeks=15)
        start_date = start_date_obj.strftime("%Y-%m-%d")
        end_date = end_date_obj.strftime("%Y-%m-%d")

        print(f"Building tourist flags for {event_date} (range: {start_date} to {end_date})...")
        sql, params = build_touristFlag(start_date, end_date)
        fSql = flatten_sql(sql, params)
        cursor.execute(sql, params)
        rows = cursor.fetchall()  

        # Update eventpositions with the new values
        for row in rows:
            athlete_code = row[12]
            event_code = row[0]
            event_date = row[1]

            last_event_code_count = row[19]
            total_runs = row[20]
            tourist_flag = row[22]
            cursor.execute("""
                UPDATE eventpositions
                SET tourist_flag = ?, last_event_code_count = ?, total_runs = ?
                WHERE event_code = ? AND event_date = ? AND athlete_code = ?
            """, (tourist_flag, last_event_code_count, total_runs, event_code,event_date, athlete_code))

        conn.commit()
        print(f"Updated tourist fields for {event_date}")
        event_date_iso = to_yyyy_mm_dd(event_date)
        if earliest_date is None or event_date_iso < earliest_date:
            earliest_date = event_date_iso

    conn.close()
    print("All tourist flags updated.")
    return earliest_date
def update_tourist_fields_for_all_weeks():
    """
    For each event_date in parkrun_events (reverse order, skipping first 15),
    if count(event_code_count) in eventpositions_view for that date is 0,
    run buildTouristCalcs for that date and update adj_time_seconds, adj_time_ratio, event_code_count.
    Stops when count(event_code_count) > 0 or no more dates.
    """
    conn, cursor, *_ = connections()

    # Get all event_dates ordered ascending
    cursor.execute("SELECT DISTINCT event_date FROM parkrun_events ORDER BY DATE(substr(event_date, 7, 4) || '-' || substr(event_date, 4, 2) || '-' || substr(event_date, 1, 2)) ASC")
    all_dates = [row[0] for row in cursor.fetchall()]

    # Skip the first 15 dates
    if len(all_dates) <= 15:
        print("Not enough dates to process (need more than 15).")
        conn.close()
        return None

    dates_to_process = all_dates[15:]  # skip first 15
    earliest_date = None

    for event_date in reversed(dates_to_process):
        # Check if event_code_count is missing for this date
        cursor.execute("SELECT COUNT(event_code_count) FROM eventpositions_view WHERE event_date = ?", (event_date,))
        count = cursor.fetchone()[0]
        if count > 0:
            print(f"Tourist fields already present for {event_date}, stopping further processing.")
            break

        print(f"Building tourist calcs for {event_date}...")
        sql, params = build_touristCalcs(event_date,to_yyyy_mm_dd(event_date))
        fSql = flatten_sql(sql,params)
        cursor.execute(sql, params)
        rows = cursor.fetchall()  # Should return [(athlete_code, event_code, adj_time_seconds, adj_time_ratio, event_code_count), ...]

        # Update eventpositions with the new values
        for row in rows:
            athlete_code = row[0]
            event_code = row[1]
            event_date = row[2]
            adj_time_seconds = row[8]
            adj_time_ratio = row[12]
            event_code_count = row[10]
            cursor.execute("""
                UPDATE eventpositions
                SET adj_time_seconds = ?, adj_time_ratio = ?, event_code_count = ?
                WHERE event_code = ? AND event_date = ? AND athlete_code = ?
            """, (adj_time_seconds, adj_time_ratio, event_code_count, event_code, event_date, athlete_code))

        conn.commit()
        print(f"Updated tourist fields for {event_date}")
        event_date_iso = to_yyyy_mm_dd(event_date)
        if earliest_date is None or event_date_iso < earliest_date:
            earliest_date = event_date_iso

    conn.close()
    print("All tourist fields updated.")
    return earliest_date
def update_eligible_times_for_all_weeks():
    """
    For each event_code, for each event_number in reverse order,
    if any row in eventpositions for that event_code/event_date has appearances or time_ratio NULL,
    run build_timeRatio_query and update those rows.
    Returns the earliest event_date updated.
    """
    conn, cursor, *_ = connections()
    earliest_date = None

    # Get all event_codes
    cursor.execute("SELECT DISTINCT event_code FROM parkrun_events")
    event_codes = [row[0] for row in cursor.fetchall()]

    for event_code in event_codes:
        # Get all events for this code, ordered by event_number ascending
        sql, params = build_getEvents_query(event_code)
        cursor.execute(sql, params)
        rows = cursor.fetchall()  # [(event_number, event_date, ...)]

        # Find trailing sequence of event_numbers where any appearance/time_ratio is NULL
        to_process = []
        for event_number, event_date, *_ in rows:
            # Check if any eventpositions row for this event_code/event_date has NULLs
            cursor.execute("""
                SELECT COUNT(*) FROM eventpositions
                WHERE event_code = ? AND event_date = ?
            """, (event_code, event_date))
            total_rows = cursor.fetchone()[0]

            # Get rows where both appearances and time_ratio are NULL
            cursor.execute("""
                SELECT COUNT(*) FROM eventpositions
                WHERE event_code = ? AND event_date = ? AND event_eligible_appearances IS NULL AND time_ratio IS NULL
            """, (event_code, event_date))
            null_rows = cursor.fetchone()[0]

            if total_rows > 0 and total_rows == null_rows:
                to_process.append((event_number, event_date))
            else:
                break

        # Process from oldest to newest
        for event_number, event_date in reversed(to_process):
            print(f"Updating eligible times for event_code={event_code}, event_number={event_number}, event_date={event_date}")
            sql, params = build_timeRatio_query(event_code, event_number)
            fSql= flatten_sql(sql, params)
            cursor.execute(sql, params)
            rows = cursor.fetchall()  # [(formatted_date, athlete_code, time, event_code, event_number, event_eligible_appearances, time_ratio), ...]

            for formatted_date, athlete_code, time, event_code_val, event_number_val, event_eligible_appearances, time_ratio in rows:
                # Use formatted_date if needed, or event_date
                cursor.execute("""
                    UPDATE eventpositions
                    SET event_eligible_appearances = ?, time_ratio = ?
                    WHERE event_code = ? AND event_date = ? AND athlete_code = ?
                """, (event_eligible_appearances, time_ratio, event_code_val, to_dd_mm_yyyy(formatted_date), athlete_code))

            # Track the earliest date updated
            event_date_iso = to_yyyy_mm_dd(event_date)
            if earliest_date is None or event_date_iso < earliest_date:
                earliest_date = event_date_iso

            conn.commit()
            print(f"Updated eligible times for event_code={event_code}, event_number={event_number}")

    conn.close()
    print("All eligible times updated.")
    return earliest_date
def build_window_summary_avg_time(start_date, end_date, cursor):
    # No temp table needed for avg_time, so just pass
    pass
def build_window_summary_coeff(start_date, end_date, cursor):
    cursor.execute("DROP TABLE IF EXISTS eligible_summary")
    sql, params = build_eligibleAthletes_query(start_date, end_date)
    full_sql = f"CREATE TEMP TABLE eligible_summary AS {sql}"
    cursor.execute(full_sql, params)
def build_update_rows_avg_time(end_date, cursor):
    # For each event_code on this end_date, calculate avg_time, avgTimeLim12, avgTimeLim5
    sql, params = build_AvgTimePerEvent_query(end_date)
    fSql = flatten_sql(sql, params)
    cursor.execute(sql, params)
    return cursor.fetchall()  # [(event_code, avg_time, avgTimeLim12, avgTimeLim5), ...]
def build_update_rows_avg_time_wrapper(end_date, cursor):
    # Wrap to match the generic interface
    return [
        (event_code, avg_time, avgTimeLim12, avgTimeLim5)
        for event_code, avg_time, avgTimeLim12, avgTimeLim5 in build_update_rows_avg_time(end_date, cursor)
    ]
def build_update_rows_coeff(end_date, cursor):
    sql, params = build_CoeffEvents_query()
    cursor.execute(sql, params)
    return cursor.fetchall()  # [(event_code, median_ratio), ...]
def update_db_avg_time(event_code, avg_time, avgTimeLim12, avgTimeLim5, end_date, cursor):
    cursor.execute("""
        UPDATE parkrun_events
        SET avg_time = ?, avgTimeLim12 = ?, avgTimeLim5 = ?
        WHERE event_code = ? AND substr(event_date, 7, 4) || '-' || substr(event_date, 4, 2) || '-' || substr(event_date, 1, 2) = ?
    """, (avg_time, avgTimeLim12, avgTimeLim5, event_code, end_date))
def update_db_avg_time_wrapper(event_code, avg_time, avgTimeLim12, avgTimeLim5, end_date, cursor):
    update_db_avg_time(event_code, avg_time, avgTimeLim12, avgTimeLim5, end_date, cursor)
def build_update_rows_tourist_count(end_date, cursor):
    """
    Return rows of (event_code, tourist_count) for the given formatted_date (end_date).
    end_date is expected to be in ISO format 'YYYY-MM-DD' and matches eventpositions_view.formatted_date.
    """
    cursor.execute("""
        SELECT event_code, COUNT(*) AS tourist_count
        FROM eventpositions_view
        WHERE formatted_date = ?
          AND tourist_flag = 'T'
        GROUP BY event_code
    """, (end_date,))
    return cursor.fetchall()
def build_update_rows_tourist_count_wrapper(end_date, cursor):
    # Wrapper to match the generic interface used elsewhere
    return [ (event_code, tourist_count) for event_code, tourist_count in build_update_rows_tourist_count(end_date, cursor) ]
def update_db_tourist_count(event_code, tourist_count, end_date, cursor):
    """
    Update the parkrun_events.tourist_count for the supplied event_code and formatted_date (end_date).
    """
    cursor.execute("""
        UPDATE parkrun_events
        SET tourist_count = ?
        WHERE event_code = ?
          AND substr(event_date, 7, 4) || '-' || substr(event_date, 4, 2) || '-' || substr(event_date, 1, 2) = ?
    """, (tourist_count, event_code, end_date))
def update_db_coeff(event_code, median_ratio, end_date, cursor):
    cursor.execute("""
        UPDATE parkrun_events
        SET coeff_event = ?
        WHERE event_code = ? AND substr(event_date, 7, 4) || '-' || substr(event_date, 4, 2) || '-' || substr(event_date, 1, 2) = ?
    """, (median_ratio, event_code, end_date))
def update_event_column_for_all_weeks(
    column_name,
    build_window_summary_fn,
    build_update_rows_fn,
    update_db_fn,
    window_size=15
):
    """
    Generic function to update a column in parkrun_events for all weeks with missing values.
    - column_name: the column to check for gaps (e.g. 'coeff_event', 'avg_time')
    - build_window_summary_fn: function(start_date, end_date, cursor) -> None, builds any needed temp tables
    - build_update_rows_fn: function(end_date, cursor) -> list of (event_code, value)
    - update_db_fn: function(event_code, value, end_date, cursor) -> None, updates the DB for that week
    - window_size: how many weeks in the window (default 15)
    """
    conn, cursor, *_ = connections()
    sql, params = build_getEventsDates_query()
    cursor.execute(sql, params)
    all_weeks = [row[0] for row in cursor.fetchall()]
    total_weeks = len(all_weeks)
    week_indices = range(total_weeks)
    earliest_date = None

    for i in reversed(week_indices):
        end_date = all_weeks[i]
        sDate = to_dd_mm_yyyy(end_date)
        # For numeric summary columns like tourist_count we need to treat a sum of 0
        # as 'missing' (i.e. process the window). For other columns the COUNT
        # semantics (non-NULL values) are sufficient.
        if column_name == 'tourist_count':
            cursor.execute("SELECT COALESCE(SUM(tourist_count), 0) FROM parkrun_events WHERE event_date = ?", (sDate,))
            count = cursor.fetchone()[0]
        else:
            cursor.execute(f"SELECT COUNT({column_name}) FROM parkrun_events WHERE event_date = ?", (sDate,))
            count = cursor.fetchone()[0]
        if count == 0:
            earliest_date = end_date
            start_date = all_weeks[max(0, i - (window_size - 1))]
            print(f"Processing window: {start_date} to {end_date}")

            # 1. Build any needed temp tables for this window
            build_window_summary_fn(start_date, end_date, cursor)

            # 2. Calculate the values to update for this window
            update_rows = build_update_rows_fn(end_date, cursor)

            # 3. Update the DB for each event_code in this window
            for row in update_rows:
                update_db_fn(*row, end_date, cursor)

            conn.commit()
            print(f"Updated {column_name} for {len(update_rows)} event_codes on {end_date}")
        else:
            print(f"Found {column_name} for {end_date}, stopping further processing.")
            break

    conn.close()
    print("All windows processed.")
    return earliest_date
def update_unknown_count(formatted_event_date: str = None):
    """
    Compute unknown_count (missing positions) per event and update parkrun_events.unknown_count.

    Behavior:
    - If `formatted_event_date` is provided (ISO 'YYYY-MM-DD'), process that date onward.
    - Otherwise find the earliest parkrun_events row where unknown_count IS NULL and process from there.
    Returns the earliest formatted_date processed (ISO) or None.
    """
    conn, cursor, *_ = connections()

    earliest_date = None
    try:
        # If a date was supplied, build the list from that date onwards
        if formatted_event_date is not None:
            cursor.execute("SELECT DISTINCT formatted_date FROM parkrun_events_view WHERE formatted_date >= ? ORDER BY DATE(formatted_date) ASC", (formatted_event_date,))
            dates_to_process = [r[0] for r in cursor.fetchall()]
            if not dates_to_process:
                print(f"No event dates found on or after {formatted_event_date}; nothing to do.")
                conn.close()
                return None
            print(f"Starting unknown_count update from provided date {dates_to_process[0]} and processing {len(dates_to_process)} weeks.")
        else:
            # Find earliest parkrun_events row where unknown_count IS NULL
            try:
                cursor.execute('''
                SELECT MIN(formatted_date) AS earliest_all_zero 
                    FROM ( 
                    SELECT substr(event_date,7,4) || '-' || substr(event_date,4,2) || '-' || substr(event_date,1,2) AS formatted_date, 
                    SUM(COALESCE(unknown_count,0)) AS total_count_sum 
                    FROM parkrun_events 
                    where event_number<10000
					  AND formatted_date>'2012-02-11'
                    GROUP BY formatted_date 
                    HAVING total_count_sum = 0 );
            ''')
                start_iso = cursor.fetchone()[0]
            except Exception:
                start_iso = None

            if start_iso:
                cursor.execute("SELECT DISTINCT formatted_date FROM parkrun_events_view WHERE formatted_date >= ? ORDER BY DATE(formatted_date) ASC", (start_iso,))
                dates_to_process = [r[0] for r in cursor.fetchall()]
                print(f"Starting unknown_count update from earliest NULL date {start_iso}; {len(dates_to_process)} dates to consider.")
            else:
                # Nothing specifically NULL; process all dates
                #cursor.execute("SELECT DISTINCT formatted_date FROM parkrun_events_view ORDER BY DATE(formatted_date) ASC")
                dates_to_process = [r[0] for r in cursor.fetchall()]
                print(f"No unknown_count NULL values found; will process {len(dates_to_process)} dates starting at {dates_to_process[0] if dates_to_process else 'N/A'}.")

        if not dates_to_process:
            print("No dates to process for unknown_count.")
            conn.close()
            return None

        # Process each date sequentially
        for ev_date in dates_to_process:
            try:
                print(f"Processing unknown_count for event_date {ev_date}...")
                sql, params = build_unknowns_query(ev_date)
                flat_sql = flatten_sql(sql, params)
                cursor.executescript(flat_sql)
                conn.commit()
                print(f"unknown_count updated for {ev_date}.")
                if earliest_date is None or ev_date < earliest_date:
                    earliest_date = ev_date
            except Exception as inner_e:
                print(f"Error updating unknown_count for {ev_date}: {inner_e}")
                try:
                    conn.rollback()
                except Exception:
                    pass

        if earliest_date:
            print(f"Unknown counts updated; earliest date processed: {earliest_date}")
        else:
            print("Unknown counts update finished; no dates were updated.")

        return earliest_date

    except Exception as e:
        print(f"Error in update_unknown_count: {e}")
        try:
            conn.rollback()
        except Exception:
            pass
    finally:
        conn.close()
def catch_up_missing_coeffs():
    """
    For each event_code, if there is a trailing sequence of NULL obs/coeff at the end (most recent events),
    run build_coeff_query for all event_numbers in that trailing NULL sequence, from oldest to newest.
    Returns the earliest event_date that was updated, or None if nothing was updated.
    """
    conn, cursor, *_ = connections()

    # Get all event_codes
    cursor.execute("SELECT DISTINCT event_code FROM parkrun_events")
    event_codes = [row[0] for row in cursor.fetchall()]

    earliest_date = None

    for event_code in event_codes:
        # Get all events for this code, ordered by event_number ascending
        sql, params = build_getEvents_query(event_code)
        fSql = flatten_sql(sql)
        cursor.execute(sql, params)
        rows = cursor.fetchall()

        # Find the trailing sequence of NULLs at the end
        to_process = []
        for event_number, event_date, coeff, obs, coeff_event in rows:
            if coeff is None or obs is None:
                to_process.append((event_number, event_date))
            else:
                break  # Stop at the first non-NULL (from the end)

        # Reverse to_process so we process from oldest to newest
        for event_number, event_date in reversed(to_process):
            print(f"Updating event_code={event_code}, event_number={event_number} (date={event_date})")
            sql, params = build_coeff_query(event_code, event_number)
            #fSql = flatten_sql(sql, params)

            cursor.execute(sql, params)
            # Track the earliest date updated
            event_date_iso = to_yyyy_mm_dd(event_date)
            if earliest_date is None or event_date_iso < earliest_date:
                earliest_date = event_date_iso

    conn.commit()
    conn.close()
    return earliest_date
def catch_up_missing_weighted_coeffs():
    """
    For each event_code and formatted_date in parkrun_events,
    if obs_w or coeff_w is NULL, calculate normalized_weighted_avg_time_ratio
    using build_wghtCoeff_query, then update using build_wghtCoeffUpdate_query.
    Returns the earliest formatted_date updated, or None if nothing was updated.
    """
    conn, cursor, *_ = connections()
    earliest_date = None

    # Get all event_codes and formatted_dates with missing obs_w or coeff_w
    cursor.execute("""
        SELECT DISTINCT event_date,substr(event_date, 7, 4) || '-' || substr(event_date, 4, 2) || '-' || substr(event_date, 1, 2) AS formatted_date
        FROM parkrun_events
        WHERE obs_w IS NULL OR coeff_w IS NULL
        ORDER BY formatted_date ASC
    """)
    rows = cursor.fetchall()

    for row in rows:
        #print(f"Processing event_code={event_code}, formatted_date={formatted_date}")
        event_date = row[0]
        formatted_date = row[1]
        # Get normalized_weighted_avg_time_ratio using build_wghtCoeff_query
        sql, params = build_wghtCoeff_query(event_date)
        cursor.execute(sql, params)
        conn.commit()
        print(f"Updated coeff_w/obs_w for formatted_date={formatted_date}")

        # Track earliest date updated
        if earliest_date is None or formatted_date < earliest_date:
            earliest_date = formatted_date

    conn.close()
    return earliest_date

def check_and_update_events():
    """
    Runs a check on the latest event row. If coeff, obs, and coeff_event are all NULL,
    it calls run_update_for_coeffs_and_obs and then update_coeff_event_for_all_weeks.
    """
    print("Updating time_ratio/appearances...")
    earliest_date = update_eligible_times_for_all_weeks()
    copy_table_to_postgres(
        table_name="eventpositions",
        key_columns=["event_code", "event_date", "athlete_code"],
        fields=["event_eligible_appearances", "time_ratio"],
        earliest_date=earliest_date)
    
    print("Updating coeffs/obs...")
    earliest_date = catch_up_missing_coeffs()
    print("Updating Postgres database from ",earliest_date)
    copy_table_to_postgres(
        table_name="parkrun_events",
        key_columns=["event_code", "event_date", "event_number"],
        fields=["coeff", "obs"],
        earliest_date=earliest_date)
    
    #print("Updating Weighted coeffs/obs...")
    #earliest_date = catch_up_missing_weighted_coeffs()
    #print("Updating Postgres database from ",earliest_date)
    #copy_table_to_postgres(
    #    table_name="parkrun_events",
    #    key_columns=["event_code", "event_date", "event_number"],
    #    fields=["coeff_w", "obs_w"],
    #    earliest_date=earliest_date)
    
    print("Updating coeff_event...")
    earliest_date =update_event_column_for_all_weeks(
        column_name='coeff_event',
        build_window_summary_fn=build_window_summary_coeff,
        build_update_rows_fn=build_update_rows_coeff,
        update_db_fn=update_db_coeff,
        window_size=15)
    copy_table_to_postgres(
        table_name="parkrun_events",
        key_columns=["event_code", "event_date", "event_number"],
        fields=["coeff_event"],
        earliest_date=earliest_date)
    
    print("Updating tourist calcs: adjusted time, ratio and event_count_code...")
    earliest_date = update_tourist_fields_for_all_weeks()
    #earliest_date='2011-01-01'
    #copy_table_to_postgres(
    #    table_name="eventpositions",
    #    key_columns=["event_code", "event_date", "athlete_code"],
    #    fields=["adj_time_seconds", "adj_time_ratio", "event_code_count"],
    #    earliest_date=earliest_date)

    print("Updating tourist flags: flag for T and F for first-time participants...")
    earliest_date = update_tourist_flag_for_all_weeks(earliest_date)  
    copy_table_to_postgres(
        table_name="eventpositions",
        key_columns=["event_code", "event_date", "athlete_code"],
        fields=["adj_time_seconds", "adj_time_ratio", "event_code_count", "tourist_flag", "last_event_code_count", "total_runs"],
        earliest_date=earliest_date)
    
    
    #earliest_date='2025-09-27'
    print("Updating athletes min_dob, max_dob and age_estimate...")
    updated_earliest = update_athletes_dob_and_age_impacts1(earliest_date)
    #avg_age_estimate - is copied to Postgres below
    # Sync athletes rows (insert or update) to Postgres for any athletes changed since updated_earliest
    #updated_earliest = '2011-01-01'
    if updated_earliest:
        copy_table_to_postgres(
            table_name="athletes",
            key_columns=["athlete_code"],
            fields=["name", "club", "min_dob", "last_age_estimate", "max_dob", "last_updated", "current_age_estimate"],
            earliest_date=updated_earliest,
            date_column="last_updated",
            date_is_iso=True,
        )
        updated_earliest='2025-10-04'
        print("Updating athletes min_dob, max_dob and age_estimate...for eventpositions")
        update_athletes_dob_and_age_impacts(updated_earliest)
        copy_table_to_postgres(
            table_name="eventpositions",
            key_columns=["event_code", "event_date", "athlete_code"],
            fields=["age_ratio_male", "age_ratio_sex"],
            earliest_date=updated_earliest,
            updateOnly=True)
    else:
        print("No athlete updates detected or updater returned None; skipping Postgres sync for athletes.")

    print("Updating parkruners...")
    earliest_date = update_parkrunners_stats()
    #earliest_date = '2011-02-19'
    copy_table_to_postgres(
        table_name="parkrun_events",
        key_columns=["event_code", "event_date", "event_number"],
        fields=['eligible_time_count','recentBest_count','pb_count','club_count','returners_count','first_timers_count'],
        earliest_date=earliest_date,
        updateOnly=True)
    
    print("Updating unknowns...")
    earliest_date = update_unknown_count()
    #earliest_date = '2011-02-19'
    copy_table_to_postgres(
        table_name="parkrun_events",
        key_columns=["event_code", "event_date", "event_number"],
        fields=['unknown_count'],
        earliest_date=earliest_date,
        updateOnly=True)

    print("Updating super_tourist count for eventpositions ...")
    earliest_date = update_super_tourists()
    copy_table_to_postgres(
        table_name="eventpositions",
        key_columns=["event_code", "event_date", "athlete_code"],
        fields=["super_tourist"],
        earliest_date=earliest_date,
        updateOnly=True)
    print("Updating super_tourist count for parkrun_events ...")
    earliest_date = update_super_Tourists_count()
    #earliest_date='2020-01-01'
    copy_table_to_postgres(
        table_name="parkrun_events",
        key_columns=["event_code", "event_date", "event_number"],
        fields=["super_tourist_count"],
        earliest_date=earliest_date,
        updateOnly=True)
    
    
    print("Updating AvgAge...")
    update_avg_age_estimate()

    print("Updating Regulars...")
    earliest_date1 = update_regulars(earliest_date)

    print("Updating AvgTimes...")
    earliest_date =update_event_column_for_all_weeks(
        column_name='avg_time',  # or any of the three, just for the gap check
        build_window_summary_fn=build_window_summary_avg_time,
        build_update_rows_fn=build_update_rows_avg_time_wrapper,
        update_db_fn=update_db_avg_time_wrapper,
        window_size=15
    )
    if earliest_date1 is not None and (earliest_date is None or earliest_date1 < earliest_date):
        earliest_date = earliest_date1
    copy_table_to_postgres(
        table_name="parkrun_events",
        key_columns=["event_code", "event_date", "event_number"],
        #key_columns=["event_date"],
        fields=["avg_time", "avgTimeLim12", "avgTimeLim5", "avg_age", "regulars"],
        date_column="event_date",
        date_is_iso=False ,
        earliest_date=earliest_date)

    # ------------------------------------------------------------------
    # Update tourist_count using the generic windowed updater
    # ------------------------------------------------------------------
    print("Updating tourist_count...")
    earliest_date = update_event_column_for_all_weeks(
        column_name='tourist_count',
        build_window_summary_fn=build_window_summary_avg_time,  # no-op builder is fine
        build_update_rows_fn=build_update_rows_tourist_count_wrapper,
        update_db_fn=update_db_tourist_count,
        window_size=15)
    copy_table_to_postgres(
        table_name="parkrun_events",
        key_columns=["event_code", "event_date", "event_number"],
        fields=["tourist_count"],
        earliest_date=earliest_date)

