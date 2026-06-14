const CLOUD_FUNCTION_NAME = "appointment_service";

async function call(action, params = {}) {
  try {
    const { result } = await wx.cloud.callFunction({
      name: CLOUD_FUNCTION_NAME,
      data: {
        action,
        data: params,
      },
    });
    if (result.code !== 0) {
      throw new Error(result.msg || "服务异常");
    }
    return result;
  } catch (err) {
    console.error(`[Appointment Service Error][${action}]:`, err);
    throw err;
  }
}

const appointmentService = {
  getConsultants: (availableDates) =>
    call("get_consultants", { availableDates }),
  book: (consultantData) => call("book", consultantData),
  cancel: (appointmentId) => call("cancel", { appointmentId }),
  getMyList: () => call("get_my_list"),
  getConsultantAppts: (status) => call("get_consultant_appts", { status }),
  updateStatus: (appointmentId, status) =>
    call("update_status", { appointmentId, status }),
  delete: (appointmentId, role) => call("delete", { appointmentId, role }),
  getConsultantStats: () => call("get_consultant_stats"),
  adminGetStats: () => call("admin_get_stats"),
  adminGetTrend: () => call("admin_get_trend"),
  adminGetList: (params) => call("admin_get_list", params),
  markAsRead: (appointmentIds) => call("mark_read", { appointmentIds }),
  joinWaitlist: (data) => call("join_waitlist", data),
  cancelWaitlist: (waitlistId) => call("cancel_waitlist", { waitlistId }),
  getMyWaitlist: (params) => call("get_my_waitlist", params),
};

export default appointmentService;
