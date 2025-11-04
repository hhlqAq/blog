/**
 * 上传相关工具函数：格式校验、大小转换、上传请求
 */
export const UploadUtils = {
  /**
   * 校验文件格式
   * @param {File} file - 待校验文件
   * @param {Array} accept - 允许的格式（如 ['image/*', '.pdf']）
   * @returns {boolean} 是否通过校验
   */
  validateFileFormat(file, accept = []) {
    if (accept.length === 0) return true

    const acceptTypes = accept.map(type => type.toLowerCase())
    const fileType = file.type.toLowerCase()
    const fileExt = `.${file.name.split('.').pop().toLowerCase()}`

    return acceptTypes.some(type => {
      if (type.includes('*')) {
        const baseType = type.split('/')[0]
        return fileType.startsWith(baseType)
      }
      return type === fileType || type === fileExt
    })
  },

  /**
   * 校验文件大小
   * @param {File} file - 待校验文件
   * @param {number} maxSize - 最大大小（单位：MB）
   * @returns {boolean} 是否通过校验
   */
  validateFileSize(file, maxSize = 5) {
    if (maxSize <= 0) return true
    const fileSize = file.size / 1024 / 1024
    return fileSize <= maxSize
  },

  /**
   * 字节转友好单位（KB/MB/GB）
   * @param {number} bytes - 字节数
   * @returns {string} 友好单位字符串
   */
  formatFileSize(bytes) {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MB`
    return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
  },

  /**
   * 图片文件转 Base64（用于预览）
   * @param {File} file - 图片文件
   * @returns {Promise<string>} Base64 字符串
   */
  fileToBase64(file) {
    return new Promise((resolve, reject) => {
      if (!file.type.startsWith('image/')) {
        reject(new Error('非图片文件无法预览'))
        return
      }
      const reader = new FileReader()
      reader.onload = (e) => resolve(e.target.result)
      reader.onerror = (err) => reject(err)
      reader.readAsDataURL(file)
    })
  },

  /**
   * 上传文件到服务端
   * @param {File} file - 待上传文件
   * @param {string} uploadApi - 上传接口地址
   * @param {Object} uploadConfig - 上传配置（headers、参数等）
   * @returns {Promise<Object>} 服务端返回的文件信息（如 url、id）
   */
  async uploadFile(file, uploadApi, uploadConfig = {}) {
    const formData = new FormData()
    const fileKey = uploadConfig.fileKey || 'file'
    formData.append(fileKey, file)

    // 追加额外参数
    if (uploadConfig.data) {
      Object.keys(uploadConfig.data).forEach(key => {
        formData.append(key, uploadConfig.data[key])
      })
    }

    // 构建请求配置
    const requestOptions = {
      method: 'POST',
      headers: {
        'Content-Type': 'multipart/form-data',
        ...uploadConfig.headers
      },
      body: formData,
      ...uploadConfig.options
    }

    try {
      const response = await fetch(uploadApi, requestOptions)
      const result = await response.json()
      if (result.code !== 200) {
        throw new Error(result.message || '文件上传失败')
      }
      return result.data
    } catch (error) {
      console.error('文件上传失败', error)
      throw error
    }
  }
}