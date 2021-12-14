const Comment = require('../database/mongoose/model/Comment')
const axios = require('axios')
const bcrypt = require('bcrypt')
const { VerifyToken } = require('../utils/adminUtils')
const {
  WordNumberLimit,
  WordNumberExceed,
  GetCommentCounts,
  limitPageNo,
  GetReplyComment,
  limitFilter,
  CommentHandler,
  CommitCommentHandler
} = require('../utils/commentUtils')
const { IndexHandler, DeepColne, VerifyParams, akismet } = require('../utils')

// 获取评论
async function GetComment(params) {
  const config = global.config
  const comment_count = config.comment_count
  // 处理index.html
  params.path = IndexHandler(params.path)

  const { pageNo, path } = params
  // 查询条件
  let options = {
    pid: '',
    path,
    status: 'accept',
    stick: { $ne: 'true' }
  }

  // 查询置顶评论
  let commentsTop = []
  if (pageNo == 1) {
    const optionsTop = DeepColne(options)
    optionsTop.stick = 'true'
    commentsTop = await Comment.find(optionsTop).lean()
  }

  const counts = await GetCommentCounts(options)

  // 限制页码
  const { page, pageCount } = await limitPageNo(pageNo, comment_count, options)

  const comments = await Comment.find(options)
    .skip((page - 1) * comment_count)
    .limit(comment_count)
    .sort({ created: -1 })
    .lean()

  // 合并置顶评论和普通评论
  const newComments = [...commentsTop, ...comments]

  // 置顶评论和普通评论一起查询回复评论
  const commentsReply = await GetReplyComment(newComments)

  // 合并评论所有
  const commentsAll = [...commentsTop, ...comments, ...commentsReply]

  const wordNumber = WordNumberLimit(config.word_number)

  const markedOptions = {}
  const highlightOptions = {}
  markedOptions.enable = config.marked.enable + '' == 'true' ? true : false
  markedOptions.source = config.marked.source
  highlightOptions.enable =
    config.highlight.enable + '' == 'true' ? true : false
  highlightOptions.source = config.highlight.source
  highlightOptions.theme = config.highlight.theme

  for (let item of commentsAll) {
    item = CommentHandler(item)
  }

  const result = {
    comments: commentsAll,
    counts,
    pageCount,
    wordNumber,
    marked: markedOptions,
    highlight: highlightOptions
  }

  return result
}

// 提交评论
async function CommitComment(params) {
  // 验证评论信息是否合法
  VerifyParams(params, ['nick', 'mail', 'content', 'ua', 'path'])

  const config = global.config

  const token = await VerifyToken(params.token)

  if (!token) {
    // 字数限制
    const paramsWordNumber = {
      content: params.content.length,
      nick: params.nick.lenth,
      mail: params.mail.length,
      site: params.site.length
    }
    const isExceed = WordNumberExceed(config.word_number, paramsWordNumber)
    if (isExceed) return '字数超出规定范围'
  }

  // 判断是否使用博主身份评论
  const isAdmin = !token && config.mail === params.mail
  if (isAdmin) return '请先登录，再使用博主身份评论'

  // ip 限流
  await limitFilter(params.ip)

  const akismetData = {
    ip: params.ip,
    name: params.nick,
    email: params.mail,
    content: params.content,
    url: params.site,
    type: params.rid ? 'reply' : 'comment',
    useragent: params.ua
  }

  if (token) params.status = 'accept'
  else {
    params.status = await akismet(config.akismet, config.site_url, akismetData)
  }

  const data = await CommitCommentHandler(params, token)

  // 保存评论
  const result = await new Comment(data).save()

  // 发送邮件通知请求
  try {
    // 验证邮件配置是否完整
    VerifyParams(config, [
      'mail_host',
      'mail_port',
      'mail_from',
      'mail_accept',
      'master_subject',
      'reply_subject'
    ])

    data.type = 'PUSH_MAIL'

    // 加密生成token
    const encrypted = config.username + config.password + config.mail
    data.token = bcrypt.hashSync(encrypted, 10)

    const serverURLs = config.serverURLs
    if (serverURLs) {
      await Promise.race([
        axios({
          url: serverURLs,
          data,
          method: 'post',
          headers: { origin: config.site_url }
        }),
        new Promise((resolve) => setTimeout(resolve, 500)) // 延迟0.5s后继续向下执行，不在等待
      ])
    }
  } catch (error) {
    console.log('Mail ERROR: 邮箱配置信息错误')
    console.log('邮箱错误配置详细:', error)
  }

  delete data.token
  delete data.type

  if (result) return CommentHandler(data)
  return false
}

// 获取最新评论
async function RecentComment(params) {
  const config = global.config
  let query = { status: 'accept' }
  if (params.reply === false) query.pid = ''

  const comment = await Comment.find(query)
    .sort({ created: -1 })
    .limit(config.comment_count || 10)
    .lean()

  for (let item of comment) {
    item = CommentHandler(item)
  }

  return comment
}

// 获取评论数
async function CommentCount(params) {
  VerifyParams(params, ['paths'])
  if (!Array.isArray(params.paths)) return

  // 处理index.html
  const paths = params.paths.map((item) => IndexHandler(item))

  // 处理查询项
  const options = { path: { $in: paths } }
  if (params.reply === false) options.pid = ''

  const query = [
    { $match: options },
    { $group: { _id: '$path', count: { $sum: 1 } } }
  ]
  const resultArr = await Comment.aggregate(query)

  // 格式化
  const result = []
  for (const item in paths) {
    result.push({
      path: paths[item],
      count: resultArr[item] ? resultArr[item].count : 0
    })
  }

  return result
}

module.exports = { GetComment, CommitComment, RecentComment, CommentCount }
