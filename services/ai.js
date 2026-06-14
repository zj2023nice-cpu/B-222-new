const CLOUD_FUNCTION_NAME = "deepseekChat";
const STORAGE_KEY = "ai_chat_sessions";

const aiService = {
  async chat(messages, sessionId) {
    try {
      const data = { messages };
      if (sessionId) {
        data.sessionId = sessionId;
      }
      const { result } = await wx.cloud.callFunction({
        name: CLOUD_FUNCTION_NAME,
        data,
      });
      return {
        ...result,
        risk: !!result.risk,
        crisisGuide: result.crisisGuide || null,
      };
    } catch (err) {
      console.error("[AI Service Error][chat]:", err);
      throw err;
    }
  },

  async getAiAvatar() {
    try {
      const db = wx.cloud.database();
      const { data } = await db.collection("consultants").limit(1).get();
      if (data && data.length > 0) {
        return data[0].avatar;
      }
      return null;
    } catch (err) {
      console.error("[AI Service Error][getAiAvatar]:", err);
      return null;
    }
  },

  _loadAllSessions() {
    try {
      const raw = wx.getStorageSync(STORAGE_KEY);
      if (!raw) return [];
      return JSON.parse(raw);
    } catch (e) {
      console.error("[AI Service Error][_loadAllSessions]:", e);
      return [];
    }
  },

  _saveAllSessions(sessions) {
    try {
      wx.setStorageSync(STORAGE_KEY, JSON.stringify(sessions));
    } catch (e) {
      console.error("[AI Service Error][_saveAllSessions]:", e);
    }
  },

  getSessions() {
    const sessions = this._loadAllSessions();
    return sessions.sort((a, b) => b.updatedAt - a.updatedAt);
  },

  getSession(sessionId) {
    const sessions = this._loadAllSessions();
    return sessions.find((s) => s.sessionId === sessionId) || null;
  },

  saveSession(session) {
    const sessions = this._loadAllSessions();
    const idx = sessions.findIndex((s) => s.sessionId === session.sessionId);
    session.updatedAt = Date.now();
    if (idx > -1) {
      sessions[idx] = session;
    } else {
      session.createdAt = session.createdAt || Date.now();
      sessions.push(session);
    }
    this._saveAllSessions(sessions);
  },

  deleteSession(sessionId) {
    let sessions = this._loadAllSessions();
    sessions = sessions.filter((s) => s.sessionId !== sessionId);
    this._saveAllSessions(sessions);
  },

  createSession() {
    const session = {
      sessionId: "s_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8),
      title: "",
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    return session;
  },
};

export default aiService;
