import { WebSocketGateway, SubscribeMessage, MessageBody, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({ cors: true })
export class ChatGateway {
  @WebSocketServer()
  server!: Server;

  @SubscribeMessage('sendMessage')
  handleMessage(@MessageBody() message: { sender: string; content: string }): void {
    this.server.emit('receiveMessage', message);
  }

  @SubscribeMessage('joinRoom')
  handleJoinRoom(@MessageBody() room: string, client: Socket): void {
    client.join(room);
    client.to(room).emit('userJoined', { message: `A user has joined room: ${room}` });
  }

  @SubscribeMessage('leaveRoom')
  handleLeaveRoom(@MessageBody() room: string, client: Socket): void {
    client.leave(room);
    client.to(room).emit('userLeft', { message: `A user has left room: ${room}` });
  }

  @SubscribeMessage('sendPrivateMessage')
  handlePrivateMessage(
    @MessageBody() payload: { sender: string; recipient: string; content: string },
    client: Socket
  ): void {
    const { recipient, ...message } = payload;
    const recipientSocket = Array.from(this.server.sockets.sockets.values()).find(
      (socket) => socket.data.username === recipient
    );

    if (recipientSocket) {
      recipientSocket.emit('receivePrivateMessage', message);
    }
  }
}
