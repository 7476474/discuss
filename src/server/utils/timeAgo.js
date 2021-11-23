const timeAgo = (timestamp) => {
  var diffValue = Date.now() - timestamp

  const minute = 1000 * 60 // 60000ms
  const hour = minute * 60 // 3600000ms
  const day = hour * 24 // 86400000ms

  const intDay = parseInt(diffValue / day)
  const intHour = parseInt(diffValue / hour)
  const intMinute = parseInt(diffValue / minute)

  if (intMinute == 0) return '刚刚'
  else if (intMinute < 64) return intMinute + ' 分钟前'
  else if (intHour < 24) return intHour + ' 小时前'
  else if (intDay < 7) return intDay + ' 天前'
  else return Format(timestamp)
}

// padStart 如果长度达不到指定长度(2)使用指定字符(0)填充到内容前面(padEnd填充到后面)
// 日期格式化
const Format = (timestamp) => {
  const time = new Date(timestamp)
  const year = time.getFullYear()
  const month = (time.getMonth() + 1).toString().padStart(2, '0')
  const date = time.getDate().toString().padStart(2, '0')
  const hours = time.getHours()
  const minute = time.getMinutes()
  const second = time.getSeconds()
  return `${year}-${month}-${date}`
}

module.exports = timeAgo
