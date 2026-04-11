#!/bin/bash

rm -f workcalc.sqlite ; echo '.read workcalc.sql' | sqlite3 workcalc.sqlite
