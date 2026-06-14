import Toast from "tdesign-miniprogram/toast/index";
import Dialog from "tdesign-miniprogram/dialog/index";
import articleService from "../../../../services/article";
import router from "../../../../utils/router";

Component({
  options: {
    addGlobalClass: true,
    styleIsolation: "apply-shared",
  },

  data: {
    banners: [],
    isLoading: true,
    isRefreshing: false,
    keyword: "",
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

    onImageError(e) {
      const { index } = e.currentTarget.dataset;
      this.setData({
        [`banners[${index}]._hasImage`]: false,
      });
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
      router.navigateTo({
        url: "/pages/admin/banner-manage/banner-manage",
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
      });
    },

    handleManageAll() {
      router.navigateTo({
        url: "/pages/admin/banner-manage/banner-manage",
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

      Dialog.confirm({
        context: this,
        selector: "#t-dialog",
        title: "确认删除",
        content: `确定要删除轮播图「${banner?.title || "未命名"}」吗？\n此操作不可恢复。`,
        confirmBtn: { content: "确认删除", theme: "danger", variant: "base" },
        cancelBtn: "取消",
      })
        .then(async () => {
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
  },
});
