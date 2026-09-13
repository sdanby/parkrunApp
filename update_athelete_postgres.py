"""Compatibility shim for the canonical maintenance update-athlete-postgres module."""

from maintenance.update_athlete_postgres import *


if __name__ == '__main__':
    from maintenance.update_athlete_postgres import main

    main()
