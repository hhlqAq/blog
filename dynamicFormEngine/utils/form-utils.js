/**
 * 常用正则表达式（简化配置）
 */
export const FORM_REGEX = {
  MOBILE: /^1[3-9]\d{9}$/, // 手机号
  EMAIL: /^[\w-]+(\.[\w-]+)*@[\w-]+(\.[\w-]+)+$/, // 邮箱
  ID_CARD: /(^\d{15}$)|(^\d{18}$)|(^\d{17}(\d|X|x)$)/, // 身份证
  PASSWORD: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,16}$/, // 密码（8-16位，含大小写字母+数字）
  NUMBER: /^\d+$/, // 纯数字
  DECIMAL: /^\d+(\.\d{1,2})?$/ // 小数（最多2位）
}

/**
 * 生成字段ID（避免重复）
 * @param {string} key - 字段key
 * @returns {string} 唯一ID
 */
export const generateFieldId = (key) => `dynamic-field-${key}-${Date.now().toString(36).slice(-6)}`

/**
 * 快速创建字段配置（辅助函数，可选使用）
 */
export const createTextField = (options) => ({
  type: 'text',
  id: generateFieldId(options.key),
  required: false,
  placeholder: `请输入${options.label}`,
  ...options
})

export const createMobileField = (options) => ({
  type: 'text',
  id: generateFieldId(options.key),
  required: true,
  pattern: FORM_REGEX.MOBILE,
  patternMessage: '请输入正确的手机号',
  placeholder: '请输入手机号',
  maxlength: 11,
  ...options
})

export const createSelectField = (options) => {
  if (!options.options || !Array.isArray(options.options)) {
    throw new Error('select字段必须配置options数组')
  }
  return {
    type: 'select',
    id: generateFieldId(options.key),
    required: false,
    placeholder: '请选择',
    ...options
  }
}

export const createImageUploadField = (options) => ({
  type: 'image',
  id: generateFieldId(options.key),
  required: false,
  accept: ['image/*'],
  maxSize: 2,
  maxCount: 1,
  buttonText: '选择图片',
  ...options
})