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
});
