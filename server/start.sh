#!/bin/bash
mkdir -p /run/postgresql
su - postgres -c "initdb -D /var/lib/postgresql/data" || true
su - postgres -c "pg_ctl start -D /var/lib/postgresql/data -l /var/lib/postgresql/data/serverlog" || true

sleep 3 
sudo -u postgres psql -c "CREATE USER myadmin WITH PASSWORD 'swayam06';"
sudo -u postgres psql -c "CREATE DATABASE emergency_db OWNER myadmin;"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE emergency_db TO myadmin;"
echo "Starting Noded server...."
npm run seed
npm run start