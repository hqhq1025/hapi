import { describe, expect, it } from 'vitest'
import { reduceTimeline } from './reducerTimeline'
import type { TracedMessage } from './tracer'

function makeContext() {
    return {
        permissionsById: new Map(),
        groups: new Map(),
        consumedGroupIds: new Set<string>(),
        titleChangesByToolUseId: new Map(),
        emittedTitleChangeToolUseIds: new Set<string>()
    }
}

function makeUserMessage(text: string, overrides?: Partial<TracedMessage>): TracedMessage {
    return {
        id: 'msg-1',
        localId: null,
        createdAt: 1_700_000_000_000,
        role: 'user',
        content: { type: 'text', text },
        isSidechain: false,
        ...overrides
    } as TracedMessage
}

function makeAgentMessage(text: string, overrides?: Partial<TracedMessage>): TracedMessage {
    return {
        id: 'msg-agent-1',
        localId: null,
        createdAt: 1_700_000_000_000,
        role: 'agent',
        content: [{ type: 'text', text, uuid: 'u-1', parentUUID: null }],
        isSidechain: false,
        ...overrides
    } as TracedMessage
}

describe('reduceTimeline', () => {
    it('renders user text as user-text block', () => {
        const text = 'Hello, this is a normal message'
        const { blocks } = reduceTimeline([makeUserMessage(text)], makeContext())

        expect(blocks).toHaveLength(1)
        expect(blocks[0].kind).toBe('user-text')
    })

    it('does not filter XML-like user text (filtering is in normalize layer)', () => {
        const text = '<task-notification> <summary>Some task</summary> </task-notification>'
        const { blocks } = reduceTimeline([makeUserMessage(text)], makeContext())

        expect(blocks).toHaveLength(1)
        expect(blocks[0].kind).toBe('user-text')
    })

    it('suppresses "No response requested." when it is the sole block with a parentUUID', () => {
        // Sentinel replies always follow a prior assistant turn (parentUUID is set)
        const msg: TracedMessage = {
            id: 'msg-sentinel',
            localId: null,
            createdAt: 1_700_000_000_000,
            role: 'agent',
            content: [{ type: 'text', text: 'No response requested.', uuid: 'u-1', parentUUID: 'prev-uuid' }],
            isSidechain: false
        } as TracedMessage

        const { blocks } = reduceTimeline([msg], makeContext())
        const textBlocks = blocks.filter(b => b.kind === 'agent-text')
        expect(textBlocks).toHaveLength(0)
    })

    it('keeps "No response requested." when parentUUID is null (first message in conversation)', () => {
        // parentUUID null = first assistant response; never a sentinel
        const { blocks } = reduceTimeline([makeAgentMessage('No response requested.')], makeContext())
        const textBlocks = blocks.filter(b => b.kind === 'agent-text')
        expect(textBlocks).toHaveLength(1)
    })

    it('keeps "No response requested." when message also has other blocks (e.g. tool calls)', () => {
        const msg: TracedMessage = {
            id: 'msg-multi',
            localId: null,
            createdAt: 1_700_000_000_000,
            role: 'agent',
            content: [
                { type: 'text', text: 'No response requested.', uuid: 'u-1', parentUUID: 'prev-uuid' },
                { type: 'tool-call', id: 'tc-1', name: 'Bash', input: { command: 'ls' }, description: null, uuid: 'u-1', parentUUID: 'prev-uuid' }
            ],
            isSidechain: false
        } as TracedMessage

        const { blocks } = reduceTimeline([msg], makeContext())
        const textBlocks = blocks.filter(b => b.kind === 'agent-text')
        expect(textBlocks).toHaveLength(1)
    })

    it('keeps normal assistant text blocks', () => {
        const { blocks } = reduceTimeline([makeAgentMessage('Here is the answer.')], makeContext())

        const textBlocks = blocks.filter(b => b.kind === 'agent-text')
        expect(textBlocks).toHaveLength(1)
    })
})
