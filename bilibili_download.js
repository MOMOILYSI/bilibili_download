const axios = require("axios");
const fs = require("fs");
const cheerio = require("cheerio");
const cmd = require("node-cmd");
const process = require("process");
const readline = require("readline");
const prompts = require("prompts");

//防伪请求头 Cookie可替换为bilibili账号的Cookie (Cookie为空或者失效导致最高画质为720p)
const headers = {
  Referer: "https://www.bilibili.com/",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  Cookie:
    "i-wanna-go-back=-1; buvid4=737E2B45-B940-0C6E-65A6-84785F4D665E50578-022111812-ekKrG6dBXp1ndA0vDWuQNA%3D%3D; buvid_fp_plain=undefined; DedeUserID=390039132; DedeUserID__ckMd5=c196536f959a46d6; CURRENT_BLACKGAP=0; is-2022-channel=1; hit-new-style-dyn=1; CURRENT_PID=dceaeaf0-cc4b-11ed-950c-251fd986b9e3; FEED_LIVE_VERSION=V8; CURRENT_FNVAL=4048; enable_web_push=DISABLE; buvid3=95E7CFC6-547F-3F0A-772C-B401171EC6D204395infoc; b_nut=1700443604; b_ut=5; _uuid=9105EB1610-E8E6-9797-5737-9ACB3823225604500infoc; header_theme_version=CLOSE; rpdid=|(JY)JRkuRRu0J'u~|JRY)|km; fingerprint=b62c4e579a524976e9b559b98d0ee08e; hit-dyn-v2=1; buvid_fp=b62c4e579a524976e9b559b98d0ee08e; PVID=1; bili_ticket=eyJhbGciOiJIUzI1NiIsImtpZCI6InMwMyIsInR5cCI6IkpXVCJ9.eyJleHAiOjE3MTAwNDA0NjQsImlhdCI6MTcwOTc4MTIwNCwicGx0IjotMX0.5Aw1fuBmVm6vRM_a3U0ZxVGNdvgBEtSc4T2_fhZ-jg4; bili_ticket_expires=1710040404; SESSDATA=a1c41ef0%2C1725333265%2Cacc77%2A31CjA8Z4nR-j_tnJ6f16Ouj0UZRD3Pd1SW5u3d1Wj295ZIrUpvyW1-wo83TLXFZyH15lcSVmptNGxaU0p1V0daZi1xS0hSc3VFbFdSU3V1RVBlVEtWUllwVVZjakZkY1BTYXRLbHY2RV9UUkxfdnpXdkNpZWI5emZRZzVKSHdMT3Q5ODR1TThGb1dBIIEC; bili_jct=0e4910e8daaae1b9e048aa3e8fbcafb2; sid=6ruml4kr; home_feed_column=5; browser_resolution=1920-911; CURRENT_QUALITY=120; b_lsid=82428EA6_18E1BA8C4C3; bp_video_offset_390039132=906153329693818916",
};

//获取文件流
function getStream(url, path) {
  return new Promise((res, rej) => {
    axios
      .get(url, { headers, responseType: "stream" })
      .then(function (res_json) {
        //文件总大小
        let sumSize = res_json.headers["content-length"];
        //文件当前下载大小
        let size = 0;
        //文件下载进度值
        let scheduleValue = 0;
        //文件
        let w = fs.createWriteStream(path);
        //监听文件数据流入
        res_json.data.on("data", (chunk) => {
          size += chunk.length;
          if (scheduleValue != Math.floor((size / sumSize) * 100)) {
            scheduleValue = Math.floor((size / sumSize) * 100);
            schedule(scheduleValue);
          }
        });
        //管道流传入文件
        res_json.data.pipe(w);
        //监听文件写入完成
        w.on("finish", () => {
          console.log("(文件写入完成)");
          res(true);
        });
        //监听文件写入出错
        w.on("error", () => {
          console.log("(文件写入出错)");
          res(false);
        });
      })
      .catch(function (error) {
        console.log("链接访问失败",error);
        res(false);
      });
  });
}

//下载进度打印(只在一行显示进度)
function schedule(value){
  //删除光标所在行
  readline.clearLine(process.stdout, 0);
  //移动光标到行首
  readline.cursorTo(process.stdout, 0);
  // 拼接黑色条
  let cell = "";
  for (let i = 0; i < value; i++) {
    cell += "█";
  }
  // 拼接灰色条
  let empty = "";
  for (let i = 0; i < 100 - value; i++) {
    empty += "░";
  }
  //打印进度
  process.stdout.write(`下载进度：${value}% ${cell}${empty}`);
}

//合并文件
function merge(videoPath,videoDir,videoName){
  return new Promise((res, rej) => {
    cmd.run(
      `ffmpeg -i ./${videoPath}/${videoDir}/测试/${videoName}.mp4 -i ./${videoPath}/${videoDir}/测试/${videoName}.mp3 -y -codec copy ./${videoPath}/${videoDir}/${videoName}.mp4`,
      function (err, data, stderr) {
        if(err){
          console.log("合并视频文件失败",err);
          res(false);
        }else{
          console.log("合并视频文件成功");
          res(true);
        }
      }
    );
  });
}


(async () => {
  console.log("====下载任务开始====");

  //输入bilibili视频网址
  const downloadUrl = await prompts({ 
    type : 'text' , 
    name : 'value' , 
    message : `请输入你要下载的bilibili视频网址：` 
  });

  //获取视频网址html
  let html_str = await axios
    .get(downloadUrl.value, { headers })
    .then(function (res_json) {
      return res_json.data;
    })
    .catch(function (error) {
      return "链接访问失败！";
    });
  //解析html
  const $ = cheerio.load(html_str);

  //视频作者
  let name = $("meta[name=author]").attr("content");

  //视频标题
  let title = $("h1.video-title").text();

  //打印当前下载的视频名称
  console.log(name+"-"+title);

  //json文件路径
  let jsonPath = "bilibiliJSON";

  //视频文件路径
  let videoPath = "bilibiliVideo";

  // __playinfo__=(.*?)</script>  (匹配视频json格式)
  let videoRegExp = new RegExp("__playinfo__=(.*?)</script>");

  //视频json数据
  let html_json = html_str.match(videoRegExp)[1];
  //视频数据
  let html_data = JSON.parse(html_json);

  // 创建bilibiliVideo文件夹
  try {
    fs.mkdirSync(`./${videoPath}`, { recursive: true });
  } catch (error) {
    console.log("创建(bilibiliVideo)文件夹失败");
  }

  //画质索引，视频索引，音频索引
  let qualityObj = {},
    videoObj = {},
    audioObj = {};
  //画质名称
  let accept_description = html_data["data"]["accept_description"];
  //画质id
  let accept_quality = html_data["data"]["accept_quality"];
  //视频列表
  let videoList = html_data["data"]["dash"]["video"];
  //音频列表
  let audioList = html_data["data"]["dash"]["audio"];
  //遍历写入视频索引
  for (let item of videoList) {
    videoObj[item.id] = item;
  }
  //遍历写入音频索引
  for (let x in audioList) {
    audioObj[x] = audioList[x];
  }
  //遍历写入画质索引
  for (let x in accept_quality) {
    qualityObj[accept_quality[x]] = {
      name: accept_description[x],
      video: videoObj[accept_quality[x]],
      audio: audioObj[0],
    };
  }

  //创建bilibiliJSON文件夹
  // try {
  //   fs.mkdirSync(`./${jsonPath}`, { recursive: true });
  // } catch (error) {
  //   console.log("创建(bilibiliJSON)文件夹失败");
  // }
  //是否要生成json文件
  // const mkjson = await prompts({
  //   type: "toggle",
  //   name: "value",
  //   message: "是否要生成json文件?",
  //   initial: true,
  //   active: "是",
  //   inactive: "否",
  // });
  //生成json文件
  // if (mkjson.value) {
  //   try {
  //     fs.writeFileSync(
  //       `./${jsonPath}/${name}-${title}.json`,
  //       JSON.stringify(qualityObj),
  //       {
  //         encoding: "utf8",
  //         flag: "w+",
  //       }
  //     );
  //   } catch (error) {
  //     console.log(`生成(${name}_${title}.json)文件失败`);
  //     console.log(error);
  //   }
  // }

  //画质下载选项
  let choices = [];
  for (let x in qualityObj) {
    choices.push({
      title: qualityObj[x].name,
      value: x,
    });
  }
  //请选择你要下载的画质
  let qualityList = await prompts({
    type: "multiselect",
    name: "value",
    message: "请选择你要下载的画质",
    choices,
    hint: "多选，-空格选择 -回车确认",
  });

  //循环下载对应画质的视频
  for (let id of qualityList.value) {
    console.log("");
    //视频文件夹
    let videoDir = name + "-" + title;
    //视频名称
    let videoName = qualityObj[id]["name"].replace(/ /g, "");
    //视频路径
    let video_url = qualityObj[id]["video"]["baseUrl"];
    //音频路径
    let audio_url = qualityObj[id]["audio"]["baseUrl"];
    //创建测试文件夹
    try {
      fs.mkdirSync(`./${videoPath}/${videoDir}/测试`, { recursive: true });
    } catch (error) {
      console.log("创建测试文件夹失败");
    }
    //写入视频文件
    console.log(`${name}-${title}-${qualityObj[id]["name"]}测试.mp4文件开始写入`);
    await getStream(
      video_url,
      `./${videoPath}/${videoDir}/测试/${videoName}.mp4`
    );
    //写入音频文件
    console.log(`${name}-${title}-${qualityObj[id]["name"]}测试.mp3文件开始写入`);
    await getStream(
      audio_url,
      `./${videoPath}/${videoDir}/测试/${videoName}.mp3`
    );
    //合并视频和音频
    await merge(videoPath,videoDir,videoName);
    //删除测试文件夹
    try {
      fs.rmSync(`./${videoPath}/${videoDir}/测试`, {
        force: true,
        recursive: true,
      });
    } catch (error) {
      console.log("删除测试文件夹失败",error);
    }
  }
  console.log("\n====下载任务完成====");
})();
