import { describe, it, expect, vi } from 'vitest';
import { parseMidiMessage, dispatchMidiAction } from './midi.js';

describe('parseMidiMessage', () => {
  it('parses CC message', () => {
    const msg = parseMidiMessage(new Uint8Array([0xB0, 7, 64]));
    expect(msg).toEqual({ type: 'cc', channel: 0, cc: 7, value: 64 });
  });

  it('parses Note On message', () => {
    const msg = parseMidiMessage(new Uint8Array([0x90, 36, 127]));
    expect(msg).toEqual({ type: 'noteon', channel: 0, note: 36, value: 127 });
  });

  it('parses Note Off message', () => {
    const msg = parseMidiMessage(new Uint8Array([0x80, 36, 0]));
    expect(msg).toEqual({ type: 'noteoff', channel: 0, note: 36, value: 0 });
  });

  it('returns null for unsupported message type', () => {
    const msg = parseMidiMessage(new Uint8Array([0xC0, 5]));
    expect(msg).toBeNull();
  });

  it('extracts channel from status byte', () => {
    const msg = parseMidiMessage(new Uint8Array([0xB3, 1, 100]));
    expect(msg.channel).toBe(3);
  });
});

describe('dispatchMidiAction', () => {
  it('calls action for matching CC mapping', () => {
    const action = vi.fn();
    const mapping = { cc: { '0:7': action }, note: {} };
    dispatchMidiAction({ type: 'cc', channel: 0, cc: 7, value: 64 }, mapping);
    expect(action).toHaveBeenCalledWith(64);
  });

  it('calls action for matching note mapping', () => {
    const action = vi.fn();
    const mapping = { cc: {}, note: { '0:36': action } };
    dispatchMidiAction({ type: 'noteon', channel: 0, note: 36, value: 127 }, mapping);
    expect(action).toHaveBeenCalledWith(127);
  });

  it('ignores messages with no mapping entry', () => {
    const mapping = { cc: {}, note: {} };
    expect(() => dispatchMidiAction(
      { type: 'cc', channel: 0, cc: 99, value: 0 }, mapping
    )).not.toThrow();
  });

  it('ignores null messages', () => {
    expect(() => dispatchMidiAction(null, { cc: {}, note: {} })).not.toThrow();
  });
});
