# Real-Time Chat Platform

A highly scalable, real-time chat system built with microservices architecture and a fully automated CI/CD pipeline.

## Architecture

```
Frontend (Next.js) → API Gateway (NGINX) → Microservices (NestJS) → Databases (PostgreSQL, MongoDB, Redis) + Message Broker (RabbitMQ)
```

## Microservices

| Service | Port | Database | Responsibility |
|---------|------|----------|---------------|
| User Service | 3001 | PostgreSQL | Authentication, user profiles |
| Chat Service | 3002 | MongoDB | Chat rooms, WebSocket gateway |
| Message Service | 3003 | MongoDB | Message persistence, history |
| Notification Service | 3004 | Redis | Alerts, push notifications |
| Presence Service | 3005 | Redis | Online/offline tracking |

## Tech Stack

- **Frontend**: Next.js, React, Tailwind CSS
- **Backend**: Node.js, NestJS
- **Databases**: PostgreSQL, MongoDB, Redis
- **Message Broker**: RabbitMQ
- **API Gateway**: NGINX
- **Containerization**: Docker
- **Orchestration**: Kubernetes
- **CI/CD**: GitHub Actions
- **Monitoring**: Prometheus + Grafana

## Getting Started

### Prerequisites

- Node.js 22+
- Docker & Docker Compose
- kubectl (for Kubernetes deployment)

### Local Development

```bash
# Clone the repository
git clone <repo-url>
cd Project

# Copy environment variables
cp .env.example .env

# Start all services with Docker Compose
docker compose up -d

# Access the application
open http://localhost:80
```

### Running Individual Services

```bash
# Install dependencies for a service
cd services/user-service
npm install

# Run in development mode
npm run start:dev
```

## Project Structure

```
├── frontend/                   # Next.js frontend
├── services/
│   ├── user-service/          # User auth & profiles
│   ├── chat-service/          # Chat rooms & WebSocket
│   ├── message-service/       # Message storage
│   ├── notification-service/  # Notifications
│   └── presence-service/      # Online status
├── gateway/                   # NGINX configuration
├── k8s/                       # Kubernetes manifests
├── .github/workflows/         # CI/CD pipelines
├── monitoring/                # Prometheus & Grafana
├── testing/                   # k6, Postman tests
├── docker-compose.yml         # Local development
└── docker-compose.override.yml
```
