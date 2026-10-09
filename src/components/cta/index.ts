export type { AuroraColorStops, AuroraProps } from './Aurora'

export { default as BorderGlow } from '@/components/ui/BorderGlow'
export type { BorderGlowProps, BorderGlowShape } from '@/components/ui/BorderGlow'

export { CtaButton } from './CtaButton'
export type { CtaButtonProps, CtaShape } from './CtaButton'

export {
  CTA_TEMPLATES,
  DEFAULT_CTA_TEMPLATE_ID,
  HEX_GOLD_CTA,
  PILL_BLACK_CTA,
  PILL_GOLD_CTA,
  PILL_PURPLE_CTA,
  SQUIRCLE_CTA,
  cloneTemplateValues,
  ctaButtonPropsFromTemplate,
  getCtaTemplate,
} from './ctaTemplates'
export type {
  CtaTemplate,
  CtaTemplateId,
  CtaTemplateValues,
} from './ctaTemplates'
