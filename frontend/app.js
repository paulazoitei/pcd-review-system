const WS_URL = "wss://notification-service-5106786869.europe-west1.run.app";

let ws = null;

const totalEl = document.getElementById("total");
const positiveEl = document.getElementById("positive");
const negativeEl = document.getElementById("negative");
const neutralEl = document.getElementById("neutral");
const container = document.getElementById("reviews");
const wsStatusEl = document.getElementById("wsStatus");

const reviewsMap = {};
const pollingIntervals = {};

function connectWebSocket() {
  ws = new WebSocket(WS_URL);

  ws.onopen = () => {
    wsStatusEl.textContent = "LIVE";
    wsStatusEl.className = "status live";
    console.log("Connected to WebSocket");
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);

      const reviewId = data.reviewId || data.id;
      const sentimentLabel = data.sentiment?.label || data.label || "neutral";

      if (!reviewId) return;

      markProcessed(reviewId, sentimentLabel);

      const key = String(reviewId);
      if (pollingIntervals[key]) {
        clearInterval(pollingIntervals[key]);
        delete pollingIntervals[key];
      }
    } catch (error) {
      console.error("Invalid WebSocket message:", error);
    }
  };
  
  ws.onerror = (error) => {
    console.error("WebSocket error:", error);
  };

  ws.onclose = () => {
    wsStatusEl.textContent = "RECONNECTING";
    wsStatusEl.className = "status reconnecting";
    console.warn("WebSocket closed. Reconnecting in 2 seconds...");
    setTimeout(connectWebSocket, 2000);
  };
}

connectWebSocket();

function normalizeStatus(status) {
  if (status === "positive") return "positive";
  if (status === "negative") return "negative";
  if (status === "neutral") return "neutral";
  return "pending";
}

function renderReview(id, status) {
  const reviewId = String(id);
  const cleanStatus = normalizeStatus(status);

  let card = document.getElementById(`review-${reviewId}`);

  if (!card) {
    card = document.createElement("div");
    card.className = "review-card";
    card.id = `review-${reviewId}`;
    container.prepend(card);
  }

  card.innerHTML = `
    <div class="review-id">Review #${reviewId}</div>
    <div class="tag ${cleanStatus}">
      ${cleanStatus}
    </div>
  `;
}

function updateCounters() {
  let total = 0;
  let positive = 0;
  let negative = 0;
  let neutral = 0;

  Object.values(reviewsMap).forEach((status) => {
    total++;

    if (status === "positive") positive++;
    if (status === "negative") negative++;
    if (status === "neutral") neutral++;
  });

  totalEl.textContent = total;
  positiveEl.textContent = positive;
  negativeEl.textContent = negative;
  neutralEl.textContent = neutral;
}

function markPending(id) {
  const reviewId = String(id);

  reviewsMap[reviewId] = "pending";
  renderReview(reviewId, "pending");
  updateCounters();
}

function markProcessed(id, sentimentLabel) {
  const reviewId = String(id);
  const cleanSentiment = normalizeStatus(sentimentLabel);

  reviewsMap[reviewId] = cleanSentiment;
  renderReview(reviewId, cleanSentiment);
  updateCounters();
}

async function checkReviewStatus(apiUrl, reviewId) {
  try {
    const response = await fetch(`${apiUrl}/reviews/${reviewId}/status`);
    const data = await response.json();

    if (!response.ok) {
      console.error("Failed to fetch review status:", data);
      return;
    }

    if (data.status === "processed") {
      const sentimentLabel = data.sentiment?.label || "neutral";
      markProcessed(reviewId, sentimentLabel);

      const key = String(reviewId);
      if (pollingIntervals[key]) {
        clearInterval(pollingIntervals[key]);
        delete pollingIntervals[key];
      }
    }
  } catch (error) {
    console.error("Polling failed:", error);
  }
}

function startPolling(apiUrl, reviewId) {
  const key = String(reviewId);

  if (pollingIntervals[key]) {
    clearInterval(pollingIntervals[key]);
  }

  setTimeout(() => {
    checkReviewStatus(apiUrl, key);
  }, 300);

  pollingIntervals[key] = setInterval(() => {
    checkReviewStatus(apiUrl, key);
  }, 1000);

  setTimeout(() => {
    if (pollingIntervals[key]) {
      clearInterval(pollingIntervals[key]);
      delete pollingIntervals[key];
    }
  }, 30000);
}

document.getElementById("submitBtn").addEventListener("click", async () => {
  const apiUrl = document.getElementById("apiUrl").value.trim();
  const slug = document.getElementById("slug").value.trim();
  const token = document.getElementById("token").value.trim();
  const reviewText = document.getElementById("reviewText").value.trim();
  const message = document.getElementById("formMessage");

  if (!apiUrl || !slug || !token || !reviewText) {
    message.textContent = "Please fill in API URL, article slug, token and review text.";
    return;
  }

  try {
    message.textContent = "Submitting review...";

    const response = await fetch(`${apiUrl}/articles/${slug}/comments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Token ${token}`
      },
      body: JSON.stringify({
        comment: {
          body: reviewText
        }
      })
    });

    const result = await response.json();

    if (!response.ok) {
      message.textContent = "Failed to submit review.";
      console.error(result);
      return;
    }

    const reviewId = result.comment.id;

    markPending(reviewId);
    startPolling(apiUrl, reviewId);

    message.textContent = `Review #${reviewId} submitted. Waiting for processing...`;
    document.getElementById("reviewText").value = "";
  } catch (error) {
    console.error(error);
    message.textContent = "Request failed. Check if the API is running.";
  }
});