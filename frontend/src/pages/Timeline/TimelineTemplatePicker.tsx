import { Popup } from 'antd-mobile'
import { TimelineTemplate } from '../../services/api'

export type TimelineTemplatePickerView = 'list' | 'detail'

export type TimelineTemplatePickerProps = {
  visible: boolean
  templates: TimelineTemplate[]
  activeTemplateId: number | null
  loading: boolean
  detailLoading: boolean
  view: TimelineTemplatePickerView
  submitting: boolean
  onSelect: (id: number) => void
  onClose: () => void
  onBack: () => void
  onApply: () => void
}

function getTemplateStepCount(template: TimelineTemplate) {
  return template.nodeCount ?? template.nodes?.length ?? 0
}

function getStepDescription(description?: string) {
  return description?.trim() || '暂未配置预置说明'
}

function getTemplateDescription(description?: string, fallback = '查看预置步骤后，再决定是否直接应用。') {
  return description?.trim() || fallback
}

export default function TimelineTemplatePicker({
  visible,
  templates,
  activeTemplateId,
  loading,
  detailLoading,
  view,
  submitting,
  onSelect,
  onClose,
  onBack,
  onApply,
}: TimelineTemplatePickerProps) {
  const activeTemplate = templates.find((template) => template.id === activeTemplateId) ?? null
  const isDetailView = view === 'detail'
  const detailNodes = activeTemplate?.nodes ?? []
  const detailStepCount = detailNodes.length

  return (
    <Popup
      visible={visible}
      onMaskClick={onClose}
      bodyStyle={{
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        height: '92dvh',
        maxHeight: '92dvh',
        overflow: 'hidden',
        background: 'transparent',
      }}
    >
      <div className="timeline-template-picker" data-view={view}>
        <div className="timeline-template-picker__shell">
          <header className="timeline-template-picker__header">
            <span className="timeline-template-picker__handle" aria-hidden="true" />
            <div className="timeline-template-picker__header-row">
              <div className="timeline-template-picker__header-copy">
                <p className="section-label">Timeline Templates</p>
                <h3 className="section-title">
                  {isDetailView ? activeTemplate?.name ?? '模板详情' : '选择一套初始时间线'}
                </h3>
                <p className="section-copy">
                  {isDetailView
                    ? getTemplateDescription(activeTemplate?.description)
                    : '从模板开始，先看清结构，再进入后续筹备。'}
                </p>
              </div>

              <button type="button" className="timeline-template-picker__close" onClick={onClose}>
                关闭
              </button>
            </div>
          </header>

          <div className="timeline-template-picker__body" aria-busy={loading || detailLoading}>
            {!isDetailView ? (
              <div className="timeline-template-picker__stage timeline-template-picker__stage--list">
                <section className="timeline-template-picker__intro">
                  <p className="timeline-template-picker__intro-copy">
                    选择后会先加载模板详情，再进入详情页确认步骤内容。
                  </p>
                </section>

                {loading ? (
                  <section className="timeline-template-picker__loading-state" aria-label="模板列表加载中">
                    <div className="timeline-template-picker__loading-card timeline-template-picker__loading-card--wide" />
                    <div className="timeline-template-picker__loading-card" />
                    <div className="timeline-template-picker__loading-card" />
                  </section>
                ) : templates.length > 0 ? (
                  <section className="timeline-template-picker__card-list" aria-label="模板列表">
                    {templates.map((template) => {
                      const isActive = template.id === activeTemplateId
                      const stepCount = getTemplateStepCount(template)
                      const metaId = `timeline-template-picker-template-${template.id}-meta`
                      const copyId = `timeline-template-picker-template-${template.id}-copy`

                      return (
                        <button
                          key={template.id}
                          type="button"
                          aria-pressed={isActive}
                          aria-describedby={`${metaId} ${copyId}`}
                          className={`timeline-template-picker__card${isActive ? ' timeline-template-picker__card--selected' : ''}`}
                          onClick={() => onSelect(template.id)}
                        >
                          <div className="timeline-template-picker__card-head">
                            <div>
                              <h4 className="timeline-template-picker__card-title">
                                {template.name}
                              </h4>
                              <p id={metaId} className="timeline-template-picker__card-meta">
                                {stepCount > 0 ? `${stepCount} 个预置步骤` : '暂无预置步骤'}
                              </p>
                            </div>
                            <span className="timeline-template-picker__badge">
                              {detailLoading && isActive ? '加载中...' : '查看详情'}
                            </span>
                          </div>

                          <p id={copyId} className="timeline-template-picker__card-copy">
                            {getTemplateDescription(template.description, '这套模板会先帮你搭好基础结构。')}
                          </p>

                          <div className="timeline-template-picker__card-foot">
                            <span>{isActive ? '已选中' : '点击卡片查看详情'}</span>
                            <span>{detailLoading && isActive ? '正在加载' : '详情页预览'}</span>
                          </div>
                        </button>
                      )
                    })}
                  </section>
                ) : (
                  <section className="timeline-template-picker__empty-state">
                    <p className="timeline-template-picker__empty-title">暂无可用模板</p>
                    <p className="timeline-template-picker__empty-copy">
                      你可以先保持空白时间线，或稍后再创建并保存一套模板。
                    </p>
                  </section>
                )}
              </div>
            ) : (
              <div className="timeline-template-picker__stage timeline-template-picker__stage--detail">
                <button type="button" className="timeline-template-picker__back" onClick={onBack}>
                  返回模板列表
                </button>

                {activeTemplate ? (
                  <>
                    <section className="timeline-template-picker__detail-card">
                      <div className="timeline-template-picker__detail-heading">
                        <div>
                          <p className="section-label">Preview</p>
                          <h4 className="timeline-template-picker__detail-title">{activeTemplate.name}</h4>
                        </div>
                        <span className="timeline-template-picker__badge timeline-template-picker__badge--soft">
                          {detailLoading ? '加载中...' : `${detailStepCount} 个步骤`}
                        </span>
                      </div>

                      <p className="timeline-template-picker__detail-copy">
                        {activeTemplate.description?.trim() || '查看预置步骤后，再决定是否直接应用。'}
                      </p>
                    </section>

                    <section className="timeline-template-picker__step-section" aria-label="模板步骤预览">
                      <ol className="timeline-template-picker__step-list">
                        {detailNodes.length > 0 ? (
                          detailNodes.map((node, index) => (
                            <li
                              key={node.id ?? `${activeTemplate.id}-${node.order}-${index}`}
                              className="timeline-template-picker__step-item"
                            >
                              <span className="timeline-template-picker__step-index">{node.order ?? index + 1}</span>
                              <div className="timeline-template-picker__step-body">
                                <strong className="timeline-template-picker__step-title">{node.name}</strong>
                                <span className="timeline-template-picker__step-description">
                                  {getStepDescription(node.description)}
                                </span>
                              </div>
                            </li>
                          ))
                        ) : (
                          <li className="timeline-template-picker__empty-detail">
                            这套模板暂时还没有预置步骤。
                          </li>
                        )}
                      </ol>
                    </section>
                  </>
                ) : (
                  <section className="timeline-template-picker__empty-state timeline-template-picker__empty-state--detail">
                    <p className="timeline-template-picker__empty-title">模板详情尚未加载完成</p>
                    <p className="timeline-template-picker__empty-copy">请返回列表重新选择一个模板。</p>
                  </section>
                )}
              </div>
            )}
          </div>

          {isDetailView ? (
            <footer className="timeline-template-picker__action-bar">
              <button type="button" className="brand-secondary-button" onClick={onBack}>
                返回
              </button>
              <button
                type="button"
                className="brand-primary-button"
                onClick={onApply}
                disabled={submitting || detailLoading || !activeTemplate}
              >
                {submitting ? '应用中...' : '使用此模板'}
              </button>
            </footer>
          ) : null}
        </div>
      </div>
    </Popup>
  )
}
