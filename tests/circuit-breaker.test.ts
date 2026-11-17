import { describe, it, expect, vi } from 'vitest';
import { CircuitBreaker } from '../src/libs/circuit-breaker.js';

describe('CircuitBreaker', () => {
  it('opens after reaching failureThreshold and transitions to HALF_OPEN after resetTimeoutMs', () => {
    let now = 1_000;
    const transitions: string[] = [];
    const onOpenTrip = vi.fn();

    const cb = new CircuitBreaker({
      failureThreshold: 3,
      resetTimeoutMs: 5_000,
      nowFn: () => now,
      onStateChange: (from, to) => transitions.push(`${from}->${to}`),
      onOpenTrip,
    });

    expect(cb.getState()).toBe('CLOSED');
    expect(cb.allowRequest()).toBe(true);

    cb.recordFailure();
    cb.recordFailure();
    expect(cb.getState()).toBe('CLOSED');

    cb.recordFailure();
    expect(cb.getState()).toBe('OPEN');
    expect(cb.allowRequest()).toBe(false);
    expect(onOpenTrip).toHaveBeenCalledTimes(1);

    now += 5_000;
    expect(cb.getState()).toBe('HALF_OPEN');
    expect(cb.allowRequest()).toBe(true);

    cb.recordSuccess();
    expect(cb.getState()).toBe('CLOSED');
    expect(transitions).toEqual(['CLOSED->OPEN', 'OPEN->HALF_OPEN', 'HALF_OPEN->CLOSED']);
  });

  it('re-opens immediately if HALF_OPEN probe fails', () => {
    let now = 1_000;
    const cb = new CircuitBreaker({
      failureThreshold: 1,
      resetTimeoutMs: 2_000,
      nowFn: () => now,
    });

    cb.recordFailure();
    expect(cb.getState()).toBe('OPEN');

    now += 2_000;
    expect(cb.getState()).toBe('HALF_OPEN');

    cb.recordFailure();
    expect(cb.getState()).toBe('OPEN');
  });
});
