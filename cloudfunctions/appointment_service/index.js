const cloud = require("wx-server-sdk");
cloud.init({ env: cloud.DYNAMIC_TYPE_CACHEREAD });
const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext();
  
  // 核心修复：兼容多种调用结构（已统一逻辑）
  let { action, data } = event;
  if (!action && event.data && typeof event.data === "object") {
    action = event.data.action;
    data = event.data.data;
  }
  if (!data) data = event;

  switch (action) {
    case "get_consultants":
      return await getConsultants(OPENID, data);
    case "book":
      return await book(OPENID, data);
    case "cancel":
      return await cancel(OPENID, data);
    case "get_my_list":
      return await getMyList(OPENID);
    case "get_consultant_appts":
      return await getConsultantAppts(OPENID, data);
    case "update_status":
      return await updateStatus(OPENID, data);
    case "get_consultant_stats":
      return await getConsultantStats(OPENID);
    case "delete":
      return await deleteAppointment(OPENID, data);
    case "admin_get_stats":
      return await adminGetStats(OPENID);
    case "admin_get_trend":
      return await adminGetTrend(OPENID);
    case "admin_get_list":
      return await adminGetList(OPENID, data);
    case "mark_read":
      return await markRead(OPENID, data);
    case "join_waitlist":
      return await joinWaitlist(OPENID, data);
    case "cancel_waitlist":
      return await cancelWaitlist(OPENID, data);
    case "get_my_waitlist":
      return await getMyWaitlist(OPENID, data);
    default:
      return { code: -1, msg: "Unknown action" };
  }
};

async function adminGetTrend(openid) {
  try {
    if (!(await isAdmin(openid))) {
      return { code: 403, msg: "权限不足" };
    }

    const now = new Date();
    // Use local date for grouping
    const dates = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      dates.push(dateStr);
    }

    // Query for appointments created in the last 7 days
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const res = await db
      .collection("appointments")
      .where({
        createTime: _.gte(sevenDaysAgo),
      })
      .limit(1000)
      .get();

    const trendMap = {};
    dates.forEach((d) => (trendMap[d] = 0));

    res.data.forEach((appt) => {
      if (appt.createTime) {
        const d = new Date(appt.createTime);
        const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        if (trendMap[dateStr] !== undefined) {
          trendMap[dateStr]++;
        }
      }
    });

    const trend = dates.map((d) => ({
      date: d.substring(5), // MM-DD
      count: trendMap[d],
    }));

    return { code: 0, data: trend };
  } catch (err) {
    return { code: 500, msg: err.message };
  }
}

async function deleteAppointment(openid, eventData) {
  try {
    const appointmentId =
      eventData.appointmentId ||
      (eventData.data && eventData.data.appointmentId);
    const role = eventData.role || (eventData.data && eventData.data.role);

    if (!appointmentId) {
      return { code: 400, msg: "缺少预约ID" };
    }

    const apptRes = await db
      .collection("appointments")
      .doc(appointmentId)
      .get();
    if (!apptRes.data) return { code: 404, msg: "记录不存在" };
    const appt = apptRes.data;

    // 1. 如果明确指定是 consultant 角色，优先执行咨询师删除逻辑
    if (role === "consultant") {
      const consultantRes = await db
        .collection("consultants")
        .where({ _openid: openid })
        .get();
      if (consultantRes.data.length > 0) {
        const consultantId = consultantRes.data[0]._id;
        if (appt.consultantId === consultantId) {
          await db
            .collection("appointments")
            .doc(appointmentId)
            .update({
              data: {
                deletedByConsultant: true,
              },
            });
          return { code: 0 };
        }
      }
      return { code: 403, msg: "无权操作此记录" };
    }

    // 2. 默认逻辑：检查是否为学生本人
    if (appt._openid === openid) {
      await db
        .collection("appointments")
        .doc(appointmentId)
        .update({
          data: {
            deletedByStudent: true,
          },
        });
      return { code: 0 };
    }

    // 3. 默认逻辑 fallback：检查是否为该预约的业务咨询师
    const consultantRes = await db
      .collection("consultants")
      .where({ _openid: openid })
      .get();
    if (consultantRes.data.length > 0) {
      const consultantId = consultantRes.data[0]._id;
      if (appt.consultantId === consultantId) {
        await db
          .collection("appointments")
          .doc(appointmentId)
          .update({
            data: {
              deletedByConsultant: true,
            },
          });
        return { code: 0 };
      }
    }

    return { code: 403, msg: "无权操作此记录" };
  } catch (err) {
    return { code: 500, msg: err.message };
  }
}

async function getConsultants(openid, data) {
  try {
    const { availableDates } = data;
    const consultantsRes = await db.collection("consultants").get();
    const allBookedRes = await db
      .collection("appointments")
      .where({
        status: _.in(["booked", "confirmed"]),
        deletedByStudent: _.neq(true),
      })
      .limit(200)
      .get();
    const allBookedData = allBookedRes.data;

    const myWaitlistRes = await db
      .collection("waitlist")
      .where({
        _openid: openid,
        status: _.in(["waiting", "notified"]),
      })
      .get();
    const myWaitlistData = myWaitlistRes.data;

    const timeTemplates = [
      "08:00-09:00",
      "09:00-10:00",
      "10:00-11:00",
      "11:00-12:00",
      "14:00-15:00",
      "15:00-16:00",
      "16:00-17:00",
      "17:00-18:00",
    ];
    const consultants = consultantsRes.data.map((item) => {
      const myAppt = allBookedData.find(
        (a) => a.consultantId === item._id && a._openid === openid,
      );

      const myWaitlist = myWaitlistData.filter(
        (w) => w.consultantId === item._id,
      );

      const realSchedule = availableDates.map((d) => {
        const slots = timeTemplates.map((t) => {
          const isTaken = allBookedData.some(
            (a) =>
              a.consultantId === item._id &&
              a.dateStr === d.dateStr &&
              a.time === t,
          );
          return { time: t, isFull: isTaken };
        });
        const isFull = slots.every((s) => s.isFull);

        const waitlistEntry = myWaitlist.find(
          (w) => w.dateStr === d.dateStr,
        );

        return {
          dateStr: d.dateStr,
          slots,
          isFull,
          waitlistStatus: waitlistEntry ? waitlistEntry.status : "",
          waitlistId: waitlistEntry ? waitlistEntry._id : "",
          queueNumber: waitlistEntry ? waitlistEntry.queueNumber : 0,
        };
      });

      return {
        ...item,
        isBooked: !!myAppt,
        bookedId: myAppt ? myAppt._id : "",
        bookedDate: myAppt ? myAppt.dateStr : "",
        bookedTime: myAppt ? myAppt.time : "",
        schedule: realSchedule,
      };
    });

    const hasActiveAppt = allBookedData.some((a) => a._openid === openid);

    return { code: 0, data: consultants, hasActiveAppt };
  } catch (err) {
    return { code: 500, msg: err.message };
  }
}

async function book(openid, data) {
  try {
    const {
      consultantId,
      consultantName,
      consultantAvatar,
      consultantTitle,
      dateStr,
      time,
    } = data;

    // 使用事务确保原子性
    const transaction = await db.startTransaction();

    try {
      // 1. 在事务中检查是否已被预约
      const check = await transaction
        .collection("appointments")
        .where({
          consultantId,
          dateStr,
          time,
          status: "booked",
        })
        .get();

      if (check.data.length > 0) {
        await transaction.rollback();
        return { code: 400, msg: "该时段已约满" };
      }

      // 1.5 检查该用户是否已有进行中的预约
      // 只有当咨询状态为已取消(cancelled)或者已完成(completed)时，才能预约其他咨询师
      // 换言之，如果状态是 booked(待确认) 或 confirmed(待咨询)，则不能预约
      // 注意：rejected(已拒绝) 通常也视为结束，不应阻碍新预约，除非业务逻辑强制要求删除。
      // 这里遵从“单一进行中”原则，锁定 booked 和 confirmed 状态。
      const userCheck = await transaction
        .collection("appointments")
        .where({
          _openid: openid,
          status: _.in(["booked", "confirmed"]),
          deletedByStudent: _.neq(true), // 确保没有被学生“假删除”
        })
        .get();

      if (userCheck.data.length > 0) {
        await transaction.rollback();
        return {
          code: 400,
          msg: "您有进行中的预约，需完成或取消后才可再次预约",
        };
      }

      // 2. 插入新预约
      const res = await transaction.collection("appointments").add({
        data: {
          _openid: openid,
          consultantId,
          consultantName,
          consultantAvatar,
          consultantTitle,
          dateStr,
          time,
          status: "booked",
          createTime: db.serverDate(),
        },
      });

      // 3. 提交事务
      await transaction.commit();

      return { code: 0, _id: res._id };
    } catch (txErr) {
      await transaction.rollback();
      throw txErr;
    }
  } catch (err) {
    return { code: 500, msg: err.message };
  }
}

async function cancel(openid, data) {
  try {
    const { appointmentId } = data;
    const apptRes = await db
      .collection("appointments")
      .doc(appointmentId)
      .get();
    const appt = apptRes.data;

    await db
      .collection("appointments")
      .doc(appointmentId)
      .update({
        data: {
          status: "cancelled",
          cancelTime: db.serverDate(),
        },
      });

    if (appt && appt.consultantId && appt.dateStr) {
      await tryNotifyWaitlist(appt.consultantId, appt.dateStr);
    }

    return { code: 0 };
  } catch (err) {
    return { code: 500, msg: err.message };
  }
}

async function getMyList(openid) {
  try {
    const apptsRes = await db
      .collection("appointments")
      .where({
        _openid: openid,
        deletedByStudent: _.neq(true),
      })
      .orderBy("createTime", "desc")
      .get();

    let appointments = apptsRes.data;

    // 逻辑排序：将“待审核”(booked)和“待咨询”(confirmed)状态排在最前面，其余按时间倒序
    appointments.sort((a, b) => {
      const activeStatuses = ["booked", "confirmed"];
      const isAActive = activeStatuses.includes(a.status);
      const isBActive = activeStatuses.includes(b.status);
      if (isAActive && !isBActive) return -1;
      if (!isAActive && isBActive) return 1;
      return 0;
    });

    const consultantIds = [...new Set(appointments.map((a) => a.consultantId))];

    if (consultantIds.length > 0) {
      const consultantsRes = await db
        .collection("consultants")
        .where({
          _id: _.in(consultantIds),
        })
        .get();

      const consultantMap = {};
      consultantsRes.data.forEach((c) => {
        consultantMap[c._id] = c;
      });

      appointments = appointments.map((a) => {
        const latest = consultantMap[a.consultantId];
        if (latest) {
          return {
            ...a,
            consultantAvatar: latest.avatar,
            consultantTitle: latest.title,
            consultantName: latest.name,
            consultantExpertise: latest.expertise,
            createTimeDisplay: a.createTime ? formatDate(a.createTime) : "",
            // Format times for display
            completeTimeDisplay: a.completeTime
              ? formatDate(a.completeTime)
              : "",
            finishTimeDisplay: a.finishTime ? formatDate(a.finishTime) : "",
            formattedCancelTime: a.cancelTime ? formatDate(a.cancelTime) : "",
            processTimeDisplay: a.updateTime ? formatDate(a.updateTime) : "",
          };
        }
        return a;
      });
    }

    return { code: 0, data: appointments };
  } catch (err) {
    return { code: 500, msg: err.message };
  }
}
async function getConsultantAppts(openid, data) {
  try {
    const { status } = data;
    const consultantRes = await db
      .collection("consultants")
      .where({ _openid: openid })
      .get();

    if (consultantRes.data.length === 0) {
      return { code: 403, msg: "非咨询师用户" };
    }
    const consultantId = consultantRes.data[0]._id;

    const query = {
      consultantId,
      deletedByConsultant: _.neq(true),
    };
    if (status) query.status = status;

    const res = await db
      .collection("appointments")
      .where(query)
      .orderBy("createTime", "desc") // Re-adding index-friendly sort if possible, or just sort in JS
      .get();

    let appointments = res.data;

    // Fetch student info
    const studentOpenids = [...new Set(appointments.map((a) => a._openid))];
    if (studentOpenids.length > 0) {
      const studentsRes = await db
        .collection("users")
        .where({
          _openid: _.in(studentOpenids),
        })
        .get();

      const studentMap = {};
      studentsRes.data.forEach((s) => {
        studentMap[s._openid] = s;
      });

      appointments = appointments.map((a) => {
        const student = studentMap[a._openid];
        return {
          ...a,
          studentName: student ? student.name : "未知用户",
          studentAvatar: student ? student.avatar : "",
          // Format times for display
          createTimeDisplay: a.createTime ? formatDate(a.createTime) : "",
          formattedCancelTime: a.cancelTime ? formatDate(a.cancelTime) : "",
          cancelTimeDisplay: a.cancelTime ? formatDate(a.cancelTime) : "",
          updateTimeDisplay: a.updateTime ? formatDate(a.updateTime) : "",
          processTimeDisplay: a.updateTime ? formatDate(a.updateTime) : "",
          completeTimeDisplay: a.completeTime ? formatDate(a.completeTime) : "",
          finishTimeDisplay: a.finishTime ? formatDate(a.finishTime) : "",
        };
      });
    }

    const statusPriority = {
      booked: 1,
      confirmed: 2,
      completed: 3,
      cancelled: 4,
      rejected: 5,
    };

    appointments.sort((a, b) => {
      const pA = statusPriority[a.status] || 99;
      const pB = statusPriority[b.status] || 99;
      if (pA !== pB) return pA - pB;
      return new Date(b.createTime) - new Date(a.createTime);
    });

    return { code: 0, data: appointments };
  } catch (err) {
    return { code: 500, msg: err.message };
  }
}

function formatDate(date) {
  if (!date) return "";
  const d = new Date(date);
  // Add 8 hours for CST if needed, but Cloud Functions usually run in UTC.
  // We'll use a simple approach for now.
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day} ${h}:${min}`;
}

async function updateStatus(openid, data) {
  try {
    const { appointmentId, status } = data;
    // 权限检查：预约记录的 consultantId 对应的 openid 必须是当前用户（或者是管理员）
    const appt = await db.collection("appointments").doc(appointmentId).get();
    if (!appt.data) return { code: 404, msg: "记录不存在" };

    // 检查是否为管理员
    const adminPrivilege = await isAdmin(openid);

    if (!adminPrivilege) {
      const consultant = await db
        .collection("consultants")
        .doc(appt.data.consultantId)
        .get();
      if (!consultant.data || consultant.data._openid !== openid) {
        return { code: 403, msg: "无权操作此记录" };
      }
    }

    const updateData = {
      status: status,
    };
    if (status === "completed") {
      updateData.completeTime = db.serverDate();
    } else {
      updateData.updateTime = db.serverDate();
    }

    await db.collection("appointments").doc(appointmentId).update({
      data: updateData,
    });

    return { code: 0 };
  } catch (err) {
    return { code: 500, msg: err.message };
  }
}

async function getConsultantStats(openid) {
  try {
    const consultantRes = await db
      .collection("consultants")
      .where({ _openid: openid })
      .get();
    if (consultantRes.data.length === 0) {
      return { code: 403, msg: "非咨询师用户" };
    }
    const consultantId = consultantRes.data[0]._id;

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
        score: consultantRes.data[0].score || 5.0,
      },
    };
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

async function adminGetStats(openid) {
  try {
    if (!(await isAdmin(openid))) {
      return { code: 403, msg: "权限不足" };
    }

    const { total: totalCount } = await db.collection("appointments").count();
    const { total: pendingCount } = await db
      .collection("appointments")
      .where({ status: "booked" })
      .count();
    const { total: confirmedCount } = await db
      .collection("appointments")
      .where({ status: "confirmed" })
      .count();
    const { total: completedCount } = await db
      .collection("appointments")
      .where({ status: "completed" })
      .count();
    const { total: cancelledCount } = await db
      .collection("appointments")
      .where({ status: "cancelled" })
      .count();

    return {
      code: 0,
      data: {
        total: totalCount,
        pending: pendingCount,
        confirmed: confirmedCount,
        completed: completedCount,
        cancelled: cancelledCount,
      },
    };
  } catch (err) {
    return { code: 500, msg: err.message };
  }
}

async function adminGetList(openid, params) {
  try {
    if (!(await isAdmin(openid))) {
      return { code: 403, msg: "权限不足" };
    }

    const { status, keyword = "", page = 1, pageSize = 20 } = params;

    // 构造查询条件数组
    const conditions = [];

    // 1. 状态过滤
    if (status) {
      conditions.push({ status });
    }

    // 2. 关键词搜索 (目前支持匹配咨询师姓名)
    if (keyword) {
      const regex = db.RegExp({ regexp: keyword, options: "i" });
      conditions.push(_.or([{ consultantName: regex }]));
    }

    // 组合最终查询
    const query = db
      .collection("appointments")
      .where(conditions.length > 0 ? _.and(conditions) : {});

    const skip = (page - 1) * pageSize;
    const countRes = await query.count();
    const listRes = await query
      .orderBy("createTime", "desc")
      .skip(skip)
      .limit(pageSize)
      .get();

    let list = listRes.data;

    // Enrich with student info
    const studentOpenids = [...new Set(list.map((a) => a._openid))];
    if (studentOpenids.length > 0) {
      const studentsRes = await db
        .collection("users")
        .where({ _openid: _.in(studentOpenids) })
        .get();
      const studentMap = {};
      studentsRes.data.forEach((s) => (studentMap[s._openid] = s));

      list = list.map((a) => ({
        ...a,
        studentName: studentMap[a._openid]?.name || "未知用户",
        studentAvatar: studentMap[a._openid]?.avatar || "",
        createTimeDisplay: a.createTime ? formatDate(a.createTime) : "未知",
      }));
    }

    const statusPriority = {
      booked: 1,
      confirmed: 2,
      completed: 3,
      cancelled: 4,
      rejected: 5,
    };

    list.sort((a, b) => {
      const pA = statusPriority[a.status] || 99;
      const pB = statusPriority[b.status] || 99;
      if (pA !== pB) return pA - pB;
      return new Date(b.createTime) - new Date(a.createTime);
    });

    return {
      code: 0,
      data: {
        list,
        total: countRes.total,
      },
    };
  } catch (err) {
    return { code: 500, msg: err.message };
  }
}
async function markRead(openid, data) {
  try {
    const { appointmentIds } = data;
    if (!appointmentIds || !Array.isArray(appointmentIds)) {
      return { code: 400, msg: "缺少预约ID列表" };
    }
    await db
      .collection("appointments")
      .where({
        _id: _.in(appointmentIds),
        _openid: openid,
      })
      .update({
        data: {
          studentRead: true,
        },
      });
    return { code: 0 };
  } catch (err) {
    return { code: 500, msg: err.message };
  }
}

async function joinWaitlist(openid, data) {
  try {
    const { consultantId, consultantName, consultantAvatar, consultantTitle, dateStr } = data;

    const existingRes = await db
      .collection("waitlist")
      .where({
        _openid: openid,
        consultantId,
        dateStr,
        status: _.in(["waiting", "notified"]),
      })
      .count();

    if (existingRes.total > 0) {
      return { code: 400, msg: "您已在该日期的候补队列中" };
    }

    const activeApptRes = await db
      .collection("appointments")
      .where({
        _openid: openid,
        status: _.in(["booked", "confirmed"]),
        deletedByStudent: _.neq(true),
      })
      .count();

    if (activeApptRes.total > 0) {
      return { code: 400, msg: "您有进行中的预约，需完成或取消后才可候补" };
    }

    const queueCountRes = await db
      .collection("waitlist")
      .where({
        consultantId,
        dateStr,
        status: "waiting",
      })
      .count();

    const res = await db.collection("waitlist").add({
      data: {
        _openid: openid,
        consultantId,
        consultantName,
        consultantAvatar,
        consultantTitle,
        dateStr,
        status: "waiting",
        queueNumber: queueCountRes.total + 1,
        createTime: db.serverDate(),
      },
    });

    return { code: 0, data: { _id: res._id, queueNumber: queueCountRes.total + 1 } };
  } catch (err) {
    return { code: 500, msg: err.message };
  }
}

async function cancelWaitlist(openid, data) {
  try {
    const { waitlistId } = data;
    const wlRes = await db.collection("waitlist").doc(waitlistId).get();
    if (!wlRes.data) {
      return { code: 404, msg: "候补记录不存在" };
    }
    if (wlRes.data._openid !== openid) {
      return { code: 403, msg: "无权操作此记录" };
    }
    await db
      .collection("waitlist")
      .doc(waitlistId)
      .update({
        data: {
          status: "cancelled",
          cancelTime: db.serverDate(),
        },
      });
    return { code: 0 };
  } catch (err) {
    return { code: 500, msg: err.message };
  }
}

async function getMyWaitlist(openid, data) {
  try {
    const { consultantIds, dateStrs } = data || {};
    const query = {
      _openid: openid,
      status: _.in(["waiting", "notified"]),
    };
    if (consultantIds && consultantIds.length > 0) {
      query.consultantId = _.in(consultantIds);
    }
    if (dateStrs && dateStrs.length > 0) {
      query.dateStr = _.in(dateStrs);
    }

    const res = await db
      .collection("waitlist")
      .where(query)
      .orderBy("createTime", "desc")
      .get();

    return { code: 0, data: res.data };
  } catch (err) {
    return { code: 500, msg: err.message };
  }
}

async function tryNotifyWaitlist(consultantId, dateStr) {
  try {
    const bookedRes = await db
      .collection("appointments")
      .where({
        consultantId,
        dateStr,
        status: _.in(["booked", "confirmed"]),
        deletedByStudent: _.neq(true),
      })
      .count();

    const timeTemplates = [
      "08:00-09:00",
      "09:00-10:00",
      "10:00-11:00",
      "11:00-12:00",
      "14:00-15:00",
      "15:00-16:00",
      "16:00-17:00",
      "17:00-18:00",
    ];
    const totalSlots = timeTemplates.length;

    if (bookedRes.total >= totalSlots) {
      return;
    }

    const waitingRes = await db
      .collection("waitlist")
      .where({
        consultantId,
        dateStr,
        status: "waiting",
      })
      .orderBy("queueNumber", "asc")
      .limit(1)
      .get();

    if (waitingRes.data.length === 0) {
      return;
    }

    const firstInQueue = waitingRes.data[0];
    await db
      .collection("waitlist")
      .doc(firstInQueue._id)
      .update({
        data: {
          status: "notified",
          notifyTime: db.serverDate(),
        },
      });
  } catch (err) {
    console.error("tryNotifyWaitlist error:", err);
  }
}
