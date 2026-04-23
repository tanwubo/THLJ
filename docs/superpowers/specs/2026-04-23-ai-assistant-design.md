# AI Assistant Natural Language Entry Design

Date: 2026-04-23
Status: Approved for implementation planning

## Goal

Add an AI assistant entry to the wedding planning app so users can create timeline nodes, todos, and expense records with natural language. The assistant parses the user's sentence into a structured draft, shows a confirmation card, and only writes data after the user confirms.

Example target input:

```text
增加一个10月1日拍婚纱照的节点
```

Expected extraction:

```json
{
  "actionType": "create_node",
  "fields": {
    "name": "拍婚纱照",
    "deadline": "2026-10-01"
  }
}
```

## Non-Goals

- No direct write by the model. All writes require user confirmation.
- No update, delete, search, or analytics commands in the first version.
- No admin UI for switching providers or editing API keys in the first version.
- No model-generated `nodeId` or `todoId` outside the user's existing data context.

## UX Direction

The AI entry is a circular floating button on authenticated app pages. It uses the confirmed visual direction from brainstorming:

- Ivory background.
- Champagne gold highlight.
- Deep ink green for the AI entry and primary actions.
- Small rosewood accents for warmth.

The entry copy should clearly communicate that it is an AI conversation entry, for example:

```text
一句话添加节点/待办/费用
```

When opened, it becomes a conversation drawer. The drawer includes:

- A short AI assistant header.
- A chat input for natural language.
- A parsed-result confirmation card.
- A fallback state for missing fields or unsupported commands.

## Supported Actions

### Create Node

Supported example:

```text
增加一个10月1日拍婚纱照的节点
```

Fields:

- `name`: required.
- `deadline`: optional, normalized to `YYYY-MM-DD`.
- `description`: optional.
- `budget`: optional, must be a non-negative number if present.

### Create Todo

Supported example:

```text
给婚宴节点增加一个9月20日前确认菜单的待办
```

Fields:

- `nodeId`: required before write.
- `nodeName`: display-only helper when matched.
- `content`: required.
- `deadline`: optional, normalized to `YYYY-MM-DD`.

If the user does not specify a node, or if the node is ambiguous, the assistant returns `needs_input` with candidate nodes. The frontend asks the user to choose the node before confirmation.

### Create Expense

Supported example:

```text
给婚纱照的选片记一笔3000元摄影费用
```

Fields:

- `todoId`: required before write because the current expense API requires expenses to attach to todos.
- `todoName`: display-only helper when matched.
- `nodeId` and `nodeName`: display/context helpers when available.
- `type`: `income` or `expense`.
- `amount`: required, must be greater than 0.
- `category`: optional. Invalid or missing categories fall back to `其他收入` or `其他支出`.
- `description`: optional.

If only a node is identified, the assistant returns `needs_input` with candidate todos under that node. The frontend asks the user to choose a todo before confirmation.

## ID Matching

The model must not invent `nodeId` or `todoId`.

Before calling the model, the backend loads a compact context for the current data owner:

```json
{
  "nodes": [
    {
      "id": 12,
      "name": "婚纱照",
      "todos": [
        { "id": 88, "content": "选片" }
      ]
    },
    {
      "id": 13,
      "name": "婚宴",
      "todos": [
        { "id": 91, "content": "确认菜单" }
      ]
    }
  ]
}
```

The provider prompt/schema tells the model to select IDs only from this context. After parsing, the backend validates that every returned ID exists and belongs to the authenticated user's `dataOwnerId`. If validation fails, the result becomes `needs_input` or an error response; no data is written.

## Date Handling

Dates are normalized to `YYYY-MM-DD`.

For incomplete dates such as `10月1日`, use the current year. If that date is earlier than today, roll it forward to the next year. With the current date `2026-04-23`, `10月1日` becomes `2026-10-01`.

## API Design

Add a new authenticated backend route:

```http
POST /api/ai/parse-command
```

Request:

```json
{
  "message": "增加一个10月1日拍婚纱照的节点",
  "page": "timeline",
  "currentNodeId": null
}
```

`page` values:

- `timeline`
- `node-detail`
- `statistics`
- `settings`
- `unknown`

`currentNodeId` is included when the user opens the assistant on a node detail page. The backend passes this as context so the model can default todos and expenses to the current node when the command wording allows it.

Response:

```json
{
  "status": "ready",
  "draft": {
    "actionType": "create_node",
    "fields": {
      "name": "拍婚纱照",
      "deadline": "2026-10-01"
    }
  },
  "summary": "将新增节点：拍婚纱照，截止 2026-10-01",
  "missingFields": [],
  "candidates": {}
}
```

Statuses:

- `ready`: enough fields are present for the frontend to show a final confirmation card.
- `needs_input`: the parsed draft is useful, but the user must choose or enter missing fields before confirmation.
- `unsupported`: the request is outside first-version scope, such as modify/delete/query.

## Model Provider Configuration

The first version uses environment variables only:

```env
AI_PROVIDER=openai
AI_MODEL=gpt-4.1-mini
AI_API_KEY=...
AI_BASE_URL=
AI_TIMEOUT_MS=15000
```

MiniMax example:

```env
AI_PROVIDER=minimax
AI_MODEL=MiniMax-M1
AI_API_KEY=...
AI_BASE_URL=https://api.minimax.io/v1
AI_TIMEOUT_MS=15000
```

Provider abstraction:

```ts
interface AiProvider {
  parseCommand(input: AiParseInput, context: AiCommandContext): Promise<AiParseResult>
}
```

OpenAI implementation:

- Use OpenAI's Responses API.
- Use structured output so the model returns the agreed `AiParseResult` shape.

MiniMax implementation:

- Use the OpenAI-compatible chat completions endpoint.
- Require the same JSON shape in the prompt.
- Apply the same backend validation as OpenAI.

References:

- OpenAI text generation guide: https://platform.openai.com/docs/guides/text
- OpenAI structured outputs guide: https://platform.openai.com/docs/guides/structured-outputs
- MiniMax text chat API reference: https://platform.minimax.io/docs/api-reference/text-chat

## Frontend Flow

1. User clicks the global AI floating entry.
2. The conversation drawer opens.
3. User submits a natural language command.
4. Frontend calls `POST /api/ai/parse-command`.
5. Frontend renders one of three states:
   - `ready`: final confirmation card.
   - `needs_input`: editable/choosable confirmation card.
   - `unsupported`: friendly unsupported message.
6. User confirms.
7. Frontend calls existing APIs:
   - `timelineAPI.createNode`
   - `todoAPI.createTodo`
   - `expenseAPI.createExpense`
8. Frontend emits existing realtime events and refreshes the visible page.

The assistant should preserve the original user input after parse errors so the user can retry or edit.

## End-to-End Examples

### Example 1: Create Node

User input:

```text
增加一个10月1日拍婚纱照的节点
```

AI parse result:

```json
{
  "status": "ready",
  "draft": {
    "actionType": "create_node",
    "fields": {
      "name": "拍婚纱照",
      "deadline": "2026-10-01"
    }
  },
  "summary": "将新增节点：拍婚纱照，截止 2026-10-01",
  "missingFields": [],
  "candidates": {}
}
```

Confirmation card:

```text
新增节点
节点名称：拍婚纱照
截止日期：2026-10-01
[确认添加] [调整]
```

On confirmation:

```ts
timelineAPI.createNode({
  name: '拍婚纱照',
  deadline: '2026-10-01',
})
```

### Example 2: Create Todo With Matched Node

Existing nodes:

```json
[
  { "id": 13, "name": "婚宴" }
]
```

User input:

```text
给婚宴节点增加一个9月20日前确认菜单的待办
```

AI parse result:

```json
{
  "status": "ready",
  "draft": {
    "actionType": "create_todo",
    "fields": {
      "nodeId": 13,
      "nodeName": "婚宴",
      "content": "确认菜单",
      "deadline": "2026-09-20"
    }
  },
  "summary": "将在婚宴节点新增待办：确认菜单，截止 2026-09-20",
  "missingFields": [],
  "candidates": {}
}
```

On confirmation:

```ts
todoAPI.createTodo({
  nodeId: 13,
  content: '确认菜单',
  deadline: '2026-09-20',
})
```

### Example 3: Create Todo With Missing Node

Existing nodes:

```json
[
  { "id": 13, "name": "婚宴" },
  { "id": 18, "name": "婚纱照" }
]
```

User input:

```text
增加一个确认菜单的待办
```

AI parse result:

```json
{
  "status": "needs_input",
  "draft": {
    "actionType": "create_todo",
    "fields": {
      "content": "确认菜单"
    }
  },
  "missingFields": ["nodeId"],
  "candidates": {
    "nodes": [
      { "id": 13, "name": "婚宴" },
      { "id": 18, "name": "婚纱照" }
    ]
  },
  "summary": "识别到待办：确认菜单。请选择要添加到哪个节点。"
}
```

Frontend behavior:

```text
选择目标节点：
- 婚宴
- 婚纱照
```

After the user chooses `婚宴`, the frontend confirms with `nodeId: 13` and calls `todoAPI.createTodo`.

### Example 4: Create Expense With Matched Todo

Existing data:

```json
[
  {
    "id": 18,
    "name": "婚纱照",
    "todos": [
      { "id": 88, "content": "选片" }
    ]
  }
]
```

User input:

```text
给婚纱照的选片记一笔3000元摄影费用
```

AI parse result:

```json
{
  "status": "ready",
  "draft": {
    "actionType": "create_expense",
    "fields": {
      "todoId": 88,
      "todoName": "选片",
      "nodeName": "婚纱照",
      "type": "expense",
      "amount": 3000,
      "category": "婚纱摄影",
      "description": "摄影费用"
    }
  },
  "summary": "将在婚纱照 / 选片下记录支出：¥3000，分类：婚纱摄影",
  "missingFields": [],
  "candidates": {}
}
```

On confirmation:

```ts
expenseAPI.createExpense({
  todoId: 88,
  type: 'expense',
  amount: 3000,
  category: '婚纱摄影',
  description: '摄影费用',
})
```

### Example 5: Create Expense With Missing Todo

User input:

```text
给婚宴记一笔5000元定金
```

AI parse result:

```json
{
  "status": "needs_input",
  "draft": {
    "actionType": "create_expense",
    "fields": {
      "nodeId": 13,
      "nodeName": "婚宴",
      "type": "expense",
      "amount": 5000,
      "category": "婚宴",
      "description": "定金"
    }
  },
  "missingFields": ["todoId"],
  "candidates": {
    "todos": [
      { "id": 91, "content": "确认菜单" },
      { "id": 92, "content": "支付酒店定金" }
    ]
  },
  "summary": "识别到一笔婚宴支出 ¥5000。请选择要挂到哪个待办。"
}
```

After the user chooses `支付酒店定金`, the frontend confirms with `todoId: 92` and calls `expenseAPI.createExpense`.

## Error Handling

Backend parse errors should not write data.

Error cases:

- `AI_PROVIDER` is unsupported.
- `AI_API_KEY` is missing.
- Provider request times out.
- Provider returns malformed JSON.
- Provider returns unsupported `actionType`.
- Provider returns an ID that does not exist or does not belong to the current data owner.
- Provider returns invalid field values, such as negative expense amount.

Frontend behavior:

- Show a friendly error message.
- Keep the original input in the text box.
- Allow retry.
- Do not clear the conversation until the user closes it.

## Validation Rules

Backend validates model output before returning it:

- `status` must be `ready`, `needs_input`, or `unsupported`.
- `actionType` must be `create_node`, `create_todo`, or `create_expense`.
- Dates must be normalized to `YYYY-MM-DD`.
- Expense `amount` must be greater than 0.
- Node `budget`, if present, must be greater than or equal to 0.
- `nodeId` and `todoId` must belong to the authenticated user's `dataOwnerId`.
- Unknown expense categories fall back to existing category defaults.

Existing create APIs remain the final source of truth for persistence validation.

## Testing Plan

Backend tests:

- Provider selection from `AI_PROVIDER`.
- OpenAI adapter maps structured output to `AiParseResult`.
- MiniMax adapter maps chat-completion JSON to `AiParseResult`.
- Missing required fields return `needs_input`.
- Unsupported commands return `unsupported`.
- Invalid `nodeId` or `todoId` is rejected or converted to `needs_input`.
- Provider timeout and malformed response become friendly errors.
- No parse endpoint test writes to timeline, todo, or expense tables.

Frontend tests:

- Floating AI entry opens and closes the drawer.
- Submitting input calls `parse-command`.
- `ready` create-node draft renders a confirmation card and calls `timelineAPI.createNode` on confirm.
- `ready` create-todo draft calls `todoAPI.createTodo` on confirm.
- `ready` create-expense draft calls `expenseAPI.createExpense` on confirm.
- `needs_input` node selection fills `nodeId` before create-todo confirmation.
- `needs_input` todo selection fills `todoId` before create-expense confirmation.
- `unsupported` displays a non-writing message.
- API errors keep the original input available for retry.

## Implementation Boundaries

Use small, testable modules:

- Backend route: `aiRoutes`.
- Backend controller: parse request, build context, call service.
- Backend service: provider selection, context loading, output validation.
- Provider adapters: `openaiProvider`, `minimaxProvider`.
- Shared AI types and schema validation helpers.
- Frontend API client additions for `aiAPI.parseCommand`.
- Frontend assistant component and confirmation-card subcomponents.

The first implementation plan should keep provider adapters isolated so adding future providers does not affect the frontend or persistence APIs.
