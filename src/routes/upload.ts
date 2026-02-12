import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import db from '../db/database.js';
import { AuthRequest, authMiddleware } from '../middleware/auth.js';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.join(__dirname, '../../uploads');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const router = Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = [
      'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
      'image/heic', 'image/heif', 'image/bmp', 'image/tiff', 'image/svg+xml',
      'video/mp4', 'video/webm', 'video/quicktime',
      'audio/mpeg', 'audio/wav', 'audio/ogg'
    ];
    const allowedExtensions = [
      '.jpg', '.jpeg', '.png', '.gif', '.webp', '.heic', '.heif',
      '.bmp', '.tiff', '.tif', '.svg',
      '.mp4', '.webm', '.mov',
      '.mp3', '.wav', '.ogg'
    ];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedMimeTypes.includes(file.mimetype) || allowedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  }
});

// Upload file
router.post('/', authMiddleware, upload.single('file'), async (req: AuthRequest, res: Response) => {
  try {
    const file = req.file;
    const { entryId, entryDate } = req.body;

    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Determine file type by mimetype or extension
    let type: 'image' | 'video' | 'audio';
    const ext = path.extname(file.originalname).toLowerCase();
    const imageExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.heic', '.heif', '.bmp', '.tiff', '.tif', '.svg'];
    const videoExts = ['.mp4', '.webm', '.mov'];
    if (file.mimetype.startsWith('image/') || imageExts.includes(ext)) {
      type = 'image';
    } else if (file.mimetype.startsWith('video/') || videoExts.includes(ext)) {
      type = 'video';
    } else {
      type = 'audio';
    }

    // Convert HEIC/HEIF to JPEG for browser compatibility
    let finalFilename = file.filename;
    if (['.heic', '.heif'].includes(ext)) {
      try {
        const heicConvert = (await import('heic-convert')).default;
        const inputBuffer = fs.readFileSync(file.path);
        const outputBuffer = await heicConvert({
          buffer: inputBuffer,
          format: 'JPEG',
          quality: 0.9
        });
        const jpegFilename = `${uuidv4()}.jpg`;
        const jpegPath = path.join(uploadsDir, jpegFilename);
        fs.writeFileSync(jpegPath, Buffer.from(outputBuffer));
        fs.unlinkSync(file.path);
        finalFilename = jpegFilename;
      } catch (convertErr) {
        console.error('HEIC conversion failed, keeping original:', convertErr);
      }
    }

    const fileUrl = `/uploads/${finalFilename}`;
    const mediaId = uuidv4();

    // If entryId not provided, create or get entry for the date
    let dbEntryId = entryId;
    if (!dbEntryId && entryDate) {
      let entry = db.prepare(
        'SELECT id FROM entries WHERE user_id = ? AND date = ?'
      ).get(req.user!.id, entryDate) as any;

      if (!entry) {
        const newEntryId = uuidv4();
        db.prepare(
          'INSERT INTO entries (id, user_id, date) VALUES (?, ?, ?)'
        ).run(newEntryId, req.user!.id, entryDate);
        dbEntryId = newEntryId;
      } else {
        dbEntryId = entry.id;
      }
    }

    if (dbEntryId) {
      db.prepare(
        'INSERT INTO media (id, entry_id, type, url, name) VALUES (?, ?, ?, ?, ?)'
      ).run(mediaId, dbEntryId, type, fileUrl, file.originalname);
    }

    res.json({
      media: {
        id: mediaId,
        type,
        url: fileUrl,
        name: file.originalname
      }
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// Delete file
router.delete('/:id', authMiddleware, (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const media = db.prepare(
      'SELECT m.*, e.user_id FROM media m JOIN entries e ON m.entry_id = e.id WHERE m.id = ?'
    ).get(id) as any;

    if (!media) {
      return res.status(404).json({ error: 'File not found' });
    }

    if (media.user_id !== req.user!.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Delete file from disk
    const filePath = path.join(__dirname, '../../', media.url);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // Delete from database
    db.prepare('DELETE FROM media WHERE id = ?').run(id);

    res.json({ message: 'File deleted' });
  } catch (error) {
    console.error('Delete file error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
