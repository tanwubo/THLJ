import type { ThemeName } from '../../theme/themes'

type ThemePreviewCardProps = {
  themeKey: ThemeName
  title: string
  description: string
  selected: boolean
  swatches: string[]
  onSelect: (theme: ThemeName) => void
}

export default function ThemePreviewCard({
  themeKey,
  title,
  description,
  selected,
  swatches,
  onSelect,
}: ThemePreviewCardProps) {
  return (
    <button
      type="button"
      className={['theme-preview-card', selected ? 'theme-preview-card--active' : ''].filter(Boolean).join(' ')}
      onClick={() => onSelect(themeKey)}
    >
      <div className="theme-preview-card__swatches">
        {swatches.map((swatch) => (
          <span key={swatch} style={{ backgroundColor: swatch }} />
        ))}
      </div>
      <strong>{title}</strong>
      <span>{description}</span>
    </button>
  )
}
