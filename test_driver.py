"""Compatibility runner for the canonical WebDriver probe."""

import runpy

from tools.test_driver import *


if __name__ == '__main__':
    runpy.run_module('tools.test_driver', run_name='__main__')
