/**
 * 生产级设备指纹生成工具（H5 环境）
 * 特征组合：UA + 语言 + 时区 + 屏幕信息 + Canvas 指纹 + WebGL 指纹 + 浏览器配置
 * 输出：32 位 SHA256 哈希值（设备唯一标识）
 */
export const DeviceFingerprint = {
  // 缓存指纹，避免重复计算
  cachedFingerprint: null,

  /**
   * 生成设备指纹（核心方法）
   * @returns {Promise<string>} 32 位设备指纹
   */
  generate() {
    // 优先使用缓存
    if (this.cachedFingerprint) {
      return Promise.resolve(this.cachedFingerprint);
    }

    try {
      // 收集所有特征（同步 + 异步）
      const features = [
        this.getBasicFeatures(), // 基础特征（同步）
        this.getCanvasFingerprint(), // Canvas 指纹（同步）
        this.getWebGLFingerprint() // WebGL 指纹（异步，兼容 IE11）
      ];

      // 组合所有特征并哈希
      return Promise.all(features)
        .then((featureList) => {
          // 拼接所有特征为字符串（用特殊分隔符避免特征值冲突）
          const featureStr = featureList.filter(Boolean).join("|");
          // SHA256 哈希（输出 64 位，可截取前 32 位精简）
          const fingerprint = sha256(featureStr).substring(0, 32);
          // 缓存指纹（持久化到 localStorage，清除缓存后仍可重新计算）
          this.cachedFingerprint = fingerprint;
          return fingerprint;
        })
        .catch((err) => {
          console.warn("[设备指纹] 生成失败，使用降级方案", err);
          // 降级方案：仅使用基础特征（稳定性略低，但保证可用）
          const basicFeatureStr = this.getBasicFeatures().join("|");
          const fallbackFingerprint = sha256(basicFeatureStr).substring(0, 32);
          this.cachedFingerprint = fallbackFingerprint;
          return fallbackFingerprint;
        });
    } catch (err) {
      // 极端异常（如 sha256 未加载），使用简单哈希降级
      const basicFeatureStr = this.getBasicFeatures().join("|");
      const extremeFallback = this.simpleHash(basicFeatureStr);
      this.cachedFingerprint = extremeFallback;
      return Promise.resolve(extremeFallback);
    }
  },

  /**
   * 获取基础特征（同步，兼容性最高）
   * @returns {string[]} 基础特征数组
   */
  getBasicFeatures() {
    const navigator = window.navigator;
    const screen = window.screen;

    return [
      // 浏览器核心信息
      navigator.userAgent || "unknown_ua",
      navigator.language || navigator.browserLanguage || "unknown_lang",
      // 系统时区（分钟数，如 UTC+8 为 -480）
      new Date().getTimezoneOffset().toString(),
      // 屏幕信息（分辨率 + 颜色深度）
      `${screen.width}x${screen.height}`,
      screen.colorDepth.toString() || "24",
      // 浏览器配置
      navigator.cookieEnabled ? "cookie_enabled" : "cookie_disabled",
      navigator.javaEnabled ? "java_enabled" : "java_disabled",
      // 存储支持
      typeof localStorage !== "undefined" ? "localStorage_support" : "localStorage_unsupport"
    ];
  },

  /**
   * 获取 Canvas 指纹（同步）
   * 原理：绘制固定图形，利用 GPU 渲染差异生成唯一特征
   * @returns {string} Canvas 特征哈希
   */
  getCanvasFingerprint() {
    try {
      // 创建隐藏的 Canvas 元素（不影响页面）
      const canvas = document.createElement("canvas");
      canvas.width = 256;
      canvas.height = 256;
      const ctx = canvas.getContext("2d");

      // 绘制固定内容（文字 + 矩形 + 渐变，增强渲染差异）
      ctx.fillStyle = "#f0f0f0";
      ctx.fillRect(0, 0, 256, 256);
      ctx.font = "16px Arial";
      ctx.fillStyle = "#333";
      ctx.fillText("device-fingerprint-2024", 20, 100);
      // 绘制渐变
      const gradient = ctx.createLinearGradient(0, 0, 256, 256);
      gradient.addColorStop(0, "#000");
      gradient.addColorStop(1, "#fff");
      ctx.fillStyle = gradient;
      ctx.fillRect(50, 50, 150, 150);

      // 获取画布数据（Base64）并哈希
      const dataUrl = canvas.toDataURL("image/png");
      return sha256(dataUrl);
    } catch (err) {
      console.warn("[设备指纹] Canvas 特征获取失败", err);
      return "canvas_unsupport";
    }
  },

  /**
   * 获取 WebGL 指纹（异步，兼容 IE11）
   * 原理：获取显卡渲染器/供应商信息，硬件特征稳定性高
   * @returns {Promise<string>} WebGL 特征哈希
   */
  getWebGLFingerprint() {
    return new Promise((resolve) => {
      try {
        const canvas = document.createElement("canvas");
        let gl = null;

        // 尝试获取 WebGL 上下文（兼容不同浏览器前缀）
        const getGLContext = () => {
          try {
            return canvas.getContext("webgl") || 
                   canvas.getContext("experimental-webgl") || 
                   null;
          } catch (e) {
            return null;
          }
        };

        gl = getGLContext();
        if (!gl) {
          resolve("webgl_unsupport");
          return;
        }

        // 获取 WebGL 扩展（核心特征：渲染器和供应商）
        const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
        let renderer = "unknown_renderer";
        let vendor = "unknown_vendor";

        if (debugInfo) {
          renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || renderer;
          vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) || vendor;
        }

        // 补充 WebGL 其他特征（增强唯一性）
        const webglFeatures = [
          renderer,
          vendor,
          gl.getParameter(gl.VERSION) || "unknown_version",
          gl.getParameter(gl.SHADING_LANGUAGE_VERSION) || "unknown_shading_version"
        ];

        resolve(sha256(webglFeatures.join("|")));
      } catch (err) {
        console.warn("[设备指纹] WebGL 特征获取失败", err);
        resolve("webgl_unsupport");
      }
    });
  },

  /**
   * 简单哈希（降级方案，无 sha256 时使用）
   * @param {string} str 输入字符串
   * @returns {string} 32 位哈希值
   */
  simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0; // 转为 32 位整数
    }
    // 转为 16 进制字符串，不足 32 位补零
    return Math.abs(hash).toString(16).padStart(32, "0");
  },

  /**
   * 清除指纹缓存（用于测试）
   */
  clearCache() {
    this.cachedFingerprint = null;
  }
};