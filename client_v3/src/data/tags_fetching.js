/**
 * 采集中的游戏标签
 * 把需要添加的游戏标签栏目名，可选数值放到里面。
 * 收集完毕后，要删去响应的标签。
 * 暂未完工。
 * 格式：
 * {
 *   subjectId: 'integer',  // 游戏条目ID
 *   sections: [
 * 		{
 *     	 	sectionName: string, 	// 标签栏目名
 *    	 	type: string,    		// 标签类型，可选值：'defined', 'custom', 'mixed'
 *       	maxNum: integer, 		// 标签最大数量
 *       	values: [string, ...] 	// 标签可选值
 *     	}
 *     ...
 *   ]
 * }
 */

export const tagsFetching = [
  {
    subjectId: 194792, // 王者荣耀
    sections: [
		{
			sectionName: '标签',
			type: 'defined',
			maxNum: 2,
			values: ['对抗路', '打野', '中路', '发育路', '游走']
		},
	]
  }
]
