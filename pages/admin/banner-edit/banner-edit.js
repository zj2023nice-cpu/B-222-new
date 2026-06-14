import Toast from "tdesign-miniprogram/toast/index";
import articleService from "../../../services/article";

Page({
  data: {
    isEdit: false,
    bannerId: "",
    banner: {
      imageUrl: "",
      title: "",
      content: "",
      order: 0,
      isActive: true,
    },
    gridConfig: {
      column: 1,
      width: 624,
      height: 380,
    },
    fileList: [],
    isFormValid: false,
    isSubmitting: false,
    isLoading: true,
    isImageLoaded: false,
  },

  onLoad(options) {
    const { id } = options;
    if (id) {
      this.setData({
        isEdit: true,
        bannerId: id,
      });
      this.loadBannerDetail(id);
    } else {
      this.setData({ isLoading: false });
      this.checkFormValidity();
    }
  },

  async loadBannerDetail(id) {
    try {
      const { data } = await articleService.adminGetBanners({});
      const banner = (data || []).find((b) => b._id === id);

      if (!banner) {
        Toast({
          context: this,
          selector: "#t-toast",
          message: "轮播图不存在",
          theme: "error",
          direction: "column",
        });
        setTimeout(() => wx.navigateBack(), 1500);
        return;
      }

      const initialValidity = !!(
        banner.imageUrl &&
        banner.title &&
        banner.title.trim() &&
        banner.content &&
        banner.content.trim()
      );

      this.setData({
        banner: {
          imageUrl: banner.imageUrl || "",
          title: banner.title || "",
          content: banner.content || "",
          order:
            banner.order !== undefined && banner.order !== null
              ? banner.order
              : 0,
          isActive: banner.isActive !== false,
        },
        fileList: banner.imageUrl
          ? [{ url: banner.imageUrl, type: "image" }]
          : [],
        isLoading: false,
        isFormValid: initialValidity,
      });
    } catch (err) {
      console.error("Load banner detail error", err);
      Toast({
        context: this,
        selector: "#t-toast",
        message: "获取详情失败",
        theme: "error",
        direction: "column",
      });
      this.setData({ isLoading: false });
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
        [`banner.${field}`]: value,
      },
      () => this.checkFormValidity(),
    );
  },

  onSwitchChange(e) {
    this.setData(
      {
        "banner.isActive": e.detail.value,
      },
      () => this.checkFormValidity(),
    );
  },

  onAddFile(e) {
    const { files } = e.detail;
    this.setData(
      {
        fileList: files,
        isImageLoaded: true,
      },
      () => this.checkFormValidity(),
    );
  },

  onRemoveFile(e) {
    const { index } = e.detail;
    const { fileList } = this.data;
    fileList.splice(index, 1);
    this.setData(
      {
        fileList,
        "banner.imageUrl": "",
      },
      () => this.checkFormValidity(),
    );
  },

  checkFormValidity() {
    const { banner, fileList } = this.data;
    const hasImage = fileList.length > 0;
    const hasTitle = !!(banner.title && banner.title.trim());
    const hasContent = !!(banner.content && banner.content.trim());
    const hasOrder = banner.order !== undefined && banner.order !== null;

    const isValid = hasImage && hasTitle && hasContent && hasOrder;
    if (this.data.isFormValid !== isValid) {
      this.setData({ isFormValid: isValid });
    }
  },

  async uploadToCloud(filePath) {
    const suffix = filePath.match(/\.[^.]+$/)?.[0] || ".png";
    const cloudPath = `banners/${Date.now()}-${Math.floor(Math.random() * 1000)}${suffix}`;
    const res = await wx.cloud.uploadFile({
      cloudPath,
      filePath,
    });
    return res.fileID;
  },

  async handleSave() {
    if (this.data.isSubmitting) {
      return;
    }

    const { banner, fileList, isEdit, bannerId } = this.data;

    if (fileList.length === 0) {
      Toast({
        context: this,
        selector: "#t-toast",
        message: "请上传轮播图片",
        theme: "warning",
        direction: "column",
      });
      return;
    }
    if (!banner.title.trim()) {
      Toast({
        context: this,
        selector: "#t-toast",
        message: "请输入轮播标题",
        theme: "warning",
        direction: "column",
      });
      return;
    }
    if (!banner.content.trim()) {
      Toast({
        context: this,
        selector: "#t-toast",
        message: "请输入弹窗简介",
        theme: "warning",
        direction: "column",
      });
      return;
    }

    this.setData({ isSubmitting: true });

    Toast({
      context: this,
      selector: "#t-toast",
      message: "提交中...",
      theme: "loading",
      duration: 0,
      direction: "column",
    });

    try {
      let imageUrl = banner.imageUrl;
      const fileUrl = fileList[0].url;
      const isLocalFile =
        fileUrl.startsWith("http://tmp") ||
        fileUrl.startsWith("wxfile://") ||
        fileUrl.startsWith("http://127") ||
        fileUrl.startsWith("http://localhost");

      if (isLocalFile) {
        try {
          imageUrl = await this.uploadToCloud(fileUrl);
          this.setData({
            "banner.imageUrl": imageUrl,
            "fileList[0].url": imageUrl,
          });
        } catch (uploadErr) {
          console.error("Upload image failed", uploadErr);
          throw new Error("图片上传失败");
        }
      }

      const submitData = {
        ...banner,
        imageUrl,
        title: banner.title.trim(),
        content: banner.content.trim(),
      };

      if (isEdit) {
        submitData._id = bannerId;
        await articleService.adminUpdateBanner(submitData);
      } else {
        await articleService.adminAddBanner(submitData);
      }

      this.selectComponent("#t-toast").hide();
      Toast({
        context: this,
        selector: "#t-toast",
        message: isEdit ? "修改成功" : "添加成功",
        theme: "success",
        direction: "column",
      });

      const eventChannel = this.getOpenerEventChannel();
      if (eventChannel && typeof eventChannel.emit === "function") {
        eventChannel.emit("refreshList");
      }

      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
    } catch (err) {
      console.error("Save banner error", err);
      this.selectComponent("#t-toast").hide();
      Toast({
        context: this,
        selector: "#t-toast",
        message: err.message || "操作失败",
        theme: "error",
        direction: "column",
      });
    } finally {
      this.setData({ isSubmitting: false });
    }
  },
});
