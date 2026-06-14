Component({
  options: {
    addGlobalClass: true, // 允许页面样式影响组件，也可以设为 false 隔离
    styleIsolation: "shared",
  },

  properties: {
    article: {
      type: Object,
      value: {},
    },
    // 是否启用收藏模式（显示星号图标）
    showCollectMode: {
      type: Boolean,
      value: false,
    },
  },

  methods: {
    onTap(e) {
      // 如果点击的是收藏图标，不触发跳转
      if (e.target.dataset.type === "collect") return;

      const { _id, isDeleted } = this.data.article;

      // 如果文章已删除，不允许进入详情页
      if (isDeleted) return;

      // 仅向父级发送点击事件，由父级控制跳转逻辑，防止双重导航
      this.triggerEvent("click", { article: this.data.article });
    },

    onCollectTap() {
      // 触发取消收藏事件，交由父页面处理
      this.triggerEvent("uncollect", { article: this.data.article });
    },
  },
});
