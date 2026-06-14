const cloud = require("wx-server-sdk");
cloud.init({ env: cloud.DYNAMIC_TYPE_CACHEREAD });
const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext();
  
  // 核心修复：兼容多种调用结构
  let { action, data } = event;
  if (!action && event.data && typeof event.data === "object") {
    action = event.data.action;
    data = event.data.data;
  }
  if (!data) data = event;

  switch (action) {
    case "add":
      return await addMood(OPENID, data);
    case "fetch_history":
      return await fetchHistory(OPENID);
    default:
      return { code: -1, msg: "Unknown action" };
  }
};

async function addMood(openid, data) {
  try {
    const { mood, content, dateStr } = data;
    const res = await db.collection("mood_diaries").add({
      data: {
        _openid: openid,
        mood,
        content,
        dateStr,
        createTime: db.serverDate(),
      },
    });
    return { code: 0, data: res };
  } catch (err) {
    return { code: 500, msg: err.message };
  }
}

async function fetchHistory(openid) {
  try {
    const res = await db
      .collection("mood_diaries")
      .where({ _openid: openid })
      .orderBy("createTime", "desc")
      .get();
    return { code: 0, data: res.data };
  } catch (err) {
    return { code: 500, msg: err.message };
  }
}
