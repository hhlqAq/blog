import { FORM_REGEX, generateFieldId } from '../utils/form-utils'

/**
 * 服务端配置校验与适配核心工具
 * 作用：补全默认值、校验配置合法性、兼容旧格式、转换服务端规则为前端可用格式
 */
export class FormServerAdapter {
  constructor() {
    this.globalLinkRules = {} // 全局联动规则缓存
  }

  /**
   * 适配服务端配置（入口方法）
   * @param {Array} serverFields - 服务端返回的字段配置数组
   * @returns {Array} 适配后的前端字段配置
   */
  adapt(serverFields = []) {
    if (!Array.isArray(serverFields)) {
      console.error('服务端表单配置格式错误：必须是数组', serverFields)
      return []
    }

    const adaptedFields = serverFields.map((field, index) => this.adaptSingleField(field, index))
    const validFields = adaptedFields.filter(field => field !== null)

    // 收集所有联动规则（全局存储，便于根据 triggerKey 快速查找）
    this.globalLinkRules = validFields.reduce((rules, field) => {
      field.linkRules.forEach(rule => {
        if (!rules[rule.triggerKey]) {
          rules[rule.triggerKey] = []
        }
        rules[rule.triggerKey].push({ ...rule, targetField: field })
      })
      return rules
    }, {})

    return validFields
  }

  /**
   * 适配单个字段配置
   * @param {Object} field - 服务端单个字段配置
   * @param {number} index - 字段索引（用于降级处理）
   * @returns {Object} 适配后的字段配置
   */
  adaptSingleField(field, index) {
    // 基础校验：必须包含 key 和 type（否则跳过该字段）
    if (!field.key || !field.type) {
      console.error(`服务端字段配置缺失关键参数（key/type），索引：${index}`, field)
      return null
    }

    // 补全默认值（基础属性+样式+示例图+联动规则）
    const adaptedField = {
      // 基础属性默认值
      id: field.id || generateFieldId(field.key),
      label: field.label || field.key, // 标签默认用 key 替代
      required: field.required ?? false, // 默认为非必填
      disabled: field.disabled ?? false,
      hidden: field.hidden ?? false,
      placeholder: field.placeholder || `请输入${field.label || field.key}`,
      defaultValue: this.getDefaultValueByType(field.type, field.defaultValue),
      // 校验规则默认值
      pattern: this.parsePattern(field.pattern), // 解析服务端正则
      patternMessage: field.patternMessage || `${field.label || field.key}格式不正确`,
      minLength: field.minLength ?? undefined,
      maxLength: field.maxLength ?? undefined,
      validator: this.parseValidator(field.validator), // 解析服务端自定义校验
      validatorMessage: field.validatorMessage || `${field.label || field.key}校验失败`,
      // 联动规则
      showRule: field.showRule || null, // 显示规则（服务端返回的条件表达式）
      linkRules: field.linkRules ? field.linkRules.map(rule => this.parseLinkRule(rule)).filter(Boolean) : [],
      // 选项类字段默认值（select/radio/checkbox）
      options: field.options || [],
      // 文本域专属
      rows: field.rows || 3,
      // 开关专属
      switchText: field.switchText || '',
      // 上传字段专属（file/image）
      accept: field.accept || [],
      maxSize: field.maxSize || 5,
      maxCount: field.maxCount || 1,
      uploadApi: field.uploadApi || '',
      uploadConfig: field.uploadConfig || {},
      showPreview: field.showPreview ?? (field.type === 'image'),
      buttonText: field.buttonText || '选择文件',
      uploadExampleImage: field.uploadExampleImage || null,
      uploadExampleTip: field.uploadExampleTip || '示例效果',
      // 样式相关配置（C端定制核心）
      customStyle: field.customStyle || {}, // 字段级内联样式
      customClass: field.customClass || '', // 字段级自定义CSS类名
      labelStyle: field.labelStyle || {}, // 标签内联样式
      labelClass: field.labelClass || '', // 标签自定义类名
      controlStyle: field.controlStyle || {}, // 输入控件内联样式
      controlClass: field.controlClass || '', // 输入控件自定义类名
      // 示例图片相关配置
      exampleImage: field.exampleImage || null, // 字段说明示例图
      exampleImageStyle: field.exampleImageStyle || { // 示例图默认样式
        width: '120px',
        marginLeft: '10px',
        verticalAlign: 'middle'
      },
      exampleImageClass: field.exampleImageClass || '',
      // 保留服务端原始配置（便于后续扩展）
      serverRaw: { ...field },
      // 覆盖服务端传入的核心属性
      key: field.key,
      type: field.type.toLowerCase(), // 统一转为小写（兼容服务端大小写不一致）
    }

    // 特殊字段处理
    this.handleSpecialField(adaptedField)

    return adaptedField
  }

  /**
   * 根据字段类型获取默认值
   * @param {string} type - 字段类型
   * @param {any} serverDefault - 服务端返回的默认值
   * @returns {any} 处理后的默认值
   */
  getDefaultValueByType(type, serverDefault) {
    if (serverDefault !== undefined && serverDefault !== null) {
      return serverDefault
    }

    switch (type.toLowerCase()) {
      case 'checkbox':
        return []
      case 'radio':
        return ''
      case 'switch':
        return false
      case 'number':
        return ''
      case 'file':
      case 'image':
        return [] // 上传字段默认空数组
      default:
        return ''
    }
  }

  /**
   * 解析服务端正则表达式（支持字符串/对象格式）
   */
  parsePattern(serverPattern) {
    if (!serverPattern) return null

    if (typeof serverPattern === 'string') {
      // 支持内置规则名（如 "mobile" 映射 FORM_REGEX.MOBILE）
      if (FORM_REGEX[serverPattern.toUpperCase()]) {
        return FORM_REGEX[serverPattern.toUpperCase()]
      }
      try {
        const purePattern = serverPattern.startsWith('/') && serverPattern.endsWith('/')
          ? serverPattern.slice(1, -1)
          : serverPattern
        return new RegExp(purePattern)
      } catch (e) {
        console.error('服务端正则表达式格式错误', serverPattern, e)
        return null
      }
    }

    if (typeof serverPattern === 'object' && serverPattern.pattern) {
      try {
        return new RegExp(serverPattern.pattern, serverPattern.flags)
      } catch (e) {
        console.error('服务端正则表达式配置错误', serverPattern, e)
        return null
      }
    }

    return null
  }

  /**
   * 解析服务端自定义校验规则（支持函数字符串/内置规则名）
   */
  parseValidator(serverValidator) {
    if (!serverValidator) return null

    // 1. 内置校验规则（服务端传入规则名，前端映射）
    const builtInValidators = {
      mobile: (value) => FORM_REGEX.MOBILE.test(value),
      email: (value) => FORM_REGEX.EMAIL.test(value),
      idCard: (value) => FORM_REGEX.ID_CARD.test(value),
      password: (value) => FORM_REGEX.PASSWORD.test(value),
    }
    if (builtInValidators[serverValidator]) {
      return builtInValidators[serverValidator]
    }

    // 2. 服务端返回校验函数字符串（如 "value > 18 && value < 60"）
    if (typeof serverValidator === 'string') {
      try {
        return new Function('value', 'formModel', `return ${serverValidator}`)
      } catch (e) {
        console.error('服务端自定义校验脚本错误', serverValidator, e)
        return null
      }
    }

    // 3. 服务端直接返回函数（仅支持同构场景，不推荐）
    if (typeof serverValidator === 'function') {
      return serverValidator
    }

    return null
  }

  /**
   * 特殊字段处理（选项类、上传类、隐藏域等）
   * @param {Object} field - 适配后的字段配置
   */
  handleSpecialField(field) {
    // 选项类字段（select/radio/checkbox）：确保 options 格式正确
    if (['select', 'radio', 'checkbox'].includes(field.type)) {
      if (!Array.isArray(field.options)) {
        field.options = []
        console.warn(`字段${field.key}（${field.type}类型）的 options 必须是数组，已重置为空数组`)
      } else {
        // 确保每个选项都有 label 和 value
        field.options = field.options.map((opt, optIndex) => {
          if (typeof opt === 'string') {
            return { label: opt, value: opt } // 兼容服务端直接返回字符串数组
          }
          return {
            label: opt.label ?? opt.value ?? `选项${optIndex + 1}`,
            value: opt.value ?? opt.label ?? `opt-${optIndex}`,
          }
        })
      }
    }

    // 隐藏域：强制设置 hidden 为 true
    if (field.type === 'hidden') {
      field.hidden = true
    }

    // 数字类型：限制输入为数字（前端辅助）
    if (field.type === 'number') {
      field.pattern = field.pattern || FORM_REGEX.NUMBER
      field.patternMessage = field.patternMessage || '请输入数字'
    }

    // 上传字段（file/image）补充默认值
    if (['file', 'image'].includes(field.type)) {
      field.accept = field.accept || []
      field.maxSize = field.maxSize || 5
      field.maxCount = field.maxCount || 1
      field.uploadApi = field.uploadApi || ''
      field.uploadConfig = field.uploadConfig || {}
      field.showPreview = field.showPreview ?? (field.type === 'image')
      field.buttonText = field.buttonText || '选择文件'
      field.placeholder = field.placeholder || `请选择${field.type === 'image' ? '图片' : '文件'}（最大${field.maxSize}MB）`
    }
  }

  /**
   * 解析服务端显示规则（条件联动）
   * @param {Object} showRule - 服务端返回的显示规则
   * @returns {Function} 前端可执行的显示规则函数
   */
  parseShowRule(showRule) {
    if (!showRule || !showRule.key) return () => true

    // 支持的运算符
    const operators = {
      '==': (a, b) => a == b,
      '===': (a, b) => a === b,
      '!=': (a, b) => a != b,
      '!==': (a, b) => a !== b,
      '>': (a, b) => a > b,
      '<': (a, b) => a < b,
      '>=': (a, b) => a >= b,
      '<=': (a, b) => a <= b,
      'in': (a, b) => Array.isArray(b) && b.includes(a),
      'notIn': (a, b) => Array.isArray(b) && !b.includes(a),
    }

    const { key, value, operator = '===' } = showRule
    const handler = operators[operator]

    if (!handler) {
      console.error('不支持的显示规则运算符', operator, showRule)
      return () => true
    }

    return (formModel) => handler(formModel[key], value)
  }

  /**
   * 解析服务端联动规则
   * @param {Object} linkRule - 服务端联动规则配置
   * @returns {Object} 解析后的联动规则（可执行函数）
   */
  parseLinkRule(linkRule = {}) {
    if (!linkRule.triggerKey) {
      console.warn('联动规则缺少 triggerKey（触发字段key）', linkRule)
      return null
    }

    // 支持的联动类型：show/hide/setValue/setOptions/setValidate/request
    const supportTypes = ['show', 'hide', 'setValue', 'setOptions', 'setValidate', 'request']
    if (!linkRule.type || !supportTypes.includes(linkRule.type)) {
      console.warn(`不支持的联动类型：${linkRule.type}，支持类型：${supportTypes.join(',')}`, linkRule)
      return null
    }

    // 解析条件表达式（如 "value === 'male'" 或 (value) => value > 18）
    const conditionFn = this.parseCondition(linkRule.condition)

    // 解析执行逻辑（根据联动类型）
    const executeFn = this.parseLinkExecute(linkRule)

    return {
      triggerKey: linkRule.triggerKey, // 触发字段key
      targetKey: linkRule.targetKey, // 目标字段key（必填）
      type: linkRule.type, // 联动类型
      condition: conditionFn, // 触发条件（返回boolean）
      execute: executeFn, // 执行逻辑
      triggerOnInit: linkRule.triggerOnInit ?? true, // 是否初始化时触发
      debounce: linkRule.debounce ?? 0, // 防抖时间（ms，接口联动常用）
      loadingText: linkRule.loadingText ?? '加载中...' // 加载提示文本
    }
  }

  /**
   * 解析联动条件表达式
   * @param {string/Function/Object} condition - 服务端条件配置
   * @returns {Function} 条件判断函数（返回boolean）
   */
  parseCondition(condition) {
    // 1. 无条件（默认触发）
    if (!condition) {
      return () => true
    }

    // 2. 函数形式（服务端返回函数字符串或直接函数）
    if (typeof condition === 'string') {
      try {
        // 支持 "value === 'male'" 或 "(value, formModel) => value === 'male'" 格式
        return condition.includes('=>') 
          ? new Function('value', 'formModel', `return ${condition}`)
          : new Function('value', `return ${condition}`)
      } catch (e) {
        console.error('条件表达式解析失败', condition, e)
        return () => false
      }
    }

    // 3. 对象形式（简化配置，如 { eq: 'male' }）
    if (typeof condition === 'object') {
      const [operator, value] = Object.entries(condition)[0]
      const operators = {
        eq: (v) => v === value,
        neq: (v) => v !== value,
        in: (v) => Array.isArray(v) ? v.includes(value) : false,
        notIn: (v) => Array.isArray(v) ? !v.includes(value) : true,
        gt: (v) => v > value,
        lt: (v) => v < value,
        gte: (v) => v >= value,
        lte: (v) => v <= value,
        hasValue: (v) => v !== '' && v !== undefined && v !== null
      }
      return operators[operator] || (() => false)
    }

    // 4. 直接函数（同构场景）
    if (typeof condition === 'function') {
      return condition
    }

    return () => false
  }

  /**
   * 解析联动执行逻辑（根据联动类型）
   * @param {Object} linkRule - 联动规则
   * @returns {Function} 执行函数
   */
  parseLinkExecute(linkRule) {
    const { type, targetKey, value, options, validate, requestConfig } = linkRule

    switch (type) {
      // 1. 显示目标字段
      case 'show':
        return () => ({ hidden: false })

      // 2. 隐藏目标字段
      case 'hide':
        return () => ({ hidden: true })

      // 3. 给目标字段赋值
      case 'setValue':
        // 支持固定值或动态表达式（如 "formModel.mobile.slice(0,3)"）
        if (typeof value === 'string' && (value.includes('formModel') || value.includes('value'))) {
          try {
            return (triggerValue, formModel) => ({
              value: new Function('value', 'formModel', `return ${value}`)(triggerValue, formModel)
            })
          } catch (e) {
            console.error('赋值表达式解析失败', value, e)
            return () => ({ value: '' })
          }
        }
        // 固定值
        return () => ({ value })

      // 4. 更新目标字段选项（select/radio/checkbox）
      case 'setOptions':
        // 支持静态选项或动态表达式（如 "formModel.type === 'A' ? [...] : [...]"）
        if (typeof options === 'string' && options.includes('formModel')) {
          try {
            return (triggerValue, formModel) => ({
              options: new Function('value', 'formModel', `return ${options}`)(triggerValue, formModel)
            })
          } catch (e) {
            console.error('选项表达式解析失败', options, e)
            return () => ({ options: [] })
          }
        }
        // 静态选项（需是数组）
        return () => ({ options: Array.isArray(options) ? options : [] })

      // 5. 更新目标字段校验规则
      case 'setValidate':
        return () => ({
          required: validate?.required ?? undefined,
          pattern: validate?.pattern ? this.parsePattern(validate.pattern) : undefined,
          patternMessage: validate?.patternMessage ?? undefined,
          minLength: validate?.minLength ?? undefined,
          maxLength: validate?.maxLength ?? undefined
        })

      // 6. 接口请求联动（如选择省份后拉取城市列表）
      case 'request':
        if (!requestConfig?.api) {
          console.error('接口联动缺少 api 配置', linkRule)
          return () => ({})
        }
        // 解析请求参数（支持动态参数，如 { provinceId: "value" }）
        const parseParams = (triggerValue, formModel) => {
          if (!requestConfig.params) return {}
          const params = {}
          Object.entries(requestConfig.params).forEach(([key, val]) => {
            if (typeof val === 'string' && (val === 'value' || val.includes('formModel'))) {
              params[key] = new Function('value', 'formModel', `return ${val}`)(triggerValue, formModel)
            } else {
              params[key] = val
            }
          })
          return params
        }
        // 解析响应数据（如 "res.data.cities"）
        const responseKey = requestConfig.responseKey || 'data'
        return async (triggerValue, formModel) => {
          const params = parseParams(triggerValue, formModel)
          try {
            // 兼容 fetch/axios/Vue Resource
            const response = typeof Vue !== 'undefined' && typeof Vue.http === 'function'
              ? await Vue.http(requestConfig.api, { params, method: 'GET' })
              : await fetch(`${requestConfig.api}?${new URLSearchParams(params)}`).then(res => res.json())
          
            if (response.code === 200) {
              // 根据联动目标类型返回对应数据（选项/值）
              if (['select', 'radio', 'checkbox'].includes(linkRule.targetType)) {
                return { options: response[responseKey] }
              }
              return { value: response[responseKey] }
            }
            throw new Error(response.message || '接口联动请求失败')
          } catch (error) {
            console.error('接口联动失败', error)
            return { options: [], value: '' }
          }
        }

      default:
        return () => ({})
    }
  }
}

// 导出单例适配器
export default new FormServerAdapter()