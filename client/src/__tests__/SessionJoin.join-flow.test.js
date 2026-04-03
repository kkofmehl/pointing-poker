import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SessionJoin from '../components/SessionJoin.vue';
import { socketService } from '../services/socketService.js';

vi.mock('../services/socketService.js', () => {
  const handlers = new Map();

  return {
    socketService: {
      connect: vi.fn(),
      emit: vi.fn(),
      on: vi.fn((event, callback) => {
        handlers.set(event, callback);
      }),
      off: vi.fn((event, callback) => {
        if (handlers.get(event) === callback) {
          handlers.delete(event);
        }
      }),
      __trigger(event, payload) {
        const handler = handlers.get(event);
        if (handler) {
          handler(payload);
        }
      },
      __reset() {
        handlers.clear();
      }
    }
  };
});

describe('SessionJoin join flow', () => {
  beforeEach(() => {
    socketService.__reset();
    vi.clearAllMocks();
  });

  it('does not emit joined from unsolicited session_state', () => {
    const wrapper = mount(SessionJoin);

    socketService.__trigger('session_state', {
      sessionId: 'existing-session',
      users: []
    });

    expect(wrapper.emitted('joined')).toBeFalsy();
  });
});
