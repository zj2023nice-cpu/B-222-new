export function checkLogin() {
  const userInfo = wx.getStorageSync("userInfo");
  if (!userInfo) {
    wx.reLaunch({ url: "/pages/login/login" });
    return false;
  }
  return true;
}
