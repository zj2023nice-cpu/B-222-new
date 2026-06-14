const CLOUD_FUNCTION_NAME = "mood_service";

async function call(action, data = {}) {
  try {
    const { result } = await wx.cloud.callFunction({
      name: CLOUD_FUNCTION_NAME,
      data: { action, data },
    });
    if (result.code !== 0) {
      throw new Error(result.msg || "服务异常");
    }
    return result;
  } catch (err) {
    console.error(`[Mood Service Error][${action}]:`, err);
    throw err;
  }
}

const moodService = {
  add: (mood, content, dateStr) => call("add", { mood, content, dateStr }),
  fetchHistory: () => call("fetch_history"),
};

export default moodService;
