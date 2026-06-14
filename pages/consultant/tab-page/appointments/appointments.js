import Toast from "tdesign-miniprogram/toast/index";
import appointmentService from "../../../../services/appointment";
import assessmentService from "../../../../services/assessment";
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
    appointments: [],
    allAppointments: [],
    isLoading: true,
    isRefreshing: false,
    statusList: APPOINTMENT_STATUS_LIST,
    activeStatus: "",
    keyword: "",
    statusMap: APPOINTMENT_STATUS_MAP,
    stickyProps: {
      zIndex: 100,
      offsetTop: 0,
    },
    pendingCount: 0,
    isUpdatingStatus: false,
    isEvaluating: false,
    isDeleting: false,
    isFetching: false,
    rowCol: [
      [
        {
          width: "80rpx",
          height: "80rpx",
          type: "circle",
          margin: "0 24rpx 0 0",
        },
        { width: "30%", height: "40rpx" },
        {
          width: "20%",
          height: "40rpx",
          margin: "0 0 0 auto",
          borderRadius: "8rpx",
        },
      ],
      { width: "40%", height: "26rpx" },
      { width: "40%", height: "26rpx" },
      { width: "60%", height: "26rpx" },
      { width: "60%", height: "26rpx" },
      [
        {
          width: "160rpx",
          height: "60rpx",
          borderRadius: "30rpx",
          margin: "0 24rpx 0 auto",
        },
        {
          width: "160rpx",
          height: "60rpx",
          borderRadius: "30rpx",
          margin: "0",
        },
      ],
    ],
    forceLoading: false, // 骨架屏调试开关
  },

  lifetimes: {
    attached() {
      const app = getApp();
      this.setData({
        "stickyProps.offsetTop": app.globalData.navbarHeight,
      });
      this.fetchAppointments();
    },
  },

  pageLifetimes: {
    show() {
      this.fetchAppointments();
    },
  },

  methods: {
    async onRefresh() {
      this.setData({ isRefreshing: true });
      await this.fetchAppointments(true);
    },

    resetCardLock(cardIndex) {
      if (cardIndex === undefined || cardIndex === null || cardIndex < 0) return;
      const card = this.selectComponent(`#appt-card-${cardIndex}`);
      if (card && typeof card.resetActionLock === "function") {
        card.resetActionLock();
      }
    },
    hideCardEvalDialog(cardIndex) {
      if (cardIndex === undefined || cardIndex === null || cardIndex < 0) return;
      const card = this.selectComponent(`#appt-card-${cardIndex}`);
      if (card && typeof card.hideEvalDialog === "function") {
        card.hideEvalDialog();
      }
    },

    async fetchAppointments(isSilent = false) {
      if (this.data.isFetching) return;
      if (!isSilent) {
        this.setData({ isLoading: true });
      }
      this.setData({ isFetching: true });
      try {
        const { data } = await appointmentService.getConsultantAppts();
        const pendingCount = data.filter(
          (item) => item.status === "booked",
        ).length;

        this.setData(
          {
            allAppointments: data || [],
            pendingCount,
          },
          () => {
            this.filterList();
          },
        );

        // 更新底部 Tab 徽标
        const tabBar = this.getTabBar();
        if (tabBar && typeof tabBar.setBadge === "function") {
          tabBar.setBadge("预约管理", pendingCount);
        }
      } catch (err) {
        console.error("获取预约列表失败", err);
        Toast({
          context: this,
          selector: "#t-toast",
          message: "加载失败",
          theme: "error",
          direction: "column",
        });
      } finally {
        this.setData({ isLoading: false, isRefreshing: false, isFetching: false });
      }
    },

    filterList() {
      const { allAppointments, activeStatus, keyword } = this.data;
      let appointments = allAppointments;

      if (activeStatus) {
        appointments = appointments.filter((a) => a.status === activeStatus);
      }

      if (keyword) {
        const lowerKeyword = keyword.toLowerCase();
        appointments = appointments.filter((a) =>
          a.studentName?.toLowerCase().includes(lowerKeyword),
        );
      }

      this.setData({ appointments });
    },

    onSearch(e) {
      const { value } = e.detail;
      this.setData({ keyword: value }, () => {
        this.filterList();
      });
    },

    onSearchClear() {
      this.setData({ keyword: "" }, () => {
        this.filterList();
      });
    },

    async onCardAction(e) {
      if (
        this.data.isUpdatingStatus ||
        this.data.isEvaluating ||
        this.data.isDeleting
      ) {
        return;
      }
      const { action, index, item, evaluation } = e.detail;
      const id = item._id;

      if (
        action === "reject" ||
        action === "confirm" ||
        action === "complete"
      ) {
        const status =
          action === "reject"
            ? "rejected"
            : action === "confirm"
              ? "confirmed"
              : "completed";
        await this.handleUpdateStatus(id, status, index);
      } else if (action === "evaluate") {
        await this.handleEvaluate(id, item, evaluation, index);
      } else if (action === "delete") {
        await this.handleDelete(id, index);
      }
    },

    async handleUpdateStatus(id, status, cardIndex) {
      if (this.data.isUpdatingStatus) return;
      const actionMap = {
        confirmed: "接受预约",
        rejected: "拒绝预约",
        completed: "咨询结束",
      };
      this.setData({ isUpdatingStatus: true });
      try {
        await appointmentService.updateStatus(id, status);
        await this.fetchAppointments();
        Toast({
          context: this,
          selector: "#t-toast",
          message: `操作成功：${actionMap[status] || "已更新"}`,
          theme: "success",
          direction: "column",
        });
      } catch (err) {
        console.error("更新状态失败", err);
        Toast({
          context: this,
          selector: "#t-toast",
          message: err.message || "操作失败",
          theme: "error",
          direction: "column",
        });
      } finally {
        this.setData({ isUpdatingStatus: false });
        this.resetCardLock(cardIndex);
      }
    },

    async handleEvaluate(id, item, evaluation, cardIndex) {
      if (this.data.isEvaluating) return;
      this.setData({ isEvaluating: true });
      Toast({
        context: this,
        selector: "#t-toast",
        message: "提交中...",
        theme: "loading",
        direction: "column",
        duration: 0,
      });

      try {
        await assessmentService.submitEvaluation({
          currentApptId: id,
          evalScore: evaluation.score,
          evalResult: evaluation.result,
          studentOpenid: item._openid,
          studentName: item.studentName,
          studentAvatar: item.studentAvatar,
        });

        Toast({
          context: this,
          selector: "#t-toast",
          message: "评估已提交",
          theme: "success",
          direction: "column",
          duration: 2000,
        });

        this.hideCardEvalDialog(cardIndex);

        setTimeout(async () => {
          await this.fetchAppointments(true);
        }, 2000);
      } catch (err) {
        console.error("提交评估失败", err);
        Toast({
          context: this,
          selector: "#t-toast",
          message: err.message || "提交失败",
          theme: "error",
          direction: "column",
        });
      } finally {
        this.setData({ isEvaluating: false });
        this.resetCardLock(cardIndex);
      }
    },

    async handleDelete(id, cardIndex) {
      if (this.data.isDeleting) return;
      this.setData({ isDeleting: true });
      try {
        await appointmentService.delete(id, "consultant");
        await this.fetchAppointments();
        Toast({
          context: this,
          selector: "#t-toast",
          message: "删除成功",
          theme: "success",
          direction: "column",
        });
      } catch (err) {
        console.error("删除记录失败", err);
        Toast({
          context: this,
          selector: "#t-toast",
          message: err.message || "删除失败",
          theme: "error",
          direction: "column",
        });
      } finally {
        this.setData({ isDeleting: false });
        this.resetCardLock(cardIndex);
      }
    },

    onStatusChange(e) {
      const { value } = e.detail;
      this.setData({ activeStatus: value }, () => {
        this.filterList();
      });
    },

    onAvatarError(e) {
      const { index } = e.detail;
      this.setData({
        [`appointments[${index}].studentAvatar`]: "",
      });
    },
  },
});
