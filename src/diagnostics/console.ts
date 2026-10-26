export function analyze(text: string) { const lines = text.split(/\r?\n/), messages = new Map<string, {
    text: string;
    count: number;
    firstLine: number;
    lastLine: number;
}>(), frames: any[] = []; let dropped = 0; for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line)
        continue;
    const frame = /(?:\(|\s|^)((?:[^()]+?)\.(?:[cm]?js|ts|cpp|mm)):(\d+):(\d+)\)?$/.exec(line);
    if (frame && frames.length < 50)
        frames.push({ file: frame[1].trim(), line: Number(frame[2]), column: Number(frame[3]), mapping: 'unverified-location', sourceHash: null, componentCandidates: 'unresolved' });
    const old = messages.get(line);
    if (old) {
        old.count++;
        old.lastLine = i + 1;
    }
    else if (messages.size < 50)
        messages.set(line, { text: line.slice(0, 1000), count: 1, firstLine: i + 1, lastLine: i + 1 });
    else
        dropped++;
} return { messages: [...messages.values()], frames, dropped, source: 'caller-supplied-text', crashReproduced: false, crashProbability: null, componentCandidates: 'unresolved', profiler: { availability: 'unavailable', reason: 'No qualified backend telemetry' } }; }
