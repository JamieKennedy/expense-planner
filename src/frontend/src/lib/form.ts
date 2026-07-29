export function focusFirstInvalidField() {
  requestAnimationFrame(() => {
    document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
  })
}
