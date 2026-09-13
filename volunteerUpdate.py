"""Compatibility shim for the canonical maintenance volunteer-update module."""

from maintenance.volunteer_update import *


if __name__ == '__main__':
    from maintenance.volunteer_update import main

    main()
