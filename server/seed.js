/**
 * 种子数据：首次启动（server/data/db.json 不存在或损坏）时自举。
 *
 * 规模（DESIGN §8）：8 地区 / 8 景区 / 8 游记 / 2 会员 / 1 管理员 /
 * 6 条收藏 / 3 条反馈 / 18 条日志（8 操作 + 4 管理员 + 6 会员登录）。
 * 图片严格复用 frontend/public/images 下 9 张真实 png，地区封面与游记封面复用所属景区图。
 * 密码在运行期用 scrypt 现算（加盐随机），不写死在文件里。
 */

import crypto from 'node:crypto';

import { COLLECTIONS } from './constants.js';
import { hashPassword } from './auth.js';

/** 种子里的固定时间基准（ISO 8601 UTC） */
const T = {
  epoch: '2026-09-01T00:00:00.000Z',
  regionTouched: '2026-09-20T02:10:00.000Z',
  scenicBase: '2026-09-10T03:00:00.000Z',
  seedRun: '2026-11-10T02:15:00.000Z',
};

/**
 * 构造 8 个地区。
 * @returns {object[]}
 */
function buildRegions() {
  return [
    {
      id: 1,
      name: '四川',
      coverImage: '/images/jiuzhaigou.jpg',
      description:
        '省会成都，平原与高原在一省之内交接。川西北的阿坝、甘孜一带雪山连绵，九寨沟的水色随光线变换；川南则是竹海与古镇的温润气质。适合把自然风光与市井烟火安排在同一趟行程里。',
      sortOrder: 90,
      createdAt: T.epoch,
      updatedAt: T.regionTouched,
    },
    {
      id: 2,
      name: '湖南',
      coverImage: '/images/zhangjiajie.jpg',
      description:
        '湘江由南向北穿过全省，西侧的武陵山脉是石英砂岩峰林的天下。张家界的石柱在云雾里时隐时现，凤凰与芙蓉镇的吊脚楼沿水而建。辣味重的湘菜与山间湿气，是这个省最直接的两张名片。',
      sortOrder: 85,
      createdAt: T.epoch,
      updatedAt: T.epoch,
    },
    {
      id: 3,
      name: '浙江',
      coverImage: '/images/westlake.jpg',
      description:
        '杭州是省会，城西的西湖把江南的湖山审美定成了模板。往南是丘陵与竹林，往东是水乡古镇与海港。这里四季分明，春看桃柳、夏赏荷、秋闻桂、冬候雪，围绕一座湖能把一年过成四种气质。',
      sortOrder: 80,
      createdAt: T.epoch,
      updatedAt: T.epoch,
    },
    {
      id: 4,
      name: '西藏',
      coverImage: '/images/potala.jpg',
      description:
        '平均海拔超过四千米的高原，拉萨河谷是全境最温和的一块。布达拉宫依红山而建，八廓街的转经人流终日不断。日光强、空气薄、天空近，第一次进藏最需要适应的不是风景，而是身体的节奏。',
      sortOrder: 75,
      createdAt: T.epoch,
      updatedAt: T.epoch,
    },
    {
      id: 5,
      name: '安徽',
      coverImage: '/images/huangshan.jpg',
      description:
        '长江与淮河把全省分成三段气质。皖南是花岗岩峰林与徽派村落，白墙黛瓦夹着马头墙，黄山云海就在这片山地的中心；皖北则是平原与麦田。一条新安江，把山水与商帮文化串了几百年。',
      sortOrder: 70,
      createdAt: T.epoch,
      updatedAt: T.epoch,
    },
    {
      id: 6,
      name: '海南',
      coverImage: '/images/sanya.jpg',
      description:
        '中国最南的省份，热带海岸线从海口一路铺到三亚。亚龙湾、海棠湾的沙细水清，冬季是北方人最集中的避寒地；中部五指山一带仍是雨林与黎村。全年无冬，紫外线是需要认真对待的对手。',
      sortOrder: 65,
      createdAt: T.epoch,
      updatedAt: T.epoch,
    },
    {
      id: 7,
      name: '广西',
      coverImage: '/images/guilin.jpg',
      description:
        '桂林到阳朔一段的漓江，把喀斯特地貌长成了中国山水画的范本。峰丛不高却陡，山脚直接落进江里，田块被切成小块。往南是北部湾的海岸与涠洲岛的火山岩，风格与桂北完全不同。',
      sortOrder: 60,
      createdAt: T.epoch,
      updatedAt: T.epoch,
    },
    {
      id: 8,
      name: '云南',
      coverImage: '/images/lijiang.jpg',
      description:
        '西北高、东南低，一条横断山脉把气候与民族都切成许多层。丽江坝子躺在玉龙雪山脚下，纳西院落顺水而建；再往西是香格里拉的高原草甸。同一天里能穿过亚热带河谷与雪山垭口。',
      sortOrder: 55,
      createdAt: T.epoch,
      updatedAt: T.epoch,
    },
  ];
}

/**
 * 构造 8 个景区（与 8 张图 1:1 独占，前 6 个推荐）。
 * @returns {object[]}
 */
function buildScenics() {
  return [
    {
      id: 1,
      name: '九寨沟',
      regionId: 1,
      coverImage: '/images/jiuzhaigou.jpg',
      gallery: ['/images/jiuzhaigou.jpg', '/images/huangshan.jpg'],
      level: '5A',
      rating: 4.8,
      openTime: '08:00–17:00（旺季 4–11 月）',
      ticketPrice: '190 元起（旺季，观光车另计）',
      bestSeason: '9 月下旬–10 月下旬',
      highlights: ['五花海', '诺日朗瀑布', '长海', '彩林'],
      traffic:
        '成都茶店子客运站有直达班车，约 8 小时；或飞九黄机场后换乘景区班车约 1.5 小时。自驾走都汶高速转九绵高速，山路弯多，雨雪季需谨慎。',
      description:
        '九寨沟位于四川省阿坝藏族羌族自治州九寨沟县，因沟内分布着九个藏族村寨而得名。沟谷呈 Y 字形，由树正、日则、则查洼三条主沟组成，海拔从 2000 米一路抬升到 4500 米以上，沟口到长海的高差接近一千米。\n\n这里最出名的是水。钙华沉积把湖底铺成乳白与浅黄，阳光透过清澈的水层，让五花海在同一片湖面上同时出现孔雀蓝、松石绿与琥珀色，湖底沉木清晰可见，颜色随云影移动而变化。\n\n秋季是最拥挤也最值得的季节。彩林倒映在水中，颜色浓得像被调过饱和度；若想避开人流，可以选十月中旬的工作日进沟，早上先到最远的长海，再顺光一路往下走。',
      isRecommended: true,
      viewCount: 1284,
      createdAt: T.scenicBase,
      updatedAt: '2026-10-02T06:11:00.000Z',
    },
    {
      id: 2,
      name: '张家界国家森林公园',
      regionId: 2,
      coverImage: '/images/zhangjiajie.jpg',
      gallery: ['/images/zhangjiajie.jpg', '/images/guilin.jpg'],
      level: '5A',
      rating: 4.7,
      openTime: '07:00–18:00（全年开放）',
      ticketPrice: '228 元（4 日有效，含环保车）',
      bestSeason: '4–6 月、9–11 月',
      highlights: ['袁家界', '天子山', '金鞭溪', '百龙天梯'],
      traffic:
        '张家界荷花机场到森林公园约 40 分钟车程；高铁张家界西站有直达武陵源的班车。景区内以环保车串联各条索道，自驾车只能停在山门外的停车场。',
      description:
        '张家界国家森林公园位于湖南张家界市武陵源区，属武陵山脉腹地。三千余座石英砂岩峰柱拔地而起，最高的金鞭岩相对高度超过三百米，谷底是常绿的阔叶林，峰顶却长着耐旱的武陵松。\n\n云雾是这里的第二主角。雨后初晴，水汽顺着沟谷上升，石柱顶部浮在云面之上，像被剪开的岛；袁家界与天子山两处观景台朝东，清晨看到云海日出的概率最高。\n\n山上与山下温差可达 6℃ 以上，夏季山顶仍需一件薄外套。金鞭溪全长 7.5 公里，一路平缓，适合把整段徒步时间留给谷底的溪水、猕猴与偶尔横倒的巨木。',
      isRecommended: true,
      viewCount: 1102,
      createdAt: T.scenicBase,
      updatedAt: '2026-10-18T08:40:00.000Z',
    },
    {
      id: 3,
      name: '西湖',
      regionId: 3,
      coverImage: '/images/westlake.jpg',
      gallery: ['/images/westlake.jpg'],
      level: '5A',
      rating: 4.6,
      openTime: '全天开放（部分景点 08:00–17:00）',
      ticketPrice: '免费（部分景点单独收费）',
      bestSeason: '3–4 月、9–10 月',
      highlights: ['苏堤春晓', '三潭印月', '北山街', '杨公堤'],
      traffic:
        '杭州东站乘地铁 1 号线到龙翔桥，步行十分钟即到湖滨。环湖公交与共享单车都很方便；周末与节假日景区周边限行，建议地铁进出、步行环湖。',
      description:
        '西湖是杭州城西的一片浅水湖，三面云山一面城。湖面约 6.5 平方公里，苏堤、白堤把它分成几片水域，堤上桃柳相间，春天是本地人最愿意绕湖走一圈的季节。\n\n西湖的好看在于尺度小。断桥到平湖秋月不过一公里，沿途却集中了桥、亭、塔、碑；傍晚从北山街往南走，雷峰塔与保俶塔隔湖相对，光线把水面照成暖铜色，游船划过的痕迹很久才散。\n\n想避开人流，去西线的杨公堤与茅家埠。那里没有团队游客的扩音器，只有水杉、芦苇和偶尔经过的摇橹船，走完一圈大约两小时，雨天反而更安静。',
      isRecommended: true,
      viewCount: 986,
      createdAt: T.scenicBase,
      updatedAt: '2026-09-28T09:15:00.000Z',
    },
    {
      id: 4,
      name: '布达拉宫',
      regionId: 4,
      coverImage: '/images/potala.jpg',
      gallery: ['/images/potala.jpg'],
      level: '5A',
      rating: 4.9,
      openTime: '09:00–16:00（需提前预约）',
      ticketPrice: '200 元（旺季，需预约）',
      bestSeason: '5–10 月',
      highlights: ['红宫灵塔殿', '白宫东大殿', '德阳厦平台', '药王山观景台'],
      traffic:
        '拉萨市区步行或打车均可到达，正门在宫前广场。建议从药王山观景台先拍全景，再按预约时段进宫；参观结束后从后山下山，出口方向单行不可折返。',
      description:
        '布达拉宫位于拉萨市中心红山之上，海拔约 3700 米。主体由红宫与白宫组成，共十三层，从山脚到顶端高差 115 米；藏式碉楼特有的收分墙体让整座建筑看上去比实际更厚重。\n\n内部是另一个尺度：走廊狭窄，木梁低垂，酥油灯的光只照亮一小块壁画，佛像与经卷挤在幽暗的殿堂里。灵塔殿的金顶、镶嵌的宝石与外墙朴素的白灰形成强烈反差。\n\n参观需提前预约，进入后限时一小时且不走回头路。台阶多、海拔高，建议进藏头两天不要安排；登顶后不要急着拍照，先在平台静站几分钟，让呼吸跟上海拔。',
      isRecommended: true,
      viewCount: 1347,
      createdAt: T.scenicBase,
      updatedAt: '2026-10-05T04:22:00.000Z',
    },
    {
      id: 5,
      name: '黄山',
      regionId: 5,
      coverImage: '/images/huangshan.jpg',
      gallery: ['/images/huangshan.jpg', '/images/zhangjiajie.jpg'],
      level: '5A',
      rating: 4.8,
      openTime: '06:30–16:30（索道 07:00 起）',
      ticketPrice: '190 元（旺季，索道另计）',
      bestSeason: '4–5 月、9–11 月',
      highlights: ['迎客松', '光明顶', '西海大峡谷', '云海'],
      traffic:
        '黄山北站有直达汤口换乘中心的班车，约 50 分钟；从汤口换景区大巴到云谷寺或慈光阁，再乘索道上山。山路陡，不建议自驾直接上山。',
      description:
        '黄山位于安徽南部，花岗岩峰林在抬升与风化中形成七十二峰。莲花峰、光明顶、天都峰三峰鼎立，峰与峰之间是松树生长的石缝，迎客松就长在玉屏楼前的崖壁上，树干几乎与岩面平行。\n\n云海是黄山四绝里最看运气的一绝。冷暖气流在千米高度交汇，云层漫过山脊时，山峰变成海上的礁石；秋冬交替的清晨概率最高，前山玉屏楼与后山始信峰都是好位置。\n\n山上住宿少，标间需提前两周以上预订。两天一夜是常见节奏：第一天后山云谷索道上，走始信峰与西海大峡谷；第二天早起看日出，再从前山玉屏索道下山。',
      isRecommended: true,
      viewCount: 1053,
      createdAt: T.scenicBase,
      updatedAt: '2026-11-14T09:12:00.000Z',
    },
    {
      id: 6,
      name: '三亚亚龙湾',
      regionId: 6,
      coverImage: '/images/sanya.jpg',
      gallery: ['/images/sanya.jpg'],
      level: '4A',
      rating: 4.5,
      openTime: '全天开放（公共沙滩）',
      ticketPrice: '免费（沙滩公共区域）',
      bestSeason: '11 月–次年 4 月',
      highlights: ['七公里白沙滩', '浮潜', '热带天堂森林公园', '日落'],
      traffic:
        '三亚凤凰机场到亚龙湾约 40 分钟车程，环岛高铁亚龙湾站下车后需再打车 15 分钟。湾内以酒店接驳车与公交为主，公共沙滩入口在亚龙湾广场一侧。',
      description:
        '亚龙湾在海南岛最南端，是一处半月形海湾，三面被低山环抱，湾口朝南。沙滩长七公里，沙粒细而白，因珊瑚碎屑比例高，踩上去有轻微的凉感，正午也不烫脚。\n\n海水能见度在 5 到 10 米之间，湾内风浪小，浮潜能直接看到鹿角珊瑚与小丑鱼。最佳下水时间是上午九、十点与傍晚五点之后；正午紫外线最强，最容易晒伤却又最不容易察觉。\n\n湾内以度假酒店为主，带孩子的家庭可以把行程放慢：上午沙滩、中午午休、傍晚再下水一次。退潮时滩涂会露出大片珊瑚礁，穿溯溪鞋再去。',
      isRecommended: true,
      viewCount: 874,
      createdAt: T.scenicBase,
      updatedAt: '2026-10-11T07:30:00.000Z',
    },
    {
      id: 7,
      name: '桂林漓江',
      regionId: 7,
      coverImage: '/images/guilin.jpg',
      gallery: ['/images/guilin.jpg', '/images/lijiang.jpg'],
      level: '5A',
      rating: 4.7,
      openTime: '08:00–17:00（游船班次固定）',
      ticketPrice: '215 元（竹筏、游船另计）',
      bestSeason: '4–10 月',
      highlights: ['杨堤', '兴坪老寨山', '九马画山', '黄布倒影'],
      traffic:
        '桂林两江机场到磨盘山码头约 50 分钟；游船早上九点前后集中发船，需提前一天订票。只坐竹筏可从杨堤或兴坪码头进，两地都有班车接驳阳朔县城。',
      description:
        '漓江从桂林流向阳朔，八十余公里的水路两岸是典型的喀斯特峰丛。石灰岩在水的溶蚀下形成孤峰与峰林，山体近乎垂直，山脚直接落进江里，田块被切成不规则的小块。\n\n兴坪到杨堤一段最经典，二十元人民币背面的取景地就在兴坪码头下游不远。竹筏逆光时水面波纹细碎，清晨六点到八点江面常有薄雾，山影被雾吃掉一半。\n\n游船与竹筏是两种节奏。大船四小时直达阳朔，稳但离岸远；竹筏两人一筏，可以贴近水边看倒影，只是全程需穿救生衣，雨天水位上涨时可能停运。',
      isRecommended: false,
      viewCount: 792,
      createdAt: T.scenicBase,
      updatedAt: '2026-10-21T05:05:00.000Z',
    },
    {
      id: 8,
      name: '丽江古城',
      regionId: 8,
      coverImage: '/images/lijiang.jpg',
      gallery: ['/images/lijiang.jpg'],
      level: '5A',
      rating: 4.4,
      openTime: '全天开放（店铺 09:00–23:00）',
      ticketPrice: '免费（古城维护费 50 元）',
      bestSeason: '3–5 月、9–11 月',
      highlights: ['四方街', '木府', '黑龙潭', '狮子山万古楼'],
      traffic:
        '丽江三义机场到古城约 30 分钟车程，古城内禁止机动车通行。高铁丽江站有公交直达忠义市场，从南门或北门步行进入，行李多可联系客栈接送。',
      description:
        '丽江古城位于云南西北部的高原坝子，海拔约 2400 米，是纳西族聚居地。城内不设城墙，街巷顺水而建，玉河水从黑龙潭流出，分三股穿城，形成家家流水、户户垂杨的格局。\n\n四方街是旧时的集市中心，向四周辐射出五一街、七一街等石板路。纳西民居多为三坊一照壁的木结构院落，屋檐挑出，把高原的强光切成交错的阴影，午后坐在廊下最舒服。\n\n清晨七点前的古城最安静，石板被前一天的水冲过，店铺尚未开门，只有早点铺的蒸汽。夜里酒吧街喧闹，若想睡个安稳觉，建议选南门或狮子山一侧的客栈。',
      isRecommended: false,
      viewCount: 731,
      createdAt: T.scenicBase,
      updatedAt: '2026-10-24T03:48:00.000Z',
    },
  ];
}

/**
 * 构造 8 篇游记（景区 1 有两篇、景区 8 零篇，用于验证关联区多篇与空态）。
 * @returns {object[]}
 */
function buildTravels() {
  return [
    {
      id: 1,
      title: '九寨沟三天：把三条沟走成一条顺路的线',
      scenicId: 1,
      coverImage: '/images/jiuzhaigou.jpg',
      authorName: '林小满',
      authorMemberId: 1,
      content:
        '进沟前先想清楚一件事：观光车是单向循环的，走错方向就要多绕半小时。所以第一天的策略是先坐到最远，再一路往下走，把体力留给下坡。\n\n则查洼沟只有长海和五彩池两个点，上午光线斜，五彩池的水色最透。长海值得多停一会儿，湖面开阔，风把水面吹皱，远处的雪线正好压在湖尾。\n\n第二天的重心放在日则沟。五花海观景台人多，往下走两百米的栈道反而更空，能拍到完整的湖湾；镜海要赶在无风的清晨，晚一点就只剩涟漪了。\n\n第三天留给树正沟，海拔低、节奏慢，适合收尾。如果遇上雨天别急着退票，雨后的瀑布水量最好看，诺日朗的水声隔着栈道都听得到。',
      publishedAt: '2026-10-06T01:30:00.000Z',
      createdAt: '2026-10-06T01:30:00.000Z',
      updatedAt: '2026-10-06T01:30:00.000Z',
    },
    {
      id: 2,
      title: '十月的九寨，颜色浓得像被调过饱和度',
      scenicId: 1,
      coverImage: '/images/jiuzhaigou.jpg',
      authorName: '站点编辑',
      authorMemberId: null,
      content:
        '十月中旬进沟，是颜色最不讲道理的时候。桦树和落叶松同时转黄，红桦的树皮在逆光里发亮，倒影落在水里，湖面被分成两种色温。\n\n拍照最有效的方法是找水面的倒影而不是直接拍山。风停的间隙只有几十秒，先构图再等风，比举着相机乱找效率高得多。\n\n穿深色衣服在照片里更稳，红色和亮黄容易和彩林打架。早晚温差大，羽绒服和薄冲锋衣都要带，中午出太阳时又只剩一件长袖。',
      publishedAt: '2026-10-22T02:15:00.000Z',
      createdAt: '2026-10-22T02:15:00.000Z',
      updatedAt: '2026-10-22T02:15:00.000Z',
    },
    {
      id: 3,
      title: '张家界不坐百龙天梯的另一种走法',
      scenicId: 2,
      coverImage: '/images/zhangjiajie.jpg',
      authorName: '周叙白',
      authorMemberId: 2,
      content:
        '百龙天梯排队的成本经常被低估。旺季中午去，光排队就可能用掉一小时，电梯本身只有一分多钟。想省时间，可以走后山索道加环保车的组合。\n\n我的走法是：一早从森林公园门进，先走金鞭溪到水绕四门，再乘环保车到百龙下站。上午团队游客大多还在袁家界，谷底反而清净，溪水声一路都在。\n\n袁家界的观景台朝西，下午逆光，拍照会发白；把袁家界放在第二天上午，天子山与杨家界放在下午，光线更顺。\n\n山上住宿条件一般，但省掉每天上下山的两小时车程。夜里气温骤降，记得确认客栈有没有电热毯。',
      publishedAt: '2026-10-14T09:20:00.000Z',
      createdAt: '2026-10-14T09:20:00.000Z',
      updatedAt: '2026-10-14T09:20:00.000Z',
    },
    {
      id: 4,
      title: '西湖不必挤断桥：环湖西线的三个清净点',
      scenicId: 3,
      coverImage: '/images/westlake.jpg',
      authorName: '林小满',
      authorMemberId: 1,
      content:
        '节假日从断桥走到白堤，基本是被人流推着走的。把路线换到西线，同样的湖水会安静很多，也更容易走完整圈。\n\n第一个点是茅家埠。公交下车后沿水走，芦苇与木栈道把视线挡成一片一片，能看到野鸭和白鹭，几乎没有扩音器。第二个点是乌龟潭，水面窄、树影深，雨天最美。\n\n第三个点是杨公堤上的几座拱桥。骑车过桥的瞬间能看到两侧水面同时展开，船从桥洞里出来，是环湖最有画面感的一段。\n\n走完西线大约两小时，中途可以在郭庄附近的茶室坐二十分钟。别在湖边买现做的糖炒栗子，凉了以后很难吃。',
      publishedAt: '2026-09-26T03:05:00.000Z',
      createdAt: '2026-09-26T03:05:00.000Z',
      updatedAt: '2026-09-26T03:05:00.000Z',
    },
    {
      id: 5,
      title: '布达拉宫预约与高反，第一次进藏要准备什么',
      scenicId: 4,
      coverImage: '/images/potala.jpg',
      authorName: '站点编辑',
      authorMemberId: null,
      content:
        '门票要提前预约，且进宫时间精确到小时，迟到会被拒。预约成功后打印一份纸质凭证，手机没电或信号差时它比截图可靠。\n\n高反这件事，个体差异远大于准备程度。落地当天不要洗澡、不要喝酒、不要爬楼梯，把第一晚当成适应期。真正难受时吸氧比硬撑有效，不要相信提前吃某一种药就能完全避免。\n\n宫里台阶又陡又窄，参观只有一小时，队伍一直在走。想看得细一点，就在德阳厦平台多停一会儿，那里视野最开阔，也是唯一能缓口气的地方。\n\n下山后去八廓街顺时针走一圈，节奏慢下来，身体会比在酒店躺着恢复得更快。',
      publishedAt: '2026-11-02T06:40:00.000Z',
      createdAt: '2026-11-02T06:40:00.000Z',
      updatedAt: '2026-11-02T06:40:00.000Z',
    },
    {
      id: 6,
      title: '黄山两天一夜：住在山上等一次日出',
      scenicId: 5,
      coverImage: '/images/huangshan.jpg',
      authorName: '周叙白',
      authorMemberId: 2,
      content:
        '黄山的日出值得为它多付一晚房价。住山下意味着凌晨三点起床、摸黑坐车、再排索道，等到了光明顶，最好的位置已经被住山上的人占住。\n\n我的节奏是：第一天中午从云谷索道上，走始信峰、黑虎松，下午进西海大峡谷，坐地轨上来后直接到光明顶附近住下，日落就在门口看。\n\n第二天四点四十起床，往光明顶东侧走十分钟，那里比主观景台人少一半。日出之后回酒店吃早饭、退房，从前山走玉屏楼看迎客松，中午乘索道下山。\n\n山上水贵，带一个保温杯在酒店灌满。雨衣比伞实用，山风会把伞吹翻。',
      publishedAt: '2026-10-30T10:12:00.000Z',
      createdAt: '2026-10-30T10:12:00.000Z',
      updatedAt: '2026-10-30T10:12:00.000Z',
    },
    {
      id: 7,
      title: '亚龙湾带娃四天：什么时候下水最舒服',
      scenicId: 6,
      coverImage: '/images/sanya.jpg',
      authorName: '林小满',
      authorMemberId: 1,
      content:
        '带孩子来亚龙湾，最重要的不是住哪家酒店，而是把下水时间排对。上午九点到十一点、傍晚五点到六点半，水温与紫外线都最舒服。\n\n正午不要硬下水。沙子被晒得发烫，孩子的脚受不了，海水表层温度也高，泡久了容易头晕。这个时段适合回房间午睡，或者去热带天堂森林公园坐一次索道。\n\n浮潜要给娃穿长袖水母衣，湾内虽没有大浪，珊瑚边缘仍有划伤风险。沙滩玩具在酒店商店买比外面贵一倍，提前在市区超市备好。\n\n第四天可以安排一次出海，看海豚的概率不高，但孩子对船的兴趣往往超过对海豚的期待。',
      publishedAt: '2026-11-08T08:25:00.000Z',
      createdAt: '2026-11-08T08:25:00.000Z',
      updatedAt: '2026-11-08T08:25:00.000Z',
    },
    {
      id: 8,
      title: '漓江竹筏从杨堤到兴坪，慢下来才看得见',
      scenicId: 7,
      coverImage: '/images/guilin.jpg',
      authorName: '站点编辑',
      authorMemberId: null,
      content:
        '竹筏漂流最精华的一段是杨堤到兴坪，约十八公里，顺水两个多小时。旺季要早到，八点前的江面还有雾，山影一层压一层。\n\n筏工大多熟悉哪个角度好看，会在九马画山与黄布倒影停一会儿。想拍照就提前说，逆光时把曝光压低一点，水面细节才留得住。\n\n全程要穿救生衣，鞋子会湿，溯溪鞋或拖鞋都行。下雨天水位上涨可能临时停运，出发前一天务必确认，别把行程排得太紧。\n\n到兴坪后可以爬老寨山看日落，四十分钟台阶路，山顶视野能把整个江湾收进去。',
      publishedAt: '2026-09-20T04:00:00.000Z',
      createdAt: '2026-09-20T04:00:00.000Z',
      updatedAt: '2026-09-20T04:00:00.000Z',
    },
  ];
}

/**
 * 构造 6 条收藏：林小满 4 条（景区 1/2/4/5），周叙白 2 条（景区 2/3）。
 * @returns {object[]}
 */
function buildFavorites() {
  return [
    { id: 1, memberId: 1, scenicId: 1, createdAt: '2026-10-08T12:41:00.000Z' },
    { id: 2, memberId: 1, scenicId: 2, createdAt: '2026-10-13T09:12:00.000Z' },
    { id: 3, memberId: 1, scenicId: 4, createdAt: '2026-10-27T15:08:00.000Z' },
    { id: 4, memberId: 1, scenicId: 5, createdAt: '2026-11-03T11:36:00.000Z' },
    { id: 5, memberId: 2, scenicId: 2, createdAt: '2026-10-16T03:20:00.000Z' },
    { id: 6, memberId: 2, scenicId: 3, createdAt: '2026-11-06T07:55:00.000Z' },
  ];
}

/**
 * 构造 3 条意见反馈：2 条 pending（其中 1 条超 100 字用于折叠验证）+ 1 条 resolved。
 * @returns {object[]}
 */
function buildFeedbacks() {
  return [
    {
      id: 1,
      nickname: '阿澈',
      contact: 'ache@example.com',
      content:
        '景区详情页能不能加一个「最佳季节」的提示？我十月底去黄山，云海确实好，但上山前完全没查到这类信息，希望首页卡片上也能看到。',
      status: 'pending',
      memberId: null,
      createdAt: '2026-11-12T07:20:00.000Z',
      handledAt: null,
    },
    {
      id: 2,
      nickname: '林小满',
      contact: '13800138000',
      content:
        '收藏页挺好用，不过我想提两个小建议：第一，希望能按地区对收藏的景区分组，去四川前一眼就能看出哪些已经收藏；第二，取消收藏之后如果能有一个撤销入口就好了，我上次手滑点掉了一条，只能重新进详情页再收藏一次。另外游记列表能不能加一个「只看我去过的景区」之类的筛选，现在按景区筛一次只能选一个，来回切换有点麻烦。',
      status: 'pending',
      memberId: 1,
      createdAt: '2026-11-10T13:02:00.000Z',
      handledAt: null,
    },
    {
      id: 3,
      nickname: '老陈',
      contact: 'chen1968@example.com',
      content: '游记的排版很舒服，字体和行距都合适，手机上读也不累。希望以后能多一些淡季出行的攻略。',
      status: 'resolved',
      memberId: null,
      createdAt: '2026-10-25T02:47:00.000Z',
      handledAt: '2026-10-26T01:15:00.000Z',
    },
  ];
}

/**
 * 构造 8 条操作日志：覆盖 region/scenic/travel × create/update/delete，含 1 条 fail。
 * @returns {object[]}
 */
function buildOperationLogs() {
  return [
    {
      id: 1,
      adminId: 1,
      adminName: 'admin',
      module: 'region',
      action: 'create',
      targetId: 8,
      targetName: '云南',
      result: 'success',
      message: '',
      ip: '127.0.0.1',
      createdAt: '2026-09-20T02:10:00.000Z',
    },
    {
      id: 2,
      adminId: 1,
      adminName: 'admin',
      module: 'region',
      action: 'update',
      targetId: 3,
      targetName: '浙江',
      result: 'success',
      message: '',
      ip: '127.0.0.1',
      createdAt: '2026-09-28T09:15:00.000Z',
    },
    {
      id: 3,
      adminId: 1,
      adminName: 'admin',
      module: 'region',
      action: 'delete',
      targetId: 1,
      targetName: '四川',
      result: 'fail',
      message: '该地区下还有 1 个景区，请先处理',
      ip: '127.0.0.1',
      createdAt: '2026-09-30T06:32:00.000Z',
    },
    {
      id: 4,
      adminId: 1,
      adminName: 'admin',
      module: 'scenic',
      action: 'create',
      targetId: 5,
      targetName: '黄山',
      result: 'success',
      message: '',
      ip: '127.0.0.1',
      createdAt: '2026-10-02T06:11:00.000Z',
    },
    {
      id: 5,
      adminId: 1,
      adminName: 'admin',
      module: 'scenic',
      action: 'update',
      targetId: 2,
      targetName: '张家界国家森林公园',
      result: 'success',
      message: '',
      ip: '127.0.0.1',
      createdAt: '2026-10-18T08:40:00.000Z',
    },
    {
      id: 6,
      adminId: 1,
      adminName: 'admin',
      module: 'scenic',
      action: 'delete',
      targetId: 9,
      targetName: '临时测试景区',
      result: 'success',
      message: '级联删除 0 篇游记、0 条收藏',
      ip: '127.0.0.1',
      createdAt: '2026-10-20T02:05:00.000Z',
    },
    {
      id: 7,
      adminId: 1,
      adminName: 'admin',
      module: 'travel',
      action: 'create',
      targetId: 2,
      targetName: '十月的九寨，颜色浓得像被调过饱和度',
      result: 'success',
      message: '',
      ip: '127.0.0.1',
      createdAt: '2026-10-22T02:15:00.000Z',
    },
    {
      id: 8,
      adminId: 1,
      adminName: 'admin',
      module: 'travel',
      action: 'delete',
      targetId: 8,
      targetName: '漓江竹筏从杨堤到兴坪，慢下来才看得见',
      result: 'success',
      message: '',
      ip: '127.0.0.1',
      createdAt: '2026-11-14T09:12:03.000Z',
    },
  ];
}

/**
 * 构造 4 条管理员日志：login ×2、login_fail ×1、logout ×1。
 * @returns {object[]}
 */
function buildAdminLogs() {
  return [
    {
      id: 1,
      username: 'admin',
      adminId: 1,
      event: 'login',
      ip: '127.0.0.1',
      result: 'success',
      message: '',
      createdAt: '2026-11-10T09:15:00.000Z',
    },
    {
      id: 2,
      username: 'admin',
      adminId: null,
      event: 'login_fail',
      ip: '127.0.0.1',
      result: 'fail',
      message: '账号或密码错误',
      createdAt: '2026-11-13T22:41:00.000Z',
    },
    {
      id: 3,
      username: 'admin',
      adminId: 1,
      event: 'logout',
      ip: '127.0.0.1',
      result: 'success',
      message: '',
      createdAt: '2026-11-12T18:20:00.000Z',
    },
    {
      id: 4,
      username: 'admin',
      adminId: 1,
      event: 'login',
      ip: '127.0.0.1',
      result: 'success',
      message: '',
      createdAt: '2026-11-14T09:03:12.000Z',
    },
  ];
}

/**
 * 构造 6 条会员登录日志：4 条成功（两个会员）、2 条失败（会员不存在 / 密码错误）。
 * @returns {object[]}
 */
function buildMemberLoginLogs() {
  return [
    {
      id: 1,
      username: '林小满',
      memberId: 1,
      ip: '127.0.0.1',
      result: 'success',
      message: '',
      createdAt: '2026-11-04T02:18:00.000Z',
    },
    {
      id: 2,
      username: '周叙白',
      memberId: 2,
      ip: '127.0.0.1',
      result: 'success',
      message: '',
      createdAt: '2026-11-09T21:03:00.000Z',
    },
    {
      id: 3,
      username: '林小满',
      memberId: 1,
      ip: '127.0.0.1',
      result: 'success',
      message: '',
      createdAt: '2026-11-12T20:10:00.000Z',
    },
    {
      id: 4,
      username: '周叙白',
      memberId: 2,
      ip: '127.0.0.1',
      result: 'success',
      message: '',
      createdAt: '2026-11-13T09:12:00.000Z',
    },
    {
      id: 5,
      username: '林小满',
      memberId: null,
      ip: '127.0.0.1',
      result: 'fail',
      message: '密码错误',
      createdAt: '2026-11-08T08:30:00.000Z',
    },
    {
      id: 6,
      username: '游客小林',
      memberId: null,
      ip: '127.0.0.1',
      result: 'fail',
      message: '会员不存在',
      createdAt: '2026-11-07T19:44:00.000Z',
    },
  ];
}

/**
 * 生成完整初始数据集（含运行时算出的密码哈希与自增计数器基线）。
 * @returns {Promise<object>} 可直接交给 db.bootstrap() 落盘的对象
 */
export async function createSeedData() {
  const [adminHash, memberHash] = await Promise.all([hashPassword('admin123'), hashPassword('123456')]);
  const seededAt = new Date().toISOString();

  const data = {
    // 签名密钥随数据落盘：进程重启后旧 token 仍然有效（不设 ETRAVEL_SECRET 时使用）
    meta: { version: 1, seededAt, secret: crypto.randomBytes(32).toString('hex'), counters: {} },
    members: [
      {
        id: 1,
        username: '林小满',
        passwordHash: memberHash,
        phone: '13800138000',
        email: 'user@example.com',
        createdAt: '2026-09-18T03:22:41.000Z',
        updatedAt: '2026-09-18T03:22:41.000Z',
      },
      {
        id: 2,
        username: '周叙白',
        passwordHash: memberHash,
        phone: '13900139000',
        email: 'zhou@example.com',
        createdAt: '2026-10-02T06:15:00.000Z',
        updatedAt: '2026-10-02T06:15:00.000Z',
      },
    ],
    admins: [
      {
        id: 1,
        username: 'admin',
        passwordHash: adminHash,
        displayName: '站点管理员',
        lastLoginAt: '2026-11-14T09:03:12.000Z',
        createdAt: T.epoch,
        updatedAt: '2026-11-14T09:03:12.000Z',
      },
    ],
    regions: buildRegions(),
    scenics: buildScenics(),
    travels: buildTravels(),
    favorites: buildFavorites(),
    feedbacks: buildFeedbacks(),
    operationLogs: buildOperationLogs(),
    adminLogs: buildAdminLogs(),
    memberLoginLogs: buildMemberLoginLogs(),
  };

  // 计数器基线 = 各集合现有最大 id（种子 id 连续，等价于条数）
  for (const name of COLLECTIONS) {
    const list = data[name];
    data.meta.counters[name] = list.reduce((acc, item) => (item.id > acc ? item.id : acc), 0);
  }

  return data;
}
