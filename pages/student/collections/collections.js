import Dialog from "tdesign-miniprogram/dialog/index";
import Toast from "tdesign-miniprogram/toast/index";
const articleService = require("../../../services/article").default;

Page({
  data: {
    collections: [],
    allCollections: [],
    isLoading: true,
    isPageLoading: false,
    isRefreshing: false,
    navbarHeight: 0,
    keyword: "",
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
    this.setData({
      navbarHeight: getApp().globalData.navbarHeight,
    });
  },

  onShow() {
    this.fetchCollections();
  },

  async fetchCollections() {
    this.setData({ isLoading: true });
    try {
      const { data } = await articleService.getCollections();
      
      // 在这里直接进行过滤逻辑，避免二次 setData 导致的视图闪烁
      const { keyword } = this.data;
      const filtered = keyword 
        ? data.filter(item => item.title.toLowerCase().includes(keyword.toLowerCase()))
        : data;

      this.setData({ 
        allCollections: data,
        collections: filtered,
        isLoading: false, // 只有在数据准备好后才关闭 loading
        isRefreshing: false
      });
    } catch (err) {
      console.error("获取收藏失败", err);
      this.setData({ 
        isLoading: false,
        isRefreshing: false
      });
      Toast({
        context: this,
        selector: "#t-toast",
        message: "加载失败",
        theme: "error",
        direction: "column",
      });
    }
  },

  onRefresh() {
    this.setData({ isRefreshing: true });
    this.fetchCollections();
  },

  onUncollect(e) {
    const { article } = e.detail;

    Dialog.confirm({
      context: this,
      selector: "#t-dialog",
      title: "取消收藏",
      content: "确定要取消收藏该文章吗？",
      confirmBtn: { content: "确定", variant: "base", theme: "primary" },
      cancelBtn: "再想想",
    })
      .then(async () => {
        try {
          const articleId = article._id;
          await articleService.toggleCollect(articleId, null, true);

          // 同步更新两个数组
          const newAllCollections = this.data.allCollections.filter(
            (item) => item._id !== articleId,
          );
          this.setData({ allCollections: newAllCollections }, () => {
            this.filterList();
          });

          Toast({
            context: this,
            selector: "#t-toast",
            message: "已取消收藏",
            theme: "success",
            direction: "column",
          });
        } catch (err) {
          console.error("取消收藏失败", err);
          Toast({
            context: this,
            selector: "#t-toast",
            message: "操作失败",
            theme: "error",
            direction: "column",
          });
        }
      })
      .catch(() => {
        // 用户点击取消，不做任何处理
      });
  },

  navToDetail(e) {
    // article-card 组件抛出的 click 事件带有 detail.article
    const article = e.detail.article;
    if (article && article._id) {
      wx.navigateTo({
        url: `/pages/student/articles/article-detail/article-detail?id=${article._id}`,
      });
    }
  },

  onSearch(e) {
    this.setData(
      {
        keyword: e.detail.value,
      },
      () => {
        this.filterList();
      },
    );
  },

  onSearchClear() {
    this.setData(
      {
        keyword: "",
      },
      () => {
        this.filterList();
      },
    );
  },

  filterList() {
    const { keyword, allCollections } = this.data;
    if (!keyword) {
      this.setData({ collections: allCollections });
      return;
    }

    const filtered = allCollections.filter((item) =>
      item.title.toLowerCase().includes(keyword.toLowerCase()),
    );
    this.setData({ collections: filtered });
  },
});
