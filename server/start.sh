#!/bin/bash

# Unset DATABASE_URL so the app uses the local Postgres instance instead of trying to connect to a remote one with SSL
unset DATABASE_URL

# Initialize database if data directory is empty
if [ -z "$(ls -A /var/lib/postgresql/data)" ]; then
    echo "Initializing database..."
    su-exec postgres initdb -D /var/lib/postgresql/data
fi

# Start PostgreSQL in the background
echo "Starting PostgreSQL..."
su-exec postgres pg_ctl -D /var/lib/postgresql/data -l /var/lib/postgresql/data/serverlog start

# Wait for PostgreSQL to start
echo "Waiting for PostgreSQL to become available..."
until su-exec postgres pg_isready; do
    sleep 1
done

echo "PostgreSQL is ready."

# Start the Node.js app
echo "Starting Node.js server..."
npm run render-start