from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from bs4 import BeautifulSoup
import csv
import time
from pathlib import Path


OUTPUT_DIR = Path(__file__).resolve().parent / 'data_samples' / 'csv'
OUTPUT_FILE = OUTPUT_DIR / 'volunteers.csv'

# Optional: run Chrome headless (no window)
chrome_options = Options()
chrome_options.add_argument("--log-level=3")
#chrome_options.add_argument("--headless=new")

driver = webdriver.Chrome(options=chrome_options)
driver.get("https://ems.parkrun.com/")


wait = WebDriverWait(driver, 20)
username_input = wait.until(
    EC.presence_of_element_located((By.XPATH, "//input[@placeholder='parkrun ID']"))
)
password_input = driver.find_element(By.XPATH, "//input[@placeholder='password']")

username_input.send_keys("A528017")
password_input.send_keys("!Jahdac12")

login_button = driver.find_element(By.XPATH, "//button[normalize-space()='login']")
login_button.click()
time.sleep(5)

# Wait for the page to load after login
wait = WebDriverWait(driver, 20)

# Wait for and click the menu button (hamburger)
menu_button = wait.until(
    EC.element_to_be_clickable((By.CSS_SELECTOR, "button[aria-label='open menu']"))
)
menu_button.click()
time.sleep(1)  # Give the menu time to open

# Find the "Volunteer Rosters" link and click it
vol_rosters_link = wait.until(
    EC.element_to_be_clickable((By.CSS_SELECTOR, "a[href='/Vols']"))
)
vol_rosters_link.click()


# Wait for the page to load
time.sleep(5)

# Wait for the button to be clickable
wait = WebDriverWait(driver, 20)
rows = []
events_scraped = 0
events_to_scrape = 50  # or whatever number you want

while events_scraped < events_to_scrape:
    html = driver.page_source
    soup = BeautifulSoup(html, 'html.parser')

    table = soup.find('table')
    thead = table.find('thead')
    date_headers = [th.get_text(strip=True) for th in thead.find_all('th')][1:]

    tbody = table.find('tbody')
    for tr in tbody.find_all('tr'):
        th = tr.find('th')
        if not th:
            continue
        role = " ".join(span.get_text(strip=True) for span in th.find_all('span'))
        tds = tr.find_all('td')
        for i, td in enumerate(tds):
            if events_scraped + i >= events_to_scrape:
                break
            divs = td.find_all('div')
            if len(divs) >= 2:
                name = divs[0].get_text(strip=True)
                code = divs[1].get_text(strip=True).split()[0]
                date = date_headers[i] if i < len(date_headers) else ""
                rows.append([date, role, name, code])
    events_scraped += len(date_headers)

    # Step back 5 events (or however many columns you have)
    for _ in range(len(date_headers)):
        arrow = wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, "button[aria-label='Previous']")))
        arrow.click()
        time.sleep(2)


    # Write to CSV into the sample-data area so repo-root moves do not break exports.
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    with OUTPUT_FILE.open('w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow(['Date', 'Role', 'Name', 'Code'])
        writer.writerows(rows)


print(f"Extracted {len(rows)} volunteers to {OUTPUT_FILE}")