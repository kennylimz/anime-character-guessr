/**
 * 公告数据
 * 数组中第一个元素会显示在最上面（最新的公告）
 * 要添加新公告，只需编辑 announcements.js 文件
 * 如需改变公告显示方式，只需修改 UpdateAnnouncement 组件
 * 如需更改样式，只需编辑 UpdateAnnouncement.css 文件
 * 格式：
 * {
 *   version: '版本号', // 可选
 *   date: '发布日期', // 可选
 *   content: '公告内容，支持HTML标签'
 * }
 */
const announcements = [
  {
    version: '我50',
    date: '置顶',
    content: `
      服务器的免费流量用完了，在这里放一个打赏码。<br/>
      意思一下就行，多出来的会请开发群的群友喝奶茶。<br/>
      <img src="/assets/tip_code.jpg" alt="Tip Code" style="max-width: 20rem" /><br/>
    `
  },

  {
    version: '1.5.1',
    date: '2025-06-24',
    content: `
      作者看比赛的时候被faze气晕了，刚刚才醒过来。<br/>
      添加了简易的旁观功能，在选队伍的地方选择。<br/>
      现在可以自定义提示出现的时间。
      
    `
  },

  {
    version: '1.5.0',
    date: '2025-06-05',
    content: `
      添加了不知道有什么用的抽卡功能。<br/>
      现在猜对作品会给一部分分数。
      
    `
  },

  {
    version: '1.4.2',
    date: '2025-06-03',
    content: `
      为下列作品添加了额外标签：<br/>
      第五人格、永劫无间、BanG Dream! 少女乐团派对！、战双帕弥什
      
    `
  },
  
  {
    version: '1.4.1',
    date: '2025-06-01',
    content: `
      修复了投降/断线后游戏卡死的问题。<br/>
      统计额外添加作品的次数，会优先为这类作品添加额外标签。
      
    `
  },

  {
    version: '1.4.0',
    date: '2025-05-23',
    content: `
      简单做了一个组队功能，允许队友间共享猜测。<br/>
      计分什么的还没想好怎么弄。
      
    `
  },


  {
    version: '1.3.2',
    date: '2025-05-16',
    content: `
      多人模式点自己名字可以写短信息，匿名模式下会一同隐藏。<br/>
      新增了下列游戏的支持：<br/>
      崩坏3、蔚蓝档案、鸣潮、碧蓝航线、命运-冠位指定。
        
    `
  },

  {
    version: '1.3.1',
    date: '2025-05-09',
    content: `
      这周有点摸鱼，做了一个<a href="https://www.bilibili.com/video/BV14CVRzUELs">介绍视频</a>希望宣传下。<br/>
      加入了快速匹配房间的按钮，不活跃的房间会在10分钟之后自动关闭。
        
    `
  },

  {
    version: '1.3.0',
    date: '2025-05-03',
    content: `
      更新了新的外部标签模式，支持下列游戏：<br/>
      崩坏：星穹铁道、原神、绝区零、赛马娘、明日方舟(感谢<a href="https://github.com/czjun">@czjun</a>)、英雄联盟、Dota 2。
        
    `
  },

  {
    version: '1.2.2',
    date: '2025-05-01',
    content: `
      大家节日快乐！<br/>
      优化了共同标签的筛选方式，现在不会纳入人数太少的标签。<br/>
      答案或猜测没有动画作品时，即使没有勾选“包含游戏作品”，也会自动统计游戏作品。避免了出题时来回改动设置。<br/>
      
    `
  },

  {
    version: '1.2.1',
    date: '2025-04-28',
    content: `
      重写的标签功能作为一项设置加入，默认开启。<br/>
      新增受欢迎角色排行榜。<br/>
      
    `
  },

  {
    version: '1.2.0',
    date: '2025-04-27',
    content: `
      实现玩家踢出功能，房主权限转移功能。 <br/>
      新增预设配置功能，简化设置选项的应用，优化多人游戏界面中的游戏设置显示。<br/>
      新增公告组件及样式，更新主页以显示公告内容。
      
    `
  },
  
  {
    version: '1.1.0',
    date: '2025-04-21',
    content: `
      具体可见视频：<a href="https://www.bilibili.com/video/BV1mjLuz4Euj">二次元猜猜呗 4.21更新</a>。 <br/>
      已可对现有角色标签投票。多人模式已可指定选手出题。<br/>
      有好的预设或目录可以B站私信<a href="https://space.bilibili.com/87983557">作者</a>，可能被采纳成为每日推荐或者常驻预设。<br/>
      想加入一个童年回忆的主题……
      
    `
  },
  
  {
    version: '1.0.0',
    date: '2025-04-13',
    content: `
      二次元猜猜呗正式上线！<br/>
      <b>主要功能：</b><br/>
      - 单人模式<br/>
      - 多人模式<br/>
      - 自定义游戏设置<br/>
      感谢 Bangumi 管理员的优化支持，以及各位网友贡献的代码和数据。感谢大家的热情和支持。
    `
  }
];

export default announcements; 
