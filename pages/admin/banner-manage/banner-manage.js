import Toast from "tdesign-miniprogram/toast/index";
import Dialog from "tdesign-miniprogram/dialog/index";
import articleService from "../../../services/article";
import router from "../../../utils/router";

Page({
  data: {
    keyword: "",
    banners: [],
    isLoading: true,
    isRefreshing: false,
    skeletonImage: [
      { width: "100%", height: "320rpx", borderRadius: "16rpx" },
    ],
    skeletonText: [
      { width: "40%", height: "32rpx", marginBottom: "24rpx" },
      { width: "100%", height: "24rpx", marginBottom: "16rpx" },
      { width: "60%", height: "24rpx" },
    ],
  },

  onLoad() {
    this.loadBanners();
  },

  onShow() {
    if (!this.data.isLoading) {
      this.loadBanners(true);
    }
  },

  onBack() {
    wx.navigateBack();
  },

  onSearch(e) {
    this.setData({ keyword: e.detail.value });
    this.loadBanners(true);
  },

  onSearchClear() {
    this.setData({ keyword: "" });
    this.loadBanners(true);
  },

  onRefresh() {
    this.setData({ isRefreshing: true });
    this.loadBanners(true);
  },

  async loadBanners(silent = false) {
    if (!silent) this.setData({ isLoading: true });
    try {
      const { data } = await articleService.adminGetBanners({
        keyword: this.data.keyword,
      });

      const processedBanners = (data || [])
        .map((banner) => ({
          ...banner,
          _hasImage: !!(banner.imageUrl && banner.imageUrl.trim()),
          _hasTitle: !!(banner.title && banner.title.trim()),
          _order:
            banner.order !== undefined && banner.order !== null
              ? banner.order
              : 999,
        }))
        .sort((a, b) => a._order - b._order);

      this.setData({ banners: processedBanners });
    } catch (err) {
      console.error("Load banners failed:", err);
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

  onImageError(e) {
    const { index } = e.currentTarget.dataset;
    this.setData({
      [`banners[${index}]._hasImage`]: false,
    });
  },

  handleAdd() {
    router.navigateTo({
      url: "/pages/admin/banner-edit/banner-edit",
      events: {
        refreshList: () => this.loadBanners(true),
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
    router.navigateTo({
      url: `/pages/admin/banner-edit/banner-edit?id=${banner._id}`,
      events: {
        refreshList: () => this.loadBanners(true),
      },
    });
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
      this.loadBanners(true);
    } catch (err) {
      console.error("Toggle banner status failed:", err);
    }
  },

  handleDelete(e) {
    const { banner } = e.currentTarget.dataset;
    if (banner.isSystem) {
      Toast({
        context: this,
        selector: "#t-toast",
        message: "系统配置禁止删除",
        theme: "warning",
        direction: "column",
      });
      return;
    }

    Dialog.confirm({
      context: this,
      selector: "#t-dialog",
      title: "确认删除",
      content: `确定要删除轮播图「${banner.title || "未命名"}」吗？\n此操作不可恢复。`,
      confirmBtn: { content: "确认删除", theme: "danger", variant: "base" },
      cancelBtn: "取消",
    })
      .then(async () => {
        try {
          await articleService.adminDeleteBanner(banner._id);
          Toast({
            context: this,
            selector: "#t-toast",
            message: "删除成功",
            theme: "success",
            direction: "column",
          });
          this.loadBanners(true);
        } catch (err) {
          console.error("Delete banner failed:", err);
          Toast({
            context: this,
            selector: "#t-toast",
            message: "删除失败",
            theme: "error",
            direction: "column",
          });
        }
      })
      .catch(() => {});
  },
});
