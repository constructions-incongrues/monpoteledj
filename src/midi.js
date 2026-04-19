export function parseMidiMessage(data) {
  const status = data[0];
  const type = status & 0xF0;
  const channel = status & 0x0F;

  if (type === 0xB0) return { type: 'cc',      channel, cc:   data[1], value: data[2] };
  if (type === 0x90) return { type: 'noteon',  channel, note: data[1], value: data[2] };
  if (type === 0x80) return { type: 'noteoff', channel, note: data[1], value: data[2] };
  return null;
}

export function dispatchMidiAction(msg, mapping) {
  if (!msg) return;
  if (msg.type === 'cc') {
    const fn = mapping.cc[`${msg.channel}:${msg.cc}`];
    if (fn) fn(msg.value);
  } else if (msg.type === 'noteon' || msg.type === 'noteoff') {
    const fn = mapping.note[`${msg.channel}:${msg.note}`];
    if (fn) fn(msg.value);
  }
}

export async function initMidi(mapping = null) {
  const { deckA, deckB } = await import('./audio.js');
  const { togglePlay, sync, setXfaderVal, setChannelGain, setEqBand } = await import('./mixer.js');

  const norm = v => v / 127;
  const activeMapping = mapping ?? {
    cc: {
      '0:54': v => setXfaderVal(norm(v)),
      '0:48': v => setChannelGain(deckA, norm(v)),
      '0:49': v => setChannelGain(deckB, norm(v)),
      '0:40': v => setEqBand(deckA, 'hi',  norm(v)),
      '0:41': v => setEqBand(deckA, 'mid', norm(v)),
      '0:42': v => setEqBand(deckA, 'lo',  norm(v)),
      '0:44': v => setEqBand(deckB, 'hi',  norm(v)),
      '0:45': v => setEqBand(deckB, 'mid', norm(v)),
      '0:46': v => setEqBand(deckB, 'lo',  norm(v)),
      '0:29': v => { deckA.pitch = (norm(v) - 0.5) * 24; if (deckA.audio) deckA.audio.playbackRate = 1 + deckA.pitch / 100; },
      '0:33': v => { deckB.pitch = (norm(v) - 0.5) * 24; if (deckB.audio) deckB.audio.playbackRate = 1 + deckB.pitch / 100; },
    },
    note: {
      '0:0':  v => { if (v > 0) togglePlay('a'); },
      '0:64': v => { if (v > 0) togglePlay('b'); },
      '0:4':  v => { if (v > 0) sync('a'); },
      '0:68': v => { if (v > 0) sync('b'); },
    },
  };

  const badge = document.getElementById('midi-status');
  if (!navigator.requestMIDIAccess) {
    if (badge) badge.textContent = 'MIDI non supporté';
    return;
  }
  try {
    const access = await navigator.requestMIDIAccess();
    const connect = () => {
      let count = 0;
      access.inputs.forEach(input => {
        input.onmidimessage = e => dispatchMidiAction(parseMidiMessage(e.data), activeMapping);
        count++;
      });
      if (badge) badge.textContent = count > 0 ? `MIDI · ${count} entrée(s)` : 'MIDI · aucun contrôleur';
    };
    connect();
    access.onstatechange = connect;
  } catch (err) {
    if (badge) badge.textContent = 'MIDI refusé';
    console.warn('MIDI access denied:', err);
  }
}
