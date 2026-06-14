import Toast from "tdesign-miniprogram/toast/index";
import assessmentService from "../../../services/assessment";
import { SafePage } from "../../../utils/middleware";

SafePage({
  data: {
    assessments: [],
    allAssessments: [],
    isLoading: true,
    isRefreshing: false,
    navbarHeight: 0,
    keyword: "",
    rowSkeleton: [
      { width: "40%", height: "36rpx" },
      { width: "70%", height: "28rpx" },
      { width: "40%", height: "28rpx" },
    ],
  },

  onLoad() {
    this.setData({
      navbarHeight: getApp().globalData.navbarHeight,
    });
    this.fetchAssessments();
  },

  async fetchAssessments(silent = false) {
    if (!silent) this.setData({ isLoading: true });
    try {
      const res = await assessmentService.getList();
      const allData = res.data || [];

      const { keyword } = this.data;
      const filtered = keyword
        ? allData.filter((item) =>
            item.title.toLowerCase().includes(keyword.toLowerCase()),
          )
        : allData;

      this.setData({
        allAssessments: allData,
        assessments: filtered,
        isLoading: false,
        isRefreshing: false,
      });
    } catch (err) {
      console.error("Fetch assessments error", err);
      this.setData({
        isLoading: false,
        isRefreshing: false,
      });
      Toast({
        context: this,
        selector: "#t-toast",
        message: err.message || "获取列表失败",
        theme: "error",
        direction: "column",
      });
    }
  },

  onSearch(e) {
    const keyword = e.detail.value;
    this.setData({ keyword }, () => {
      this.filterList();
    });
  },

  onSearchClear() {
    this.setData({ keyword: "" }, () => {
      this.filterList();
    });
  },

  filterList() {
    const { keyword, allAssessments } = this.data;
    const assessments = keyword
      ? allAssessments.filter((item) =>
          item.title.toLowerCase().includes(keyword.toLowerCase()),
        )
      : allAssessments;
    this.setData({ assessments });
  },

  async onRefresh() {
    this.setData({ isRefreshing: true });
    await this.fetchAssessments(true);
  },

  startAssessment(e) {
    const { id, title } = e.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/student/assessment/assessment-detail/assessment-detail?id=${id}&title=${encodeURIComponent(title)}`,
    });
  },
});
