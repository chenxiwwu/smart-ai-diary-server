import { Router, Response } from 'express';
import { AuthRequest, authMiddleware } from '../middleware/auth.js';
import { generateMyDaySummary, generateInsight } from '../services/ai.js';

const router = Router();

// Generate "My Day" summary
router.post('/summary', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { date } = req.body;

    if (!date) {
      return res.status(400).json({ error: 'Date is required' });
    }

    const summary = await generateMyDaySummary(req.user!.id, date);

    res.json({ summary });
  } catch (error) {
    console.error('AI summary error:', error);
    res.status(500).json({ error: 'AI generation failed' });
  }
});

// Generate insight based on user's thoughts
router.post('/insight', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { date, prompt } = req.body;

    if (!date || !prompt) {
      return res.status(400).json({ error: 'Date and prompt are required' });
    }

    const insight = await generateInsight(req.user!.id, date, prompt);

    res.json({ insight });
  } catch (error) {
    console.error('AI insight error:', error);
    res.status(500).json({ error: 'AI generation failed' });
  }
});

export default router;
