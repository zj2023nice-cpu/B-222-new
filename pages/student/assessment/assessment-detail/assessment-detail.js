import assessmentService from "../../../../services/assessment";
import Toast from "tdesign-miniprogram/toast/index";
import { SafePage } from "../../../../utils/middleware";
import { getResultConfigByScore } from "../../../../utils/constants";

SafePage({
  data: {
    id: "",
    assessmentTitle: "",
    currentStep: 0,
    progress: 0,
    questions: [
      {
        title: "在过去的两周里，你是否感到心情低落、沮丧或绝望？",
        options: [
          { label: "完全没有", value: 0 },
          { label: "有几天", value: 1 },
          { label: "一半以上的时间", value: 2 },
          { label: "几乎每天", value: 3 },
        ],
      },
      {
        title: "你在做事情时是否感到兴趣索然或缺乏动力？",
        options: [
          { label: "完全没有", value: 0 },
          { label: "有几天", value: 1 },
          { label: "一半以上的时间", value: 2 },
          { label: "几乎每天", value: 3 },
        ],
      },
      {
        title: "你是否感到入睡困难、易醒，或者睡眠过多？",
        options: [
          { label: "完全没有", value: 0 },
          { label: "有几天", value: 1 },
          { label: "一半以上的时间", value: 2 },
          { label: "几乎每天", value: 3 },
        ],
      },
    ],
    answers: [],
    submitting: false,
    showResult: false,
    normalizedScore: 0,
    resultLabel: "",
    resultDescription: "",
    recommendedArticles: [],
    articlesLoading: false,
  },

  onLoad(options) {
    const { id, title } = options;
    this.setData({
      id,
      assessmentTitle: decodeURIComponent(title || "心理测评"),
      progress: Math.floor((1 / this.data.questions.length) * 100),
    });
  },

  onAnswerChange(e) {
    const { value } = e.detail;
    const { currentStep, answers } = this.data;
    const newAnswers = [...answers];
    newAnswers[currentStep] = value;
    this.setData({ answers: newAnswers });
  },

  nextStep() {
    const { currentStep, questions } = this.data;
    if (currentStep < questions.length - 1) {
      const next = currentStep + 1;
      this.setData({
        currentStep: next,
        progress: Math.floor(((next + 1) / questions.length) * 100),
      });
    }
  },

  prevStep() {
    const { currentStep, questions } = this.data;
    if (currentStep > 0) {
      const prev = currentStep - 1;
      this.setData({
        currentStep: prev,
        progress: Math.floor(((prev + 1) / questions.length) * 100),
      });
    }
  },

  async submitQuiz() {
    const { answers, questions, id, assessmentTitle } = this.data;
    if (answers.length < questions.length) {
      Toast({
        context: this,
        selector: "#t-toast",
        message: "请回答所有题目",
        theme: "warning",
        direction: "column",
        duration: 2000,
      });
      return;
    }

    this.setData({ submitting: true });

    try {
      const totalScore = answers.reduce((sum, val) => sum + val, 0);
      const normalizedScore = Math.floor(
        (totalScore / (questions.length * 3)) * 100,
      );

      const resultConfig = getResultConfigByScore(normalizedScore);

      const userInfo = wx.getStorageSync("userInfo") || {};

      await assessmentService.submitTest({
        assessmentId: id,
        assessmentTitle: assessmentTitle,
        score: normalizedScore,
        result: resultConfig.label,
        userName: userInfo.name || "匿名学生",
        userAvatar: userInfo.avatar || "",
      });

      this.setData({
        showResult: true,
        normalizedScore,
        resultLabel: resultConfig.label,
        resultDescription: resultConfig.description,
      });

      this.loadRecommendedArticles(normalizedScore);
    } catch (err) {
      console.error("提交失败", err);
      Toast({
        context: this,
        selector: "#t-toast",
        message: "提交失败，请稍后重试",
        theme: "error",
        direction: "column",
      });
    } finally {
      this.setData({ submitting: false });
    }
  },

  async loadRecommendedArticles(score) {
    this.setData({ articlesLoading: true });
    try {
      const result = await assessmentService.getRecommendedArticles(score, 3);
      this.setData({ recommendedArticles: result.data || [] });
    } catch (err) {
      console.error("获取推荐文章失败:", err);
    } finally {
      this.setData({ articlesLoading: false });
    }
  },

  onArticleClick(e) {
    const { article } = e.detail;
    if (!article || !article._id || article.isDeleted) return;
    wx.navigateTo({
      url: `/pages/student/articles/article-detail/article-detail?id=${article._id}`,
    });
  },

  goBack() {
    wx.navigateBack({
      delta: 1,
      fail: () => {
        wx.redirectTo({ url: "/pages/student/assessment/assessment" });
      },
    });
  },
});
