# Smart AI Diary - Backend Server

## Prerequisites

- Node.js 18+
- npm or pnpm

## Setup

1. Install dependencies:

```bash
cd smart-ai-diary-server
npm install
```

2. Copy environment file:

```bash
cp .env.example .env
```

3. Edit `.env` and add your configuration:

```env
# Server Configuration
PORT=3001
NODE_ENV=development

# Database
DATABASE_PATH=./data/diary.db

# JWT - Change this in production!
JWT_SECRET=your-super-secret-jwt-key-change-in-production

# Frontend URL (for CORS)
FRONTEND_URL=http://localhost:5173

# Google Gemini API Key (get from https://aistudio.google.com/)
API_KEY=your-gemini-api-key
```

4. Start the server:

```bash
# Development mode (auto-reload)
npm run dev

# Or build and run
npm run build
npm start
```

The server will run on `http://localhost:3001`

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Get current user

### Entries
- `GET /api/entries` - Get all entries
- `GET /api/entries/:date` - Get entry for specific date
- `PUT /api/entries/:date` - Create/update entry
- `DELETE /api/entries/:date` - Delete entry

### AI
- `POST /api/ai/summary` - Generate "My Day" summary
- `POST /api/ai/insight` - Generate insight from thoughts

### Upload
- `POST /api/upload` - Upload media file

## Project Structure

```
smart-ai-diary-server/
├── src/
│   ├── index.ts          # Main server entry
│   ├── db/
│   │   └── database.ts   # SQLite database setup
│   ├── routes/
│   │   ├── auth.ts       # Authentication routes
│   │   ├── entries.ts    # Diary entries routes
│   │   ├── upload.ts     # File upload routes
│   │   └── ai.ts         # AI routes
│   ├── services/
│   │   └── ai.ts        # AI service functions
│   └── middleware/
│       └── auth.ts       # JWT auth middleware
├── uploads/              # Uploaded files
├── data/                 # SQLite database
├── package.json
└── tsconfig.json
```
