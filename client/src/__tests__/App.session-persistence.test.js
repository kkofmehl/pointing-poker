import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import App from '../App.vue';
import { socketService } from '../services/socketService.js';
import {
  applySessionBackground,
  clearSessionBackground
} from '../services/backgroundImageService.js';
import { CURRENT_SESSION_STORAGE_KEY as SESSION_STORAGE_KEY } from '../utils/sessionPersistence.js';

vi.mock('../services/socketService.js', () => {
  const handlers = new Map();

  return {
    socketService: {
      connect: vi.fn(),
      emit: vi.fn(),
      on: vi.fn((event, callback) => {
        handlers.set(event, callback);
      }),
      onConnect: vi.fn((callback) => {
        handlers.set('connect', callback);
      }),
      off: vi.fn((event, callback) => {
        if (handlers.get(event) === callback) {
          handlers.delete(event);
        }
      }),
      offConnect: vi.fn((callback) => {
        if (handlers.get('connect') === callback) {
          handlers.delete('connect');
        }
      }),
      getSocketId: vi.fn(() => 'socket-1'),
      __trigger(event, payload) {
        const callback = handlers.get(event);
        if (callback) {
          callback(payload);
        }
      },
      __reset() {
        handlers.clear();
      }
    }
  };
});

vi.mock('../services/backgroundImageService.js', () => ({
  applySessionBackground: vi.fn(() => Promise.resolve()),
  clearSessionBackground: vi.fn()
}));

const stubs = {
  SessionJoin: {
    name: 'SessionJoin',
    template: '<div data-test="session-join-view">join</div>'
  },
  VotingRoom: {
    name: 'VotingRoom',
    emits: ['leave'],
    template: '<div data-test="voting-room-view"><button data-test="leave-btn" @click="$emit(\'leave\')">leave</button></div>'
  }
};

describe('App session persistence', () => {
  beforeEach(() => {
    sessionStorage.clear();
    socketService.__reset();
    vi.clearAllMocks();
  });

  it('shows join view when there is no persisted session', () => {
    const wrapper = mount(App, {
      global: { stubs }
    });

    expect(wrapper.find('[data-test="session-join-view"]').exists()).toBe(true);
    expect(wrapper.text()).toContain(
      'Feel no obligation, but if you want to help offset hosting costs of this dandy little app'
    );
    expect(socketService.emit).not.toHaveBeenCalledWith(
      'join_session',
      expect.any(Object)
    );
  });

  it('auto-rejoins persisted session on app load', () => {
    sessionStorage.setItem(
      SESSION_STORAGE_KEY,
      JSON.stringify({ sessionId: 'alpha', userName: 'Casey' })
    );

    mount(App, {
      global: { stubs }
    });

    expect(socketService.connect).toHaveBeenCalledTimes(1);
    expect(socketService.emit).toHaveBeenCalledWith('join_session', {
      sessionId: 'alpha',
      userName: 'Casey'
    });
  });

  it('rejoins persisted session after reconnect', () => {
    sessionStorage.setItem(
      SESSION_STORAGE_KEY,
      JSON.stringify({ sessionId: 'alpha', userName: 'Casey' })
    );

    mount(App, {
      global: { stubs }
    });

    socketService.__trigger('connect');

    expect(socketService.emit).toHaveBeenCalledTimes(2);
    expect(socketService.emit).toHaveBeenNthCalledWith(2, 'join_session', {
      sessionId: 'alpha',
      userName: 'Casey'
    });
  });

  it('clears persisted session when user leaves', async () => {
    sessionStorage.setItem(
      SESSION_STORAGE_KEY,
      JSON.stringify({ sessionId: 'alpha', userName: 'Casey' })
    );

    const wrapper = mount(App, {
      global: { stubs }
    });

    socketService.__trigger('session_state', {
      sessionId: 'alpha',
      users: [],
      votes: {},
      confidences: {},
      selectedCards: [],
      allVoted: false
    });
    await nextTick();

    await wrapper.find('[data-test="leave-btn"]').trigger('click');
    expect(sessionStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
    expect(clearSessionBackground).toHaveBeenCalled();
  });

  it('clears persisted session when session is closed', async () => {
    sessionStorage.setItem(
      SESSION_STORAGE_KEY,
      JSON.stringify({ sessionId: 'alpha', userName: 'Casey' })
    );

    const wrapper = mount(App, {
      global: { stubs }
    });

    socketService.__trigger('session_state', {
      sessionId: 'alpha',
      users: [],
      votes: {},
      confidences: {},
      selectedCards: [],
      allVoted: false
    });
    await nextTick();

    expect(wrapper.find('[data-test="voting-room-view"]').exists()).toBe(true);

    socketService.__trigger('session_closed', { sessionId: 'alpha' });
    await nextTick();

    expect(sessionStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
    expect(wrapper.find('[data-test="session-join-view"]').exists()).toBe(true);
    expect(clearSessionBackground).toHaveBeenCalled();
  });

  it('requests a generated background when session background is ready', async () => {
    mount(App, {
      global: { stubs }
    });

    socketService.__trigger('session_state', {
      sessionId: 'Neo Retreat',
      users: [{ id: 'socket-1', name: 'Casey' }],
      votes: {},
      confidences: {},
      selectedCards: [],
      allVoted: false
    });
    await nextTick();
    socketService.__trigger('session_background_ready', { sessionId: 'Neo Retreat' });
    await nextTick();
    await Promise.resolve();

    expect(applySessionBackground).toHaveBeenCalledWith('Neo Retreat');
  });

  it('requests background on join even if ready event arrived too early', async () => {
    mount(App, {
      global: { stubs }
    });

    socketService.__trigger('session_background_ready', { sessionId: 'Neo Retreat' });
    await nextTick();
    expect(applySessionBackground).not.toHaveBeenCalled();

    socketService.__trigger('session_state', {
      sessionId: 'Neo Retreat',
      users: [{ id: 'socket-1', name: 'Casey' }],
      votes: {},
      confidences: {},
      selectedCards: [],
      allVoted: false
    });
    await nextTick();
    await Promise.resolve();

    expect(applySessionBackground).toHaveBeenCalledWith('Neo Retreat');
  });

  it('does not repeatedly request background for same session', async () => {
    mount(App, {
      global: { stubs }
    });

    const sessionStatePayload = {
      sessionId: 'Neo Retreat',
      users: [{ id: 'socket-1', name: 'Casey' }],
      votes: {},
      confidences: {},
      selectedCards: [],
      allVoted: false
    };

    socketService.__trigger('session_state', sessionStatePayload);
    await nextTick();
    socketService.__trigger('session_background_ready', { sessionId: 'Neo Retreat' });
    await nextTick();
    await Promise.resolve();

    socketService.__trigger('session_background_ready', { sessionId: 'Neo Retreat' });
    await nextTick();
    await Promise.resolve();

    expect(applySessionBackground).toHaveBeenCalledTimes(1);
  });

  it('keeps app stable when background request fails', async () => {
    applySessionBackground.mockRejectedValueOnce(new Error('request failed'));

    const wrapper = mount(App, {
      global: { stubs }
    });

    socketService.__trigger('session_state', {
      sessionId: 'Neo Retreat',
      users: [{ id: 'socket-1', name: 'Casey' }],
      votes: {},
      confidences: {},
      selectedCards: [],
      allVoted: false
    });
    await nextTick();
    socketService.__trigger('session_background_ready', { sessionId: 'Neo Retreat' });
    await nextTick();
    await Promise.resolve();
    await Promise.resolve();

    expect(wrapper.find('[data-test="voting-room-view"]').exists()).toBe(true);
    expect(clearSessionBackground).toHaveBeenCalled();
  });
});
