const puppeteer = require("puppeteer");
const fs = require("fs-extra");

let browser;
let page;
let result = {
  list: []
};
// 初始页面配置
const initUrl = "https://movie.douban.com/top250?start=0&filter=";
// 禁止以下请求
const blockRequestArr = ["image", "stylesheet", "font"];
const pageOptions = {
  headless: true
};

// 初始化浏览器
async function initBrowser() {
  browser = await puppeteer.launch(pageOptions);
  page = await browser.newPage();
  await page.setRequestInterception(true);
  page.on("request", request => {
    if (blockRequestArr.indexOf(request.resourceType()) !== -1) {
      request.abort();
    } else {
      request.continue();
    }
  });
  page.setUserAgent(
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/63.0.3239.132 Safari/537.36"
  );
}

// 加载一个页面
async function loadPage(selector, url) {
  await page.goto(url);
  // 根据selector判断加载完成
  if (selector) {
    await page.waitForSelector(selector);
  } else {
    await page.waitForNavigation();
  }
}

// 获取列表
async function getList(selector, url) {
  if (url) {
    await loadPage(selector, url);
  }
  return await page.$$(selector);
}

// 获取列表长度
async function getListLen(selector, url) {
  const list = await getList(selector, url);
  return list.length;
}

async function getChildContent(elem, childSelector) {
  let hasElem = await elem.$(childSelector);
  if (!hasElem) {
    return "";
  }
  return await elem.$eval(childSelector, e => {
    return e.innerText;
  });
}

async function getChildImg(elem, childSelector) {
  let hasElem = await elem.$(childSelector);
  if (!hasElem) {
    return "";
  }
  return await elem.$eval(childSelector, e => {
    return e.src;
  });
}

// 主逻辑
async function main() {
  try {
    // 初始化浏览器
    await initBrowser();

    const paginatorsLen = (await getListLen(".paginator > a", initUrl)) + 1;
    // const paginatorsLen = 2;
    console.log("列表页一共有", paginatorsLen );
    // 遍历分页
    for (let index = 0; index < paginatorsLen; index++) {
      // 获取分页页面的列表长度
      let curUrl = `https://movie.douban.com/top250?start=${index * 25}&filter=`;
      let linksLenth = await getListLen(".hd > a", curUrl);
      console.log("此列表页有链接", linksLenth);

      for (let i = 0; i < linksLenth; i++) {
        // 同一个页面如果进行了 父 > 子 > 父 的url跳转, 两个父的环境不同所以需要重新获取列表
        let links = await getList(".hd > a", curUrl);
        let movieInfo = {
          title: "",
          stuffs: []
        };
        // 去详情页
        const ele = links[i];
        await ele.click();
        // 在详情页操作
        await page.waitForNavigation();
        const title = await page.$("h1");
        const stuffList = await page.$$(".celebrity");
        if (title && stuffList.length) {
          const titleName = await getChildContent(title, "span");
          movieInfo.title = titleName;
          console.log("========================", titleName, "========================");
          for (let stuff of stuffList) {
            let stuffinfo = {};
            stuffinfo.name = await getChildContent(stuff, ".name");
            stuffinfo.role = await getChildContent(stuff, ".role");
            console.log(stuffinfo.role, ":", stuffinfo.name);
            movieInfo.stuffs.push(stuffinfo);
          }
          result.list.push(movieInfo);
        } else {
          console.log("这个页面貌似没有内容");
        }
        // 返回当前列表入口页
      }
    }

    fs.writeJson("./data/movie.json", result)
      .then(() => {
        console.log("文件写入成功");
      })
      .catch(err => {
        console.error(err);
      });

    await browser.close();
    //   const linkName = await page.evaluate(link => {
    //     return link.innerText;
    //   }, link);
  } catch (error) {
    console.log(error, "error");
  }
}

main();
