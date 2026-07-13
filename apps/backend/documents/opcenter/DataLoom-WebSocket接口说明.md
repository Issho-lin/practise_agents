# 问数金灵 WebSocket 接口说明（前端接入版）

## 1. 接口用途

`ops-cockpit` 提供 WebSocket 长连接给前端。前端负责语音采集、ASR 识别、页面上下文采集和动作执行；后端负责接收 ASR final 文本与页面上下文，调用问数金灵智能体，并返回可展示文本或可执行的驾驶舱动作计划。

一条 WebSocket 连接会绑定一个后端智能体会话。前端不需要传 `sessionId`、`username`、`fullname`，这些信息由后端从登录 token 中解析。

## 2. 连接地址

```text
ws(s)://{host}/ops/ws/ai/chat/v1/{userId}
```

旧路径中的 `{userId}` 必须和 token 解析出的登录用户 ID 一致，否则握手失败。新接入优先使用主路径。

## 3. 握手鉴权

推荐通过请求头传 token：

```http
Authorization: Bearer {access_token}
```

浏览器原生 `WebSocket` 如果不方便设置自定义 Header，也支持 query token：

```text
wss://{host}/ws/jinling/command?token={access_token}
```

还兼容 `Sec-WebSocket-Protocol` 中的 `Bearer {access_token}`，但前端优先使用 Header 或 query token 即可。

可选 query 参数：

| 参数 | 必填 | 说明 |
| --- | --- | --- |
| `token` | 否 | 访问 token。Header 无法传 token 时使用 |
| `message` | 否 | 初始化智能体会话时的首条文案；不传默认为 `新会话` |

握手失败时 HTTP 状态码为 `401`。

## 4. 建连成功事件

握手成功后，服务端会先创建智能体会话。会话初始化完成后推送：

```json
{
  "type": "system",
  "event": "connected",
  "sessionId": "assist-session-id",
  "message": "问数金灵已就绪，请说话"
}
```

前端建议收到 `connected` 后再允许用户发送指令。若在 `connected` 前发送指令，可能返回 `JL_5001` 会话未就绪错误。

## 5. 上行消息

### 5.1 指令消息

前端在拿到 ASR final 文本后发送 `command` 消息：

```json
{
  "type": "command",
  "requestId": "req-20260623-0001",
  "text": "去对标看板看华南区域2026年半年度数据",
  "context": {
    "pageId": "opcenter",
    "boardType": 1,
    "orgs": ["集团", "华南区域公司"],
    "tabs": ["金地智慧服务整体", "赛道"],
    "modules": [
      {
        "moduleId": "opcenter:branch-revenue",
        "title": "下属营收",
        "moduleName": "下属营收",
        "controls": [
          {
            "controlId": "displayTab",
            "type": "tab",
            "controlName": "展示维度",
            "options": [
              { "label": "趋势图", "value": "trend" },
              { "label": "按历史比", "value": "historyRatio" }
            ]
          }
        ]
      }
    ]
  }
}
```

指令字段：

| 字段 | 必填 | 类型 | 说明 |
| --- | --- | --- | --- |
| `type` | 否 | string | 建议固定传 `command`。为空时后端也按指令处理 |
| `requestId` | 否 | string | 前端生成的请求 ID；不传时后端自动生成，但前端难以匹配响应 |
| `text` | 是 | string | 用户输入文本或 ASR final 文本 |
| `fileUrl` | 否 | string | 附件地址，当前透传给智能体 |
| `context` | 建议传 | object | 当前页面上下文，智能体依赖它生成可执行动作 |

页面上下文字段：

| 字段 | 必填 | 类型 | 说明 |
| --- | --- | --- | --- |
| `pageId` | 建议传 | string | 当前页面 ID，例如 `opcenter` |
| `boardType` | 建议传 | number | 当前看板类型 |
| `orgs` | 建议传 | string[] | 当前页面可见或已选组织 |
| `tabs` | 建议传 | string[] | 当前页面可见或已选 tab |
| `modules` | 建议传 | object[] | 当前页面模块和可操作控件列表 |
| `modules[].moduleId` | 建议传 | string | 模块唯一 ID |
| `modules[].title` | 否 | string | 模块标题 |
| `modules[].moduleName` | 否 | string | 模块名称 |
| `modules[].controls` | 否 | object[] | 模块内可操作控件 |
| `controls[].controlId` | 建议传 | string | 控件唯一 ID |
| `controls[].type` | 否 | string | 控件类型，例如 `tab`、`select` |
| `controls[].controlName` | 否 | string | 控件名称 |
| `controls[].options` | 否 | object[] | 控件可选项 |
| `options[].label` | 否 | string | 展示文案 |
| `options[].value` | 否 | any | 实际值 |

### 5.2 心跳消息

前端可定时发送：

```json
{
  "type": "ping",
  "ts": 1782201600000
}
```

服务端会原样返回 `ts`；若未传 `ts`，服务端返回当前时间戳。

## 6. 下行消息

所有下行消息都是 JSON 文本，不使用 HTTP 统一响应包装。前端按 `type` 分发处理。

### 6.1 `system`：系统事件

当前只有建连完成事件：

```json
{
  "type": "system",
  "event": "connected",
  "sessionId": "assist-session-id",
  "message": "问数金灵已就绪，请说话"
}
```

### 6.2 `pong`：心跳响应

```json
{
  "type": "pong",
  "ts": 1782201600000
}
```

### 6.3 `stream`：流式文本片段

智能体返回未完成内容时，服务端会转发流式片段：

```json
{
  "type": "stream",
  "requestId": "req-20260623-0001",
  "delta": "正在分析当前看板上下文..."
}
```

`delta` 可能是自然语言，也可能是模型输出的中间内容。前端可以用于过程展示，但最终执行动作必须以 `action_plan` 或 `clarify` 为准。

### 6.4 `action_plan`：完整动作计划

```json
{
  "type": "action_plan",
  "requestId": "req-20260623-0001",
  "payload": {
    "event": "result",
    "requestId": "req-20260623-0001",
    "rawText": "去对标看板看华南区域2026年半年度数据",
    "intentType": "command",
    "thinking": "用户意图明确：切换到对标看板，筛选华南区域，设置对标周期为2026年半年度",
    "chatReply": "",
    "confidence": 0.92,
    "recommend": [],
    "actions": [
      {
        "type": "navigate",
        "rawValue": "切到运营驾驶舱",
        "pageId": "opcenter",
        "targetCode": "ops-cockpit"
      },
      {
        "type": "setBoardType",
        "rawValue": "对标看板",
        "value": 3
      },
      {
        "type": "setOrg",
        "rawValue": "华南区域",
        "value": "华南区域公司"
      },
      {
        "type": "setStartYearPeriod",
        "rawValue": "2026年",
        "value": "2026"
      },
      {
        "type": "setEndYearPeriod",
        "rawValue": "半年度",
        "value": "半年度"
      }
    ]
  }
}
```

`payload` 字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `event` | string | 结果事件标识，mock 中为 `result` |
| `requestId` | string | 请求 ID |
| `rawText` | string | 用户原始文本 |
| `intentType` | string | 意图类型，常见值：`command`、`chat` |
| `thinking` | string | 智能体推理摘要，可用于调试，不建议直接展示给用户 |
| `chatReply` | string | 给用户看的回复文案 |
| `confidence` | number | 置信度 |
| `recommend` | string[] | 推荐问题列表 |
| `actions` | object[] | 前端动作数组 |

`actions[]` 字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `type` | string | 动作类型，例如 `navigate`、`setBoardType`、`setOrg`、`setStartYearPeriod`、`setEndYearPeriod`、`clarify` |
| `rawValue` | string | 用户话术中对应的原始值或动作描述 |
| `pageId` | string | 目标页面 ID |
| `targetCode` | string | 目标页面、菜单或业务编码 |
| `moduleId` | string | 目标模块 ID |
| `controlId` | string | 目标控件 ID |
| `value` | any | 前端执行动作时使用的实际值 |
| `reason` | string | 动作原因说明 |
| `options` | object[] | 澄清候选项，仅 `clarify` 等场景使用 |

如果智能体没有返回合法动作 JSON，后端会兜底返回 `intentType=chat`、`actions=[]` 的 `action_plan`，前端按普通聊天回复展示 `chatReply` 即可。

### 6.5 `clarify`：澄清追问

当模型返回的动作中包含 `type=clarify`，服务端不会下发完整 `action_plan`，而是转换成澄清事件：

```json
{
  "type": "clarify",
  "requestId": "req-clarify-001",
  "message": "当前页面有多个趋势图，请确认要切换哪一个？",
  "options": ["下属营收-趋势图", "下属新增签约-趋势图", "下属回款-趋势图"]
}
```

前端展示 `message` 和 `options` 让用户选择。用户选择后，建议把选项文案作为下一轮 `command.text` 发送，并带上最新页面上下文。

注意：当前 `clarify.options` 只下发文案数组，不包含 `moduleId`、`controlId`、`value`。如果前端需要直接执行候选项，需要后端扩展该事件结构。

### 6.6 `done`：单轮完成

每轮指令完成后都会发送：

```json
{
  "type": "done",
  "requestId": "req-20260623-0001"
}
```

正常顺序通常是：

```text
stream* -> action_plan | clarify -> done
```

`stream*` 表示可能有 0 到多条 `stream`。

### 6.7 `error`：错误事件

```json
{
  "type": "error",
  "requestId": "req-20260623-0001",
  "code": "JL_4002",
  "message": "LLM 调用异常"
}
```

错误码：

| code | 场景 | 前端建议 |
| --- | --- | --- |
| `JL_2001` | 参数错误，例如消息类型不支持、文本为空 | 提示用户重新输入 |
| `JL_5001` | 智能体会话未就绪 | 等待 `connected` 后重试，或重连 |
| `JL_4002` | 智能体调用异常 | 提示稍后再试，可保留用户原问题 |
| `JL_9999` | 系统异常或会话初始化失败 | 提示服务异常，并触发重连 |

## 7. 前端接入建议

1. 建连后等待 `system.connected`，再开放语音按钮或发送首条指令。
2. 每条用户 final 文本生成一个 `requestId`，所有下行事件用该 ID 归并。
3. 同一连接内后端只保留一个运行中的问答；如果上一轮未完成又发送新 `command`，上一轮会被取消。前端建议在收到 `done` 或 `error` 后再发送下一条。
4. 执行动作只认 `action_plan.payload.actions`；`stream.delta` 只用于过程展示。
5. 收到 `clarify` 时先让用户选择，不要猜测执行。
6. 断线后重新连接即可，后端会创建新的智能体会话。当前接口没有跨连接恢复旧会话的参数。

## 8. 浏览器示例

```js
const token = encodeURIComponent(accessToken);
const ws = new WebSocket(`wss://${host}/ws/jinling/command?token=${token}`);

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);

  switch (msg.type) {
    case 'system':
      if (msg.event === 'connected') {
        console.log('ready', msg.sessionId);
      }
      break;
    case 'stream':
      appendThinkingText(msg.requestId, msg.delta);
      break;
    case 'action_plan':
      renderReply(msg.payload.chatReply);
      executeActions(msg.payload.actions || []);
      renderRecommend(msg.payload.recommend || []);
      break;
    case 'clarify':
      showClarifyOptions(msg.message, msg.options || []);
      break;
    case 'done':
      markRequestDone(msg.requestId);
      break;
    case 'error':
      showError(msg.message);
      break;
    case 'pong':
      updateHeartbeat(msg.ts);
      break;
    default:
      console.warn('unknown ws message', msg);
  }
};

function sendCommand(text, context) {
  ws.send(JSON.stringify({
    type: 'command',
    requestId: crypto.randomUUID(),
    text,
    context
  }));
}

function ping() {
  ws.send(JSON.stringify({
    type: 'ping',
    ts: Date.now()
  }));
}
```

## 9. Mock 联调场景

后端开启 mock 后：

```yaml
dataloom:
  mock:
    enabled: true
```

### 9.1 普通聊天/不会问

上行：

```json
{
  "type": "command",
  "requestId": "req-chat-001",
  "text": "你好",
  "context": {
    "pageId": "opcenter",
    "boardType": 1,
    "orgs": ["集团"],
    "tabs": [],
    "modules": []
  }
}
```

下行：

```json
{
  "type": "action_plan",
  "requestId": "req-chat-001",
  "payload": {
    "event": "result",
    "requestId": "req-chat-001",
    "rawText": "你好",
    "intentType": "chat",
    "thinking": "用户打招呼或未包含明确业务意图，需引导其了解可用指令",
    "chatReply": "您好！我是AI问数金灵，可以帮您语音操控运营驾驶舱。您可以试试以下提问方式：",
    "confidence": 0.86,
    "recommend": ["去对标看板看2026年半年度数据", "看华南区域3月数据", "切换下属营收到按历史比", "打开全屏"],
    "actions": []
  }
}
```

随后发送：

```json
{
  "type": "done",
  "requestId": "req-chat-001"
}
```

### 9.2 完整指令

上行文本包含 `去对标看板看华南区域2026年半年度数据` 时：

```json
{
  "type": "action_plan",
  "requestId": "req-command-001",
  "payload": {
    "event": "result",
    "requestId": "req-command-001",
    "rawText": "去对标看板看华南区域2026年半年度数据",
    "intentType": "command",
    "thinking": "用户意图明确：切换到对标看板，筛选华南区域，设置对标周期为2026年半年度",
    "chatReply": "",
    "confidence": 0.92,
    "recommend": [],
    "actions": [
      { "type": "navigate", "rawValue": "切到运营驾驶舱", "pageId": "opcenter", "targetCode": "ops-cockpit" },
      { "type": "setBoardType", "rawValue": "对标看板", "value": 3 },
      { "type": "setOrg", "rawValue": "华南区域", "value": "华南区域公司" },
      { "type": "setStartYearPeriod", "rawValue": "2026年", "value": "2026" },
      { "type": "setEndYearPeriod", "rawValue": "半年度", "value": "半年度" }
    ]
  }
}
```

随后发送 `done`。

### 9.3 澄清追问

上行文本包含 `切到趋势图` 时：

```json
{
  "type": "clarify",
  "requestId": "req-clarify-001",
  "message": "当前页面有多个趋势图，请确认要切换哪一个？",
  "options": ["下属营收-趋势图", "下属新增签约-趋势图", "下属回款-趋势图"]
}
```

随后发送 `done`。
