import { SafePage } from "../../../utils/middleware";
import Toast from "tdesign-miniprogram/toast/index";
import userService from "../../../services/user";

SafePage({
  options: {
    styleIsolation: "apply-shared",
  },
  data: {
    userInfo: {
      name: "",
      title: "",
      introduction: "",
      expertise: "",
      avatar: "",
    },
    isSaving: false,
    targetUserId: null,
  },

  onLoad(options) {
    if (options && options.id) {
      this.setData({ targetUserId: options.id });
    }
    this.loadProfile();
  },

  async loadProfile() {
    if (this.data.targetUserId) {
      // Admin editing other user (though the user asked for a separate page,
      // it's good to keep this logic here for now or cleanup later)
      try {
        const res = await userService.adminGetUserInfo(
          this.data.targetUserId,
          "consultant",
        );
        if (res.code === 0) {
          const profile = res.data;
          this.setData({
            userInfo: {
              name: profile.name || "",
              title: profile.title || "",
              introduction: profile.introduction || "",
              expertise: profile.expertise || "",
              avatar: profile.avatar || "",
            },
          });
        }
      } catch (err) {
        console.error("Load target profile error", err);
      }
      return;
    }

    // Normal user editing self
    try {
      const res = await userService.checkUser("consultant");
      if (res.code === 0) {
        const profile = res.data;
        this.setData({
          userInfo: {
            name: profile.name || "",
            title: profile.title || "",
            introduction: profile.introduction || "",
            expertise: profile.expertise || "",
            avatar: profile.avatar || "",
          },
        });
      }
    } catch (err) {
      console.error("Load consultant profile error", err);
    }
  },

  onBack() {
    wx.navigateBack();
  },

  async onSaveProfile(e) {
    const updatedInfo = e.detail;
    const { targetUserId } = this.data;

    this.setData({ isSaving: true });

    try {
      if (targetUserId) {
        // Admin update
        await userService.adminUpdateConsultant({
          ...updatedInfo,
          userId: targetUserId,
        });
      } else {
        // Self update
        await userService.updateConsultant(updatedInfo);

        // Update local storage
        const appUserInfo = wx.getStorageSync("userInfo") || {};
        wx.setStorageSync("userInfo", {
          ...appUserInfo,
          ...updatedInfo,
        });
      }

      Toast({
        context: this,
        selector: "#t-toast",
        message: "保存成功",
        theme: "success",
        direction: "column",
      });

      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
    } catch (err) {
      console.error("Save profile error", err);
      Toast({
        context: this,
        selector: "#t-toast",
        message: err.message || "保存失败",
        theme: "error",
        direction: "column",
      });
    } finally {
      this.setData({ isSaving: false });
    }
  },
});
