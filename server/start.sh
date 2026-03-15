#!/bin/bash

echo "Configuring PostgreSQL folders..."
mkdir -p /run/postgresql
chown -R postgres:postgres /run/postgresql
mkdir -p /var/lib/postgresql/data
chown -R postgres:postgres /var/lib/postgresql/data

echo "Initializing Database..."
su - postgres -c "initdb -D /var/lib/postgresql/data" || true

echo "Starting PostgreSQL..."
su - postgres -c "pg_ctl start -D /var/lib/postgresql/data -l /var/lib/postgresql/data/serverlog" || true

echo "Waiting for PostgreSQL to boot..."
sleep 5

echo "Setting up database user and tables..."
# Using || true to prevent the script from crashing if they already exist across restarts
su - postgres -c "psql -c \"CREATE USER myadmin WITH PASSWORD 'swayam06';\"" || true
su - postgres -c "psql -c \"CREATE DATABASE emergency_db OWNER myadmin;\"" || true
su - postgres -c "psql -c \"GRANT ALL PRIVILEGES ON DATABASE emergency_db TO myadmin;\"" || true

echo "Seeding ambulances..."
npm run seed

echo "Starting Node.js Application..."
npm run start