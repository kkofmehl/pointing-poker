import { io } from 'socket.io-client';

class SocketService {
  constructor() {
    this.socket = null;
    this.listeners = new Map();
  }

  connect() {
    if (this.socket) {
      if (!this.socket.connected && typeof this.socket.connect === 'function') {
        this.socket.connect();
      }
      return;
    }

    const serverUrl = import.meta.env.PROD 
      ? window.location.origin 
      : 'http://localhost:3000';

    this.socket = io(serverUrl, {
      transports: ['websocket', 'polling']
    });

    this.socket.on('connect', () => {
      console.log('Connected to server');
    });

    this.socket.on('disconnect', () => {
      console.log('Disconnected from server');
    });

    this.socket.on('error', (error) => {
      console.error('Socket error:', error);
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  on(event, callback) {
    if (!this.socket) {
      this.connect();
    }

    this.socket.on(event, callback);
    
    // Track listener for cleanup
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  onConnect(callback) {
    this.on('connect', callback);
  }

  offConnect(callback) {
    this.off('connect', callback);
  }

  off(event, callback) {
    if (this.socket) {
      this.socket.off(event, callback);
    }
  }

  emit(event, data) {
    if (!this.socket) {
      this.connect();
    }
    this.socket.emit(event, data);
  }

  getSocketId() {
    return this.socket?.id || null;
  }
}

export const socketService = new SocketService();

