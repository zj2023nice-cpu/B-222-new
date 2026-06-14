const cloud = require("wx-server-sdk");
cloud.init({ env: cloud.DYNAMIC_TYPE_CACHEREAD });

/**
 * 这个云函数是微信官方授权登录的标志性模板
 * 它会返回当前用户的 openid, unionid 和 appid
 */
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();

  return {
    event,
    openid: wxContext.OPENID,
    appid: wxContext.APPID,
    unionid: wxContext.UNIONID,
    env: wxContext.ENV,
  };
};
