import Toast from "tdesign-miniprogram/toast/index";
import Dialog from "tdesign-miniprogram/dialog/index";
const userService = require("../../services/user").default;

const app = getApp();

Page({
  data: {
    role: "user",
    userInfo: null,
    tempAvatar: "",
    tempNickname: "",
    showProfileSetup: false,
    currentOpenid: "",
    isPageLoading: false,
  },

  onShow() {
    const userInfo = wx.getStorageSync("userInfo");
    this.setData({ userInfo });

    if (!userInfo) {
      wx.hideTabBar();
    } else {
      // 如果已经登录，直接跳回“首页”
      wx.switchTab({ url: "/pages/main/home/home" });
    }
  },

  selectRole(e) {
    this.setData({ role: e.currentTarget.dataset.role });
  },

  async handleLoginClick() {
    Toast({
      context: this,
      selector: "#t-toast",
      message: "登录中...",
      theme: "loading",
      direction: "column",
      duration: 0,
    });
    try {
      const { result: loginRes } = await wx.cloud.callFunction({
        name: "login",
        data: {},
      });
      const openid = loginRes.openid;
      this.setData({ currentOpenid: openid });

      const { data: userData } = await userService.checkUser(this.data.role);

      const userInfo = {
        ...userData,
        openid: openid,
        loginTime: new Date().getTime(),
      };
      app.globalData.userInfo = userInfo;
      wx.setStorageSync("userInfo", userInfo);
      this.setData({ userInfo });

      // 清除加载 Toast
      const toast = this.selectComponent("#t-toast");
      if (toast) toast.hide();

      setTimeout(() => {
        wx.switchTab({ url: "/pages/main/home/home" });
      }, 500);
    } catch (err) {
      // 清除加载
      const toast = this.selectComponent("#t-toast");
      if (toast) toast.hide();

      if (err.message === "用户不存在") {
        this.setData({ showProfileSetup: true });
        return;
      }
      console.error("[登录失败]:", err);
      Dialog.alert({
        context: this,
        selector: "#t-dialog",
        title: "登录失败",
        content: "网络繁忙，请稍后再试",
        confirmBtn: "好的",
      });
    }
  },

  onChooseAvatar(e) {
    this.setData({ tempAvatar: e.detail.avatarUrl });
  },

  onNicknameChange(e) {
    this.setData({ tempNickname: e.detail.value });
  },

  resetAuth() {
    this.setData({ showProfileSetup: false, tempAvatar: "", tempNickname: "" });
  },

  async uploadAvatarToCloud(filePath) {
    if (
      !filePath ||
      (!filePath.startsWith("http://tmp") && !filePath.startsWith("wxfile://"))
    ) {
      // 如果不是临时文件（例如已经是云存储链接或其他），则直接返回
      return filePath;
    }

    const { currentOpenid } = this.data;
    const suffix = filePath.match(/\.[^.]+$/)?.[0] || ".png";
    const cloudPath = `avatars/${currentOpenid}_${Date.now()}${suffix}`;

    try {
      const res = await wx.cloud.uploadFile({
        cloudPath,
        filePath,
      });
      return res.fileID;
    } catch (err) {
      console.error("上传头像失败", err);
      throw new Error("头像上传失败");
    }
  },

  async onProfileSubmit() {
    let { role, tempAvatar, tempNickname } = this.data;
    if (!tempNickname) {
      Toast({
        context: this,
        selector: "#t-toast",
        message: "请输入昵称",
        theme: "warning",
        direction: "column",
      });
      return;
    }

    Toast({
      context: this,
      selector: "#t-toast",
      message: "同步中...",
      theme: "loading",
      direction: "column",
      duration: 0,
    });
    try {
      //  încercarea de a încărca avatarul dacă este necesar
      if (
        tempAvatar.startsWith("http://tmp") ||
        tempAvatar.startsWith("wxfile://")
      ) {
        tempAvatar = await this.uploadAvatarToCloud(tempAvatar);
      }

      const { data: userInfo } = await userService.register(
        role,
        tempNickname,
        tempAvatar,
      );

      app.globalData.userInfo = userInfo;
      wx.setStorageSync("userInfo", userInfo);

      this.setData({ userInfo, showProfileSetup: false });

      const toast = this.selectComponent("#t-toast");
      if (toast) toast.hide();

      setTimeout(() => {
        wx.switchTab({ url: "/pages/main/home/home" });
      }, 500);
    } catch (err) {
      const toast = this.selectComponent("#t-toast");
      if (toast) toast.hide();

      if (err.message === "昵称已被占用") {
        Dialog.alert({
          context: this,
          selector: "#t-dialog",
          title: "昵称重复",
          content: "该昵称已存在，请更换一个试试",
          confirmBtn: "好的",
        });
        return;
      }
      Toast({
        context: this,
        selector: "#t-toast",
        message: "同步失败",
        theme: "error",
        direction: "column",
      });
    }
  },
});
