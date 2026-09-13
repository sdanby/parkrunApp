"""Compatibility shim for the canonical curve-ranks ETL module."""

import runpy

from etl.curved_ranks import *


if __name__ == '__main__':
    runpy.run_module('etl.curved_ranks', run_name='__main__')
