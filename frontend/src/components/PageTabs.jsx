import { useEffect, useRef } from "react"

/*
 * Page-level tab strip shared by Stock and Analyse.
 *
 * Beyond the shared markup it fixes two things the inline versions got wrong:
 * the tabs had no ARIA roles or arrow-key navigation, and switching tab kept
 * the previous scroll offset, so you landed halfway down the new view.
 */
function PageTabs({ tabs, value, onChange, label }) {
  const stripRef = useRef(null)
  const shouldScrollTop = useRef(false)

  useEffect(() => {
    if (!shouldScrollTop.current) return
    shouldScrollTop.current = false
    window.scrollTo({ top: 0, behavior: "auto" })
  }, [value])

  function select(id) {
    if (id === value) return
    shouldScrollTop.current = true
    onChange(id)
  }

  function handleKeyDown(event) {
    const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0
    if (step === 0) return
    event.preventDefault()

    const index = tabs.findIndex(t => t.id === value)
    const next = tabs[(index + step + tabs.length) % tabs.length]
    select(next.id)
    stripRef.current?.querySelector(`[data-tab-id="${next.id}"]`)?.focus()
  }

  return (
    <div
      className="stock-tabs"
      role="tablist"
      aria-label={label}
      ref={stripRef}
      onKeyDown={handleKeyDown}
    >
      {tabs.map(tab => {
        const active = tab.id === value
        return (
          <button
            type="button"
            key={tab.id}
            role="tab"
            id={`tab-${tab.id}`}
            data-tab-id={tab.id}
            aria-selected={active}
            aria-controls={`panel-${tab.id}`}
            tabIndex={active ? 0 : -1}
            className={`stock-tab ${active ? "stock-tab--active" : ""}`}
            onClick={() => select(tab.id)}
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}

export default PageTabs
