import Toast from "tdesign-miniprogram/toast/index";
import articleService from "../../../services/article";

Page({
  options: {
    addGlobalClass: true,
    styleIsolation: "shared",
  },
  data: {
    isEdit: false,
    articleId: "",
    article: {
      title: "",
      title: "",
      cover: "", // Can be cloud://... or temporary local path
      desc: "",
      desc: "",
      content: "",
      category: "心理科普",
    },
    categories: [
      { label: "心理科普", value: "心理科普" },
      { label: "情绪疗愈", value: "情绪疗愈" },
      { label: "人际交流", value: "人际交流" },
      { label: "专业视角", value: "专业视角" },
      { label: "自我成长", value: "自我成长" },
    ],
    pickerVisible: false,
    isSaving: false,
    isLoading: true,
  },

  onLoad(options) {
    const { id } = options;
    if (id) {
      this.setData({
        isEdit: true,
        articleId: id,
      });
      this.loadArticleDetail(id);
    } else {
      this.setData({ isLoading: false });
    }
  },

  async loadArticleDetail(id) {
    try {
      const res = await articleService.getDetail(id);
      if (res.code === 0) {
        const article = res.data;
        // Compute initial validity immediately to avoid UI flicker
        const initialValidity = !!(
          article.cover &&
          article.title &&
          article.title.trim() &&
          article.category &&
          article.content &&
          article.content.trim()
        );

        this.setData({
          article: article,
          isLoading: false,
          isImageLoaded: false,
          isFormValid: initialValidity,
        });
      }
    } catch (err) {
      console.error("Load article detail error", err);
      Toast({
        context: this,
        selector: "#t-toast",
        message: "获取详情失败",
        theme: "error",
        direction: "column",
      });
    } finally {
      wx.hideLoading();
    }
  },

  onBack() {
    wx.navigateBack();
  },

  onInputChange(e) {
    const { field } = e.currentTarget.dataset;
    const { value } = e.detail;
    this.setData(
      {
        [`article.${field}`]: value,
      },
      () => {
        this.checkFormValidity();
      },
    );
  },

  onShowPicker() {
    this.setData({ pickerVisible: true });
  },

  onHidePicker() {
    this.setData({ pickerVisible: false });
  },

  onPickerConfirm(e) {
    const { label } = e.detail;
    this.setData(
      {
        "article.category": label[0],
        pickerVisible: false,
      },
      () => {
        this.checkFormValidity();
      },
    );
  },

  async onUploadCover() {
    try {
      const res = await wx.chooseImage({
        count: 1,
        sizeType: ["compressed"],
        sourceType: ["album", "camera"],
      });

      const filePath = res.tempFilePaths[0];
      // Just handle local file display, do NOT upload yet
      this.handleLocalFile(filePath);
    } catch (err) {
      console.error("Choose image error", err);
    }
  },

  handleLocalFile(filePath) {
    this.setData(
      {
        "article.cover": filePath,
        isImageLoaded: true, // Local files load instantly
        coverFiles: [{ url: filePath }], // Keep for consistency if needed, though wxml might not use it
      },
      () => {
        this.checkFormValidity();
      },
    );
  },

  async uploadToCloud(filePath) {
    const suffix = filePath.match(/\.[^.]+$/)?.[0] || ".png";
    const cloudPath = `articles/cover_${Date.now()}${suffix}`;

    const res = await wx.cloud.uploadFile({
      cloudPath,
      filePath,
    });
    return res.fileID;
  },

  onCoverRemove(e) {
    // If coming from view tap, e might prevent bubble, but here we probably just clear data
    // If using re-upload tag which might bubble to onUploadCover, we need to be careful.
    // Actually the UI has "更换图片" which triggers onUploadCover.
    // We don't have an explicit remove button in the custom UI, just "replace".
    // But keeping this method for safety or if we add a delete button later.
    this.setData(
      {
        "article.cover": "",
        coverFiles: [],
        isLoading: true, // Maybe not set loading to true? kept from previous code
        isImageLoaded: false,
        isFormValid: false,
      },
      () => {
        this.checkFormValidity();
      },
    );
  },

  onImageLoad(e) {
    this.setData({ isImageLoaded: true });
  },

  async onSave() {
    const { article, isEdit, articleId } = this.data;

    // 校验
    if (!article.cover) {
      Toast({
        context: this,
        selector: "#t-toast",
        message: "请上传封面图",
        theme: "warning",
        direction: "column",
      });
      return;
    }
    if (!article.title.trim()) {
      Toast({
        context: this,
        selector: "#t-toast",
        message: "标题不能为空",
        theme: "warning",
        direction: "column",
      });
      return;
    }
    if (!article.content.trim()) {
      Toast({
        context: this,
        selector: "#t-toast",
        message: "内容不能为空",
        theme: "warning",
        direction: "column",
      });
      return;
    }

    this.setData({ isSaving: true });
    try {
      // Check if cover needs upload (is temporary path)
      let finalCover = article.cover;
      if (finalCover && !finalCover.startsWith("cloud://")) {
        try {
          finalCover = await this.uploadToCloud(finalCover);
          // Update data with real cloud ID so we don't upload again if save fails later
          this.setData({
            "article.cover": finalCover,
            coverFiles: [{ url: finalCover }],
          });
        } catch (uploadErr) {
          console.error("Upload cover failed", uploadErr);
          Toast({
            context: this,
            selector: "#t-toast",
            message: "图片上传失败",
            theme: "error",
            direction: "column",
          });
          this.setData({ isSaving: false });
          return;
        }
      }

      const articleData = { ...article, cover: finalCover };

      if (isEdit) {
        await articleService.adminUpdateArticle({
          ...articleData,
          _id: articleId,
        });
      } else {
        await articleService.adminCreateArticle(articleData);
      }

      Toast({
        context: this,
        selector: "#t-toast",
        message: isEdit ? "修改成功" : "发布成功",
        theme: "success",
        direction: "column",
      });

      // 通知列表页刷新数据
      const eventChannel = this.getOpenerEventChannel();
      if (eventChannel && typeof eventChannel.emit === "function") {
        eventChannel.emit("refreshList");
      }

      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
    } catch (err) {
      console.error("Save article error", err);
      Toast({
        context: this,
        selector: "#t-toast",
        message: err.message || "操作失败",
        theme: "error",
        direction: "column",
      });
    } finally {
      this.setData({ isSaving: false });
    }
  },
  checkFormValidity() {
    const { article } = this.data;
    const isValid = !!(
      article.cover &&
      article.title &&
      article.title.trim() &&
      article.category &&
      article.content &&
      article.content.trim()
    );
    if (this.data.isFormValid !== isValid) {
      this.setData({ isFormValid: isValid });
    }
  },
});
