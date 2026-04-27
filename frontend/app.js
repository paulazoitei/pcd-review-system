const ws = new WebSocket("wss://notification-service-5106786869.europe-west1.run.app");

let total = 0;
let positive = 0;
let negative = 0;

const totalEl = document.getElementById("total");
const positiveEl = document.getElementById("positive");
const negativeEl = document.getElementById("negative");
const container = document.getElementById("reviews");

const reviewsMap = {};

function renderReview(id, status) {
  let card = document.getElementById(`review-${id}`);

  if (!card) {
    card = document.createElement("div");
    card.className = "review-card";
    card.id = `review-${id}`;
    container.prepend(card);
  }

  card.innerHTML = `
    <div class="review-id">Review #${id}</div>
    <div class="tag ${status}">
      ${status}
    </div>
  `;
}

function markPending(id) {
  if (reviewsMap[id]) return;

  reviewsMap[id] = "pending";
  total++;
  totalEl.textContent = total;

  renderReview(id, "pending");
}

function markProcessed(id, sentimentLabel) {
  const previousStatus = reviewsMap[id];

  reviewsMap[id] = sentimentLabel;

  if (!previousStatus) {
    total++;
    totalEl.textContent = total;
  }

  if (sentimentLabel === "positive") {
    positive++;
    positiveEl.textContent = positive;
  }

  if (sentimentLabel === "negative") {
    negative++;
    negativeEl.textContent = negative;
  }

  renderReview(id, sentimentLabel);
}

ws.onopen = () => {
  console.log("Connected to WebSocket");
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  markProcessed(data.reviewId, data.sentiment.label);
};

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
    message.textContent = `Review #${reviewId} submitted. Waiting for processing...`;
    document.getElementById("reviewText").value = "";

  } catch (error) {
    console.error(error);
    message.textContent = "Request failed. Check if the API is running.";
  }
});