#!/bin/bash
# This is a colcon workspace: ROS Jazzy registers `launch_testing` pytest plugins
# as global setuptools entry points, and they crash on plain (non-ROS) collection.
# PYTEST_DISABLE_PLUGIN_AUTOLOAD blocks all autoloaded entry-point plugins -- the
# only thing that reliably keeps them out (ini-level `-p no:` loads too late).
PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 exec python3 -m pytest "$@"
