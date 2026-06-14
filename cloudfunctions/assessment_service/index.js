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
    case "get_list":
      return await getList();
    case "get_detail":
      return await getDetail(data);
    case "save":
      return await save(OPENID, data);
    case "delete":
      return await deleteAssessment(data);
    case "get_user_records":
      return await getUserRecords(OPENID, data);
    case "get_consultation_records":
      return await getConsultationRecords(OPENID, data);
    case "submit_evaluation":
      return await submitEvaluation(OPENID, data); // Consultant evaluating student
    case "submit_test":
      return await submitTest(OPENID, data); // Student taking test
    case "get_student_records":
      return await getStudentRecords(OPENID, data);
    default:
      return { code: -1, msg: "Unknown action" };
  }
};

async function getList() {
  try {
    const res = await db
      .collection("assessments")
      .orderBy("createTime", "desc")
      .get();
    return { code: 0, data: res.data };
  } catch (err) {
    return { code: 500, msg: err.message };
  }
}

async function getDetail(data) {
  try {
    const { id } = data;
    const res = await db.collection("assessments").doc(id).get();
    return { code: 0, data: res.data };
  } catch (err) {
    return { code: 500, msg: err.message };
  }
}

async function save(openid, data) {
  try {
    const { id, assessment } = data;
    const payload = {
      title: assessment.title,
      description: assessment.description,
      duration: assessment.duration,
      updateTime: db.serverDate(),
    };

    if (id) {
      await db.collection("assessments").doc(id).update({ data: payload });
      return { code: 0, _id: id };
    } else {
      const res = await db.collection("assessments").add({
        data: {
          ...payload,
          consultantOpenid: openid, // Record who created this assessment
          count: assessment.count || 20,
          createTime: db.serverDate(),
        },
      });
      return { code: 0, _id: res._id };
    }
  } catch (err) {
    return { code: 500, msg: err.message };
  }
}

async function deleteAssessment(data) {
  try {
    const { id } = data;
    await db.collection("assessments").doc(id).remove();
    return { code: 0 };
  } catch (err) {
    return { code: 500, msg: err.message };
  }
}

async function getUserRecords(openid, data) {
  try {
    const { searchQuery } = data;
    const dbCmd = db.command;

    // 获取所有的学生自主测评记录（用于咨询师后台查看全校概况）
    let queryCondition = {};

    if (searchQuery) {
      const reg = db.RegExp({
        regexp: searchQuery,
        options: "i",
      });
      queryCondition = _.or([
        { userName: reg },
        { result: reg },
        { assessmentTitle: reg },
      ]);
    }

    const res = await db
      .collection("student_test_records")
      .where(queryCondition)
      .orderBy("createTime", "desc")
      .get();
    return { code: 0, data: res.data };
  } catch (err) {
    return { code: 500, msg: err.message };
  }
}

async function getConsultationRecords(openid, data) {
  try {
    const { searchQuery } = data;
    const dbCmd = db.command;

    let queryCondition = { type: "consultation" };

    if (searchQuery) {
      const reg = db.RegExp({
        regexp: searchQuery,
        options: "i",
      });
      queryCondition = _.and([
        queryCondition,
        _.or([{ userName: reg }, { result: reg }, { assessmentTitle: reg }]),
      ]);
    }

    const res = await db
      .collection("assessment_records")
      .where(queryCondition)
      .orderBy("createTime", "desc")
      .get();
    return { code: 0, data: res.data };
  } catch (err) {
    return { code: 500, msg: err.message };
  }
}

async function submitEvaluation(openid, data) {
  try {
    const {
      currentApptId,
      evalScore,
      evalResult,
      studentOpenid,
      studentName,
      studentAvatar,
    } = data;

    // 1. Update appointment status
    if (currentApptId) {
      await db
        .collection("appointments")
        .doc(currentApptId)
        .update({
          data: {
            status: "completed",
            score: parseInt(evalScore),
            feedback: evalResult,
            finishTime: db.serverDate(),
          },
        });
    }

    // 2. Add record
    await db.collection("assessment_records").add({
      data: {
        _openid: studentOpenid || openid,
        consultantOpenid: openid,
        userName: studentName || "匿名学生",
        userAvatar: studentAvatar || "",
        assessmentTitle: "心理咨询评估",
        score: parseInt(evalScore),
        result: evalResult,
        type: "consultation",
        finishTime: db.serverDate(),
        createTime: db.serverDate(),
      },
    });

    return { code: 0 };
  } catch (err) {
    return { code: 500, msg: err.message };
  }
}

async function submitTest(openid, data) {
  try {
    const {
      assessmentId,
      assessmentTitle,
      score,
      result,
      userName,
      userAvatar,
    } = data;

    // Get the assessment to find the consultant who created it
    let consultantOpenid = "";
    try {
      const assessment = await db
        .collection("assessments")
        .doc(assessmentId)
        .get();
      consultantOpenid = assessment.data.consultantOpenid || "";
    } catch (e) {
      console.log("Failed to get assessment creator", e);
    }

    await db.collection("student_test_records").add({
      data: {
        _openid: openid, // Student
        assessmentId,
        assessmentTitle,
        consultantOpenid, // Ensure consultant can see it
        score: parseInt(score),
        result,
        userName: userName || "匿名学生",
        userAvatar: userAvatar || "",
        createTime: db.serverDate(),
      },
    });

    // Update assessment count
    await db
      .collection("assessments")
      .doc(assessmentId)
      .update({
        data: {
          count: _.inc(1),
        },
      });

    return { code: 0 };
  } catch (err) {
    return { code: 500, msg: err.message };
  }
}

async function getStudentRecords(openid, data) {
  try {
    const { searchQuery } = data;
    const queryCondition = { _openid: openid };

    if (searchQuery) {
      queryCondition.assessmentTitle = db.RegExp({
        regexp: searchQuery,
        options: "i",
      });
    }

    const res = await db
      .collection("student_test_records")
      .where(queryCondition)
      .orderBy("createTime", "desc")
      .get();
    return { code: 0, data: res.data };
  } catch (err) {
    return { code: 500, msg: err.message };
  }
}
