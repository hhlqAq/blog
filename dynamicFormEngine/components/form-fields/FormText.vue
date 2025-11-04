<template>
  <div class="input-with-example">
    <input
      :id="field.id"
      :type="field.type"
      :value="modelValue"
      :placeholder="field.placeholder"
      :disabled="field.disabled || linkLoading"
      :maxlength="field.maxlength"
      @input="$emit('update:modelValue', $event.target.value)"
      @blur="$emit('blur', $event.target.value)"
    >
    <img
      v-if="field.exampleImage"
      :src="field.exampleImage"
      :style="{ ...field.exampleImageStyle, cursor: 'pointer' }"
      :class="field.exampleImageClass"
      alt="输入示例图"
      class="input-example-image"
      @click="$emit('example-image-click')"
    >
  </div>
</template>

<script>
export default {
  name: 'FormText',
  props: {
    field: {
      type: Object,
      required: true
    },
    modelValue: {
      type: [String, Number],
      default: ''
    },
    linkLoading: {
      type: Boolean,
      default: false
    }
  },
  emits: ['update:modelValue', 'blur', 'example-image-click']
}
</script>

<style scoped>
.input-with-example {
  position: relative;
  width: 100%;
}

input[type="text"],
input[type="password"],
input[type="number"] {
  width: 100%;
  padding: 10px 14px;
  border: 1px solid #dcdcdc;
  border-radius: 8px;
  font-size: 14px;
  box-sizing: border-box;
  transition: all 0.3s;
}

input:focus {
  outline: none;
  border-color: #409eff;
  box-shadow: 0 0 0 2px rgba(64, 158, 255, 0.2);
}

input:disabled {
  background-color: #f5f5f5;
  color: #999;
  cursor: not-allowed;
}

.input-example-image {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
}
</style>