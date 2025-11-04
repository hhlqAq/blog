<!-- 点击按钮弹出登录弹窗（高优先级） -->
<template>
  <button @click="openLogin">立即购买</button>
</template>

<script>
import PopupManager, { POPUP_PRIORITY } from './popup-manager'
import LoginPopup from './LoginPopup'

export default {
  methods: {
    async openLogin() {
      // 检查登录状态，未登录则弹出登录弹窗
      if (!this.isLogin) {
        const result = await PopupManager.open(LoginPopup, {
          priority: POPUP_PRIORITY.AUTH, // 权限弹窗优先级高，会覆盖普通弹窗
          closeOnMask: false, // 点击遮罩不关闭（强制登录）
          closeOnBack: false // 返回键不关闭
        })
        
        if (result.success) {
          console.log('登录成功，执行购买')
          this.handlePurchase()
        }
      }
    }
  }
}
</script>