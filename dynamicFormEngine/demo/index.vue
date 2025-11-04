<template>
  <div class="app-form-container">
    <DynamicForm
      form-api="/api/form/user-info"
      :request-config="{
        headers: { 'Authorization': 'Bearer ' + token }
      }"
      :initial-values="{ gender: 'male', agree: true }"
      :formStyle="{ maxWidth: '600px', margin: '20px auto' }"
      :submitBtnStyle="{ background: 'linear-gradient(90deg, #409eff 0%, #2f80ed 100%)' }"
      @submit="handleSubmit"
      @submit-success="handleSubmitSuccess"
      @link-loading="handleLinkLoading"
      ref="formRef"
    />
  </div>
</template>

<script>
import DynamicForm from './components/dynamic-form/components/DynamicForm.vue'

export default {
  components: { DynamicForm },
  data() {
    return {
      token: localStorage.getItem('token')
    }
  },
  methods: {
    async handleSubmit(formData) {
      // 调用后端提交接口
      const res = await this.$api.submitUserInfo(formData)
      if (res.code !== 200) {
        throw new Error(res.message || '提交失败')
      }
    },
    handleSubmitSuccess() {
      this.$toast.success('提交成功！')
    },
    handleLinkLoading({ loading, text }) {
      if (loading) this.$toast.loading(text, { duration: 0 })
      else this.$toast.clear()
    },
    // 外部手动设置表单值（示例）
    setFormValueExample() {
      this.$refs.formRef.setFormValues({
        name: '默认姓名',
        city: '440100' // 广州
      })
    }
  }
}
</script>

<style>
.app-form-container {
  padding: 20px;
  background-color: #f9f9f9;
}
</style>