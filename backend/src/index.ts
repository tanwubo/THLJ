import express from 'express';
import cors from 'cors';
import http from 'http';
import { Server } from 'socket.io';
import { bootstrapDatabase } from './bootstrap';
import { setupSocket } from './socket';
import authRoutes from './routes/authRoutes';
import timelineRoutes from './routes/timelineRoutes';
import timelineTemplateRoutes from './routes/timelineTemplateRoutes';
import todoRoutes from './routes/todoRoutes';
import expenseRoutes from './routes/expenseRoutes';
import memoRoutes from './routes/memoRoutes';
import attachmentRoutes from './routes/attachmentRoutes';
import { getCorsOrigin } from './config/cors';

const app = express();
const server = http.createServer(app);

const corsOrigin = getCorsOrigin({
  nodeEnv: process.env.NODE_ENV,
  corsOrigins: process.env.CORS_ORIGINS,
});

const io = new Server(server, {
  cors: {
    origin: (origin, callback) => callback(null, corsOrigin(origin)),
    credentials: true,
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: (origin, callback) => callback(null, corsOrigin(origin)),
  credentials: true,
}));
app.use(express.json());
app.use(express.static('public'));

// 路由
app.use('/api/auth', authRoutes);
app.use('/api/timeline', timelineRoutes);
app.use('/api/timeline-templates', timelineTemplateRoutes);
app.use('/api/todos', todoRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/memos', memoRoutes);
app.use('/api/attachments', attachmentRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

setupSocket(io);

// 初始化数据库后启动服务器
bootstrapDatabase().then(() => {
  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}).catch(error => {
  console.error('Failed to initialize database:', error);
  process.exit(1);
});

