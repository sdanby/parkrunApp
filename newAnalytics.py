"""Compatibility shim for the canonical ETL orchestration module."""

import runpy

from etl.newAnalytics import *


if __name__ == '__main__':
    runpy.run_module('etl.newAnalytics', run_name='__main__')
