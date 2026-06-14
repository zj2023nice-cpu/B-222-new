import { SafePage } from "../../../utils/middleware";
import router from "../../../utils/router";
import Toast from "tdesign-miniprogram/toast/index";
import appointmentService from "../../../services/appointment";
import assessmentService from "../../../services/assessment";
import { APPOINTMENT_STATUS_MAP } from "../../../utils/constants";

const ROLE_CONFIG = {
  user: {
    pageTitle: "我的待办",
    loaders: ["loadRecentAppointments", "loadAvailableAssessments"],
    quickEntries: [
      {
        key: "mood",
        label: "情绪记录",
        desc: "记录此刻心情",
        icon: "edit-1",
        color: "#7c4dff",
        gradient: "linear-gradient(to bottom right, #ffffff, #f9f0ff)",
        url: "/pages/student/mood/mood?activeTab=record",
      },
    ],
  },
  consultant: {
    pageTitle: "工作台",
    loaders: ["loadConsultantStats", "loadConsultantPending"],
    quickEntries: [],
  },
  admin: {
    pageTitle: "管理待办",
    loaders: ["loadAdminStats", "loadAdminPending"],
    quickEntries: [
      {
        key: "banner",
        label: "轮播管理",
        desc: "管理首页轮播图",
        icon: "image",
        color: "#0052d9",
        gradient: "linear-gradient(to bottom right, #ffffff, #f0f7ff)",
        url: "/pages/admin/banner-manage/banner-manage",
      },
    ],
  },
};

SafePage({
  data: {
    role: null,
    isLoading: true,
    pageTitle: "",

    recentAppointments: [],
    availableAssessments: [],
    consultantStats: { pending: 0, confirmed: 0, completed: 0 },
    consultantPendingList: [],
    adminStats: { total: 0, pending: 0, confirmed: 0, completed: 0 },
    adminPendingList: [],
    quickEntries: [],
    statusMap: APPOINTMENT_STATUS_MAP,
    isRefreshing: false,
  },

  _roleKey: null,

  onShow() {
    this._initRole();
    this.refreshTabBadges();
  },

  _initRole() {
    const userInfo = wx.getStorageSync("userInfo");
    const role = userInfo ? userInfo.role : "user";
    this._roleKey = ROLE_CONFIG[role] ? role : "user";
    const config = ROLE_CONFIG[this._roleKey];
    this.setData({
      role,
      pageTitle: config.pageTitle,
      quickEntries: config.quickEntries,
    });
    this._loadDashboard();
  },

  async _loadDashboard() {
    this.setData({ isLoading: true });
    const config = ROLE_CONFIG[this._roleKey];
    if (!config) return;
    try {
      await Promise.all(
        config.loaders.map((fn) => this[fn]())
      );
    } catch (err) {
      console.error("[Home] loadDashboard error:", err);
    } finally {
      this.setData({ isLoading: false, isRefreshing: false });
    }
  },

  async loadRecentAppointments() {
    try {
      const { data } = await appointmentService.getMyList();
      const recent = (data || []).slice(0, 3);
      this.setData({ recentAppointments: recent });
    } catch (err) {
      console.error("[Home] loadRecentAppointments error:", err);
    }
  },

  async loadAvailableAssessments() {
    try {
      const { data } = await assessmentService.getList();
      this.setData({ availableAssessments: data || [] });
    } catch (err) {
      console.error("[Home] loadAvailableAssessments error:", err);
    }
  },

  async loadConsultantStats() {
    try {
      const { data } = await appointmentService.getConsultantStats();
      this.setData({ consultantStats: data || {} });
    } catch (err) {
      console.error("[Home] loadConsultantStats error:", err);
    }
  },

  async loadConsultantPending() {
    try {
      const { data } = await appointmentService.getConsultantAppts("booked");
      this.setData({ consultantPendingList: (data || []).slice(0, 5) });
    } catch (err) {
      console.error("[Home] loadConsultantPending error:", err);
    }
  },

  async loadAdminStats() {
    try {
      const { data } = await appointmentService.adminGetStats();
      this.setData({ adminStats: data || {} });
    } catch (err) {
      console.error("[Home] loadAdminStats error:", err);
    }
  },

  async loadAdminPending() {
    try {
      const res = await appointmentService.adminGetList({
        status: "booked",
        page: 1,
        pageSize: 5,
      });
      this.setData({ adminPendingList: (res.data && res.data.list) || [] });
    } catch (err) {
      console.error("[Home] loadAdminPending error:", err);
    }
  },

  onRefresh() {
    this.setData({ isRefreshing: true });
    this._loadDashboard();
  },

  navToAppointmentList() {
    router.navigateTo({ url: "/pages/student/appointment-list/appointment-list" });
  },

  navToBookAppointment() {
    router.navigateTo({ url: "/pages/student/appointment/appointment" });
  },

  navToAssessment() {
    router.navigateTo({ url: "/pages/student/assessment/assessment" });
  },

  navToMood() {
    router.navigateTo({ url: "/pages/student/mood/mood?activeTab=record" });
  },

  navToConsultantAppointments() {
    router.switchTab({ url: "/pages/main/records/records" });
  },

  navToAdminConsultation() {
    router.switchTab({ url: "/pages/main/assessment/assessment" });
  },

  onQuickEntryTap(e) {
    const { url } = e.currentTarget.dataset;
    if (url) {
      router.navigateTo({ url });
    }
  },

  async refreshTabBadges() {
    const userInfo = wx.getStorageSync("userInfo");
    if (!userInfo) return;

    wx.nextTick(async () => {
      const tabBar = this.getTabBar();
      if (!tabBar || typeof tabBar.setBadge !== "function") return;

      try {
        if (userInfo.role === "admin") {
          const { data } = await appointmentService.adminGetStats();
          tabBar.setBadge("咨询管理", data.pending || 0);
        } else if (userInfo.role === "consultant") {
          const { data } = await appointmentService.getConsultantAppts();
          const pendingCount = (data || []).filter(
            (i) => i.status === "booked"
          ).length;
          tabBar.setBadge("预约管理", pendingCount);
        }
      } catch (err) {
        console.error("Refresh tab badges error:", err);
      }
    });
  },
});
