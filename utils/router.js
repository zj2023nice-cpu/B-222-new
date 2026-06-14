/**
 * 路由与权限配置中心
 *
 * 设计原则：
 * 1. 单一真相源：所有跳转都走 router.navigate / switchTab / reLaunch
 * 2. 权限守卫在跳转前执行，避免页面闪烁
 * 3. 登录回跳：被拦截到登录页时保存 redirect，登录成功后优先回跳
 * 4. 权限回退：目标页权限不匹配时，回退到当前角色的首页
 */

const REDIRECT_STORAGE_KEY = "__router_redirect_url__";

const ROLE_TABS = {
  user: [
    {
      pagePath: "/pages/main/home/home",
      text: "首页",
      icon: "home-filled",
    },
    {
      pagePath: "/pages/main/records/records",
      text: "AI咨询",
      icon: "chat-bubble-filled",
    },
    {
      pagePath: "/pages/main/mine/mine",
      text: "我的",
      icon: "user-filled",
    },
  ],
  consultant: [
    {
      pagePath: "/pages/main/home/home",
      text: "预约管理",
      icon: "calendar-edit-filled",
    },
    {
      pagePath: "/pages/main/records/records",
      text: "咨询评估",
      icon: "user-list-filled",
    },
    {
      pagePath: "/pages/main/assessment/assessment",
      text: "测评管理",
      icon: "assignment-filled",
    },
    {
      pagePath: "/pages/main/exam/exam",
      text: "测评记录",
      icon: "root-list-filled",
    },
    {
      pagePath: "/pages/main/mine/mine",
      text: "我的",
      icon: "user-filled",
    },
  ],
  admin: [
    {
      pagePath: "/pages/main/home/home",
      text: "用户管理",
      icon: "usergroup-filled",
    },
    {
      pagePath: "/pages/main/records/records",
      text: "知识管理",
      icon: "book-open-filled",
    },
    {
      pagePath: "/pages/main/assessment/assessment",
      text: "咨询管理",
      icon: "chat-filled",
    },
    {
      pagePath: "/pages/main/exam/exam",
      text: "资源管理",
      icon: "image-filled",
    },
    {
      pagePath: "/pages/main/mine/mine",
      text: "我的",
      icon: "user-filled",
    },
  ],
};

const ROLE_HOME = {
  user: "/pages/main/home/home",
  consultant: "/pages/main/home/home",
  admin: "/pages/main/home/home",
};

const LOGIN_PAGE = "/pages/login/login";

const TAB_PAGES = new Set([
  "/pages/main/home/home",
  "/pages/main/records/records",
  "/pages/main/assessment/assessment",
  "/pages/main/exam/exam",
  "/pages/main/mine/mine",
]);

const ROUTE_PERMISSIONS = {
  "pages/login/login": "guest",

  "pages/main/home/home": "auth",
  "pages/main/records/records": "auth",
  "pages/main/mine/mine": "auth",
  "pages/main/assessment/assessment": ["consultant", "admin"],
  "pages/main/exam/exam": ["consultant", "admin"],

  "pages/consultant/assessment-edit/edit": "consultant",
  "pages/consultant/profile/profile": "consultant",
  "pages/consultant/tab-page/appointments/appointments": "consultant",
  "pages/consultant/tab-page/assessment/assessment": "consultant",
  "pages/consultant/tab-page/exam/exam": "consultant",
  "pages/consultant/tab-page/mine/mine": "consultant",
  "pages/consultant/tab-page/user-records/user-records": "consultant",

  "pages/student/appointment/appointment": "user",
  "pages/student/appointment-list/appointment-list": "user",
  "pages/student/articles/articles": "user",
  "pages/student/articles/article-detail/article-detail": "user",
  "pages/student/collections/collections": "user",
  "pages/student/mood/mood": "user",
  "pages/student/assessment/assessment": "user",
  "pages/student/assessment/assessment-detail/assessment-detail": "user",
  "pages/student/exam-records/exam-records": "user",
  "pages/student/tab-page/home/home": "user",
  "pages/student/tab-page/ai-chat/ai-chat": "user",
  "pages/student/tab-page/mine/mine": "user",

  "pages/admin/article-edit/article-edit": "admin",
  "pages/admin/banner-manage/banner-manage": "admin",
  "pages/admin/banner-edit/banner-edit": "admin",
  "pages/admin/user-edit/user-edit": "admin",
  "pages/admin/tab-page/consultation-manage/consultation-manage": "admin",
  "pages/admin/tab-page/knowledge-manage/knowledge-manage": "admin",
  "pages/admin/tab-page/mine/mine": "admin",
  "pages/admin/tab-page/resource-manage/resource-manage": "admin",
  "pages/admin/tab-page/user-manage/user-manage": "admin",
};

function cleanPath(url) {
  if (!url) return "";
  return url.split("?")[0].replace(/^\//, "");
}

function normalizePath(url) {
  if (!url) return "";
  const path = url.split("?")[0];
  return path.startsWith("/") ? path : `/${path}`;
}

function getQueryString(url) {
  const idx = url.indexOf("?");
  return idx > -1 ? url.slice(idx) : "";
}

function isTabPage(url) {
  return TAB_PAGES.has(normalizePath(url));
}

function _normalizeArgs(arg0, arg1) {
  if (typeof arg0 === "string") {
    return { url: arg0, options: arg1 || {} };
  }
  if (arg0 && typeof arg0 === "object" && typeof arg0.url === "string") {
    const { url, ...rest } = arg0;
    return { url, options: { ...rest, ...(arg1 || {}) } };
  }
  return { url: "", options: arg1 || {} };
}

export default {
  LOGIN_PAGE,
  REDIRECT_STORAGE_KEY,

  getTabsByRole(role) {
    return ROLE_TABS[role] || ROLE_TABS.user;
  },

  getHomeByRole(role) {
    return ROLE_HOME[role] || ROLE_HOME.user;
  },

  isTabPage,

  getTabIndex(role, path) {
    const tabs = this.getTabsByRole(role);
    const normalized = normalizePath(path);
    return tabs.findIndex((tab) => tab.pagePath === normalized);
  },

  getUserInfo() {
    try {
      return wx.getStorageSync("userInfo") || null;
    } catch (e) {
      return null;
    }
  },

  checkAccess(url, userInfo) {
    const path = cleanPath(url);

    if (!path) {
      return { canAccess: true };
    }

    const requiredRole = ROUTE_PERMISSIONS[path];

    if (!requiredRole || requiredRole === "guest") {
      return { canAccess: true };
    }

    const resolvedUser = userInfo || this.getUserInfo();

    if (!resolvedUser) {
      return {
        canAccess: false,
        reason: "unauthorized",
        redirect: LOGIN_PAGE,
      };
    }

    if (requiredRole === "auth") {
      return { canAccess: true };
    }

    let hasRole = false;
    if (Array.isArray(requiredRole)) {
      hasRole = requiredRole.includes(resolvedUser.role);
    } else {
      hasRole = resolvedUser.role === requiredRole;
    }

    if (hasRole) {
      return { canAccess: true };
    }

    return {
      canAccess: false,
      reason: "forbidden",
      redirect: this.getHomeByRole(resolvedUser.role),
    };
  },

  setRedirect(url) {
    try {
      if (url) {
        wx.setStorageSync(REDIRECT_STORAGE_KEY, url);
      } else {
        wx.removeStorageSync(REDIRECT_STORAGE_KEY);
      }
    } catch (e) {}
  },

  consumeRedirect() {
    try {
      const url = wx.getStorageSync(REDIRECT_STORAGE_KEY) || "";
      wx.removeStorageSync(REDIRECT_STORAGE_KEY);
      return url;
    } catch (e) {
      return "";
    }
  },

  _doNavigate(method, url, options = {}) {
    return new Promise((resolve, reject) => {
      const params = {
        success: resolve,
        fail: reject,
      };
      if (method === "navigateBack") {
        params.delta = options.delta || 1;
      } else {
        params.url = url;
      }
      wx[method](params);
    });
  },

  async navigateTo(arg0, arg1) {
    const { url, options } = _normalizeArgs(arg0, arg1);
    const userInfo = this.getUserInfo();
    const access = this.checkAccess(url, userInfo);

    if (!access.canAccess) {
      if (access.reason === "unauthorized") {
        this.setRedirect(url);
      }
      return this._doNavigate("reLaunch", access.redirect);
    }

    if (isTabPage(url)) {
      return this._doNavigate("switchTab", normalizePath(url));
    }

    return this._doNavigate("navigateTo", url, options);
  },

  async switchTab(arg0, arg1) {
    const { url, options } = _normalizeArgs(arg0, arg1);
    const userInfo = this.getUserInfo();
    const target = normalizePath(url);
    const access = this.checkAccess(target, userInfo);

    if (!access.canAccess) {
      if (access.reason === "unauthorized") {
        this.setRedirect(target);
      }
      return this._doNavigate("reLaunch", access.redirect);
    }

    if (!isTabPage(target)) {
      return this._doNavigate("navigateTo", url, options);
    }

    return this._doNavigate("switchTab", target);
  },

  async reLaunch(arg0, arg1) {
    const { url, options } = _normalizeArgs(arg0, arg1);
    const userInfo = this.getUserInfo();
    const access = this.checkAccess(url, userInfo);

    if (!access.canAccess) {
      if (access.reason === "unauthorized") {
        this.setRedirect(url);
      }
      return this._doNavigate("reLaunch", access.redirect);
    }

    if (isTabPage(url)) {
      return this._doNavigate("switchTab", normalizePath(url));
    }

    return this._doNavigate("reLaunch", url, options);
  },

  navigateBack(delta = 1) {
    return this._doNavigate("navigateBack", "", { delta });
  },

  goAfterLogin(role) {
    const redirect = this.consumeRedirect();
    if (redirect) {
      const access = this.checkAccess(redirect, this.getUserInfo());
      if (access.canAccess) {
        if (isTabPage(redirect)) {
          return this._doNavigate("switchTab", normalizePath(redirect));
        }
        return this._doNavigate("reLaunch", redirect);
      }
    }
    const home = this.getHomeByRole(role);
    return this._doNavigate("switchTab", home);
  },

  syncTabBar(pageCtx) {
    if (!pageCtx || typeof pageCtx.getTabBar !== "function") return;
    const userInfo = this.getUserInfo();
    if (!userInfo) return;

    wx.nextTick(() => {
      try {
        const tabBar = pageCtx.getTabBar();
        if (!tabBar) return;

        const pages = getCurrentPages();
        if (!pages.length) return;

        const currentPath = pages[pages.length - 1].route;
        const index = this.getTabIndex(userInfo.role, currentPath);

        if (index > -1) {
          tabBar.setData({ selected: index });
        }
        if (typeof tabBar.updateRole === "function") {
          tabBar.updateRole();
        }
      } catch (e) {
        console.warn("[Router] syncTabBar error:", e);
      }
    });
  },
};
