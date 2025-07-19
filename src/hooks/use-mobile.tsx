import * as React from "react"

const MOBILE_BREAKPOINT = 768

export function useIsMobile() {
  // 初始值设为 false，避免水合不匹配
  const [isMobile, setIsMobile] = React.useState<boolean>(false)

  React.useEffect(() => {
    // 立即设置正确的初始值
    const checkIsMobile = () => window.innerWidth < MOBILE_BREAKPOINT
    setIsMobile(checkIsMobile())
    
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const onChange = () => {
      setIsMobile(checkIsMobile())
    }
    
    mql.addEventListener("change", onChange)
    return () => mql.removeEventListener("change", onChange)
  }, [])

  return isMobile
}