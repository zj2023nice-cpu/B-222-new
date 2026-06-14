Component({
  options: {
    multipleSlots: true,
    styleIsolation: "apply-shared",
  },
  externalClasses: ["class-footer-wrap"],
  properties: {
    isRefreshing: {
      type: Boolean,
      value: false,
    },
    isEmpty: {
      type: Boolean,
      value: false,
    },
    showFooter: {
      type: Boolean,
      value: false,
    },
    footerText: {
      type: String,
      value: "已经到底了",
    },
    emptyText: {
      type: String,
      value: "没有找到相关内容",
    },
    emptyIcon: {
      type: String,
      value: "info-circle",
    },
    minHeight: {
      type: String,
      value: "200rpx",
    },
    customStyle: {
      type: String,
      value: "",
    },
    loadingProps: {
      type: Object,
      value: { size: "40rpx" },
    },
  },

  methods: {
    onRefresh() {
      this.triggerEvent("refresh");
    },
  },
});
