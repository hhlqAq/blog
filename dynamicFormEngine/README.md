结构
dynamic-form/
├── utils/                  # 工具函数目录（复用性强）
│   ├── form-utils.js       # 基础工具（正则、ID生成、快速配置）
│   └── form-upload-utils.js# 上传工具（格式校验、预览、接口上传）
├── adapter/                # 适配器目录（服务端配置处理）
│   └── form-server-adapter.js # 服务端配置适配+规则解析
├── components/             # 子组件目录（UI渲染拆分）
│   ├── form-fields/        # 字段渲染子组件（按类型拆分）
│   │   ├── FormText.vue    # 文本/密码/数字输入框
│   │   ├── FormSelect.vue  # 单选/复选/下拉选择框
│   │   ├── FormTextarea.vue# 文本域
│   │   ├── FormSwitch.vue  # 开关
│   │   ├── FormHidden.vue  # 隐藏域
│   │   └── FormUpload.vue  # 文件/图片上传
│   ├── FormItem.vue        # 表单项容器（标签+字段+错误提示）
│   └── FormButtons.vue     # 提交/取消按钮组
└── DynamicForm.vue         # 根组件（核心逻辑聚合：状态管理、联动、校验）

# 一、核心功能覆盖

| 功能模块 | 具体能力 | 配置方式 / 使用示例 |
|---------|---------|--------------------|
| 服务端配置驱动 | 支持接口拉取 / 直接传入配置 | formApi="/api/form/config" 或 :serverFields="[]" |
| C 端样式定制 | 表单级 / 字段级 / 按钮样式定制 + 示例图 | formStyle/customStyle/exampleImage |
| 全类型字段支持 | 文本 / 单选 / 复选 / 下拉 / 文本域 / 开关 / 隐藏域 / 上传 | 服务端配置 type 字段（如 type: "image"） |
| 表单联动 | 显示隐藏 / 值联动 / 选项联动 / 校验联动 / 接口联动 | 服务端配置 linkRules 数组 |
| 灵活校验 | 必填 / 正则 / 长度 / 自定义函数 / 上传文件校验 | required/pattern/validator 配置 |
| 上传功能 | 图片 / 文件上传、预览、重试、删除 | 配置 uploadApi/maxSize/accept |
| 交互优化 | 加载状态 / 错误提示 / 滚动定位 / 响应式适配 | 内置样式 + 组件自动处理 |
# 二、组件 Props 说明

| Props 名称 | 类型 | 默认值 | 说明 |
|-----------|------|--------|------|
| formApi | String | "" | 表单配置接口地址（二选一） |
| serverFields | Array | [] | 直接传入的表单配置（二选一） |
| initialValues | Object | {} | 表单初始值（优先于服务端默认值） |
| showButtons | Boolean | true | 是否显示提交 / 取消按钮 |
| submitText | String | "提交" | 提交按钮文本 |
| disabled | Boolean | false | 是否禁用整个表单 |
| requestConfig | Object | {method: "GET"} | 接口请求配置（headers/method 等） |
| formStyle | Object | {} | 表单级内联样式 |
| formClass | String | "" | 表单级自定义类名 |
| formExampleImage | String | "" | 表单顶部示例图地址 |
| formExampleImageStyle | Object | 见代码 | 表单顶部示例图样式 |
| buttonsStyle | Object | {} | 按钮组内联样式 |
| submitBtnStyle | Object | 渐变红色样式 | 提交按钮内联样式 |
| cancelBtnStyle | Object | 灰色样式 | 取消按钮内联样式 |

# 三、组件事件说明

| 事件名称 | 回调参数 | 说明 |
|---------|---------|------|
| submit | formModel（表单数据） | 表单校验通过后触发（外部处理提交逻辑） |
| submit-fail | {formModel, errors} | 表单校验失败时触发 |
| submit-error | error（错误对象） | 提交过程中发生错误时触发 |
| cancel | - | 点击取消按钮时触发 |
| field-change | {key, value, formModel} | 字段值变化时触发 |
| field-blur | {key, value} | 字段失焦时触发 |
| example-image-click | {fieldKey, exampleImage, fieldConfig} | 示例图片点击时触发 |
| link-loading | {targetKey, loading, text} | 联动加载状态变化时触发 |
| link-error | {rule, error} | 联动执行失败时触发 |

# 四、暴露方法（通过 ref 调用）

| 方法名称 | 参数 | 说明 |
|---------|------|------|
| getFormData | - | 获取表单当前状态（数据 + 校验结果） |
| setFormValues | values（要设置的字段值对象） | 外部设置表单字段值 |
| triggerLinkManually | triggerKey（触发字段 key） | 手动触发指定字段的联动规则 |
| resetForm | - | 重置表单到初始状态 |
| validateForm | - | 手动触发整体表单校验（返回是否通过） |

# 五、表单联动核心链路拆解
## 1. 触发源：字段状态变更（联动的起点）
联动的触发条件是 「触发字段（triggerKey）的状态发生变化」，常见触发场景：
- 主动变更：用户输入文本、选择下拉 / 单选 / 复选、切换开关、上传文件等操作
- 被动变更：外部通过 setFormValues 手动设置字段值、表单初始化时的默认值加载
- 特殊触发：页面初始化时（通过 triggerOnInit: true 配置，强制执行联动）
触发后会生成「触发上下文」，包含：
- 触发字段的 key（triggerKey）和最新值（value）
- 整个表单的当前数据（formModel）
- 触发类型（用户操作 / 外部设置 / 初始化）
## 2. 规则匹配：筛选符合条件的联动规则
根组件维护着「全局联动规则映射表」（由服务端配置解析生成），结构为
```js
// 全局联动规则映射表格式
globalLinkRules = {
  "triggerKey1": [规则1, 规则2], // 触发字段1对应的所有联动规则
  "triggerKey2": [规则3],       // 触发字段2对应的所有联动规则
}
```
当触发字段变更时，核心匹配逻辑
- 根组件根据 triggerKey 从映射表中取出该字段对应的 所有联动规则
- 对每个规则执行「条件校验」：通过规则中的 condition 表达式，判断当前触发上下文是否满足联动条件
  - 条件表达式支持动态取值：value 指代触发字段的最新值，formModel 指代整个表单数据
  - 示例：condition: "value === '440100' && formModel.userName.length > 2"
- 筛选结果：仅保留「条件校验通过」的规则，进入下一步执行；未通过的规则直接跳过
## 3.执行调度：处理规则执行的优先级与异步逻辑
筛选后的规则并非直接执行，而是经过「调度优化」，确保执行顺序和稳定性：
- 顺序执行：按服务端配置中 linkRules 数组的顺序执行（支持手动调整规则优先级）
- 防抖处理：对接口联动（type: "request"）支持 debounce 配置，避免频繁触发接口请求（如 300ms 防抖）
- 加载状态管理：对异步规则（如接口联动），给目标字段添加「联动加载中」状态（linkLoading），防止重复触发
- 冲突规避：同一目标字段的多个规则，按顺序执行，后执行的规则会覆盖前序规则的结果（需通过 condition 配置避免冲突）
## 4.规则执行：执行联动操作（同步 / 异步）
根据规则的 type（联动类型），执行对应的联动操作，支持 6 种核心类型，每种类型对应固定的执行逻辑
| 联动类型 | 执行逻辑 | 核心操作 |
|----------|----------|----------|
| show/hide | 显隐控制 | 修改目标字段的 hidden 属性（true/false） |
| setValue | 赋值控制 | 给目标字段设置固定值或动态计算值 |
| setOptions | 选项更新 | 替换目标字段的下拉 / 单选 / 复选选项列表 |
| setValidate | 校验规则更新 | 动态修改目标字段的必填性、正则、长度限制等 |
| request | 接口联动（异步） | 调用接口获取数据，用返回结果更新目标字段 |

执行过程中：
- 同步规则（如显隐、赋值、选项更新）：立即执行并返回结果
- 异步规则（如接口联动）：等待接口响应后，再执行后续更新逻辑；接口失败会触发 link-error 事件，支持重试
## 5.目标更新：应用联动结果到目标字段
联动执行后会生成「更新结果」，根组件将结果应用到「目标字段」（targetKey 对应的字段），更新维度包括：
- 字段配置更新：修改目标字段的属性（如 hidden、options、required、pattern 等）
  - 示例：显隐联动更新 hidden 属性，选项联动更新 options 属性
- 字段值更新：修改目标字段在表单模型（formModel）中的值
  - 示例：赋值联动直接设置 `formModel[targetKey] = 结果值`
- 校验状态更新：目标字段值或配置变更后，自动触发该字段的校验（validateField），更新错误信息（errors）

更新后会触发「反馈机制」：
- 组件更新：目标字段的 UI 组件（如 FormSelect、FormSwitch）感知配置 / 值变化，自动重新渲染
- 事件通知：向外部抛出 field-change（字段值变更）、link-loading（加载状态变化）等事件，支持外部监听
# 六、核心设计思想（确保联动逻辑的灵活性与稳定性）
## 1. 规则标准化（适配服务端动态配置）
服务端配置的联动规则，会通过「适配器」（formServerAdapter）解析为「标准化规则对象」，确保无论服务端配置格式如何，根组件都能统一处理。标准化后的规则包含固定字段：
```js
// 标准化联动规则对象格式
{
  triggerKey: "city",        // 触发字段key
  targetKey: "industry",     // 目标字段key
  type: "request",           // 联动类型
  condition: Function,       // 解析后的条件判断函数
  execute: Function,         // 解析后的执行函数
  debounce: 300,             // 防抖时间（可选）
  triggerOnInit: true,       // 初始化是否触发（可选）
  loadingText: "加载中...",  // 加载提示（可选）
  requestConfig: Object      // 接口配置（仅接口联动有）
}
```
## 2. 解耦设计（触发与执行分离）
- 触发层：仅负责感知字段变更，不关心具体联动逻辑
- 规则层：仅负责定义「触发条件 + 执行动作」，不关心触发源
- 执行层：仅负责执行具体动作，不关心规则来源
- 目标层：仅负责接收更新并渲染，不关心更新原因

这种解耦确保了：
- 支持「一个触发字段关联多个目标字段」（同一 triggerKey 对应多个规则）
- 支持「多个触发字段关联同一个目标字段」（不同 triggerKey 对应同一 targetKey）
- 新增联动类型时，只需扩展执行层逻辑，无需修改触发层和目标层
