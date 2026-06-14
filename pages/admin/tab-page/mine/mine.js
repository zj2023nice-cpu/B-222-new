import Dialog from "tdesign-miniprogram/dialog/index";
import Toast from "tdesign-miniprogram/toast/index";
import { DIALOG_CONFIGS } from "../../../../utils/constants";
const userService = require("../../../../services/user").default;
import router from "../../../../utils/router";

Component({
  options: {
    styleIsolation: "apply-shared",
  },
  data: {
    userInfo: null,
  },

  lifetimes: {
    attached() {
      this.init();
    },
  },

  pageLifetimes: {
    show() {
      this.init();
    },
  },

  methods: {
    init() {
      const userInfo = wx.getStorageSync("userInfo");
      if (userInfo) {
        this.setData({ userInfo });
      }
    },

    onAvatarError() {
      this.setData({
        "userInfo.avatar": "",
      });
    },

    logout() {
      Dialog.confirm({
        context: this,
        selector: "#t-dialog",
        ...DIALOG_CONFIGS.LOGOUT,
      })
        .then(() => {
          wx.removeStorageSync("userInfo");
          router.reLaunch({
            url: "/pages/login/login",
          });
        })
        .catch(() => {
          // cancel
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
            Toast({
              context: this,
              selector: "#t-toast",
              message: "注销中...",
              theme: "loading",
              duration: 0,
              direction: "column",
            });

            await userService.deleteAccount("admin");

            Toast({
              context: this,
              selector: "#t-toast",
              message: "注销成功",
              theme: "success",
              direction: "column",
            });

            // Clear local storage and redirect to login
            wx.removeStorageSync("userInfo");
            setTimeout(() => {
              router.reLaunch({
                url: "/pages/login/login",
              });
            }, 1500);
          } catch (err) {
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
