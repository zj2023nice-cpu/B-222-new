import userService from "../../../../services/user";
import Toast from "tdesign-miniprogram/toast/index";
import Dialog from "tdesign-miniprogram/dialog/index";
import { DIALOG_CONFIGS } from "../../../../utils/constants";

Component({
  data: {
    userInfo: null,
    isLoading: true,
    stats: {
      pendingCount: 0,
      totalCount: 0,
      score: "5.0",
    },
    rowColsAvater: [{ size: "120rpx", type: "circle" }],
    rowColsContent: [
      {
        width: "300rpx",
        height: "40rpx",
        marginLeft: "32rpx",
        marginBottom: "10rpx",
      },
      { width: "200rpx", height: "26rpx", marginLeft: "32rpx" },
    ],
  },

  lifetimes: {
    attached() {
      console.log("[Home] attached");
      this.updateData();
    },
  },

  pageLifetimes: {
    show() {
      console.log("[Home] show");
      this.updateData();
    },
  },

  methods: {
    async updateData() {
      try {
        console.log("[Home] Starting updateData...");

        // Parallel execution for speed
        const [statsRes, userRes] = await Promise.all([
          userService.getStats("consultant"),
          userService.checkUser("consultant"),
        ]);

        console.log("[Home] API Responses:", { statsRes, userRes });

        const statsData = statsRes.data || {};
        const profileData = userRes.data || {};

        // Prepare local userInfo update
        // Use empty object if storage is empty to avoid null errors
        const currentUserInfo = wx.getStorageSync("userInfo") || {};

        const newUserInfo = {
          ...currentUserInfo,
          ...profileData,
          avatar: profileData.avatar || currentUserInfo.avatar || "",
          // Ensure name and title fallback to existing if missing in response (safety net)
          name: profileData.name || currentUserInfo.name || "",
          title: profileData.title || currentUserInfo.title || "",
        };

        // Commit updates
        wx.setStorageSync("userInfo", newUserInfo);
        this.setData({
          userInfo: newUserInfo,
          isLoading: false,
          stats: {
            pendingCount: statsData.pendingCount || 0,
            totalCount: statsData.totalCount || 0,
            score: statsData.score || "5.0",
          },
        });
      } catch (err) {
        console.error("[Home] updateData error:", err);
        this.setData({ isLoading: false });
      }
    },

    navTo(e) {
      const { url } = e.currentTarget.dataset;
      let targetUrl = "";
      if (url === "profile") {
        targetUrl = "/pages/consultant/profile/profile";
      }
      if (targetUrl) wx.navigateTo({ url: targetUrl });
    },

    onTabChange(e) {
      const { index } = e.currentTarget.dataset;
      // Emit event to page to change tab bar
      this.triggerEvent("switchtab", { index });
    },

    onDeveloping() {
      Toast({
        context: this,
        selector: "#t-toast",
        message: "功能开发中",
      });
    },

    logout() {
      Dialog.confirm({
        context: this,
        selector: "#t-dialog",
        ...DIALOG_CONFIGS.LOGOUT,
      })
        .then(() => {
          wx.clearStorageSync();
          wx.reLaunch({ url: "/pages/login/login" });
        })
        .catch(() => {
          // cancel
        });
    },

    onAvatarError(e) {
      console.log("Avatar load error in home:", e);
      this.setData({
        "userInfo.avatar": "",
      });
    },

    deleteAccount() {
      Dialog.confirm({
        context: this,
        selector: "#t-dialog",
        ...DIALOG_CONFIGS.DELETE_ACCOUNT,
      })
        .then(async () => {
          try {
            await userService.deleteAccount("consultant");
            wx.clearStorageSync();
            wx.reLaunch({ url: "/pages/login/login" });
          } catch (err) {
            console.error("注销失败:", err);
            Toast({
              context: this,
              selector: "#t-toast",
              message: "注销失败",
              theme: "error",
              direction: "column",
            });
          }
        })
        .catch(() => {
          // cancel
        });
    },
  },
});
