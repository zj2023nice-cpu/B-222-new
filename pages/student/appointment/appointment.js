import Toast from "tdesign-miniprogram/toast/index";
const appointmentService = require("../../../services/appointment").default;

Page({
  data: {
    consultants: [],
    isLoading: true,
    avatarSkeleton: [{ size: "120rpx", type: "circle" }],
    infoSkeleton: [
      { width: "40%", height: "28rpx", margin: "0 0 2rpx 0" },
      { width: "20%", height: "22rpx", margin: "0 0 2rpx 0" },
      { width: "90%", height: "22rpx", margin: "0 0 2rpx 0" },
      { width: "100%", height: "22rpx", margin: "0 0 2rpx 0" },
    ],

    showSchedulePopup: false,
    selectedConsultant: null,
    selectedConsultantIndex: -1,

    availableDates: [],
    selectedDateIndex: 0,
    timeSlots: [],
    selectedTimeIndex: -1,

    showBookDialog: false,
    showCancelDialog: false,
    isPageLoading: false,
    hasActiveAppt: false,
    isRefreshing: false,
    allConsultants: [],
    keyword: "",
    navbarHeight: 0,

    showWaitlistDialog: false,
    waitlistDateStr: "",
    showCancelWaitlistDialog: false,

    showDetailPanel: false,
    detailConsultant: null,
  },

  // 获取从当天开始的未来 N 天日期
  getNextNDays(n) {
    const dates = [];
    const weekDays = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
    const now = new Date();
    let offset = 1; // Start from tomorrow

    // 获取当前咨询师的已被预约记录（在book方法中，这部分是实时获取的，但在onSelectDate中需要预先判断是否全满）
    // 由于这里是在前端生成日期，具体的“全满”逻辑需要在 fetchConsultants 后，结合 consultants 数据动态计算
    // 所以这里只生成基础日期结构，全满状态在 fetchConsultants 或 onSelectDate 中计算

    while (dates.length < n) {
      const date = new Date(now);
      date.setDate(now.getDate() + offset);

      const dayOfWeek = date.getDay();
      // 0 = 周日, 6 = 周六
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        const year = date.getFullYear();
        const month = date.getMonth() + 1;
        const day = date.getDate();
        const week = weekDays[dayOfWeek];

        dates.push({
          month: `${month}月`,
          day: day < 10 ? `0${day}` : `${day}`,
          dateStr: `${year}-${month < 10 ? "0" + month : month}-${day < 10 ? "0" + day : day}`,
          week: offset === 0 ? "今天" : week,
        });
      }
      offset++;
    }
    return dates;
  },

  async onLoad() {
    this.setData({
      navbarHeight: getApp().globalData.navbarHeight,
    });
    this.fetchConsultants();
  },

  async onPullDownRefresh() {
    this.setData({ isRefreshing: true });
    await this.fetchConsultants();
    this.setData({ isRefreshing: false });
  },

  async fetchConsultants(silent = false) {
    if (!silent) this.setData({ isLoading: true });
    try {
      const userInfo = wx.getStorageSync("userInfo");
      if (!userInfo) return;

      // 如果是下拉刷新，强制等待1秒，让用户感知到刷新效果
      if (this.data.isRefreshing) {
        await new Promise((resolve) => setTimeout(resolve, 800));
      }

      // 1. 动态生成未来 3 天的日期
      const dates = this.getNextNDays(3);
      this.setData({ availableDates: dates });

      // 2. 调用服务获取所有咨询师及其真实排班
      const { data: allConsultants, hasActiveAppt } =
        await appointmentService.getConsultants(dates);

      const enrichedConsultants = allConsultants.map((c) => ({
        ...c,
        hasWaitlist:
          c.schedule &&
          c.schedule.some(
            (s) => s.waitlistStatus === "waiting" || s.waitlistStatus === "notified",
          ),
      }));

      this.setData(
        {
          allConsultants: enrichedConsultants,
          hasActiveAppt,
        },
        () => {
          this.filterList();
        },
      );
    } catch (err) {
      console.error("获取咨询数据失败", err);
      Toast({
        context: this,
        selector: "#t-toast",
        message: "数据加载失败",
        theme: "error",
        direction: "column",
      });
    } finally {
      if (!silent) this.setData({ isLoading: false });
    }
  },

  filterList() {
    const { allConsultants, keyword } = this.data;
    let consultants = allConsultants;

    if (keyword) {
      const lowerKeyword = keyword.toLowerCase();
      consultants = consultants.filter(
        (c) =>
          c.name?.toLowerCase().includes(lowerKeyword) ||
          c.expertise?.toLowerCase().includes(lowerKeyword),
      );
    }

    this.setData({ consultants });
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

  onAvatarError(e) {
    const { index } = e.currentTarget.dataset;
    this.setData({
      [`consultants[${index}].avatar`]: "",
    });
  },

  onCardTap(e) {
    const { index } = e.currentTarget.dataset;
    const consultant = this.data.consultants[index];
    if (!consultant) return;

    const schedule = consultant.schedule || [];
    const fullDateCount = schedule.filter((s) => s.isFull).length;
    const allFull = schedule.length > 0 && fullDateCount === schedule.length;

    const availableSummary = schedule.map((s) => {
      const availableSlots = (s.slots || []).filter((slot) => !slot.isFull).length;
      return {
        dateStr: s.dateStr || "",
        isFull: s.isFull,
        availableSlots,
        totalSlots: (s.slots || []).length,
      };
    });

    this.setData({
      showDetailPanel: true,
      detailConsultant: {
        ...consultant,
        _availableSummary: availableSummary,
        _allFull: allFull,
        _fullDateCount: fullDateCount,
        _totalDateCount: schedule.length,
      },
    });
  },

  onCloseDetailPanel() {
    this.setData({ showDetailPanel: false });
  },

  // 点击预约按钮：打开排班选择或取消预约
  book(e) {
    const { index } = e.currentTarget.dataset;
    const consultant = this.data.consultants[index];

    if (consultant.isBooked) {
      this.setData({
        selectedConsultant: consultant,
        selectedConsultantIndex: index,
        showCancelDialog: true,
      });
      return;
    }
    if (this.data.hasActiveAppt) {
      Toast({
        context: this,
        selector: "#t-toast",
        message: "您已有待咨询的预约\n暂不能预约更多",
        theme: "warning",
        direction: "column",
        placement: "middle",
      });
      return;
    }

    const availableDates = this.data.availableDates.map((date, dIndex) => {
      const dailySchedule = consultant.schedule.find(
        (s) => s.dateStr === date.dateStr,
      );
      const isFull = dailySchedule
        ? dailySchedule.slots.every((slot) => slot.isFull)
        : true;
      const waitlistStatus = dailySchedule ? dailySchedule.waitlistStatus : "";
      const waitlistId = dailySchedule ? dailySchedule.waitlistId : "";
      const queueNumber = dailySchedule ? dailySchedule.queueNumber : 0;
      return { ...date, isFull, waitlistStatus, waitlistId, queueNumber };
    });

    let defaultDateIndex = availableDates.findIndex((d) => !d.isFull);
    if (defaultDateIndex === -1) defaultDateIndex = 0;

    this.setData({
      selectedConsultant: consultant,
      selectedConsultantIndex: index,
      showSchedulePopup: true,
      availableDates: availableDates,
      selectedDateIndex: defaultDateIndex,
      selectedTimeIndex: -1,
      timeSlots: consultant.schedule[defaultDateIndex]
        ? consultant.schedule[defaultDateIndex].slots
        : [],
    });
  },

  onClosePopup() {
    this.setData({ showSchedulePopup: false });
  },

  // 切换日期
  onSelectDate(e) {
    const { index } = e.currentTarget.dataset;
    const selectedDate = this.data.availableDates[index];
    if (selectedDate.isFull && !selectedDate.waitlistStatus) return;

    const scheduleItem = this.data.selectedConsultant.schedule[index];
    const slots = scheduleItem ? scheduleItem.slots || [] : [];
    this.setData({
      selectedDateIndex: index,
      selectedTimeIndex: -1,
      timeSlots: slots,
    });
  },

  // 选择时间段
  onSelectTime(e) {
    const { index } = e.currentTarget.dataset;
    const slot = this.data.timeSlots[index];
    if (slot.isFull) return;

    this.setData({ selectedTimeIndex: index });
  },

  // 打开确认弹窗
  handleConfirmSelection() {
    if (this.data.selectedTimeIndex === -1) {
      Toast({
        context: this,
        selector: "#t-toast",
        message: "请选择时间",
        theme: "warning",
        direction: "column",
      });
      return;
    }
    this.setData({
      showSchedulePopup: false,
      showBookDialog: true,
    });
  },

  closeBookDialog() {
    this.setData({ showBookDialog: false });
  },

  async confirmBooking() {
    const index = this.data.selectedConsultantIndex;
    const consultant = this.data.selectedConsultant;
    const dateStr =
      this.data.availableDates[this.data.selectedDateIndex].dateStr;
    const time = this.data.timeSlots[this.data.selectedTimeIndex].time;

    this.setData({ showBookDialog: false });

    try {
      const { _id } = await appointmentService.book({
        consultantId: consultant._id,
        consultantName: consultant.name,
        consultantAvatar: consultant.avatar,
        consultantTitle: consultant.title,
        dateStr: dateStr,
        time: time,
      });

      // 更新本地状态
      const updateData = {};
      const prefix = `consultants[${index}]`;
      updateData[`${prefix}.isBooked`] = true;
      updateData[`${prefix}.bookedId`] = _id;
      updateData[`${prefix}.bookedDate`] = dateStr;
      updateData[`${prefix}.bookedTime`] = time;

      this.setData(updateData);
      this.fetchConsultants(true); // 静默刷新，同步排班状态

      Toast({
        context: this,
        selector: "#t-toast",
        message: "预约成功",
        theme: "success",
        direction: "column",
      });
    } catch (err) {
      Toast({
        context: this,
        selector: "#t-toast",
        message: err.message || "预约失败",
        theme: "error",
        direction: "column",
      });
    } finally {
    }
  },

  // 取消预约逻辑
  closeCancelDialog() {
    this.setData({ showCancelDialog: false });
  },

  async confirmCancelBooking() {
    const index = this.data.selectedConsultantIndex;
    const consultant = this.data.consultants[index];

    this.setData({ showCancelDialog: false });

    try {
      await appointmentService.cancel(consultant.bookedId);

      const updateData = {};
      const prefix = `consultants[${index}]`;
      updateData[`${prefix}.isBooked`] = false;
      updateData[`${prefix}.bookedId`] = "";
      updateData[`${prefix}.bookedDate`] = "";
      updateData[`${prefix}.bookedTime`] = "";

      this.setData(updateData);
      this.fetchConsultants(true);

      Toast({
        context: this,
        selector: "#t-toast",
        message: "已取消预约",
        theme: "success",
        direction: "column",
      });
    } catch (err) {
      console.error("取消预约失败", err);
      Toast({
        context: this,
        selector: "#t-toast",
        message: "操作失败",
        theme: "error",
        direction: "column",
      });
    } finally {
    }
  },

  onJoinWaitlist() {
    const selectedDate = this.data.availableDates[this.data.selectedDateIndex];
    if (!selectedDate || !selectedDate.isFull) return;
    if (selectedDate.waitlistStatus) return;

    this.setData({
      showSchedulePopup: false,
      showWaitlistDialog: true,
      waitlistDateStr: selectedDate.dateStr,
    });
  },

  closeWaitlistDialog() {
    this.setData({ showWaitlistDialog: false });
  },

  async confirmJoinWaitlist() {
    const consultant = this.data.selectedConsultant;
    const dateStr = this.data.waitlistDateStr;

    this.setData({ showWaitlistDialog: false });

    try {
      const { data } = await appointmentService.joinWaitlist({
        consultantId: consultant._id,
        consultantName: consultant.name,
        consultantAvatar: consultant.avatar,
        consultantTitle: consultant.title,
        dateStr,
      });

      this.fetchConsultants(true);

      Toast({
        context: this,
        selector: "#t-toast",
        message: `候补登记成功，当前排队第${data.queueNumber}位`,
        theme: "success",
        direction: "column",
      });
    } catch (err) {
      Toast({
        context: this,
        selector: "#t-toast",
        message: err.message || "候补登记失败",
        theme: "error",
        direction: "column",
      });
    }
  },

  onCancelWaitlist() {
    const selectedDate = this.data.availableDates[this.data.selectedDateIndex];
    if (!selectedDate || !selectedDate.waitlistId) return;

    this.setData({
      showSchedulePopup: false,
      showCancelWaitlistDialog: true,
    });
  },

  closeCancelWaitlistDialog() {
    this.setData({ showCancelWaitlistDialog: false });
  },

  async confirmCancelWaitlist() {
    const selectedDate = this.data.availableDates[this.data.selectedDateIndex];

    this.setData({ showCancelWaitlistDialog: false });

    try {
      await appointmentService.cancelWaitlist(selectedDate.waitlistId);

      this.fetchConsultants(true);

      Toast({
        context: this,
        selector: "#t-toast",
        message: "已退出候补",
        theme: "success",
        direction: "column",
      });
    } catch (err) {
      Toast({
        context: this,
        selector: "#t-toast",
        message: err.message || "操作失败",
        theme: "error",
        direction: "column",
      });
    }
  },
});
