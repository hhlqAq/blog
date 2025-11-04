<!-- 页面加载后自动弹出活动弹窗 -->
<template>
  <div class="home-page">...</div>
</template>

<script>
import PopupManager, { POPUP_PRIORITY, ANIMATION_TYPE } from './popup-manager'
import ActivityPopup from './ActivityPopup'

export default {
  mounted() {
    // 页面加载后300ms弹出活动弹窗
    setTimeout(() => {
      PopupManager.open(ActivityPopup, {
        priority: POPUP_PRIORITY.BUSINESS,
        animation: ANIMATION_TYPE.SLIDE_UP,
        props: {
          activityId: '2025双11',
          title: '限时折扣活动'
        },
        beforeOpen: () => {
          // 只有未参与过活动的用户才显示
          return !this.userHasJoinedActivity
        }
      })
    }, 300)
  }
}
</script>