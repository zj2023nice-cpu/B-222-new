import Toast from "tdesign-miniprogram/toast/index";
import assessmentService from "../../services/assessment";

Component({
  properties: {
    role: {
      type: String,
      value: "user", // 'user' or 'consultant'
    },
    navbarHeight: {
      type: Number,
      value: 88,
    },
  },

  data: {
    records: [],
    isLoading: true,
    isRefreshing: false,
    searchQuery: "",
    rowSkeleton: [
      { width: "30%", height: "32rpx", margin: "0 0 24rpx 0" },
      { width: "80%", height: "48rpx", margin: "0 0 32rpx 0" },
      { width: "100%", height: "96rpx" },
    ],
  },

  lifetimes: {
    attached() {
      this.fetchRecords();
    },
  },

  methods: {
    async onRefresh() {
      this.setData({ isRefreshing: true });
      await this.fetchRecords(true);
    },

    onSearch(e) {
      this.setData({ searchQuery: e.detail.value });
      this.fetchRecords();
    },

    onImageError(e) {
      const { index } = e.currentTarget.dataset;
      this.setData({
        [`records[${index}].userAvatar`]: "",
      });
    },

    async fetchRecords(silent = false) {
      if (!silent) this.setData({ isLoading: true });
      try {
        let res;
        // 咨询端调用 getUserRecords (看全校)，学生端调用 getStudentRecords (看自己)
        if (this.data.role === "consultant") {
          res = await assessmentService.getUserRecords(this.data.searchQuery);
        } else {
          res = await assessmentService.getStudentRecords(
            this.data.searchQuery,
          );
        }

        const records = res.data.map((item) => {
          let date;
          if (item.createTime && item.createTime.ms) {
            date = new Date(item.createTime.ms);
          } else if (item.createTime && item.createTime.$date) {
            date = new Date(item.createTime.$date);
          } else {
            date = new Date(item.createTime || Date.now());
          }

          const m = (date.getMonth() + 1).toString().padStart(2, "0");
          const d = date.getDate().toString().padStart(2, "0");
          const h = date.getHours().toString().padStart(2, "0");
          const min = date.getMinutes().toString().padStart(2, "0");

          return {
            ...item,
            dateStr: isNaN(date.getTime())
              ? "未知时间"
              : `${date.getFullYear()}-${m}-${d} ${h}:${min}`,
            tagText: "自主测评",
            tagTheme: "success",
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
        this.setData({
          isLoading: false,
          isRefreshing: false,
        });
      }
    },
  },
});
