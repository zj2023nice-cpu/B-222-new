import Toast from "tdesign-miniprogram/toast/index";
import moodService from "../../../services/mood";

Page({
  data: {
    activeTab: "record",
    todayDay: "",
    todayMonthYear: "",
    selectedMood: "",
    content: "",
    isSubmitting: false,
    historyRecords: [],
    isRefreshing: false,
    moodOptions: [
      {
        type: "happy",
        label: "开心",
        emoji: "😊",
        color: "#FFC107",
        tip: "保持这份喜悦，去感染身边的人吧！",
      },
      {
        type: "excited",
        label: "充满活力",
        emoji: "⚡",
        color: "#4CAF50",
        tip: "精力充沛的时候，最适合去完成那些挑战项。",
      },
      {
        type: "calm",
        label: "平静",
        emoji: "😌",
        color: "#2196F3",
        tip: "平和的心态是深度思考的最佳伴侣。",
      },
      {
        type: "anxious",
        label: "焦虑",
        emoji: "😰",
        color: "#9C27B0",
        tip: "试试 4-7-8 呼吸法，给自己一个深呼吸的时间。",
      },
      {
        type: "sad",
        label: "难过",
        emoji: "😢",
        color: "#607D8B",
        tip: "没关系，允许自己停下来哭一场，这也是一种治愈。",
      },
      {
        type: "angry",
        label: "烦躁",
        emoji: "😤",
        color: "#F44336",
        tip: "试着离开当前环境，喝杯水，或者听一首轻音乐。",
      },
    ],
    currentMoodTip: "",
    isLoading: false,
    navbarHeight: 0,
    allHistoryRecords: [], // 存储全量历史记录
    selectedDate: null, // 默认不选日期，显示全部
    formattedSelectedDate: "全部情绪记录",
    showCalendar: false,
    minDate: new Date("2025/01/01 00:00:00").getTime(), // 默认一个较早的时间
    maxDate: new Date().setHours(23, 59, 59, 999), // 默认今天结束
    rowSkeleton: [
      { width: "40%", height: "32rpx" },
      { width: "100%", height: "48rpx" },
      { width: "80%", height: "32rpx" },
    ],
    weeklyReport: {
      days: [],
      trendDesc: "",
      totalRecords: 0,
      weekRange: "",
    },
  },

  onLoad(options) {
    const app = getApp();
    this.setData({
      navbarHeight: app.globalData.navbarHeight,
    });

    this.updateDate();
    console.log("Mood page onLoad options:", options);

    // 支持通过 activeTab 值进入 ("record" 或 "history")
    const targetTab = options.activeTab || "record";

    this.setData(
      {
        activeTab: targetTab,
      },
      () => {
        // 无论进入哪个 Tab 都初始化一下历史记录
        this.fetchHistory();
      },
    );
  },

  updateDate() {
    const now = new Date();
    const months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    this.setData({
      todayDay: now.getDate().toString().padStart(2, "0"),
      todayMonthYear: `${months[now.getMonth()]} . ${now.getFullYear()}`,
    });
  },

  onTabChange(e) {
    this.setData({ activeTab: e.detail.value });
    if (e.detail.value === "history") {
      this.fetchHistory();
    } else if (e.detail.value === "weekly") {
      this.computeWeeklyReport();
    }
  },

  async fetchHistory(silent = false) {
    if (!silent) this.setData({ isLoading: true });
    try {
      const { data } = await moodService.fetchHistory();

      const records = data.map((item) => {
        const moodInfo =
          this.data.moodOptions.find((m) => m.type === item.mood) || {};

        // 格式化日期 YYYY-MM-DD 用于筛选
        let dateKey = "";
        let dateStr = "";
        let timeStr = "";
        if (item.createTime) {
          const date = new Date(item.createTime);
          const year = date.getFullYear();
          const month = (date.getMonth() + 1).toString().padStart(2, "0");
          const day = date.getDate().toString().padStart(2, "0");
          dateKey = `${year}-${month}-${day}`;
          dateStr = `${month}月${day}日`;

          const hours = date.getHours().toString().padStart(2, "0");
          const minutes = date.getMinutes().toString().padStart(2, "0");
          timeStr = `${hours}:${minutes}`;
        }

        return {
          ...item,
          emoji: moodInfo.emoji || "❓",
          label: moodInfo.label || "未知",
          color: moodInfo.color || "#999",
          timeStr,
          dateStr,
          dateKey,
        };
      });

      this.setData({ allHistoryRecords: records }, () => {
        // 动态计算可选日期范围
        if (records.length > 0) {
          // 找到最早的记录日期（records 默认是 desc，所以最后一条通常是最早的，但用计算最稳妥）
          const times = records
            .filter((r) => r.createTime)
            .map((r) => new Date(r.createTime).getTime());

          if (times.length > 0) {
            const minT = Math.min(...times);
            const earliestDate = new Date(minT);
            const minDateTime = new Date(
              earliestDate.getFullYear(),
              earliestDate.getMonth(),
              earliestDate.getDate(),
              0,
              0,
              0,
            ).getTime();

            // 设置 maxDate 为今天结束 23:59:59
            const now = new Date();
            const maxDateTime = new Date(
              now.getFullYear(),
              now.getMonth(),
              now.getDate(),
              23,
              59,
              59,
            ).getTime();

            this.setData({
              minDate: minDateTime,
              maxDate: maxDateTime,
            });
          }
        }
        this.filterHistoryByDate();
        this.computeWeeklyReport();
      });
    } catch (err) {
      console.error("获取心情记录失败", err);
    } finally {
      this.setData({
        isLoading: false,
        isRefreshing: false,
      });
    }
  },

  filterHistoryByDate() {
    const { allHistoryRecords, selectedDate } = this.data;
    if (!selectedDate) {
      this.setData({
        historyRecords: allHistoryRecords,
        formattedSelectedDate: "全部情绪记录",
      });
      return;
    }

    const date = new Date(selectedDate);
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const day = date.getDate().toString().padStart(2, "0");
    const targetKey = `${year}-${month}-${day}`;

    const filtered = allHistoryRecords.filter(
      (item) => item.dateKey === targetKey,
    );
    this.setData({
      historyRecords: filtered,
      formattedSelectedDate: `${month}月${day}日的心情`,
    });
  },

  computeWeeklyReport() {
    const { allHistoryRecords, moodOptions } = this.data;
    const dayNames = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
    const positiveMoods = ["happy", "excited", "calm"];

    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const weekStart = new Date(sevenDaysAgo);
    const weekEnd = new Date(today);
    const rangeLabel = `${(weekStart.getMonth() + 1).toString().padStart(2, "0")}月${weekStart.getDate().toString().padStart(2, "0")}日 - ${(weekEnd.getMonth() + 1).toString().padStart(2, "0")}月${weekEnd.getDate().toString().padStart(2, "0")}日`;

    const weekRecords = allHistoryRecords.filter((r) => {
      if (!r.createTime) return false;
      const t = new Date(r.createTime).getTime();
      return t >= sevenDaysAgo.getTime() && t <= today.getTime();
    });

    const dayMap = {};
    for (let i = 0; i < 7; i++) {
      const d = new Date(sevenDaysAgo);
      d.setDate(d.getDate() + i);
      const key = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, "0")}-${d.getDate().toString().padStart(2, "0")}`;
      dayMap[key] = {
        dateKey: key,
        dateLabel: `${(d.getMonth() + 1).toString().padStart(2, "0")}/${d.getDate().toString().padStart(2, "0")}`,
        dayLabel: dayNames[d.getDay()],
        moodCounts: {},
        count: 0,
        dominantMood: "",
        emoji: "",
        label: "",
        color: "",
      };
    }

    weekRecords.forEach((r) => {
      const entry = dayMap[r.dateKey];
      if (!entry) return;
      entry.count++;
      entry.moodCounts[r.mood] = (entry.moodCounts[r.mood] || 0) + 1;
    });

    const days = Object.values(dayMap);
    days.forEach((entry) => {
      if (entry.count > 0) {
        const sorted = Object.entries(entry.moodCounts).sort(
          (a, b) => b[1] - a[1],
        );
        const topMood = sorted[0][0];
        const moodInfo = moodOptions.find((m) => m.type === topMood) || {};
        entry.dominantMood = topMood;
        entry.emoji = moodInfo.emoji || "❓";
        entry.label = moodInfo.label || "未知";
        entry.color = moodInfo.color || "#999";
      }
    });

    const totalRecords = weekRecords.length;

    let positiveCount = 0;
    let negativeCount = 0;
    days.forEach((d) => {
      if (d.count === 0) return;
      if (positiveMoods.includes(d.dominantMood)) {
        positiveCount++;
      } else {
        negativeCount++;
      }
    });

    let trendDesc = "";
    const daysWithData = days.filter((d) => d.count > 0);

    if (daysWithData.length === 0) {
      trendDesc = "近 7 天还没有情绪记录，去记一记吧～";
    } else if (positiveCount === 0 && negativeCount > 0) {
      trendDesc = "本周情绪偏低落，记得给自己一些放松的时间。";
    } else if (negativeCount === 0 && positiveCount > 0) {
      trendDesc = "本周情绪都很积极，继续保持好状态！";
    } else if (positiveCount > negativeCount) {
      trendDesc = "本周积极情绪占多，整体状态不错！";
    } else if (negativeCount > positiveCount) {
      trendDesc = "本周负面情绪偏多，试试和朋友聊聊天？";
    } else {
      trendDesc = "本周情绪起伏较均衡，接纳每一份感受。";
    }

    if (daysWithData.length >= 3) {
      const halfLen = Math.ceil(daysWithData.length / 2);
      const firstHalf = daysWithData.slice(0, halfLen);
      const secondHalf = daysWithData.slice(halfLen);
      const firstPosRatio =
        firstHalf.filter((d) => positiveMoods.includes(d.dominantMood))
          .length / firstHalf.length;
      const secondPosRatio =
        secondHalf.filter((d) => positiveMoods.includes(d.dominantMood))
          .length / secondHalf.length;

      if (secondPosRatio > firstPosRatio + 0.2) {
        trendDesc = "情绪趋势向好，后半周比前半周更积极！";
      } else if (firstPosRatio > secondPosRatio + 0.2) {
        trendDesc = "后半周情绪有所回落，注意调整节奏。";
      }
    }

    this.setData({
      weeklyReport: {
        days,
        trendDesc,
        totalRecords,
        weekRange: rangeLabel,
      },
    });
  },

  onCalendarConfirm(e) {
    const { value } = e.detail;
    this.setData(
      {
        selectedDate: value,
        showCalendar: false,
      },
      () => {
        this.filterHistoryByDate();
      },
    );
  },

  onCalendarToggle() {
    this.setData({ showCalendar: !this.data.showCalendar });
  },

  clearDateFilter() {
    this.setData(
      {
        selectedDate: null,
      },
      () => {
        this.filterHistoryByDate();
      },
    );
  },

  async onRefresh() {
    this.setData({ isRefreshing: true });
    await this.fetchHistory(true);
  },

  selectMood(e) {
    const { type } = e.currentTarget.dataset;
    const mood = this.data.moodOptions.find((m) => m.type === type);
    this.setData({
      selectedMood: type,
      currentMoodTip: mood ? mood.tip : "",
    });
  },

  onContentChange(e) {
    this.setData({
      content: e.detail.value,
    });
  },

  async saveDiary() {
    if (!this.data.selectedMood) {
      Toast({
        context: this,
        selector: "#t-toast",
        message: "请先选择一种情绪状态哦",
        theme: "warning",
        direction: "column",
      });
      return;
    }

    this.setData({ isSubmitting: true });

    try {
      await moodService.add(
        this.data.selectedMood,
        this.data.content,
        this.getLocalDateStr(),
      );

      Toast({
        context: this,
        selector: "#t-toast",
        message: "已封存这份感受",
        theme: "success",
        direction: "column",
      });

      // 清空状态并跳转到历史页
      this.setData({
        selectedMood: "",
        content: "",
        activeTab: "record",
      });
      this.fetchHistory();
    } catch (err) {
      console.error("保存情绪日记失败", err);
      Toast({
        context: this,
        selector: "#t-toast",
        message: "保存失败，请重试",
        theme: "error",
        direction: "column",
      });
    } finally {
      this.setData({ isSubmitting: false });
    }
  },

  getLocalDateStr() {
    const now = new Date();
    return `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, "0")}-${now.getDate().toString().padStart(2, "0")}`;
  },
});
