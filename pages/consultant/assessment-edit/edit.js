import { SafePage } from "../../../utils/middleware";
import Dialog from "tdesign-miniprogram/dialog/index";
import Toast from "tdesign-miniprogram/toast/index";
import assessmentService from "../../../services/assessment";

SafePage({
  data: {
    id: "",
    assessment: {
      title: "",
      description: "",
      duration: 30,
    },
    isSaving: false,
  },

  onLoad(options) {
    if (options.id) {
      this.setData({ id: options.id });
      this.loadAssessment(options.id);
    }
  },

  async loadAssessment(id) {
    try {
      const res = await assessmentService.getDetail(id);
      this.setData({ assessment: res.data });
    } catch (err) {
      console.error("Load assessment error", err);
      Toast({
        context: this,
        selector: "#t-toast",
        message: "加载失败",
        theme: "error",
        direction: "column",
      });
    }
  },

  onInputChange(e) {
    const { field } = e.currentTarget.dataset;
    const { value } = e.detail;
    this.setData({
      [`assessment.${field}`]: value,
    });
  },

  onDurationChange(e) {
    this.setData({
      "assessment.duration": e.detail.value,
    });
  },

  onBack() {
    wx.navigateBack();
  },

  async saveAssessment() {
    const { assessment, id } = this.data;
    if (!assessment.title) {
      Toast({
        context: this,
        selector: "#t-toast",
        message: "请输入标题",
        theme: "warning",
        direction: "column",
      });
      return;
    }

    this.setData({ isSaving: true });
    try {
      await assessmentService.save(id, assessment);

      Toast({
        context: this,
        selector: "#t-toast",
        message: "保存成功",
        theme: "success",
        direction: "column",
      });

      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
    } catch (err) {
      console.error("Save assessment error", err);
      Toast({
        context: this,
        selector: "#t-toast",
        message: err.message || "保存失败",
        theme: "error",
        direction: "column",
      });
    } finally {
      this.setData({ isSaving: false });
    }
  },

  async deleteAssessment() {
    const { id } = this.data;
    Dialog.confirm({
      context: this,
      selector: "#t-dialog",
      title: "确认删除测评",
      content: "删除后该模版将无法恢复，建议先确认是否有正在进行的测评任务。",
      confirmBtn: { content: "确定删除", theme: "danger", variant: "base" },
      cancelBtn: "取消",
    })
      .then(async () => {
        try {
          await assessmentService.delete(id);
          Toast({
            context: this,
            selector: "#t-toast",
            message: "成功删除",
            theme: "success",
            direction: "column",
          });
          setTimeout(() => {
            wx.navigateBack();
          }, 1000);
        } catch (err) {
          console.error("Delete assessment error", err);
          Toast({
            context: this,
            selector: "#t-toast",
            message: "删除失败",
            theme: "error",
            direction: "column",
          });
        }
      })
      .catch(() => {
        // 取消删除
      });
  },
});
