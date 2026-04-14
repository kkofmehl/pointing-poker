import test from 'node:test';
import assert from 'node:assert/strict';
import { setupSocketHandlers } from './socketHandlers.js';

function createFakeIo() {
  const handlers = new Map();
  const roomMessages = [];
  const globalMessages = [];
  const roomLeaves = [];

  return {
    handlers,
    roomMessages,
    globalMessages,
    roomLeaves,
    on(event, callback) {
      handlers.set(event, callback);
    },
    emit(event, payload) {
      globalMessages.push({ event, payload });
    },
    to(room) {
      return {
        emit(event, payload) {
          roomMessages.push({ room, event, payload });
        }
      };
    },
    in(room) {
      return {
        socketsLeave() {
          roomLeaves.push(room);
        }
      };
    }
  };
}

function createFakeSocket(socketId = 'socket-1') {
  const handlers = new Map();
  const emitted = [];
  const joinedRooms = [];
  const leftRooms = [];

  return {
    id: socketId,
    handlers,
    emitted,
    joinedRooms,
    leftRooms,
    on(event, callback) {
      handlers.set(event, callback);
    },
    emit(event, payload) {
      emitted.push({ event, payload });
    },
    join(room) {
      joinedRooms.push(room);
    },
    leave(room) {
      leftRooms.push(room);
    },
    to() {
      return {
        emit() {}
      };
    }
  };
}

test('close_session deletes cached background image', async () => {
  const io = createFakeIo();
  const socket = createFakeSocket();
  const deletedSessions = [];

  const manager = {
    sessions: new Map(),
    getAllActiveSessions: () => [],
    getSession: (sessionId) => ({ sessionId, users: new Map([[socket.id, { id: socket.id }]]) }),
    closeSession: () => true
  };

  setupSocketHandlers(io, {
    sessionManager: manager,
    ensureSessionBackground: async () => ({ buffer: Buffer.from([1]), mimeType: 'image/png' }),
    deleteSessionBackground: async (sessionId) => {
      deletedSessions.push(sessionId);
    }
  });

  io.handlers.get('connection')(socket);
  await socket.handlers.get('close_session')({ sessionId: 'session-a' });

  assert.deepEqual(deletedSessions, ['session-a']);
});

test('leave_session removes cached image when last user leaves', async () => {
  const io = createFakeIo();
  const socket = createFakeSocket();
  const deletedSessions = [];
  const sessionId = 'session-last-user';
  const session = {
    sessionId,
    users: new Map([[socket.id, { id: socket.id }]])
  };

  const manager = {
    sessions: new Map([[sessionId, session]]),
    getAllActiveSessions: () => [],
    getSession: () => session,
    removeUser: () => null
  };

  setupSocketHandlers(io, {
    sessionManager: manager,
    ensureSessionBackground: async () => ({ buffer: Buffer.from([1]), mimeType: 'image/png' }),
    deleteSessionBackground: async (id) => {
      deletedSessions.push(id);
    }
  });

  io.handlers.get('connection')(socket);
  await socket.handlers.get('leave_session')({ sessionId });

  assert.deepEqual(deletedSessions, [sessionId]);
});

test('disconnect removes cached image when last user disconnects', async () => {
  const io = createFakeIo();
  const socket = createFakeSocket();
  const deletedSessions = [];
  const sessionId = 'disconnect-last-user';
  const session = {
    sessionId,
    users: new Map([[socket.id, { id: socket.id }]])
  };

  const manager = {
    sessions: new Map([[sessionId, session]]),
    getAllActiveSessions: () => [],
    getSession: () => session,
    removeUser: () => null
  };

  setupSocketHandlers(io, {
    sessionManager: manager,
    ensureSessionBackground: async () => ({ buffer: Buffer.from([1]), mimeType: 'image/png' }),
    deleteSessionBackground: async (id) => {
      deletedSessions.push(id);
    }
  });

  io.handlers.get('connection')(socket);
  await socket.handlers.get('disconnect')();

  assert.deepEqual(deletedSessions, [sessionId]);
});
