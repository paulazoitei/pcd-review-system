# Distributed Review Processing and Sentiment Classification System

## Overview

This project implements a distributed cloud-based review processing system built on top of the RealWorld / Conduit API.

Users submit article comments through the frontend. The RealWorld API stores the comment in PostgreSQL, creates a `pending` review document in Firestore, publishes a Pub/Sub message, and immediately returns `202 Accepted` to the frontend. A Cloud Function processes the review asynchronously, calculates the sentiment, stores the final result in Firestore, and publishes a `review-processed` message. The Notification Service receives that message and pushes the final update to the frontend through WebSocket.

The system uses asynchronous processing so the API does not block while sentiment analysis is running.

---

## Final Cloud Architecture

### Cloud Project

```text
pcd-review-system
```

### Active Cloud Services

| Component | Google Cloud Service | Name / URL | Role |
|---|---|---|---|
| RealWorld API | Cloud Run | `https://realworld-api-5106786869.europe-west1.run.app` | Handles users, articles, comments/reviews, creates initial review state, publishes `review-submitted` event |
| Main database | Cloud SQL for PostgreSQL | `pcd-postgres` | Stores users, articles, comments, authentication data |
| Messaging | Pub/Sub | `review-submitted`, `review-processed` | Decouples API, Cloud Function, and Notification Service |
| Review processor | Cloud Function | `processReview` | Consumes `review-submitted`, analyzes sentiment, writes final review state, publishes `review-processed` |
| Review state database | Firestore | Collection: `reviews` | Stores review processing state: `pending`, `processed`, and sentiment result |
| Notification Service | Cloud Run | `https://notification-service-5106786869.europe-west1.run.app` | Listens to `review-processed` and sends real-time WebSocket updates |
| Frontend | Local static frontend | `frontend/index.html` | Sends review requests, opens WebSocket, displays live status |

---

## Important Data Ownership

This project uses two different databases with different responsibilities.

### PostgreSQL / Cloud SQL

Stores the main RealWorld application data:

- users
- articles
- comments
- authentication-related data

The `Comment` table does **not** store the review processing status or sentiment.

### Firestore

Stores only the asynchronous review processing state:

- review id
- review body
- `pending` / `processed` status
- sentiment label and score
- processing timestamp

Firestore does **not** store users or articles.

---

## Architecture Flow

```text
Frontend
   ↓ HTTP POST /api/articles/:slug/comments
RealWorld API (Cloud Run)
   ↓ create comment
PostgreSQL / Cloud SQL
   ↓ create review document with status = pending
Firestore
   ↓ publish review-submitted
Pub/Sub
   ↓ trigger
Cloud Function processReview
   ↓ analyze sentiment
Firestore
   ↓ publish review-processed
Pub/Sub
   ↓ deliver message
Notification Service (Cloud Run)
   ↓ WebSocket update
Frontend
```

---

## Sequence Diagram

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant API as RealWorldAPI
    participant DB as PostgreSQL / Prisma
    participant Firestore
    participant PubSub
    participant Function as Cloud Function
    participant Notification as NotificationService

    Frontend->>Notification: Open WebSocket connection

    User->>Frontend: Submit review
    Frontend->>API: POST /api/articles/:slug/comments

    API->>DB: Create Comment
    API->>Firestore: Create review doc with status = pending
    API->>PubSub: Publish review-submitted message

    API-->>Frontend: 202 Accepted + comment id
    Frontend->>Frontend: Show review as pending

    PubSub->>Function: Deliver review-submitted message
    Function->>Function: Analyze sentiment
    Function->>Firestore: Set status = processed + sentiment
    Function->>PubSub: Publish review-processed message

    PubSub->>Notification: Deliver review-processed message
    Notification-->>Frontend: WebSocket update
    Frontend->>Frontend: Update UI with final sentiment
```

---


---

## Technologies Used

- Node.js
- Express
- TypeScript
- Prisma ORM
- PostgreSQL
- Google Cloud Run
- Google Cloud SQL for PostgreSQL
- Google Cloud Pub/Sub
- Google Cloud Functions
- Google Firestore
- WebSocket (`ws`)
- HTML / CSS / JavaScript
- Docker

---

## Runtime Behavior

### 1. User submits a review

The frontend sends an authenticated request to the RealWorld API:

```http
POST /api/articles/:slug/comments
Authorization: Token <JWT_TOKEN>
Content-Type: application/json
```

Body:

```json
{
  "comment": {
    "body": "This article is awesome"
  }
}
```

### 2. RealWorld API creates the comment

The API stores the comment in PostgreSQL through Prisma.

### 3. RealWorld API creates the pending state

The API creates a Firestore document in the `reviews` collection:

```json
{
  "reviewId": 123,
  "body": "This article is awesome",
  "status": "pending",
  "createdAt": "..."
}
```

### 4. RealWorld API publishes an event

The API publishes a message to the Pub/Sub topic:

```text
review-submitted
```

Example message:

```json
{
  "reviewId": 123,
  "commentId": 123,
  "articleSlug": "example-article",
  "articleId": 1,
  "userId": 1,
  "body": "This article is awesome",
  "status": "pending",
  "submittedAt": "..."
}
```

### 5. API responds immediately

The API returns:

```http
202 Accepted
```

Example response:

```json
{
  "comment": {
    "id": 123,
    "body": "This article is awesome"
  }
}
```

The frontend uses the returned `comment.id` as the review id and displays it as `pending`.

### 6. Cloud Function processes the review

The `processReview` Cloud Function is triggered by the `review-submitted` topic. It calculates sentiment using a rule-based approach.

Current sentiment logic:

| Sentiment | Matching words | Score |
|---|---|---|
| positive | `good`, `great`, `awesome` | `1` |
| negative | `bad`, `terrible`, `awful` | `-1` |
| neutral | any other text | `0` |

### 7. Cloud Function writes the final result

The Cloud Function writes the processed result to Firestore:

```json
{
  "reviewId": 123,
  "body": "This article is awesome",
  "sentiment": {
    "score": 1,
    "label": "positive"
  },
  "status": "processed",
  "processedAt": "..."
}
```

### 8. Cloud Function publishes the final event

The Cloud Function publishes to:

```text
review-processed
```

Example message:

```json
{
  "reviewId": 123,
  "sentiment": {
    "score": 1,
    "label": "positive"
  },
  "status": "processed"
}
```

### 9. Notification Service sends WebSocket update

The Notification Service listens to the `review-processed` topic through the `review-processed-sub` subscription and broadcasts the message to all connected WebSocket clients.

### 10. Frontend updates the UI

The frontend receives the WebSocket message and changes the review from `pending` to its final sentiment:

- `positive`
- `negative`
- `neutral`

---

## API Endpoints




### Create Review / Comment

```http
POST /api/articles/:slug/comments
```

Requires authentication:

```http
Authorization: Token <JWT_TOKEN>
```

Request body:

```json
{
  "comment": {
    "body": "This article is awesome"
  }
}
```

Response:

```http
202 Accepted
```

---

### Get Review Status

```http
GET /api/reviews/:id/status
```

Pending response:

```json
{
  "status": "pending"
}
```

Processed response:

```json
{
  "reviewId": 123,
  "body": "This article is awesome",
  "sentiment": {
    "score": 1,
    "label": "positive"
  },
  "status": "processed",
  "processedAt": "..."
}
```

---

## Frontend Configuration

The frontend is currently local and uses:

```text
frontend/index.html
```

In `frontend/app.js`, the WebSocket URL points to the deployed Notification Service:

```js
const ws = new WebSocket("wss://notification-service-5106786869.europe-west1.run.app");
```

In the frontend form, use the deployed API URL with `/api` at the end:

```text
https://realworld-api-5106786869.europe-west1.run.app/api
```

Then provide:

- article slug
- authorization token
- review text

---



### Cloud Function

| Value | Current configuration |
|---|---|
| Function name | `processReview` |
| Trigger topic | `review-submitted` |
| Output topic | `review-processed` |
| Runtime | Node.js |

In the current code, the output topic is hardcoded as:

```js
const PROCESSED_TOPIC = 'review-processed';
```

### Notification Service

| Value | Current configuration |
|---|---|
| Cloud Run service | `notification-service` |
| Pub/Sub topic | `review-processed` |
| Subscription | `review-processed-sub` |
| WebSocket endpoint | `wss://notification-service-5106786869.europe-west1.run.app` |


---

#

## Cloud Deployment

### 1. Select the project

```bash
gcloud config set project pcd-review-system
```

### 2. Create Pub/Sub topics

```bash
gcloud pubsub topics create review-submitted
gcloud pubsub topics create review-processed
```

If they already exist, this command will fail safely with an "already exists" message.

### 3. Deploy RealWorld API to Cloud Run

Run this from inside `realworld-api/`:

```bash
gcloud run deploy realworld-api \
  --source . \
  --region europe-west1 \
  --allow-unauthenticated \
  --set-env-vars GOOGLE_CLOUD_PROJECT=pcd-review-system,PUBSUB_REVIEW_SUBMITTED_TOPIC=review-submitted,DATABASE_URL="postgresql://pcd:pcd@HOST_DB:5432/realworld?schema=public"
```

Replace `HOST_DB` with the actual Cloud SQL connection host / IP / connection configuration used by the deployed API.

Current deployed URL:

```text
https://realworld-api-5106786869.europe-west1.run.app
```

### 4. Deploy Cloud Function

Run this from inside `sentiment-function/`:

```bash
gcloud functions deploy processReview \
  --runtime=nodejs20 \
  --trigger-topic=review-submitted \
  --entry-point=processReview \
  --region=europe-west1
```

### 5. Deploy Notification Service to Cloud Run

Run this from inside `notification-service/`:

```bash
gcloud run deploy notification-service \
  --source . \
  --region europe-west1 \
  --allow-unauthenticated
```

Current deployed URL:

```text
https://notification-service-5106786869.europe-west1.run.app
```

---

## PowerShell Commands

PowerShell uses the backtick character for multiline commands.

### Deploy RealWorld API

```powershell
gcloud run deploy realworld-api `
  --source . `
  --region europe-west1 `
  --allow-unauthenticated `
  --set-env-vars 'GOOGLE_CLOUD_PROJECT=pcd-review-system,PUBSUB_REVIEW_SUBMITTED_TOPIC=review-submitted,DATABASE_URL=postgresql://pcd:pcd@HOST_DB:5432/realworld?schema=public'
```

### Deploy Notification Service

```powershell
gcloud run deploy notification-service `
  --source . `
  --region europe-west1 `
  --allow-unauthenticated
```

### Deploy Cloud Function

```powershell
gcloud functions deploy processReview `
  --runtime=nodejs20 `
  --trigger-topic=review-submitted `
  --entry-point=processReview `
  --region=europe-west1
```

---


## Consistency Model

The system uses eventual consistency.

```text
pending → processed
```

The API returns quickly with `202 Accepted`, while the final sentiment appears after the asynchronous pipeline finishes.

---

## Resilience

- Pub/Sub decouples services and provides durable message delivery.
- Cloud Function can scale automatically when multiple reviews are submitted.
- Firestore stores the final processing state.
- Notification Service failure does not lose the processed result because the final state remains in Firestore.
- The frontend can recover by calling `GET /api/reviews/:id/status` if a WebSocket message is missed.

---

## Performance Notes

Typical end-to-end processing flow:

```text
API request → Pub/Sub delivery → Cloud Function execution → Firestore write → Pub/Sub delivery → WebSocket update
```

Expected behavior:

- API response: immediate `202 Accepted`
- Final update: usually within a few seconds
- Multiple reviews can be processed concurrently because Pub/Sub and Cloud Functions scale independently

---

## Demo Scenario

1. Open `frontend/index.html`.
2. Enter the API URL:

```text
https://realworld-api-5106786869.europe-west1.run.app/api
```

3. Enter an article slug.
4. Enter a valid authorization token.
5. Submit a review such as:

```text
This article is awesome
```

6. The frontend displays the review as `pending`.
7. Cloud Function processes the review.
8. Firestore stores the result as `processed`.
9. Notification Service sends a WebSocket update.
10. The frontend updates the card to `positive`.

---

## Current Final System Summary

```text
Frontend (local)
  -> HTTP request
RealWorld API (Cloud Run)
  -> PostgreSQL / Cloud SQL for main data
  -> Firestore pending review document
  -> Pub/Sub review-submitted event
Cloud Function processReview
  -> sentiment analysis
  -> Firestore processed review document
  -> Pub/Sub review-processed event
Notification Service (Cloud Run)
  -> WebSocket update
Frontend (local)
  -> live UI update
```

---

## AI Usage

AI tools were used for debugging, documentation support, and architecture explanation. The implementation and final documentation were manually reviewed and adapted for this project.