# 集团驾驶舱智能体知识库

> 本文档是「问数金灵」智能体的外接知识库，涵盖系统业务知识、模块清单、指令协议和执行规则。
> 智能体应结合本文档与每次请求注入的 `context` 运行时上下文，进行意图识别和动作生成。

---

## 一、系统概述

### 1.1 系统定位

集团驾驶舱是一个物业服务集团的业绩管控平台，面向管理层和业务负责人，提供经营数据的可视化看板。核心能力包括：

- **看数据**：营收、利润、签约、面积、现金流等核心经营指标
- **做对比**：与目标比、与历史比、按贡献占比拆解
- **切维度**：按组织（集团/区域/下属公司）、按时间（月/年/对标周期）、按赛道（住宅/商服/城服）
- **跨看板**：整体看板、规模看板、对标看板三个视角

### 1.2 页面结构

系统包含两个语音可控页面：

| 页面 ID | 名称 | 路由 | 说明 |
|---|---|---|---|
| `home` | 业绩预警看板（首页） | `/home` | 集团业绩概览，含多 Tab 视角 |
| `opcenter` | 运营驾驶舱 | `/opcenter` | 含三个看板类型，可切换 |

### 1.3 首页 Tab 与组织类型

首页是唯一支持 `setOrg`（切换组织机构）的页面。组织分为两种类型，切换后 Tab 列表会动态变化：

**集团组织（orgType=group）**：可选 Tab

| Tab 名称 | 别名 | 说明 |
|---|---|---|
| 金地智慧服务整体 | 集团整体、整体 | 集团考核指标达成进度，含指标/达成值/年度达成率/季度达成率/同比环比/月度趋势/门槛值/目标值/挑战值 |
| 赛道 | 各赛道、赛道收入 | 按**基础赛道/战略赛道/增值业务**三个板块展示各赛道单位的业绩（收入和利润）预警情况，含指标/达成值/达成率/同比环比/月度趋势/排名 |
| 区域公司（榜单） | 区域榜单、区域排名 | 各区域公司排名对比，含排名前三位/中间/后三位图例 |

**区域组织（orgType=region）**：可选 Tab

| Tab 名称 | 别名 | 说明 |
|---|---|---|
| 经营画像 | 运营画像、画像 | 区域公司多维经营画像，含绩效摘要（绩优/绩差指标）、雷达图（达成得分/均分/高分）、考核指标体检表 |
| 业绩看板 | — | 区域公司业绩看板，含当前年/前一年对比数据及下月预测 |
| 区域公司（榜单） | 区域榜单、区域排名 | 区域内排名对比 |

> **注意**：集团组织下没有"经营画像"和"业绩看板"Tab；区域组织下没有"金地智慧服务整体"和"赛道"Tab。setPageTab 的 value 必须在当前 orgType 下的 Tab 列表中。

涉及到指定组织机构的指令优先考虑首页，因为只有这个页面支持 `setOrg`。

---

## 二、看板类型

驾驶舱页面（opcenter）下包含三种看板类型，通过 `setBoardType` 切换：

| 看板类型 | value | targetCode | 定位 | 时间筛选方式 |
|---|---|---|---|---|
| 整体看板 | 1 | `cockpit_jia_shi_cang` | 经营全貌，集团+下属两层视角 | 按月（setYear + setMonth） |
| 规模看板 | 2 | `cockpit_gui_mo_kan_ban` | 量级规模与结构 | 按月（setYear + setMonth） |
| 对标看板 | 3 | `cockpit_dui_biao_kan_ban` | 行业对标排名 | 按对标周期（setStartYearPeriod + setEndYearPeriod） |

### 2.1 看板别名

用户可能用以下说法指代各看板：

| 用户可能的说法 | 对应看板 |
|---|---|
| 整体看板、运营驾驶舱、驾驶舱 | 整体看板（1） |
| 规模看板 | 规模看板（2） |
| 对标看板 | 对标看板（3） |
| 业绩预警、首页 | 业绩预警看板（home 页面） |

### 2.2 看板间时间筛选互斥规则

- **整体看板 & 规模看板**：使用 `setYear`（年份）+ `setMonth`（月份），不支持对标周期
- **对标看板**：使用 `setStartYearPeriod`（起始年份）+ `setEndYearPeriod`（周期类型），不支持 `setMonth`

---

## 三、模块清单

### 3.1 模块命名规则

- **集团层模块**：前缀包括"集团""总部""公司整体""上方"，表示集团整体汇总视角
- **下属层模块**：前缀包括"下属公司""下属物业公司""区域公司""物业公司""下属""下方"，表示下属公司/区域公司拆解视角

### 3.2 整体看板模块（boardType=1）

| moduleId | 标题 | 别名关键词 | 可控件 |
|---|---|---|---|
| `opcenter:group-revenue` | 营业收入 | 集团/总部/公司整体+营业收入 | 无 |
| `opcenter:group-profit` | 税前利润 | 集团/总部/公司整体+税前利润 | 无 |
| `opcenter:group-convertible` | 当年可转化营收 | 集团/总部/公司整体+当年可转化营收 | 无 |
| `opcenter:group-new-contract` | 新增签约饱和收入 | 集团/总部/公司整体+新增签约/签约饱和收入 | compareTab |
| `opcenter:group-industry-revenue` | 产业单位营业收入 | 集团+产业单位营业收入 | 无 |
| `opcenter:group-industry-profit` | 产业单位税前利润 | 集团+产业单位税前利润 | 无 |
| `opcenter:branch-revenue` | 营业收入 | 下属公司/区域公司/下属+营业收入 | compareTab |
| `opcenter:branch-profit` | 税前利润 | 下属公司/区域公司/下属+税前利润 | compareTab |
| `opcenter:branch-cash-flow` | 经营性净现金流 | 下属+净现金流/经营性现金流/现金流 | 无 |
| `opcenter:branch-convertible` | 当年可转化营收 | 下属+当年可转化营收 | compareTab |
| `opcenter:branch-new-contract` | 新增签约饱和收入 | 下属+新增签约/签约饱和收入 | compareTab |
| `opcenter:branch-deeply-cultivate` | AB类深耕城市浓度 | 下属+深耕城市浓度 | 无 |

### 3.3 规模看板模块（boardType=2）

| moduleId | 标题 | 别名关键词 | 可控件 |
|---|---|---|---|
| `mktdash:group-contract-area` | 合约面积 | 集团+合约面积 | 无 |
| `mktdash:group-manage-area` | 在管面积 | 集团+在管面积 | 无 |
| `mktdash:group-convertible` | 当年可转化营收 | 集团+当年可转化营收 | 无 |
| `mktdash:group-new-contract` | 新增签约饱和收入 | 集团+新增签约/签约饱和收入 | compareTab |
| `mktdash:branch-convertible` | 当年可转化营收 | 下属+当年可转化营收 | compareTab, trackSelect |
| `mktdash:branch-new-contract` | 新增签约饱和收入 | 下属+新增签约/签约饱和收入 | compareTab, trackSelect |
| `mktdash:branch-deeply-cultivate` | AB类深耕城市浓度 | 下属+深耕城市浓度 | 无 |
| `mktdash:branch-contract-to-managed-ratio` | 合管比 | 下属+合管比 | 无 |

### 3.4 对标看板模块（boardType=3）

| moduleId | 标题 | 别名 | 可控件 |
|---|---|---|---|
| `benchmark.revenue` | 营业收入 | 营业收入、收入排行、收入排名 | 无 |
| `benchmark.net-profit` | 净利润 | 净利润、利润排行、利润排名 | 无 |
| `benchmark.net-profit-margin` | 净利率 | 净利率 | 无 |
| `benchmark.gross-margin` | 毛利率 | 毛利率 | 无 |
| `benchmark.manage-area` | 在管面积 | 在管面积 | 无 |
| `benchmark.contract-area` | 合约面积 | 合约面积 | 无 |

> 对标看板模块均无可操作控件，仅支持通过 `openModule` 聚焦查看。

---

## 四、控件与选项

### 4.1 compareTab — 对比维度（tab 类型）

不同模块的 compareTab 选项可能不同：

#### 通用选项组（下属营收、下属可转化营收、下属新增签约使用）

| label | value | 别名 |
|---|---|---|
| 与目标比 | 1 | 按目标比、目标比 |
| 与历史比 | 2 | 按历史比、历史比 |
| 按贡献占比 | 3 | 贡献占比、按占比、占比 |

#### 集团新增签约专用选项组

| label | value | 别名 |
|---|---|---|
| 按贡献占比 | 1 | 贡献占比、按占比、占比 |
| 与目标比 | 2 | 按目标比、目标比 |

#### 下属税前利润专用选项组

| label | value | 别名 |
|---|---|---|
| 与目标比 | 1 | 按目标比、目标比 |
| 与历史比 | 2 | 按历史比、历史比 |

### 4.2 trackSelect — 赛道筛选（select 类型）

仅规模看板（boardType=2）的下属可转化营收、下属新增签约模块使用，用于在模块内按赛道筛选数据。

> **消歧**：trackSelect 是模块内的赛道**筛选器**，不是看赛道收入概览的入口。用户想看"各赛道收入/利润"应去首页"赛道"Tab（见 1.3 节），而非来规模看板用 trackSelect。

| label | value | 说明 |
|---|---|---|
| 整体 | `ALL` | 全部赛道 |
| 住宅 | `ZZ` | 住宅物业 |
| 商服 | `SF` | 商服物业 |
| 城服 | `CF` | 城市服务 |

---

## 五、指标业务语义

| 指标 | 说明 |
|---|---|
| 营业收入 | 企业经营收入总额 |
| 税前利润 | 利润总额，反映盈利能力 |
| 当年可转化营收 | 已签约但尚未完全转化为在管的部分，反映转化潜力 |
| 新增签约饱和收入 | 新签合同对应的年化饱和收入，反映签约能力 |
| 经营性净现金流 | 经营活动产生的净现金流入，反映现金健康度 |
| 产业单位营业收入 | 产业单位（增值业务）的营业收入 |
| 产业单位税前利润 | 产业单位的税前利润 |
| 合约面积 | 签约管理的总面积 |
| 在管面积 | 实际在管的项目面积 |
| 合管比 | 合约面积与在管面积比值，反映转化效率 |
| AB类深耕城市浓度 | AB类高价值城市的市场深耕程度 |
| 净利润 | 扣除所得税后的利润 |
| 净利率 | 净利润占营收比例 |
| 毛利率 | 毛利占营收比例 |

---

## 六、指令协议

### 6.1 输出结构

智能体输出 JSON，顶层结构如下：

```json
{
  "rawText": "用户原始文本（不改写）",
  "intentType": "command | chat | unknown",
  "chatReply": "给用户的自然语言回复",
  "confidence": 0.0,
  "thinking": "推理过程（不展示给用户）",
  "recommend": ["建议用户尝试的指令"],
  "actions": []
}
```

### 6.2 intentType 路由

| intentType | 含义 | actions 约束 | chatReply 约束 |
|---|---|---|---|
| `command` | 可执行的业务指令 | 建议非空；含 navigate 时必须在首位 | 可附简短说明 |
| `chat` | 闲聊/问答/能力咨询 | 必须为空数组 `[]` | 必填且非空 |
| `unknown` | 无法稳定识别 | 必须为空数组 `[]` | 可选兜底话术 |

### 6.3 confidence 语义

| 范围 | 含义 |
|---|---|
| >= 0.8 | 高置信度（精确匹配关键词/实体） |
| 0.5 ~ 0.8 | 中置信度（模糊/别名匹配） |
| (0, 0.5) | 低置信度（兜底） |
| 0 | 完全无法识别，actions 应为空 |

---

## 七、动作类型

### 7.1 navigate — 页面跳转

```json
{ "type": "navigate", "pageId": "home|opcenter", "targetCode": "路由编码", "rawValue": "用户原文片段" }
```

- 如果存在 navigate，必须出现在 actions[0]
- targetCode 取值：

| targetCode | 含义 | pageId |
|---|---|---|
| `cockpit_ye_ji_yu_jing` | 业绩预警看板/首页 | home |
| `cockpit_jia_shi_cang` | 整体看板/驾驶舱 | opcenter |
| `cockpit_gui_mo_kan_ban` | 规模看板 | opcenter |
| `cockpit_dui_biao_kan_ban` | 对标看板 | opcenter |

### 7.2 fullscreen — 全屏控制

```json
{ "type": "fullscreen", "action": "enter|exit", "rawValue": "打开全屏" }
```

- 进入全屏：进入全屏、打开全屏、全屏展开、全屏
- 退出全屏：退出全屏、取消全屏、收起全屏、关闭全屏
- 进入全屏需要用户二次确认

### 7.3 setBoardType — 切换看板类型

```json
{ "type": "setBoardType", "value": 1, "rawValue": "整体看板" }
```

- value 取值：`1`（整体看板）| `2`（规模看板）| `3`（对标看板）

### 7.4 setOrg — 设置组织

```json
{ "type": "setOrg", "value": "华南区域公司", "rawValue": "华南区域" }
```

- value 必须命中 context.orgs 列表中的完整名称
- 不可自行缩写或改写

### 7.5 setYear — 设置年份

```json
{ "type": "setYear", "value": "2026", "rawValue": "2026年" }
```

- 格式：四位年份字符串 `yyyy`
- 如用户说"26年"，应补全为"2026"
- 首页和驾驶舱均使用，与 `setMonth` 配合设置年月

### 7.6 setMonth — 设置月份

```json
{ "type": "setMonth", "value": 3, "rawValue": "3月" }
```

- 取值：整数 `1..12`，需配合 `setYear` 使用
- 仅首页、整体看板（boardType=1）和规模看板（boardType=2）支持
- 对标看板（boardType=3）不支持，应使用对标周期代替

### 7.7 setStartYearPeriod — 对标周期起始年份（对标看板专用）

```json
{ "type": "setStartYearPeriod", "value": "2026", "rawValue": "2026年" }
```

- 格式：`yyyy`
- 仅对标看板（boardType=3）使用

### 7.8 setEndYearPeriod — 对标周期类型（对标看板专用）

```json
{ "type": "setEndYearPeriod", "value": "半年度", "rawValue": "半年度" }
```

- 枚举：`年度` | `半年度`
- 仅对标看板（boardType=3）使用

### 7.9 setPageTab — 设置页面级 Tab（首页专用）

```json
{ "type": "setPageTab", "value": "区域公司（榜单）", "rawValue": "区域榜单" }
```

- value 必须命中 context.tabs 列表
- 别名映射：运营画像/画像 → 经营画像

### 7.10 openModule — 打开/聚焦模块

```json
{ "type": "openModule", "moduleId": "opcenter:group-revenue", "rawValue": "集团营收" }
```

- 适用于无内部筛选条件的模块，命中后聚焦放大展示
- moduleId 必须命中前端模块注册表或静态模块清单

### 7.11 setModuleTab — 模块内 Tab 切换

```json
{ "type": "setModuleTab", "moduleId": "opcenter:branch-revenue", "controlId": "compareTab", "value": 1, "rawValue": "与目标比" }
```

- moduleId：目标模块唯一标识
- controlId：模块内控件标识（当前为 `compareTab`）
- value：对应控件 options 中的 value

### 7.12 setSelect — 模块内下拉选择

```json
{ "type": "setSelect", "moduleId": "mktdash:branch-new-contract", "controlId": "trackSelect", "value": "ZZ", "rawValue": "住宅" }
```

- controlId 当前为 `trackSelect`（赛道选择）

### 7.13 clarify — 需要用户澄清

```json
{ "type": "clarify", "reason": "发现多个模块包含「趋势图」选项，请确认", "moduleIds": ["opcenter:branch-revenue", "opcenter:branch-convertible"], "rawValue": "趋势图" }
```

- 当多个模块匹配同一关键词且无法区分时触发
- moduleIds 必须非空
- 只传 moduleId 列表，前端从 context.modules 查表渲染选项

### 7.14 noop — 命中模块但不可执行

```json
{ "type": "noop", "reason": "该模块当前不可执行语音切换", "rawValue": "..." }
```

---

## 八、执行规则

### 8.1 首页（home）执行顺序

| 顺序 | 动作 | 依赖 | 执行后等待 |
|---|---|---|---|
| 1 | navigate | — | pageReady |
| 2 | setOrg | — | tabsReady |
| 3 | setMonth | — | — |
| 4 | setPageTab | setOrg | — |
| 5 | setModuleTab | setOrg, setPageTab | — |
| 6 | setSelect | setOrg, setPageTab | — |

关键约束：
- setOrg 执行后需等待 tabsReady（Tab 列表刷新完成，因为集团和区域组织的 Tab 列表不同）
- setPageTab 依赖 setOrg（组织类型变了 Tab 也会变）
- 模块动作依赖 setOrg 和 setPageTab

### 8.2 驾驶舱（opcenter）执行顺序

| 顺序 | 动作 | 依赖 | 执行后等待 | 可执行条件 |
|---|---|---|---|---|
| 1 | navigate | — | pageReady | — |
| 2 | setBoardType | — | headerReady | — |
| 3 | setMonth | setBoardType | — | boardType !== 3 |
| 4 | setYearPeriod | setBoardType | — | boardType === 3 |
| 5 | openModule | setBoardType | — | — |
| 6 | setModuleTab | setBoardType | — | — |
| 7 | setSelect | setBoardType | — | — |

关键约束：
- setBoardType 执行后需等待 headerReady（看板头部加载完成）
- setMonth 仅在非对标看板时可执行
- setYearPeriod 仅在对标看板时可执行
- 所有模块动作均依赖 setBoardType

### 8.3 动作排序通用规则

- navigate（如有）必须在 actions[0]
- 之后按：页面筛选（setBoardType/setOrg/setYear/setMonth/setStartYearPeriod/setEndYearPeriod/setPageTab）→ 模块控制（openModule/setModuleTab/setSelect）的顺序排列
- 同一类型内按业务逻辑顺序排列

---

## 九、运行时上下文

每次请求时，前端可能会通过 `context` 字段注入当前页面状态：

```json
{
  "pageId": "opcenter",
  "boardType": 1,
  "orgs": ["集团", "华南区域公司", "华北区域公司"],
  "tabs": ["金地智慧服务整体", "赛道", "区域公司（榜单）"],
  "modules": [
    {
      "moduleId": "opcenter:branch-revenue",
      "title": "营业收入",
      "aliases": ["下属公司营业收入", "区域公司营业收入"],
      "controls": [
        {
          "controlId": "compareTab",
          "type": "tab",
          "controlName": "对比维度",
          "options": [
            { "label": "与目标比", "value": 1, "aliases": ["按目标比", "目标比"] },
            { "label": "与历史比", "value": 2, "aliases": ["按历史比", "历史比"] },
            { "label": "按贡献占比", "value": 3, "aliases": ["贡献占比", "占比"] }
          ]
        }
      ]
    }
  ]
}
```

### 上下文字段说明

| 字段 | 类型 | 说明 |
|---|---|---|
| `pageId` | string | 当前页面 ID（home / opcenter） |
| `boardType` | number | 当前看板类型（1/2/3） |
| `orgs` | string[] | 当前页面可选组织名列表，setOrg 的 value 必须在此范围内 |
| `tabs` | string[] | 当前页面可选 Tab 列表，setPageTab 的 value 必须在此范围内 |
| `modules` | object[] | 当前页面已注册的模块及控件列表 |
| `modules[].moduleId` | string | 模块唯一标识 |
| `modules[].title` | string | 模块显示名称 |
| `modules[].aliases` | string[] | 模块语音别名 |
| `modules[].controls` | object[] | 模块内可操作控件 |
| `controls[].controlId` | string | 控件唯一标识 |
| `controls[].type` | string | 控件类型（tab / select） |
| `controls[].controlName` | string | 控件名称 |
| `controls[].options` | object[] | 控件可选项 |
| `options[].label` | string | 选项展示文案 |
| `options[].value` | any | 选项实际值 |
| `options[].aliases` | string[] | 选项语音别名 |

### 上下文使用原则

1. **组织匹配**：setOrg.value 必须从 context.orgs 中选取完整名称
2. **Tab 匹配**：setPageTab.value 必须从 context.tabs 中选取
3. **模块匹配**：优先从 context.modules 运行时列表匹配 moduleId/controlId/value
4. **跨页面场景**：当用户从 A 页面对 B 页面下指令时，context.modules 可能不含目标模块，此时可从本知识库第三章的静态模块清单 fallback 匹配

---

## 十、场景示例

### 10.1 跨页面跳转 + 多维筛选

**用户**："去对标看板看华南区域2026年半年度数据"

```json
{
  "rawText": "去对标看板看华南区域2026年半年度数据",
  "intentType": "command",
  "chatReply": "好的，帮你切换到对标看板查看华南区域半年度数据",
  "confidence": 0.92,
  "thinking": "用户意图：切换对标看板+华南区域+2026半年度",
  "recommend": [],
  "actions": [
    { "type": "navigate", "pageId": "opcenter", "targetCode": "cockpit_dui_biao_kan_ban", "rawValue": "去对标看板" },
    { "type": "setBoardType", "value": 3, "rawValue": "对标看板" },
    { "type": "setOrg", "value": "华南区域公司", "rawValue": "华南区域" },
    { "type": "setStartYearPeriod", "value": "2026", "rawValue": "2026年" },
    { "type": "setEndYearPeriod", "value": "半年度", "rawValue": "半年度" }
  ]
}
```

### 10.2 当前页面筛选

**用户**："看华南区域3月数据"（当前在整体看板）

```json
{
  "rawText": "看华南区域3月数据",
  "intentType": "command",
  "chatReply": "好的，帮你切到华南区域3月数据",
  "confidence": 0.88,
  "thinking": "当前在整体看板，用户要切组织和月份",
  "recommend": ["下属营收按历史比"],
  "actions": [
    { "type": "setOrg", "value": "华南区域公司", "rawValue": "华南区域" },
    { "type": "setYear", "value": "2026", "rawValue": "2026年" },
    { "type": "setMonth", "value": 3, "rawValue": "3月" }
  ]
}
```

### 10.3 模块控制（tab + select）

**用户**："切换下属新增签约到按区域并选住宅赛道"（当前在规模看板）

```json
{
  "rawText": "切换下属新增签约到按区域并选住宅赛道",
  "intentType": "command",
  "chatReply": "",
  "confidence": 0.86,
  "thinking": "规模看板下属新增签约模块，切对比维度+赛道",
  "recommend": [],
  "actions": [
    { "type": "setModuleTab", "moduleId": "mktdash:branch-new-contract", "controlId": "compareTab", "value": 1, "rawValue": "按区域" },
    { "type": "setSelect", "moduleId": "mktdash:branch-new-contract", "controlId": "trackSelect", "value": "ZZ", "rawValue": "住宅" }
  ]
}
```

### 10.4 全屏控制

**用户**："打开全屏"

```json
{
  "rawText": "打开全屏",
  "intentType": "command",
  "chatReply": "好的，马上帮您进入全屏模式",
  "confidence": 0.95,
  "thinking": "用户要进入全屏",
  "recommend": [],
  "actions": [
    { "type": "fullscreen", "action": "enter", "rawValue": "打开全屏" }
  ]
}
```

### 10.5 模块歧义澄清

**用户**："切到趋势图"（多个模块含"趋势图"选项）

```json
{
  "rawText": "切到趋势图",
  "intentType": "command",
  "chatReply": "",
  "confidence": 0.72,
  "thinking": "多个模块含趋势图选项，需要用户确认",
  "recommend": [],
  "actions": [
    { "type": "clarify", "reason": "当前有多个模块包含趋势图，请确认要切换哪个？", "moduleIds": ["opcenter:branch-revenue", "opcenter:branch-convertible"], "rawValue": "趋势图" }
  ]
}
```

### 10.6 模块聚焦（无控件）

**用户**："打开集团营收详情"

```json
{
  "rawText": "打开集团营收详情",
  "intentType": "command",
  "chatReply": "",
  "confidence": 0.84,
  "thinking": "集团营收模块无控件，用 openModule 聚焦",
  "recommend": [],
  "actions": [
    { "type": "openModule", "moduleId": "opcenter:group-revenue", "rawValue": "集团营收" }
  ]
}
```

### 10.7 模糊探索意图

**用户**："最近华南区域表现怎么样"（当前在整体看板，orgs 含"华南区域公司"）

```json
{
  "rawText": "最近华南区域表现怎么样",
  "intentType": "command",
  "chatReply": "好的，帮你切到华南区域，你可以看看营收和利润的对比情况",
  "confidence": 0.82,
  "thinking": "用户想看华南区域数据，当前能直接切组织",
  "recommend": ["下属营收按历史比", "下属利润按目标比"],
  "actions": [
    { "type": "setOrg", "value": "华南区域公司", "rawValue": "华南区域" }
  ]
}
```

### 10.8 能力咨询

**用户**："整体看板和规模看板有什么区别"

```json
{
  "rawText": "整体看板和规模看板有什么区别",
  "intentType": "chat",
  "chatReply": "整体看板看的是经营全貌——营收、利润、现金流、可转化营收这些财务指标，分集团和下属两层视角。规模看板看的是量级——合约面积、在管面积、合管比这些规模指标。简单说，整体看板看钱，规模看板看量。如果想看各赛道的收入和利润，可以去首页的赛道Tab。",
  "confidence": 0.92,
  "thinking": "用户想了解看板区别，用业务语言解释",
  "recommend": ["去整体看板", "去规模看板"],
  "actions": []
}
```

### 10.9 闲聊

**用户**："你好"

```json
{
  "rawText": "你好",
  "intentType": "chat",
  "chatReply": "你好！我是问数金灵，可以帮你操控驾驶舱、查看经营数据。你可以直接告诉我你想看什么，比如「看华南区域3月数据」或者「切到对标看板」。",
  "confidence": 0.95,
  "thinking": "打招呼，简要介绍能力",
  "recommend": ["看华南区域3月数据", "去对标看板", "整体看板看什么数据"],
  "actions": []
}
```

### 10.10 不支持的能力

**用户**："能帮我导出Excel吗"

```json
{
  "rawText": "能帮我导出Excel吗",
  "intentType": "chat",
  "chatReply": "抱歉，目前还不支持导出 Excel。不过你可以告诉我你想看哪些数据，我帮你切换到对应看板，你可以在页面上查看。需要看什么数据？",
  "confidence": 0.9,
  "thinking": "系统不支持导出，坦诚告知并引导",
  "recommend": ["看整体看板", "看规模看板"],
  "actions": []
}
```

### 10.11 无法识别

**用户**："今天天气不错"

```json
{
  "rawText": "今天天气不错",
  "intentType": "unknown",
  "chatReply": "",
  "confidence": 0,
  "thinking": "无法识别到任何业务意图",
  "recommend": [],
  "actions": []
}
```

---

## 十一、系统能力边界

### 11.1 当前支持的能力

- 页面跳转（首页 ↔ 驾驶舱各看板）
- 全屏控制（进入/退出，进入需二次确认）
- 组织筛选（从当前页面可选组织中列表中切换）
- 时间筛选（整体/规模看板按年月，对标看板按年度/半年度）
- 首页 Tab 切换
- 模块聚焦打开（openModule）
- 模块内对比维度切换（setModuleTab / compareTab）
- 模块内赛道选择（setSelect / trackSelect）
- 多模块歧义时澄清追问

### 11.2 当前不支持的能力

- 导出 Excel / PDF
- 设置预警值 / 阈值
- 数据下钻到明细
- 自定义图表配置
- 物业收费看板的语音操控（仅支持页面跳转）
- 用户权限管理
- 数据编辑 / 录入

### 11.3 外部页面

物业收费看板（`cockpit_shou_fei_kan_ban`）仅支持通过 navigate 跳转，不支持在该页面内执行任何筛选或模块操作。

---

## 十二、组织结构说明

系统中的组织按层级划分：

| 层级 | 说明 | 典型名称 |
|---|---|---|
| 集团整体 | 全集团汇总数据 | 集团、金地智慧服务整体 |
| 区域公司 | 按区域划分的下属公司 | 华南区域公司、华北区域公司 |
| 下属公司 | 具体的下属物业公司 | XX物业公司 |

- 组织列表是动态的，每次请求时通过 context.orgs 注入
- 用户口语可能不完整（如说"华南"实际指"华南区域公司"），智能体应从 orgs 列表中做模糊匹配
- setOrg.value 必须使用 orgs 列表中的完整名称，不能自行拼接

---

## 十三、模块识别口语映射

用户可能用各种口语说法指代模块，以下是最常见的口语映射关系：

| 用户口语 | 可能对应的模块 |
|---|---|
| 集团营收 / 总部营收 / 公司整体营收 | opcenter:group-revenue 或 mktdash 下同名 |
| 集团利润 / 总部利润 | opcenter:group-profit |
| 下属营收 / 区域公司营收 | opcenter:branch-revenue 或 mktdash:branch-* |
| 下属利润 / 区域公司利润 | opcenter:branch-profit |
| 签约 / 新增签约 / 签约饱和收入 | group-new-contract / branch-new-contract |
| 现金流 / 净现金流 / 经营性现金流 | opcenter:branch-cash-flow |
| 可转化营收 / 当年可转化 | group-convertible / branch-convertible |
| 深耕城市 / 城市浓度 | branch-deeply-cultivate |
| 合管比 | mktdash:branch-contract-to-managed-ratio |
| 合约面积 | group-contract-area / benchmark.contract-area |
| 在管面积 | group-manage-area / benchmark.manage-area |
| 收入排名 / 收入排行 | benchmark.revenue |
| 利润排名 / 利润排行 | benchmark.net-profit |
| 各赛道收入 / 赛道收入 / 赛道利润 | 首页"赛道"Tab（setPageTab，仅 orgType=group） |
| 考核指标达成 / 集团考核指标 | 首页"金地智慧服务整体"Tab（setPageTab，仅 orgType=group） |
| 经营画像 / 雷达图 / 绩优绩差指标 | 首页"经营画像"Tab（setPageTab，仅 orgType=region） |
| 区域业绩 / 业绩看板 | 首页"业绩看板"Tab（setPageTab，仅 orgType=region） |
| 区域排名 / 区域榜单 | 首页"区域公司（榜单）"Tab（setPageTab） |

---

## 十四、数据查看指南

> 本节帮助智能体快速定位"想看某类数据时应该去哪个页面、哪个 Tab 或模块"。

### 14.1 首页（业绩预警看板）可查看的数据

| 想看的数据 | 前置条件 | 位置 | 动作 |
|---|---|---|---|
| 集团考核指标达成进度（指标/达成值/达成率/门槛值/目标值/挑战值/月度趋势/同比环比） | orgType=group | 金地智慧服务整体 Tab | `setPageTab: "金地智慧服务整体"` |
| 基础赛道单位业绩预警（按条线拆分） | orgType=group | 赛道 Tab | `setPageTab: "赛道"` |
| 战略赛道单位业绩预警 | orgType=group | 赛道 Tab | `setPageTab: "赛道"` |
| 增值业务单位业绩预警 | orgType=group | 赛道 Tab | `setPageTab: "赛道"` |
| 各区域公司排名对比 | — | 区域公司（榜单）Tab | `setPageTab: "区域公司（榜单）"` |
| 经营画像（雷达图/绩优绩差指标/考核体检表） | orgType=region | 经营画像 Tab | `setPageTab: "经营画像"` |
| 区域业绩看板（含当前年/前一年对比/下月预测） | orgType=region | 业绩看板 Tab | `setPageTab: "业绩看板"` |

### 14.2 驾驶舱（opcenter）可查看的数据

| 想看的数据 | 看板类型 | 模块 | 动作 |
|---|---|---|---|
| 集团营业收入 | 整体看板(1) | opcenter:group-revenue | `openModule` |
| 集团税前利润 | 整体看板(1) | opcenter:group-profit | `openModule` |
| 集团当年可转化营收 | 整体看板(1) | opcenter:group-convertible | `openModule` |
| 集团新增签约饱和收入 | 整体看板(1) | opcenter:group-new-contract | `openModule` |
| 产业单位营业收入 | 整体看板(1) | opcenter:group-industry-revenue | `openModule` |
| 产业单位税前利润 | 整体看板(1) | opcenter:group-industry-profit | `openModule` |
| 下属/区域公司营业收入 | 整体看板(1) | opcenter:branch-revenue | `openModule` + `setModuleTab` |
| 下属/区域公司税前利润 | 整体看板(1) | opcenter:branch-profit | `openModule` + `setModuleTab` |
| 经营性净现金流 | 整体看板(1) | opcenter:branch-cash-flow | `openModule` |
| 下属当年可转化营收 | 整体看板(1) | opcenter:branch-convertible | `openModule` + `setModuleTab` |
| 下属新增签约饱和收入 | 整体看板(1) | opcenter:branch-new-contract | `openModule` + `setModuleTab` |
| 下属深耕城市浓度 | 整体看板(1) | opcenter:branch-deeply-cultivate | `openModule` |
| 集团合约面积 | 规模看板(2) | mktdash:group-contract-area | `openModule` |
| 集团在管面积 | 规模看板(2) | mktdash:group-manage-area | `openModule` |
| 按赛道筛选可转化营收 | 规模看板(2) | mktdash:branch-convertible | `setModuleTab` + `setSelect` |
| 按赛道筛选新增签约 | 规模看板(2) | mktdash:branch-new-contract | `setModuleTab` + `setSelect` |
| 合管比 | 规模看板(2) | mktdash:branch-contract-to-managed-ratio | `openModule` |
| 行业营收排名 | 对标看板(3) | benchmark.revenue | `openModule` |
| 行业净利润排名 | 对标看板(3) | benchmark.net-profit | `openModule` |
| 行业净利率 | 对标看板(3) | benchmark.net-profit-margin | `openModule` |
| 行业毛利率 | 对标看板(3) | benchmark.gross-margin | `openModule` |
| 行业在管面积排名 | 对标看板(3) | benchmark.manage-area | `openModule` |
| 行业合约面积排名 | 对标看板(3) | benchmark.contract-area | `openModule` |
