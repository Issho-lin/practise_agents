# 语音指令解析层对接协议 (Voice Parse Protocol) v2

> **目标**：解耦 Parser 实现，使 `parse` 层可替换为任意方案（规则引擎/大模型 NLU/第三方 NLP 服务），而 Dispatcher 无需改动。
>
> **设计原则**：Parser 只输出「意图 + 动作序列」，不输出中间解析状态，消除 entities/actions 双重存储。

---

## 一、核心数据流

```
用户语音 → ASR识别 → 原始文本 ──→ [Parser.parse()] ──→ VoiceIntent ──→ [Dispatcher.dispatch()] ──→ VoiceActionResult
                                    ↑
                              本协议定义的边界
```

**关键调用点**: `useVoiceControl.ts:60-65`

```typescript
const intent = parser.parse(resolvedText);       // 解析
const result = await voiceDispatcher.dispatch(intent); // 分发执行
```

---

## 二、Parser 接口契约 (IVoiceParser)

任何 Parser 实现必须满足以下接口：

```typescript
interface IVoiceParser {
  /**
   * 注入运行时上下文（每次解析前调用）
   * @param orgs        当前可用组织名列表（用于实体消歧）
   * @param tabs        当前页面可用 Tab 列表
   * @param currentPageId 当前页面ID ('home' | 'opcenter')
   * @param currentBoardType 当前看板类型 (1|2|3)
   * @param modules     当前页面的可控模块列表
   */
  setContext(
    orgs: string[],
    tabs: string[],
    currentPageId?: PageId,
    currentBoardType?: number,
    modules?: ModuleContext[]
  ): void;

  /**
   * 核心方法：将自然语言文本解析为结构化意图
   * @param text 用户原始输入（ASR 识别结果或手动输入）
   * @returns VoiceIntent 结构化意图对象
   */
  parse(text: string): VoiceIntent;
}
```

---

## 三、输出协议：VoiceIntent（极简结构）

这是 **Parser 与 Dispatcher 之间唯一的契约数据结构**：

```typescript
interface VoiceIntent {
  /** 用户原始输入（仅此一份，用于日志 & 澄清上下文） */
  rawText: string;

  /** 置信度 0~1（0 = 完全无法识别，此时 actions 应为空数组） */
  confidence: number;

  /** 有序动作列表，空数组表示无法识别 */
  actions: CommandAction[];
}
```

### 设计决策

| 砍掉的字段 | 原因 |
|---|---|
| ~~`type: VoiceIntentType`~~ | 由 `actions` 推导——空数组=不识，含 `fullscreen`=全屏，含 `navigate`=跳转，其他=筛选 |
| ~~`entities: VoiceEntity`~~ | 与 `actions` 重复存储同份数据（`orgName`↔`setOrg`, `month`↔`setMonth`, ...） |
| ~~`fullscreenAction`~~ | 全屏也是一种动作，统一收进 `actions` 作为 `{ type: 'fullscreen' }` |
| ~~`ParsedCommand` 包装层~~ | `currentPageId/targetPageId/needNavigate` 均可从 actions + Dispatcher context 推导 |

---

## 四、动作类型：CommandAction（联合类型）

每个 Action 代表一个原子操作，**Dispatcher 按数组顺序执行**：

### 4.1 导航类

```typescript
// 页面跳转（如存在，必须是 actions[0]）
{
  type: 'navigate';
  pageId: 'home' | 'opcenter';
  targetCode: COCKPIT_CODE;    // 路由编码，对应 router/menu 枚举
  rawValue?: string;           // 用户原文中匹配到的片段（用于日志）
}

// 全屏控制
{
  type: 'fullscreen';
  action: 'enter' | 'exit';    // 进入/退出全屏
  rawValue?: string;
}
```

### 4.2 筛选类

```typescript
// 设置看板类型（驾驶舱页面）
{ type: 'setBoardType'; value: 1 | 2 | 3; rawValue?: string; }

// 设置组织（值必须在 setContext 注入的 orgs 列表中）
{ type: 'setOrg'; value: string; rawValue?: string; }

// 设置月份（格式: YYYY-MM）
{ type: 'setMonth'; value: string; rawValue?: string; }

// 设置年度周期（对标看板专用，格式: YYYY-period_type）
{ type: 'setYearPeriod'; value: string; rawValue?: string; }

// 设置页面级 Tab（值必须在 setContext 注入的 tabs 列表中）
{ type: 'setPageTab'; value: string; rawValue?: string; }
```

### 4.3 模块控制类

```typescript
// 模块内 Tab 切换
{
  type: 'setModuleTab';
  moduleId: string;            // 模块唯一标识（来自 ModuleContext.moduleId）
  controlId: string;           // 控件唯一标识（来自 ModuleControlDefinition.controlId）
  value: string | number;      // 选中的 option.value
  rawValue?: string;
}

// 模块内下拉选择
{
  type: 'setSelect';
  moduleId: string;
  controlId: string;
  value: string | number;
  rawValue?: string;
}
```

### 4.4 特殊动作

```typescript
// 空操作（匹配到模块但该模块不可执行时的提示）
{ type: 'noop'; reason: string; rawValue?: string; }

// 职责边界：
// - 后端 Parser 负责语义理解与动作生成，不做最终“可执行性”裁决
// - 前端 Dispatcher/Adapter 基于实时页面状态做最终判定
// - 命中不可执行模块时，由前端返回 noop/skip 结果

// 需要用户澄清（多模块歧义时触发 NEED_CLARIFY 流程）
// 设计原则：Parser 只传 moduleIds，前端从 setContext 注入的 modules 中查表渲染选项
{
  type: 'clarify';
  reason: string;              // 向用户解释为什么需要选择
  moduleIds: string[];         // 歧义模块的 ID 列表（非空）
  rawValue?: string;           // 用户原文中匹配到的关键词（用于二次解析）
}
```

> **为什么不下发 `options`？**
> 前端在 `setContext()` 时已经注入了完整的 `ModuleContext[]`，其中包含每个模块的 `title`、`aliases` 等展示信息。
> Parser 只需返回歧义的 `moduleId` 列表，前端自行查表即可渲染选项——避免重复传输前端已有的数据。

---

## 五、Dispatcher 对 Intent 的处理流程

```
VoiceIntent 输入
    │
    ├─ actions 为空 ────────────────→ 返回 NOT_RECOGNIZED
    │
    ├─ actions[0].type === 'fullscreen'
    │   ├─ action='enter' ──────────→ requireConfirm=true（等待用户确认）
    │   └─ action='exit'  ──────────→ 执行退出全屏
    │
    ├─ actions[0].type === 'navigate'
    │   且 targetCode 属于外部功能 ──→ 执行外部导航
    │
    └─ 其余情况 ────────────────────→ orchestrator.execute(intent)
                                        │
                                        ├── 按 actions 顺序遍历执行
                                        │     ├── fullscreen → 直接执行全屏 API
                                        │     ├── navigate   → 先跳转等待页面就绪
                                        │     ├── set*       → 调用 IPageAdapter.execute()
                                        │     ├── clarify    → 返回 NEED_CLARIFY + 存入上下文
                                        │     └── noop       → 返回 NO_OP + reason
                                        │
                                        └── 汇总 → VoiceActionResult
```

### 返回值协议：VoiceActionResult

```typescript
interface VoiceActionResult {
  success: boolean;             // 操作是否成功
  message: string;              // 展示给用户的反馈文案
  requireConfirm?: boolean;     // 是否需要用户二次确认（目前仅全屏进入时）
  status?: CommandStatus;       // 详细状态码
  actions?: ActionResult[];     // 各 action 的执行明细
}

enum CommandStatus {
  SUCCESS = 'success',
  PARTIAL_SUCCESS = 'partial_success',
  FAILED = 'failed',
  NEED_CLARIFY = 'need_clarify',
  NO_OP = 'no_op',
}
```

---

## 六、上下文注入协议

Parser 在每次 `parse()` 前，必须通过 `setContext()` 接收当前运行时状态：

| 字段 | 类型 | 用途 |
|---|---|---|
| `orgs` | `string[]` | 组织名白名单，`setOrg` 的 value 必须在此范围内 |
| `tabs` | `string[]` | 当前页面可用 Tab 名，`setPageTab` 的 value 必须在此范围内 |
| `currentPageId` | `'home' \| 'opcenter'` | 当前所在页面，影响默认目标推断 |
| `currentBoardType` | `number \| undefined` | 当前看板类型(1\|2\|3)，影响模块可见性 |
| `modules` | `ModuleContext[]` | 可控模块注册表，用于生成 setModuleTab/setSelect 动作 |

### ModuleContext 结构

```typescript
interface ModuleContext {
  pageId: PageId;               // 所属页面
  boardType?: number;           // 所属看板类型（null=全部可见）
  moduleId: string;             // 唯一标识
  title: string;                // 显示名称
  aliases?: string[];           // 语音别名（优先匹配）
  executable?: boolean;         // false 时匹配到只能产出 noop
  controls: Array<{
    controlId: string;
    controlType: 'tab' | 'select';
    label: string;
    aliases?: string[];
    options: Array<{
      label: string;
      value: string | number;
      aliases?: string[];
    }>;
  }>;
}
```

---

## 七、接入 Checklist（新 Parser 方案）

- [ ] **实现 `IVoiceParser` 接口**
- [ ] **`actions` 语义**：
  - 空数组 `[]` → 无法识别，confidence 应为 0
  - 非空 → confidence 必须在 (0, 1] 区间
- [ ] **action 值域约束**：
  - `setOrg.value` ∈ orgs 列表
  - `setPageTab.value` ∈ tabs 列表
  - `setMonth.value` 格式 `YYYY-MM`
  - `setBoardType.value` ∈ `{1, 2, 3}`
- [ ] **actions 顺序**：navigate 必须排最前（如有）
- [ ] **confidence 语义**：
  - `>= 0.8` 高置信度（精确匹配关键词/实体）
  - `0.5 ~ 0.8` 中置信度（模糊/别名匹配）
  - `(0, 0.5)` 低置信度（兜底，避免走空数组）
  - `0` → actions 应为空数组 `[]`
- [ ] **clarify 规范**：moduleIds 非空才触发澄清；label/title/aliases 由前端从 ModuleContext 查表获取
- [ ] **rawText 原样保留**：不做修改，用于日志和 clarify 上下文存储

---

## 八、示例对比

### 示例 1：简单筛选

**输入**: `"看一下华南区域三月份的数据"`

**输出**:
```json
{
  "rawText": "看一下华南区域三月份的数据",
  "confidence": 0.85,
  "actions": [
    { "type": "setOrg", "value": "华南区域", "rawValue": "华南区域" },
    { "type": "setMonth", "value": "2026-03", "rawValue": "三月份" }
  ]
}
```

### 示例 2：跨页面跳转 + 多维筛选

**输入**: `"去驾驶舱看规模看板的年度数据"`

**输出**:
```json
{
  "rawText": "去驾驶舱看规模看板的年度数据",
  "confidence": 0.9,
  "actions": [
    { "type": "navigate", "pageId": "opcenter", "targetCode": "gui_mo_kan_ban", "rawValue": "去驾驶舱" },
    { "type": "setBoardType", "value": 2, "rawValue": "规模看板" },
    { "type": "setYearPeriod", "value": "2025-year", "rawValue": "年度" }
  ]
}
```

### 示例 3：全屏

**输入**: `"打开全屏"`

**输出**:
```json
{
  "rawText": "打开全屏",
  "confidence": 0.95,
  "actions": [
    { "type": "fullscreen", "action": "enter", "rawValue": "打开全屏" }
  ]
}
```

### 示例 4：模块歧义需澄清

**输入**: `"切换到趋势图"`（假设模块 `area_trend` 和 `biz_dist_trend` 都有"趋势图"选项）

**输出**:
```json
{
  "rawText": "切换到趋势图",
  "confidence": 0.7,
  "actions": [
    {
      "type": "clarify",
      "reason": "发现多个模块包含「趋势图」选项，请确认您想操作哪个？",
      "moduleIds": ["area_trend", "biz_dist_trend"],
      "rawValue": "趋势图"
    }
  ]
}
```

**前端处理**: `useVoiceControl` 收到 clarify 后，从注入的 `moduleContexts` 中查表：
```typescript
const matchedModules = moduleContexts.filter(m => 
  clarifyAction.moduleIds.includes(m.moduleId)
);
// matchedModules[0].title → "在管面积趋势图"
// matchedModules[1].title → "业态分布趋势图"
// 据此渲染两个选项按钮供用户点击
```

### 示例 5：无法识别

**输入**: `"今天天气不错啊"`

**输出**:
```json
{
  "rawText": "今天天气不错啊",
  "confidence": 0,
  "actions": []
}
```

---

## 九、迁移兼容建议（避免破坏现网）

为保证平滑切换，建议按以下顺序灰度：

1. **Parser 输出双写（短期）**：
   - 新协议主字段：`setYear` / `setMonth` / `setStartYearPeriod` / `setEndYearPeriod`
   - 兼容字段（可选）：旧 `setYearPeriod`
2. **Dispatcher 先兼容再收敛**：
   - 优先消费新字段；
   - 若仅收到旧 `setYearPeriod`，在前端或网关层转换为：
     - `setStartYearPeriod.value = yyyy`
     - `setEndYearPeriod.value = 年度 | 半年度`
3. **稳定后下线旧字段**：
   - 观测期内无旧字段请求后，移除 `setYearPeriod` 解析与透传。

> 注：后端若需要 `startTime/endTime(yyyy-MM-dd HH:mm:ss)`，建议统一在服务端根据
> `setYear/setMonth/setDay` 或 `setStartYearPeriod/setEndYearPeriod` 做派生，不直接暴露到前端 action 协议。

---

## 十、新旧结构差异总览

| 维度 | v1 (旧) | v2 (新) |
|---|---|---|
| **顶层结构** | Intent → type + entities + command(actions) | Intent → rawText + confidence + actions |
| **意图分类** | 独立 `type` 枚举字段 | 由 `actions[0].type` 推导 |
| **全屏** | 隐式通过 `entities.fullscreenAction` | 显式 action `{ type: 'fullscreen' }` |
| **实体存储** | entities 字典 + actions 数组（双重） | 仅 actions（单一） |
| **模块澄清** | 后端下发完整 `options`（含 label/title/aliases） | 只传 `moduleIds`，前端查表渲染 |
| **rawText** | Intent / Command / Action 三处重复 | 仅 Intent 一处 |
| **confidence** | Intent / Command 两处 | 仅 Intent 一处 |
| **命令元数据** | Command 带 currentPageId/targetPageId/needNavigate | 去掉，Dispatcher 自行推导 |
| **时间筛选字段** | `setMonth=YYYY-MM` + `setYearPeriod=YYYY-period_type` | `setYear(yyyy)` + `setMonth(1~12)` + `setStartYearPeriod(yyyy)` + `setEndYearPeriod(年度\|半年度)`，并预留 `setDay(1~31)` |
| **空结果** | command 为 undefined | actions 为空数组 `[]` |
| **JSON 体积** | ~400~600 字符/条 | ~100~250 字符/条（约减 60%） |
