# test_driver.py
from scripts.scraper_tools import create_webdriver
from webdriver_manager.chrome import ChromeDriverManager
import selenium, sys


def main() -> None:
    print("selenium:", selenium.__version__)
    try:
        drv_path = ChromeDriverManager().install()
        print("webdriver_manager installed chromedriver at:", drv_path)
    except Exception as e:
        print("webdriver_manager install failed:", repr(e))

    try:
        drv = create_webdriver(headless=True)
        print("create_webdriver succeeded")
        try:
            drv.get("https://www.parkrun.org.uk/chelmsfordcentral/results/115/")
            print("page title:", drv.title)
        except Exception as e:
            print("driver.get() error:", repr(e))
        try:
            drv.quit()
        except Exception as e:
            print("driver.quit() error:", repr(e))
    except Exception as e:
        print("create_webdriver error:", repr(e))
        sys.exit(1)


if __name__ == '__main__':
    main()