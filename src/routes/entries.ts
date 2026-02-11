import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db/database.js';
import { AuthRequest, authMiddleware } from '../middleware/auth.js';

const router = Router();

// Helper to transform database entry to frontend format
function transformEntry(dbEntry: any) {
  return {
    date: dbEntry.date,
    insight: dbEntry.insight || '',
    myDaySummary: dbEntry.my_day_summary || '',
    todos: dbEntry.todos ? JSON.parse(dbEntry.todos) : [],
    expenses: dbEntry.expenses ? JSON.parse(dbEntry.expenses) : [],
    media: dbEntry.media ? JSON.parse(dbEntry.media) : [],
    lastSavedAt: dbEntry.updated_at
  };
}

// Get all entries for user
router.get('/', authMiddleware, (req: AuthRequest, res: Response) => {
  try {
    const entries = db.prepare(
      `SELECT * FROM entries WHERE user_id = ? ORDER BY date DESC`
    ).all(req.user!.id) as any[];

    const result: Record<string, any> = {};

    for (const entry of entries) {
      const todos = db.prepare('SELECT * FROM todos WHERE entry_id = ?').all(entry.id);
      const expenses = db.prepare('SELECT * FROM expenses WHERE entry_id = ?').all(entry.id);
      const media = db.prepare('SELECT * FROM media WHERE entry_id = ?').all(entry.id);

      result[entry.date] = {
        date: entry.date,
        insight: entry.insight || '',
        myDaySummary: entry.my_day_summary || '',
        todos: todos.map(t => ({ id: t.id, text: t.text, completed: !!t.completed })),
        expenses: expenses.map(e => ({ id: e.id, item: e.item, amount: e.amount })),
        media: media.map(m => ({ id: m.id, type: m.type, url: m.url, name: m.name })),
        lastSavedAt: entry.updated_at
      };
    }

    res.json({ entries: result });
  } catch (error) {
    console.error('Get entries error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get single entry
router.get('/:date', authMiddleware, (req: AuthRequest, res: Response) => {
  try {
    const { date } = req.params;

    const entry = db.prepare(
      'SELECT * FROM entries WHERE user_id = ? AND date = ?'
    ).get(req.user!.id, date) as any;

    if (!entry) {
      return res.json({ entry: null });
    }

    const todos = db.prepare('SELECT * FROM todos WHERE entry_id = ?').all(entry.id);
    const expenses = db.prepare('SELECT * FROM expenses WHERE entry_id = ?').all(entry.id);
    const media = db.prepare('SELECT * FROM media WHERE entry_id = ?').all(entry.id);

    res.json({
      entry: {
        date: entry.date,
        insight: entry.insight || '',
        myDaySummary: entry.my_day_summary || '',
        todos: todos.map(t => ({ id: t.id, text: t.text, completed: !!t.completed })),
        expenses: expenses.map(e => ({ id: e.id, item: e.item, amount: e.amount })),
        media: media.map(m => ({ id: m.id, type: m.type, url: m.url, name: m.name })),
        lastSavedAt: entry.updated_at
      }
    });
  } catch (error) {
    console.error('Get entry error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create or update entry
router.put('/:date', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { date } = req.params;
    const { insight, todos, expenses, media, myDaySummary } = req.body;

    const userId = req.user!.id;

    // Use transaction to ensure atomicity
    const upsertEntry = db.transaction(() => {
      // Check if entry exists
      let entry = db.prepare(
        'SELECT * FROM entries WHERE user_id = ? AND date = ?'
      ).get(userId, date) as any;

      if (!entry) {
        // Create new entry
        const entryId = uuidv4();
        db.prepare(
          'INSERT INTO entries (id, user_id, date, insight, my_day_summary) VALUES (?, ?, ?, ?, ?)'
        ).run(entryId, userId, date, insight || '', myDaySummary || '');
        entry = { id: entryId };
      } else {
        // Update existing entry
        db.prepare(
          'UPDATE entries SET insight = ?, my_day_summary = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
        ).run(insight || '', myDaySummary || '', entry.id);
      }

      // Delete existing todos, expenses, media
      db.prepare('DELETE FROM todos WHERE entry_id = ?').run(entry.id);
      db.prepare('DELETE FROM expenses WHERE entry_id = ?').run(entry.id);
      db.prepare('DELETE FROM media WHERE entry_id = ?').run(entry.id);

      // Insert new todos
      if (todos && Array.isArray(todos)) {
        const insertTodo = db.prepare(
          'INSERT INTO todos (id, entry_id, text, completed) VALUES (?, ?, ?, ?)'
        );
        for (const todo of todos) {
          insertTodo.run(todo.id || uuidv4(), entry.id, todo.text, todo.completed ? 1 : 0);
        }
      }

      // Insert new expenses
      if (expenses && Array.isArray(expenses)) {
        const insertExpense = db.prepare(
          'INSERT INTO expenses (id, entry_id, item, amount) VALUES (?, ?, ?, ?)'
        );
        for (const expense of expenses) {
          insertExpense.run(expense.id || uuidv4(), entry.id, expense.item, expense.amount);
        }
      }

      // Insert new media
      if (media && Array.isArray(media)) {
        const insertMedia = db.prepare(
          'INSERT INTO media (id, entry_id, type, url, name) VALUES (?, ?, ?, ?, ?)'
        );
        for (const m of media) {
          insertMedia.run(m.id || uuidv4(), entry.id, m.type, m.url, m.name || '');
        }
      }

      return entry.id;
    });

    const entryId = upsertEntry();

    // Fetch updated entry (outside transaction for read)
    const updatedEntry = db.prepare(
      'SELECT * FROM entries WHERE id = ?'
    ).get(entryId) as any;

    const updatedTodos = db.prepare('SELECT * FROM todos WHERE entry_id = ?').all(entryId);
    const updatedExpenses = db.prepare('SELECT * FROM expenses WHERE entry_id = ?').all(entryId);
    const updatedMedia = db.prepare('SELECT * FROM media WHERE entry_id = ?').all(entryId);

    res.json({
      entry: {
        date: updatedEntry.date,
        insight: updatedEntry.insight || '',
        myDaySummary: updatedEntry.my_day_summary || '',
        todos: updatedTodos.map((t: any) => ({ id: t.id, text: t.text, completed: !!t.completed })),
        expenses: updatedExpenses.map((e: any) => ({ id: e.id, item: e.item, amount: e.amount })),
        media: updatedMedia.map((m: any) => ({ id: m.id, type: m.type, url: m.url, name: m.name })),
        lastSavedAt: updatedEntry.updated_at
      }
    });
  } catch (error) {
    console.error('Update entry error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete entry
router.delete('/:date', authMiddleware, (req: AuthRequest, res: Response) => {
  try {
    const { date } = req.params;

    const deleteEntry = db.transaction(() => {
      // Find the entry first
      const entry = db.prepare(
        'SELECT id FROM entries WHERE user_id = ? AND date = ?'
      ).get(req.user!.id, date) as any;

      if (entry) {
        // Explicitly delete related records (belt and suspenders with CASCADE)
        db.prepare('DELETE FROM todos WHERE entry_id = ?').run(entry.id);
        db.prepare('DELETE FROM expenses WHERE entry_id = ?').run(entry.id);
        db.prepare('DELETE FROM media WHERE entry_id = ?').run(entry.id);
        db.prepare('DELETE FROM entries WHERE id = ?').run(entry.id);
      }
    });

    deleteEntry();

    res.json({ message: 'Entry deleted' });
  } catch (error) {
    console.error('Delete entry error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
