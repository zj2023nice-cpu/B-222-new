import Toast, { hideToast } from "tdesign-miniprogram/toast/index";
import appointmentService from "../../../../services/appointment";
import {
  APPOINTMENT_STATUS_LIST,
  APPOINTMENT_STATUS_MAP,
} from "../../../../utils/constants";

Component({
  options: {
    addGlobalClass: true,
    styleIsolation: "apply-shared",
  },

  data: {
    stats: {
      total: 0,
      pending: 0,
      confirmed: 0,
      completed: 0,
      cancelled: 0,
    },
    statusList: APPOINTMENT_STATUS_LIST,
    activeStatus: "",
    keyword: "",
    list: [],
    page: 1,
    pageSize: 10,
    hasMore: true,
    isLoading: true,
    pullDownRefreshing: false,
    stickyProps: {
      zIndex: 100,
      offsetTop: 0,
    },
    statusMap: APPOINTMENT_STATUS_MAP,
    showTrend: false,
    trendData: [],
    chartVisible: false,
  },

  lifetimes: {
    attached() {
      const app = getApp();
      this.setData({
        "stickyProps.offsetTop": app.globalData.navbarHeight,
      });
      this.initData();
    },
  },

  pageLifetimes: {
    show() {
      if (typeof this.getTabBar === "function" && this.getTabBar()) {
        this.getTabBar().setData({ value: 1 }); // Assuming consultation manage is index 1
      }
    },
  },

  methods: {
    async initData() {
      if (!this.data.pullDownRefreshing) {
        this.setData({ isLoading: true });
      }
      await Promise.all([this.loadStats(), this.loadList(true)]);
      this.setData({ isLoading: false });
    },

    async loadStats() {
      try {
        const res = await appointmentService.adminGetStats();
        if (res.code === 0) {
          const stats = res.data;
          this.setData({ stats });
          // 更新底部 Tab 徽标
          const tabBar = this.getTabBar();
          if (tabBar && typeof tabBar.setBadge === "function") {
            tabBar.setBadge("咨询管理", stats.pending || 0);
          }
        }
      } catch (err) {
        console.error("Load stats error:", err);
      }
    },

    async loadList(reset = false) {
      if (this.data.isLoading && !reset) return;

      try {
        const page = reset ? 1 : this.data.page;
        const res = await appointmentService.adminGetList({
          status: this.data.activeStatus,
          keyword: this.data.keyword,
          page,
          pageSize: this.data.pageSize,
        });

        if (res.code === 0) {
          const newList = res.data.list;
          this.setData({
            list: reset ? newList : [...this.data.list, ...newList],
            page: page + 1,
            hasMore: newList.length === this.data.pageSize,
            pullDownRefreshing: false,
          });
        }
      } catch (err) {
        console.error("Load list error:", err);
        Toast({
          context: this,
          selector: "#t-toast",
          message: "获取列表失败",
          theme: "error",
          direction: "column",
        });
      } finally {
        this.setData({ pullDownRefreshing: false });
      }
    },

    onSearch(e) {
      this.setData({ keyword: e.detail.value }, () => {
        this.loadList(true);
      });
    },

    onSearchClear() {
      this.setData({ keyword: "" }, () => {
        this.loadList(true);
      });
    },

    async updateStatus(e) {
      const { id, status } = e.currentTarget.dataset;
      const actionMap = {
        confirmed: "接受预约",
        rejected: "拒绝预约",
      };
      const actionText = actionMap[status] || "更新状态";

      try {
        await appointmentService.updateStatus(id, status);

        // 重新拉取数据以确保列表和徽标同步
        await this.initData();

        Toast({
          context: this,
          selector: "#t-toast",
          message: `操作成功：${actionText}`,
          theme: "success",
          direction: "column",
        });
      } catch (err) {
        console.error("管理员更新状态失败", err);
        Toast({
          context: this,
          selector: "#t-toast",
          message: "操作失败",
          theme: "error",
          direction: "column",
        });
      }
    },

    onStatusChange(e) {
      this.setData({ activeStatus: e.detail.value }, () => {
        this.loadList(true);
      });
    },

    switchToStatus(e) {
      const { status } = e.currentTarget.dataset;
      this.setData({ activeStatus: status }, () => {
        this.loadList(true);
      });
    },

    onPullDownRefresh() {
      this.setData({ pullDownRefreshing: true });
      this.initData();
    },

    onLoadMore() {
      if (this.data.hasMore && !this.data.isLoading) {
        this.loadList();
      }
    },

    onAvatarError(e) {
      const { index, type } = e.currentTarget.dataset;
      const key = `list[${index}].${type}Avatar`;
      this.setData({ [key]: "" });
    },

    async showTrendChart() {
      try {
        Toast({
          context: this,
          selector: "#t-toast",
          message: "正在生成趋势图...",
          theme: "loading",
          duration: 0,
          direction: "column",
        });

        const res = await appointmentService.adminGetTrend();

        // Hide loading toast
        hideToast({
          context: this,
          selector: "#t-toast",
        });

        if (res.code === 0) {
          this.setData({
            trendData: res.data,
            chartVisible: true,
          });
          // Wait for popup transition and then draw
          setTimeout(() => {
            this.drawTrendChart(res.data);
          }, 300);
        }
      } catch (err) {
        console.error("Load trend error:", err);
        Toast({
          context: this,
          selector: "#t-toast",
          message: "获取趋势数据失败",
          theme: "error",
          direction: "column",
        });
      }
    },

    closeTrendChart() {
      this.setData({ chartVisible: false });
    },

    drawTrendChart(data) {
      const query = wx.createSelectorQuery().in(this);
      query
        .select("#trendCanvas")
        .fields({ node: true, size: true })
        .exec((res) => {
          if (!res[0]) return;
          const canvas = res[0].node;
          const ctx = canvas.getContext("2d");

          const dpr = getApp().globalData.pixelRatio || 1;
          canvas.width = res[0].width * dpr;
          canvas.height = res[0].height * dpr;
          ctx.scale(dpr, dpr);

          const width = res[0].width;
          const height = res[0].height;
          const padding = { top: 40, right: 30, bottom: 40, left: 40 };

          // Clear canvas
          ctx.clearRect(0, 0, width, height);

          if (!data || data.length === 0) return;

          const maxCount = Math.max(...data.map((d) => d.count), 5);
          const stepX =
            (width - padding.left - padding.right) / (data.length - 1);
          const stepY = (height - padding.top - padding.bottom) / maxCount;

          // Draw axes
          ctx.strokeStyle = "#e2e8f0";
          ctx.lineWidth = 1;

          // Y axis grid lines (5 lines)
          for (let i = 0; i <= 5; i++) {
            const y =
              height -
              padding.bottom -
              (i * (height - padding.top - padding.bottom)) / 5;
            ctx.beginPath();
            ctx.moveTo(padding.left, y);
            ctx.lineTo(width - padding.right, y);
            ctx.stroke();

            // Y labels
            ctx.fillStyle = "#94a3b8";
            ctx.font = "10px sans-serif";
            ctx.textAlign = "right";
            const val = Math.round((maxCount / 5) * i);
            ctx.fillText(val, padding.left - 10, y + 4);
          }

          // Draw line
          ctx.beginPath();
          ctx.strokeStyle = "#3b82f6";
          ctx.lineWidth = 2;
          ctx.lineJoin = "round";
          ctx.lineCap = "round";

          data.forEach((d, i) => {
            const x = padding.left + i * stepX;
            const y = height - padding.bottom - d.count * stepY;
            if (i === 0) {
              ctx.moveTo(x, y);
            } else {
              ctx.lineTo(x, y);
            }
          });
          ctx.stroke();

          // Draw area under line
          ctx.lineTo(
            padding.left + (data.length - 1) * stepX,
            height - padding.bottom,
          );
          ctx.lineTo(padding.left, height - padding.bottom);
          ctx.closePath();
          const gradient = ctx.createLinearGradient(
            0,
            padding.top,
            0,
            height - padding.bottom,
          );
          gradient.addColorStop(0, "rgba(59, 130, 246, 0.2)");
          gradient.addColorStop(1, "rgba(59, 130, 246, 0)");
          ctx.fillStyle = gradient;
          ctx.fill();

          // Draw dots and X labels
          data.forEach((d, i) => {
            const x = padding.left + i * stepX;
            const y = height - padding.bottom - d.count * stepY;

            // Dots
            ctx.beginPath();
            ctx.arc(x, y, 4, 0, Math.PI * 2);
            ctx.fillStyle = "#ffffff";
            ctx.fill();
            ctx.strokeStyle = "#3b82f6";
            ctx.lineWidth = 2;
            ctx.stroke();

            // Values on top of dots
            ctx.fillStyle = "#1e293b";
            ctx.font = "bold 10px sans-serif";
            ctx.textAlign = "center";
            ctx.fillText(d.count, x, y - 10);

            // X labels
            ctx.fillStyle = "#64748b";
            ctx.font = "10px sans-serif";
            ctx.textAlign = "center";
            ctx.fillText(d.date, x, height - padding.bottom + 20);
          });
        });
    },
  },
});
