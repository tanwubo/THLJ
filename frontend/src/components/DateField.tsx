import { Popup } from 'antd-mobile'
import { useEffect, useState } from 'react'
import ThemedCalendarPicker from './ThemedCalendarPicker'

type DateFieldProps = {
  label: string
  value?: string
  placeholder?: string
  onChange: (value: string) => void
}

export function DateField({ label, value, placeholder = '请选择日期', onChange }: DateFieldProps) {
  const [visible, setVisible] = useState(false)
  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 767px)').matches)

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 767px)')
    const handleChange = (event: MediaQueryListEvent) => setIsMobile(event.matches)

    setIsMobile(mediaQuery.matches)
    mediaQuery.addEventListener('change', handleChange)

    return () => {
      mediaQuery.removeEventListener('change', handleChange)
    }
  }, [])

  useEffect(() => {
    if (!visible || isMobile) {
      return
    }

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null
      if (target?.closest('[data-date-field-root="true"]')) {
        return
      }
      setVisible(false)
    }

    document.addEventListener('mousedown', handlePointerDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
    }
  }, [visible, isMobile])

  const handleSelect = (nextValue: string) => {
    onChange(nextValue)
    setVisible(false)
  }

  return (
    <div className="date-field" data-date-field-root="true">
      <div className="date-field__label">{label}</div>
      <button type="button" className="date-field__trigger" onClick={() => setVisible(true)}>
        {value || placeholder}
      </button>

      {visible && !isMobile ? (
        <div className="date-field__panel">
          <ThemedCalendarPicker value={value} onSelect={handleSelect} />
        </div>
      ) : null}

      <Popup visible={visible && isMobile} onMaskClick={() => setVisible(false)} bodyStyle={{ borderTopLeftRadius: 28, borderTopRightRadius: 28 }}>
        <div className="timeline-inline-panel">
          <div className="timeline-inline-panel__header">
            <p className="section-label">Deadline</p>
            <h3 className="section-title">调整节点时间</h3>
            <p className="section-copy">选择日期后立即保存，点击遮罩可关闭。</p>
          </div>
          <ThemedCalendarPicker value={value} onSelect={handleSelect} />
        </div>
      </Popup>
    </div>
  )
}

export default DateField
