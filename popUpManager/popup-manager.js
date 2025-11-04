/**
 * 弹窗管理器
 * 负责管理弹窗的创建、显示、隐藏和层级控制
 * 支持自定义弹窗组件、触发机制、动画系统和关闭逻辑
 */

import Vue from 'vue'

/**
 * 弹窗优先级常量（数值越大优先级越高）
 */
export const POPUP_PRIORITY = {
  NORMAL: 100,    // 普通弹窗（如提示）
  BUSINESS: 200,  // 业务弹窗（如活动）
  AUTH: 300,      // 权限弹窗（如登录）
  SYSTEM: 400     // 系统弹窗（如版本更新）
}

// 动画类型常量
export const ANIMATION_TYPE = {
  FADE: 'fade',         // 淡入淡出
  SCALE: 'scale',       // 缩放
  SLIDE_UP: 'slide-up', // 上滑
  SLIDE_DOWN: 'slide-down', // 下滑
  NONE: 'none'          // 无动画
}

class PopupManager {
    constructor() {
        if(PopupManager.instance) return PopupManager.instance;
        PopupManager.instance = this;
        // 核心队列：按优先级+创建时间排序
        this.queue = [];
        // 当前显示的弹窗（同一时间只显示一个）
        this.activePopup = null;    
        // 遮罩层实例
        this.maskInstance = null;   
        // 基础z-index（确保高于页面其他元素）
        this.baseZIndex = 10000;    
        // 物理返回键监听状态
        this.backHandlerActive = false; 
        // 初始化物理返回键监听（针对H5场景）
        this.initBackHandler();
    }
    /**
     * 初始化物理返回键监听（如移动端浏览器/小程序）
     */
    initBackHandler() {
        if (typeof window !== 'undefined' && window.history) {
            const handlePopState = () => {
                if (this.activePopup && this.activePopup.closeOnBack) {
                    this.close(this.activePopup.id)
                }
            }
            window.addEventListener('popstate', handlePopState);
             // 自动清理监听
            this.cleanup = () => {
                window.removeEventListener('popstate', handlePopState)
            }
        }
    }

    /**
     * 打开弹窗
     * @param {VueComponent} Component 弹窗组件
     * @param {Object} options 弹窗配置项
     * @param {number} options.priority 优先级（默认NORMAL）
     * @param {boolean} options.hasMask 是否显示遮罩（默认true）
     * @param {boolean} options.closeOnMask 点击遮罩关闭（默认true）
     * @param {boolean} options.closeOnBack 物理返回键关闭（默认true）
     * @param {string} options.animation 动画类型（默认FADE）
     * @param {number} options.animationDuration 动画时长(ms)（默认300）
     * @param {Object} options.props 组件props
     * @param {Function} options.beforeOpen 打开前回调
     * @param {Function} options.afterClose 关闭后回调
     * @returns {Promise} 关闭时返回数据的Promise
     */
    open(Component, options = {}){
        return new Promise((resolve, reject) => {
            // 合并默认配置
            const config = {
                priority: POPUP_PRIORITY.NORMAL,
                hasMask: true,
                closeOnMask: true,
                closeOnBack: true,
                animation: ANIMATION_TYPE.FADE,
                animationDuration: 300,
                props: {},
                beforeOpen: () => true,
                afterClose: () => {},
                ...options
            }
            // 执行打开前回调，可阻止弹窗打开
            if (!config.beforeOpen()) {
                reject(new Error('弹窗被beforeOpen阻止'))
                return
            }
            // 生成唯一ID
            const id = `popup-${Date.now()}-${Math.random().toString(36).slice(-6)}`
            // 创建弹窗容器
            const container = document.createElement('div')
            container.className = `popup-container ${config.animation}`
            container.style.zIndex = this.baseZIndex + this.queue.length + 1
            document.body.appendChild(container)

            // 创建 弹窗实例
            const instance = new Vue({
                el: container,
                render: h => h(Component, {
                    props: { ...config.props},
                    on: {
                        close: (data) => this.close(id, data),
                        error: (err) => reject(err)
                    }
                })
            })
            // 弹窗实例信息
            const popup = {
                id,
                instance,
                container,
                config,
                resolve,
                reject,
                createTime: Date.now()
            }
            // 加入队列
            this.queue.push(popup)
            // 排序队列（按优先级+创建时间）
            this.queue.sort((a, b) => {
                return b.config.priority - a.config.priority || b.createTime - a.createTime
            })
            // 如果当前 没有活跃弹窗，则显示新弹窗
            if (!this.activePopup) {
                this.showNextPopup()
            }
        })
    }

    /**
     * 显示下一个弹窗
     */
    showNextPopup() {
        if (this.queue.length === 0) return
        // 取出队头弹窗
        const popup = this.queue.shift()
        this.activePopup = popup

        const { container, config } = this.activePopup
        // 应用入场动画
        this.applyAnimation(container, config.animation, 'enter', config.animationDuration)
        // 更新遮罩
        this.updateMask()
    }
    /**
     * 关闭指定弹窗
     * @param {string} id 弹窗ID
     * @param {any} data 关闭时返回的数据
     */
    close(id, data) {
        const index = this.queue.findIndex(popup => popup.id === id)
        if (index === -1) return
        const popup = this.queue[index]
        const { container, config, resolve } = popup
        // 执行退场动画
        this.applyAnimation(container, config.animation, 'leave', config.animationDuration, () => {
            // 动画结束后清理
            popup.instance.$destroy()
            container.parentNode?.removeChild(container)
            this.queue.splice(index, 1)
            resolve(data) // 触发Promise回调
            config.afterClose() // 执行关闭后回调
            // 显示下一个弹窗
            this.showNextPopup()
        })
    }
    /**
     * 关闭所有弹窗
     * @param {boolean} immediate 是否立即关闭（无动画）
     */
    closeAll(immediate = false) {
        if(immediate){
            this.queue.forEach(popup => {
                popup.instance.$destroy()
                popup.container.parentNode?.removeChild(popup.container)
                popup.resolve(null)
            })
            this.queue = []
            this.activePopup = null
            this.updateMask()
            return
        }
        // 从顶层开始逐个关闭（保留动画）
        if (this.activePopup) {
            this.close(this.activePopup.id)
        }
    }
    /**
     * 应用动画效果
     * @param {HTMLElement} el 元素
     * @param {string} type 动画类型
     * @param {string} stage 阶段（enter/leave）
     * @param {number} duration 时长(ms)
     * @param {Function} callback 动画结束回调
     */
    applyAnimation(el, type, stage, duration, callback) {
        if (type === ANIMATION_TYPE.NONE) {
            callback?.()
            return
        }
        // 重置动画状态
        el.style.transition = `all ${duration}ms ease`
        el.classList.remove(`animate-${type}-enter`, `animate-${type}-leave`)
        // 强制触发重绘
        el.offsetHeight
        // 应用入场/退场类
        if (stage === 'enter') {
            // 入场初始状态
            this.setAnimationInitialState(el, type)
            // 触发重绘后应用目标状态
            setTimeout(() => {
                this.setAnimationTargetState(el, type)
                // 动画结束回调
                setTimeout(callback, duration)
            }, 0)
        }else {
            // 退场：先恢复目标状态，再应用初始状态
            this.setAnimationTargetState(el, type)
            setTimeout(() => {
                this.setAnimationInitialState(el, type)
                setTimeout(callback, duration)
            }, 0)
        }
    }
    /**
     * 设置动画初始状态（入场前/退场后）
     */
    setAnimationInitialState(el, type) {
        switch (type) {
            case ANIMATION_TYPE.FADE:
                el.style.opacity = '0'
                break
            case ANIMATION_TYPE.SCALE:
                el.style.opacity = '0'
                el.style.transform = 'scale(0.8)'
                break
            case ANIMATION_TYPE.SLIDE_UP:
                el.style.opacity = '0'
                el.style.transform = 'translateY(50px)'
                break
            case ANIMATION_TYPE.SLIDE_DOWN:
                el.style.opacity = '0'
                el.style.transform = 'translateY(-50px)'
                break
        }
    }
    /**
     * 设置动画目标状态（入场后/退场前）
     */
    setAnimationTargetState(el, type) {
        switch (type) {
            case ANIMATION_TYPE.FADE:
            case ANIMATION_TYPE.SCALE:
            case ANIMATION_TYPE.SLIDE_UP:
            case ANIMATION_TYPE.SLIDE_DOWN:
                el.style.opacity = '1'
                el.style.transform = 'translate(0, 0) scale(1)'
                break
        }
    }
    /**
     * 更新遮罩层状态
     */
    updateMask() {
        if (this.activePopup?.config.hasMask) {
            if (!this.maskInstance) {
                // 创建遮罩层
                const maskContainer = document.createElement('div')
                maskContainer.className = 'popup-mask'
                maskContainer.style.zIndex = this.baseZIndex
                document.body.appendChild(maskContainer)
            }
            this.maskInstance = new Vue({
                el: maskContainer,
                render: (h) => h('div', {
                    style: {
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: 'rgba(0, 0, 0, 0.5)',
                        opacity: 0,
                        transition: 'opacity 300ms ease'
                    },
                    on: {
                        click: () => this.handleMaskClick()
                    }
                })
            })
            // 显示遮罩并添加动画
            setTimeout(() => {
                this.maskInstance.$el.style.opacity = '1'
            }, 0)
        }else if (this.maskInstance) {
            // 隐藏遮罩
            this.maskInstance.$el.style.opacity = '0'
            // 动画结束后移除DOM（避免遮挡）
            setTimeout(() => {
                this.maskInstance.$el.parentNode?.removeChild(this.maskInstance.$el)
                this.maskInstance = null
            }, 300)
        }
    }
    /**
     * 处理遮罩点击
     */
    handleMaskClick() {
        if (this.activePopup?.config.closeOnMask) {
            this.close(this.activePopup.id)
        }
    }
    /**
     * 页面卸载时清理
     */
    destroy() {
        this.closeAll(true)
        this.cleanup?.() // 移除返回键监听
        PopupManager.instance = null
    }
  
}
// 导出单例实例
export default new PopupManager()