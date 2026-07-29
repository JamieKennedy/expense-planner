import { Dices, Palette } from 'lucide-react'
import { HexColorPicker } from 'react-colorful'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '~/components/ui/popover'
import { cn } from '~/lib/utils'

export const TAG_COLOURS = [
  '#2dd4bf',
  '#22d3ee',
  '#38bdf8',
  '#60a5fa',
  '#818cf8',
  '#a78bfa',
  '#c084fc',
  '#e879f9',
  '#f472b6',
  '#fb7185',
  '#f87171',
  '#fb923c',
  '#fbbf24',
  '#a3e635',
  '#4ade80',
  '#34d399',
] as const

export function randomTagColour(): string {
  const values = new Uint32Array(1)
  crypto.getRandomValues(values)
  return TAG_COLOURS[values[0] % TAG_COLOURS.length]
}

export function ColourPicker({
  value,
  onValueChange,
  invalid = false,
}: {
  value: string
  onValueChange: (value: string) => void
  invalid?: boolean
}) {
  const validColour = /^#[0-9a-fA-F]{6}$/.test(value) ? value : '#64748b'
  return (
    <div className="grid gap-3">
      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="secondary"
            className="w-full justify-start px-3 font-medium"
            aria-label={`Choose tag colour, currently ${validColour}`}
            aria-invalid={invalid || undefined}
          >
            <span
              className="size-5 rounded-full border border-white/20"
              style={{ backgroundColor: validColour }}
            />
            <Palette size={16} className="text-slate-400" />
            {value.toUpperCase()}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-72 p-4">
          <HexColorPicker
            color={validColour}
            onChange={(colour) => onValueChange(colour.toLowerCase())}
            className="!w-full"
          />
          <div className="mt-4 grid grid-cols-8 gap-2">
            {TAG_COLOURS.map((colour) => (
              <button
                key={colour}
                type="button"
                aria-label={`Use ${colour}`}
                aria-pressed={value.toLowerCase() === colour}
                className={cn(
                  'size-6 rounded-full border border-white/15 outline-none transition hover:scale-110 focus-visible:ring-2 focus-visible:ring-teal-300',
                  value.toLowerCase() === colour &&
                    'ring-2 ring-white ring-offset-2 ring-offset-slate-900',
                )}
                style={{ backgroundColor: colour }}
                onClick={() => onValueChange(colour)}
              />
            ))}
          </div>
        </PopoverContent>
      </Popover>
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <Input
          value={value}
          aria-invalid={invalid || undefined}
          aria-label="Tag colour hex value"
          onChange={(event) => onValueChange(event.target.value)}
        />
        <Button
          type="button"
          size="icon"
          variant="secondary"
          aria-label="Choose another random colour"
          onClick={() => onValueChange(randomTagColour())}
        >
          <Dices size={17} />
        </Button>
      </div>
    </div>
  )
}
