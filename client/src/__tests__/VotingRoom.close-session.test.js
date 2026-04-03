import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import VotingRoom from '../components/VotingRoom.vue';
import { socketService } from '../services/socketService.js';

vi.mock('../services/socketService.js', () => ({
  socketService: {
    emit: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    getSocketId: vi.fn(() => 'socket-1')
  }
}));

const stubs = {
  CardSelector: { template: '<div data-test="card-selector"></div>' },
  ResultsDisplay: { template: '<div data-test="results-display"></div>' }
};

describe('VotingRoom close session flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('emits close_session after user confirms close modal', async () => {
    const wrapper = mount(VotingRoom, {
      props: {
        sessionId: 'alpha',
        userName: 'Casey',
        initialSessionState: {
          users: [],
          votes: {},
          confidences: {},
          selectedCards: [],
          allVoted: false
        }
      },
      global: { stubs }
    });

    await wrapper.find('[data-test="close-session-btn"]').trigger('click');
    await wrapper.find('[data-test="confirm-close-session-btn"]').trigger('click');

    expect(socketService.emit).toHaveBeenCalledWith('close_session', {
      sessionId: 'alpha'
    });
  });
});
