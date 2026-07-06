import * as React from "react"
import { ScrollView } from "@tarojs/components"
import { cn } from "@/lib/utils"

const ScrollArea = React.forwardRef<
  React.ElementRef<typeof ScrollView>,
  React.ComponentPropsWithoutRef<typeof ScrollView> & {
      orientation?: "vertical" | "horizontal" | "both"
      scrollIntoView?: string
  }
>(({ className, children, orientation = "vertical", scrollIntoView, ...props }, ref) => {
    const scrollX = orientation === "horizontal" || orientation === "both"
    const scrollY = orientation === "vertical" || orientation === "both"

  return (
    <ScrollView
      ref={ref}
      className={cn("relative", className)}
      scrollY={scrollY}
      scrollX={scrollX}
      scrollIntoView={scrollIntoView}
      scrollWithAnimation={true}
      style={{
        overflowX: scrollX ? 'auto' : 'hidden',
        overflowY: scrollY ? 'auto' : 'hidden',
      }}
      {...props}
    >
        {children}
    </ScrollView>
  )
})
ScrollArea.displayName = "ScrollArea"

const ScrollBar = () => null // Taro ScrollView handles scrollbars natively

export { ScrollArea, ScrollBar }
