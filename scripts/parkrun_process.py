import os
import process_data,time,sys
from scripts.scraper_tools import create_webdriver,WebDriverWait,check_page_not_found,extract_event_details,select_detailed_view,load_more_results
from scripts.scraper_tools import findElements,findElementsTAG,get_parkrun_events
from scripts.database_helpers import get_or_insert_event_code,record_exists,main_process_function,update_parkrun_events

def human_check_pause(driver, url: str):
    markers = (
        "verify you are human",
        "checking your browser",
        "captcha",
        "cloudflare",
        "attention required",
        "just a moment",
    )
    try:
        content = f"{driver.title}\n{driver.page_source}".lower()
    except Exception:
        content = ""

    if any(m in content for m in markers):
        print(f"Human check detected for {url}. Complete it in the browser.")
        check_mode = str(os.getenv('PARKRUN_HUMAN_CHECK_MODE') or 'prompt').strip().lower()
        if check_mode in ('skip', 'auto', 'noninteractive'):
            print('PARKRUN_HUMAN_CHECK_MODE is non-interactive; skipping manual pause.')
            time.sleep(1)
            return
        try:
            input("Press Enter to continue once done... ")
        except EOFError:
            print("No interactive console detected; waiting 30 seconds...")
            time.sleep(30)
        time.sleep(1)

def processResults(results_rows,event_code,event_date):
    collected_data = []  # Create a list to collect all processed row data
    # Process each row to get data for CSV and database
    last_position=0
    for row in results_rows:
        columns = findElementsTAG(row)
        # Process each row and get data for CSV
        processed_row = process_data.process_row_csv(columns, event_code, event_date)
        #processed_row = process_row_csv(columns, event_code, event_date)
        if processed_row:
            collected_data.append(processed_row)
            last_position=processed_row[2]
    return collected_data,last_position
def process_event_url(driver,cursor, render_cursor, url, event_code, parkrun_name, conn,render_db_conn):
    """
    Processes a URL to scrape parkrun results, checks for page loading issues,
    and extracts data from the page to insert into the eventpositions table.

    :param driver: The Selenium WebDriver instance
    :param cursor: SQLite cursor object for database operations
    :param wait: WebDriverWait object to manage wait times
    :param url: The URL to scrape for event results
    :param event_code: The unique event code corresponding to the event
    :param parkrun_name: The name of the parkrun
    :param updateFlag: Boolean flag to dictate whether to update or insert records
    """
    # Define the path where you want to store the database
    wait=WebDriverWait(driver, 8)

  # Get or insert the event code for the parkrun before processing the event
    event_code = get_or_insert_event_code(conn, cursor,render_db_conn,render_cursor, parkrun_name)
    attempt = 0
    max_attempts = 3
    success = False
    localdbstatus=False
    renderdbstatus=False

    # Retry loading the URL
    while attempt < max_attempts and not success:
        try:
            driver.get(url)  # Attempt to load the URL
            human_check_pause(driver, url)
            print(f"Successfully loaded URL: {url}")
            success = True

            # Wait for the page to load
            driver.maximize_window()

            # Check for "Page not found" error
            if check_page_not_found(wait):
                print("Page not found error detected. Exiting the process.")
                #driver.quit()  # Make sure to close the driver before exiting
                #sys.exit()  # Exit if the page is not found
                print(f"Page not found for URL: {url}. Skipping this event.")
                return False # Skip further processing for this URL
            
            event_number, vol_no = get_parkrun_events(driver)
            if event_number is None:
                print(f"Event number missing on first pass for URL: {url}. Re-checking after pause...")
                human_check_pause(driver, url)
                event_number, vol_no = get_parkrun_events(driver)
            if event_number is None or event_number >= 10000:
                print(f"Invalid event number for URL: {url}. Skipping this event.")
                return False # Skip if the event number is invalid

           # event_number, vol_no=get_parkrun_events(driver)
           # if (event_number==None): event_number=0
           # print(f"Event Number - ",event_number)
           # if (event_number<10000):
                # Call the function to extract event name and date
            event_name, event_date = extract_event_details(wait)

            # Check if the record already exists in eventpositions
            #if not updateFlag:  # Only check if the flag is False
            if record_exists(cursor, event_code, event_date,0):
                print(f"Event {event_code} on {event_date} already exists for LOCAL database. Skipping to next event.")
                localdbstatus=True
            # Check if the record already exists in render eventpositions
            #if not updateFlag:  # Only check if the flag is False
            if record_exists(render_cursor, event_code, event_date,1):
                print(f"Event {event_code} on {event_date} already exists for RENDER database. Skipping to next event.")
                renderdbstatus=True
            noProcess=False
            if localdbstatus & renderdbstatus:
                return False # Skip further processing if both records exist
            
            # Call the select_detailed_view function
            if not select_detailed_view(wait):
                return False # If there's an error selecting detailed view, skip further processing

            # Call the function to load more results
            load_more_results(wait)
            print("Loading more results...")

            # Find the data you want to scrape using the correct CSS selector
            results_rows = findElements(driver)
            print(f"Number of rows found: {len(results_rows)}")
            processed_rows,last_position=processResults(results_rows,event_code,event_date)
            print(f"Number of processed rows: {len(processed_rows)}")
            last_position = main_process_function(cursor,render_cursor, processed_rows, last_position, event_code, event_date,localdbstatus,renderdbstatus)
            print('Last position =', last_position)
            if last_position>0:
                event_number,volunteersNo = get_parkrun_events(driver)
                update_parkrun_events(cursor, render_cursor,event_code,event_date,last_position,event_number,volunteersNo,parkrun_name)
            return True  # Return True if the process was successful
        except Exception as e:
            attempt += 1
            print(f"Attempt {attempt} failed: {e}")
            if attempt == max_attempts:  # Max attempts reached
                print(f"Max attempts reached for URL: {url}. Moving to the next event.")
            time.sleep(5)  # Wait before the next attempt
def process_parkrun_history(driver, cursor, render_cursor, conn, render_db_conn, event_code, event_name):
    try:
        print(f"Processing specific Parkrun: {event_name}")
        
        # Query to find the maximum event_number for the given parkrun_name
        cursor.execute('''
            SELECT MAX(pe.event_number)
            FROM parkrun_events pe
            JOIN eventpositions ep
            ON pe.event_code = ep.event_code AND ep.position = 1 AND pe.event_date = ep.event_date
            WHERE pe.event_code = ? AND pe.last_position > 0;
        ''', (event_code,))
        max_event_number = cursor.fetchone()[0]  # Get the maximum event number
        if (max_event_number is not None):
            print(f"Last event number for {event_name}: {max_event_number}")
            
            # Set the next event number to start from
            start_event_number = (max_event_number + 1) if max_event_number is not None else 1
            
            # Loop through the desired event numbers starting from the last uploaded one
            for event_number in range(start_event_number, 800):  # Adjust upper limit as needed
                # Construct the URL for the current event; this should match the expected URL structure
                url = f'https://www.parkrun.org.uk/{event_name}/results/{event_number}/'
                print(f"In here: start_scraping-single parkrun for {event_name}, event_number: {event_number}")
                if not process_event_url(driver, cursor, render_cursor, url, event_number, event_name, conn, render_db_conn):
                    print(f"Stopping further processing for {event_name} at event number {event_number}.")
                    break  # Stop the loop if process_event_url fails

    except Exception as e:
        print(f"Error processing history for {event_name}: {e}")   