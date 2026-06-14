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

    isBookingSubmitting: false,
    isCancelSubmitting: false,
    isJoinWaitlistSubmitting: false,
    isCancelWaitlistSubmitting: false,
    isSilentRefreshing: false,
  },

  findFirstAvailableSlot(slots) {
    return (slots || []).findIndex((slot) => !slot.isFull);
  },

  getSlotsByDateStr(consultant, dateStr) {
    const scheduleItem = (consultant.schedule || []).find(
      (s) => s.dateStr === dateStr,
    );
    return scheduleItem ? scheduleItem.slots || [] : [];
  },

  repairSelectionState({ prevDateStr, prevTime, availableDates, consultant }) {
    const messages = [];
    let dateIndex = 0;
    let timeIndex = -1;

    const firstAvailDateIndex = availableDates.findIndex(
      (d) => !d.isFull || d.waitlistStatus,
    );
    if (firstAvailDateIndex === -1) {
      return { dateIndex: 0, timeIndex: -1, messages };
    }

    const prevDateIdx = availableDates.findIndex((d) => d.dateStr === prevDateStr);
    const dateIsValid =
      prevDateIdx !== -1 &&
      (!availableDates[prevDateIdx].isFull || availableDates[prevDateIdx].waitlistStatus);

    if (dateIsValid) {
      dateIndex = prevDateIdx;
      const slots = this.getSlotsByDateStr(consultant, prevDateStr);
      const firstSlotIdx = this.findFirstAvailableSlot(slots);

      if (prevTime) {
        const prevTimeIdx = slots.findIndex(
          (s) => s.time === prevTime && !s.isFull,
        );
        if (prevTimeIdx !== -1) {
          timeIndex = prevTimeIdx;
        } else if (firstSlotIdx !== -1) {
          timeIndex = firstSlotIdx;
          messages.push(`所选时段已不可用，已自动切换到 ${slots[timeIndex].time}`);
        }
      } else {
        timeIndex = firstSlotIdx;
      }
    } else {
      dateIndex = firstAvailDateIndex;
      const newDate = availableDates[dateIndex];
      messages.push(
        `所选日期已不可用，已自动切换到 ${newDate.week} ${newDate.month}${newDate.day}`,
      );

      const slots = this.getSlotsByDateStr(consultant, newDate.dateStr);
      const firstSlotIdx = this.findFirstAvailableSlot(slots);

      if (prevTime) {
        const prevTimeInNewDate = slots.findIndex(
          (s) => s.time === prevTime && !s.isFull,
        );
        if (prevTimeInNewDate !== -1) {
          timeIndex = prevTimeInNewDate;
        } else if (firstSlotIdx !== -1) {
          timeIndex = firstSlotIdx;
          messages.push(`所选时段已不可用，已自动切换到 ${slots[timeIndex].time}`);
        }
      } else {
        timeIndex = firstSlotIdx;
      }
    }

    return { dateIndex, timeIndex, messages };
  },

  showMessages(messages) {
    if (!messages || messages.length === 0) return;
    messages.forEach((msg, i) => {
      setTimeout(() => {
        Toast({
          context: this,
          selector: "#t-toast",
          message: msg,
          theme: "warning",
          direction: "column",
          placement: "middle",
        });
      }, i * 800);
    });
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
    if (silent && this.data.isSilentRefreshing) return;
    if (!silent) this.setData({ isLoading: true });
    if (silent) this.setData({ isSilentRefreshing: true });
    try {
      const userInfo = wx.getStorageSync("userInfo");
      if (!userInfo) return;

      if (this.data.isRefreshing) {
        await new Promise((resolve) => setTimeout(resolve, 800));
      }

      const dates = this.getNextNDays(3);
      this.setData({ availableDates: dates });

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
      if (!silent) {
        Toast({
          context: this,
          selector: "#t-toast",
          message: "数据加载失败",
          theme: "error",
          direction: "column",
        });
      }
    } finally {
      if (!silent) this.setData({ isLoading: false });
      if (silent) this.setData({ isSilentRefreshing: false });
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
    if (
      this.data.isBookingSubmitting ||
      this.data.isCancelSubmitting ||
      this.data.isJoinWaitlistSubmitting ||
      this.data.isCancelWaitlistSubmitting
    ) {
      return;
    }
    if (this.data.showSchedulePopup || this.data.showCancelDialog) {
      return;
    }
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

    const prevDateStr =
      this.data.selectedDateIndex >= 0 &&
      this.data.availableDates[this.data.selectedDateIndex]
        ? this.data.availableDates[this.data.selectedDateIndex].dateStr
        : null;
    const prevTime =
      this.data.selectedTimeIndex >= 0 &&
      this.data.timeSlots[this.data.selectedTimeIndex]
        ? this.data.timeSlots[this.data.selectedTimeIndex].time
        : null;

    const availableDates = this.data.availableDates.map((date) => {
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

    const { dateIndex, timeIndex, messages } = this.repairSelectionState({
      prevDateStr,
      prevTime,
      availableDates,
      consultant,
    });

    const timeSlots = this.getSlotsByDateStr(
      consultant,
      availableDates[dateIndex].dateStr,
    );

    this.setData(
      {
        selectedConsultant: consultant,
        selectedConsultantIndex: index,
        showSchedulePopup: true,
        availableDates: availableDates,
        selectedDateIndex: dateIndex,
        selectedTimeIndex: timeIndex,
        timeSlots: timeSlots,
      },
      () => {
        this.showMessages(messages);
      },
    );
  },

  onClosePopup() {
    if (
      this.data.isBookingSubmitting ||
      this.data.isCancelSubmitting ||
      this.data.isJoinWaitlistSubmitting ||
      this.data.isCancelWaitlistSubmitting
    ) {
      return;
    }
    this.setData({ showSchedulePopup: false });
  },

  // 切换日期
  onSelectDate(e) {
    const { index } = e.currentTarget.dataset;
    const selectedDate = this.data.availableDates[index];
    if (selectedDate.isFull && !selectedDate.waitlistStatus) return;

    const prevTime =
      this.data.selectedTimeIndex >= 0 &&
      this.data.timeSlots[this.data.selectedTimeIndex]
        ? this.data.timeSlots[this.data.selectedTimeIndex].time
        : null;

    const slots = this.getSlotsByDateStr(
      this.data.selectedConsultant,
      selectedDate.dateStr,
    );
    const firstSlotIdx = this.findFirstAvailableSlot(slots);

    let timeIndex = -1;
    let message = null;

    if (prevTime) {
      const prevTimeIdx = slots.findIndex(
        (s) => s.time === prevTime && !s.isFull,
      );
      if (prevTimeIdx !== -1) {
        timeIndex = prevTimeIdx;
      } else if (firstSlotIdx !== -1) {
        timeIndex = firstSlotIdx;
        message = `所选时段已不可用，已自动切换到 ${slots[timeIndex].time}`;
      }
    } else {
      timeIndex = firstSlotIdx;
    }

    this.setData(
      {
        selectedDateIndex: index,
        selectedTimeIndex: timeIndex,
        timeSlots: slots,
      },
      () => {
        if (message) {
          Toast({
            context: this,
            selector: "#t-toast",
            message: message,
            theme: "warning",
            direction: "column",
            placement: "middle",
          });
        }
      },
    );
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
    if (
      this.data.isBookingSubmitting ||
      this.data.isCancelSubmitting ||
      this.data.isJoinWaitlistSubmitting ||
      this.data.isCancelWaitlistSubmitting
    ) {
      return;
    }
    if (this.data.selectedTimeIndex === -1) {
      Toast({
        context: this,
        selector: "#t-toast",
        message: "请选择时间",
        theme: "warning",
        direction: "column",
        placement: "middle",
      });
      return;
    }
    this.setData({
      showSchedulePopup: false,
      showBookDialog: true,
    });
  },

  closeBookDialog() {
    if (this.data.isBookingSubmitting) return;
    this.setData({ showBookDialog: false });
  },

  async confirmBooking() {
    if (this.data.isBookingSubmitting) return;
    const index = this.data.selectedConsultantIndex;
    const consultant = this.data.selectedConsultant;
    const dateStr =
      this.data.availableDates[this.data.selectedDateIndex].dateStr;
    const time = this.data.timeSlots[this.data.selectedTimeIndex].time;

    this.setData({ isBookingSubmitting: true });

    try {
      const { _id } = await appointmentService.book({
        consultantId: consultant._id,
        consultantName: consultant.name,
        consultantAvatar: consultant.avatar,
        consultantTitle: consultant.title,
        dateStr: dateStr,
        time: time,
      });

      this.setData({ showBookDialog: false });

      const updateData = {};
      const prefix = `consultants[${index}]`;
      updateData[`${prefix}.isBooked`] = true;
      updateData[`${prefix}.bookedId`] = _id;
      updateData[`${prefix}.bookedDate`] = dateStr;
      updateData[`${prefix}.bookedTime`] = time;

      this.setData(updateData);
      this.fetchConsultants(true);

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
      this.setData({ isBookingSubmitting: false });
    }
  },

  // 取消预约逻辑
  closeCancelDialog() {
    if (this.data.isCancelSubmitting) return;
    this.setData({ showCancelDialog: false });
  },

  async confirmCancelBooking() {
    if (this.data.isCancelSubmitting) return;
    const index = this.data.selectedConsultantIndex;
    const consultant = this.data.consultants[index];

    this.setData({ isCancelSubmitting: true });

    try {
      await appointmentService.cancel(consultant.bookedId);

      this.setData({ showCancelDialog: false });

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
        message: err.message || "操作失败",
        theme: "error",
        direction: "column",
      });
    } finally {
      this.setData({ isCancelSubmitting: false });
    }
  },

  onJoinWaitlist() {
    if (
      this.data.isBookingSubmitting ||
      this.data.isCancelSubmitting ||
      this.data.isJoinWaitlistSubmitting ||
      this.data.isCancelWaitlistSubmitting
    ) {
      return;
    }
    const selectedDate = this.data.availableDates[this.data.selectedDateIndex];
    if (!selectedDate || !selectedDate.isFull) return;
    if (selectedDate.waitlistStatus) return;
    if (this.data.showWaitlistDialog) return;

    this.setData({
      showSchedulePopup: false,
      showWaitlistDialog: true,
      waitlistDateStr: selectedDate.dateStr,
    });
  },

  closeWaitlistDialog() {
    if (this.data.isJoinWaitlistSubmitting) return;
    this.setData({ showWaitlistDialog: false });
  },

  async confirmJoinWaitlist() {
    if (this.data.isJoinWaitlistSubmitting) return;
    const consultant = this.data.selectedConsultant;
    const dateStr = this.data.waitlistDateStr;

    this.setData({ isJoinWaitlistSubmitting: true });

    try {
      const { data } = await appointmentService.joinWaitlist({
        consultantId: consultant._id,
        consultantName: consultant.name,
        consultantAvatar: consultant.avatar,
        consultantTitle: consultant.title,
        dateStr,
      });

      this.setData({ showWaitlistDialog: false });
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
    } finally {
      this.setData({ isJoinWaitlistSubmitting: false });
    }
  },

  onCancelWaitlist() {
    if (
      this.data.isBookingSubmitting ||
      this.data.isCancelSubmitting ||
      this.data.isJoinWaitlistSubmitting ||
      this.data.isCancelWaitlistSubmitting
    ) {
      return;
    }
    const selectedDate = this.data.availableDates[this.data.selectedDateIndex];
    if (!selectedDate || !selectedDate.waitlistId) return;
    if (this.data.showCancelWaitlistDialog) return;

    this.setData({
      showSchedulePopup: false,
      showCancelWaitlistDialog: true,
    });
  },

  closeCancelWaitlistDialog() {
    if (this.data.isCancelWaitlistSubmitting) return;
    this.setData({ showCancelWaitlistDialog: false });
  },

  async confirmCancelWaitlist() {
    if (this.data.isCancelWaitlistSubmitting) return;
    const selectedDate = this.data.availableDates[this.data.selectedDateIndex];

    this.setData({ isCancelWaitlistSubmitting: true });

    try {
      await appointmentService.cancelWaitlist(selectedDate.waitlistId);

      this.setData({ showCancelWaitlistDialog: false });
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
    } finally {
      this.setData({ isCancelWaitlistSubmitting: false });
    }
  },
});
