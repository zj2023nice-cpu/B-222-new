import Dialog from "tdesign-miniprogram/dialog/index";
import Toast from "tdesign-miniprogram/toast/index";
import userService from "../../../../services/user";
import { formatTime } from "../../../../utils/util";

// 定义一个组件外部的持久变量，用于在组件卸载后依然保留选项卡状态
let lastSelectedTab = "user";

Component({
  options: {
    addGlobalClass: true,
    styleIsolation: "apply-shared",
  },

  properties: {},

  data: {
    currentTab: lastSelectedTab, // 初始化时读取持久变量
    keyword: "",
    list: [],
    page: 1,
    pageSize: 20,
    hasMore: true,
    isLoading: true,
    pullDownRefreshing: false,
    skeletonAvatar: [[{ width: "100rpx", height: "100rpx", type: "circle" }]],
    skeletonText: [
      [{ width: "30%", height: "32rpx", marginBottom: "16rpx" }],
      [{ width: "50%", height: "24rpx" }],
    ],
    stickyProps: {
      zIndex: 2,
      offsetTop: 0,
      tabsOffsetTop: 0,
    },
    userInfoVisible: false,
    userDetail: {},
  },

  lifetimes: {
    attached() {
      this.calcHeights();
      this.loadData(true);
    },
  },

  pageLifetimes: {
    show() {
      // 当从编辑页面返回时，刷新列表数据以同步更新
      if (typeof this.loadData === "function") {
        this.loadData(true);
      }
    },
  },

  methods: {
    calcHeights() {
      const app = getApp();
      const navbarHeight = app.globalData.navbarHeight;

      this.setData({
        "stickyProps.offsetTop": navbarHeight,
      });

      setTimeout(() => {
        this.createSelectorQuery()
          .select(".search-wrap")
          .boundingClientRect((rect) => {
            if (rect) {
              this.setData({
                "stickyProps.tabsOffsetTop": navbarHeight + rect.height,
              });
            }
          })
          .exec();
      }, 500);
    },

    onPullDownRefresh() {
      this.setData({ pullDownRefreshing: true });
      this.loadData(true);
    },

    onTabChange(e) {
      lastSelectedTab = e.detail.value; // 同步保存到持久变量
      this.setData({
        currentTab: e.detail.value,
        list: [],
        hasMore: true,
        page: 1,
        isLoading: true,
      });
      this.loadData(true);
    },

    onSearch(e) {
      this.setData({
        keyword: e.detail.value,
        isLoading: true,
      });
      this.loadData(true);
    },

    onSearchClear() {
      this.setData({
        keyword: "",
        isLoading: true,
      });
      this.loadData(true);
    },

    async loadData(reset = false) {
      if (this.data.isLoading && !reset) return;

      this.setData({ isLoading: true });

      try {
        const page = reset ? 1 : this.data.page;
        const { currentTab, keyword, pageSize } = this.data;

        const res = await userService.getUserList({
          queryRole: currentTab,
          page,
          pageSize,
          keyword,
        });

        if (res.code === 0) {
          let newList = res.data.list.map((item) => ({
            ...item,
            createTimeFormat: item.createTime
              ? formatTime(new Date(item.createTime))
              : "-",
          }));

          if (!reset) {
            newList = [...this.data.list, ...newList];
          }

          this.setData({
            list: newList,
            page: page + 1,
            hasMore: newList.length < res.data.total,
            pullDownRefreshing: false,
          });
        } else {
          throw new Error(res.msg);
        }
      } catch (err) {
        console.error(err);
        Toast({
          context: this,
          selector: "#t-toast",
          message: "加载失败",
          theme: "error",
          direction: "column",
        });
        this.setData({ pullDownRefreshing: false });
      } finally {
        this.setData({ isLoading: false });
      }
    },
    onViewTap(e) {
      const { item } = e.currentTarget.dataset;
      this.handleView(item);
    },

    onEditTap(e) {
      const { item } = e.currentTarget.dataset;
      this.handleEdit(item);
    },

    onDeleteTap(e) {
      const { item } = e.currentTarget.dataset;
      this.handleDelete(item);
    },

    async handleView(item) {
      if (!item || !item._id) {
        Toast({
          context: this,
          selector: "#t-toast",
          message: "用户信息错误",
          theme: "error",
          direction: "column",
        });
        return;
      }

      try {
        Toast({
          context: this,
          selector: "#t-toast",
          message: "加载中...",
          theme: "loading",
          duration: 0,
          direction: "column",
        });

        const res = await userService.adminGetUserInfo(
          item._id,
          this.data.currentTab,
        );

        const toast = this.selectComponent("#t-toast");
        if (toast) {
          toast.hide();
        }

        if (res.code === 0) {
          const userInfo = res.data;
          let timeStr = "-";
          if (userInfo.createTime) {
            try {
              timeStr = formatTime(new Date(userInfo.createTime));
            } catch (e) {
              timeStr = String(userInfo.createTime);
            }
          }

          this.setData({
            userDetail: {
              ...userInfo,
              createTimeFormatted: timeStr,
            },
            userInfoVisible: true,
          });
        } else {
          throw new Error(res.msg);
        }
      } catch (err) {
        console.error(err);
        Toast({
          context: this,
          selector: "#t-toast",
          message: "获取失败: " + (err.message || "未知错误"),
          theme: "error",
          direction: "column",
        });
      }
    },

    onDialogAvatarError() {
      this.setData({
        "userDetail.avatar": "",
      });
    },

    onCloseUserDialog() {
      this.setData({ userInfoVisible: false });
    },

    onCopyID() {
      const { _id } = this.data.userDetail;
      if (!_id) return;
      wx.setClipboardData({
        data: _id,
        success: () => {},
      });
    },

    handleEdit(item) {
      if (item.isSystem) {
        Toast({
          context: this,
          selector: "#t-toast",
          message: "暂无最高权限",
          theme: "warning",
          direction: "column",
        });
        return;
      }
      const role = this.data.currentTab; // 'user' or 'consultant'
      wx.navigateTo({
        url: `/pages/admin/user-edit/user-edit?id=${item._id}&role=${role}`,
        events: {
          // 监听编辑页成功保存后发出的 refreshList 事件
          refreshList: () => {
            console.log("Receive refreshList event from edit page");
            this.loadData(true);
          },
        },
      });
    },

    handleDelete(item) {
      if (item.isSystem) {
        Toast({
          context: this,
          selector: "#t-toast",
          message: "暂无最高权限",
          theme: "warning",
          direction: "column",
        });
        return;
      }
      Dialog.confirm({
        context: this,
        selector: "#t-dialog",
        title: "⚠️ 确认删除用户",
        content: `您正在操作：删除用户 "${item.name}"\n\n注意：此操作将永久清除该用户的所有核心数据及关联资产，此过程不可逆转，请务必确认后操作。`,
        confirmBtn: { content: "确认删除", theme: "danger", variant: "base" },
        cancelBtn: "取消",
      })
        .then(async () => {
          try {
            Toast({
              context: this,
              selector: "#t-toast",
              message: "删除中...",
              theme: "loading",
              duration: 0,
              direction: "column",
            });

            const res = await userService.adminDeleteUser(
              item._id,
              this.data.currentTab,
            );

            if (res.code === 0) {
              Toast({
                context: this,
                selector: "#t-toast",
                message: "删除成功",
                theme: "success",
                direction: "column",
              });
              // Refresh list
              const newList = this.data.list.filter((i) => i._id !== item._id);
              this.setData({ list: newList });
            } else {
              throw new Error(res.msg);
            }
          } catch (err) {
            Toast({
              context: this,
              selector: "#t-toast",
              message: "删除失败: " + err.message,
              theme: "error",
              direction: "column",
            });
          }
        })
        .catch(() => {
          // cancel
        });
    },

    onAvatarError(e) {
      const { index } = e.currentTarget.dataset;
      this.setData({
        [`list[${index}].avatar`]: "",
      });
    },
  },
});
