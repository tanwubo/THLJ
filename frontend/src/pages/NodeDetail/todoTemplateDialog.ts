const TODO_TEMPLATES = {
  '彩礼类': ['沟通彩礼金额', '彩礼转账', '彩礼确认'],
  '嫁妆类': ['嫁妆清单', '嫁妆采购'],
  '三金类': ['选购三金', '购买三金'],
  '婚宴类': ['确定婚宴酒店', '签订婚宴合同', '婚宴菜单确认'],
  '婚庆类': ['婚庆公司选择', '婚礼策划确认', '婚礼现场布置'],
  '婚车类': ['婚车预约', '婚车路线规划'],
  '婚纱类': ['婚纱照拍摄', '婚纱礼服选择'],
}

export function buildTodoTemplateDialogConfig(onSelect: (content: string) => void | Promise<void>) {
  const actions = Object.entries(TODO_TEMPLATES)
    .flatMap(([category, items]) => items.map((item) => `${category}: ${item}`))
    .map((text) => ({
      key: text,
      text,
      onClick: () => onSelect(text.split(': ')[1]),
    }))

  actions.push({
    key: 'cancel',
    text: '取消',
    onClick: () => undefined,
  })

  return {
    closeOnAction: true,
    closeOnMaskClick: true,
    actions,
  }
}
