from scripts.scraper_tools import create_webdriver
from scripts.database_helpers import connections
from scripts.parkrun_process import process_event_url


def main() -> None:
    # Define the path where you want to store the database
    conn, cursor, render_db_conn, render_cursor = connections()
    driver = create_webdriver()

    ##################################
    parkrunName = "rodingvalley"
    loopEvents = True  # use this to run a different loop to collect at the beginning of the week
    ##################################

    try:
        if loopEvents:
            # Query to select all events
            cursor.execute('SELECT * FROM events;')
            events = cursor.fetchall()  # Fetch all records from events table
            # Loop through each event for current period
            for event in events:
                event_code = event[0]  # Assuming the first column is event_code
                event_name = event[1]  # Assuming the second column is event_name
                print(f"Processing Event: {event_name} (Code: {event_code})")
                # Construct the URL for the current event using event_name
                url = f'https://www.parkrun.org.uk/{event_name.lower()}/results/latestresults/'
                process_event_url(driver, cursor, render_cursor, url, event_code, event_name, conn, render_db_conn)

        else:
            # Loop through the desired event numbers
            for event_code in range(1, 800):  # Adjust range as needed (1 to 100)
                # Construct the URL for the current event
                url = f'https://www.parkrun.org.uk/{parkrunName}/results/{event_code}/'
                process_event_url(driver, cursor, render_cursor, url, event_code, parkrunName, conn, render_db_conn)

        # Commit the changes and close the database connection
        conn.commit()
        render_db_conn.commit()

    except Exception as e:
        print(f"Error occurred: {e}")
    finally:
        conn.close()
        # Close the browser
        driver.quit()


if __name__ == '__main__':
    main()
