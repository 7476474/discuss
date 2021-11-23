/**
 *
 * @param {*} img 需要懒加载的img元素(标签)
 * @param {*} attr 图片的真实url地址
 */
export default function lazyload(img, attr) {
  const imgLazyLoad = document.querySelectorAll(img)
  imgLazyLoad.forEach((target) => {
    const io = new IntersectionObserver((entries, Observer) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const img = entry.target
          const src = img.getAttribute(attr)
          img.setAttribute('src', src)
          Observer.disconnect()
        }
      })
    })
    io.observe(target)
  })
}
