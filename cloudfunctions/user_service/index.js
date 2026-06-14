const cloud = require("wx-server-sdk");
cloud.init({ env: cloud.DYNAMIC_TYPE_CACHEREAD });
const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext();
  
  // 核心修复：兼容多种调用结构（平铺或嵌套在 data 中）
  let { action, data } = event;
  if (!action && event.data && typeof event.data === "object") {
    action = event.data.action;
    data = event.data.data;
  }
  // 如果提取后仍然没有 data，则使用原始 event 作为 data（兼容直接平铺参数的调用）
  if (!data) data = event;

  console.log(`[User Service] Action: ${action}, OpenID: ${OPENID}`);

  switch (action) {
    case "get_stats":
      return await getStats(OPENID, data);
    case "delete_account":
      return await deleteAccount(OPENID, data);
    case "register":
      return await register(OPENID, data);
    case "check_user":
      return await checkUser(OPENID, data);
    case "update_consultant":
      return await updateConsultant(OPENID, data);
    case "get_user_list":
      return await getUserList(OPENID, data);
    case "admin_delete_user":
      return await adminDeleteUser(OPENID, data);
    case "admin_get_user_info":
      return await adminGetUserInfo(OPENID, data);
    case "admin_update_consultant":
      return await adminUpdateConsultant(OPENID, data);
    case "admin_update_user":
      return await adminUpdateUser(OPENID, data);
    default:
      console.error(`[User Service] Unknown action: ${action}`);
      return { code: -1, msg: `Unknown action: ${action}` };
  }
};

async function adminGetUserInfo(openid, { userId, role }) {
  try {
    if (!(await isAdmin(openid))) {
      return { code: 403, msg: "Permission denied" };
    }

    let collectionName = "users";
    if (role === "consultant") collectionName = "consultants";
    else if (role === "admin") collectionName = "admins";

    const res = await db.collection(collectionName).doc(userId).get();
    if (!res.data) {
      return { code: 404, msg: "User not found" };
    }

    const userData = res.data;
    const targetOpenid = userData._openid;

    // Count successful consultations
    let query = { status: "completed" };
    if (role === "consultant") {
      query.consultantOpenid = targetOpenid;
    } else {
      query._openid = targetOpenid;
    }

    const apptCount = await db.collection("appointments").where(query).count();

    return {
      code: 0,
      data: {
        ...userData,
        consultationCount: apptCount.total,
      },
    };
  } catch (err) {
    return { code: 500, msg: err.message };
  }
}

async function adminUpdateConsultant(openid, data) {
  try {
    if (!(await isAdmin(openid))) {
      return { code: 403, msg: "Permission denied" };
    }

    const { _id, name, title, expertise, introduction, avatar } = data;

    const userRes = await db.collection("consultants").doc(_id).get();
    if (userRes.data && userRes.data.isSystem) {
      return { code: 403, msg: "系统内置成员，禁止修改" };
    }

    await db
      .collection("consultants")
      .doc(_id)
      .update({
        data: {
          name,
          title,
          expertise,
          introduction,
          avatar,
          updateTime: db.serverDate(),
        },
      });

    return { code: 0 };
  } catch (err) {
    return { code: 500, msg: err.message };
  }
}

async function isAdmin(openid) {
  const count = await db
    .collection("admins")
    .where({ _openid: openid })
    .count();
  return count.total > 0;
}

async function getUserList(
  openid,
  { queryRole, page = 1, pageSize = 20, keyword = "" },
) {
  try {
    if (!(await isAdmin(openid))) {
      return { code: 403, msg: "Permission denied" };
    }

    const collectionName = queryRole === "consultant" ? "consultants" : "users";
    let query = {};
    if (keyword) {
      query.name = db.RegExp({
        regexp: keyword,
        options: "i",
      });
    }

    const skip = (page - 1) * pageSize;
    const countRes = await db.collection(collectionName).where(query).count();
    const listRes = await db
      .collection(collectionName)
      .where(query)
      .skip(skip)
      .limit(pageSize)
      .orderBy("createTime", "desc")
      .get();

    return {
      code: 0,
      data: {
        total: countRes.total,
        list: listRes.data,
      },
    };
  } catch (err) {
    return { code: 500, msg: err.message };
  }
}

async function adminDeleteUser(openid, { targetId, targetRole }) {
  try {
    if (!(await isAdmin(openid))) {
      return { code: 403, msg: "Permission denied" };
    }

    const collectionName =
      targetRole === "consultant" ? "consultants" : "users";
    const userRes = await db.collection(collectionName).doc(targetId).get();

    if (!userRes.data) {
      return { code: 404, msg: "User not found" };
    }

    const targetOpenid = userRes.data._openid;
    const isSystem = userRes.data.isSystem || false;

    if (isSystem) {
      return { code: 403, msg: "系统内置成员，禁止删除" };
    }

    return await performDelete(targetOpenid, targetRole);
  } catch (err) {
    return { code: 500, msg: err.message };
  }
}

async function performDelete(targetOpenid, role) {
  try {
    let collectionName = "users";
    if (role === "consultant") collectionName = "consultants";
    else if (role === "admin") collectionName = "admins";

    // 1. 获取用户信息以拿到头像文件ID
    const userRes = await db
      .collection(collectionName)
      .where({ _openid: targetOpenid })
      .get();

    const avatarFileID = userRes.data[0]?.avatar;

    // 2. 级联删除各业务表数据
    const tasks = [
      db.collection(collectionName).where({ _openid: targetOpenid }).remove(),
      db.collection("appointments").where({ _openid: targetOpenid }).remove(),
      db.collection("mood_diaries").where({ _openid: targetOpenid }).remove(),
      db
        .collection("user_collections")
        .where({ _openid: targetOpenid })
        .remove(),
      db
        .collection("student_test_records")
        .where({ _openid: targetOpenid })
        .remove(),
    ];

    await Promise.all(tasks);

    // 3. 删除云存储中的头像文件
    if (avatarFileID && avatarFileID.startsWith("cloud://")) {
      try {
        await cloud.deleteFile({
          fileList: [avatarFileID],
        });
      } catch (e) {
        console.error("头像文件删除失败", e);
      }
    }

    return { code: 0 };
  } catch (err) {
    console.error("删除失败:", err);
    throw err;
  }
}

async function getStats(openid, eventData = {}) {
  try {
    const role = eventData.role || "user";

    if (role === "consultant") {
      const consultantRes = await db
        .collection("consultants")
        .where({ _openid: openid })
        .get();

      const consultantId =
        consultantRes.data.length > 0 ? consultantRes.data[0]._id : null;

      const pendingCount = await db
        .collection("appointments")
        .where({ consultantId, status: "booked" })
        .count();
      const totalCount = await db
        .collection("appointments")
        .where({ consultantId, status: _.in(["confirmed", "completed"]) })
        .count();
      return {
        code: 0,
        data: {
          pendingCount: pendingCount.total,
          totalCount: totalCount.total,
          score:
            consultantRes.data.length > 0
              ? consultantRes.data[0].score || "5.0"
              : "5.0",
        },
      };
    }

    // Role is student / user
    const apptCount = await db
      .collection("appointments")
      .where({ _openid: openid, status: "completed" })
      .count();
    const collectionCount = await db
      .collection("user_collections")
      .where({ _openid: openid })
      .count();
    const moodCount = await db
      .collection("mood_diaries")
      .where({ _openid: openid })
      .count();

    return {
      code: 0,
      data: {
        apptCount: apptCount.total,
        collectionCount: collectionCount.total,
        moodCount: moodCount.total,
      },
    };
  } catch (err) {
    return { code: 500, msg: err.message };
  }
}

async function deleteAccount(openid, data) {
  try {
    const { role } = data;
    return await performDelete(openid, role);
  } catch (err) {
    console.error("注销失败:", err);
    return { code: 500, msg: err.message };
  }
}

async function register(openid, data) {
  try {
    const { role, name, avatar } = data;

    // Determine collection based on role
    let collectionName = "users";
    if (role === "consultant") collectionName = "consultants";
    else if (role === "admin") collectionName = "admins";

    // Check duplicate name in the target collection
    const nameCheck = await db.collection(collectionName).where({ name }).get();
    if (nameCheck.data.length > 0) {
      return { code: 409, msg: "昵称已被占用" };
    }

    const userInfo = {
      _openid: openid,
      role, // Still useful to store role inside the doc
      name,
      avatar,
      loginTime: new Date().getTime(),
      createTime: db.serverDate(),
    };

    const res = await db.collection(collectionName).add({ data: userInfo });
    return { code: 0, data: { ...userInfo, _id: res._id } };
  } catch (err) {
    return { code: 500, msg: err.message };
  }
}

async function checkUser(openid, data) {
  try {
    const { role } = data;
    let collectionName = "users";
    if (role === "consultant") collectionName = "consultants";
    else if (role === "admin") collectionName = "admins";

    const query = { _openid: openid };
    if (collectionName === "users") {
      query.role = role;
    }

    const res = await db.collection(collectionName).where(query).get();

    if (res.data.length > 0) {
      // Ensure role is consistent in returned data
      return { code: 0, data: { ...res.data[0], role } };
    } else {
      return { code: 404, msg: "用户不存在" };
    }
  } catch (err) {
    return { code: 500, msg: err.message };
  }
}

async function updateConsultant(openid, data) {
  try {
    const { name, title, introduction, expertise, avatar } = data;
    const res = await db
      .collection("consultants")
      .where({ _openid: openid })
      .get();

    const payload = {
      name,
      title,
      introduction, // Unified field name
      expertise,
      avatar,
      updateTime: db.serverDate(),
    };

    if (res.data.length > 0) {
      await db.collection("consultants").doc(res.data[0]._id).update({
        data: payload,
      });
    } else {
      await db.collection("consultants").add({
        data: {
          ...payload,
          _openid: openid,
          createTime: db.serverDate(),
        },
      });
    }
    return { code: 0 };
  } catch (err) {
    return { code: 500, msg: err.message };
  }
}
async function adminUpdateUser(openid, data) {
  try {
    if (!(await isAdmin(openid))) {
      return { code: 403, msg: "Permission denied" };
    }

    const { _id, role, name, avatar, ...rest } = data;
    let collectionName = "users";
    if (role === "consultant") collectionName = "consultants";
    else if (role === "admin") collectionName = "admins";

    const userRes = await db.collection(collectionName).doc(_id).get();
    if (userRes.data && userRes.data.isSystem) {
      return { code: 403, msg: "系统内置成员，禁止修改" };
    }

    const updateData = {
      name,
      avatar,
      updateTime: db.serverDate(),
    };

    // If consultant, add consultant-specific fields
    if (role === "consultant") {
      updateData.title = rest.title;
      updateData.expertise = rest.expertise;
      updateData.introduction = rest.introduction;
    }

    await db.collection(collectionName).doc(_id).update({
      data: updateData,
    });

    return { code: 0 };
  } catch (err) {
    return { code: 500, msg: err.message };
  }
}
