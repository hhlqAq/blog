<template>
  <label class="switch">
    <input
      type="checkbox"
      :checked="modelValue"
      :disabled="field.disabled || linkLoading"
      @change="$emit('update:modelValue', $event.target.checked)"
    >
    <span class="switch-slider"></span>
    <span v-if="field.switchText" class="switch-text">{{ field.switchText }}</span>
  </label>
</template>

<script>
export default {
  name: 'FormSwitch',
  props: {
    field: {
      type: Object,
      required: true
    },
    modelValue: {
      type: Boolean,
      default: false
    },
    linkLoading: {
      type: Boolean,
      default: false
    }
  },
  emits: ['update:modelValue']
}
</script>

<style scoped>
.switch {
  display: flex;
  align-items: center;
  cursor: pointer;
}

.switch input {
  display: none;
}

.switch-slider {
  width: 40px;
  height: 20px;
  background-color: #dcdcdc;
  border-radius: 10px;
  position: relative;
  transition: all 0.3s;
}

.switch-slider::after {
  content: '';
  position: absolute;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background-color: white;
  top: 2px;
  left: 2px;
  transition: all 0.3s;
}

.switch input:checked + .switch-slider {
  background-color: #409eff;
}

.switch input:checked + .switch-slider::after {
  left: 22px;
}

.switch-text {
  margin-left: 8px;
  font-size: 14px;
  color: #333;
}

.switch input:disabled + .switch-slider {
  background-color: #f5f5f5;
  cursor: not-allowed;
}
</style>