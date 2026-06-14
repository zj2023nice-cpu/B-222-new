const cloud = require("wx-server-sdk");
cloud.init({ env: cloud.DYNAMIC_TYPE_CACHEREAD });
const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext();
  
  // 核心修复：兼容多种调用结构
  let { action, data } = event;
  if (!action && event.data && typeof event.data === "object") {
    action = event.data.action;
    data = event.data.data;
  }
  if (!data) data = event;

  switch (action) {
    case "get_list":
      return await getArticles(data);
    case "get_detail":
      return await getArticleDetail(OPENID, data);
    case "toggle_collect":
      return await toggleCollect(OPENID, data);
    case "get_collections":
      return await getCollections(OPENID);
    case "get_home_data":
      return await getHomeData();
    case "get_recommended":
      return await getRecommended(data);
    case "get_recommended_by_assessment":
      return await getRecommendedByAssessment(data);

    // 管理端接口
    case "admin_get_list":
      return await adminGetArticles(OPENID, data);
    case "admin_create":
      return await adminCreateArticle(OPENID, data);
    case "admin_update":
      return await adminUpdateArticle(OPENID, data);
    case "admin_delete":
      return await adminDeleteArticle(OPENID, data);
    case "admin_get_banners":
      return await adminGetBanners(OPENID, data);
    case "admin_add_banner":
      return await adminAddBanner(OPENID, data);
    case "admin_update_banner":
      return await adminUpdateBanner(OPENID, data);
    case "admin_delete_banner":
      return await adminDeleteBanner(OPENID, data);
    default:
      return { code: -1, msg: "Unknown action" };
  }
};

async function isAdmin(openid) {
  const count = await db
    .collection("admins")
    .where({ _openid: openid })
    .count();
  return count.total > 0;
}

async function adminGetArticles(
  openid,
  { keyword = "", page = 1, pageSize = 20 },
) {
  try {
    if (!(await isAdmin(openid))) {
      return { code: 403, msg: "权限不足" };
    }

    let query = db.collection("articles");
    if (keyword) {
      query = query.where({
        title: db.RegExp({ regexp: keyword, options: "i" }),
      });
    }

    const skip = (page - 1) * pageSize;
    const countRes = await query.count();
    const listRes = await query
      .orderBy("date", "desc")
      .skip(skip)
      .limit(pageSize)
      .get();

    return {
      code: 0,
      data: {
        list: listRes.data,
        total: countRes.total,
      },
    };
  } catch (err) {
    return { code: 500, msg: err.message };
  }
}

async function adminCreateArticle(openid, articleData) {
  try {
    if (!(await isAdmin(openid))) {
      return { code: 403, msg: "权限不足" };
    }

    const { title, cover, content, category, desc } = articleData;
    if (!title || !content) {
      return { code: 400, msg: "标题和内容不能为空" };
    }

    const res = await db.collection("articles").add({
      data: {
        title,
        cover: cover || "",
        content,
        category: category || "心理科普",
        desc: desc || "",
        views: 0,
        date: db.serverDate(), // 对应之前的 date 排序字段
        updateTime: db.serverDate(),
      },
    });

    return { code: 0, data: res._id };
  } catch (err) {
    return { code: 500, msg: err.message };
  }
}

async function adminUpdateArticle(openid, { _id, ...updateData }) {
  try {
    if (!(await isAdmin(openid))) {
      return { code: 403, msg: "权限不足" };
    }

    if (!_id) return { code: 400, msg: "缺少文章ID" };

    // 格式化更新数据，确保不更新 _id 和 _openid
    delete updateData._id;
    delete updateData._openid;
    updateData.updateTime = db.serverDate();

    const articleRes = await db.collection("articles").doc(_id).get();
    if (articleRes.data && articleRes.data.isSystem) {
      return { code: 403, msg: "暂无此数据变更权限" };
    }

    await db.collection("articles").doc(_id).update({
      data: updateData,
    });

    return { code: 0, msg: "更新成功" };
  } catch (err) {
    return { code: 500, msg: err.message };
  }
}

async function adminDeleteArticle(openid, { _id }) {
  try {
    if (!(await isAdmin(openid))) {
      return { code: 403, msg: "权限不足" };
    }

    if (!_id) return { code: 400, msg: "缺少文章ID" };

    // 1. 获取文章信息以拿到封面图 fileID
    const articleRes = await db.collection("articles").doc(_id).get();
    const article = articleRes.data;

    // 2. 权限校验：系统文章禁止删除
    if (article && article.isSystem) {
      return { code: 403, msg: "暂无此数据变更权限" };
    }

    // 3. 如果存在封面且是云存储文件，则删除
    if (article && article.cover && article.cover.startsWith("cloud://")) {
      try {
        await cloud.deleteFile({
          fileList: [article.cover],
        });
      } catch (e) {
        console.error("Failed to delete cover image:", e);
        // 不阻断后续逻辑
      }
    }

    // 3. 删除数据库记录
    await db.collection("articles").doc(_id).remove();

    // 同时清理收藏记录
    await db.collection("user_collections").where({ articleId: _id }).remove();

    return { code: 0, msg: "删除成功" };
  } catch (err) {
    return { code: 500, msg: err.message };
  }
}

async function getArticles(data = {}) {
  try {
    const { keyword } = data;
    let query = db.collection("articles");
    if (keyword) {
      query = query.where({
        title: db.RegExp({ regexp: "^" + keyword, options: "" }),
      });
    } else {
      // 避免全表扫描告警
      query = query.where({
        _id: _.exists(true),
      });
    }
    const res = await query.orderBy("date", "desc").limit(20).get();
    return { code: 0, data: res.data };
  } catch (err) {
    return { code: 500, msg: err.message };
  }
}

async function getArticleDetail(openid, data) {
  try {
    const { id } = data;
    const res = await db.collection("articles").doc(id).get();

    // 自动增加阅读量
    await db
      .collection("articles")
      .doc(id)
      .update({
        data: { views: _.inc(1) },
      });

    // 手动在返回结果里+1，让前端能立刻看到变化
    if (res.data) {
      res.data.views = (res.data.views || 0) + 1;
    }

    // 检查收藏状态
    const collectRes = await db
      .collection("user_collections")
      .where({
        _openid: openid,
        articleId: id,
      })
      .get();

    return {
      code: 0,
      data: res.data,
      isCollected: collectRes.data.length > 0,
      collectId: collectRes.data.length > 0 ? collectRes.data[0]._id : null,
    };
  } catch (err) {
    return { code: 500, msg: err.message };
  }
}

async function toggleCollect(openid, data) {
  try {
    const { articleId, article, isCollected } = data;
    if (isCollected) {
      // 取消收藏
      await db
        .collection("user_collections")
        .where({
          _openid: openid,
          articleId: articleId,
        })
        .remove();
      return { code: 0, isCollected: false };
    } else {
      // 添加收藏
      const res = await db.collection("user_collections").add({
        data: {
          _openid: openid,
          articleId: articleId,
          title: article.title,
          cover: article.cover,
          date: db.serverDate(),
          type: "article",
        },
      });
      return { code: 0, isCollected: true, collectId: res._id };
    }
  } catch (err) {
    return { code: 500, msg: err.message };
  }
}

async function getCollections(openid) {
  try {
    const res = await db
      .collection("user_collections")
      .where({ _openid: openid })
      .orderBy("date", "desc")
      .get();

    const collectionList = res.data;
    if (collectionList.length === 0) return { code: 0, data: [] };

    const articleIds = collectionList.map((item) => item.articleId);
    const articlesRes = await db
      .collection("articles")
      .where({
        _id: _.in(articleIds),
      })
      .get();

    const articleMap = {};
    articlesRes.data.forEach((art) => {
      articleMap[art._id] = art;
    });

    const finalCollections = collectionList.map((c) => {
      const art = articleMap[c.articleId];
      return art
        ? { ...art, isDeleted: false }
        : {
            _id: c.articleId,
            title: c.title,
            cover: c.cover,
            category: "已失效",
            views: 0,
            isDeleted: true,
          };
    });

    return { code: 0, data: finalCollections };
  } catch (err) {
    return { code: 500, msg: err.message };
  }
}

async function getRecommended(data = {}) {
  try {
    const { categories = [], limit = 3 } = data;
    let query = db.collection("articles");

    if (categories.length > 0) {
      query = query.where({
        category: _.in(categories),
      });
    } else {
      query = query.where({ _id: _.exists(true) });
    }

    const res = await query.orderBy("date", "desc").limit(limit).get();
    return { code: 0, data: res.data };
  } catch (err) {
    return { code: 500, msg: err.message };
  }
}

async function getRecommendedByAssessment(data = {}) {
  try {
    const {
      score,
      primaryCategories = [],
      secondaryCategories = [],
      fallbackCategories = [],
      keywords = [],
      limit = 3,
    } = data;

    const ALL_PSYCHOLOGY_CATEGORIES = [
      "心理科普",
      "情绪疗愈",
      "人际交流",
      "专业视角",
      "自我成长",
    ];

    const collectedIds = new Set();
    const finalArticles = [];
    const tierStats = [];

    async function fetchByCategory(catList, fetchLimit) {
      if (!catList || catList.length === 0) return [];
      try {
        const validCategories = catList.filter((c) =>
          ALL_PSYCHOLOGY_CATEGORIES.includes(c)
        );
        if (validCategories.length === 0) return [];

        const res = await db
          .collection("articles")
          .where({ category: _.in(validCategories) })
          .orderBy("date", "desc")
          .limit(fetchLimit)
          .get();
        return res.data || [];
      } catch (e) {
        console.error("fetchByCategory error:", e);
        return [];
      }
    }

    async function fetchByKeywordsInCategories(
      keywordList,
      catList,
      fetchLimit
    ) {
      if (!keywordList || keywordList.length === 0) return [];
      if (!catList || catList.length === 0) return [];

      try {
        const validCategories = catList.filter((c) =>
          ALL_PSYCHOLOGY_CATEGORIES.includes(c)
        );
        if (validCategories.length === 0) return [];

        const titleOrConditions = keywordList.map((kw) => ({
          title: db.RegExp({ regexp: kw, options: "i" }),
        }));
        const descOrConditions = keywordList.map((kw) => ({
          desc: db.RegExp({ regexp: kw, options: "i" }),
        }));

        const res = await db
          .collection("articles")
          .where({
            category: _.in(validCategories),
            _id: _.exists(true),
          })
          .where(_.or([...titleOrConditions, ...descOrConditions]))
          .orderBy("date", "desc")
          .limit(fetchLimit)
          .get();
        return res.data || [];
      } catch (e) {
        console.error("fetchByKeywordsInCategories error:", e);
        return [];
      }
    }

    function addUniqueArticles(articles, tierName) {
      let added = 0;
      for (const article of articles) {
        if (finalArticles.length >= limit) break;
        if (!collectedIds.has(article._id)) {
          collectedIds.add(article._id);
          finalArticles.push(article);
          added++;
        }
      }
      if (tierName) {
        tierStats.push({ name: tierName, count: added });
      }
      return added;
    }

    let tier1Count = 0;
    if (finalArticles.length < limit && primaryCategories.length > 0) {
      const tier1Articles = await fetchByCategory(
        primaryCategories,
        limit * 2
      );
      tier1Count = addUniqueArticles(tier1Articles, "primary_category");
    }

    let tier2Count = 0;
    if (finalArticles.length < limit && keywords.length > 0) {
      const remaining = limit - finalArticles.length;
      const tier2Articles = await fetchByKeywordsInCategories(
        keywords,
        primaryCategories,
        remaining * 2
      );
      tier2Count = addUniqueArticles(tier2Articles, "primary_keyword");
    }

    let tier3Count = 0;
    if (finalArticles.length < limit && secondaryCategories.length > 0) {
      const remaining = limit - finalArticles.length;
      const tier3Articles = await fetchByCategory(
        secondaryCategories,
        remaining * 2
      );
      tier3Count = addUniqueArticles(tier3Articles, "secondary_category");
    }

    let tier4Count = 0;
    if (finalArticles.length < limit && keywords.length > 0) {
      const remaining = limit - finalArticles.length;
      const tier4Articles = await fetchByKeywordsInCategories(
        keywords,
        secondaryCategories,
        remaining * 2
      );
      tier4Count = addUniqueArticles(tier4Articles, "secondary_keyword");
    }

    let tier5Count = 0;
    if (finalArticles.length < limit && fallbackCategories.length > 0) {
      const remaining = limit - finalArticles.length;
      const tier5Articles = await fetchByCategory(
        fallbackCategories,
        remaining * 2
      );
      tier5Count = addUniqueArticles(tier5Articles, "fallback_category");
    }

    let tier6Count = 0;
    if (finalArticles.length < limit && keywords.length > 0) {
      const remaining = limit - finalArticles.length;
      const tier6Articles = await fetchByKeywordsInCategories(
        keywords,
        fallbackCategories,
        remaining * 2
      );
      tier6Count = addUniqueArticles(tier6Articles, "fallback_keyword");
    }

    let tier7Count = 0;
    if (finalArticles.length < limit && keywords.length > 0) {
      const remaining = limit - finalArticles.length;
      const tier7Articles = await fetchByKeywordsInCategories(
        keywords,
        ALL_PSYCHOLOGY_CATEGORIES,
        remaining * 2
      );
      tier7Count = addUniqueArticles(tier7Articles, "all_category_keyword");
    }

    let tier8Count = 0;
    if (finalArticles.length < limit) {
      const remaining = limit - finalArticles.length;
      let allRelatedCategories = [
        ...new Set([
          ...primaryCategories,
          ...secondaryCategories,
          ...fallbackCategories,
        ]),
      ].filter((c) => ALL_PSYCHOLOGY_CATEGORIES.includes(c));

      if (allRelatedCategories.length === 0) {
        allRelatedCategories = [...ALL_PSYCHOLOGY_CATEGORIES];
      }

      const tier8Articles = await fetchByCategory(
        allRelatedCategories,
        remaining * 2
      );
      tier8Count = addUniqueArticles(tier8Articles, "related_category_fallback");
    }

    return {
      code: 0,
      data: finalArticles,
      meta: {
        total: finalArticles.length,
        targetLimit: limit,
        score,
        primaryCategories,
        secondaryCategories,
        fallbackCategories,
        keywords,
        tiers: tierStats,
      },
    };
  } catch (err) {
    console.error("getRecommendedByAssessment error:", err);
    return { code: 500, msg: err.message, data: [] };
  }
}

async function getHomeData() {
  try {
    const [carouselRes, articlesRes] = await Promise.all([
      db
        .collection("carousel")
        .where({ isActive: _.neq(false) })
        .orderBy("order", "asc")
        .orderBy("createTime", "desc")
        .limit(5)
        .get(),
      db
        .collection("articles")
        .where({ _id: _.exists(true) })
        .orderBy("date", "desc")
        .limit(3)
        .get(),
    ]);

    return {
      code: 0,
      data: {
        carouselList: carouselRes.data,
        articles: articlesRes.data,
      },
    };
  } catch (err) {
    return { code: 500, msg: err.message };
  }
}

async function adminGetBanners(openid, { keyword = "" } = {}) {
  try {
    if (!(await isAdmin(openid))) return { code: 403, msg: "权限不足" };
    let query = db.collection("carousel");
    if (keyword) {
      query = query.where({
        title: db.RegExp({ regexp: keyword, options: "i" }),
      });
    }
    const res = await query
      .orderBy("order", "asc")
      .orderBy("createTime", "desc")
      .get();
    return { code: 0, data: res.data };
  } catch (err) {
    return { code: 500, msg: err.message };
  }
}

async function adminAddBanner(openid, data) {
  try {
    if (!(await isAdmin(openid))) return { code: 403, msg: "权限不足" };
    const { imageUrl, title, content, order = 0, isActive = true } = data;
    if (!imageUrl || !title) return { code: 400, msg: "图片和标题不能为空" };

    const res = await db.collection("carousel").add({
      data: {
        imageUrl,
        title,
        content: content || "",
        order: parseInt(order),
        isActive,
        createTime: db.serverDate(),
        updateTime: db.serverDate(),
      },
    });
    return { code: 0, data: res._id };
  } catch (err) {
    return { code: 500, msg: err.message };
  }
}

async function adminUpdateBanner(openid, data) {
  try {
    if (!(await isAdmin(openid))) return { code: 403, msg: "权限不足" };
    const { _id, ...updateData } = data;
    if (!_id) return { code: 400, msg: "缺少Banner ID" };

    delete updateData._id;
    delete updateData._openid;
    if (updateData.order !== undefined)
      updateData.order = parseInt(updateData.order);
    updateData.updateTime = db.serverDate();

    // Check system banner
    const bannerRes = await db.collection("carousel").doc(_id).get();
    if (bannerRes.data && bannerRes.data.isSystem) {
      return { code: 403, msg: "系统轮播配置禁止修改" };
    }

    await db.collection("carousel").doc(_id).update({
      data: updateData,
    });
    return { code: 0, msg: "更新成功" };
  } catch (err) {
    return { code: 500, msg: err.message };
  }
}

async function adminDeleteBanner(openid, data) {
  try {
    if (!(await isAdmin(openid))) return { code: 403, msg: "权限不足" };
    const { _id } = data;
    if (!_id) return { code: 400, msg: "缺少Banner ID" };

    // Get info to delete file if it's on cloud storage
    const banner = await db.collection("carousel").doc(_id).get();

    // Check system banner
    if (banner.data && banner.data.isSystem) {
      return { code: 403, msg: "系统轮播配置禁止删除" };
    }

    if (
      banner.data &&
      banner.data.imageUrl &&
      banner.data.imageUrl.startsWith("cloud://")
    ) {
      try {
        await cloud.deleteFile({ fileList: [banner.data.imageUrl] });
      } catch (e) {
        console.error("Delete banner file failed:", e);
      }
    }

    await db.collection("carousel").doc(_id).remove();
    return { code: 0, msg: "删除成功" };
  } catch (err) {
    return { code: 500, msg: err.message };
  }
}
