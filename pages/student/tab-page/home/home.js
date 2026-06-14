import articleService from "../../../../services/article";

Component({
  data: {
    articles: [],
    carouselList: [],
    isLoading: true,
    bannerSkeleton: [{ size: "320rpx", borderRadius: "20rpx" }],
    rowSkeleton: [
      { width: "100rpx", height: "100rpx", borderRadius: "12rpx" },
      { width: "60%", height: "32rpx" },
      { width: "40%", height: "24rpx" },
    ],
    showDialog: false,
    dialogTitle: "",
    dialogContent: "",
    isRefreshing: false,
  },

  pageLifetimes: {
    show() {
      // 仅当已有数据时，在页面显示时静默刷新以同步阅读量等
      // 首次加载交给 lifetimes.attached 处理
      if (this.data.articles.length > 0) {
        this.fetchHomeData(true);
      }
    },
  },

  lifetimes: {
    attached() {
      this.fetchHomeData();
    },
  },

  methods: {
    async fetchHomeData(silent = false) {
      if (!silent) this.setData({ isLoading: true });
      try {
        const { data } = await articleService.getHomeData();
        const carouselList = data.carouselList.map((item) => ({
          ...item,
          value: item.imageUrl,
        }));
        this.setData({
          carouselList,
          articles: data.articles,
        });
      } catch (err) {
        console.error("获取主页数据失败:", err);
      } finally {
        this.setData({
          isLoading: false,
          isRefreshing: false,
        });
      }
    },

    onRefresh() {
      this.setData({ isRefreshing: true });
      this.fetchHomeData(true);
    },

    navToAssessment() {
      wx.navigateTo({ url: "/pages/student/assessment/assessment" });
    },
    navToAppointment() {
      wx.navigateTo({ url: "/pages/student/appointment/appointment" });
    },
    navToArticles() {
      wx.navigateTo({ url: "/pages/student/articles/articles" });
    },
    navToMood() {
      wx.navigateTo({ url: "/pages/student/mood/mood?activeTab=record" });
    },
    navToArticleDetail(e) {
      const article = e.detail.article || e.currentTarget.dataset;
      const id = article._id || article.id;
      if (id) {
        wx.navigateTo({
          url: `/pages/student/articles/article-detail/article-detail?id=${id}`,
        });
      }
    },
    onBannerClick(e) {
      const { index } = e.detail;
      const banner = this.data.carouselList[index];
      if (banner && banner.content) {
        this.setData({
          showDialog: true,
          dialogTitle: banner.title || "校园心理健康",
          dialogContent: banner.content,
        });
      }
    },
    closeDialog() {
      this.setData({ showDialog: false });
    },
  },
});
