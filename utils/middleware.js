import router from "./router";

/**
 * 页面中间件包装器
 * @param {Object} config 原生的 Page 配置对象
 */
export const SafePage = function (config) {
  // 拦截 onLoad
  const _onLoad = config.onLoad;
  config.onLoad = function (options) {
    const userInfo = wx.getStorageSync("userInfo");
    const currentPath = this.route;

    const access = router.checkAccess(currentPath, userInfo);

    console.log(`[Router Guard] Path: ${currentPath}`);
    console.log(
      `[Router Guard] UserRole: ${userInfo ? userInfo.role : "none"}`,
    );
    console.log(
      `[Router Guard] Access: ${access.canAccess}${!access.canAccess ? ", Redirecting to " + access.redirect : ""}`,
    );

    if (!access.canAccess) {
      console.warn(
        `[Router Guard] 拒绝访问 ${currentPath}, 重定向至 ${access.redirect}`,
      );
      wx.reLaunch({
        url: access.redirect,
      });
      return;
    }

    // 执行原 onLoad
    if (_onLoad) {
      _onLoad.call(this, options);
    }
  };

  // 拦截 onShow 处理 TabBar 状态同步
  const _onShow = config.onShow;
  config.onShow = function () {
    const userInfo = wx.getStorageSync("userInfo");
    if (userInfo && typeof this.getTabBar === "function") {
      // 核心修复：在 Windows 模拟器下，使用 nextTick 延迟执行 TabBar 更新
      // 避免在页面切换的瞬间（frame 切换时）访问 TabBar 导致框架底层抛出 __subPageFrameEndTime__ 错误
      wx.nextTick(() => {
        const tabBar = this.getTabBar();
        if (tabBar) {
          const pages = getCurrentPages();
          if (pages.length === 0) return;
          const currentPath = pages[pages.length - 1].route;
          const index = router.getTabIndex(userInfo.role, currentPath);

          if (index > -1) {
            tabBar.setData({
              selected: index,
            });
            if (typeof tabBar.updateRole === "function") {
              tabBar.updateRole();
            }
          }
        }
      });
    }

    if (_onShow) {
      _onShow.call(this);
    }
  };

  return Page(config);
};
