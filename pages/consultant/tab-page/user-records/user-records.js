import Toast from "tdesign-miniprogram/toast/index";
import assessmentService from "../../../../services/assessment";

Component({
  options: {
    addGlobalClass: true,
    styleIsolation: "shared",
  },
  data: {
    records: [],
    isLoading: true,
    isRefreshing: false,
    searchQuery: "",
    navbarHeight: 0,
    showDetailDialog: false,
    currentDetail: null,
    rowCol: [
      [
        {
          width: "72rpx",
          height: "72rpx",
          type: "circle",
          margin: "0 16rpx 0 0",
        },
        { width: "30%", height: "40rpx" },
        { width: "10%", height: "40rpx", margin: "0 0 0 auto" },
      ],
      { width: "60%", height: "40rpx" },
      { width: "100%", height: "60rpx" },
      [
        { width: "50%", height: "30rpx" },
        { width: "10%", height: "30rpx" },
      ],
    ],
    forceLoading: false, // 骨架屏调试开关
  },

  lifetimes: {
    attached() {
      const app = getApp();
      this.setData({
        navbarHeight: app.globalData.navbarHeight,
      });
      this.fetchRecords();
    },
  },

  methods: {
    onSearch(e) {
      this.setData({ searchQuery: e.detail.value });
      this.fetchRecords();
    },

    onImageError(e) {
      const { index } = e.currentTarget.dataset;
      const key = `records[${index}].userAvatar`;
      this.setData({
        [key]: "",
      });
    },

    onRefresh() {
      this.setData({ isRefreshing: true });
      this.fetchRecords();
    },

    async fetchRecords() {
      if (!this.data.isRefreshing) {
        this.setData({ isLoading: true });
      }
      try {
        const res = await assessmentService.getConsultationRecords(
          this.data.searchQuery,
        );

        const records = res.data.map((item) => {
          const date = new Date(item.createTime);
          const m = (date.getMonth() + 1).toString().padStart(2, "0");
          const d = date.getDate().toString().padStart(2, "0");
          const h = date.getHours().toString().padStart(2, "0");
          const min = date.getMinutes().toString().padStart(2, "0");
          return {
            ...item,
            dateStr: `${date.getFullYear()}-${m}-${d} ${h}:${min}`,
          };
        });

        this.setData({ records });
      } catch (err) {
        console.error("Fetch records error", err);
        Toast({
          context: this,
          selector: "#t-toast",
          message: "获取记录失败",
          theme: "error",
          direction: "column",
        });
      } finally {
        this.setData({ isLoading: false, isRefreshing: false });
      }
    },

    viewDetail(e) {
      const { id } = e.currentTarget.dataset;
      const record = this.data.records.find((r) => r._id === id);
      if (record) {
        this.setData({
          currentDetail: record,
          showDetailDialog: true,
        });
      }
    },

    closeDetailDialog() {
      this.setData({
        showDetailDialog: false,
        currentDetail: null,
      });
    },
  },
});
