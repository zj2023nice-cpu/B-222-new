const tcb = require("@cloudbase/node-sdk");

const CRISIS_EXPLICIT_FIXED = [
  "一了百了", "没有活下去的意义",
];

const CRISIS_EXPLICIT_NEGATABLE = [
  "想自杀", "想结束生命", "想去死", "好想死",
  "准备自杀", "打算自杀", "决定自杀",
  "想去跳楼", "想去割腕",
];

const CRISIS_IMPLICIT_INTENT = [
  "想死",
];

const CRISIS_ACTION_KEYWORDS = [
  "自杀", "跳楼", "割腕", "服毒", "吞药", "自残",
  "自伤", "跳河", "上吊", "割脉", "寻死", "了结自己",
  "伤害自己", "结束自己的生命",
];

const SELF_REF_WORDS = ["我", "自己"];

const THIRD_PERSON_SUBJ = [
  "朋友说", "朋友要", "同学说", "同学要",
  "他说", "她说", "他说要", "她說要",
  "别人说", "别人要", "有人说", "有人要",
  "他们", "她们", "那人", "那人要",
  "新闻", "报道", "书上",
];

const POST_KEYWORD_NEGATION = [
  "的意思", "的想法", "的念头", "的打算", "的冲动",
  "的意图", "的勇气", "的决心",
];

const NEGATION_WORDS = [
  "不会", "不想", "不要", "没想", "没有想", "不可能",
  "不至于", "没打算", "从未", "不曾",
  "并不", "并未", "绝非", "毫无", "从不", "永不",
  "并不会", "并不想", "并没有",
  "也不会", "也不想", "绝不会", "绝不想",
  "绝对不会", "绝对不想", "根本不会", "根本不想",
  "完全不会", "完全不想", "从来不会", "从来不想",
  "肯定不会", "肯定不想", "真的不会", "真的不想",
  "从未想过", "不曾想过", "一点也不", "丝毫不会",
];

const NEGATION_CHARS = ["不", "没", "别", "勿"];

const MODIFIER_BRIDGE = [
  "真的", "是", "是会", "是要", "要", "会", "能",
  "是真心", "真的会", "真的要", "就是",
];

const CRISIS_HELP_GUIDE =
  "\n\n🆘 如果你正在经历痛苦或有伤害自己的想法，请立即寻求帮助：\n" +
  "• 全国24小时心理援助热线：400-161-9995\n" +
  "• 北京心理危机研究与干预中心：010-82951332\n" +
  "• 生命热线：400-821-1215\n" +
  "• 你也可以联系学校心理咨询中心或辅导员，他们随时愿意帮助你。\n" +
  "请记住，你并不孤单，有人愿意倾听和帮助。";

function _findAllOccurrences(text, kw) {
  var positions = [];
  if (!kw) return positions;
  var idx = 0;
  while ((idx = text.indexOf(kw, idx)) !== -1) {
    positions.push(idx);
    idx += kw.length;
  }
  return positions;
}

function _hasNegationBefore(text, position, window) {
  var start = Math.max(0, position - window);
  var prefix = text.slice(start, position);
  var hasNegWord = NEGATION_WORDS.some(function (neg) {
    return prefix.includes(neg);
  });
  if (hasNegWord) return true;

  var tightStart = Math.max(0, position - 2);
  var tightPrefix = text.slice(tightStart, position);
  var hasNegChar = NEGATION_CHARS.some(function (ch) {
    return tightPrefix.includes(ch);
  });
  return hasNegChar;
}

function _hasNegationWithBridge(text, position, window) {
  var start = Math.max(0, position - window);
  var prefix = text.slice(start, position);
  for (var i = 0; i < NEGATION_WORDS.length; i++) {
    var neg = NEGATION_WORDS[i];
    var negIdx = prefix.lastIndexOf(neg);
    if (negIdx === -1) continue;
    var gap = prefix.slice(negIdx + neg.length);
    var isBridgeable = gap.length === 0 || MODIFIER_BRIDGE.some(function (b) {
      return gap === b || gap.startsWith(b);
    });
    if (isBridgeable) return true;
  }
  return false;
}

function _hasPostKeywordNegation(text, position, keyword) {
  var after = text.slice(position + keyword.length);
  return POST_KEYWORD_NEGATION.some(function (post) {
    return after.startsWith(post);
  });
}

function _hasSelfReference(text, position, keyword) {
  var beforeStart = Math.max(0, position - 8);
  var before = text.slice(beforeStart, position);
  var after = text.slice(position + keyword.length, position + keyword.length + 8);
  return SELF_REF_WORDS.some(function (w) {
    return before.includes(w) || after.includes(w);
  });
}

function _hasThirdPersonSubj(text, position) {
  var beforeStart = Math.max(0, position - 12);
  var before = text.slice(beforeStart, position);
  return THIRD_PERSON_SUBJ.some(function (s) {
    return before.includes(s);
  });
}

function _anyUnnegatedMatch(text, keywordList, negWindow) {
  for (var i = 0; i < keywordList.length; i++) {
    var kw = keywordList[i];
    var positions = _findAllOccurrences(text, kw);
    for (var j = 0; j < positions.length; j++) {
      if (_hasNegationBefore(text, positions[j], negWindow)) continue;
      if (_hasNegationWithBridge(text, positions[j], negWindow + 4)) continue;
      if (_hasPostKeywordNegation(text, positions[j], kw)) continue;
      if (_hasThirdPersonSubj(text, positions[j])) continue;
      return true;
    }
  }
  return false;
}

function _anyUnnegatedSelfRefMatch(text, keywordList, negWindow) {
  for (var i = 0; i < keywordList.length; i++) {
    var kw = keywordList[i];
    var positions = _findAllOccurrences(text, kw);
    for (var j = 0; j < positions.length; j++) {
      if (_hasNegationBefore(text, positions[j], negWindow)) continue;
      if (_hasNegationWithBridge(text, positions[j], negWindow + 4)) continue;
      if (_hasPostKeywordNegation(text, positions[j], kw)) continue;
      if (_hasThirdPersonSubj(text, positions[j])) continue;
      if (!_hasSelfReference(text, positions[j], kw)) continue;
      return true;
    }
  }
  return false;
}

function detectCrisis(messages) {
  var userText = messages
    .filter(function (m) { return m.role === "user"; })
    .map(function (m) { return m.content; })
    .join(" ");

  var hitFixed = CRISIS_EXPLICIT_FIXED.some(function (kw) {
    return userText.includes(kw);
  });
  if (hitFixed) return true;

  var hitNegatable = _anyUnnegatedMatch(userText, CRISIS_EXPLICIT_NEGATABLE, 4);
  if (hitNegatable) return true;

  var hasImplicit = _anyUnnegatedMatch(userText, CRISIS_IMPLICIT_INTENT, 4);
  if (hasImplicit) return true;

  var hasAction = _anyUnnegatedSelfRefMatch(userText, CRISIS_ACTION_KEYWORDS, 4);
  if (hasAction) return true;

  return false;
}

exports.main = async (event, context) => {
  // 初始化云开发环境
  const app = tcb.init({ env: tcb.SYMBOL_CURRENT_ENV });
  const ai = app.ai();
  const auth = app.auth();

  const { messages, sessionId } = event;
  const { openId } = auth.getUserInfo();

  if (!messages || !Array.isArray(messages)) {
    return {
      success: false,
      error: "Missing or invalid messages parameter",
      reply: "参数错误，请重试。",
    };
  }

  try {
    // 准备对话消息
    const apiMessages = messages.map((msg) => ({
      role: msg.role === "ai" ? "assistant" : msg.role,
      content: msg.content,
    }));

    // 添加系统提示词
    apiMessages.unshift({
      role: "system",
      content:
        "你是一个温暖、富有同理心的校园心理咨询助手。\n\n" +
        "核心原则：\n" +
        "1. 倾听与共情优先——不要急于给建议或评判，先让学生感到被理解。\n" +
        "2. 对于普通负面情绪（压力大、焦虑、难过、迷茫），给予正常程度的支持和鼓励，不必过度反应。\n" +
        "3. 如果学生表露自伤或自杀倾向，务必：\n" +
        "   - 认真对待，绝不轻视或敷衍\n" +
        "   - 表达关心和支持，让他们感到被理解和陪伴\n" +
        "   - 鼓励他们寻求专业帮助（心理热线、学校咨询中心等）\n" +
        "   - 不要使用说教、命令或恐吓式语言\n" +
        "4. 不要替代专业心理咨询，遇到超出能力范围的问题要坦诚说明并建议寻求专业帮助。\n" +
        "5. 回复简洁温暖，避免冗长说教。",
    });

    // 创建模型实例 (根据参考代码)
    const aiModel = ai.createModel("deepseek");

    // 调用流式文本生成 (使用 V3 版本，不需要 R1 的思维链)
    const res = await aiModel.streamText({
      model: "deepseek-v3.2",
      messages: apiMessages,
    });

    let fullText = "";

    // 遍历正文内容
    for await (let data of res.dataStream) {
      if (data === "[DONE]") {
        break;
      }

      try {
        const delta = data?.choices?.[0]?.delta;

        // 打印生成文本内容
        const text = delta?.content;
        if (text) {
          fullText += text;
        }
      } catch (e) {
        // 忽略解析错误
      }
    }

    const isRisk = detectCrisis(messages);

    return {
      success: true,
      reply: isRisk ? fullText + CRISIS_HELP_GUIDE : fullText,
      reasoning: "",
      openid: openId,
      sessionId: sessionId || null,
      risk: isRisk,
      crisisGuide: isRisk ? CRISIS_HELP_GUIDE.trim() : null,
    };
  } catch (err) {
    console.error("DeepSeek Call Error:", err);
    return {
      success: false,
      error: err.message,
      reply:
        "抱歉，我现在有点累，请稍后再试或直接联系咨询师。官方接口返回：" +
        err.message,
    };
  }
};
