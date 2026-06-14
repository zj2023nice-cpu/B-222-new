import Toast from "tdesign-miniprogram/toast/index";
import assessmentService from "../../../../services/assessment";
import router from "../../../../utils/router";

Component({
  options: {
    styleIsolation: "apply-shared",
  },
  data: {
    assessments: [],
    allAssessments: [], // 保存完整列表用于过滤
    searchValue: "",
    isLoading: true,
    isRefreshing: false,
    rowSkeleton: [
      { width: "60%", height: "32rpx" },
      { width: "90%", height: "24rpx" },
      { width: "40%", height: "24rpx" },
    ],
  },

  lifetimes: {
    attached() {
      this.fetchAssessments();
    },
  },

  pageLifetimes: {
    show() {
      this.fetchAssessments();
    },
  },

  methods: {
    async fetchAssessments(silent = false) {
      if (!silent) this.setData({ isLoading: true });
      try {
        const res = await assessmentService.getList();
        const allAssessments = res.data || [];
        this.setData({ allAssessments });
        this.filterAssessments();
      } catch (err) {
        console.error("Fetch assessments error", err);
        Toast({
          context: this,
          selector: "#t-toast",
          message: err.message || "获取列表失败",
          theme: "error",
          direction: "column",
        });
      } finally {
        if (!silent) this.setData({ isLoading: false });
        this.setData({ isRefreshing: false });
      }
    },

    filterAssessments() {
      const { allAssessments, searchValue } = this.data;
      if (!searchValue) {
        this.setData({ assessments: allAssessments });
        return;
      }

      const filtered = allAssessments.filter((item) => {
        const titleMatch = (item.title || "")
          .toLowerCase()
          .includes(searchValue.toLowerCase());
        const descMatch = (item.description || "")
          .toLowerCase()
          .includes(searchValue.toLowerCase());
        return titleMatch || descMatch;
      });

      this.setData({ assessments: filtered });
    },

    onSearchChange(e) {
      this.setData(
        {
          searchValue: e.detail.value,
        },
        () => {
          this.filterAssessments();
        },
      );
    },

    onSearchClear() {
      this.setData(
        {
          searchValue: "",
        },
        () => {
          this.filterAssessments();
        },
      );
    },

    async onRefresh() {
      this.setData({ isRefreshing: true });
      await this.fetchAssessments(true);
    },

    addAssessment() {
      router.navigateTo({
        url: "/pages/consultant/assessment-edit/edit",
      });
    },

    editAssessment(e) {
      const { id } = e.currentTarget.dataset;
      router.navigateTo({
        url: `/pages/consultant/assessment-edit/edit?id=${id}`,
      });
    },
  },
});
