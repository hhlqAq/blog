const data = {
  "code": 200,
  "message": "表单配置加载成功",
  "data": {
    "fields": [
      // ======================================
      // 1. 基础文本类（含 showRule 基础显隐）
      // ======================================
      {
        "key": "userName",
        "type": "text",
        "label": "用户名",
        "required": true,
        "minLength": 2,
        "maxLength": 10,
        "placeholder": "请输入2-10位用户名（支持中英文）",
        "exampleImage": "https://picsum.photos/id/101/80/30",
        "exampleImageStyle": { "width": "60px", "marginLeft": "8px", "verticalAlign": "middle" },
        "customStyle": { "marginBottom": "16px" },
        "validator": "!/^\\d+$/.test(value)",
        "validatorMessage": "用户名不能全为数字"
      },
      {
        "key": "mobile",
        "type": "text",
        "label": "手机号",
        "required": true,
        "pattern": "MOBILE",
        "patternMessage": "请输入11位有效手机号",
        "maxlength": 11,
        "placeholder": "请输入手机号",
        "linkRules": [
          {
            "triggerKey": "mobile",
            "targetKey": "inviteCode",
            "type": "setValue",
            "condition": "value.length === 11 && FORM_REGEX.MOBILE.test(value)",
            "value": "formModel.mobile.slice(0,3) + '****'",
            "triggerOnInit": false
          }
        ]
      },
      {
        "key": "email",
        "type": "text",
        "label": "电子邮箱",
        "required": false,
        "pattern": "/^[a-zA-Z0-9_-]+@[a-zA-Z0-9_-]+(\\.[a-zA-Z0-9_-]+)+$/",
        "patternMessage": "邮箱格式不正确（示例：xxx@xxx.com）",
        "placeholder": "选填，用于接收通知",
        "showRule": "formModel.userName.length > 3", // showRule：用户名长度>3时显示
        "customStyle": { "marginTop": "16px" }
      },
      {
        "key": "password",
        "type": "password",
        "label": "登录密码",
        "required": true,
        "pattern": "PASSWORD",
        "patternMessage": "密码需包含大小写字母和数字，长度8-16位",
        "minLength": 8,
        "maxLength": 16,
        "placeholder": "请设置密码"
      },
      {
        "key": "confirmPassword",
        "type": "password",
        "label": "确认密码",
        "required": true,
        "placeholder": "请再次输入密码",
        "validator": "value === formModel.password",
        "validatorMessage": "两次输入的密码不一致",
        "showRule": "formModel.password.length >= 8", // showRule：密码输入满足长度时显示
        "customStyle": { "marginTop": "16px" }
      },

      // ======================================
      // 2. 选择类（showRule + linkRules 协同）
      // ======================================
      {
        "key": "gender",
        "type": "radio",
        "label": "性别",
        "required": true,
        "options": [
          { "label": "男", "value": "male" },
          { "label": "女", "value": "female" },
          { "label": "保密", "value": "secret" }
        ],
        "defaultValue": "secret",
        "customClass": "gender-radio-group"
      },
      {
        "key": "city",
        "type": "select",
        "label": "所在城市",
        "required": true,
        "placeholder": "请选择城市",
        "options": [
          { "label": "北京", "value": "110000" },
          { "label": "上海", "value": "310000" },
          { "label": "广州", "value": "440100" },
          { "label": "深圳", "value": "440300" },
          { "label": "杭州", "value": "330100" },
          { "label": "其他城市", "value": "other" }
        ],
        "linkRules": [
          {
            "triggerKey": "city",
            "targetKey": "hasResidencePermit",
            "type": "show",
            "condition": "value === '440100' || value === '440300'",
            "triggerOnInit": true
          },
          {
            "triggerKey": "city",
            "targetKey": "hasResidencePermit",
            "type": "hide",
            "condition": "value !== '440100' && value !== '440300'",
            "triggerOnInit": true
          },
          {
            "triggerKey": "city",
            "targetKey": "industry",
            "type": "request",
            "targetType": "select",
            "condition": "value === '110000' || value === '310000'",
            "debounce": 300,
            "loadingText": "获取行业数据中...",
            "requestConfig": {
              "api": "/api/common/industry-list",
              "params": { "cityCode": "value", "type": "first-tier" },
              "responseKey": "data"
            },
            "triggerOnInit": true
          },
          {
            "triggerKey": "city",
            "targetKey": "industry",
            "type": "setOptions",
            "condition": "value === 'other'",
            "options": [
              { "label": "制造业", "value": "manufacture" },
              { "label": "农业", "value": "agriculture" },
              { "label": "服务业", "value": "service" }
            ],
            "triggerOnInit": true
          },
          {
            "triggerKey": "city",
            "targetKey": "industry",
            "type": "setValidate",
            "condition": "value === '330100'",
            "validate": {
              "required": false,
              "patternMessage": "行业选择格式错误"
            },
            "triggerOnInit": true
          }
        ]
      },
      {
        "key": "hobbies",
        "type": "checkbox",
        "label": "兴趣爱好",
        "required": false,
        "options": ["篮球", "读书", "旅游", "编程", "音乐", "摄影"],
        "validator": "value.length <= 3",
        "validatorMessage": "最多选择3个兴趣爱好",
        "controlStyle": { "flexWrap": "wrap", "gap": "12px" },
        "showRule": "formModel.gender !== 'secret'", // showRule：性别不保密时显示
        "customStyle": { "marginTop": "16px" }
      },
      {
        "key": "industry",
        "type": "select",
        "label": "所属行业",
        "required": true,
        "placeholder": "请选择行业",
        "options": [],
        "linkRules": [
          {
            "triggerKey": "industry",
            "targetKey": "internetSkills",
            "type": "show",
            "condition": "value === 'internet' || value === 'it'",
            "triggerOnInit": true
          }
        ]
      },
      {
        "key": "internetSkills",
        "type": "checkbox",
        "label": "互联网技能",
        "required": false,
        "hidden": false, // 初始不隐藏，通过 showRule 控制
        "showRule": "formModel.industry === 'internet' || formModel.industry === 'it'", // 与 linkRules 协同
        "options": [
          { "label": "前端开发", "value": "frontend" },
          { "label": "后端开发", "value": "backend" },
          { "label": "产品经理", "value": "product" },
          { "label": "UI设计", "value": "ui" }
        ],
        "validator": "value.length > 0",
        "validatorMessage": "选择互联网行业需至少勾选1项技能"
      },

      // ======================================
      // 3. 开关+文本域（showRule 复杂条件）
      // ======================================
      {
        "key": "hasResidencePermit",
        "type": "switch",
        "label": "是否有居住证",
        "required": false,
        "switchText": "有/无",
        "hidden": false, // 初始不隐藏，通过 showRule + linkRules 双重控制
        "showRule": "formModel.city === '440100' || formModel.city === '440300'", // 基础显隐
        "linkRules": [
          {
            "triggerKey": "hasResidencePermit",
            "targetKey": "residencePermitNo",
            "type": "show",
            "condition": "value === true",
            "triggerOnInit": true
          },
          {
            "triggerKey": "hasResidencePermit",
            "targetKey": "residencePermitNo",
            "type": "hide",
            "condition": "value === false",
            "triggerOnInit": true
          }
        ]
      },
      {
        "key": "residencePermitNo",
        "type": "text",
        "label": "居住证编号",
        "required": true,
        "hidden": false,
        "showRule": "formModel.hasResidencePermit === true && (formModel.city === '440100' || formModel.city === '440300')", // 多条件组合
        "pattern": "/^[A-Za-z0-9]{10,15}$/",
        "patternMessage": "居住证编号为10-15位字母/数字组合",
        "placeholder": "请输入居住证编号"
      },
      {
        "key": "intro",
        "type": "textarea",
        "label": "个人简介",
        "required": false,
        "rows": 4,
        "maxLength": 200,
        "placeholder": "请简要介绍自己（最多200字）",
        "controlStyle": { "width": "100%", "marginTop": "8px" },
        "exampleImage": "https://picsum.photos/id/108/200/60",
        "exampleImageStyle": { "width": "100%", "marginTop": "8px", "borderRadius": "4px" },
        "exampleImageClass": "intro-example-img",
        "showRule": "formModel.hobbies && formModel.hobbies.length > 0", // 依赖数组字段
        "customStyle": { "marginTop": "16px" }
      },

      // ======================================
      // 4. 上传类（showRule 依赖选择类字段）
      // ======================================
      {
        "key": "avatar",
        "type": "image",
        "label": "个人头像",
        "required": true,
        "accept": ["image/jpg", "image/png", "image/jpeg"],
        "maxSize": 2,
        "maxCount": 1,
        "buttonText": "上传头像",
        "uploadApi": "/api/upload/image",
        "uploadConfig": {
          "fileKey": "avatarFile",
          "headers": { "Authorization": "Bearer {{token}}" },
          "data": { "bizType": "user_avatar", "sizeLimit": 2 }
        },
        "uploadExampleImage": "https://picsum.photos/id/64/80/80",
        "uploadExampleTip": "建议尺寸1:1，大小不超过2MB",
        "showPreview": true,
        "placeholder": "支持JPG/PNG格式，最大2MB"
      },
      {
        "key": "resume",
        "type": "file",
        "label": "简历上传",
        "required": false,
        "accept": [".pdf", ".doc", ".docx"],
        "maxSize": 10,
        "maxCount": 1,
        "buttonText": "上传简历",
        "uploadApi": "/api/upload/file",
        "uploadConfig": {
          "fileKey": "resumeFile",
          "headers": { "Authorization": "Bearer {{token}}" },
          "data": { "bizType": "user_resume" }
        },
        "placeholder": "支持PDF/Word格式，最大10MB",
        "validator": "value.length > 0 ? value[0].status === 'success' : true",
        "validatorMessage": "简历上传失败，请重试",
        "showRule": "formModel.isStudent === false && formModel.workYears !== 'less1'", // 多条件组合（非学生+工作年限≥1年）
        "customStyle": { "marginTop": "16px" }
      },
      {
        "key": "certificates",
        "type": "image",
        "label": "资质证书",
        "required": false,
        "accept": ["image/*"],
        "maxSize": 5,
        "maxCount": 3,
        "buttonText": "上传证书（最多3张）",
        "uploadApi": "/api/upload/image",
        "uploadConfig": { "fileKey": "certFile", "bizType": "certificate" },
        "showPreview": true,
        "placeholder": "支持所有图片格式，单张不超过5MB",
        "showRule": "formModel.industry === 'finance' || formModel.industry === 'education'", // 特定行业显示
        "customStyle": { "marginTop": "16px" }
      },

      // ======================================
      // 5. 隐藏域+动态赋值
      // ======================================
      {
        "key": "source",
        "type": "hidden",
        "defaultValue": "form_web"
      },
      {
        "key": "submitTime",
        "type": "hidden",
        "linkRules": [
          {
            "triggerKey": "__submit__",
            "targetKey": "submitTime",
            "type": "setValue",
            "value": "Date.now()"
          }
        ]
      },
      {
        "key": "inviteCode",
        "type": "text",
        "label": "邀请码",
        "required": false,
        "placeholder": "选填，输入邀请码",
        "validator": "value === '' || (value.startsWith(formModel.mobile.slice(0,3)) && value.length === 7)",
        "validatorMessage": "邀请码需以手机号前3位开头，共7位",
        "showRule": "formModel.mobile.length === 11", // 手机号填写完整时显示
        "customStyle": { "marginTop": "16px" }
      },

      // ======================================
      // 6. 复杂联动（showRule + linkRules 嵌套）
      // ======================================
      {
        "key": "isStudent",
        "type": "switch",
        "label": "是否为在校学生",
        "required": false,
        "switchText": "是/否",
        "linkRules": [
          {
            "triggerKey": "isStudent",
            "targetKey": "school",
            "type": "show",
            "condition": "value === true",
            "triggerOnInit": true
          },
          {
            "triggerKey": "isStudent",
            "targetKey": "education",
            "type": "show",
            "condition": "value === true",
            "triggerOnInit": true
          },
          {
            "triggerKey": "isStudent",
            "targetKey": "workYears",
            "type": "hide",
            "condition": "value === true",
            "triggerOnInit": true
          },
          {
            "triggerKey": "isStudent",
            "targetKey": "school",
            "type": "hide",
            "condition": "value === false",
            "triggerOnInit": true
          },
          {
            "triggerKey": "isStudent",
            "targetKey": "education",
            "type": "hide",
            "condition": "value === false",
            "triggerOnInit": true
          },
          {
            "triggerKey": "isStudent",
            "targetKey": "workYears",
            "type": "show",
            "condition": "value === false",
            "triggerOnInit": true
          }
        ]
      },
      {
        "key": "school",
        "type": "text",
        "label": "学校名称",
        "required": true,
        "hidden": false,
        "showRule": "formModel.isStudent === true", // 与 linkRules 一致，双重保障
        "placeholder": "请输入学校名称"
      },
      {
        "key": "education",
        "type": "select",
        "label": "学历",
        "required": true,
        "hidden": false,
        "showRule": "formModel.isStudent === true",
        "placeholder": "请选择学历",
        "options": [
          { "label": "专科", "value": "college" },
          { "label": "本科", "value": "undergraduate" },
          { "label": "硕士", "value": "master" },
          { "label": "博士", "value": "doctor" }
        ]
      },
      {
        "key": "workYears",
        "type": "select",
        "label": "工作年限",
        "required": true,
        "hidden": false,
        "showRule": "formModel.isStudent === false",
        "placeholder": "请选择工作年限",
        "options": [
          { "label": "1年以内", "value": "less1" },
          { "label": "1-3年", "value": "1-3" },
          { "label": "3-5年", "value": "3-5" },
          { "label": "5年以上", "value": "more5" }
        ],
        "linkRules": [
          {
            "triggerKey": "workYears",
            "targetKey": "expertise",
            "type": "show",
            "condition": "value === 'more5'",
            "triggerOnInit": true
          }
        ]
      },
      {
        "key": "expertise",
        "type": "text",
        "label": "擅长领域",
        "required": true,
        "hidden": false,
        "showRule": "formModel.workYears === 'more5' && formModel.isStudent === false", // 嵌套条件
        "placeholder": "请输入你的擅长领域（多个用逗号分隔）"
      }
    ]
  }
}