/**
 * Remark plugin that disables indented code blocks (4-space indent).
 *
 * In CommonMark, text indented by 4+ spaces becomes a code block.  This
 * frequently misparses LLM output where numbered-list items with nested
 * content or quoted text are indented.  Fenced code blocks (``` … ```)
 * still work normally.
 */
export default function remarkDisableIndentedCode() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const self = this as any
    const data = self.data()
    const extensions = data.micromarkExtensions ?? (data.micromarkExtensions = [])
    extensions.push({ disable: { null: ['codeIndented'] } })
}
