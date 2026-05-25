import { useReducedMotion } from "@/lib/motion"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import type { Transition } from "framer-motion"
import { motion } from "framer-motion"
import * as React from "react"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0" +
" hover-elevate active-elevate-2",
  {
    variants: {
      variant: {
        default:
           "bg-primary text-primary-foreground border border-primary-border",
        destructive:
          "bg-destructive text-destructive-foreground shadow-sm border-destructive-border",
        outline:
          " border [border-color:var(--button-outline)] shadow-xs active:shadow-none ",
        secondary:
          "border bg-secondary text-secondary-foreground border border-secondary-border ",
        ghost: "border border-transparent",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "min-h-9 px-4 py-2",
        sm: "min-h-8 rounded-md px-3 text-xs",
        lg: "min-h-10 rounded-md px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

const springTransition: Transition = {
  type: "spring",
  stiffness: 500,
  damping: 30,
  mass: 0.6,
}

const MotionSlot = motion.create(Slot as React.ForwardRefExoticComponent<React.HTMLAttributes<HTMLElement> & React.RefAttributes<HTMLElement>>)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const prefersReduced = useReducedMotion()
    const hoverProps =
      variant === "link" ? {} : { whileHover: { scale: 1.015, y: -1 } }

    if (asChild) {
      if (prefersReduced) {
        return (
          <Slot
            className={cn(buttonVariants({ variant, size, className }))}
            ref={ref}
            {...props}
          />
        )
      }
      const motionSlotProps = props as unknown as React.ComponentPropsWithoutRef<typeof MotionSlot>
      return (
        <MotionSlot
          className={cn(buttonVariants({ variant, size, className }))}
          ref={ref as React.Ref<HTMLElement>}
          {...hoverProps}
          whileTap={{ scale: 0.97 }}
          transition={springTransition}
          {...motionSlotProps}
        />
      )
    }

    if (prefersReduced) {
      return (
        <button
          className={cn(buttonVariants({ variant, size, className }))}
          ref={ref}
          {...props}
        />
      )
    }

    const motionButtonProps = props as unknown as React.ComponentPropsWithoutRef<typeof motion.button>
    return (
      <motion.button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...hoverProps}
        whileTap={{ scale: 0.97 }}
        transition={springTransition}
        {...motionButtonProps}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
