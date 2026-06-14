import Toast from "tdesign-miniprogram/toast/index";
import articleService from "../../../../services/article";

Component({
  options: {
    addGlobalClass: true,
    styleIsolation: "apply-shared",
  },

  data: {
    banners: [],
    isLoading: true,
    isRefreshing: false,
    showEditPopup: false,
    isEditing: false,
    currentBanner: {
      _id: "",
      imageUrl: "",
      title: "",
      content: "",
      order: 0,
      isActive: true,
    },
    fileList: [],
    keyword: "",
    gridConfig: {
      column: 1,
      width: 624,
      height: 380,
    },
    isFormValid: false,
  },

  lifetimes: {
    attached() {
      this.fetchBanners();
    },
  },

  pageLifetimes: {
    show() {
      if (typeof this.getTabBar === "function" && this.getTabBar()) {
        this.getTabBar().setData({ value: 1 }); // Assuming resource manage is at some index
      }
    },
  },

  methods: {
    async fetchBanners(silent = false) {
      if (!silent) this.setData({ isLoading: true });
      try {
        const { data } = await articleService.adminGetBanners({
          keyword: this.data.keyword,
        });
        this.setData({ banners: data });
      } catch (err) {
        console.error("Fetch banners failed:", err);
        Toast({
          context: this,
          selector: "#t-toast",
          message: "获取列表失败",
          theme: "error",
          direction: "column",
        });
      } finally {
        if (!silent) this.setData({ isLoading: false });
        this.setData({ isRefreshing: false });
      }
    },

    onSearch(e) {
      const { value } = e.detail;
      this.setData({ keyword: value });
      this.fetchBanners(true);
    },

    onRefresh() {
      this.setData({ isRefreshing: true });
      this.fetchBanners(true);
    },

    handleAdd() {
      this.setData({
        isEditing: false,
        showEditPopup: true,
        fileList: [],
        isFormValid: false,
        currentBanner: {
          _id: "",
          imageUrl: "",
          title: "",
          content: "",
          order: 0,
          isActive: true,
        },
      });
    },

    handleEdit(e) {
      const { banner } = e.currentTarget.dataset;

      if (banner.isSystem) {
        Toast({
          context: this,
          selector: "#t-toast",
          message: "系统配置禁止修改",
          theme: "warning",
          direction: "column",
        });
        return;
      }

      this.setData(
        {
          isEditing: true,
          showEditPopup: true,
          currentBanner: { ...banner },
          fileList: banner.imageUrl
            ? [{ url: banner.imageUrl, type: "image" }]
            : [],
        },
        () => this.checkFormValid(),
      );
    },

    async handleToggleStatus(e) {
      const { banner } = e.currentTarget.dataset;

      if (banner.isSystem) {
        Toast({
          context: this,
          selector: "#t-toast",
          message: "系统配置无法隐藏",
          theme: "warning",
          direction: "column",
        });
        return;
      }

      const newStatus = !banner.isActive;
      try {
        await articleService.adminUpdateBanner({
          _id: banner._id,
          isActive: newStatus,
        });
        Toast({
          context: this,
          selector: "#t-toast",
          message: newStatus ? "已设为可见" : "已设为隐藏",
          theme: "success",
          direction: "column",
        });
        this.fetchBanners(true);
      } catch (err) {
        console.error("Toggle banner status failed:", err);
      }
    },

    async handleDelete(e) {
      const { id, isSystem } = e.currentTarget.dataset;

      const banner = this.data.banners.find((b) => b._id === id);
      if (banner && banner.isSystem) {
        Toast({
          context: this,
          selector: "#t-toast",
          message: "系统配置禁止删除",
          theme: "warning",
          direction: "column",
        });
        return;
      }

      wx.showModal({
        title: "确认删除",
        content: "确定要删除这张轮播图吗？",
        success: async (res) => {
          if (res.confirm) {
            try {
              await articleService.adminDeleteBanner(id);
              Toast({
                context: this,
                selector: "#t-toast",
                message: "删除成功",
                theme: "success",
                direction: "column",
              });
              this.fetchBanners(true);
            } catch (err) {
              console.error("Delete banner failed:", err);
            }
          }
        },
      });
    },

    onInputChange(e) {
      const { field } = e.currentTarget.dataset;
      const { value } = e.detail;
      this.setData(
        {
          [`currentBanner.${field}`]: value,
        },
        () => this.checkFormValid(),
      );
    },

    onSwitchChange(e) {
      this.setData(
        {
          "currentBanner.isActive": e.detail.value,
        },
        () => this.checkFormValid(),
      );
    },

    // 附件上传相关的逻辑
    onAddFile(e) {
      const { files } = e.detail;
      this.setData(
        {
          fileList: files,
        },
        () => this.checkFormValid(),
      );
    },

    onRemoveFile(e) {
      const { index } = e.detail;
      const { fileList } = this.data;
      fileList.splice(index, 1);
      this.setData(
        {
          fileList,
        },
        () => this.checkFormValid(),
      );
    },

    checkFormValid() {
      const { currentBanner, fileList } = this.data;
      const hasImage = fileList.length > 0;
      const hasTitle = !!(currentBanner.title && currentBanner.title.trim());
      const hasContent = !!(
        currentBanner.content && currentBanner.content.trim()
      );
      // order usually has a default 0, but check if it's there
      const hasOrder =
        currentBanner.order !== undefined && currentBanner.order !== null;

      this.setData({
        isFormValid: hasImage && hasTitle && hasContent && hasOrder,
      });
    },

    async handleSubmit() {
      const { currentBanner, fileList, isEditing } = this.data;
      if (fileList.length === 0) {
        Toast({
          context: this,
          selector: "#t-toast",
          message: "请上传图片",
          theme: "warning",
          direction: "column",
        });
        return;
      }
      if (!currentBanner.title) {
        Toast({
          context: this,
          selector: "#t-toast",
          message: "请输入标题",
          theme: "warning",
          direction: "column",
        });
        return;
      }

      Toast({
        context: this,
        selector: "#t-toast",
        message: "提交中...",
        theme: "loading",
        duration: 0,
        direction: "column",
      });

      try {
        let imageUrl = currentBanner.imageUrl;
        // 如果是新选的本地图片，先上传
        if (
          fileList[0].url.startsWith("http://") ||
          fileList[0].url.startsWith("wxfile://")
        ) {
          const filePath = fileList[0].url;
          const cloudPath = `banners/${Date.now()}-${Math.floor(Math.random() * 1000)}.png`;
          const uploadRes = await wx.cloud.uploadFile({
            cloudPath,
            filePath,
          });
          imageUrl = uploadRes.fileID;
        }

        const submitData = {
          ...currentBanner,
          imageUrl,
        };

        if (isEditing) {
          await articleService.adminUpdateBanner(submitData);
        } else {
          await articleService.adminAddBanner(submitData);
        }

        this.selectComponent("#t-toast").hide();
        Toast({
          context: this,
          selector: "#t-toast",
          message: isEditing ? "修改成功" : "添加成功",
          theme: "success",
          direction: "column",
        });

        this.setData({ showEditPopup: false });
        this.fetchBanners(true);
      } catch (err) {
        console.error("Submit banner failed:", err);
        this.selectComponent("#t-toast").hide();
        Toast({
          context: this,
          selector: "#t-toast",
          message: "提交失败",
          theme: "error",
          direction: "column",
        });
      }
    },

    closePopup() {
      this.setData({ showEditPopup: false });
    },
  },
});
