#!/bin/sh
set -e
psql -v ON_ERROR_STOP=1 -U postgres -c "CREATE DATABASE mentors_hub OWNER mh_owner"
psql -v ON_ERROR_STOP=1 -U postgres -d mentors_hub -c "ALTER SCHEMA public OWNER TO mh_owner"
