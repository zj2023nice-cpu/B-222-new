import Toast from "tdesign-miniprogram/toast/index";
import { DIALOG_CONFIGS } from "../../../../utils/constants";
import userService from "../../../../services/user";
import router from "../../../../utils/router";

Component({
  data: {
    userInfo: null,
    apptCount: 0,
    collectionCount: 0,
    moodCount: 0,
    dialog: {
      visible: false,
      title: "",
      content: "",
      confirmBtn: "",
      type: "",
    },
  },

  lifetimes: {
    attached() {
      const userInfo = wx.getStorageSync("userInfo");
      this.setData({ userInfo });
      this.initData();
    },
  },

  pageLifetimes: {
    show() {
      const userInfo = wx.getStorageSync("userInfo");
      this.setData({ userInfo });
      this.initData();
      this.loadTimeline();
    },
  },

  methods: {
    loadTimeline() {
      const timelineComp = this.selectComponent("#growthTimeline");
      if (timelineComp && typeof timelineComp.loadTimeline === "function") {
        timelineComp.loadTimeline();
      }
    },

    onTimelineItemTap(e) {
      const { item } = e.detail || {};
      console.log("[Mine] 时间线节点点击:", item);
    },

    async initData() {
      try {
        const { data } = await userService.getStats();
        this.setData({
          apptCount: data.apptCount,
          collectionCount: data.collectionCount,
          moodCount: data.moodCount,
        });
      } catch (err) {
        console.error("获取统计数据失败", err);
      }
    },

    navTo(e) {
      const { url, tab } = e.currentTarget.dataset;
      if (!url) return;
      let targetUrl = `/pages/student/${url}/${url}`;
      if (tab) targetUrl += `?activeTab=${tab}`;
      router.navigateTo({ url: targetUrl });
    },
    navToExam() {
      router.navigateTo({ url: "/pages/student/exam-records/exam-records" });
    },

    logout() {
      this.setData({
        dialog: {
          visible: true,
          ...DIALOG_CONFIGS.LOGOUT,
          type: "logout",
        },
      });
    },

    deleteAccount() {
      this.setData({
        dialog: {
          visible: true,
          ...DIALOG_CONFIGS.DELETE_ACCOUNT,
          type: "delete",
        },
      });
    },

    onDialogConfirm() {
      const { type } = this.data.dialog;
      this.setData({ "dialog.visible": false });

      if (type === "logout") {
        this.handleLogout();
      } else if (type === "delete") {
        this.handleDeleteAccount();
      }
    },

    onDialogCancel() {
      this.setData({ "dialog.visible": false });
    },

    handleLogout() {
      wx.clearStorageSync();
      router.reLaunch({ url: "/pages/login/login" });
    },

    async handleDeleteAccount() {
      try {
        await userService.deleteAccount("user");
        wx.clearStorageSync();
        router.reLaunch({ url: "/pages/login/login" });
      } catch (err) {
        Toast({
          context: this,
          selector: "#t-toast",
          message: "注销失败",
          theme: "error",
          direction: "column",
        });
      }
    },

    onAvatarError() {
      this.setData({ "userInfo.avatar": "" });
    },
  },
});
