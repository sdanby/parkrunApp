"""Compatibility runner for the canonical materialized-view inspection tool."""

import runpy

from tools.inspect_mvs import *


if __name__ == '__main__':
    runpy.run_module('tools.inspect_mvs', run_name='__main__')
