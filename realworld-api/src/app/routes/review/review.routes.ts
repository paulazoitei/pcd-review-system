import express from 'express';
import { getReviewStatus } from './review.service';

const router = express.Router();

router.get('/reviews/:id/status', async (req, res) => {
  try {
    const data = await getReviewStatus(req.params.id);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch review status' });
  }
});

export default router;