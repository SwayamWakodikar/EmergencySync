# EmergencySync

EmergencySync is a full-stack web application featuring a Node.js & Express backend, a PostgreSQL database, and a React frontend built with Vite and TypeScript.

## 🏗️ Project Structure

The project is divided into two main parts:

- `client/` - Frontend application using React, Vite, and TypeScript.
- `server/` - Backend API using Node.js, Express, Prisma, and PostgreSQL.
- `docker-compose.yml` - Docker configuration to easily spin up the database and backend.

## 🚀 Tech Stack

**Frontend:**
- React (v19)
- TypeScript
- Vite

**Backend:**
- Node.js
- Express
- Prisma (ORM)
- PostgreSQL

**Containerization:**
- Docker & Docker Compose

## 🛠️ Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) installed
- [Docker desktop](https://www.docker.com/products/docker-desktop/) (optional, but highly recommended for the database)

### Installation

1. Clone the repository to your local machine.
2. Install dependencies for both the client and the server:

```bash
# Install Server dependencies
cd server
npm install

# Install Client dependencies
cd ../client
npm install
```

### Running the Application

There are multiple ways to run the project.

#### Option 1: Using Docker (Recommended)

1. Ensure Docker Desktop is running.
2. At the root of the project, run:
```bash
docker-compose up -d
```
This will start the PostgreSQL database and the backend server on port 5000.

3. Navigate to the client directory and start the frontend development server:
```bash
cd client
npm run dev
```

#### Option 2: Manual Setup

If you prefer not to use Docker, you need a running PostgreSQL instance on your system.

1. **Setup Environment:** In the `server` directory, create a `.env` file and configure your database connection string and any necessary environment variables.
2. **Sync Database:** Run Prisma migrations (if applicable).
3. **Start the Server:**
```bash
cd server
npm run dev
```
4. **Start the Client:**
```bash
cd client
npm run dev
```

## 📜 License

See the `LICENSE` file for details.
