import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ResultsDisplay from '../components/ResultsDisplay.vue';

const defaultConfidences = {
  'user-1': 8,
  'user-2': 7,
  'user-3': 9
};

function mountResultsDisplay(votes, confidences = defaultConfidences) {
  return mount(ResultsDisplay, {
    attachTo: document.body,
    props: {
      users: [
        { id: 'user-1', name: 'Avery' },
        { id: 'user-2', name: 'Blake' },
        { id: 'user-3', name: 'Casey' }
      ],
      votes,
      userName: 'Avery',
      confidences
    }
  });
}

function proudOverlayExists() {
  return document.querySelector('[data-test="proud-celebration"]') !== null;
}

describe('ResultsDisplay consensus celebration', () => {
  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('shows celebration when all numeric estimates are identical', () => {
    const wrapper = mountResultsDisplay({
      'user-1': 3,
      'user-2': 3,
      'user-3': 3
    });

    expect(wrapper.find('[data-test="consensus-celebration"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('Consensus!');
    expect(proudOverlayExists()).toBe(false);
  });

  it('hides celebration after 3 seconds', async () => {
    vi.useFakeTimers();
    const wrapper = mountResultsDisplay({
      'user-1': 5,
      'user-2': 5,
      'user-3': 5
    });

    expect(wrapper.find('[data-test="consensus-celebration"]').exists()).toBe(true);

    vi.advanceTimersByTime(2999);
    await nextTick();
    expect(wrapper.find('[data-test="consensus-celebration"]').exists()).toBe(true);

    vi.advanceTimersByTime(1);
    await nextTick();
    expect(wrapper.find('[data-test="consensus-celebration"]').exists()).toBe(false);
  });

  it('does not show celebration for mixed numeric estimates', () => {
    const wrapper = mountResultsDisplay({
      'user-1': 2,
      'user-2': 3,
      'user-3': 5
    });

    expect(wrapper.find('[data-test="consensus-celebration"]').exists()).toBe(false);
    expect(proudOverlayExists()).toBe(false);
  });

  it('does not show celebration when votes are non-numeric or coffee only', () => {
    const nonNumericWrapper = mountResultsDisplay({
      'user-1': '?',
      'user-2': '?',
      'user-3': '?'
    });
    expect(nonNumericWrapper.find('[data-test="consensus-celebration"]').exists()).toBe(false);
    expect(proudOverlayExists()).toBe(false);

    const coffeeOnlyWrapper = mountResultsDisplay({
      'user-1': 0,
      'user-2': 0,
      'user-3': 0
    });
    expect(coffeeOnlyWrapper.find('[data-test="consensus-celebration"]').exists()).toBe(false);
    expect(proudOverlayExists()).toBe(false);
  });

  it('shows proud celebration before consensus when votes and confidence match', async () => {
    vi.useFakeTimers();
    const wrapper = mountResultsDisplay(
      {
        'user-1': 5,
        'user-2': 5,
        'user-3': 5
      },
      {
        'user-1': 8,
        'user-2': 8,
        'user-3': 8
      }
    );

    expect(proudOverlayExists()).toBe(true);
    expect(wrapper.find('[data-test="consensus-celebration"]').exists()).toBe(false);

    vi.advanceTimersByTime(3999);
    await nextTick();
    expect(proudOverlayExists()).toBe(true);
    expect(wrapper.find('[data-test="consensus-celebration"]').exists()).toBe(false);

    vi.advanceTimersByTime(1);
    await nextTick();
    expect(proudOverlayExists()).toBe(false);
    expect(wrapper.find('[data-test="consensus-celebration"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('Consensus!');

    vi.advanceTimersByTime(3000);
    await nextTick();
    expect(wrapper.find('[data-test="consensus-celebration"]').exists()).toBe(false);
  });

  it('skips proud celebration when confidence differs', () => {
    const wrapper = mountResultsDisplay(
      {
        'user-1': 3,
        'user-2': 3,
        'user-3': 3
      },
      {
        'user-1': 8,
        'user-2': 7,
        'user-3': 9
      }
    );

    expect(proudOverlayExists()).toBe(false);
    expect(wrapper.find('[data-test="consensus-celebration"]').exists()).toBe(true);
  });
});
