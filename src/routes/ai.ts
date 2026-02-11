import { Router, Response } from 'express';
import { AuthRequest, authMiddleware } from '../middleware/auth.js';
import { generateMyDaySummary, generateInsight } from '../services/ai.js';

const router = Router();

// Generate "My Day" summary
router.post('/summary', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { todos, expenses, insight } = req.body;

    // 拼接内容描述
    const todosText = (todos || [])
      .map((t: any) => `- ${t.text}（${t.completed ? '已完成' : '未完成'}）`)
      .join('\n');
    const expensesText = (expenses || [])
      .map((e: any) => `- ${e.item}: ¥${e.amount}`)
      .join('\n');
    const thoughts = (insight || '').replace(/<[^>]*>/g, '').trim() || '无';

    const contentDescription = `
【待办事项】
${todosText || '无'}

【今日开销】
${expensesText || '无'}

【心情感悟】
${thoughts}
    `.trim();

    const summary = await generateMyDaySummary(contentDescription);

    res.json({ summary });
  } catch (error) {
    console.error('AI summary error:', error);
    res.status(500).json({ error: 'AI generation failed' });
  }
});

// Generate insight based on user's thoughts
router.post('/insight', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { entryInsight, prompt } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    const insight = await generateInsight(entryInsight || '', prompt);

    res.json({ insight });
  } catch (error) {
    console.error('AI insight error:', error);
    res.status(500).json({ error: 'AI generation failed' });
  }
});

export default router;
