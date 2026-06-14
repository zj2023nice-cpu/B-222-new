import Toast from "tdesign-miniprogram/toast/index";

Component({
  options: {
    addGlobalClass: true,
    styleIsolation: "apply-shared",
  },

  properties: {
    // 初始数据，由父页面传入
    initialData: {
      type: Object,
      value: {},
      observer: function (newVal) {
        if (newVal && Object.keys(newVal).length > 0) {
          this.setData({
            userInfo: { ...this.data.userInfo, ...newVal },
          });
        }
      },
    },
    // 被编辑用户的角色：'student' 或 'consultant'
    userRole: {
      type: String,
      value: "student",
    },
    // 按钮文字，管理员编辑时可能叫“确认修改”，用户自己编辑叫“保存资料”
    submitBtnText: {
      type: String,
      value: "保存资料",
    },
    // 外部控制的保存中状态
    isSaving: {
      type: Boolean,
      value: false,
    },
  },

  data: {
    userInfo: {
      name: "",
      title: "",
      introduction: "",
      expertise: "",
      avatar: "",
    },
    titleVisible: false,
    titleOptions: [
      { label: "初级心理咨询师", value: "初级心理咨询师" },
      { label: "中级心理咨询师", value: "中级心理咨询师" },
      { label: "高级心理咨询师", value: "高级心理咨询师" },
      { label: "专家心理咨询师", value: "专家心理咨询师" },
    ],
    expertiseVisible: false,
    expertiseOptions: [
      { label: "压力管理", value: "压力管理" },
      { label: "人际关系", value: "人际关系" },
      { label: "自我成长", value: "自我成长" },
      { label: "情绪调节", value: "情绪调节" },
      { label: "职场心理", value: "职场心理" },
      { label: "学业压力", value: "学业压力" },
      { label: "原生家庭", value: "原生家庭" },
      { label: "恋爱婚姻", value: "恋爱婚姻" },
    ],
    tempExpertise: [],
  },

  lifetimes: {
    attached() {
      // 这里的 attached 确保初次加载时如果有数据也能同步
      if (
        this.properties.initialData &&
        Object.keys(this.properties.initialData).length > 0
      ) {
        this.setData({
          userInfo: { ...this.data.userInfo, ...this.properties.initialData },
        });
      }
    },
  },

  methods: {
    // 处理所有输入框变更
    onInputChange(e) {
      const { field } = e.currentTarget.dataset;
      const { value } = e.detail;
      this.setData({
        [`userInfo.${field}`]: value,
      });
    },

    // 弹出层切换
    togglePicker(e) {
      const { type } = e.currentTarget.dataset;
      if (type === "title") {
        this.setData({ titleVisible: !this.data.titleVisible });
      } else if (type === "expertise") {
        const isOpening = !this.data.expertiseVisible;
        if (isOpening) {
          const currentExp = this.data.userInfo.expertise;
          this.setData({
            tempExpertise: currentExp ? currentExp.split("、") : [],
          });
        }
        this.setData({ expertiseVisible: !this.data.expertiseVisible });
      }
    },

    // 职称选择确认
    onPickerConfirm(e) {
      const { value } = e.detail;
      this.setData({
        "userInfo.title": value[0],
        titleVisible: false,
      });
    },

    // 擅长领域多选变更
    onExpertiseChange(e) {
      this.setData({
        tempExpertise: e.detail.value,
      });
    },

    // 擅长领域确认
    onExpertiseConfirm() {
      this.setData({
        "userInfo.expertise": this.data.tempExpertise.join("、"),
        expertiseVisible: false,
      });
    },

    // 头像加载失败的处理
    onAvatarError(e) {
      console.warn("头像加载失败，切换回默认 Icon:", e);
      this.setData({
        "userInfo.avatar": "",
      });
    },

    // 点击更换头像
    onChangeAvatar() {
      wx.chooseMedia({
        count: 1,
        mediaType: ["image"],
        sourceType: ["album", "camera"],
        success: (res) => {
          this.uploadAvatar(res.tempFiles[0].tempFilePath);
        },
      });
    },

    // 上传头像到云存储
    async uploadAvatar(filePath) {
      wx.showLoading({ title: "上传中..." });
      try {
        const suffix = filePath.match(/\.[^.]+$/)?.[0] || ".png";
        const cloudPath = `avatars/${this.data.userRole}_${Date.now()}${suffix}`;
        const res = await wx.cloud.uploadFile({
          cloudPath,
          filePath,
        });

        this.setData({ "userInfo.avatar": res.fileID });

        Toast({
          context: this,
          selector: "#t-toast",
          message: "上传成功",
          theme: "success",
          direction: "column",
        });
      } catch (err) {
        console.error("Upload error", err);
        Toast({
          context: this,
          selector: "#t-toast",
          message: "上传失败",
          theme: "error",
          direction: "column",
        });
      } finally {
        wx.hideLoading();
      }
    },

    // 核心更改：点击保存，发射事件
    saveProfile() {
      const { userInfo } = this.data;
      if (!userInfo.name) {
        Toast({
          context: this,
          selector: "#t-toast",
          message: "姓名不能为空",
          theme: "warning",
          direction: "column",
        });
        return;
      }

      // 规范化校验：如果头像还是 https 链接，提醒用户重新上传
      if (userInfo.avatar && userInfo.avatar.startsWith("http")) {
        console.warn(
          "检测到非规范的 http 头像链接，建议重新上传以获取永久 File ID",
        );
      }

      // 告诉父页面：我已经准备好最新的规范数据了，剩下的交给你
      this.triggerEvent("save", userInfo);
    },
  },
});
