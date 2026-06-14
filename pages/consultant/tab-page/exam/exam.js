Component({
  data: {
    navbarHeight: 88,
  },

  lifetimes: {
    attached() {
      const app = getApp();
      this.setData({
        navbarHeight: app.globalData.navbarHeight,
      });
    },
  },

  methods: {},
});
