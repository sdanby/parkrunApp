from flask import Flask, jsonify,request
from scripts.database_helpers import connections
import pandas as pd 
from datetime import datetime
import logging
from pathlib import Path
#app = Flask(__name__)
#conn,cursor,render_db_conn,render_cursor=connections()
''''
# Create a combined DataFrame for all event_codes 
    combined_df = pd.DataFrame() 
    for event_code in range(1, 25): # Assuming event_code ranges from 1 to 20 
        event_df = create_table(event_code, conn, render_db_conn) 
        combined_df = pd.concat([combined_df, event_df], ignore_index=True)  
        # Output the combined DataFrame to Excel 
        output_file = _default_excel_output_path() 
        combined_df.to_excel(output_file, index=False) 
        print(f"Data exported to {output_file}")
        #if __name__ == '__main__': app.run(debug=True)
'''

PROJECT_ROOT = Path(__file__).resolve().parent.parent
OUTPUT_DIR = PROJECT_ROOT / 'data_samples' / 'spreadsheets'


def _default_excel_output_path(filename: str = 'parkrun_events.xlsx') -> Path:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    return OUTPUT_DIR / filename


def fetch_data(event_code, conn, render_db_conn): 
    cursor = conn.cursor() 
    render_cursor = render_db_conn.cursor() 
    try: 
        cursor.execute("SELECT event_date, event_number, last_position, volunteers FROM parkrun_events WHERE event_code = ?", (event_code,)) 
        sqlite_data = cursor.fetchall() 
        render_cursor.execute("SELECT event_date, event_number, last_position, volunteers FROM parkrun_events WHERE event_code = %s", (event_code,)) 
        pg_data = render_cursor.fetchall() 
        return sqlite_data, pg_data 
    except Exception as e: 
        logging.error(f"Error in fetch_data: {e}") 
        raise 
    finally: 
        cursor.close() 
        render_cursor.close()
def fetch_max_position(event_code, conn, render_db_conn): 
    # Function to fetch max position for each event date from EventPosition table 
    cursor = conn.cursor() 
    render_cursor = render_db_conn.cursor() 
    try: 
        cursor.execute("SELECT event_date, MAX(position) FROM eventpositions WHERE event_code = ? GROUP BY event_date", (event_code,)) 
        sqlite_max_pos = dict(cursor.fetchall()) 
        render_cursor.execute("SELECT event_date, MAX(position) FROM eventpositions WHERE event_code = %s GROUP BY event_date", (event_code,)) 
        pg_max_pos = dict(render_cursor.fetchall()) 
        return sqlite_max_pos, pg_max_pos 
    except Exception as e: 
        logging.error(f"Error in fetch_max_position: {e}") 
        raise 
    finally: 
        cursor.close() 
        render_cursor.close()
def create_table(event_code, conn, render_db_conn): 
    # Function to create a DataFrame for each event_code 
    sqlite_data, pg_data = fetch_data(event_code, conn, render_db_conn) 
    sqlite_max_pos, pg_max_pos = fetch_max_position(event_code, conn, render_db_conn)
    
    # Extract event dates and ensure they are unique and sorted 
    event_dates = sorted(set([row[0] for row in sqlite_data + pg_data]), key=lambda date: datetime.strptime(date, '%d/%m/%Y')) 
    
    # Build the DataFrame 
    data = {
        'event_code': [event_code] * len(event_dates),
        'event_date': event_dates, 
        'sd_event_number': [next((row[1] for row in sqlite_data if row[0] == date), None) for date in event_dates], 
        'pd_event_number': [next((row[1] for row in pg_data if row[0] == date), None) for date in event_dates], 
        'sd_last_position': [next((row[2] for row in sqlite_data if row[0] == date), None) for date in event_dates], 
        'pd_last_position': [next((row[2] for row in pg_data if row[0] == date), None) for date in event_dates], 
        'sd_volunteers': [next((row[3] for row in sqlite_data if row[0] == date), None) for date in event_dates], 
        'pd_volunteers': [next((row[3] for row in pg_data if row[0] == date), None) for date in event_dates], 
        'sdE_last_position': [sqlite_max_pos.get(date, None) for date in event_dates], 
        'pdE_last_position': [pg_max_pos.get(date, None) for date in event_dates] 
        }
    df = pd.DataFrame(data)
    return df
def get_parkrun_data(event_codes): 
    combined_df = pd.DataFrame() 
    conn, cursor, render_db_conn, render_cursor = connections() 
    for event_code in event_codes: 
        try: 
            logging.info(f"Processing event_code: {event_code}")
            event_df = create_table(event_code, conn, render_db_conn) 
            combined_df = pd.concat([combined_df, event_df], ignore_index=True) 
        except Exception as e: 
            logging.error(f"Error processing event_code {event_code}: {e}") 
            continue
        combined_df = combined_df.astype(object).where(pd.notnull(combined_df), None) 
            #combined_df = insert_missing_events(combined_df) 
    result = combined_df.to_dict(orient='records') 
    return result


def export_parkrun_data_to_excel(event_codes, output_file=None):
    output_path = Path(output_file) if output_file else _default_excel_output_path()
    output_path.parent.mkdir(parents=True, exist_ok=True)
    rows = get_parkrun_data(event_codes)
    pd.DataFrame(rows).to_excel(output_path, index=False)
    logging.info("Data exported to %s", output_path)
    return output_path


def insert_missing_events(df): 
    event_codes = df['event_code'].unique() 
    new_rows = []
    for event_code in event_codes: 
        event_data = df[df['event_code'] == event_code] 
        event_numbers = event_data['sd_event_number'].dropna().unique().tolist() + event_data['pd_event_number'].dropna().unique().tolist() 
        # Safely convert event numbers to integers 
        cleaned_event_numbers = [] 
        for ev in event_numbers: 
            try: 
                event_num_str = str(ev).strip('Ev').split('.')[0] # Remove prefix and handle potential floats 
                cleaned_event_numbers.append(int(event_num_str))
            except ValueError as e: 
                logging.error(f"Error converting event number: {ev} - {e}") 
        
        if cleaned_event_numbers: 
            min_event_num = min(cleaned_event_numbers) 
            max_event_num = max(cleaned_event_numbers) 
            missing_event_numbers = [f"Ev{num}" for num in range(min_event_num, max_event_num + 1) if f"Ev{num}" not in cleaned_event_numbers]
            for missing_event in missing_event_numbers: 
                missing_date = 'missing ev' # Placeholder for the date 
                new_row = {'event_code': event_code, 'event_date': missing_date, 
                        'sd_event_number': missing_event, 'pd_event_number': missing_event, 
                        'sd_last_position': None, 'pd_last_position': None, 
                        'sd_volunteers': None, 'pd_volunteers': None, 
                        'sdE_last_position': None, 'pdE_last_position': None} 
                new_rows.append(new_row) 
        new_rows_df = pd.DataFrame(new_rows) 
        df = pd.concat([df, new_rows_df], ignore_index=True) 
        # Sort the DataFrame by event_date, handling 'missing ev' correctly 
        df['event_date_sortable'] = df['event_date'].apply(lambda x: datetime.strptime(x, '%d/%m/%Y') if x != 'missing ev' else datetime(9999, 1, 1)) 
        df = df.sort_values(by='event_date_sortable').drop(columns='event_date_sortable')  
    return df 

