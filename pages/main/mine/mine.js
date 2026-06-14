import { SafePage } from "../../../utils/middleware";
import router from "../../../utils/router";
import Toast from "tdesign-miniprogram/toast/index";

SafePage({
  data: {
    role: "user",
  },

  onShow() {
    this.initRole();
  },

  initRole() {
    const userInfo = wx.getStorageSync("userInfo");
    const role = userInfo ? userInfo.role : "user";
    this.setData({ role });
  },

  onSwitchTab(e) {
    const { index } = e.detail;
    const paths = [
      "/pages/main/home/home",
      "/pages/main/records/records",
      "/pages/main/assessment/assessment",
    ];
    if (paths[index]) {
      router.switchTab(paths[index]);
    }
  },
});
