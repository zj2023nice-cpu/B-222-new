import Toast from "tdesign-miniprogram/toast/index";
import userService from "../../../services/user";

Page({
  data: {
    userInfo: {},
    userRole: "user",
    targetId: "",
    isSaving: false,
    isLoading: true,
  },

  onLoad(options) {
    const { id, role } = options;
    if (!id || !role) {
      Toast({
        context: this,
        selector: "#t-toast",
        message: "参数错误",
        theme: "error",
        direction: "column",
      });
      setTimeout(() => wx.navigateBack(), 1500);
      return;
    }

    this.setData({
      targetId: id,
      userRole: role,
    });

    this.loadUserData(id);
  },

  async loadUserData(id) {
    wx.showLoading({ title: "加载中..." });
    try {
      const res = await userService.adminGetUserInfo(id, this.data.userRole);
      if (res.code === 0) {
        this.setData({
          userInfo: res.data,
          isLoading: false,
        });
      }
    } catch (err) {
      console.error("Load user data error", err);
      Toast({
        context: this,
        selector: "#t-toast",
        message: "获取用户信息失败",
        theme: "error",
        direction: "column",
      });
    } finally {
      wx.hideLoading();
    }
  },

  onBack() {
    wx.navigateBack();
  },

  async handleAdminSave(e) {
    const updatedData = e.detail;
    const { targetId, userRole } = this.data;

    this.setData({ isSaving: true });

    try {
      await userService.adminUpdateUser({
        ...updatedData,
        _id: targetId,
        role: userRole,
      });

      Toast({
        context: this,
        selector: "#t-toast",
        message: "修改成功",
        theme: "success",
        direction: "column",
      });

      // 通讯：通知来源页面（用户管理列表）刷新数据
      const eventChannel = this.getOpenerEventChannel();
      if (eventChannel && typeof eventChannel.emit === "function") {
        eventChannel.emit("refreshList");
      }

      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
    } catch (err) {
      console.error("Admin save error", err);
      Toast({
        context: this,
        selector: "#t-toast",
        message: err.message || "修改失败",
        theme: "error",
        direction: "column",
      });
    } finally {
      this.setData({ isSaving: false });
    }
  },
});
