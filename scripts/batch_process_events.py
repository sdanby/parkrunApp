# post_event.py
import requests
import time
from typing import Optional


def post_event(base: str, event_number: int, event_code: Optional[str], event_name: Optional[str], timeout: int = 300) -> int:
    """Post JSON payload to `/process-event/{event_number}` and return HTTP status code.

    Returns 0 on network/request failure, otherwise the integer HTTP status code.
    """
    payload = {}
    if event_code is not None:
        payload['event_code'] = str(event_code)
    if event_name is not None:
        payload['event_name'] = str(event_name)

    url = f"{base.rstrip('/')}/process-event/{event_number}"
    try:
        resp = requests.post(url, json=payload or None, timeout=timeout)
    except Exception as exc:
        print(f"Request failed: {exc}")
        return 0

    print(f"POST {url} -> HTTP {resp.status_code}")
    try:
        j = resp.json()
        print(j)
    except Exception:
        print(resp.text[:1000])

    return resp.status_code


def run_sequence(base: str, jobs: list[tuple[int, Optional[str], Optional[str]]], *,
                 per_call_timeout: int = 300, max_wait_per_job: int = 900, retry_interval: int = 5) -> bool:
    """Run jobs sequentially; wait for each job to complete (HTTP 2xx) before proceeding.

    - `jobs` is a list of tuples: (event_number, event_code, event_name)
    - `per_call_timeout` is the requests timeout for each POST attempt
    - `max_wait_per_job` is the maximum time (seconds) to wait for a job to succeed
    - `retry_interval` is seconds between retry attempts

    Returns True if all jobs succeeded, False if any failed to complete within their max wait.
    """
    for event_number, event_code, event_name in jobs:
        print(f"Starting job: event_number={event_number}, event_code={event_code}, event_name={event_name}")
        start = time.time()
        succeeded = False
        attempt = 0
        while True:
            attempt += 1
            print(f"Attempt {attempt}: POSTing event {event_number} (timeout={per_call_timeout}s)")
            status = post_event(base, event_number, event_code, event_name, timeout=per_call_timeout)
            if status and 200 <= status < 400:
                print(f"Job {event_number} completed with HTTP {status}")
                succeeded = True
                break
            elapsed = time.time() - start
            if elapsed >= max_wait_per_job:
                print(f"Job {event_number} failed to complete within {max_wait_per_job} seconds. Last status={status}")
                break
            print(f"Job {event_number} not complete (status={status}). Waiting {retry_interval}s before retrying...")
            time.sleep(retry_interval)

        if not succeeded:
            print(f"Aborting sequence due to failure on event {event_number}.")
            return False

    print("All jobs completed successfully.")
    return True


if __name__ == '__main__':
    # DEFAULT VALUES - edit as needed
    BASE = "https://4de3491f083a.ngrok-free.app"
    # Create jobs for event numbers 425 through 524 (inclusive)
    JOBS = [ (i, '11', 'harrowlodge') for i in range(425, 525) ]

    #   JOBS = [
    #   (423, '11', 'harrowlodge'),
    #    (424, '11', 'harrowlodge'),
    #]

    # You can tune these values if your backend takes longer
    PER_CALL_TIMEOUT = 300       # seconds to wait for each POST attempt
    MAX_WAIT_PER_JOB = 1800      # seconds to wait for each job to succeed before aborting
    RETRY_INTERVAL = 10          # seconds between retries

    ok = run_sequence(BASE, JOBS, per_call_timeout=PER_CALL_TIMEOUT, max_wait_per_job=MAX_WAIT_PER_JOB, retry_interval=RETRY_INTERVAL)
    if not ok:
        raise SystemExit(1)