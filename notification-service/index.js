const express = require('express');
const { PubSub } = require('@google-cloud/pubsub');
const WebSocket = require('ws');

const app = express();
const pubsub = new PubSub();

const PORT = process.env.PORT || 8080;
const TOPIC = 'review-processed';

// WebSocket server
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

const wss = new WebSocket.Server({ server });

let clients = [];

wss.on('connection', (ws) => {
  console.log('Client connected');
  clients.push(ws);

  ws.on('close', () => {
    clients = clients.filter(c => c !== ws);
  });
});

// Subscribe to Pub/Sub
async function listenForMessages() {
  const subscriptionName = 'review-processed-sub';

  const [subscription] = await pubsub
    .topic(TOPIC)
    .subscription(subscriptionName)
    .get({ autoCreate: true });

  subscription.on('message', (message) => {
    const data = JSON.parse(message.data.toString());

    console.log('Received processed review:', data);

    // broadcast către toți clienții
    clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(data));
      }
    });

    message.ack();
  });
}

listenForMessages().catch(console.error);