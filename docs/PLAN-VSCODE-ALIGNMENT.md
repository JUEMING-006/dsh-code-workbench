# dsh-code-workbench 对齐 VS Code 设计:全局方案

> **进度**：§一.4 审批缺口已验证属实并热修完成（AI 面板审批卡，question 提示条）；P0 已完成，基准主题定为 **Dark Modern（vscode 1.96.0）**——经典 Dark+ 无完整权威色板可用，Dark Modern 是当前默认深色主题且色板完整，经典 Dark+ 降为后续备选主题。**P1 布局引擎已完成**（辅助侧栏/AI 右侧停靠、面板下左右换位与最大化、sash 拖拽与双击重置、布局持久化 v1 键、zen 模式、布局快捷键）。**P2 平台服务已完成**（VS Code 命令 id 注册表单表驱动菜单/键位/命令面板、Ctrl+Shift+P 命令面板与 Ctrl+P Quick Open 共用 Quick Input 部件、宿主 listAll 有界递归清单、菜单项快捷键标签）。下一步:P3 编辑器组 / P4 AI 助手升级（可并行）。

> 目标:让编码模式在**视觉、布局、交互**三个层面真正遵循 VS Code 的设计,而不是"看起来有点像";同时保住三条已有底线——独立插件形态(任何设备经 `dsh plugin add` 可用)、双模式切换、零修改 harness 本体。AI 助手作为编码模式下拥有全部 harness 能力的原生助手,停靠位置比 Qoder 更灵活。

## 一、现状诊断:为什么"体验感不一样"

### 1. 视觉层:近似值,不是复刻

| 部位 | 当前实现 (`styles.ts`) | VS Code Dark+ 实际 | 差距 |
|---|---|---|---|
| 状态栏 | 24px,`#37373d` 灰底 | 22px,`#007acc` 蓝底白字 | 尺寸、颜色均不对 |
| 活动栏 | `#252526` 底,40×40 圆角 4px 按钮 | `#333333` 底,48×48 全幅热区,24px codicon,激活项 **2px 左侧亮色指示条** | 底色、交互形态均不对 |
| 编辑器标签 | 32px,每 tab 右侧分隔线 | 35px,无边框线,激活 tab 顶部亮色边线、背景与编辑器融为一体 | 结构性差异 |
| 图标 | 自绘 SVG | codicons 图标集(`@vscode/codicons`,MIT) | 整套不一致 |
| 色彩体系 | 3 层近似色 + fallback | Dark+ 语义色 40+(`focusBorder #007fd4`、list hover `#2a2d2e`、menu、badge、按钮态……) | 无语义色体系,无焦点环/hover 规范 |
| 字体/间距 | system-ui,字号随手定 | 13px UI 字号基准,统一控件高度体系 | 无规范 |

### 2. 结构层:缺 VS Code 布局的核心概念

- **无 Secondary Side Bar(Auxiliary Bar)**——Copilot Chat 在现代 VS Code 的默认停靠位。
- **Panel 不可换位**(VS Code:终端面板可在下/右/左)。
- **无编辑器组**(split editor、tab 跨组拖拽、preview tab 斜体)。
- **无 view container / view 移动模型**——VS Code 里 Explorer/Chat/Terminal 都是可移动、可停靠的 view,这正是"比 Qoder 灵活"的机制基础。
- 几何状态 page-local,刷新即丢(VS Code 恢复布局)。

### 3. 交互层:几乎为零

- 无快捷键体系(`Ctrl+P` / `Ctrl+Shift+P` / `Ctrl+B` / `Ctrl+J` / `` Ctrl+` `` / `Ctrl+S` / `Ctrl+\` / `Ctrl+K Z`)。
- 无命令面板、无 Quick Open——VS Code 可发现性的脊柱。
- 无右键菜单(explorer / tab / 编辑器 / chat)。
- 菜单栏是 stub(`New Session` / `About` 均为空操作)。
- 无任何拖拽(调宽、拖 tab、拖 view)。

### 4. AI 助手层

- 聊天是纯文本行 + 大写角色标签;VS Code Chat 是头像、markdown、代码块高亮 + 复制、工具调用卡片。
- **审批缺口(需优先验证)**:workbench 未注入 interaction/approval 面;编码模式下 harness 的 AppFrame 被 shadow 不渲染,模型的待审批请求可能没有 UI 出口而悬挂。
- 停靠位置写死在主侧边栏的一种 activity 里,不可移动。

### 5. 架构层

`WorkbenchShell.tsx` 里硬编码 `ACTIVITIES` 与 `MENUS`,没有"贡献点"模型。VS Code 的本质是 commands / views / menus / keybindings 作为贡献点注册到平台服务——本插件自己就活在"一切皆插件"的体系上,客户端完全可以在插件内部模仿这一层。

## 二、目标架构:四层重建(插件内,不动 harness)

```
┌─ L4 parts/        视图部件: Explorer / Search / Chat / Settings / EditorTabs / Terminal …
├─ L3 platform/     平台服务: commands注册表 · keybindings · quickInput(命令面板/QuickOpen)
│                            · contextMenu · views(view container 注册与移动)
├─ L2 layout/       布局引擎: Workbench Grid 状态机 · sash 拖拽 · panel 换位 · zen · 持久化
├─ L1 theme/        设计令牌: dark_plus 精确语义色 · 尺寸表 · codicons · CSS variables
└─ L0 已有地基(保留) bundle双模式挂载 · root shadowing · shell.overlay · fs/terminal 网关
                       monaco 静态分发 · active-file 模型感知 · 版本防护保存 · 会话面调用
```

- **L1 设计令牌**:从 VS Code `dark_plus.json` 逐色移植为语义 token,经一份注入的 `<style data-plugin>` 输出 CSS variables;`styles.ts` 的全部内联样式迁移为消费 token 的类。钉住一个 VS Code 版本作为基准(升级 Monaco 时 diff 同步)。图标换 `@vscode/codicons`。
- **L2 布局引擎**:显式建模 VS Code 的五区 + Auxiliary Bar;布局状态(store)驱动渲染,`panelPosition: bottom|right|left`、区域尺寸、折叠态、maximize panel、zen mode;几何写入 localStorage(有意偏离当前 page-local 姿态)。
- **L3 平台服务**:命令注册表采用 VS Code 命令 id(`workbench.action.*`);默认快捷键表对齐 VS Code;Quick Open(`Ctrl+P` 模糊文件切换)与命令面板(`Ctrl+Shift+P`)共用一个 quick-input 部件;右键菜单服务;view container 模型 = 活动栏图标 + 可停靠视图。
- **L4 视图部件**:重写为纯消费 L1–L3 的组件;菜单栏从命令表驱动,不再是 stub。

## 三、AI 助手:核心诉求的实现方式

定位:**编码模式下拥有全部 harness 能力的原生助手**,形态对标 Copilot Chat,自由度超过 Qoder。

1. **view container 化**:Chat 从"主侧边栏的一个 activity"升级为独立 view container——活动栏有图标,默认停靠 **Auxiliary Bar(右侧栏,Copilot 同款)**,可一键/拖拽移动到:主侧边栏 / 底部面板 / **浮动窗**(超出 VS Code 的自有扩展:可拖拽 popover)。不刷新页面即时切换。这就是"比 Qoder 灵活"的机制本身。
2. **全能力映射**(全部走已验证的 session face,不碰 dsh 内部):
   - 已有:流式聊天、工具调用摘要、slash 命令、发送/取消、队列、会话切换/新建;
   - P4 补齐:**审批闭环**(approve/deny 呈现为对话内交互卡)、工具调用可展开卡片、**选区/活动文件作为上下文附件**(active-file 感知已有,扩为选区注入)、**"应用到文件"的 diff 确认流**(复用版本防护保存)。
3. **明确不做代码补全 / inline suggestions**(用户已定)。

## 四、VS Code 功能子集(自由选择的结果)

### 做(按 VS Code 交互规格实现)

| 领域 | 范围 |
|---|---|
| 布局 | 标题栏+菜单、活动栏(48px)、主侧边栏、**辅助侧栏**、编辑器组(split/拖拽/preview tab/脏标记)、面板(可换位 下/右/左)、状态栏(22px)、zen mode、sash 调宽/高、布局持久化 |
| 命令/快捷键 | 命令注册表 + 命令面板 + Quick Open + VS Code 默认键位(Ctrl+B/J/`/S/\\、Ctrl+K Z 和弦后置) |
| 菜单 | 菜单栏(命令表驱动)、全套右键菜单(explorer/tab/编辑器/chat) |
| 编辑器 | Monaco(已有)、标签条完整交互、面包屑、Ln/Col、minimap 开关 |
| Explorer | 完整文件树 + 新建/重命名/删除(见风险 §7.2) |
| Search | 工作区文本搜索视图 |
| 设置 | 设置 UI(读写 workbench 配置 + dsh settings 面) |
| 主题 | Dark+ 精确复刻(基准),Light+ 顺带(token 化后成本极低) |

### 不做(边界,继承 REQUIREMENTS §十并追加)

扩展市场、VS Code 扩展兼容、调试器、远程开发、多窗口、多根工作区、Notebook、SCM、profiles、Electron/Tauri、**代码补全**。

## 五、路线图(P0 → P5)

| 阶段 | 内容 | 验收标准 |
|---|---|---|
| **P0 视觉对齐** | L1 令牌层:dark_plus 全量语义色、尺寸表(状态栏 22、活动栏 48×48+#333、tab 35……)、codicons、CSS variables 替换全部内联样式;activity 指示条、focus ring、hover 态 | 与钉住版本的 VS Code Dark+ 并排截图,主要区域视觉一致(允许 ±1px) |
| **P1 布局引擎** | L2:Workbench Grid、辅助侧栏、panel 换位、sash 拖拽(调宽/调高/双击重置)、maximize panel、zen mode、几何 localStorage 持久化 | 所有布局操作可经快捷键(Ctrl+B/J/`)与 UI 双路触达;刷新后布局恢复 |
| **P2 平台服务** | L3:命令注册表(VS Code 命令 id)、默认键位表、Quick Open(`Ctrl+P`)、命令面板(`Ctrl+Shift+P`)、菜单栏真实化、右键菜单服务上线 | P0–P1 全部功能可从 命令面板/快捷键/菜单 三路触达;Quick Open 模糊匹配文件 |
| **P3 编辑器区** | 编辑器组:split(`Ctrl+\`)、tab 跨组拖拽、preview tab(斜体)、`Ctrl+W`/中键关闭、面包屑、Ln/Col、`Ctrl+S` 走版本防护、minimap 开关 | 与 VS Code tab 交互逐项对齐;跨组拖拽可用 |
| **P4 AI 助手升级**(差异化核心) | Chat view container 化(默认辅助侧栏,四处停靠含浮动窗,不重载即切);审批闭环 UI;工具调用展开卡片;markdown + 代码块高亮/复制;选区→上下文附件;diff 应用确认流 | 位置切换零重载;审批请求在 workbench 内可批可拒不悬挂;选区可附加进 prompt |
| **P5 完成度** | Explorer 新建/重命名/删除、Search 视图、Settings UI、Light+ 主题、右键菜单全覆盖、细节打磨 | REQUIREMENTS §三/§四/§五 待办项全部关闭 |

**依赖关系**:P0 → P1 → P2 串行(P2 命令表需要 P1 布局动作先存在);P3 与 P4 可并行;P5 收尾。
**审批缺口**:若 §一.4 的验证结论是"编码模式下审批悬挂",审批呈现的最小实现(对话内 approve/deny)必须提前插入 P0/P1 之间作为热修。

## 六、备选路线对比(为什么选"插件内重建")

| 路线 | 说明 | 结论 |
|---|---|---|
| **A. 插件内按 VS Code 设计体系重建**(本方案) | 保住插件形态/任何设备/零改本体;AI 助手全能力 + 灵活停靠;chrome 层交互可增量复刻 | ✅ 推荐 |
| B. 嵌真 VS Code(code-server / vscode.dev OSS 构建)+ dsh 做成 VS Code 扩展 | 体验 100% 原生,但架构翻转:dsh 从"宿主"降为"扩展",无法走 dsh web 挂载,AI 失去 harness 原生 UI 能力,体量巨大 | ❌ 与核心诉求冲突 |
| C. Theia 框架 | 兼容 VS Code 扩展 API,但定制深、包体重,同等改造量不占优 | ❌ |

## 七、风险与决策点

1. **忠实度 vs 体量**:P0–P2 是"体验感不一样"的主治疗程,工作量集中在视觉规范表与布局引擎;通过钉住单一 VS Code 版本收敛"忠实"的定义,避免追新。
2. **fs 原语缺口**(REQUIREMENTS §四 已记):rename/mkdir/remove 不在 harness fs 能力内。短期:插件 host half 经 subprocess 能力(mv/mkdir/rm)实现,仍走 policy gate,零改本体;长期:向主仓库提 fs 能力原语 PR 上游化。
3. **审批缺口验证**(§一.4):P0 开工前先用一个真实审批场景验证编码模式下的行为,决定是否热修插入。
4. **和弦快捷键**(`Ctrl+K Z` 等):分发引擎先支持单组合键,和弦放 P5 打磨。
5. **VS Code 设计随版本漂移**:令牌表钉版本 + 升级时 diff;令牌单一来源,测试禁止散落裸色值。
6. **Quick Open 需要全工作区文件清单**:现网关是懒加载目录树,需加递归列目录端点(或复用 tree 缓存)。

## 八、质量与测试策略(延续现有 96 单测基线)

- 令牌表单源测试(组件中禁止裸 hex);
- 布局状态机、键位分发、quick-open 模糊匹配、命令注册表的纯函数单测;
- 现有组件测试迁移到令牌类;
- P0 验收引入可选截图对比(钉住的 VS Code 参照图)。
