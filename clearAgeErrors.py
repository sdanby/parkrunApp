"""Compatibility shim for the canonical maintenance clear-age-errors module."""

from maintenance.clear_age_errors import *


if __name__ == '__main__':
    from maintenance.clear_age_errors import main

    main()
