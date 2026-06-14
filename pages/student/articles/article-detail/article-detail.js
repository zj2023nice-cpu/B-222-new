import Toast from "tdesign-miniprogram/toast/index";
const articleService = require("../../../../services/article").default;

Page({
  data: {
    id: "",
    article: null,
    isLoading: true,
    isCollected: false,
    collectId: null, // 存储收藏记录的 ID，方便删除
    skeletonConfig: [
      { width: "80%", height: "48rpx", margin: "0 0 40rpx" },
      {
        width: "100%",
        height: "400rpx",
        borderRadius: "16rpx",
        margin: "0 0 40rpx",
      },
      { width: "100%", height: "32rpx", margin: "0 0 20rpx" },
      { width: "100%", height: "32rpx", margin: "0 0 20rpx" },
      { width: "60%", height: "32rpx", margin: "0 0 20rpx" },
    ],
    isPageLoading: false,
  },

  onLoad(options) {
    const { id } = options;
    if (id) {
      this.setData({ id });
      this.fetchArticleDetail(id);
      this.checkCollectStatus(id);
    } else {
      Toast({
        context: this,
        selector: "#t-toast",
        message: "参数异常",
        duration: 1500,
        theme: "warning",
        direction: "column",
      });
      setTimeout(() => wx.navigateBack(), 1500);
    }
  },

  async fetchArticleDetail(id) {
    this.setData({ isLoading: true });
    try {
      const result = await articleService.getDetail(id);
      const article = result.data;

      // 健壮性处理：确保 content 存在且为字符串
      if (article) {
        if (typeof article.content === "string") {
          article.content = this.parseMarkdown(article.content);
        } else if (!article.content) {
          article.content =
            "<p style='color: #999; text-align: center; margin-top: 50rpx;'>正文内容正在赶来的路上...</p>";
        }
        // 格式化日期
        if (article.date) {
          article.date = this.formatShortDate(new Date(article.date));
        }
      }

      this.setData({
        article,
        isCollected: result.isCollected,
        collectId: result.collectId,
      });
    } catch (err) {
      console.error("获取文章详情失败:", err);
      Toast({
        context: this,
        selector: "#t-toast",
        message: "文章不存在",
        duration: 1500,
        theme: "warning",
        direction: "column",
      });
      setTimeout(() => wx.navigateBack(), 1500);
    } finally {
      this.setData({ isLoading: false });
    }
  },

  // 检查收藏状态逻辑已合并到 fetchArticleDetail
  async checkCollectStatus() {},

  // 切换收藏状态
  async toggleCollect() {
    const { isCollected, id, article } = this.data;

    try {
      const result = await articleService.toggleCollect(
        id,
        { title: article.title, cover: article.cover },
        isCollected,
      );

      this.setData({
        isCollected: result.isCollected,
        collectId: result.collectId || null,
      });

      Toast({
        context: this,
        selector: "#t-toast",
        message: result.isCollected ? "收藏成功" : "已取消收藏",
        theme: "success",
        direction: "column",
      });
    } catch (err) {
      console.error("收藏操作失败", err);
      Toast({
        context: this,
        selector: "#t-toast",
        message: "操作失败",
        theme: "error",
        direction: "column",
      });
    }
  },

  formatShortDate(date) {
    const y = date.getFullYear();
    const m = (date.getMonth() + 1).toString().padStart(2, "0");
    const d = date.getDate().toString().padStart(2, "0");
    return `${y}-${m}-${d}`;
  },

  onShareAppMessage() {
    return {
      title: this.data.article.title,
      path: `/pages/student/articles/article-detail/article-detail?id=${this.data.id}`,
    };
  },

  // 状态化 Markdown 解析器：支持空行折叠，防止间距过大
  parseMarkdown(md) {
    if (!md) return "";

    // 1. 预处理：标准化换行，将 <br/> 统一转换为换行符
    const rawLines = md
      .replace(/\r\n/g, "\n")
      .replace(/<br\s*\/?>/g, "\n")
      .split("\n");
    const blocks = [];
    let currentParagraph = [];
    let lastWasSpacer = false; // 增加空行折叠标记

    // 辅助函数：将当前积累的段落行推入结果
    const flushParagraph = () => {
      if (currentParagraph.length > 0) {
        const text = currentParagraph.join("<br/>");
        blocks.push(
          `<div style="margin-bottom: 24rpx; line-height: 1.8; color: #444; text-align: justify; word-break: break-all;">${this.parseInline(text)}</div>`,
        );
        currentParagraph = [];
        lastWasSpacer = false;
      }
    };

    for (let i = 0; i < rawLines.length; i++) {
      const line = rawLines[i];
      const trimmed = line.trim();

      // CASE 1: 真正意义上的空行 (处理 \n\n 和折叠)
      if (trimmed === "") {
        flushParagraph();
        // 如果上一个块已经是个空行间距了，或者是文章开头，则不再重复添加
        if (!lastWasSpacer && blocks.length > 0) {
          blocks.push(
            '<div style="height: 24rpx; line-height: 24rpx; overflow: hidden;">&nbsp;</div>',
          );
          lastWasSpacer = true;
        }
        continue;
      }

      // CASE 2: 标题
      const headingMatch = line.match(/^\s*(#{1,3})\s*(.*)/);
      if (headingMatch) {
        flushParagraph();
        const level = headingMatch[1].length;
        const text = headingMatch[2].trim();
        const styles = [
          "",
          "padding: 40rpx 0 32rpx; font-weight: bold; font-size: 44rpx; color: #333; text-align: center; display: block;",
          "padding: 48rpx 0 24rpx; font-weight: bold; font-size: 38rpx; color: #333; border-left: 10rpx solid #0052d9; padding-left: 20rpx; line-height: 1.4; display: block;",
          "padding: 32rpx 0 16rpx; font-weight: bold; font-size: 34rpx; color: #333; line-height: 1.4; display: block;",
        ];
        blocks.push(
          `<div style="${styles[level]}">${this.parseInline(text)}</div>`,
        );
        lastWasSpacer = false;
        continue;
      }

      // CASE 3: 列表
      const listMatch = line.match(/^\s*([-*]|\d+\.)\s+(.*)/);
      if (listMatch) {
        flushParagraph();
        const bullet = isNaN(parseInt(listMatch[1])) ? "•" : listMatch[1];
        const text = this.parseInline(listMatch[2].trim());
        blocks.push(`<div style="display: flex; align-items: flex-start; padding: 12rpx 0; padding-left: 12rpx;">
          <span style="color: #0052d9; margin-right: 16rpx; font-weight: bold; flex-shrink: 0;">${bullet}</span>
          <span style="flex: 1; color: #444; line-height: 1.6;">${text}</span>
        </div>`);
        lastWasSpacer = false;
        continue;
      }

      // CASE 4: 普通文本行 -> 积累到当前段落
      currentParagraph.push(line);
      lastWasSpacer = false;
    }

    // 扫描结束，刷新最后剩余的段落
    flushParagraph();

    return `<div style="padding: 10rpx 0 80rpx; letter-spacing: 0.5rpx;">${blocks.join("")}</div>`;
  },

  // 辅助解析行内样式
  parseInline(text) {
    if (!text) return "";
    let html = text;
    // 1. 处理粗体
    html = html.replace(
      /\*\*(.*?)\*\*/g,
      '<strong style="font-weight: 600; color: #0052d9;">$1</strong>',
    );
    // 2. 处理斜体/修饰
    html = html.replace(
      /\*(.*?)\*/g,
      '<em style="font-style: italic; color: #666; opacity: 0.9;">$1</em>',
    );
    return html;
  },
});
