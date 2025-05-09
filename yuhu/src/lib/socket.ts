import { io } from 'socket.io-client';

// Connect to the backend WebSocket server
const socket = io('http://localhost:3000');

// Function to send a message
export const sendMessage = (message: { sender: string; content: string }) => {
  socket.emit('sendMessage', message);
};

// Function to send a private message
export const sendPrivateMessage = (message: { sender: string; recipient: string; content: string }) => {
  socket.emit('sendPrivateMessage', message);
};

// Listen for incoming messages
socket.on('receiveMessage', (message) => {
  console.log('New message received:', message);
  // You can update the UI here with the new message
});

// Listen for incoming private messages
socket.on('receivePrivateMessage', (message) => {
  console.log('New private message received:', message);
  // You can update the UI here with the new private message
});

export default socket;
