import moodService from "../../services/mood";
import assessmentService from "../../services/assessment";
import appointmentService from "../../services/appointment";
import router from "../utils/router";

const TYPE_MAP = {
  mood: {
    label: "情绪记录",
    theme: "warning",
    icon: "smile",
  },
  assessment: {
    label: "测评记录",
    theme: "primary",
    icon: "assignment",
  },
  appointment: {
    label: "预约记录",
    theme: "success",
    icon: "calendar",
  },
};

const APPOINTMENT_STATUS_MAP = {
  booked: "待确认",
  confirmed: "待咨询",
  completed: "已完成",
  cancelled: "已取消",
  rejected: "已拒绝",
};

function parseDate(dateVal) {
  if (!dateVal) return 0;
  if (typeof dateVal === "number") return dateVal;
  const d = new Date(dateVal);
  const ts = d.getTime();
  return isNaN(ts) ? 0 : ts;
}

function formatDateDisplay(timestamp) {
  if (!timestamp) return "";
  const d = new Date(timestamp);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day} ${h}:${min}`;
}

function formatDateGroup(timestamp) {
  if (!timestamp) return "";
  const d = new Date(timestamp);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}年${m}月${day}日`;
}

const MOOD_MAP = {
  happy: "开心",
  calm: "平静",
  sad: "难过",
  angry: "生气",
  anxious: "焦虑",
};

function getMoodDesc(raw) {
  return MOOD_MAP[raw?.mood] || raw?.mood || "心情记录";
}

function getMoodSubDesc(raw) {
  return raw?.content || "";
}

function getAssessmentDesc(raw) {
  const title = raw?.assessmentTitle || "心理测评";
  const score = raw?.score;
  const result = raw?.result;
  if (score !== undefined && result) {
    return `${title} · ${result} (${score}分)`;
  }
  if (score !== undefined) {
    return `${title} · ${score}分`;
  }
  return title;
}

function getAppointmentDesc(raw) {
  const name = raw?.consultantName || "咨询师";
  const dateStr = raw?.dateStr || "";
  const time = raw?.time || "";
  const status =
    APPOINTMENT_STATUS_MAP[raw?.status] || raw?.status || "";
  const parts = [name];
  if (dateStr) parts.push(dateStr);
  if (time) parts.push(time);
  if (status) parts.push(status);
  return parts.join(" · ");
}

function getAppointmentSubDesc(raw) {
  return (
    raw?.consultantTitle ||
    (raw?.status === "completed" && raw?.feedback) ||
    ""
  );
}

function normalizeMoodRecord(item) {
  const timestamp = parseDate(item.createTime || item.dateStr);
  return {
    id: item._id || `mood_${timestamp}`,
    type: "mood",
    timestamp,
    dateDisplay: formatDateDisplay(timestamp),
    desc: getMoodDesc(item),
    subDesc: getMoodSubDesc(item),
    raw: item,
  };
}

function normalizeAssessmentRecord(item) {
  const timestamp = parseDate(item.createTime);
  return {
    id: item._id || `assessment_${timestamp}`,
    type: "assessment",
    timestamp,
    dateDisplay: formatDateDisplay(timestamp),
    desc: getAssessmentDesc(item),
    subDesc: "",
    raw: item,
  };
}

function normalizeAppointmentRecord(item) {
  const timestamp = parseDate(
    item.finishTime || item.completeTime || item.createTime
  );
  return {
    id: item._id || `appointment_${timestamp}`,
    type: "appointment",
    timestamp,
    dateDisplay: formatDateDisplay(timestamp),
    desc: getAppointmentDesc(item),
    subDesc: getAppointmentSubDesc(item),
    raw: item,
  };
}

Component({
  data: {
    timelineItems: [],
    groupedItems: [],
    loading: false,
    initialized: false,
    typeMap: TYPE_MAP,
  },

  methods: {
    async loadTimeline() {
      this.setData({ loading: true });
      try {
        const results = await Promise.allSettled([
          moodService.fetchHistory().catch(() => ({ data: [] })),
          assessmentService.getStudentRecords().catch(() => ({ data: [] })),
          appointmentService.getMyList().catch(() => ({ data: [] })),
        ]);

        const moodData =
          results[0].status === "fulfilled" ? results[0].value?.data || [] : [];
        const assessmentData =
          results[1].status === "fulfilled"
            ? results[1].value?.data || []
            : [];
        const appointmentData =
          results[2].status === "fulfilled"
            ? results[2].value?.data || []
            : [];

        const normalized = [
          ...(Array.isArray(moodData) ? moodData : []).map(normalizeMoodRecord),
          ...(Array.isArray(assessmentData)
            ? assessmentData
            : []
          ).map(normalizeAssessmentRecord),
          ...(Array.isArray(appointmentData)
            ? appointmentData
            : []
          ).map(normalizeAppointmentRecord),
        ];

        const sorted = normalized
          .filter((item) => item.timestamp > 0)
          .sort((a, b) => b.timestamp - a.timestamp);

        const grouped = this.groupByDate(sorted);

        this.setData({
          timelineItems: sorted,
          groupedItems: grouped,
          initialized: true,
        });
      } catch (err) {
        console.error("[Timeline] 加载时间线失败:", err);
        this.setData({
          timelineItems: [],
          groupedItems: [],
          initialized: true,
        });
      } finally {
        this.setData({ loading: false });
      }
    },

    groupByDate(items) {
      const groups = {};
      items.forEach((item) => {
        const groupKey = formatDateGroup(item.timestamp);
        if (!groups[groupKey]) {
          groups[groupKey] = [];
        }
        groups[groupKey].push(item);
      });
      return Object.keys(groups).map((date) => ({
        date,
        items: groups[date],
      }));
    },

    onItemTap(e) {
      const { item } = e.currentTarget.dataset;
      if (!item) return;

      this.triggerEvent("itemtap", { item });

      if (item.type === "assessment") {
        const assessmentId = item.raw?.assessmentId;
        const title = item.raw?.assessmentTitle || "心理测评";
        if (assessmentId) {
          router.navigateTo({
            url: `/pages/student/assessment/assessment-detail/assessment-detail?id=${assessmentId}&title=${encodeURIComponent(title)}`,
            fail: () => {
              router.navigateTo({
                url: `/pages/student/exam-records/exam-records`,
                fail: () => {},
              });
            },
          });
        } else {
          router.navigateTo({
            url: `/pages/student/exam-records/exam-records`,
            fail: () => {},
          });
        }
      } else if (item.type === "appointment") {
        router.navigateTo({
          url: `/pages/student/appointment-list/appointment-list`,
          fail: () => {},
        });
      } else if (item.type === "mood") {
        router.navigateTo({
          url: `/pages/student/mood/mood?activeTab=history`,
          fail: () => {},
        });
      }
    },
  },
});
