import aiService from "../../../../services/ai";

const SUGGESTION_QUESTIONS = [
  "最近总是失眠，有什么改善方法吗？",
  "学习压力大，感觉焦虑怎么办？",
  "和父母沟通总是吵架，怎么处理？",
  "不知道未来的方向，很迷茫",
  "朋友关系处理不好，感到孤独",
  "总是情绪低落，怎么调整自己？",
];

const FOLLOW_UP_TEMPLATES = [
  "能具体说说如何实践吗？",
  "这个方法需要多久才能见效？",
  "还有其他类似的建议吗？",
  "我想更深入地了解这个话题",
];

Component({
  options: {
    multipleSlots: true,
    addGlobalClass: true,
    styleIsolation: "shared",
  },
  data: {
    currentView: "chat",
    messages: [],
    inputValue: "",
    isTyping: false,
    aiAvatar: "/images/ai-avatar.jpg",
    userAvatar: "",
    isLoading: false,
    userName: "我",
    currentSession: null,
    sessions: [],
    showDeleteConfirm: false,
    deleteTargetId: "",
    showSuggestions: true,
    suggestionQuestions: SUGGESTION_QUESTIONS,
    showFollowUps: false,
    followUpQuestions: [],
  },

  lifetimes: {
    attached() {
      const userInfo = wx.getStorageSync("userInfo");
      if (userInfo) {
        this.setData({
          userAvatar: userInfo.avatarUrl || userInfo.avatar || "",
          userName: userInfo.nickName || userInfo.nickname || "我",
        });
      }
      this._initSession();
    },
  },

  methods: {
    _initSession() {
      const sessions = aiService.getSessions();
      let currentSession = null;

      if (sessions.length > 0) {
        currentSession = aiService.getSession(sessions[0].sessionId);
      }

      if (!currentSession) {
        currentSession = aiService.createSession();
        aiService.saveSession(currentSession);
      }

      const messages = currentSession.messages || [];
      const hasMessages = messages.length > 0;

      this.setData({
        sessions: this._getFormattedSessions(),
        currentSession,
        messages,
        showSuggestions: !hasMessages,
        showFollowUps: hasMessages,
        followUpQuestions: hasMessages ? this._generateFollowUps(messages) : [],
      });
    },

    _persistCurrentSession() {
      const session = this.data.currentSession;
      if (!session) return;
      session.messages = this.data.messages;
      if (!session.title && this.data.messages.length > 0) {
        const firstUserMsg = this.data.messages.find((m) => m.role === "user");
        if (firstUserMsg) {
          session.title =
            firstUserMsg.content.length > 20
              ? firstUserMsg.content.slice(0, 20) + "..."
              : firstUserMsg.content;
        }
      }
      aiService.saveSession(session);
      this.setData({ sessions: this._getFormattedSessions() });
    },

    onInputChange(e) {
      this.setData({ inputValue: e.detail.value });
    },

    async sendMessage(e) {
      const text = (e.detail.value || this.data.inputValue).trim();
      if (!text || this.data.isTyping) return;

      const timestamp = Date.now();
      const date = new Date(timestamp);
      const hours = date.getHours().toString().padStart(2, "0");
      const minutes = date.getMinutes().toString().padStart(2, "0");
      const timeStr = `${hours}:${minutes}`;

      const userMsg = {
        id: "u" + timestamp,
        role: "user",
        content: text,
        status: "success",
        name: this.data.userName,
        datetime: timeStr,
      };

      const aiTempId = "a" + timestamp;
      const aiPlaceholderMsg = {
        id: aiTempId,
        role: "ai",
        content: "",
        status: "pending",
        name: "AI 心理助手",
        datetime: timeStr,
      };

      const currentRequestId = timestamp;
      this.activeRequestId = currentRequestId;

      const newMessages = [aiPlaceholderMsg, userMsg, ...this.data.messages];
      this.setData({
        messages: newMessages,
        inputValue: "",
        isTyping: true,
        isLoading: true,
        showSuggestions: false,
        showFollowUps: false,
      });
      this._persistCurrentSession();

      const history = this.data.messages
        .filter((m) => m.status === "success" && m.content)
        .slice(0, 10)
        .reverse()
        .map((m) => ({
          role: m.role === "ai" ? "assistant" : m.role,
          content: m.content,
        }));

      try {
        const result = await aiService.chat(
          history,
          this.data.currentSession.sessionId
        );

        if (this.activeRequestId !== currentRequestId) return;

        if (!result || !result.success) {
          this.updateAiMsg(
            aiTempId,
            result?.reply || "抱歉，连接断开了。",
            "error"
          );
          this._persistCurrentSession();
          return;
        }
        this.updateAiMsg(aiTempId, result.reply, "success", {
          risk: result.risk || false,
          crisisGuide: result.crisisGuide || null,
        });
        this._persistCurrentSession();

        const updatedMessages = this.data.messages.map((m) => {
          if (m.id === aiTempId) {
            return {
              ...m,
              content: result.reply,
              status: "success",
              risk: result.risk || false,
              crisisGuide: result.crisisGuide || null,
            };
          }
          return m;
        });
        this.setData({
          showFollowUps: true,
          followUpQuestions: this._generateFollowUps(updatedMessages),
        });
      } catch (err) {
        if (this.activeRequestId !== currentRequestId) return;
        console.error("AI chat failed", err);
        this.updateAiMsg(aiTempId, "网络连接失败，请重试。", "error");
        this._persistCurrentSession();
      } finally {
        if (this.activeRequestId === currentRequestId) {
          this.setData({ isTyping: false, isLoading: false });
          this.activeRequestId = null;
        }
      }
    },

    onCancel() {
      if (!this.data.isLoading) return;

      this.activeRequestId = null;
      this.setData({
        isTyping: false,
        isLoading: false,
      });

      const pendingMsg = this.data.messages.find((m) => m.status === "pending");
      if (pendingMsg) {
        this.updateAiMsg(pendingMsg.id, "已终止思考。", "error");
      }
      this._persistCurrentSession();
    },

    updateAiMsg(tempId, content, status, extra) {
      const newMessages = this.data.messages.map((m) => {
        if (m.id === tempId) {
          return {
            ...m,
            content: content || "...",
            status,
            ...(extra || {}),
          };
        }
        return m;
      });
      this.setData({ messages: newMessages });
    },

    onAvatarError(e) {
      const { type } = e.currentTarget.dataset;
      this.setData({ [type === "ai" ? "aiAvatar" : "userAvatar"]: "" });
    },

    onScrollTop() {},

    onShowHistory() {
      this.setData({
        currentView: "history",
        sessions: this._getFormattedSessions(),
      });
    },

    onHideHistory() {
      this.setData({ currentView: "chat" });
    },

    onNewSession() {
      const session = aiService.createSession();
      aiService.saveSession(session);
      this.setData({
        currentSession: session,
        messages: [],
        currentView: "chat",
        sessions: this._getFormattedSessions(),
        showSuggestions: true,
        showFollowUps: false,
        followUpQuestions: [],
      });
    },

    onSessionTap(e) {
      const { id } = e.currentTarget.dataset;
      const session = aiService.getSession(id);
      if (!session) return;
      const messages = session.messages || [];
      const hasMessages = messages.length > 0;
      this.setData({
        currentSession: session,
        messages,
        currentView: "chat",
        showSuggestions: !hasMessages,
        showFollowUps: hasMessages,
        followUpQuestions: hasMessages ? this._generateFollowUps(messages) : [],
      });
    },

    onSessionDelete(e) {
      const { id } = e.currentTarget.dataset;
      this.setData({
        showDeleteConfirm: true,
        deleteTargetId: id,
      });
    },

    onConfirmDelete() {
      const { deleteTargetId } = this.data;
      if (!deleteTargetId) return;

      aiService.deleteSession(deleteTargetId);

      if (
        this.data.currentSession &&
        this.data.currentSession.sessionId === deleteTargetId
      ) {
        const sessions = aiService.getSessions();
        let currentSession = null;
        if (sessions.length > 0) {
          currentSession = aiService.getSession(sessions[0].sessionId);
        }
        if (!currentSession) {
          currentSession = aiService.createSession();
          aiService.saveSession(currentSession);
        }
        const messages = currentSession.messages || [];
        const hasMessages = messages.length > 0;
        this.setData({
          currentSession,
          messages,
          showSuggestions: !hasMessages,
          showFollowUps: hasMessages,
          followUpQuestions: hasMessages ? this._generateFollowUps(messages) : [],
        });
      }

      this.setData({
        sessions: this._getFormattedSessions(),
        showDeleteConfirm: false,
        deleteTargetId: "",
      });
    },

    onCancelDelete() {
      this.setData({
        showDeleteConfirm: false,
        deleteTargetId: "",
      });
    },

    _formatSessionTime(timestamp) {
      const date = new Date(timestamp);
      const now = new Date();
      const isToday =
        date.getFullYear() === now.getFullYear() &&
        date.getMonth() === now.getMonth() &&
        date.getDate() === now.getDate();

      const hours = date.getHours().toString().padStart(2, "0");
      const minutes = date.getMinutes().toString().padStart(2, "0");
      const time = `${hours}:${minutes}`;

      if (isToday) return `今天 ${time}`;

      const month = (date.getMonth() + 1).toString().padStart(2, "0");
      const day = date.getDate().toString().padStart(2, "0");
      return `${month}-${day} ${time}`;
    },

    _getFormattedSessions() {
      return aiService.getSessions().map((s) => ({
        ...s,
        formattedTime: this._formatSessionTime(s.updatedAt),
        messageCount: (s.messages || []).length,
        preview:
          s.messages && s.messages.length > 0
            ? s.messages[0].content.length > 40
              ? s.messages[0].content.slice(0, 40) + "..."
              : s.messages[0].content
            : "",
      }));
    },

    _generateFollowUps(messages) {
      if (!messages || messages.length === 0) return [];

      const lastAiMsg = messages.find((m) => m.role === "ai" && m.status === "success");
      if (!lastAiMsg || !lastAiMsg.content) return [];

      const content = lastAiMsg.content;
      const followUps = [...FOLLOW_UP_TEMPLATES];

      if (content.includes("方法") || content.includes("建议")) {
        followUps.unshift("这个方法适合我这种情况吗？");
      }
      if (content.includes("压力") || content.includes("焦虑")) {
        followUps.unshift("有什么快速缓解的小技巧吗？");
      }
      if (content.includes("沟通") || content.includes("关系")) {
        followUps.unshift("遇到具体场景时该怎么应对？");
      }

      return followUps.slice(0, 3);
    },

    onSuggestionTap(e) {
      const { question } = e.currentTarget.dataset;
      if (!question || this.data.isTyping) return;
      this.setData({ inputValue: question });
      this.sendMessage({ detail: { value: question } });
    },

    onFollowUpTap(e) {
      const { question } = e.currentTarget.dataset;
      if (!question || this.data.isTyping) return;
      this.setData({ inputValue: question });
      this.sendMessage({ detail: { value: question } });
    },
  },
});
