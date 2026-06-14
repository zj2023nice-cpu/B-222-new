import aiService from "../../../../services/ai";

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

      this.setData({
        sessions: this._getFormattedSessions(),
        currentSession,
        messages: currentSession.messages || [],
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
      });
    },

    onSessionTap(e) {
      const { id } = e.currentTarget.dataset;
      const session = aiService.getSession(id);
      if (!session) return;
      this.setData({
        currentSession: session,
        messages: session.messages || [],
        currentView: "chat",
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
        this.setData({
          currentSession,
          messages: currentSession.messages || [],
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
  },
});
