# DataLoom 接入计划清单

> 依据文档：`src/voice/DataLoom-WebSocket接口说明.md`
>
> 目标：在保留现有前端语音执行骨架的前提下，补齐 `ASR final 文本 -> DataLoom -> action_plan/clarify -> 前端执行` 的完整链路。

## 1. 接入目标

本次接入的目标不是重做语音系统，而是基于当前已有能力补齐后端 AI 指令通道。

当前已具备：

- `CloudRecognizer` 负责音频采集与 WebSocket ASR 识别
- `VoiceParser`、`voiceDispatcher`、`CommandOrchestrator` 负责本地解析和执行
- `pageAdapterRegistry`、`moduleControlRegistry` 负责页面与模块执行
- `VoiceCommandPanel` 负责语音交互面板

本次要补的是：

- 与 DataLoom 的业务 WebSocket 长连接
- 发送 `command + context`
- 接收 `system/stream/action_plan/clarify/done/error`
- 将 `action_plan` 转换为当前前端执行模型
- 在面板中展示流式内容、追问、推荐问题和错误状态

---

## 2. 总体实施策略

采用“**保留现有执行器，新增 DataLoom 指令通道**”方案。

链路调整为：

```text
用户语音
  -> CloudRecognizer 产出 ASR final 文本
  -> 前端采集当前页面上下文
  -> 通过 DataLoom WebSocket 发送 command
  -> 后端返回 stream / action_plan / clarify / done / error
  -> 前端将 action_plan 映射为当前可执行命令
  -> 继续复用 dispatcher / orchestrator / adapter / module registry 执行
```

这样做的好处：

- 不推翻现有前端语音骨架
- 页面执行逻辑仍复用现有 adapter 和 executionRules
- 风险集中在“协议接线 + 映射转换”，不影响已有本地控制体系

---

## 3. 先决条件确认清单

正式开发前，先确认以下事项：

### 3.1 WebSocket 地址

统一口径：只使用以下主路径，不再考虑兼容路径：

- 主路径：`ws(s)://{host}/ops/ws/ai/chat/v1/{userId}`

需要确认：

- 前端是否必须传 `userId`
- `userId` 从当前登录态哪里获取

### 3.2 鉴权方式

文档建议：

- 优先 Header：`Authorization: Bearer {access_token}`
- 浏览器受限时用 query `token`

需要确认：

- 浏览器侧是否统一采用 query `token`
- 是否存在现成 token 获取方式

### 3.3 动作字段约定

文档中后端动作示例包含：

- `setBoardType`
- `setOrg`
- `setStartYearPeriod`
- `setEndYearPeriod`
- `navigate`

而当前前端只实现：

- `setYearPeriod`

需要确认：

- 后端是否固定使用 `setStartYearPeriod + setEndYearPeriod`
- 是否还会返回更多新动作类型

### 3.4 澄清结构

当前文档中：

- `clarify.options` 仅为 `string[]`

需要确认：

- 短期是否仍只返回文案数组
- 是否后续会补充 `moduleId/controlId/value`

---

## 4. 分阶段实施计划

## 4.1 P0：协议确认与边界定义

目标：

- 确认主路径地址、鉴权方式、用户 ID 获取方式、动作字段约定

输出物：

- 接口确认记录
- 地址与鉴权使用说明
- 动作字段映射约定

验收标准：

- 前端已明确“连哪个地址、带什么 token、是否拼 userId”
- 已明确年度周期动作映射规则

---

## 4.2 P1：定义 DataLoom 协议类型

目标：

- 把后端文档定义为前端强类型，避免后续到处写 `any`

建议新增文件：

- `src/voice/types/dataloom.ts`

需要定义的类型：

- 上行消息
  - `DataLoomCommandMessage`
  - `DataLoomPingMessage`
- 下行消息
  - `DataLoomSystemMessage`
  - `DataLoomPongMessage`
  - `DataLoomStreamMessage`
  - `DataLoomActionPlanMessage`
  - `DataLoomClarifyMessage`
  - `DataLoomDoneMessage`
  - `DataLoomErrorMessage`
- 公共结构
  - `DataLoomPageContext`
  - `DataLoomModuleContext`
  - `DataLoomControlContext`
  - `DataLoomActionPlanPayload`
  - `DataLoomAction`

验收标准：

- 所有 DataLoom 协议字段在前端都有明确类型定义

---

## 4.3 P2：实现 DataLoom WebSocket Client

目标：

- 实现一条专门用于业务指令的 WebSocket 通道

建议新增文件：

- `src/voice/core/dataloomClient.ts`

建议提供的能力：

- `connect()`
- `disconnect()`
- `sendCommand(text, context, requestId)`
- `sendPing()`
- `waitUntilConnected()`
- `isConnected()`
- 事件回调：
  - `onSystem`
  - `onStream`
  - `onActionPlan`
  - `onClarify`
  - `onDone`
  - `onError`
  - `onStatusChange`

实现要求：

- 建连成功后必须等待 `system.connected`
- 未 ready 前不允许发送业务指令
- 定时发送 `ping`
- 收到 `pong` 后更新最后心跳时间
- `done/error` 后释放本轮占用状态
- 支持手动断连与异常断连清理

验收标准：

- 能成功连接到 DataLoom
- 能收到 `system.connected`
- 能收发 `ping/pong`

---

## 4.4 P3：标准化页面上下文构建

目标：

- 把当前前端上下文转成后端文档要求的 `context`

建议新增文件：

- `src/voice/core/buildDataLoomContext.ts`

数据来源：

- `voiceDispatcher.getContextInfo()`
- `pageAdapterRegistry`
- `moduleControlRegistry`

需要输出字段：

- `pageId`
- `boardType`
- `orgs`
- `tabs`
- `modules`
- `modules[].moduleId`
- `modules[].title`
- `modules[].moduleName`
- `modules[].controls`
- `controls[].controlId`
- `controls[].type`
- `controls[].controlName`
- `controls[].options`

注意事项：

- 前端内部字段 `controlType` 需映射为后端要求的 `type`
- `label` 需映射为 `controlName`
- `options[].label/value` 直接透出

验收标准：

- 前端生成的 `context` JSON 可与后端文档示例字段对齐

---

## 4.5 P4：改造 useVoiceControl 接入 DataLoom 主流程

目标：

- 让 backend 模式不再回退到本地 parser，而是先走 DataLoom

涉及文件：

- `src/voice/hooks/useVoiceControl.ts`

当前问题：

- `requestBackendIntent()` 仍是 `TODO`
- `processBackendBranch()` 最终回退到 `createIntentFromText()`

需要改造：

- backend 模式启动时，同时初始化 DataLoom client
- ASR `finalText` 到来后：
  - 生成 `requestId`
  - 构建当前 `context`
  - 发送 `command`
- DataLoom 返回消息后更新本轮状态
- 不再把 backend 模式当成本地 parser 兜底主通路

建议保留兜底策略：

- DataLoom 不可用时，是否允许回退本地 parser，由配置控制

验收标准：

- backend 模式下，`finalText` 已经发送到 DataLoom，而不是直接走本地 parser

---

## 4.6 P5：实现 action_plan 到前端命令模型的映射

目标：

- 把后端返回的动作计划转换成前端当前能执行的命令结构

建议新增文件：

- `src/voice/core/mapDataLoomActionPlan.ts`

映射原则：

- `navigate -> navigate`
- `setBoardType -> setBoardType`
- `setOrg -> setOrg`
- `openModule -> openModule`
- `setModuleTab -> setModuleTab`
- `setSelect -> setSelect`

特殊映射：

- `setStartYearPeriod + setEndYearPeriod -> setYearPeriod`

映射结果建议输出为：

- `ParsedCommand`
- 或 `VoiceIntent` 中的 `command`

当前重点：

- 后端动作要能对接前端现有 `dispatcher -> orchestrator -> adapter`

验收标准：

- mock 返回 `action_plan` 后，前端可转换为当前可执行结构并正确执行

---

## 4.7 P6：补齐年度周期映射逻辑

目标：

- 消除后端年度周期动作与前端现有动作模型的不一致

建议新增文件：

- `src/voice/core/mapYearPeriod.ts`

建议规则：

- `2026` + `半年度` -> `2026-1`
- `2026` + `半年` -> `2026-1`
- `2026` + `年度/全年/整年` -> `2026-2`

需要确认：

- `PERIOD_TYPE.HALF_YEAR`
- `PERIOD_TYPE.YEAR`

验收标准：

- 后端返回 `setStartYearPeriod` 和 `setEndYearPeriod` 时，前端能稳定映射成 `setYearPeriod`

---

## 4.8 P7：接入 clarify 流程

目标：

- 支持后端主动发起澄清追问

涉及文件：

- `src/voice/registry/clarifyContextStore.ts`
- `src/voice/hooks/useVoiceControl.ts`
- `src/voice/components/VoiceCommandPanel.vue`

当前差异：

- 前端本地澄清是对象数组
- 后端文档里的 `clarify.options` 是 `string[]`

需要处理：

- 保存 `message`
- 保存 `options`
- 面板展示候选项
- 用户选择后，将文案作为下一轮 `command.text` 重新发送
- 重新携带最新页面上下文

验收标准：

- 输入“切到趋势图”后，前端能展示澄清项，并在选中后发起下一轮请求

---

## 4.9 P8：接入 stream 过程展示

目标：

- 在执行过程中展示 DataLoom 的流式思考文本

涉及文件：

- `src/voice/components/VoiceCommandPanel.vue`
- 可选：新增状态 store

处理原则：

- `stream.delta` 仅用于展示
- 不参与动作执行
- `done` 到来后结束本轮展示

建议 UI 表现：

- “处理中...” 状态下展示过程文本
- 不覆盖最终 `chatReply` 或执行结果

验收标准：

- 收到 `stream` 后，用户能看到过程信息

---

## 4.10 P9：接入 chatReply 与 recommend 展示

目标：

- 支持后端聊天型返回

涉及字段：

- `payload.intentType`
- `payload.chatReply`
- `payload.recommend`

处理规则：

- 当 `intentType === chat` 且 `actions=[]`
  - 不执行页面动作
  - 直接展示 `chatReply`
  - 展示 `recommend`
- 当 `intentType === command`
  - 先执行动作
  - 若 `chatReply` 非空，可作为补充文案展示

验收标准：

- 输入“你好”后，能正确展示聊天回复和推荐问题

---

## 4.11 P10：接入 done / error / pong 与异常处理

目标：

- 完善一轮请求的完整生命周期

需要处理：

- `done`
  - 标记本轮结束
  - 清理处理中状态
  - 允许下一轮发送
- `error`
  - 根据错误码输出用户提示
- `pong`
  - 更新时间戳
  - 用于连接健康检测

错误码处理建议：

- `JL_2001`
  - 提示用户重新输入
- `JL_5001`
  - 等待 `connected` 后重试
  - 或触发重连
- `JL_4002`
  - 提示稍后再试
- `JL_9999`
  - 提示系统异常
  - 自动触发重连

验收标准：

- 错误事件可展示用户可理解的提示
- `done/error` 后可以继续下一轮

---

## 4.12 P11：连接生命周期与重连策略

目标：

- 保证业务通道可用性

建议策略：

- 打开 backend 模式时建连
- 关闭面板或页面卸载时断连
- socket close/心跳超时时自动重连
- 重连成功后等待 `system.connected`
- 不做跨连接恢复旧会话，和后端文档保持一致

验收标准：

- 非正常断线后可自动恢复
- 恢复后能继续发送新请求

---

## 5. 建议改动文件清单

## 5.1 新增文件

- `src/voice/types/dataloom.ts`
- `src/voice/core/dataloomClient.ts`
- `src/voice/core/buildDataLoomContext.ts`
- `src/voice/core/mapDataLoomActionPlan.ts`
- `src/voice/core/mapYearPeriod.ts`
- 可选：`src/voice/store/dataloomSessionState.ts`

## 5.2 修改文件

- `src/voice/hooks/useVoiceControl.ts`
- `src/voice/components/VoiceCommandPanel.vue`
- `src/voice/registry/clarifyContextStore.ts`
- 视需要修改：
  - `src/voice/types/command.ts`
  - `src/voice/types.ts`

## 5.3 原则上无需改动的核心执行文件

以下文件尽量不做结构性推翻，只做必要兼容：

- `src/voice/core/dispatcher.ts`
- `src/voice/core/orchestrator.ts`
- `src/voice/registry/executionRules.ts`
- `src/voice/adapters/homeAdapter.ts`
- `src/voice/adapters/opcenterAdapter.ts`

---

## 6. 验收清单

## 6.1 阶段 1：通道联通

- [ ] 能成功连接 DataLoom
- [ ] 能收到 `system.connected`
- [ ] 能发送 `ping`
- [ ] 能收到 `pong`
- [ ] 未 ready 前不发送业务指令

## 6.2 阶段 2：聊天场景

- [ ] 输入“你好”可发送 `command`
- [ ] 面板展示 `chatReply`
- [ ] 面板展示 `recommend`
- [ ] 收到 `done` 后结束本轮

## 6.3 阶段 3：命令场景

- [ ] 输入“去对标看板看华南区域2026年半年度数据”
- [ ] 能收到 `action_plan`
- [ ] 能正确执行 `navigate`
- [ ] 能正确执行 `setBoardType`
- [ ] 能正确执行 `setOrg`
- [ ] 能正确完成年度周期映射

## 6.4 阶段 4：澄清场景

- [ ] 输入“切到趋势图”
- [ ] 能收到 `clarify`
- [ ] 面板正确展示选项
- [ ] 选择后重新发起下一轮请求
- [ ] 下一轮能成功执行

## 6.5 阶段 5：异常与恢复

- [ ] `JL_2001` 提示重新输入
- [ ] `JL_5001` 提示等待 ready 或自动重试
- [ ] `JL_4002` 提示稍后再试
- [ ] `JL_9999` 触发重连
- [ ] 断线重连后可继续使用

---

## 7. 风险清单

### 7.1 `userId` 来源不明确

主路径要求：

- URL 中必须带 `{userId}`

风险：

- 如果现有前端拿不到登录用户 ID，会阻塞主路径接入

### 7.2 浏览器 Header 限制

风险：

- 浏览器原生 `WebSocket` 不方便设置 Authorization Header

建议：

- 短期优先 query `token`

### 7.3 年度周期动作不一致

风险：

- 后端动作模型与前端动作模型不一致

建议：

- 先做映射，不急于扩展前端动作类型

### 7.4 澄清候选项缺少结构化字段

风险：

- 前端无法直接执行候选项

建议：

- 当前阶段走“选择文案再发下一轮”

### 7.5 双通路混跑

风险：

- backend 分支如果继续偷偷回退本地 parser，联调期容易出现“看起来能执行，但其实没走后端”的误判

建议：

- 正式联调阶段给 backend 模式加明确标识
- 必要时关闭本地 parser 回退

---

## 8. 推荐排期拆分

可以拆成 5 个开发任务：

1. `DataLoom` 协议类型与 WebSocket Client
2. `useVoiceControl` backend 分支正式接线
3. `action_plan` 映射与年度周期转换
4. 面板支持 `stream/clarify/chatReply/recommend`
5. 异常处理、重连与 mock 联调验收

---

## 9. 一句话结论

本次接入的正确做法是：

> 保留现有前端语音执行骨架，新增 DataLoom 业务通道，并把后端返回的 `action_plan/clarify` 映射到当前前端执行体系中。
