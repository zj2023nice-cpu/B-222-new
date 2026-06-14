import { SafePage } from "../../../utils/middleware";

SafePage({
  data: {
    role: null,
  },

  onShow() {
    this.initRole();
  },

  initRole() {
    const userInfo = wx.getStorageSync("userInfo");
    this.setData({ role: userInfo ? userInfo.role : "user" });
  },

  onReachBottom() {
    const component = this.selectComponent("#admin-consultation-manage");
    if (component && typeof component.onLoadMore === "function") {
      component.onLoadMore();
    }
  },
});
