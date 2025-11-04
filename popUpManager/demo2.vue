<!-- 显示提示弹窗（低优先级） -->
<script>
import PopupManager, { ANIMATION_TYPE } from './popup-manager'
import ToastPopup from './ToastPopup'

// 操作成功后显示提示
this.$api.submitForm().then(() => {
  PopupManager.open(ToastPopup, {
    priority: POPUP_PRIORITY.NORMAL,
    animation: ANIMATION_TYPE.FADE,
    props: {
      message: '提交成功',
      duration: 2000 // 2秒后自动关闭
    },
    afterClose: () => {
      // 提示关闭后刷新列表
      this.refreshList()
    }
  })
})
</script>