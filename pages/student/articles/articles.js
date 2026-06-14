import Toast from "tdesign-miniprogram/toast/index";
const articleService = require("../../../services/article").default;
import router from "../../../utils/router";

Page({
  data: {
    articles: [],
    isLoading: true,
    isRefreshing: false,
    imageSkeleton: [
      { width: "220rpx", height: "160rpx", borderRadius: "16rpx" },
    ],
    infoSkeleton: [
      { width: "80%", height: "32rpx" },
      { width: "100%", height: "28rpx" },
      { width: "40%", height: "32rpx" },
    ],
  },

  onLoad() {
    this.fetchArticles();
  },

  onShow() {
    // 每次显示页面时，如果不是首次加载，也尝试刷新一次列表以保证即时性
    if (!this.data.isLoading) {
      this.fetchArticles("", true);
    }
  },

  async fetchArticles(keyword = "", silent = false) {
    // 只有在非刷新状态且非静默加载下才显示骨架屏
    if (!this.data.isRefreshing && !silent) {
      this.setData({ isLoading: true });
    }

    try {
      const { data } = await articleService.getList(keyword);

      const articles = data.map((item) => ({
        ...item,
        date: this.formatDate(new Date(item.date)),
      }));
      this.setData({ articles });
    } catch (err) {
      console.error("获取文章列表失败:", err);
      Toast({
        context: this,
        selector: "#t-toast",
        message: "数据加载失败",
        theme: "error",
        direction: "column",
      });
    } finally {
      this.setData({
        isLoading: false,
        isRefreshing: false,
      });
    }
  },

  formatDate(date) {
    const y = date.getFullYear();
    const m = (date.getMonth() + 1).toString().padStart(2, "0");
    const d = date.getDate().toString().padStart(2, "0");
    return `${y}-${m}-${d}`;
  },

  onSearchChange(e) {
    const keyword = e.detail.value;
    this.fetchArticles(keyword);
  },

  navToDetail(e) {
    // 支持组件触发 (e.detail.article) 和直接点击 (dataset)
    const article = e.detail.article || e.currentTarget.dataset;
    const id = article._id || article.id;

    if (id) {
      router.navigateTo({
        url: `/pages/student/articles/article-detail/article-detail?id=${id}`,
      });
    }
  },

  onPullDownRefresh() {
    this.setData({ isRefreshing: true });
    this.fetchArticles().then(() => {
      wx.stopPullDownRefresh();
    });
  },
});
