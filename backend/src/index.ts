import express from 'express';
import cors from 'cors';
import http from 'http';
import { Server } from 'socket.io';
import { initDB } from './db';
import authRoutes from './routes/authRoutes';
import timelineRoutes from './routes/timelineRoutes';
import todoRoutes from './routes/todoRoutes';

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// 路由
app.use('/api/auth', authRoutes);
app.use('/api/timeline', timelineRoutes);
app.use('/api/todos', todoRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// 初始化数据库后启动服务器
initDB().then(() => {
  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}).catch(error => {
  console.error('Failed to initialize database:', error);
  process.exit(1);
});

