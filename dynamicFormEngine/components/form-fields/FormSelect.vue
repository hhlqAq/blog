<template>
  <div>
    <!-- 单选框组 -->
    <div v-if="field.type === 'radio'" class="radio-group">
      <label
        v-for="(option, optIndex) in field.options"
        :key="`${field.id}-opt-${optIndex}`"
        class="radio-item"
      >
        <input
          type="radio"
          :name="field.key"
          :value="option.value"
          :checked="modelValue === option.value"
          :disabled="field.disabled || linkLoading"
          @change="$emit('update:modelValue', option.value)"
        >
        {{ option.label }}
      </label>
    </div>

    <!-- 复选框组 -->
    <div v-if="field.type === 'checkbox'" class="checkbox-group">
      <label
        v-for="(option, optIndex) in field.options"
        :key="`${field.id}-opt-${optIndex}`"
        class="checkbox-item"
      >
        <input
          type="checkbox"
          :value="option.value"
          :checked="modelValue?.includes(option.value)"
          :disabled="field.disabled || linkLoading"
          @change="handleCheckboxChange(option.value, $event.target.checked)"
        >
        {{ option.label }}
      </label>
    </div>

    <!-- 下拉选择框 -->
    <select
      v-if="field.type === 'select'"
      :id="field.id"
      :value="modelValue"
      :disabled="field.disabled || linkLoading"
      @change="$emit('update:modelValue', $event.target.value)"
    >
      <option
        v-if="field.placeholder"
        value=""
        disabled
        selected
      >
        {{ field.placeholder }}
      </option>
      <option
        v-for="(option, optIndex) in field.options"
        :key="`${field.id}-opt-${optIndex}`"
        :value="option.value"
      >
        {{ option.label }}
      </option>
    </select>
  </div>
</template>

<script>
export default {
  name: 'FormSelect',
  props: {
    field: {
      type: Object,
      required: true
    },
    modelValue: {
      type: [String, Array],
      default: ''
    },
    linkLoading: {
      type: Boolean,
      default: false
    }
  },
  emits: ['update:modelValue'],
  methods: {
    handleCheckboxChange(value, checked) {
      const currentValue = this.modelValue || []
      let newValue = []
      if (checked) {
        newValue = currentValue.includes(value) ? currentValue : [...currentValue, value]
      } else {
        newValue = currentValue.filter(item => item !== value)
      }
      this.$emit('update:modelValue', newValue)
    }
  }
}
</script>

<style scoped>
/* 单选框组 */
.radio-group {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
}

.radio-item {
  display: flex;
  align-items: center;
  font-size: 14px;
  color: #333;
  cursor: pointer;
}

.radio-item input {
  margin-right: 6px;
}

/* 复选框组 */
.checkbox-group {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
}

.checkbox-item {
  display: flex;
  align-items: center;
  font-size: 14px;
  color: #333;
  cursor: pointer;
}

.checkbox-item input {
  margin-right: 6px;
}

/* 下拉框 */
select {
  width: 100%;
  padding: 10px 14px;
  border: 1px solid #dcdcdc;
  border-radius: 8px;
  font-size: 14px;
  box-sizing: border-box;
  transition: all 0.3s;
}

select:focus {
  outline: none;
  border-color: #409eff;
  box-shadow: 0 0 0 2px rgba(64, 158, 255, 0.2);
}

select:disabled {
  background-color: #f5f5f5;
  color: #999;
  cursor: not-allowed;
}
</style>