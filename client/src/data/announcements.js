/**
 * Announcement Data
 * The first element in the array will be displayed at the top (latest announcement)
 * To add a new announcement, just edit the announcements.js file
 * To change how announcements are displayed, just modify the UpdateAnnouncement component
 * To change the style, just edit the UpdateAnnouncement.css
 * file：
 * {
 *   version: 'Version number', // Optional
 *   date: 'Release date', // Optional
 *   content: 'Announcement content, supports HTML tags'
 * }
 */
const announcements = [
  {
    version: "Me 50",
    date: "Pinned",
    content: `
      The server’s free traffic is used up, here is a donation code.<br/>
      Just a small contribution is fine, extra will be used to treat developer group friends to milk tea.<br/>
      <img src="/assets/tip_code.jpg" alt="Tip Code" style="max-width: 20rem" /><br/>
    `,
  },

  {
    version: "1.5.4",
    date: "2025-08-21",
    content: `
      Added image hint feature, can set to show a blurred image when remaining attempts reach a threshold.
    `,
  },

  {
    version: "1.5.3",
    date: "2025-07-27",
    content: `
      Secretly tracking how many times characters are guessed.<br/>
      The author’s new toy developed last weekend: a desktop widget: <a href="https://www.bilibili.com/video/BV1MstxzgEhg/">一个桌面挂件</a>。
    `,
  },

  {
    version: "1.5.2",
    date: "2025-07-04",
    content: `
      Added posters of past ISML contests to the gacha pool. Not only champions, but winners also have posters.

    `,
  },

  {
    version: "1.5.1",
    date: "2025-06-24",
    content: `
      The author fainted from anger while watching Faze’s match, just woke up.<br/>
      Added a simple spectating feature, selectable at team selection. Now you can customize when hints appear.<br/>
      By default, games are no longer private, players can join mid-game as spectators.<br/>
      Extra tags are now optional, added support for the following games:<br/>
      Snowbreak: Containment Zone, Princess Connect! Re:Dive, Reverse: 1999

    `,
  },

  {
    version: "1.5.0",
    date: "2025-06-05",
    content: `
      Added a gacha feature (not sure what it’s for).<br/>
      Now guessing the correct work gives partial points.
      
    `,
  },

  {
    version: "1.4.2",
    date: "2025-06-03",
    content: `
      Added extra tags for the following works:<br/>
      Identity V, Naraka: Bladepoint, BanG Dream! Girls Band Party!, Punishing: Gray Raven
      
    `,
  },

  {
    version: "1.4.1",
    date: "2025-06-01",
    content: `
      Fixed issue where game froze after surrender/disconnection.<br/>
      Counted extra-added works, will prioritize adding extra tags for them.
      
    `,
  },

  {
    version: "1.4.0",
    date: "2025-05-23",
    content: `
      Made a simple team feature, allows teammates to share guesses.<br/>
      Scoring is not yet decided.
      
    `,
  },

  {
    version: "1.3.2",
    date: "2025-05-16",
    content: `
      In multiplayer mode, clicking your name lets you write a short message, hidden in anonymous mode.<br/>
      Added support for the following games:<br/>
      Honkai Impact 3rd, Blue Archive, Wuthering Waves, Azur Lane, Fate/Grand Order.
        
    `,
  },

  {
    version: "1.3.1",
    date: "2025-05-09",
    content: `
      Slacked off a bit this week，made an introduction<a href="https://www.bilibili.com/video/BV14CVRzUELs">video</a>for promotion.<br/>
      Added quick match button, inactive rooms auto-close after 10 minutes.
        
    `,
  },

  {
    version: "1.3.0",
    date: "2025-05-03",
    content: `
      Updated external tag mode, supports the following games:<br/>
      Honkai: Star Rail, Genshin Impact, Zenless Zone Zero, Uma Musume, Arknights (Thanks <a href="https://github.com/czjun">@czjun</a>, League of Legends, Dota 2.
        
    `,
  },

  {
    version: "1.2.2",
    date: "2025-05-01",
    content: `
      Happy holidays everyone!<br/>
      Optimized common tag filtering, now won’t include tags with too few entries.<br/>
      If answers or guesses lack anime works, game works will be auto-counted even if “Include game works” isn’t checked. Prevents changing settings repeatedly while making questions.<br/>
      
    `,
  },

  {
    version: "1.2.1",
    date: "2025-04-28",
    content: `
      Rewritten tagging function added as a setting, enabled by default.<br/>
      Added popular character ranking.<br/>
      
    `,
  },

  {
    version: "1.2.0",
    date: "2025-04-27",
    content: `
      Implemented player kick and host transfer features. <br/>
      Added preset configuration, simplified applying options, optimized multiplayer game settings UI.<br/>
      Added announcement component and style, updated homepage to show announcements.
      
    `,
  },

  {
    version: "1.1.0",
    date: "2025-04-21",
    content: `
      See video: <a href="https://www.bilibili.com/video/BV1mjLuz4Euj">ACG Guess Game 4.21 update</a>. <br/>
      Voting on existing character tags is now available. In multiplayer, players can now designate who sets the question.<br/>
      If you have good presets or directories, you can DM the <a href="https://space.bilibili.com/87983557">author</a> on Bilibili, may be adopted as daily recommendations or permanent presets.<br/>
      Want to add a childhood memories theme…
      
    `,
  },

  {
    version: "1.0.0",
    date: "2025-04-13",
    content: `
      ACG Guess Game officially launched!<br/>
      <b>Main features:</b><br/>
      - Single Player Mode<br/>
      - Multiplayer Mode<br/>
      - Custom Game Settings<br/>
      Thanks to Bangumi admins for optimization support, and to all contributors for code and data. Thanks everyone for your enthusiasm and support.
    `,
  },
];

export default announcements;
