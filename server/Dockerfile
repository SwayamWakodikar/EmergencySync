FROM node:20.20.1-alpine3.22

# Install PostgreSQL, bash, and su-exec
RUN apk add --no-cache postgresql postgresql-contrib bash su-exec

# Create directories for postgres data and socket, and set permissions
RUN mkdir -p /var/lib/postgresql/data /run/postgresql && \
    chown -R postgres:postgres /var/lib/postgresql /run/postgresql

# Set environment variable for postgres data
ENV PGDATA=/var/lib/postgresql/data

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

# Copy the startup script and make it executable
COPY start.sh /start.sh
# Ensure Linux line endings for the bash script and make executable
RUN sed -i 's/\r$//' /start.sh && chmod +x /start.sh

EXPOSE 10000 5432

CMD ["/start.sh"]
