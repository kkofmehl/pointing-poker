import { beforeEach, describe, expect, it, vi } from 'vitest';

const ioMock = vi.fn();

vi.mock('socket.io-client', () => ({
  io: ioMock
}));

function createMockSocket() {
  return {
    connected: false,
    id: null,
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn()
  };
}

describe('socketService connect behavior', () => {
  beforeEach(() => {
    vi.resetModules();
    ioMock.mockReset();
  });

  it('reuses existing socket instead of creating another one', async () => {
    const socket = createMockSocket();
    ioMock.mockReturnValue(socket);

    const { socketService } = await import('../services/socketService.js');

    socketService.connect();
    socketService.connect();

    expect(ioMock).toHaveBeenCalledTimes(1);
  });
});
