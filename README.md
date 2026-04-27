# Distributed Review Processing and Sentiment Classification System

## Overview

This project implements a distributed cloud-based system for processing and classifying user reviews in real-time.

The system extends the RealWorld (Conduit) REST API by adding asynchronous review processing using Google Cloud services. When a user submits a review (comment), the API immediately returns `202 Accepted`, stores the review as `pending`, and publishes an event to Pub/Sub.

A Cloud Function processes the review, computes sentiment, stores the result in Firestore, and publishes an update that is delivered in real-time to the frontend via a WebSocket Notification Service.

---

## Architecture

### Components

- **Service A (RealWorld API)**  
  Handles user requests, creates reviews, stores initial state (`pending`), and publishes events.

- **Google Cloud Pub/Sub**  
  Messaging system used for asynchronous communication between services.

- **Cloud Function (Sentiment Analyzer)**  
  Triggered by Pub/Sub, processes reviews, computes sentiment, and updates Firestore.

- **Firestore (Database)**  
  Stores review status and sentiment results (stateful component).

- **Notification Service (Cloud Run + WebSocket)**  
  Sends real-time updates to connected clients.

- **Frontend Dashboard**  
  Displays live review processing status and statistics.

---

## System Flow

```text
Client
  → RealWorld API (POST review)
  → Pub/Sub (review-submitted)
  → Cloud Function (processReview)
  → Firestore (store result)
  → Pub/Sub (review-processed)
  → Notification Service (WebSocket)
  → Frontend Dashboard
```

---

## Technologies Used

- Node.js
- Express
- PostgreSQL (Prisma ORM)
- Docker
- Google Cloud Pub/Sub
- Google Cloud Functions (FaaS)
- Google Firestore
- Google Cloud Run
- WebSocket (ws)
- HTML / CSS / JavaScript

---

## Project Structure

```text
pcd-project/
  realworld-api/
  sentiment-function/
  notification-service/
  frontend/
  README.md
```

---

## Local Setup

### 1. Start PostgreSQL (Docker)

```bash
docker run --name pcd-postgres \
  -e POSTGRES_USER=pcd \
  -e POSTGRES_PASSWORD=pcd \
  -e POSTGRES_DB=realworld \
  -p 5433:5432 \
  -d postgres:16
```

### 2. Configure API

In `realworld-api/.env`:

```env
DATABASE_URL="postgresql://pcd:pcd@localhost:5433/realworld?schema=public"
GOOGLE_CLOUD_PROJECT=pcd-review-system
PUBSUB_REVIEW_SUBMITTED_TOPIC=review-submitted
```

### 3. Run API

```bash
cd realworld-api
npx prisma migrate dev
npm start
```

### 4. Run Notification Service (local)

```bash
cd notification-service
node index.js
```

### 5. Run Frontend

Open:

```
frontend/index.html
```

---

## Cloud Deployment

### Cloud Function

```bash
gcloud functions deploy processReview \
  --runtime=nodejs20 \
  --trigger-topic=review-submitted \
  --entry-point=processReview \
  --region=europe-west1
```

### Notification Service (Cloud Run)

```bash
gcloud run deploy notification-service \
  --source . \
  --region europe-west1 \
  --allow-unauthenticated
```

---

## API Endpoints

### Create Review

```
POST /api/articles/:slug/comments
```

Response:

```
202 Accepted
```

---

### Get Review Status

```
GET /api/reviews/:id/status
```

Response:

```json
{
  "status": "pending"
}
```

or

```json
{
  "status": "processed",
  "sentiment": {
    "label": "positive",
    "score": 1
  }
}
```

---

## Sentiment Analysis

A rule-based approach is used:

- **positive**: good, great, awesome  
- **negative**: bad, terrible, awful  
- **neutral**: anything else  

---

## Performance Metrics

### Latency

End-to-end latency:

```
~300ms – 2 seconds
```

Includes:

- API request  
- Pub/Sub delivery  
- Cloud Function execution  
- Firestore write  
- WebSocket delivery  

---

### Throughput

The system handles multiple requests per second due to asynchronous processing.

---

### Consistency

Eventual consistency model:

```
pending → processed (~1 second delay)
```

---

## Resilience

- Pub/Sub ensures message durability  
- Cloud Functions auto-scale  
- Firestore stores final state  
- Notification Service failure does not affect data integrity  

---

## Demo Scenario

1. Open frontend dashboard  
2. Submit a review  
3. Review appears as **pending**  
4. After processing → becomes **processed**  
5. Sentiment displayed in real-time  

---

## AI Usage

AI tools were used for:

- debugging  
- code assistance  
- documentation  

All outputs were manually verified and adapted.
