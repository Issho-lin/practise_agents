# 页面与模块 ID 完整定义

---

## 一、页面概览

| pageId | 路由路径 | 页面名称 | 说明 |
|--------|----------|----------|------|
| `home` | `/home` | 业绩预警看板 | 首页 |
| `opcenter` | `/opcenter` | 运营驾驶舱 | 包含三个 Tab 看板 |

### 权限码映射

| 权限码 | 名称 | 路由 |
|--------|------|------|
| `cockpit_ye_ji_yu_jing` | 业绩预警看板 | /home |
| `cockpit_jia_shi_cang` | 运营驾驶舱 | /opcenter?tab=1 |
| `cockpit_gui_mo_kan_ban` | 规模看板 | /opcenter?tab=2 |
| `cockpit_dui_biao_kan_ban` | 对标看板 | /opcenter?tab=3 |

---

## 二、驾驶舱看板 (opcenter)

### BoardType 与日期选择参数（三个看板）

> 说明：以下为 **页面 Header 日期控件** 参数，不是模块内参数。

| boardType | 看板名称 | 日期控件 | 语音动作参数 | 值格式 | 示例 | 备注 |
|-----------|----------|----------|--------------|--------|------|------|
| **1** | **整体看板** | 月份选择器 | `setYear`+`setMonth` | `YYYY`+`MM` | `2026`+`03` | 仅月份维度 |
| **2** | **规模看板** | 月份选择器 | `setYear`+`setMonth` | `YYYY`+`MM` | `2026`+`03` | 仅月份维度 |
| **3** | **对标看板** | 年度/半年度选择器 | `setSartYearPeriod`+`setEndYearPeriod` | `YYYY`+`年度｜半年度` | `2026`+`年度`|

---

## 三、驾驶舱看板内部模块 ID 完整列表

### 1️⃣ 整体看板 (boardType = 1)

> 路径: `/opcenter?tab=1`

| moduleId | title | 维度 | 参数枚举 |
|----------|-------|------|----------|
| `opcenter:group-revenue` | 营业收入 | 公司整体 | 无 |
| `opcenter:group-profit` | 税前利润 | 公司整体 | 无 |
| `opcenter:group-convertible` | 当年可转化营收 | 公司整体 | 无 |
| `opcenter:group-new-contract` | 新增签约饱和收入 | 公司整体 | `setModuleTab` (tab) — 对比维度: 按贡献占比 / 与目标比 |
| `opcenter:group-industry-revenue` | 产业单位营业收入 | 公司整体 | 无 |
| `opcenter:group-industry-profit` | 产业单位税前利润 | 公司整体 | 无 |
| `opcenter:branch-revenue` | 营业收入 | 下属公司 | `setModuleTab` (tab) — 对比维度: 与目标比 / 与历史比 / 按贡献占比 |
| `opcenter:branch-profit` | 税前利润 | 下属公司 | `setModuleTab` (tab) — 对比维度: 与目标比 / 与历史比 |
| `opcenter:branch-cash-flow` | 经营性净现金流 | 下属公司 | `setModuleTab` (tab) — 对比维度: 与目标比 / 与历史比 / 按贡献占比 |
| `opcenter:branch-convertible` | 当年可转化营收 | 下属公司 | `setModuleTab` (tab) — 对比维度: 与目标比 / 与历史比 / 按贡献占比 |
| `opcenter:branch-new-contract` | 新增签约饱和收入 | 下属公司 | `setModuleTab` (tab) — 对比维度: 与目标比 / 与历史比 / 按贡献占比 |
| `opcenter:branch-deeply-cultivate` | AB类深耕城市浓度 | 下属公司 | `setModuleTab` (tab) — 对比维度: 与目标比 / 与历史比 / 按贡献占比 |

---

### 2️⃣ 规模看板 (boardType = 2)

> 路径: `/opcenter?tab=2`
>
> **注意**: moduleId 前缀为 `mktdash:` 但 pageId 仍为 `opcenter`

| moduleId | title | 维度 | 参数枚举 |
|----------|-------|------|----------|
| `mktdash:group-contract-area` | 签约面积 | 公司整体 | 无 |
| `mktdash:group-manage-area` | 管理面积 | 公司整体 | 无 |
| `mktdash:group-convertible` | 当年可转化营收 | 公司整体 | `setModuleTab` (tab) — 对比维度: 按贡献占比 |
| `mktdash:group-new-contract` | 新增签约饱和收入 | 公司整体 | `setModuleTab` (tab) — 对比维度: 按贡献占比 / 与目标比 |
| `mktdash:branch-convertible` | 当年可转化营收 | 下属公司 | `setModuleTab` (tab) — 对比维度: 与目标比 / 与历史比 / 按贡献占比；`trackSelect` (select) — 赛道: 整体 / 住宅 / 商服 |
| `mktdash:branch-new-contract` | 新增签约饱和收入 | 下属公司 | `setModuleTab` (tab) — 对比维度: 与目标比 / 与历史比 / 按贡献占比；`trackSelect` (select) — 赛道: 整体 / 住宅 / 商服 |
| `mktdash:branch-deeply-cultivate` | 深耕项目 | 下属公司 | `setModuleTab` (tab) — 对比维度: 与目标比 / 与历史比 / 按贡献占比 |
| `mktdash:branch-contract-to-managed-ratio` | 签约管理比 | 下属公司 | `setModuleTab` (tab) — 对比维度: 与目标比 / 与历史比 / 按贡献占比 |

---

### 3️⃣ 对标看板 (boardType = 3)

> 路径: `/opcenter?tab=3`

| moduleId | title | 维度 | 参数枚举 |
|----------|-------|------|----------|
| `benchmark:revenue` | 营业收入 | - | 无 |
| `benchmark:net-profit` | 净利润 | - | 无 |
| `benchmark:net-profit-margin` | 净利润率 | - | 无 |
| `benchmark:gross-margin` | 毛利率 | - | 无 |
| `benchmark:manage-area` | 管理面积 | - | 无 |
| `benchmark:contract-area` | 签约面积 | - | 无 |

---

## 四、业绩预警看板参数说明（待商榷）

> 路径: `/home`
>
> 说明：业绩预警看板当前以**页面级筛选**为主，语音可执行动作为 `setOrg` / `setYear`+`setMonth` / `setPageTab`。

### 1️⃣ 页面级筛选参数

| 语音动作 | 值格式 | 数据来源/约束 | 示例 | 备注 |
|----------|--------|---------------|------|------|
| `setOrg` | 组织名称字符串 | 必须命中当前用户可访问组织列表（`getUserAccessible` 返回） | `华南区域公司` | 执行后会同步更新 `orgId`、`orgType` 并重置可用 Tab |
| `setYear`+`setMonth` | `YYYY-MM` | 必须是可用月份（受 `monthList` 限制） | `2026-03` | 页面月份控件 `value-format` 为 `YYYY-MM` |
| `setPageTab` | Tab 名称字符串 | 必须命中当前组织类型下可用 Tab | `赛道` | 语音按 Tab 名称匹配，不直接用 id |

### 2️⃣ Tab 值域（`setPageTab`）

#### `orgType = group` 时

| activeTab(id) | Tab 名称 |
|---------------|----------|
| `00` | 金地智慧服务整体 |
| `01` | 赛道 |
| `02` | 区域公司（榜单） |

#### `orgType = region` 时

| activeTab(id) | Tab 名称 |
|---------------|----------|
| `03` | 经营画像 |
| `04` | 业绩看板 |
| `02` | 区域公司（榜单） |

### 3️⃣ 模块级参数说明
暂无
