import { Server, Socket } from 'socket.io';

interface RoomData {
  userId: number;
  partnerId: number;
}

export function setupSocket(io: Server) {
  io.on('connection', (socket: Socket) => {
    console.log('User connected:', socket.id);

    // 加入配对房间
    socket.on('join_room', async (data: RoomData) => {
      const { userId, partnerId } = data;
      const roomId = [userId, partnerId].sort().join('_');
      socket.join(roomId);
      console.log(`User ${userId} joined room ${roomId}`);
    });

    // 离开房间
    socket.on('leave_room', (data: RoomData) => {
      const { userId, partnerId } = data;
      const roomId = [userId, partnerId].sort().join('_');
      socket.leave(roomId);
    });

    // 节点更新广播
    socket.on('node_update', (data: { userId: number; partnerId: number; action: string; payload: any }) => {
      const { userId, partnerId } = data;
      const roomId = [userId, partnerId].sort().join('_');
      socket.to(roomId).emit('node_update', { action: data.action, payload: data.payload });
    });

    // 待办更新广播
    socket.on('todo_update', (data: { userId: number; partnerId: number; action: string; payload: any }) => {
      const { userId, partnerId } = data;
      const roomId = [userId, partnerId].sort().join('_');
      socket.to(roomId).emit('todo_update', { action: data.action, payload: data.payload });
    });

    // 费用更新广播
    socket.on('expense_update', (data: { userId: number; partnerId: number; action: string; payload: any }) => {
      const { userId, partnerId } = data;
      const roomId = [userId, partnerId].sort().join('_');
      socket.to(roomId).emit('expense_update', { action: data.action, payload: data.payload });
    });

    // 备忘录更新广播
    socket.on('memo_update', (data: { userId: number; partnerId: number; action: string; payload: any }) => {
      const { userId, partnerId } = data;
      const roomId = [userId, partnerId].sort().join('_');
      socket.to(roomId).emit('memo_update', { action: data.action, payload: data.payload });
    });

    // 附件更新广播
    socket.on('attachment_update', (data: { userId: number; partnerId: number; action: string; payload: any }) => {
      const { userId, partnerId } = data;
      const roomId = [userId, partnerId].sort().join('_');
      socket.to(roomId).emit('attachment_update', { action: data.action, payload: data.payload });
    });

    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.id);
    });
  });
}
