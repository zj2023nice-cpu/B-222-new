import Toast from "tdesign-miniprogram/toast/index";
import router from "../utils/router";

Component({
  options: {
    addGlobalClass: true,
    multipleSlots: true,
  },
  properties: {
    item: {
      type: Object,
      value: {},
    },
    role: {
      type: String,
      value: "student", // 'student' or 'consultant'
    },
    statusMap: {
      type: Object,
      value: {},
    },
    index: {
      type: Number,
      value: -1,
    },
    showFooter: {
      type: Boolean,
      value: true,
    },
    contactPhone: {
      type: String,
      value: "138-1234-5678",
    },
  },
  data: {
    showContactDialog: false,
    showConfirmDialog: false,
    showEvalDialog: false,
    confirmTitle: "",
    confirmContent: "",
    confirmText: "确定",
    cancelText: "取消",
    currentAction: "", // cancel, delete, reject, confirm, complete

    isActionSubmitting: false,

    // Evaluation data
    evalScore: 5,
    evalResult: "",
  },
  observers: {
    // 监听反馈数据，一旦发现已反馈，自动关闭评估弹窗（数据驱动关闭）
    "item.feedback": function (feedback) {
      if (feedback && this.data.showEvalDialog) {
        this.setData({ showEvalDialog: false });
      }
    },
  },
  methods: {
    onAction(e) {
      if (this.data.isActionSubmitting) return;
      const { action } = e.currentTarget.dataset;
      const { item } = this.properties;

      if (action === "contact") {
        if (this.data.showContactDialog) return;
        this.setData({ showContactDialog: true });
      } else if (action === "cancel") {
        if (this.data.showConfirmDialog) return;
        this.setData({
          showConfirmDialog: true,
          currentAction: "cancel",
          confirmTitle: "确认取消",
          confirmContent: "确定要取消这次预约吗？",
          confirmText: "确定取消",
          cancelText: "保留预约",
        });
      } else if (action === "cancelWaitlist") {
        if (this.data.showConfirmDialog) return;
        this.setData({
          showConfirmDialog: true,
          currentAction: "cancelWaitlist",
          confirmTitle: "退出候补",
          confirmContent: "确定要退出候补排队吗？退出后需重新排队。",
          confirmText: "确定退出",
          cancelText: "保留候补",
        });
      } else if (action === "gotoBook") {
        router.navigateTo({
          url: "/pages/student/appointment/appointment",
        });
      } else if (action === "delete") {
        if (this.data.showConfirmDialog) return;
        this.setData({
          showConfirmDialog: true,
          currentAction: "delete",
          confirmTitle: "删除提醒",
          confirmContent: "确定要彻底删除这条记录吗？",
          confirmText: "确定删除",
          cancelText: "取消",
        });
      } else if (action === "evaluate") {
        if (this.data.showEvalDialog) return;
        this.setData({
          showEvalDialog: true,
          evalScore: 5,
          evalResult: "",
        });
      } else {
        this.triggerEvent("action", {
          action,
          index: this.properties.index,
          item: this.properties.item,
        });
      }
    },

    onConfirmContact() {
      if (this.data.isActionSubmitting) return;
      this.setData({ isActionSubmitting: true });
      wx.setClipboardData({
        data: this.properties.contactPhone,
        success: () => {
          this.setData({ showContactDialog: false });
        },
        complete: () => {
          this.setData({ isActionSubmitting: false });
        },
      });
    },

    onConfirmAction() {
      if (this.data.isActionSubmitting) return;
      const { currentAction } = this.data;
      this.setData({ isActionSubmitting: true, showConfirmDialog: false });
      this.triggerEvent("action", {
        action: currentAction,
        index: this.properties.index,
        item: this.properties.item,
      });
      setTimeout(() => {
        this.setData({ isActionSubmitting: false });
      }, 800);
    },

    onConfirmEval() {
      if (this.data.isActionSubmitting) return;
      const { evalScore, evalResult } = this.data;
      if (!evalScore || !evalResult) {
        Toast({
          context: this,
          selector: "#t-toast",
          message: "请填写评分和建议",
          theme: "warning",
          direction: "column",
        });
        return;
      }
      this.setData({ isActionSubmitting: true });
      this.triggerEvent("action", {
        action: "evaluate",
        index: this.properties.index,
        item: this.properties.item,
        evaluation: { score: evalScore, result: evalResult },
      });
    },

    onCloseDialog(e) {
      if (this.data.isActionSubmitting) return;
      const { type } = e.currentTarget.dataset;
      this.setData({ [`show${type}Dialog`]: false });
    },

    hideEvalDialog() {
      this.setData({ showEvalDialog: false, isActionSubmitting: false });
    },

    resetActionLock() {
      this.setData({ isActionSubmitting: false });
    },

    // 评分/输入变更
    onScoreChange(e) {
      this.setData({ evalScore: e.detail.value });
    },
    onEvalChange(e) {
      this.setData({ evalResult: e.detail.value });
    },

    onImageError() {
      this.triggerEvent("avatarerror", {
        index: this.properties.index,
        type: this.properties.role === "student" ? "consultant" : "student",
      });
    },
  },
});
