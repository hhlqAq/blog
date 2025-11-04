<template>
  <div
    class="form-item"
    :style="{ display: isShow ? 'block' : 'none', ...field.customStyle }"
    :class="field.customClass"
  >
    <!-- 标签 -->
    <label
      v-if="field.label && field.type !== 'hidden'"
      class="form-label"
      :for="field.id"
      :style="field.labelStyle"
      :class="field.labelClass"
    >
      {{ field.label }}
      <span v-if="field.required" class="required">*</span>
      <!-- 标签旁示例图 -->
      <img
        v-if="field.exampleImage && field.type !== 'text'"
        :src="field.exampleImage"
        :style="field.exampleImageStyle"
        :class="field.exampleImageClass"
        alt="字段示例图"
        class="field-label-example"
        @click="$emit('example-image-click')"
      >
    </label>

    <!-- 字段内容容器 -->
    <div class="form-control" :style="field.controlStyle" :class="field.controlClass">
      <!-- 联动加载状态 -->
      <div v-if="linkLoading" class="link-loading">
        <i class="loading-icon"></i>
        <span>{{ field.linkLoadingText || '加载中...' }}</span>
      </div>

      <!-- 字段组件（动态渲染） -->
      <component
        :is="fieldComponent"
        :field="field"
        :model-value="modelValue"
        :error="error"
        :link-loading="linkLoading"
        @update:modelValue="$emit('update:modelValue', $event)"
        @blur="$emit('blur', $event)"
        @error-change="$emit('error-change', $event)"
        @example-image-click="$emit('example-image-click')"
      />

      <!-- 非上传字段的错误提示 -->
      <div v-if="error && !['file', 'image'].includes(field.type)" class="error-message">
        {{ error }}
      </div>
    </div>
  </div>
</template>

<script>
// 导入所有字段组件
import FormText from './form-fields/FormText.vue'
import FormSelect from './form-fields/FormSelect.vue'
import FormTextarea from './form-fields/FormTextarea.vue'
import FormSwitch from './form-fields/FormSwitch.vue'
import FormHidden from './form-fields/FormHidden.vue'
import FormUpload from './form-fields/FormUpload.vue'

export default {
  name: 'FormItem',
  components: {
    FormText,
    FormSelect,
    FormTextarea,
    FormSwitch,
    FormHidden,
    FormUpload
  },
  props: {
    field: {
      type: Object,
      required: true
    },
    modelValue: {
      type: [String, Number, Boolean, Array],
      default: ''
    },
    error: {
      type: String,
      default: ''
    },
    linkLoading: {
      type: Boolean,
      default: false
    },
    showRuleFn: {
      type: Function,
      default: () => true
    }
  },
  emits: ['update:modelValue', 'blur', 'error-change', 'example-image-click'],
  computed: {
    // 是否显示当前表单项
    isShow() {
      return !this.field.hidden && this.showRuleFn()
    },
    // 根据字段类型匹配组件
    fieldComponent() {
      switch (this.field.type) {
        case 'text':
        case 'password':
        case 'number':
          return 'FormText'
        case 'select':
        case 'radio':
        case 'checkbox':
          return 'FormSelect'
        case 'textarea':
          return 'FormTextarea'
        case 'switch':
          return 'FormSwitch'
        case 'hidden':
          return 'FormHidden'
        case 'file':
        case 'image':
          return 'FormUpload'
        default:
          return 'FormText'
      }
    }
  }
}
</script>

<style scoped>
.form-item {
  display: flex;
  align-items: center;
  margin-bottom: 20px;
  box-sizing: border-box;
}

.form-label {
  width: 120px;
  font-size: 14px;
  color: #333;
  margin-right: 16px;
  text-align: right;
  box-sizing: border-box;
}

.required {
  color: #ff4d4f;
  margin-left: 4px;
}

.field-label-example {
  vertical-align: middle;
}

.form-control {
  flex: 1;
  position: relative;
}

/* 联动加载状态 */
.link-loading {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(255, 255, 255, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  z-index: 10;
}

.link-loading .loading-icon {
  display: inline-block;
  width: 16px;
  height: 16px;
  border: 2px solid rgba(64, 158, 255, 0.3);
  border-radius: 50%;
  border-top-color: #409eff;
  animation: spin 1s ease-in-out infinite;
  margin-right: 6px;
}

.error-message {
  margin-top: 4px;
  font-size: 12px;
  color: #ff4d4f;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* 响应式适配 */
@media (max-width: 768px) {
  .form-item {
    flex-direction: column;
    align-items: flex-start;
    margin-bottom: 24px;
  }

  .form-label {
    width: 100%;
    text-align: left;
    margin-bottom: 8px;
    margin-right: 0;
  }
}
</style>