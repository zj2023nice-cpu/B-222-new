Page({
  data: {
    navbarHeight: 0,
  },
  onLoad() {
    const app = getApp();
    this.setData({
      navbarHeight: app.globalData.navbarHeight,
    });
  },
  onBack() {
    wx.navigateBack();
  },
});
