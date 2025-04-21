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
