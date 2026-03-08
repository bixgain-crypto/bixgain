

# Fix: Admin AI Prompt Execution Bugs

## Problems Found

Two bugs causing all AI-prompted operations to fail:

1. **Empty `operation_payload`**: The AI tool schema defines `payload` as `type: "object"` with no inner properties. The AI model has no guidance on what to put inside, so it returns `{}` while placing fields elsewhere (or omitting them). Both stored scheduled tasks have `operation_payload = {}`.

2. **AI always returns `scheduled_at`**: Even when the user says nothing about scheduling, the AI returns a `scheduled_at` timestamp set to "now", routing everything through the scheduling path instead of immediate execution. The system prompt says "omit scheduled_at" for immediate, but the AI ignores this.

## Fixes

### 1. Add explicit payload properties to the tool schema
Define the expected fields for each operation type inside the `payload` schema so the AI knows exactly what structure to return. Use a description that enumerates the fields per operation type.

### 2. Add console logging of AI response
Log `toolCall.function.arguments` so we can debug what the AI actually returns.

### 3. Fallback: extract payload from flat operation object
If `op.payload` is empty/missing, try to extract known fields from the operation object itself (the AI may put `name`, `description`, etc. at the top level of each operation instead of nesting under `payload`).

### 4. Fix scheduling logic
If `scheduled_at` is within 60 seconds of now, treat it as immediate execution instead of scheduling. This prevents the AI from accidentally scheduling everything.

### Files to edit
- `supabase/functions/admin-ai-prompt/index.ts` -- Fix tool schema, add payload fallback, fix scheduling threshold
- `supabase/functions/execute-scheduled-tasks/index.ts` -- No changes needed (executes correctly once payload is populated)

