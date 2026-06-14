import Toast from "tdesign-miniprogram/toast/index";
import Dialog from "tdesign-miniprogram/dialog/index";
import articleService from "../../../../services/article";
import { formatTime } from "../../../../utils/util";

Component({
  options: {
    addGlobalClass: true,
    styleIsolation: "isolated",
  },

  data: {
    keyword: "",
    list: [],
    page: 1,
    pageSize: 10,
    hasMore: true,
    isLoading: true,
    pullDownRefreshing: false,
    stickyProps: {
      zIndex: 2,
      offsetTop: 0,
    },
    infoSkeleton: [
      { width: "90%", height: "36rpx" },
      { width: "65%", height: "28rpx" },
      { width: "50%", height: "26rpx" },
    ],
    imageSkeleton: [
      { width: "160rpx", height: "160rpx", borderRadius: "16rpx" },
    ],
    forceLoading: false, // 调试开关
  },

  lifetimes: {
    attached() {
      const app = getApp();
      this.setData({
        "stickyProps.offsetTop": app.globalData.navbarHeight,
      });
      this.loadData(true);
    },
  },

  pageLifetimes: {
    show() {
      // 保持数据最新
      if (!this.data.isLoading) {
        this.loadData(true);
      }
    },
  },

  methods: {
    onSearch(e) {
      this.setData({
        keyword: e.detail.value,
        page: 1,
        isLoading: true,
      });
      this.loadData(true);
    },

    onSearchClear() {
      this.setData({
        keyword: "",
        page: 1,
        isLoading: true,
      });
      this.loadData(true);
    },

    onPullDownRefresh() {
      this.setData({ pullDownRefreshing: true });
      this.loadData(true);
    },

    async loadData(reset = false) {
      if (this.data.isLoading && !reset) return;

      this.setData({ isLoading: true });

      try {
        const page = reset ? 1 : this.data.page;
        const { keyword, pageSize } = this.data;

        const res = await articleService.adminGetArticles({
          keyword,
          page,
          pageSize,
        });

        if (res.code === 0) {
          let newList = res.data.list.map((item) => ({
            ...item,
            dateFormat: item.date
              ? formatTime(new Date(item.date), "YYYY-MM-DD")
              : "-",
          }));

          if (!reset) {
            newList = [...this.data.list, ...newList];
          }

          this.setData({
            list: newList,
            page: page + 1,
            hasMore: newList.length < res.data.total,
            pullDownRefreshing: false,
          });
        }
      } catch (err) {
        console.error("Load articles error", err);
        Toast({
          context: this,
          selector: "#t-toast",
          message: "加载失败",
          theme: "error",
          direction: "column",
        });
      } finally {
        this.setData({ isLoading: false, pullDownRefreshing: false });
      }
    },

    onAddArticle() {
      wx.navigateTo({
        url: "/pages/admin/article-edit/article-edit",
        events: {
          refreshList: () => this.loadData(true),
        },
      });
    },

    onArticleTap(e) {
      const { id } = e.currentTarget.dataset;
      wx.navigateTo({
        url: `/pages/admin/article-edit/article-edit?id=${id}`,
        events: {
          refreshList: () => this.loadData(true),
        },
      });
    },

    onDeleteTap(e) {
      const { id, title, isSystem } = e.currentTarget.dataset;

      if (isSystem) {
        Toast({
          context: this,
          selector: "#t-toast",
          message: "核心文章，禁止删除",
          theme: "warning",
          direction: "column",
        });
        return;
      }

      Dialog.confirm({
        context: this,
        selector: "#t-dialog",
        title: "确认删除",
        content: `是否确认删除文章：《${title}》\n此操作不可恢复！`,
        confirmBtn: { content: "确认删除", theme: "danger", variant: "base" },
        cancelBtn: "取消",
      }).then(async () => {
        try {
          await articleService.adminDeleteArticle(id);
          Toast({
            context: this,
            selector: "#t-toast",
            message: "删除成功",
            theme: "success",
            direction: "column",
          });
          this.loadData(true);
        } catch (err) {
          Toast({
            context: this,
            selector: "#t-toast",
            message: "删除失败",
            theme: "error",
            direction: "column",
          });
        }
      });
    },
  },
});
