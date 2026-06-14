import router from "./router";

export function checkLogin() {
  const userInfo = router.getUserInfo();
  if (!userInfo) {
    const pages = getCurrentPages();
    const curPage = pages[pages.length - 1];
    if (curPage) {
      const options = curPage.options || {};
      const qs = Object.keys(options)
        .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(options[k])}`)
        .join("&");
      const fullUrl = "/" + curPage.route + (qs ? "?" + qs : "");
      router.setRedirect(fullUrl);
    }
    wx.reLaunch({ url: router.LOGIN_PAGE });
    return false;
  }
  return true;
}
