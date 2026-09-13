import time
import re
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from webdriver_manager.chrome import ChromeDriverManager
from selenium.common.exceptions import NoSuchElementException, TimeoutException

def create_webdriver():
    # Set up the Chrome WebDriver
    service = Service(ChromeDriverManager().install())
    return webdriver.Chrome(service=service)
def findElements(driver):
    return driver.find_elements(By.CSS_SELECTOR, ".Results-table-row")
def findElementsTAG(row):
    return row.find_elements(By.TAG_NAME, "td")
def check_page_not_found(wait):
    try:
        # Check for the "Page not found" header
        wait.until(EC.visibility_of_element_located((By.XPATH, "//h1[contains(text(), 'Page not found')]")))
        print("Page not found error detected. Stopping the process.")
        return True  # Indicate that the page is not found
    except TimeoutException:
        # If the page is fine, return False
        return False  
def select_detailed_view(wait):
    """
    Clicks the dropdown to select 'Detailed' view and waits for the detailed results to load. 
    :param wait: WebDriverWait object to handle waiting for elements
    """
    try:
        dropdown = wait.until(EC.element_to_be_clickable((By.CLASS_NAME, "js-ResultsSelect")))
        dropdown.click()  # Click the dropdown to open it

        detailed_option = wait.until(EC.element_to_be_clickable((By.XPATH, "//option[@value='detailed']")))
        detailed_option.click()  # Click the 'Detailed' option

        # Wait for the page to load the detailed results
        time.sleep(1)
        return True  # Return True if successful
    except Exception as e:
        print(f"Error while selecting detailed view: {e}")
        return False  # Return False if there was an error    
def extract_event_details(wait):
    """
    Extracts the event name and date from the current page.
    
    :param wait: WebDriverWait object to handle waiting for elements
    :return: A tuple containing the event name and event date 
             or (None, None) if an error occurs
    """
    try:
        # Wait for the event name and date elements to be visible and extract the text
        event_name = wait.until(EC.visibility_of_element_located((By.XPATH, "//div[@class='Results-header']/h1"))).text.strip()
        event_date = wait.until(EC.visibility_of_element_located((By.XPATH, "//span[@class='format-date']"))).text.strip()        
        print(f"Event Name: {event_name}, Event Date: {event_date}")  # Print for debugging
        return event_name, event_date  # Return the extracted values
    except Exception as e:
        print(f"Error while extracting event details: {e}")
        return None, None  # Return None values if there was an issue
def load_more_results(wait):
    """
    Clicks the 'Load More' button until it no longer appears,
    waiting for new results to load each time.

    :param wait: WebDriverWait object to handle waiting for elements
    """
    while True:
        try:
            load_more_button = wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, ".load-more")))
            load_more_button.click()  # Click the "Load More" button
            #time.sleep(1)  # Wait for the new data to load
        except TimeoutException:
            #print("No more 'Load More' button found or it took too long to appear. Finished loading more results.")
            break  # Exit the loop if the button isn't found within a reasonable time
        except Exception as e:
            print(f"Error while loading more results: {e}")  
            break  # Exit the loop for any unexpected exceptions
    #time.sleep(1)  # Wait an additional time to ensure all data is fully loaded
def process_column(columns):
    """
    Processes a row of scraped data and ready for the inserts or updates it in the eventpositions table.
    :param columns: The list of WebElement column data

    """,
    if len(columns) < 6:
        print("Not enough columns in row to process.")
        return  # Exit if not enough columns

    position = int(columns[0].text.strip())
    full_name = columns[1].text.strip()

    if full_name != 'Unknown':
        # Try to find the anchor tag
        try:
            name_element = columns[1].find_element(By.TAG_NAME, 'a')  # Get the anchor tag
            name = name_element.text.strip()  # Get name from the anchor tag
            runner_code = name_element.get_attribute('href').split('/')[-1]  # Get the unique code from href
        except NoSuchElementException:
            print(f"No anchor tag found in column for position {position}.")
            return  # Exit if there's no anchor tag

        # Extract Gender
        gender_info = columns[2].text.strip()
        male_stats = gender_info.split('\n')[1] if len(gender_info.split('\n')) > 1 else ''
        malePos, maleCount = (male_stats.split('/') + ["Unknown"])[:2]  # Handle missing values

        # Extract Age Group and Age Grade
        age_group_info = columns[3].text.strip()
        ageGroup = "Unknown"
        ageGrade = "Unknown"

        if age_group_info:
            parts = age_group_info.split('\n')
            if len(parts) > 0:
                ageGroup = parts[0]
            if len(parts) > 1 and '%' in parts[1]:
                ageGrade = parts[1].strip().split('%')[0] + '%'

        club = columns[4].text.strip()

        # Extract Time and Comment
        time_info = columns[5].text.strip()
        time_ = time_info.split('\n')[0]  # Get the time
        comment = time_info.split('\n')[1] if len(time_info.split('\n')) > 1 else ''  # Get comment if exists
    return position, name, malePos, maleCount, ageGroup, ageGrade, time_, club, comment, runner_code   
def process_row_csv(columns, event_code, event_date):
    """
    Processes a single row of scraped data.
    :param columns: The list of WebElement column data
    :param event_code: The unique event code
    :param event_date: The event date
    :return: A list containing the processed data or None if the row is invalid
    """
    if len(columns) < 6:
        print("Not enough columns in row to process.")
        return None  # Exit if not enough columns

    position = int(columns[0].text.strip())
    #if position == 268:
    #    print(f"{position}")
    full_name = columns[1].text.strip()

    if full_name == 'Unknown':
        return None  # Skip this row if name is 'Unknown'

    # Extract necessary data from columns
    try:
        name_element = columns[1].find_element(By.TAG_NAME, 'a')  # Get the anchor tag
        name = name_element.text.strip()  # Get name from the anchor tag
        runner_code = name_element.get_attribute('href').split('/')[-1]  # Get the unique code from href
        
        gender_info = columns[2].text.strip()
        male_stats = gender_info.split('\n')[1] if len(gender_info.split('\n')) > 1 else ''
        malePos, maleCount = (male_stats.split('/') + ["Unknown"])[:2]
        if malePos=='': # lose this record as likely to cause as error
            return None

        # Extract Age Group and Age Grade
        age_group_info = columns[3].text.strip()
        ageGroup = "Unknown"
        ageGrade = "Unknown"

        if age_group_info:
            parts = age_group_info.split('\n')
            if len(parts) > 0:
                ageGroup = parts[0]
            if len(parts) > 1 and '%' in parts[1]:
                ageGrade = parts[1].strip().split('%')[0] + '%'

        club = columns[4].text.strip()

        # Extract Time and Comment
        time_info = columns[5].text.strip()
        time_ = time_info.split('\n')[0]  # Get the time
        comment = time_info.split('\n')[1] if len(time_info.split('\n')) > 1 else ''  # Get comment if exists

        return [
            event_code, event_date, position, name, malePos, maleCount, 
            ageGroup, ageGrade, time_, club, comment, runner_code
        ]
    except NoSuchElementException:
        print(f"No anchor tag found in column for position {position}.")
        return None  # Exit if there's no anchor tag     
def get_parkrun_events(driver):
    try:
        wait = WebDriverWait(driver, 8)
        event_header = wait.until(EC.presence_of_element_located((By.CLASS_NAME, "Results-header")))
        event_number_text = event_header.find_element(By.TAG_NAME, "h3").text  # e.g., '#413'
        event_number = int(event_number_text.split('#')[1])  # Extract and convert to integer
    except NoSuchElementException:
        title = ""
        current_url = ""
        page_sample = ""
        try:
            title = (driver.title or "").strip()
        except Exception:
            pass
        try:
            current_url = (driver.current_url or "").strip()
        except Exception:
            pass
        try:
            page_sample = (driver.page_source or "")[:500].replace("\n", " ").strip()
        except Exception:
            pass

        markers = (
            "verify you are human",
            "checking your browser",
            "captcha",
            "cloudflare",
            "attention required",
            "just a moment",
            "page not found",
        )
        lower_blob = f"{title} {page_sample}".lower()
        marker_hits = [m for m in markers if m in lower_blob]

        fallback_event_number = None
        try:
            url_match = re.search(r"/results/(\d+)/?", current_url or "")
            if url_match:
                fallback_event_number = int(url_match.group(1))
        except Exception:
            fallback_event_number = None

        if marker_hits:
            print(
                f"Event number not found (likely challenge/reject/layout page). "
                f"URL={current_url or '<unknown>'} title={title or '<no title>'} markers={marker_hits}"
            )
        else:
            print(
                f"Event number not found. URL={current_url or '<unknown>'} "
                f"title={title or '<no title>'}. Results-header/h3 not present."
            )
        if fallback_event_number is not None:
            print(f"Falling back to event number from URL: {fallback_event_number}")
            return fallback_event_number, 0
        return None, 0
    except TimeoutException:
        title = ""
        current_url = ""
        try:
            title = (driver.title or "").strip()
        except Exception:
            pass
        try:
            current_url = (driver.current_url or "").strip()
        except Exception:
            pass

        fallback_event_number = None
        try:
            url_match = re.search(r"/results/(\d+)/?", current_url or "")
            if url_match:
                fallback_event_number = int(url_match.group(1))
        except Exception:
            fallback_event_number = None

        print(
            f"Timed out waiting for Results-header/h3. URL={current_url or '<unknown>'} "
            f"title={title or '<no title>'}."
        )
        if fallback_event_number is not None:
            print(f"Falling back to event number from URL after timeout: {fallback_event_number}")
            return fallback_event_number, 0
        return None, 0

    # Extract volunteers (new card layout first, legacy fallback second)
    volunteersNo = 0
    try:
        value_el = driver.find_element(
            By.CSS_SELECTOR,
            "a[href='#volunteers-table'] .statistics-card.volunteer-credits .value"
        )
        volunteersNo = int((value_el.text or "0").strip().replace(",", ""))
    except Exception:
        try:
            volunteers = driver.find_element(
                By.XPATH,
                '//p[contains(text(), "We are very grateful to the volunteers")]'
            )
            volunteer_links = volunteers.find_elements(By.TAG_NAME, "a")
            volunteersNo = len(volunteer_links)
        except NoSuchElementException:
            print("Volunteer information not found.")
            volunteersNo = 0

    return event_number, volunteersNo


