<template>
  <textarea
    :id="field.id"
    :value="modelValue"
    :placeholder="field.placeholder"
    :disabled="field.disabled || linkLoading"
    :maxlength="field.maxlength"
    :rows="field.rows"
    @input="$emit('update:modelValue', $event.target.value)"
    @blur="$emit('blur', $event.target.value)"
  ></textarea>
</template>

<script>
export default {
  name: 'FormTextarea',
  props: {
    field: {
      type: Object,
      required: true
    },
    modelValue: {
      type: String,
      default: ''
    },
    linkLoading: {
      type: Boolean,
      default: false
    }
  },
  emits: ['update:modelValue', 'blur']
}
</script>

<style scoped>
textarea {
  width: 100%;
  min-height: 80px;
  padding: 10px 14px;
  border: 1px solid #dcdcdc;
  border-radius: 8px;
  font-size: 14px;
  box-sizing: border-box;
  transition: all 0.3s;
  resize: vertical;
}

textarea:focus {
  outline: none;
  border-color: #409eff;
  box-shadow: 0 0 0 2px rgba(64, 158, 255, 0.2);
}

textarea:disabled {
  background-color: #f5f5f5;
  color: #999;
  cursor: not-allowed;
}
</style>