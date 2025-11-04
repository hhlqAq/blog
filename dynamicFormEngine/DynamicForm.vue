<template>
  <div class="dynamic-form" :style="formStyle" :class="formClass">
    <!-- 表单顶部示例图 -->
    <img
      v-if="formExampleImage"
      :src="formExampleImage"
      :style="formExampleImageStyle"
      :class="formExampleImageClass"
      alt="表单示例图"
      class="form-top-example"
    >

    <!-- 配置加载中 -->
    <div v-if="isLoading" class="form-loading">
      <i class="loading-icon"></i> 加载中...
    </div>

    <!-- 配置加载失败 -->
    <div v-else-if="loadError" class="form-error">
      表单加载失败：{{ loadError }}
    </div>

    <!-- 表单主体 -->
    <div v-else>
      <FormItem
        v-for="(field, index) in validFields"
        :key="field.id || `field-${index}`"
        :field="field"
        :model-value="formModel[field.key]"
        :error="errors[field.key]"
        :link-loading="linkLoading.has(field.key)"
        :show-rule-fn="() => getFieldDisplayStatus(field)"
        @update:modelValue="handleFieldUpdate(field.key, $event)"
        @blur="handleFieldBlur(field.key, $event)"
        @error-change="handleFieldErrorChange(field.key, $event)"
        @example-image-click="handleExampleImageClick(field)"
      />

      <!-- 操作按钮组 -->
      <FormButtons
        v-if="showButtons"
        :buttons-style="buttonsStyle"
        :buttons-class="buttonsClass"
        :submit-btn-style="submitBtnStyle"
        :submit-btn-class="submitBtnClass"
        :cancel-btn-style="cancelBtnStyle"
        :cancel-btn-class="cancelBtnClass"
        :submit-text="submitText"
        :is-submitting="isSubmitting"
        :link-loading-size="linkLoading.size"
        @submit="handleSubmit"
        @cancel="handleCancel"
      />
    </div>
  </div>
</template>

<script>
import formServerAdapter from '../adapter/form-server-adapter'
import FormItem from './FormItem.vue'
import FormButtons from './FormButtons.vue'

export default {
  name: 'DynamicForm',
  components: { FormItem, FormButtons },
  props: {
    formApi: {
      type: String,
      default: ''
    },
    serverFields: {
      type: Array,
      default: () => []
    },
    initialValues: {
      type: Object,
      default: () => ({})
    },
    showButtons: {
      type: Boolean,
      default: true
    },
    submitText: {
      type: String,
      default: '提交'
    },
    disabled: {
      type: Boolean,
      default: false
    },
    requestConfig: {
      type: Object,
      default: () => ({
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      })
    },
    formStyle: {
      type: Object,
      default: () => ({})
    },
    formClass: {
      type: String,
      default: ''
    },
    formExampleImage: {
      type: String,
      default: ''
    },
    formExampleImageStyle: {
      type: Object,
      default: () => ({
        width: '100%',
        marginBottom: '20px',
        borderRadius: '8px'
      })
    },
    formExampleImageClass: {
      type: String,
      default: ''
    },
    buttonsStyle: {
      type: Object,
      default: () => ({})
    },
    buttonsClass: {
      type: String,
      default: ''
    },
    submitBtnStyle: {
      type: Object,
      default: () => ({})
    },
    submitBtnClass: {
      type: String,
      default: ''
    },
    cancelBtnStyle: {
      type: Object,
      default: () => ({})
    },
    cancelBtnClass: {
      type: String,
      default: ''
    }
  },
  data() {
    return {
      validFields: [],
      formModel: {},
      errors: {},
      isLoading: false,
      loadError: '',
      isSubmitting: false,
      showRuleCache: {},
      globalLinkRules: {},
      linkLoading: new Set(),
      debounceTimer: {}
    }
  },
  computed: {
    needFetchConfig() {
      return !!this.formApi && this.serverFields.length === 0
    }
  },
  watch: {
    initialValues: {
      deep: true,
      immediate: true,
      handler(val) {
        this.updateFormModel(val)
      }
    },
    disabled: {
      immediate: true,
      handler(val) {
        this.validFields.forEach(field => {
          field.disabled = val
        })
      }
    },
    serverFields: {
      deep: true,
      immediate: true,
      handler(val) {
        if (val.length > 0 && !this.needFetchConfig) {
          this.adaptServerFields(val)
        }
      }
    }
  },
  mounted() {
    if (this.needFetchConfig) {
      this.fetchFormConfig()
    }
  },
  beforeDestroy() {
    Object.values(this.debounceTimer).forEach(timer => clearTimeout(timer))
  },
  methods: {
    // 加载服务端配置
    async fetchFormConfig() {
      this.isLoading = true
      this.loadError = ''
      try {
        const response = typeof Vue !== 'undefined' && typeof Vue.http === 'function'
          ? await Vue.http(this.formApi, this.requestConfig)
          : await fetch(this.formApi, this.requestConfig).then(res => res.json())

        if (response.code === 200 && Array.isArray(response.data.fields)) {
          this.adaptServerFields(response.data.fields)
        } else {
          throw new Error(`接口返回格式错误：${response.message || '未知错误'}`)
        }
      } catch (error) {
        this.loadError = error.message || '网络错误，无法加载表单配置'
        console.error('表单配置加载失败', error)
      } finally {
        this.isLoading = false
      }
    },

    // 适配服务端配置
    adaptServerFields(serverFields) {
      const adaptedFields = formServerAdapter.adapt(serverFields)
      this.validFields = adaptedFields.filter(field => field !== null)
      this.globalLinkRules = formServerAdapter.globalLinkRules || {}
      this.initFormModel()
      this.triggerInitLinkRules()
    },

    // 初始化表单模型
    initFormModel() {
      const model = {}
      this.validFields.forEach(field => {
        model[field.key] = this.initialValues[field.key] ?? field.defaultValue
      })
      this.formModel = model
    },

    // 更新表单模型（外部初始值变化时）
    updateFormModel(initialValues) {
      if (this.validFields.length === 0) return
      const model = { ...this.formModel }
      this.validFields.forEach(field => {
        if (initialValues[field.key] !== undefined) {
          model[field.key] = initialValues[field.key]
        }
      })
      this.formModel = model
    },

    // 获取字段显示状态（处理showRule）
    getFieldDisplayStatus(field) {
      if (field.hidden) return false
      if (!this.showRuleCache[field.key] && field.showRule) {
        this.showRuleCache[field.key] = formServerAdapter.parseShowRule(field.showRule)
      }
      const showRuleFn = this.showRuleCache[field.key]
      return showRuleFn ? showRuleFn(this.formModel) : true
    },

    // 字段值更新处理
    handleFieldUpdate(key, value) {
      this.formModel[key] = value
      // 实时校验已存在错误的字段
      if (this.errors[key]) {
        this.validateField(key)
      }
      // 触发字段变更事件
      this.$emit('field-change', { key, value, formModel: { ...this.formModel } })
      // 触发联动规则
      this.triggerLinkRules(key, value)
      // 强制更新（解决显示状态联动问题）
      this.$forceUpdate()
    },

    // 字段失焦处理
    handleFieldBlur(key, value) {
      this.validateField(key)
      this.$emit('field-blur', { key, value })
    },

    // 字段错误变更处理（主要接收上传组件的错误）
    handleFieldErrorChange(key, error) {
      this.errors[key] = error
    },

    // 示例图点击事件
    handleExampleImageClick(field) {
      this.$emit('example-image-click', {
        fieldKey: field.key,
        exampleImage: field.exampleImage || field.uploadExampleImage,
        fieldConfig: field
      })
      // 内置预览逻辑（可选，外部可覆盖）
      const imageUrl = field.exampleImage || field.uploadExampleImage
      if (imageUrl) {
        this.previewImage(imageUrl)
      }
    },

    // 图片预览（内置基础功能）
    previewImage(imageUrl) {
      const previewContainer = document.createElement('div')
      previewContainer.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: rgba(0,0,0,0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 9999;
        cursor: zoom-out;
      `
      const previewImg = document.createElement('img')
      previewImg.src = imageUrl
      previewImg.style.cssText = `
        max-width: 90vw;
        max-height: 90vh;
        border-radius: 8px;
      `
      previewContainer.appendChild(previewImg)
      document.body.appendChild(previewContainer)
      previewContainer.addEventListener('click', () => {
        document.body.removeChild(previewContainer)
      })
    },

    // 单个字段校验
    validateField(key) {
      const field = this.validFields.find(item => item.key === key)
      if (!field) return true
      const value = this.formModel[key]
      let error = ''

      // 上传字段校验
      if (['file', 'image'].includes(field.type)) {
        if (field.required && this.getFieldDisplayStatus(field)) {
          if (!value || value.length === 0) {
            error = `${field.label}为必填项`
          } else {
            const hasErrorFile = value.some(item => item.status === 'error')
            const hasUploadingFile = value.some(item => item.status === 'uploading')
            if (hasErrorFile) error = '存在上传失败的文件，请重试或删除'
            if (hasUploadingFile) error = '文件上传中，请等待完成'
          }
        }
        this.errors[key] = error
        return !error
      }

      // 普通字段校验
      if (field.required && this.getFieldDisplayStatus(field)) {
        if (value === '' || value === undefined || value === null) {
          error = `${field.label}为必填项`
        } else if (field.type === 'checkbox' && value.length === 0) {
          error = `${field.label}至少选择一项`
        }
      }

      // 正则校验
      if (!error && field.pattern && value !== '') {
        if (!field.pattern.test(value)) {
          error = field.patternMessage
        }
      }

      // 自定义校验函数
      if (!error && field.validator && typeof field.validator === 'function' && value !== '') {
        const validateResult = field.validator(value, this.formModel)
        if (typeof validateResult === 'string') {
          error = validateResult
        } else if (!validateResult) {
          error = field.validatorMessage
        }
      }

      // 长度校验
      if (!error && value !== '') {
        if (field.minLength !== undefined && value.length < field.minLength) {
          error = `${field.label}长度不能少于${field.minLength}个字符`
        }
        if (field.maxLength !== undefined && value.length > field.maxLength) {
          error = `${field.label}长度不能超过${field.maxLength}个字符`
        }
      }

      this.errors[key] = error
      return !error
    },

    // 整体表单校验
    validateForm() {
      const errors = {}
      let isAllPass = true

      this.validFields.forEach(field => {
        // 隐藏字段跳过校验
        if (!this.getFieldDisplayStatus(field)) return
        const value = this.formModel[field.key]
        let error = ''

        // 上传字段校验
        if (['file', 'image'].includes(field.type)) {
          if (field.required) {
            if (!value || value.length === 0) {
              error = `${field.label}为必填项`
            } else {
              const hasErrorFile = value.some(item => item.status === 'error')
              const hasUploadingFile = value.some(item => item.status === 'uploading')
              if (hasErrorFile) error = '存在上传失败的文件，请重试或删除'
              if (hasUploadingFile) error = '文件上传中，请等待完成'
            }
          }
        } else {
          // 普通字段必填校验
          if (field.required) {
            if (value === '' || value === undefined || value === null) {
              error = `${field.label}为必填项`
            } else if (field.type === 'checkbox' && value.length === 0) {
              error = `${field.label}至少选择一项`
            }
          }

          // 正则校验
          if (!error && field.pattern && value !== '') {
            if (!field.pattern.test(value)) {
              error = field.patternMessage
            }
          }

          // 自定义校验
          if (!error && field.validator && typeof field.validator === 'function' && value !== '') {
            const validateResult = field.validator(value, this.formModel)
            if (typeof validateResult === 'string') {
              error = validateResult
            } else if (!validateResult) {
              error = field.validatorMessage
            }
          }

          // 长度校验
          if (!error && value !== '') {
            if (field.minLength !== undefined && value.length < field.minLength) {
              error = `${field.label}长度不能少于${field.minLength}个字符`
            }
            if (field.maxLength !== undefined && value.length > field.maxLength) {
              error = `${field.label}长度不能超过${field.maxLength}个字符`
            }
          }
        }

        if (error) {
          errors[field.key] = error
          isAllPass = false
        }
      })

      this.errors = errors
      return isAllPass
    },

    // 表单提交处理
    async handleSubmit() {
      const isPass = this.validateForm()
      if (!isPass) {
        // 滚动到第一个错误字段
        const firstErrorKey = Object.keys(this.errors)[0]
        const firstErrorEl = document.querySelector(`[for="${firstErrorKey}"]`)
        if (firstErrorEl) {
          firstErrorEl.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
        this.$emit('submit-fail', { formModel: { ...this.formModel }, errors: { ...this.errors } })
        return
      }

      this.isSubmitting = true
      try {
        // 触发提交事件，外部处理实际提交逻辑
        await this.$emit('submit', { ...this.formModel })
        // 提交成功后是否重置表单（默认重置）
        const needReset = this.validFields.every(field => field.resetAfterSubmit !== false)
        if (needReset) {
          this.resetForm()
        }
        this.$emit('submit-success', { formModel: { ...this.formModel } })
      } catch (error) {
        console.error('表单提交失败', error)
        this.$emit('submit-error', error)
      } finally {
        this.isSubmitting = false
      }
    },

    // 取消表单（重置）
    handleCancel() {
      this.resetForm()
      this.$emit('cancel')
    },

    // 重置表单
    resetForm() {
      this.initFormModel()
      this.errors = {}
      this.linkLoading.clear()
      // 重置防抖计时器
      Object.values(this.debounceTimer).forEach(timer => clearTimeout(timer))
    },

    // 初始化触发联动规则（triggerOnInit: true）
    triggerInitLinkRules() {
      Object.entries(this.globalLinkRules).forEach(([triggerKey, rules]) => {
        const triggerValue = this.formModel[triggerKey]
        rules.forEach(rule => {
          if (rule.triggerOnInit) {
            this.executeLinkRule(rule, triggerValue)
          }
        })
      })
    },

    // 触发字段联动规则
    triggerLinkRules(triggerKey, triggerValue) {
      const rules = this.globalLinkRules[triggerKey] || []
      if (rules.length === 0) return

      rules.forEach(rule => {
        // 防抖处理
        if (rule.debounce > 0) {
          clearTimeout(this.debounceTimer[`${triggerKey}-${rule.targetKey}`])
          this.debounceTimer[`${triggerKey}-${rule.targetKey}`] = setTimeout(() => {
            this.executeLinkRule(rule, triggerValue)
          }, rule.debounce)
          return
        }

        // 立即执行联动
        this.executeLinkRule(rule, triggerValue)
      })
    },

    // 执行单个联动规则
    async executeLinkRule(rule, triggerValue) {
      const { condition, execute, targetKey, type, loadingText } = rule
      const targetField = this.validFields.find(f => f.key === targetKey)
      if (!targetField) return

      // 检查联动条件
      const conditionPass = condition?.(triggerValue, this.formModel) ?? true
      if (!conditionPass) {
        this.handleLinkConditionFail(rule, targetField)
        return
      }

      // 接口联动添加加载状态
      if (type === 'request') {
        this.linkLoading.add(targetKey)
        this.$emit('link-loading', { targetKey, loading: true, text: loadingText })
      }

      try {
        // 执行联动逻辑（同步/异步）
        const result = await execute(triggerValue, this.formModel)
        // 应用联动结果
        this.applyLinkResult(targetField, result, type)
      } catch (error) {
        console.error(`联动失败：${rule.triggerKey} -> ${targetKey}`, error)
        this.$emit('link-error', { rule, error })
      } finally {
        // 移除加载状态
        if (type === 'request') {
          this.linkLoading.delete(targetKey)
          this.$emit('link-loading', { targetKey, loading: false })
        }
      }
    },

    // 联动条件不满足时的处理
    handleLinkConditionFail(rule, targetField) {
      switch (rule.type) {
        case 'show':
          this.updateTargetField(targetField.key, { hidden: true })
          break
        case 'hide':
          this.updateTargetField(targetField.key, { hidden: false })
          break
        case 'setValue':
          this.formModel[targetField.key] = targetField.defaultValue
          break
        case 'setOptions':
          this.updateTargetField(targetField.key, { options: targetField.serverRaw.options || [] })
          break
        case 'setValidate':
          const rawValidate = targetField.serverRaw
          this.updateTargetField(targetField.key, {
            required: rawValidate.required ?? false,
            pattern: rawValidate.pattern ? formServerAdapter.parsePattern(rawValidate.pattern) : undefined,
            patternMessage: rawValidate.patternMessage,
            minLength: rawValidate.minLength,
            maxLength: rawValidate.maxLength
          })
          break
        case 'request':
          if (['select', 'radio', 'checkbox'].includes(targetField.type)) {
            this.updateTargetField(targetField.key, { options: [] })
          }
          this.formModel[targetField.key] = ''
          break
      }
      this.$forceUpdate()
    },

    // 应用联动结果到目标字段
    applyLinkResult(targetField, result, linkType) {
      const { key } = targetField
      const updates = {}

      // 更新字段配置
      if (result.hidden !== undefined) updates.hidden = result.hidden
      if (result.options) {
        updates.options = result.options.map(opt => 
          typeof opt === 'string' ? { label: opt, value: opt } : opt
        )
      }
      if (result.required !== undefined) updates.required = result.required
      if (result.pattern !== undefined) updates.pattern = result.pattern
      if (result.patternMessage !== undefined) updates.patternMessage = result.patternMessage
      if (result.minLength !== undefined) updates.minLength = result.minLength
      if (result.maxLength !== undefined) updates.maxLength = result.maxLength

      // 执行字段配置更新
      if (Object.keys(updates).length > 0) {
        this.updateTargetField(key, updates)
      }

      // 更新字段值
      if (result.value !== undefined) {
        this.formModel[key] = result.value
        this.$emit('field-change', {
          key,
          value: result.value,
          formModel: { ...this.formModel }
        })
        this.validateField(key)
      }

      // 选项联动时清空不匹配的旧值
      if (result.options && !result.value && ['select', 'radio'].includes(targetField.type)) {
        this.formModel[key] = ''
        this.validateField(key)
      }

      this.$forceUpdate()
    },

    // 更新目标字段配置
    updateTargetField(targetKey, updates) {
      const fieldIndex = this.validFields.findIndex(f => f.key === targetKey)
      if (fieldIndex === -1) return

      const updatedField = { ...this.validFields[fieldIndex], ...updates }
      this.validFields.splice(fieldIndex, 1, updatedField)

      // 更新联动规则中的目标字段引用
      Object.values(this.globalLinkRules).forEach(rules => {
        rules.forEach(rule => {
          if (rule.targetKey === targetKey) {
            rule.targetField = updatedField
          }
        })
      })
    },

    // 暴露给外部：获取表单当前状态
    getFormData() {
      return {
        formModel: { ...this.formModel },
        errors: { ...this.errors },
        isValid: this.validateForm(),
        fields: this.validFields.map(field => ({ ...field }))
      }
    },

    // 暴露给外部：设置表单字段值
    setFormValues(values) {
      Object.keys(values).forEach(key => {
        const field = this.validFields.find(item => item.key === key)
        if (field) {
          this.formModel[key] = values[key]
          this.validateField(key)
          this.triggerLinkRules(key, values[key])
        }
      })
      this.$forceUpdate()
    },

    // 暴露给外部：手动触发联动
    triggerLinkManually(triggerKey) {
      const triggerValue = this.formModel[triggerKey]
      this.triggerLinkRules(triggerKey, triggerValue)
    },

    // 暴露给外部：手动校验表单
    validate() {
      return this.validateForm()
    }
  }
}
</script>

<style scoped>
/* 根表单样式 */
.dynamic-form {
  background-color: white;
  border-radius: 12px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
  padding: 30px;
  box-sizing: border-box;
}

/* 加载状态 */
.form-loading {
  text-align: center;
  padding: 50px 0;
  color: #666;
  font-size: 16px;
}

/* 错误状态 */
.form-error {
  text-align: center;
  padding: 50px 0;
  color: #ff4d4f;
  font-size: 16px;
}

/* 顶部示例图 */
.form-top-example {
  display: block;
  object-fit: cover;
}

/* 加载动画通用样式 */
.loading-icon {
  display: inline-block;
  width: 18px;
  height: 18px;
  border: 2px solid rgba(64, 158, 255, 0.3);
  border-radius: 50%;
  border-top-color: #409eff;
  animation: spin 1s ease-in-out infinite;
  margin-right: 8px;
  vertical-align: middle;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* 响应式适配 */
@media (max-width: 768px) {
  .dynamic-form {
    padding: 20px 16px;
  }
}
</style>