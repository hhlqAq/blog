<template>
  <div class="upload-container">
    <!-- 上传按钮区域 -->
    <div class="upload-btn-wrapper">
      <label class="upload-btn" :disabled="field.disabled || modelValue?.length >= field.maxCount || linkLoading">
        <input
          type="file"
          :accept="field.accept.join(',')"
          :multiple="field.maxCount > 1"
          @change="handleFileChange($event.target.files)"
          style="display: none;"
        >
        <span class="btn">{{ field.buttonText }}</span>
        <span class="upload-tip">{{ field.placeholder }}</span>
      </label>

      <!-- 上传示例图 -->
      <div v-if="field.uploadExampleImage && modelValue?.length === 0" class="upload-example-container">
        <img
          :src="field.uploadExampleImage"
          :style="{
            width: '80px',
            height: '80px',
            objectFit: 'cover',
            border: '1px dashed #dcdcdc',
            borderRadius: '4px',
            ...field.exampleImageStyle
          }"
          :class="field.exampleImageClass"
          alt="上传示例图"
          class="upload-example-image"
          @click="$emit('example-image-click')"
        >
        <p class="upload-example-tip">{{ field.uploadExampleTip || '示例效果' }}</p>
      </div>
    </div>

    <!-- 已上传文件列表 -->
    <div v-if="modelValue && modelValue.length > 0" class="upload-list">
      <div
        v-for="(file, idx) in modelValue"
        :key="`${field.id}-file-${idx}`"
        class="upload-item"
      >
        <!-- 图片预览 -->
        <div v-if="field.type === 'image' && field.showPreview" class="image-preview">
          <img :src="file.preview || file.url" alt="预览图" @click="previewExampleImage(file.preview || file.url)">
        </div>

        <!-- 文件信息 -->
        <div class="file-info">
          <div class="file-name">{{ file.name }}</div>
          <div class="file-size">{{ UploadUtils.formatFileSize(file.size) }}</div>
          <div v-if="file.status === 'uploading'" class="file-status">上传中...</div>
          <div v-if="file.status === 'error'" class="file-status error">上传失败</div>
        </div>

        <!-- 操作按钮 -->
        <div class="file-actions">
          <button
            type="button"
            class="btn-delete"
            @click="handleFileRemove(idx)"
            :disabled="file.status === 'uploading' || field.disabled"
          >
            删除
          </button>
          <button
            type="button"
            class="btn-retry"
            v-if="file.status === 'error'"
            @click="handleFileRetry(file, idx)"
            :disabled="field.disabled"
          >
            重试
          </button>
        </div>
      </div>
    </div>

    <!-- 错误提示 -->
    <div v-if="error" class="error-message">
      {{ error }}
    </div>
  </div>
</template>

<script>
import { UploadUtils } from '../../utils/form-upload-utils'

export default {
  name: 'FormUpload',
  props: {
    field: {
      type: Object,
      required: true
    },
    modelValue: {
      type: Array,
      default: () => []
    },
    error: {
      type: String,
      default: ''
    },
    linkLoading: {
      type: Boolean,
      default: false
    }
  },
  emits: ['update:modelValue', 'error-change', 'example-image-click'],
  data() {
    return {
      UploadUtils,
      uploadTasks: {}
    }
  },
  methods: {
    async handleFileChange(files) {
      if (!files || files.length === 0) return
      const selectedFiles = Array.from(files)
      const currentFiles = this.modelValue || []
      const newFiles = [...currentFiles]

      // 校验最大数量
      if (newFiles.length + selectedFiles.length > this.field.maxCount) {
        this.$emit('error-change', `最多可上传${this.field.maxCount}个文件`)
        return
      }

      for (const file of selectedFiles) {
        // 格式校验
        if (!UploadUtils.validateFileFormat(file, this.field.accept)) {
          this.$emit('error-change', `不支持的文件格式，请选择${this.field.accept.join('、')}格式`)
          continue
        }

        // 大小校验
        if (!UploadUtils.validateFileSize(file, this.field.maxSize)) {
          this.$emit('error-change', `文件大小不能超过${this.field.maxSize}MB`)
          continue
        }

        // 清除错误
        this.$emit('error-change', '')

        // 构建文件临时信息
        const fileItem = {
          id: `${this.field.key}-file-${Date.now()}-${Math.random().toString(36).slice(-6)}`,
          name: file.name,
          size: file.size,
          type: file.type,
          status: 'uploading',
          preview: '',
          url: '',
          file: file
        }

        // 图片预览
        if (this.field.type === 'image' && this.field.showPreview) {
          try {
            fileItem.preview = await UploadUtils.fileToBase64(file)
          } catch (error) {
            console.warn('图片预览失败', error)
          }
        }

        // 添加到列表
        newFiles.push(fileItem)
        this.$emit('update:modelValue', newFiles)

        // 上传文件
        await this.uploadFileItem(fileItem, newFiles.length - 1)
      }
    },

    async uploadFileItem(fileItem, index) {
      if (!this.field.uploadApi) {
        fileItem.status = 'error'
        this.$emit('error-change', '未配置上传接口')
        return
      }

      try {
        const uploadResult = await UploadUtils.uploadFile(
          fileItem.file,
          this.field.uploadApi,
          this.field.uploadConfig
        )

        // 上传成功
        fileItem.status = 'success'
        fileItem.url = uploadResult.url || uploadResult.fileId
        fileItem.preview = fileItem.preview || uploadResult.url
        delete fileItem.file

        const files = [...this.modelValue]
        files[index] = fileItem
        this.$emit('update:modelValue', files)
      } catch (error) {
        fileItem.status = 'error'
        this.$emit('error-change', error.message || '文件上传失败')
      }
    },

    handleFileRemove(index) {
      const files = [...this.modelValue]
      files.splice(index, 1)
      this.$emit('update:modelValue', files)
      this.$emit('error-change', '')
    },

    async handleFileRetry(fileItem, index) {
      if (!fileItem.file) return
      fileItem.status = 'uploading'
      this.$emit('error-change', '')

      const files = [...this.modelValue]
      files[index] = fileItem
      this.$emit('update:modelValue', files)

      await this.uploadFileItem(fileItem, index)
    },

    previewExampleImage(imageUrl) {
      const previewContainer = document.createElement('div')
      previewContainer.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: rgba(0,0,0,0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 9999;
        cursor: zoom-out;
      `
      const previewImg = document.createElement('img')
      previewImg.src = imageUrl
      previewImg.style.cssText = `
        max-width: 90vw;
        max-height: 90vh;
        border-radius: 8px;
      `
      previewContainer.appendChild(previewImg)
      document.body.appendChild(previewContainer)
      previewContainer.addEventListener('click', () => {
        document.body.removeChild(previewContainer)
      })
    }
  }
}
</script>

<style scoped>
.upload-container {
  width: 100%;
}

.upload-btn-wrapper {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 12px;
}

.upload-btn {
  display: inline-flex;
  align-items: center;
  cursor: pointer;
}

.upload-btn .btn {
  padding: 8px 16px;
  background-color: #409eff;
  color: white;
  border-radius: 8px;
  font-size: 14px;
  margin-right: 8px;
}

.upload-tip {
  font-size: 12px;
  color: #666;
}

.upload-btn:disabled .btn {
  background-color: #c0ccda;
  cursor: not-allowed;
}

/* 上传示例图容器 */
.upload-example-container {
  text-align: center;
}

.upload-example-image {
  cursor: pointer;
  transition: all 0.3s;
}

.upload-example-image:hover {
  border-color: #409eff;
  box-shadow: 0 0 0 2px rgba(64, 158, 255, 0.2);
}

.upload-example-tip {
  margin-top: 4px;
  font-size: 12px;
  color: #666;
}

/* 已上传文件列表 */
.upload-list {
  margin-top: 12px;
}

.upload-item {
  display: flex;
  align-items: center;
  padding: 8px;
  background-color: #fafafa;
  border-radius: 8px;
  margin-bottom: 8px;
}

.image-preview {
  width: 40px;
  height: 40px;
  border-radius: 4px;
  overflow: hidden;
  margin-right: 12px;
}

.image-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  cursor: pointer;
}

.file-info {
  flex: 1;
  font-size: 12px;
}

.file-name {
  color: #333;
  margin-bottom: 4px;
}

.file-size {
  color: #999;
}

.file-status {
  margin-top: 4px;
  font-size: 12px;
}

.file-status.error {
  color: #ff4d4f;
}

.file-actions {
  display: flex;
  gap: 8px;
}

.btn-delete,
.btn-retry {
  padding: 4px 8px;
  border: none;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
}

.btn-delete {
  background-color: #f5f5f5;
  color: #666;
}

.btn-retry {
  background-color: #fff1f0;
  color: #ff4d4f;
}

.btn-delete:disabled {
  background-color: #fafafa;
  color: #ccc;
  cursor: not-allowed;
}

.error-message {
  margin-top: 4px;
  font-size: 12px;
  color: #ff4d4f;
}

/* 响应式适配 */
@media (max-width: 768px) {
  .upload-btn-wrapper {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
}
</style>