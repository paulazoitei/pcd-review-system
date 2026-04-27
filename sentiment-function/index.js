const { Firestore } = require('@google-cloud/firestore');
const { PubSub } = require('@google-cloud/pubsub');

const firestore = new Firestore();
const pubsub = new PubSub();

const PROCESSED_TOPIC = 'review-processed';

function analyzeSentiment(text) {
  const lower = text.toLowerCase();

  if (lower.includes('good') || lower.includes('great') || lower.includes('awesome')) {
    return { score: 1, label: 'positive' };
  }

  if (lower.includes('bad') || lower.includes('terrible') || lower.includes('awful')) {
    return { score: -1, label: 'negative' };
  }

  return { score: 0, label: 'neutral' };
}

exports.processReview = async (message, context) => {
  try {
    const data = JSON.parse(Buffer.from(message.data, 'base64').toString());

    const { reviewId, body } = data;

    const sentiment = analyzeSentiment(body);

    await firestore.collection('reviews').doc(String(reviewId)).set({
      reviewId,
      body,
      sentiment,
      status: 'processed',
      processedAt: new Date().toISOString(),
    });

    await pubsub.topic(PROCESSED_TOPIC).publishMessage({
      json: {
        reviewId,
        sentiment,
        status: 'processed',
      },
    });

    console.log('Processed review:', reviewId);
  } catch (err) {
    console.error('Error processing review:', err);
  }
};