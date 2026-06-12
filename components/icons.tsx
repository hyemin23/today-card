import type { SVGProps } from 'react';

/**
 * Minimal stroke icons replacing font-dependent glyphs (⌕ ◷ ⤓ ✦ …) that
 * rendered as emoji or tofu boxes on some devices. currentColor inherits
 * the surrounding ink tone; 24px viewBox, ~1.7 stroke for the editorial look.
 */

function svgProps(props: SVGProps<SVGSVGElement>): SVGProps<SVGSVGElement> {
  return {
    width: 18,
    height: 18,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.7,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
    focusable: false,
    ...props,
  };
}

export function IconSearch(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...svgProps(props)}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.8-3.8" />
    </svg>
  );
}

export function IconClock(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...svgProps(props)}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 1.8" />
    </svg>
  );
}

export function IconDownload(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...svgProps(props)}>
      <path d="M12 4v11" />
      <path d="m7 11 5 4.8 5-4.8" />
      <path d="M5 20h14" />
    </svg>
  );
}

/** two offset sheets — "매거진처럼, 일관되게" */
export function IconLayers(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...svgProps(props)}>
      <rect x="7.5" y="3.5" width="13" height="13" rx="1.5" />
      <path d="M16.5 20.5h-11A1.5 1.5 0 0 1 4 19V8" />
    </svg>
  );
}

/** crisp four-point star (filled) — replaces the ✦ glyph */
export function IconSpark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...svgProps({ ...props, stroke: 'none', fill: 'currentColor' })}>
      <path d="M12 2.6c.5 4.9 4.5 8.9 9.4 9.4-4.9.5-8.9 4.5-9.4 9.4-.5-4.9-4.5-8.9-9.4-9.4 4.9-.5 8.9-4.5 9.4-9.4Z" />
    </svg>
  );
}
