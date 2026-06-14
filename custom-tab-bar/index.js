import router from "../utils/router";

Component({
  data: {
    selected: 0,
    list: [],
  },

  attached() {
    this.updateRole();
  },

  methods: {
    updateRole() {
      const userInfo = wx.getStorageSync("userInfo");
      const role = userInfo ? userInfo.role : "user";
      const app = getApp();
      const tabBadges = (app && app.globalData.tabBadges) || {};

      const tabs = router.getTabsByRole(role).map((tab) => ({
        ...tab,
        badge: { count: tabBadges[tab.text] || 0 },
      }));

      this.setData({
        list: tabs,
      });
    },

    onChange(e) {
      const index = e.detail.value;
      const url = this.data.list[index].pagePath;

      this.setData({
        selected: index,
      });

      router.switchTab(url);
    },

    /**
     * 设置某个 Tab 的徽标数量
     * @param {string} text Tab 文字
     * @param {number} count 数量
     */
    setBadge(text, count) {
      const app = getApp();
      if (app) {
        if (!app.globalData.tabBadges) app.globalData.tabBadges = {};
        app.globalData.tabBadges[text] = count || 0;
      }

      const list = [...this.data.list];
      const index = list.findIndex((item) => item.text === text);
      if (index > -1) {
        list[index].badge = { count: count || 0 };
        this.setData({ list });
      }
    },
  },
});
