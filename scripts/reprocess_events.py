from scripts.athlete_runs_etl import main as athlete_runs_main

# Events array generated from the provided table. Dates are in DD/MM/YYYY format
# to match the project's existing date strings where appropriate.
events = [
    (18, '29/11/2025', 704),
]


def main() -> None:
    # resume=False will force processing of the provided list from the start
    athlete_runs_main(resume=False, events_override=events, no_volunteers=True, all_athletes=True)


if __name__ == '__main__':
    main()