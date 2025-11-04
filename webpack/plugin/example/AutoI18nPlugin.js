const fs = require('fs');
const path = require('path');
const { parse } = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const generator = require('@babel/generator').default;
const t = require('@babel/types');

/**
 * 自动国际化 Webpack 插件
 * 作用：提取中文生成多语言配置，替换源码为国际化函数调用
 */
class AutoI18nPlugin {
  /**
   * 构造函数：初始化配置
   * @param {Object} options 配置项
   * @param {string} options.srcDir 源码目录（默认 src）
   * @param {string} options.localeDir 语言文件输出目录（默认 src/locales）
   * @param {Array} options.locales 需要生成的语言（默认 ['zh-CN', 'en']）
   * @param {string} options.functionName 国际化函数名（默认 '$t'）
   * @param {RegExp} options.include 需要处理的文件正则（默认 /\.(vue|js|jsx)$/）
   */
  constructor(options = {}) {
    // 默认配置
    this.options = {
      srcDir: options.srcDir || 'src',
      localeDir: options.localeDir || 'src/locales',
      locales: options.locales || ['zh-CN', 'en'],
      functionName: options.functionName || '$t',
      include: options.include || /\.(vue|js|jsx)$/,
    };

    // 存储已提取的中文键值对（key: 中文, value: 国际化键名）
    this.i18nMap = {};
    // 初始化语言文件
    this.initLocaleFiles();
  }

  /**
   * 初始化语言文件（如果不存在则创建）
   */
  initLocaleFiles() {
    // 创建语言文件目录
    if (!fs.existsSync(this.options.localeDir)) {
      fs.mkdirSync(this.options.localeDir, { recursive: true });
    }

    // 为每种语言初始化文件
    this.options.locales.forEach(locale => {
      const filePath = path.join(this.options.localeDir, `${locale}.json`);
      if (!fs.existsSync(filePath)) {
        // 初始化为空对象
        fs.writeFileSync(filePath, '{}', 'utf8');
      } else {
        // 读取已有内容，恢复 i18nMap
        const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        // 仅用中文作为 key（zh-CN 是基准语言）
        if (locale === 'zh-CN') {
          this.i18nMap = Object.fromEntries(
            Object.entries(content).map(([key, value]) => [value, key])
          );
        }
      }
    });
  }

  /**
   * 生成唯一键名（基于中文哈希）
   * @param {string} chinese 中文文本
   * @returns {string} 键名（如 i18n_123456）
   */
  generateKey(chinese) {
    // 简单哈希算法，避免键名过长
    let hash = 0;
    for (let i = 0; i < chinese.length; i++) {
      const charCode = chinese.charCodeAt(i);
      hash = ((hash << 5) - hash) + charCode;
      hash = hash & hash; // 转换为 32 位整数
    }
    return `i18n_${Math.abs(hash)}`;
  }

  /**
   * 更新语言文件（新增中文）
   * @param {string} chinese 中文文本
   */
  updateLocaleFiles(chinese) {
    // 如果已存在，不重复处理
    if (this.i18nMap[chinese]) return;

    // 生成新键名
    const key = this.generateKey(chinese);
    this.i18nMap[chinese] = key;

    // 更新所有语言文件
    this.options.locales.forEach(locale => {
      const filePath = path.join(this.options.localeDir, `${locale}.json`);
      const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));

      // 中文文件直接用原文，其他语言用占位符（需手动翻译）
      content[key] = locale === 'zh-CN' ? chinese : `[需要翻译] ${chinese}`;

      // 写入文件（格式化 JSON）
      fs.writeFileSync(filePath, JSON.stringify(content, null, 2), 'utf8');
    });
  }

  /**
   * 处理单个文件：提取中文并替换为国际化函数
   * @param {string} code 源码
   * @param {string} filePath 文件路径
   * @returns {string} 处理后的代码
   */
  processFile(code, filePath) {
    // 过滤不需要处理的文件
    if (!this.options.include.test(filePath)) return code;

    try {
      // 解析代码为 AST（支持 JSX 和 Vue 单文件中的脚本）
      const ast = parse(code, {
        sourceType: 'module',
        plugins: ['jsx', 'vue'] // 支持 JSX 和 Vue 语法
      });

      // 遍历 AST，寻找中文字符串
      traverse(ast, {
        StringLiteral(path) {
          const { value } = path.node;
          // 判断是否为中文（包含中文字符）
          if (/[\u4e00-\u9fa5]/.test(value)) {
            // 提取中文并更新语言文件
            this.updateLocaleFiles(value);
            // 替换为国际化函数调用（如 $t('i18n_123')）
            path.replaceWith(
              t.callExpression(
                t.identifier(this.options.functionName), // 函数名：$t
                [t.stringLiteral(this.i18nMap[value])] // 参数：键名
              )
            );
          }
        }
      });

      // 从 AST 生成处理后的代码
      return generator(ast).code;
    } catch (err) {
      console.warn(`处理文件 ${filePath} 出错：`, err.message);
      return code; // 出错时返回原代码，避免构建失败
    }
  }

  /**
   * 递归遍历目录，处理所有文件
   * @param {string} dir 目录路径
   */
  processDir(dir) {
    const files = fs.readdirSync(dir);
    files.forEach(file => {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);

      if (stat.isDirectory()) {
        this.processDir(filePath); // 递归处理子目录
      } else {
        // 处理文件
        const code = fs.readFileSync(filePath, 'utf8');
        const processedCode = this.processFile(code, filePath);
        // 写回处理后的代码
        if (processedCode !== code) {
          fs.writeFileSync(filePath, processedCode, 'utf8');
          console.log(`已处理：${filePath}`);
        }
      }
    });
  }

  /**
   * 插件入口：注册 Webpack 钩子
   * @param {Compiler} compiler Webpack 编译器实例
   */
  apply(compiler) {
    // 在编译开始前执行（beforeRun 钩子）
    compiler.hooks.beforeRun.tap('AutoI18nPlugin', () => {
      console.log('开始自动提取中文并生成国际化配置...');
      this.processDir(this.options.srcDir);
      console.log('国际化处理完成！语言文件已生成在：', this.options.localeDir);
    });
  }
}

module.exports = AutoI18nPlugin;