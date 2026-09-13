# process_data.pyx

from selenium.common.exceptions import NoSuchElementException
from selenium.webdriver.common.by import By
from datetime import datetime
import re

def process_row_csv(list columns, int event_code, str event_date):
    """
    Processes a single row of scraped data.

    :param columns: The list of WebElement column data
    :param event_code: The unique event code
    :param event_date: The event date
    :return: A list containing the processed data or None if the row is invalid
    """
    cdef int position
    cdef str full_name, name, runner_code, gender_info, male_stats
    cdef str malePos, maleCount
    cdef str ageGroup = "Unknown"
    cdef str ageGrade = "Unknown"
    cdef list result = []

    if len(columns) < 6:
        print("Not enough columns in row to process.")
        return None  # Exit if not enough columns

    position = int(columns[0].text.strip())
    full_name = columns[1].text.strip()

    if full_name == 'Unknown':
        return None  # Skip this row if name is 'Unknown'

    # Extract necessary data from columns
    try:
        # Get the anchor tag
        name_element = columns[1].find_element(By.TAG_NAME, 'a')  # Get the anchor tag
        name = name_element.text.strip()  # Get name from the anchor tag
        #runner_code = name_element.get_attribute('href').split('/')[-1]  # Get the unique code from href
        # revised on 20/08/2025 as athlete code changed
        href = name_element.get_attribute('href')
        runner_code = [part for part in href.split('/') if part][-1]

        gender_info = columns[2].text.strip()
        male_stats = gender_info.split('\n')[1] if len(gender_info.split('\n')) > 1 else ''
        malePos, maleCount = (male_stats.split('/') + ["Unknown"])[:2]

        # If the male position is empty, skip this record
        if malePos == '':
            return None

        # Extract Age Group and Age Grade
        age_group_info = columns[3].text.strip()

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
# Added by CO-PILOT
        ## Try to get the number of parkruns (runs) for the athlete.
        ## Primary: read the 'data-runs' attribute from the parent <tr>.
        ## Fallback: parse the visible "detailed" text (e.g. "36 parkruns").
        #runs = None
        #try:
        #    parent_row = columns[0].find_element(By.XPATH, '..')
        #    runs_attr = parent_row.get_attribute('data-runs')
        #    if runs_attr and runs_attr.strip().isdigit():
        #        runs = int(runs_attr.strip())
        #    else:
        #        # fallback: look for a detailed div and parse
        #        try:
        #            detailed_div = columns[1].find_element(By.CLASS_NAME, 'detailed')
        #            m = re.search(r"(\d+)\s+parkrun", detailed_div.text)
        #            if m:
        #                runs = int(m.group(1))
        #        except Exception:
        #            runs = None
        #except Exception:
        #    runs = None

        ## If runs found, append to comment so it is stored without schema changes
        #if runs is not None:
        #    runs_text = f"runs:{runs}"
        #    if comment:
        #        comment = f"{comment} | {runs_text}"
        #    else:
        #        comment = runs_text
        #
        # Add all processed data to the result list
        result.extend([event_code, event_date, position, name, malePos, maleCount, 
                       ageGroup, ageGrade, time_, club, comment, runner_code])
        return result

    except NoSuchElementException:
        print(f"No anchor tag found in column for position {position}.")
        return None  # Exit if there's no anchor tag
