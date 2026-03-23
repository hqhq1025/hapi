import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { ChildProcess } from 'child_process';
import { EventEmitter } from 'events';

// Create a fake child process emitter for each test
let childEmitter: EventEmitter & { exitCode: number | null; killed: boolean; pid: number };

vi.mock('child_process', () => ({
    spawn: vi.fn(() => {
        childEmitter = Object.assign(new EventEmitter(), {
            exitCode: null,
            killed: false,
            pid: 12345,
        });
        return childEmitter;
    }),
}));

vi.mock('@/ui/logger', () => ({
    logger: { debug: vi.fn(), warn: vi.fn() },
}));

vi.mock('@/utils/process', () => ({
    killProcessByChildProcess: vi.fn(),
}));

import { spawnWithAbort } from './spawnWithAbort';

function makeOptions(overrides: Partial<Parameters<typeof spawnWithAbort>[0]> = {}) {
    const controller = new AbortController();
    return {
        opts: {
            command: 'echo',
            args: ['hello'],
            cwd: '/tmp',
            env: {},
            signal: controller.signal,
            logLabel: 'test',
            spawnName: 'echo',
            installHint: 'echo',
            logExit: true,
            ...overrides,
        } satisfies Parameters<typeof spawnWithAbort>[0],
        controller,
    };
}

describe('spawnWithAbort', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('resolves when process exits with code 0', async () => {
        const { opts } = makeOptions();
        const p = spawnWithAbort(opts);
        // Wait for event listeners to be set up
        await vi.waitFor(() => expect(childEmitter.listenerCount('exit')).toBe(1));
        childEmitter.emit('exit', 0, null);
        await expect(p).resolves.toBeUndefined();
    });

    it('rejects when process exits with non-zero code without abort', async () => {
        const { opts } = makeOptions();
        const p = spawnWithAbort(opts);
        await vi.waitFor(() => expect(childEmitter.listenerCount('exit')).toBe(1));
        childEmitter.emit('exit', 1, null);
        await expect(p).rejects.toThrow('Process exited with code: 1');
    });

    it('resolves when process exits with code 1 after abort', async () => {
        const { opts, controller } = makeOptions();
        const p = spawnWithAbort(opts);
        await vi.waitFor(() => expect(childEmitter.listenerCount('exit')).toBe(1));
        controller.abort();
        childEmitter.emit('exit', 1, null);
        await expect(p).resolves.toBeUndefined();
    });

    it('resolves when process exits with any non-zero code after abort', async () => {
        const { opts, controller } = makeOptions();
        const p = spawnWithAbort(opts);
        await vi.waitFor(() => expect(childEmitter.listenerCount('exit')).toBe(1));
        controller.abort();
        childEmitter.emit('exit', 2, null);
        await expect(p).resolves.toBeUndefined();
    });

    it('resolves when process exits with known abort code (130) after abort', async () => {
        const { opts, controller } = makeOptions();
        const p = spawnWithAbort(opts);
        await vi.waitFor(() => expect(childEmitter.listenerCount('exit')).toBe(1));
        controller.abort();
        childEmitter.emit('exit', 130, null);
        await expect(p).resolves.toBeUndefined();
    });

    it('resolves when process exits with SIGTERM after abort', async () => {
        const { opts, controller } = makeOptions();
        const p = spawnWithAbort(opts);
        await vi.waitFor(() => expect(childEmitter.listenerCount('exit')).toBe(1));
        controller.abort();
        childEmitter.emit('exit', null, 'SIGTERM');
        await expect(p).resolves.toBeUndefined();
    });

    it('rejects when process is terminated by signal without abort', async () => {
        const { opts } = makeOptions();
        const p = spawnWithAbort(opts);
        await vi.waitFor(() => expect(childEmitter.listenerCount('exit')).toBe(1));
        childEmitter.emit('exit', null, 'SIGKILL');
        await expect(p).rejects.toThrow('Process terminated with signal: SIGKILL');
    });
});
