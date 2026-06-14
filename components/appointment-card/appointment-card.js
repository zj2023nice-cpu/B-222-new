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
      const { action } = e.currentTarget.dataset;
      const { item } = this.properties;

      // 1. 根据动作类型决定是直接抛出事件，还是先弹窗确认
      if (action === "contact") {
        this.setData({ showContactDialog: true });
      } else if (action === "cancel") {
        this.setData({
          showConfirmDialog: true,
          currentAction: "cancel",
          confirmTitle: "确认取消",
          confirmContent: "确定要取消这次预约吗？",
          confirmText: "确定取消",
          cancelText: "保留预约",
        });
      } else if (action === "cancelWaitlist") {
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
        this.setData({
          showConfirmDialog: true,
          currentAction: "delete",
          confirmTitle: "删除提醒",
          confirmContent: "确定要彻底删除这条记录吗？",
          confirmText: "确定删除",
          cancelText: "取消",
        });
      } else if (action === "evaluate") {
        this.setData({
          showEvalDialog: true,
          evalScore: 5,
          evalResult: "",
        });
      } else {
        // 其他动作（如 reject, confirm, complete）直接抛出，由页面决定是否需要额外处理
        this.triggerEvent("action", {
          action,
          index: this.properties.index,
          item: this.properties.item,
        });
      }
    },

    // 确认联系动作
    onConfirmContact() {
      wx.setClipboardData({
        data: this.properties.contactPhone,
        success: () => {
          this.setData({ showContactDialog: false });
        },
      });
    },

    // 确认通用动作 (cancel, delete)
    onConfirmAction() {
      const { currentAction } = this.data;
      this.setData({ showConfirmDialog: false });
      this.triggerEvent("action", {
        action: currentAction,
        index: this.properties.index,
        item: this.properties.item,
      });
    },

    // 确认评估动作
    onConfirmEval() {
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
      // 移除这里的立即关闭，交给父页面在接口成功后处理
      // this.setData({ showEvalDialog: false });
      this.triggerEvent("action", {
        action: "evaluate",
        index: this.properties.index,
        item: this.properties.item,
        evaluation: { score: evalScore, result: evalResult },
      });
    },

    // 关闭任何弹窗
    onCloseDialog(e) {
      const { type } = e.currentTarget.dataset;
      this.setData({ [`show${type}Dialog`]: false });
    },

    // 供父页面调用的公开方法
    hideEvalDialog() {
      this.setData({ showEvalDialog: false });
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
