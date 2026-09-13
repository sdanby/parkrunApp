import argparse

from scripts.athlete_runs_etl import scrape_event_volunteers


def build_parser():
    parser = argparse.ArgumentParser(
        description='Scrape and store volunteers for one parkrun event.'
    )
    parser.add_argument('--event-code', type=int, default=None, help='Numeric course code.')
    parser.add_argument(
        '--event-date',
        required=True,
        help='Event date stored in the database, usually DD/MM/YYYY.',
    )
    parser.add_argument(
        '--event-number',
        type=int,
        default=None,
        help='Optional event number. If omitted, it is looked up from parkrun_events using event code and date.',
    )
    parser.add_argument(
        '--event-name',
        default=None,
        help='Optional parkrun URL slug. If omitted, it is looked up from events using event code.',
    )
    parser.add_argument(
        '--keep-browser-open',
        action='store_true',
        help='Leave the Selenium browser open after scraping.',
    )
    return parser


def main():
    args = build_parser().parse_args()
    if args.event_code is None and not args.event_name:
        raise SystemExit('Either --event-code or --event-name is required.')

    result = scrape_event_volunteers(
        event_code=args.event_code,
        event_date=args.event_date,
        event_number=args.event_number,
        event_name=args.event_name,
        retain_browser=args.keep_browser_open,
    )
    print('Volunteer scrape complete:')
    print(
        f"  course={result['event_code']}  date={result['event_date']}  "
        f"event_number={result['event_number']}  event_name={result['event_name']}"
    )
    print(
        f"  volunteer_count={result['volunteer_count']}  last_position={result['last_position']}"
    )
    print(f"  url={result['url']}")


if __name__ == '__main__':
    main()