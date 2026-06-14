App({
  onLaunch() {
    if (!wx.cloud) {
      console.error("请使用 2.2.3 或以上的基础库以使用云能力");
    } else {
      wx.cloud.init({
        env: "cloud1-5gy43j1wb5112695", // 云开发环境 ID
        traceUser: true,
      });
      // 在 init 之后再获取数据库引用
      this.globalData.db = wx.cloud.database();
      console.log("[云开发初始化成功]");
    }

    // 计算全局导航栏高度以供吸顶组件使用
    this.initNavbarHeight();

    // Check local role cache (still useful for UI persistence before db load)
    const userInfo = wx.getStorageSync("userInfo");
    if (userInfo) {
      this.globalData.userInfo = userInfo;
    }
  },

  initNavbarHeight() {
    try {
      const windowInfo = wx.getWindowInfo();
      const rect = wx.getMenuButtonBoundingClientRect();
      const statusBarHeight = windowInfo.statusBarHeight;
      const navbarHeight =
        (rect.top - statusBarHeight) * 2 + rect.height + statusBarHeight;
      this.globalData.navbarHeight = navbarHeight;
      this.globalData.statusBarHeight = statusBarHeight;
      this.globalData.pixelRatio = windowInfo.pixelRatio;
    } catch (err) {
      console.error("初始化导航栏高度失败", err);
      // 降级兜底方案
      this.globalData.navbarHeight = 88; // 常见高度
    }
  },

  globalData: {
    userInfo: null,
    db: null,
    navbarHeight: 0,
    statusBarHeight: 0,
    pixelRatio: 1,
  },
});
