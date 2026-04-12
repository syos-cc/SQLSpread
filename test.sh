#!/bin/bash

rm -f test.sqlite ; echo '.read az.sql' | sqlite3 test.sqlite
electron .

