import dayjs from 'dayjs'
import { useEffect, useMemo, useState } from 'react'

type ThemedCalendarPickerProps = {
  value?: string
  onSelect: (value: string) => void
  onClear?: () => void
}

type CalendarCell = {
  date: dayjs.Dayjs
  key: string
  inCurrentMonth: boolean
  isToday: boolean
  isSelected: boolean
}

const WEEKDAY_LABELS = ['一', '二', '三', '四', '五', '六', '日']

function buildCalendarCells(month: dayjs.Dayjs, selectedDate: dayjs.Dayjs | null): CalendarCell[] {
  const monthStart = month.startOf('month')
  const gridStart = monthStart.subtract((monthStart.day() + 6) % 7, 'day')

  return Array.from({ length: 42 }, (_, index) => {
    const date = gridStart.add(index, 'day')
    return {
      date,
      key: date.format('YYYY-MM-DD'),
      inCurrentMonth: date.month() === month.month(),
      isToday: date.isSame(dayjs(), 'day'),
      isSelected: selectedDate ? date.isSame(selectedDate, 'day') : false,
    }
  })
}

export default function ThemedCalendarPicker({ value, onSelect, onClear }: ThemedCalendarPickerProps) {
  const selectedDate = value ? dayjs(value, 'YYYY-MM-DD') : null
  const [visibleMonth, setVisibleMonth] = useState(() => (selectedDate ?? dayjs()).startOf('month'))
  const [showQuickSwitcher, setShowQuickSwitcher] = useState(false)
  const [yearRangeStart, setYearRangeStart] = useState(() => (selectedDate ?? dayjs()).year() - 6)

  useEffect(() => {
    setVisibleMonth((selectedDate ?? dayjs()).startOf('month'))
    setYearRangeStart((selectedDate ?? dayjs()).year() - 6)
  }, [value, selectedDate?.valueOf()])

  const cells = useMemo(() => buildCalendarCells(visibleMonth, selectedDate), [visibleMonth, selectedDate])
  const visibleYear = visibleMonth.year()
  const years = useMemo(() => Array.from({ length: 13 }, (_, index) => yearRangeStart + index), [yearRangeStart])

  const handleYearSelect = (year: number) => {
    setVisibleMonth((current) => current.year(year).startOf('month'))
  }

  const handleMonthSelect = (monthIndex: number) => {
    setVisibleMonth((current) => current.month(monthIndex).startOf('month'))
    setShowQuickSwitcher(false)
  }

  return (
    <div className="themed-calendar" onClick={(event) => event.stopPropagation()}>
      <div className="themed-calendar__header">
        <button
          type="button"
          className="themed-calendar__nav"
          aria-label="上个月"
          onClick={() => setVisibleMonth((current) => current.subtract(1, 'month'))}
        >
          ‹
        </button>
        <button
          type="button"
          className="themed-calendar__title-button"
          aria-label="打开年月快捷选择"
          onClick={() => setShowQuickSwitcher((current) => !current)}
        >
          <strong className="themed-calendar__title">{visibleMonth.format('YYYY年M月')}</strong>
        </button>
        <button
          type="button"
          className="themed-calendar__nav"
          aria-label="下个月"
          onClick={() => setVisibleMonth((current) => current.add(1, 'month'))}
        >
          ›
        </button>
      </div>

      {showQuickSwitcher ? (
        <div className="themed-calendar__quick-switcher">
          <div className="themed-calendar__quick-header">
            <span className="themed-calendar__quick-label">快速选择年份与月份</span>
            <button
              type="button"
              className="themed-calendar__quick-toggle"
              aria-label="切换年份区间"
              onClick={() => setYearRangeStart((current) => current + 12)}
            >
              下一组年份
            </button>
          </div>

          <div className="themed-calendar__year-row">
            <button
              type="button"
              className="themed-calendar__nav themed-calendar__nav--compact"
              aria-label="上一组年份"
              onClick={() => setYearRangeStart((current) => current - 12)}
            >
              ‹
            </button>
            <div className="themed-calendar__year-grid">
              {years.map((year) => (
                <button
                  key={year}
                  type="button"
                  className={`themed-calendar__chip${year === visibleYear ? ' themed-calendar__chip--active' : ''}`}
                  aria-label={`${year}年`}
                  onClick={() => handleYearSelect(year)}
                >
                  {year}年
                </button>
              ))}
            </div>
          </div>

          <div className="themed-calendar__month-grid">
            {Array.from({ length: 12 }, (_, index) => (
              <button
                key={index}
                type="button"
                className={`themed-calendar__chip${index === visibleMonth.month() ? ' themed-calendar__chip--active' : ''}`}
                aria-label={`${index + 1}月`}
                onClick={() => handleMonthSelect(index)}
              >
                {index + 1}月
              </button>
            ))}
          </div>
        </div>
      ) : (
        <>
          <div className="themed-calendar__weekdays">
            {WEEKDAY_LABELS.map((label) => (
              <span key={label}>{label}</span>
            ))}
          </div>

          <div className="themed-calendar__grid">
            {cells.map((cell) => (
              <button
                key={cell.key}
                type="button"
                className={[
                  'themed-calendar__day',
                  cell.inCurrentMonth ? '' : 'themed-calendar__day--muted',
                  cell.isToday ? 'themed-calendar__day--today' : '',
                  cell.isSelected ? 'themed-calendar__day--selected' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                aria-label={`选择 ${cell.key}`}
                onClick={() => onSelect(cell.key)}
              >
                {cell.date.date()}
              </button>
            ))}
          </div>
        </>
      )}

      <div className="themed-calendar__footer">
        {onClear ? (
          <button type="button" className="themed-calendar__action themed-calendar__action--muted" onClick={onClear}>
            清除日期
          </button>
        ) : <span />}
        <button
          type="button"
          className="themed-calendar__action"
          onClick={() => onSelect(dayjs().format('YYYY-MM-DD'))}
        >
          今天
        </button>
      </div>
    </div>
  )
}
