/**
 * Test-only stand-in for @deepseek-ai/dsh-client-ui-primitives.
 *
 * The published package's node half imports stylesheet-bearing dependencies
 * (katex), which Node cannot resolve in tests. This stub provides the icon
 * components the workbench imports with identical signatures; production
 * bundles resolve the real package. vitest aliases the package to this
 * module.
 */

import type { FC } from 'react'

/** One neutral 16px glyph placeholder. */
const StubIcon: FC<{ size?: number }> = () => (
  <svg width={16} height={16} viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
    <rect x="3" y="3" width="10" height="10" fill="currentColor" />
  </svg>
)

export const IconBranchOutline16 = StubIcon
export const IconCheckOutline14 = StubIcon
export const IconCheckOutline16 = StubIcon
export const IconChevronDownOutline14 = StubIcon
export const IconChevronLeftOutline14 = StubIcon
export const IconChevronRightOutline14 = StubIcon
export const IconEllipsisOutline16 = StubIcon
export const IconGlobeOutline14 = StubIcon
export const IconNewChatOutline16 = StubIcon
export const IconPanelLeftOutline16 = StubIcon
export const IconPlusOutline16 = StubIcon
export const IconSearchOutline16 = StubIcon
export const IconSettingsOutline14 = StubIcon
export const IconSettingsOutline16 = StubIcon
export const IconTriangleRightFill14 = StubIcon
