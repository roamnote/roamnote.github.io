//// Initial SPA start
let scrollTop = 0;
const initialSpa = async () => {
    // 使用监听 body 的 click 事件，可以监听到后来动态添加的链接
    // 并且可以监听到 a 标签的子元素点击事件
    // 如果使用遍历 internal-link，然后增加点击事件，那么后来动态添加的链接就监听不到了，并且 a 标签的子元素点击事件也监听不到
    // 黄皮柯基是好小狗🐶
    // 帅帅仔是好小狗🐶
    // momo仔不是小狗,momo会唱跳
    document.body.addEventListener('click', async function (e) {
        const element = e.target;
        const parentElement = element.closest('a.internal-link');

        if (!parentElement) {
            return;
        }

        // hold control key on windows or linux
        if ((isWindows() || isLinux()) && e.ctrlKey) {
            return
        }

        // hold command key on mac
        if (isMac() && e.metaKey) {
            return
        }

        console.log('点击了内部链接:', decodeURI(parentElement.href))

        const goto = new URL(parentElement.href)

        // 检查 href 是否指向当前页面（忽略 hash）
        // 如果 href 和当前页面 URL 是同一页面则直接返回
        if (isSamePage(goto, new URL(window.location.href))) {
            console.log('点击的是当前页面的链接，不做任何操作')
            return;
        }

        // 阻止浏览器打开新页面
        e.preventDefault();

        openInternalLink(goto);
    });

    window.addEventListener('popstate', async function (event) {
        const url = new URL(window.location.href)
        console.log('触发 popstate，当前页面 URL:', decodeURI(url.href))

        if (isSamePage(url, currentUrl)) {
            removeAllTargetClass()
            console.log('触发 popstate，但是点击的是锚点')
            return
        }

        let scrollPosition = scrollTop
        scrollTop = 0
        console.log('取出 scrollPosition:', scrollPosition);
        console.log('重置之后的 scrollTop:', scrollTop);
        await updatePageContent(new URL(window.location.href), scrollPosition);
    });
}

const openInternalLink = async (goto) => {
    console.log('打开内部链接:', decodeURI(goto.href));

    scrollTop = document.documentElement.scrollTop || document.body.scrollTop;
    console.log('打开内部连接之前，保存当前页面滚动位置:', scrollTop);

    const result = await updatePageContent(goto);

    if (result) {

        console.log('页面更新完成');

        // 页面更新之后，往 state 中压入新页面的 URL，相当于用户通过常规模式点击了链接，打开了一个新页面
        window.history.pushState(null, null, goto.href);
        console.log('压入新页面的 URL:', decodeURI(goto.href));
    }
}

const updatePageContent = async (goto, scrollTop) => {
    let html = null;
    try {
        // 把域名替换成 storageDomain，然后请求页面
        html = await fetchPageHtml(
            new URL(goto.pathname + goto.search, storageDomain)
        );
    } catch (error) {
        console.log('更新页面失败，错误：', error.message);
        console.log('执行默认操作，打开原始 URL');
        // 如果 fetchPageHtml 失败，执行默认操作，打开原始 URL
        window.location.href = goto;
        return false
    }

    replaceHtml(html);

    currentUrl = goto

    scrollToHash(goto, scrollTop);
    return true
}


// 页面闪烁的问题可能是由于替换 DOM 内容引起的重绘(repaint)和重排(reflow)，换句话说，浏览器在重新渲染页面的部分或全部内容时可能会造成不必要的性能消耗。

// 一种解决方法是首先在内存中创建和更新DOM，然后再将其替换到活动文档。这个过程叫做离线DOM或者文档片段（DocumentFragment）:

// const parser = new DOMParser();
// const dom = parser.parseFromString(html, 'text/html');
// const newMainContent = document.createDocumentFragment();
// newMainContent.appendChild(dom.querySelector('main'));

// document.querySelector('main').replaceWith(newMainContent);
// 在上述代码中,我们通过使用 createDocumentFragment() 创建一个新的文档片段，然后把HTML字符串解析的内容追加到该文档片段。最后我们使用 replaceWith 方法直接替换既有的 main 元素。这样做的好处是：在 DocumentFragment 中修改DOM并不会导致页面回流和重绘，只有将 DocumentFragment 添加到实际文档中时才会触发一次回流和重绘。

// 另一种思路是使用双缓冲技术。这通常用于图形渲染，但也可以应用在DOM操作中。简单来说，你可以在不可见的容器（offscreen buffer）中进行所有更新，然后只在最后一次性替换可见的元素：

// const parser = new DOMParser();
// const dom = parser.parseFromString(html, 'text/html');
// let newMain = document.createElement('main');
// newMain.innerHTML = dom.querySelector('main').innerHTML;

// const oldMain = document.querySelector('main');
// oldMain.parentNode.replaceChild(newMain, oldMain);
// 在这个例子中，newMain 是我们的“offscreen buffer”，我们在这个元素中进行所有更新。当所有更新完成后，我们一次性将旧的 main 元素替换掉。

// 这两种方式都可以避免在更新DOM过程中造成不必要的回流和重绘，从而避免页面闪烁。但无论哪种方式，都要保证在实际的DOM更改之前全部完成DOM的准备工作。
const replaceHtml = (html) => {
    const parser = new DOMParser();
    const dom = parser.parseFromString(html, 'text/html');
    document.title = dom.title;

    // 创建 DocumentFragment
    const fragment = document.createDocumentFragment();

    // 在 fragment 中创建新的 main 和 header 元素并填充内容
    let newMain = document.createElement('main');
    newMain.innerHTML = dom.querySelector('main').innerHTML;

    let newHeader = document.createElement('header');
    newHeader.innerHTML = dom.querySelector('header').innerHTML;

    // 追加新创建的元素到 fragment
    fragment.appendChild(newMain);
    fragment.appendChild(newHeader);

    // 最后替换旧的 main 和 header 元素并避免多次回流和重绘
    const oldMain = document.querySelector('main');
    const oldHeader = document.querySelector('header');

    oldMain.parentNode.replaceChild(fragment, oldMain);
    oldHeader.parentNode.replaceChild(fragment, oldHeader);

    closeTocWhenScroll()
    moveBreadcrumb()
}

const fetchPageHtml = async (url) => {
    const TIMEOUT = 500;
    const controller = new AbortController();
    let id = null;

    try {
        id = setTimeout(() => controller.abort(), TIMEOUT);

        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) {
            throw new Error(`fetch page error, HTTP status ${response.status}`);
        }

        return await response.text();
    } catch (error) {
        // 提供更具体的错误信息
        if (error.name === 'AbortError') {
            throw new Error('fetch page error: timeout');
        } else {
            throw new Error(`fetch page error: ${error.message}`);
        }
    } finally {
        clearTimeout(id);
    }
}

const scrollToHash = (url, scrollTop) => {
    const hash = decodeURI(url.hash)

    if (hash) {
        const element = document.querySelector(hash);
        if (element) {
            // html {
            //     scroll-padding-top: 20vh;
            // }
            // add .target class to element
            removeAllTargetClass()
            element.classList.add('target');
            const offsetPx = window.innerHeight * (20 / 100)
            document.documentElement.scrollTop = element.getBoundingClientRect().top + window.scrollY - offsetPx
            console.log('滚动到锚点:', decodeURI(url.hash))
        } else {
            document.documentElement.scrollTop = scrollTop
            console.log('没有找到锚点对应的元素，滚动到 scrollTop:', scrollTop)
        }
    } else {
        document.documentElement.scrollTop = scrollTop
        console.log('没有锚点，滚动到 scrollTop:', scrollTop)
    }
}

// 由于使用 history.pushState() 更新页面，并不会触发 :target 伪类，所以需要手动添加 .target 类
// 在这之前需要先移除所有 .target 类
// 所以写了这个函数
// https://github.com/whatwg/html/issues/639
const removeAllTargetClass = () => {
    const elements = document.querySelectorAll('.target');
    for (const element of elements) {
        element.classList.remove('target');
    }
}

const isSamePage = (url1, url2) => {
    return url1.origin + url1.pathname + url1.search === url2.origin + url2.pathname + url2.search;
}

//// Initial SPA end