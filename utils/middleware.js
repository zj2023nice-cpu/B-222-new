import router from "./router";

/**
 * 页面中间件包装器
 * - onLoad：执行权限守卫
 * - onShow：同步 tabBar 高亮
 *
 * 注意：
 * 1. 跳转优先用 router.navigateTo / switchTab / reLaunch，它们在跳转前就会守卫
 * 2. SafePage 在此做兜底，防止直接用 wx.* 原生 API 绕过守卫的场景
 */
export const SafePage = function (config) {
  const _onLoad = config.onLoad;
  config.onLoad = function (options) {
    const userInfo = router.getUserInfo();
    const currentPath = this.route;

    const access = router.checkAccess(currentPath, userInfo);

    console.log(`[Router Guard] Path: ${currentPath}`);
    console.log(
      `[Router Guard] UserRole: ${userInfo ? userInfo.role : "none"}`,
    );
    console.log(
      `[Router Guard] Access: ${access.canAccess}${!access.canAccess ? `, reason=${access.reason}, redirect=${access.redirect}` : ""}`,
    );

    if (!access.canAccess) {
      console.warn(
        `[Router Guard] 拒绝访问 ${currentPath}, 重定向至 ${access.redirect}`,
      );
      if (access.reason === "unauthorized") {
        const pages = getCurrentPages();
        const curPage = pages[pages.length - 1];
        if (curPage) {
          const fullUrl = curPage.route + (curPage.options ? _stringifyOptions(curPage.options) : "");
          router.setRedirect("/" + fullUrl);
        }
      }
      wx.reLaunch({ url: access.redirect });
      return;
    }

    if (_onLoad) {
      _onLoad.call(this, options);
    }
  };

  const _onShow = config.onShow;
  config.onShow = function () {
    router.syncTabBar(this);

    if (_onShow) {
      _onShow.call(this);
    }
  };

  return Page(config);
};

function _stringifyOptions(options) {
  if (!options) return "";
  const pairs = Object.keys(options).map(
    (k) => `${encodeURIComponent(k)}=${encodeURIComponent(options[k])}`,
  );
  return pairs.length ? "?" + pairs.join("&") : "";
}
