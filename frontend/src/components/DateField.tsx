import { Button, DatePicker } from 'antd-mobile'
import dayjs from 'dayjs'
import { useState } from 'react'

type DateFieldProps = {
  label: string
  value?: string
  placeholder?: string
  onChange: (value: string) => void
}

export function DateField({ label, value, placeholder = '请选择日期', onChange }: DateFieldProps) {
  const [visible, setVisible] = useState(false)
  const dateValue = value ? dayjs(value, 'YYYY-MM-DD').toDate() : undefined

  return (
    <div className="space-y-2">
      <div className="text-sm font-medium text-gray-500">{label}</div>
      <Button
        block
        fill="outline"
        color="default"
        onClick={() => setVisible(true)}
        className="justify-start !border-gray-200 !text-left !text-gray-700"
      >
        {value || placeholder}
      </Button>
      <DatePicker
        visible={visible}
        precision="day"
        value={dateValue}
        onClose={() => setVisible(false)}
        onConfirm={(nextValue) => {
          setVisible(false)
          onChange(dayjs(nextValue).format('YYYY-MM-DD'))
        }}
      />
    </div>
  )
}

export default DateField
