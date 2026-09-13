"""Compatibility runner for the canonical test-db harness."""

import runpy

from tools.test_db import *


if __name__ == '__main__':
    runpy.run_module('tools.test_db', run_name='__main__')
