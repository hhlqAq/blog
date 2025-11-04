<template>
  <div class="form-buttons" :style="buttonsStyle" :class="buttonsClass">
    <button
      type="button"
      class="btn btn-cancel"
      :style="cancelBtnStyle"
      :class="cancelBtnClass"
      @click="$emit('cancel')"
      :disabled="isSubmitting || linkLoadingSize > 0"
    >
      取消
    </button>
    <button
      type="button"
      class="btn btn-submit"
      :style="submitBtnStyle"
      :class="submitBtnClass"
      @click="$emit('submit')"
      :disabled="isSubmitting || linkLoadingSize > 0"
    >
      <span v-if="isSubmitting">
        <i class="loading-icon"></i> 提交中...
      </span>
      <span v-else>{{ submitText || '提交' }}</span>
    </button>
  </div>
</template>

<script>
export default {
  name: 'FormButtons',
  props: {
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
      default: () => ({
        background: 'linear-gradient(90deg, #ff6a3c 0%, #ff4d2d 100%)',
        border: 'none',
        borderRadius: '20px',
        padding: '10px 30px',
        fontSize: '16px',
        fontWeight: 'bold'
      })
    },
    submitBtnClass: {
      type: String,
      default: ''
    },
    cancelBtnStyle: {
      type: Object,
      default: () => ({
        background: '#f5f5f5',
        border: '1px solid #dcdcdc',
        borderRadius: '20px',
        padding: '10px 20px',
        fontSize: '16px'
      })
    },
    cancelBtnClass: {
      type: String,
      default: ''
    },
    submitText: {
      type: String,
      default: '提交'
    },
    isSubmitting: {
      type: Boolean,
      default: false
    },
    linkLoadingSize: {
      type: Number,
      default: 0
    }
  },
  emits: ['submit', 'cancel']
}
</script>

<style scoped>
.form-buttons {
  display: flex;
  justify-content: center;
  gap: 16px;
  margin-top: 30px;
}

.btn {
  padding: 10px 24px;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.3s;
  border: none;
}

.btn-cancel {
  background-color: #f5f5f5;
  color: #666;
}

.btn-cancel:hover {
  background-color: #e5e5e5;
}

.btn-submit {
  background-color: #409eff;
  color: white;
}

.btn-submit:hover {
  background-color: #2f80ed;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* 提交按钮加载动画 */
.btn-submit .loading-icon {
  display: inline-block;
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-radius: 50%;
  border-top-color: white;
  animation: spin 1s ease-in-out infinite;
  margin-right: 6px;
  vertical-align: middle;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* 响应式适配 */
@media (max-width: 768px) {
  .form-buttons {
    flex-direction: column;
    gap: 10px;
  }

  .form-buttons .btn {
    width: 100%;
  }
}
</style>