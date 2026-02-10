import { GoogleGenAI } from '@google/genai';
import db from '../db/database.js';

export const generateMyDaySummary = async (userId: string, entryDate: string): Promise<string> => {
  // Get entry data
  const entry = db.prepare(
    'SELECT id FROM entries WHERE user_id = ? AND date = ?'
  ).get(userId, entryDate) as any;

  if (!entry) {
    return 'No entry found for this date';
  }

  const todos = db.prepare('SELECT * FROM todos WHERE entry_id = ?').all(entry.id);
  const expenses = db.prepare('SELECT * FROM expenses WHERE entry_id = ?').all(entry.id);
  const media = db.prepare('SELECT * FROM media WHERE entry_id = ?').all(entry.id);
  const entryData = db.prepare('SELECT * FROM entries WHERE id = ?').get(entry.id) as any;

  const contentDescription = `
    Todos: ${todos.map((t: any) => `${t.text} (${t.completed ? 'Done' : 'Pending'})`).join(', ')}
    Expenses: ${expenses.map((e: any) => `${e.item}: ${e.amount}`).join(', ')}
    Thoughts: ${entryData.insight || 'None'}
  `;

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `
        Based on the following daily record, write a concise summary (max 15 Chinese characters) for "My Day".
        The summary should be emotional, reflective, or punchy. Return ONLY the text, no punctuation at the end.

        Content: ${contentDescription}
      `,
    });

    const summary = response.text?.trim().slice(0, 15) || 'A meaningful day.';

    // Save summary to entry
    db.prepare(
      'UPDATE entries SET my_day_summary = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).run(summary, entry.id);

    return summary;
  } catch (error) {
    console.error('Gemini AI error:', error);
    return 'Something went wrong.';
  }
};

export const generateInsight = async (userId: string, entryDate: string, userPrompt: string): Promise<string> => {
  const entry = db.prepare(
    'SELECT id, insight FROM entries WHERE user_id = ? AND date = ?'
  ).get(userId, entryDate) as any;

  if (!entry) {
    return 'No entry found for this date';
  }

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `
        Based on the user's diary entry and their question, provide thoughtful insight or reflection.
        Keep your response concise and meaningful (max 100 Chinese characters).

        User's entry insight: ${entry.insight || 'None provided'}
        User's question: ${userPrompt}
      `,
    });

    return response.text?.trim() || 'I reflect on your thoughts...';
  } catch (error) {
    console.error('Gemini AI error:', error);
    return 'Something went wrong.';
  }
};
