<!-- LoginPopup.vue -->
<template>
  <div class="login-popup">
    <!-- 关闭按钮 -->
    <button class="close-btn" @click="handleClose">×</button>
    
    <h3>登录账号</h3>
    <input type="text" v-model="username" placeholder="请输入手机号">
    <input type="password" v-model="password" placeholder="请输入密码">
    <button @click="handleLogin">登录</button>
  </div>
</template>

<script>
export default {
  data() {
    return {
      username: '',
      password: ''
    }
  },
  methods: {
    handleLogin() {
      // 登录逻辑
      if (this.username && this.password) {
        this.$emit('close', { success: true, username: this.username })
      }
    },
    handleClose() {
      this.$emit('close', { success: false })
    }
  }
}
</script>

<style scoped>
.login-popup {
  width: 300px;
  padding: 20px;
  background: white;
  border-radius: 8px;
}

.close-btn {
  position: absolute;
  top: 10px;
  right: 10px;
  background: transparent;
  border: none;
  font-size: 18px;
  cursor: pointer;
}
</style>