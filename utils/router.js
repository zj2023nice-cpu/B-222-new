/**
 * 路由与权限配置中心
 */

// 角色 Tab 配置
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

// 全局页面路由权限映射 (path -> requiredRole)
const ROUTE_PERMISSIONS = {
  // 公共页面
  "pages/login/login": "guest",

  // 混合容器页面 (内部做 view 切换)
  "pages/main/home/home": "auth",
  "pages/main/records/records": "auth",
  "pages/main/mine/mine": "auth",

  // 咨询师与管理员共有容器
  "pages/main/assessment/assessment": ["consultant", "admin"],
  "pages/main/exam/exam": ["consultant", "admin"],

  // 咨询师专属
  "pages/consultant/assessment-edit/edit": "consultant",
  "pages/consultant/profile/profile": "consultant",

  // 学生专属 (位于 pages/student)
  "pages/student/appointment/appointment": "user",
  "pages/student/appointment-list/appointment-list": "user",
  "pages/student/articles/articles": "user",
  "pages/student/articles/article-detail/article-detail": "user",
  "pages/student/collections/collections": "user",
  "pages/student/mood/mood": "user",
  "pages/student/assessment/assessment": "user",
  "pages/student/assessment/assessment-detail/assessment-detail": "user",

  // 管理员专属
  "pages/admin/user-manage/user-manage": "admin",
  "pages/admin/knowledge-manage/knowledge-manage": "admin",
  "pages/admin/consultation-manage/consultation-manage": "admin",
  "pages/admin/resource-manage/resource-manage": "admin",
};

export default {
  /**
   * 获取当前角色的 Tab 列表
   */
  getTabsByRole(role) {
    return ROLE_TABS[role] || ROLE_TABS.user;
  },

  /**
   * 路由守卫：检查权限
   */
  checkAccess(path, userInfo) {
    if (!path) {
      console.warn("[Router Guard] Path is undefined");
      return { canAccess: true };
    }
    // 移除路径开头的 / 和查询参数
    const cleanPath = path.split("?")[0].replace(/^\//, "");
    const requiredRole = ROUTE_PERMISSIONS[cleanPath];

    if (!requiredRole || requiredRole === "guest") {
      return { canAccess: true };
    }

    if (!userInfo) {
      return { canAccess: false, redirect: "/pages/login/login" };
    }

    if (requiredRole === "auth") {
      return { canAccess: true };
    }

    // 处理数组类型的权限
    if (Array.isArray(requiredRole)) {
      if (requiredRole.includes(userInfo.role)) {
        return { canAccess: true };
      }
    } else if (userInfo.role === requiredRole) {
      return { canAccess: true };
    }

    // 无权限，重定向到其角色的第一个首页
    return { canAccess: false, redirect: "/pages/main/home/home" };
  },

  /**
   * 获取逻辑索引
   */
  getTabIndex(role, path) {
    const tabs = this.getTabsByRole(role);
    const cleanPath = path.split("?")[0];
    const normalizedPath = cleanPath.startsWith("/")
      ? cleanPath
      : `/${cleanPath}`;
    return tabs.findIndex((tab) => tab.pagePath === normalizedPath);
  },
};
