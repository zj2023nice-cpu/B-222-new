import { SafePage } from "../../../utils/middleware";
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

    if (role === "consultant") {
      wx.setNavigationBarTitle({ title: "学生健康档案" });
    } else {
      wx.setNavigationBarTitle({ title: "AI 咨询" });
    }
  },
});
