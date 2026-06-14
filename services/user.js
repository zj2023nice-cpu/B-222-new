const CLOUD_FUNCTION_NAME = "user_service";

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
    console.error(`[User Service Error][${action}]:`, err);
    throw err;
  }
}

const userService = {
  getStats: (role) => call("get_stats", { role }),
  deleteAccount: (role) => call("delete_account", { role }),
  register: (role, name, avatar) => call("register", { role, name, avatar }),
  checkUser: (role) => call("check_user", { role }),
  updateConsultant: (profile) => call("update_consultant", profile),
  getUserList: (params) => call("get_user_list", params),
  adminDeleteUser: (targetId, targetRole) =>
    call("admin_delete_user", { targetId, targetRole }),
  adminGetUserInfo: (userId, role) =>
    call("admin_get_user_info", { userId, role }),
  adminUpdateConsultant: (profile) => call("admin_update_consultant", profile),
  adminUpdateUser: (data) => call("admin_update_user", data),
};

export default userService;
