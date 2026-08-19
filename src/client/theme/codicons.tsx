/**
 * VS Code codicons (the workbench's icon set), embedded as inline SVG data:
 * the real upstream path geometry, not redraws. Source: @vscode/codicons
 * 0.0.36 src/icons/<name>.svg (MIT). New icons: copy the SVG next to the
 * generator or paste the shapes in by hand — never redraw by eye.
 */

import type { FC } from 'react'

/** One codicon shape: a stroked-enumeration path or a filled rect. */
interface IconShape {
  readonly kind: 'path' | 'rect'
  readonly d?: string
  readonly evenOdd?: boolean
  readonly x?: string
  readonly y?: string
  readonly width?: string
  readonly height?: string
}

/** Props every icon accepts. */
export interface CodiconProps {
  /** Rendered square size in px (VS Code chrome uses 16; activity rail 24). */
  readonly size?: number
}

/** Shape table keyed by codicon name. */
const ICONS: Readonly<Record<string, { viewBox: string; shapes: readonly IconShape[] }>> = {
  'files': {
    viewBox: '0 0 24 24',
    shapes: [
      { kind: 'path', d: "M17.5 0h-9L7 1.5V6H2.5L1 7.5v15.07L2.5 24h12.07L16 22.57V18h4.7l1.3-1.43V4.5L17.5 0zm0 2.12l2.38 2.38H17.5V2.12zm-3 20.38h-12v-15H7v9.07L8.5 18h6v4.5zm6-6h-12v-15H16V6h4.5v10.5z" },
    ],
  },
  'search': {
    viewBox: '0 0 24 24',
    shapes: [
      { kind: 'path', d: "M15.25 0a8.25 8.25 0 0 0-6.18 13.72L1 22.88l1.12 1 8.05-9.12A8.251 8.251 0 1 0 15.25.01V0zm0 15a6.75 6.75 0 1 1 0-13.5 6.75 6.75 0 0 1 0 13.5z" },
    ],
  },
  'sparkle': {
    viewBox: '0 0 16 16',
    shapes: [
      { kind: 'path', d: "M5.39804 10.8069C5.57428 10.9312 5.78476 10.9977 6.00043 10.9973C6.21633 10.9975 6.42686 10.93 6.60243 10.8043C6.77993 10.6739 6.91464 10.4936 6.98943 10.2863L7.43643 8.91335C7.55086 8.56906 7.74391 8.25615 8.00028 7.99943C8.25665 7.74272 8.56929 7.54924 8.91343 7.43435L10.3044 6.98335C10.4564 6.92899 10.5936 6.84019 10.7055 6.7239C10.8174 6.60762 10.9008 6.467 10.9492 6.31308C10.9977 6.15916 11.0098 5.99611 10.9847 5.83672C10.9596 5.67732 10.8979 5.52591 10.8044 5.39435C10.6703 5.20842 10.4794 5.07118 10.2604 5.00335L8.88543 4.55635C8.54091 4.44212 8.22777 4.24915 7.97087 3.99277C7.71396 3.73638 7.52035 3.42363 7.40543 3.07935L6.95343 1.69135C6.88113 1.48904 6.74761 1.31428 6.57143 1.19135C6.43877 1.09762 6.28607 1.03614 6.12548 1.01179C5.96489 0.987448 5.80083 1.00091 5.64636 1.05111C5.49188 1.1013 5.35125 1.18685 5.23564 1.30095C5.12004 1.41505 5.03265 1.55454 4.98043 1.70835L4.52343 3.10835C4.40884 3.44317 4.21967 3.74758 3.97022 3.9986C3.72076 4.24962 3.41753 4.44067 3.08343 4.55735L1.69243 5.00535C1.54065 5.05974 1.40352 5.14852 1.29177 5.26474C1.18001 5.38095 1.09666 5.52145 1.04824 5.67523C0.999819 5.82902 0.987639 5.99192 1.01265 6.1512C1.03767 6.31048 1.0992 6.46181 1.19243 6.59335C1.32027 6.7728 1.50105 6.90777 1.70943 6.97935L3.08343 7.42435C3.52354 7.57083 3.90999 7.84518 4.19343 8.21235C4.35585 8.42298 4.4813 8.65968 4.56443 8.91235L5.01643 10.3033C5.08846 10.5066 5.22179 10.6826 5.39804 10.8069ZM5.48343 3.39235L6.01043 2.01535L6.44943 3.39235C6.61312 3.8855 6.88991 4.33351 7.25767 4.70058C7.62544 5.06765 8.07397 5.34359 8.56743 5.50635L9.97343 6.03535L8.59143 6.48335C8.09866 6.64764 7.65095 6.92451 7.28382 7.29198C6.9167 7.65945 6.64026 8.10742 6.47643 8.60035L5.95343 9.97835L5.50443 8.59935C5.34335 8.10608 5.06943 7.65718 4.70443 7.28835C4.3356 6.92031 3.88653 6.64272 3.39243 6.47735L2.01443 5.95535L3.40043 5.50535C3.88672 5.33672 4.32775 5.05855 4.68943 4.69235C5.04901 4.32464 5.32049 3.88016 5.48343 3.39235ZM11.5353 14.8494C11.6713 14.9456 11.8337 14.9973 12.0003 14.9974C12.1654 14.9974 12.3264 14.9464 12.4613 14.8514C12.6008 14.7529 12.7058 14.6129 12.7613 14.4514L13.0093 13.6894C13.0625 13.5309 13.1515 13.3869 13.2693 13.2684C13.3867 13.1498 13.5307 13.0611 13.6893 13.0094L14.4613 12.7574C14.619 12.7029 14.7557 12.6004 14.8523 12.4644C14.9257 12.3614 14.9736 12.2424 14.9921 12.1173C15.0106 11.9922 14.9992 11.8645 14.9588 11.7447C14.9184 11.6249 14.8501 11.5163 14.7597 11.428C14.6692 11.3396 14.5591 11.2739 14.4383 11.2364L13.6743 10.9874C13.5162 10.9348 13.3724 10.8462 13.2544 10.7285C13.1364 10.6109 13.0473 10.4674 12.9943 10.3094L12.7423 9.53638C12.6886 9.37853 12.586 9.24191 12.4493 9.14638C12.3473 9.07343 12.2295 9.02549 12.1056 9.00642C11.9816 8.98736 11.8549 8.99772 11.7357 9.03665C11.6164 9.07558 11.508 9.142 11.4192 9.23054C11.3304 9.31909 11.2636 9.42727 11.2243 9.54638L10.9773 10.3084C10.925 10.466 10.8375 10.6097 10.7213 10.7284C10.6066 10.8449 10.4667 10.9335 10.3123 10.9874L9.53931 11.2394C9.38025 11.2933 9.2422 11.3959 9.1447 11.5326C9.04721 11.6694 8.99522 11.8333 8.99611 12.0013C8.99699 12.1692 9.0507 12.3326 9.14963 12.4683C9.24856 12.604 9.38769 12.7051 9.54731 12.7574L10.3103 13.0044C10.4692 13.0578 10.6136 13.1471 10.7323 13.2654C10.8505 13.3836 10.939 13.5283 10.9903 13.6874L11.2433 14.4614C11.2981 14.6178 11.4001 14.7534 11.5353 14.8494ZM10.6223 12.0564L10.4433 11.9974L10.6273 11.9334C10.9291 11.8284 11.2027 11.6556 11.4273 11.4284C11.6537 11.1994 11.8248 10.9216 11.9273 10.6164L11.9853 10.4384L12.0443 10.6194C12.1463 10.9261 12.3185 11.2047 12.5471 11.4332C12.7757 11.6617 13.0545 11.8336 13.3613 11.9354L13.5563 11.9984L13.3763 12.0574C13.0689 12.1596 12.7898 12.3322 12.5611 12.5616C12.3324 12.791 12.1606 13.0707 12.0593 13.3784L12.0003 13.5594L11.9423 13.3784C11.8409 13.0702 11.6687 12.7901 11.4394 12.5605C11.2102 12.3309 10.9303 12.1583 10.6223 12.0564Z" },
    ],
  },
  'settings-gear': {
    viewBox: '0 0 24 24',
    shapes: [
      { kind: 'path', d: "M19.85 8.75l4.15.83v4.84l-4.15.83 2.35 3.52-3.43 3.43-3.52-2.35-.83 4.15H9.58l-.83-4.15-3.52 2.35-3.43-3.43 2.35-3.52L0 14.42V9.58l4.15-.83L1.8 5.23 5.23 1.8l3.52 2.35L9.58 0h4.84l.83 4.15 3.52-2.35 3.43 3.43-2.35 3.52zm-1.57 5.07l4-.81v-2l-4-.81-.54-1.3 2.29-3.43-1.43-1.43-3.43 2.29-1.3-.54-.81-4h-2l-.81 4-1.3.54-3.43-2.29-1.43 1.43L6.38 8.9l-.54 1.3-4 .81v2l4 .81.54 1.3-2.29 3.43 1.43 1.43 3.43-2.29 1.3.54.81 4h2l.81-4 1.3-.54 3.43 2.29 1.43-1.43-2.29-3.43.54-1.3zm-8.186-4.672A3.43 3.43 0 0 1 12 8.57 3.44 3.44 0 0 1 15.43 12a3.43 3.43 0 1 1-5.336-2.852zm.956 4.274c.281.188.612.288.95.288A1.7 1.7 0 0 0 13.71 12a1.71 1.71 0 1 0-2.66 1.422z", evenOdd: true },
    ],
  },
  'chevron-right': {
    viewBox: '0 0 16 16',
    shapes: [
      { kind: 'path', d: "M10.072 8.024L5.715 3.667l.618-.62L11 7.716v.618L6.333 13l-.618-.619 4.357-4.357z", evenOdd: true },
    ],
  },
  'chevron-down': {
    viewBox: '0 0 16 16',
    shapes: [
      { kind: 'path', d: "M7.976 10.072l4.357-4.357.62.618L8.284 11h-.618L3 6.333l.619-.618 4.357 4.357z", evenOdd: true },
    ],
  },
  'chevron-up': {
    viewBox: '0 0 16 16',
    shapes: [
      { kind: 'path', d: "M8.024 5.928l-4.357 4.357-.62-.618L7.716 5h.618L13 9.667l-.619.618-4.357-4.357z", evenOdd: true },
    ],
  },
  'close': {
    viewBox: '0 0 16 16',
    shapes: [
      { kind: 'path', d: "M8 8.707l3.646 3.647.708-.707L8.707 8l3.647-3.646-.707-.708L8 7.293 4.354 3.646l-.707.708L7.293 8l-3.646 3.646.707.708L8 8.707z", evenOdd: true },
    ],
  },
  'refresh': {
    viewBox: '0 0 16 16',
    shapes: [
      { kind: 'path', d: "M4.681 3H2V2h3.5l.5.5V6H5V4a5 5 0 1 0 4.53-.761l.302-.954A6 6 0 1 1 4.681 3z", evenOdd: true },
    ],
  },
  'ellipsis': {
    viewBox: '0 0 16 16',
    shapes: [
      { kind: 'path', d: "M4 8a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm5 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm5 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0z" },
    ],
  },
  'terminal': {
    viewBox: '0 0 24 24',
    shapes: [
      { kind: 'path', d: "M1.5 3L3 1.5H21L22.5 3V21L21 22.5H3L1.5 21V3ZM3 3V21H21V3H3Z", evenOdd: true },
      { kind: 'path', d: "M7.06078 7.49988L6.00012 8.56054L10.2427 12.8032L6 17.0459L7.06066 18.1066L12 13.1673V12.4391L7.06078 7.49988Z" },
      { kind: 'rect', x: "12", y: "16.5", width: "6", height: "1.5" },
    ],
  },
  'layout-sidebar-left': {
    viewBox: '0 0 16 16',
    shapes: [
      { kind: 'path', d: "M2 1L1 2V14L2 15H14L15 14V2L14 1H2ZM14 14H7V2H14V14Z", evenOdd: true },
    ],
  },
  'layout-sidebar-right': {
    viewBox: '0 0 16 16',
    shapes: [
      { kind: 'path', d: "M2 1L1 2V14L2 15H14L15 14V2L14 1H2ZM2 14V2H9V14H2Z", evenOdd: true },
    ],
  },
  'add': {
    viewBox: '0 0 16 16',
    shapes: [
      { kind: 'path', d: "M14 7v1H8v6H7V8H1V7h6V1h1v6h6z" },
    ],
  },
  'error': {
    viewBox: '0 0 16 16',
    shapes: [
      { kind: 'path', d: "M8.6 1c1.6.1 3.1.9 4.2 2 1.3 1.4 2 3.1 2 5.1 0 1.6-.6 3.1-1.6 4.4-1 1.2-2.4 2.1-4 2.4-1.6.3-3.2.1-4.6-.7-1.4-.8-2.5-2-3.1-3.5C.9 9.2.8 7.5 1.3 6c.5-1.6 1.4-2.9 2.8-3.8C5.4 1.3 7 .9 8.6 1zm.5 12.9c1.3-.3 2.5-1 3.4-2.1.8-1.1 1.3-2.4 1.2-3.8 0-1.6-.6-3.2-1.7-4.3-1-1-2.2-1.6-3.6-1.7-1.3-.1-2.7.2-3.8 1-1.1.8-1.9 1.9-2.3 3.3-.4 1.3-.4 2.7.2 4 .6 1.3 1.5 2.3 2.7 3 1.2.7 2.6.9 3.9.6zM7.9 7.5L10.3 5l.7.7-2.4 2.5 2.4 2.5-.7.7-2.4-2.5-2.4 2.5-.7-.7 2.4-2.5-2.4-2.5.7-.7 2.4 2.5z", evenOdd: true },
    ],
  },
  'check': {
    viewBox: '0 0 16 16',
    shapes: [
      { kind: 'path', d: "M14.431 3.323l-8.47 10-.79-.036-3.35-4.77.818-.574 2.978 4.24 8.051-9.506.764.646z", evenOdd: true },
    ],
  },
  'warning': {
    viewBox: '0 0 16 16',
    shapes: [
      { kind: 'path', d: "M7.56 1h.88l6.54 12.26-.44.74H1.44L1 13.26 7.56 1zM8 2.28L2.28 13H13.7L8 2.28zM8.625 12v-1h-1.25v1h1.25zm-1.25-2V6h1.25v4h-1.25z", evenOdd: true },
    ],
  },
  'comment-discussion': {
    viewBox: '0 0 16 16',
    shapes: [
      { kind: 'path', d: "M4 11.29l1-1v1.42l-1.15 1.14L3 12.5V10H1.5L1 9.5v-8l.5-.5h12l.5.5V6h-1V2H2v7h1.5l.5.5v1.79zM10.29 13l1.86 1.85.85-.35V13h1.5l.5-.5v-5l-.5-.5h-8l-.5.5v5l.5.5h3.79zm.21-1H7V8h7v4h-1.5l-.5.5v.79l-1.15-1.14-.35-.15z", evenOdd: true },
    ],
  },
  'circle-filled': {
    viewBox: '0 0 16 16',
    shapes: [
      { kind: 'path', d: "M8 4c.367 0 .721.048 1.063.145a3.943 3.943 0 0 1 1.762 1.031 3.944 3.944 0 0 1 1.03 1.762c.097.34.145.695.145 1.062 0 .367-.048.721-.145 1.063a3.94 3.94 0 0 1-1.03 1.765 4.017 4.017 0 0 1-1.762 1.031C8.72 11.953 8.367 12 8 12s-.721-.047-1.063-.14a4.056 4.056 0 0 1-1.765-1.032A4.055 4.055 0 0 1 4.14 9.062 3.992 3.992 0 0 1 4 8c0-.367.047-.721.14-1.063a4.02 4.02 0 0 1 .407-.953A4.089 4.089 0 0 1 5.98 4.546a3.94 3.94 0 0 1 .957-.401A3.89 3.89 0 0 1 8 4z" },
    ],
  },
  'new-file': {
    viewBox: '0 0 16 16',
    shapes: [
      { kind: 'path', d: "M9.5 1.1l3.4 3.5.1.4v2h-1V6H8V2H3v11h4v1H2.5l-.5-.5v-12l.5-.5h6.7l.3.1zM9 2v3h2.9L9 2zm4 14h-1v-3H9v-1h3V9h1v3h3v1h-3v3z", evenOdd: true },
    ],
  },
  'new-folder': {
    viewBox: '0 0 16 16',
    shapes: [
      { kind: 'path', d: "M14.5 2H7.71l-.85-.85L6.51 1h-5l-.5.5v11l.5.5H7v-1H1.99V6h4.49l.35-.15.86-.86H14v1.5l-.001.51h1.011V2.5L14.5 2zm-.51 2h-6.5l-.35.15-.86.86H2v-3h4.29l.85.85.36.15H14l-.01.99zM13 16h-1v-3H9v-1h3V9h1v3h3v1h-3v3z", evenOdd: true },
    ],
  },
  'folder': {
    viewBox: '0 0 16 16',
    shapes: [
      { kind: 'path', d: "M7.25 4l-.85-.85L5.54 2.3H1.5l-.5.5v10.4l.5.5h13l.5-.5V4.5l-.5-.5H7.25zm-.4 1h7.15v7.2H2V3.3h3.19l.85.85.36.15.4.7z", evenOdd: true },
    ],
  },
  'folder-opened': {
    viewBox: '0 0 16 16',
    shapes: [
      { kind: 'path', d: "M14.5 2H7.71l-.85-.85L6.51 1h-5l-.5.5v11l.5.5h13l.5-.5v-10l-.5-.5zm-.5 10H2V6h4.5l.35-.15.86-.85H14v7zm0-8H7.71l-.85-.85L6.51 3H2V2h4.29l.85.85.36.15H14v1z", evenOdd: true },
    ],
  },
  'file': {
    viewBox: '0 0 16 16',
    shapes: [
      { kind: 'path', d: "M13.71 4.29l-3-3L10 1H4L3.5 1.5v13l.5.5h8l.5-.5V5l-.29-.71zM10 2.41L12.59 5H10V2.41zM4 14V2h5v3.5l.5.5H13v8H4z", evenOdd: true },
    ],
  },
  'file-code': {
    viewBox: '0 0 16 16',
    shapes: [
      { kind: 'path', d: "M13.71 4.29l-3-3L10 1H4L3.5 1.5v13l.5.5h8l.5-.5V5l-.29-.71zM10 2.41L12.59 5H10V2.41zM4 14V2h5v3.5l.5.5H13v8H4zm4.15-5.15L6.85 7.55 8.15 6.25 7.45 5.55 5.45 7.55l2 2 .7-.7zm1.7 0l1.3-1.3-1.3-1.3.7-.7 2 2-2 2-.7-.7z", evenOdd: true },
    ],
  },
  'file-media': {
    viewBox: '0 0 16 16',
    shapes: [
      { kind: 'path', d: "M13.71 4.29l-3-3L10 1H4L3.5 1.5v13l.5.5h8l.5-.5V5l-.29-.71zM10 2.41L12.59 5H10V2.41zM4 14V2h5v3.5l.5.5H13v8H4zm2-2h6l-2-3-1.5 2-1-1.2-1.5 2.2z", evenOdd: true },
    ],
  },
  'scm': {
    viewBox: '0 0 24 24',
    shapes: [
      { kind: 'path', d: "M19.5 13.5L15 9v3H9v2h6v3l4.5-4.5zM9 21V15l-4.5 4.5L9 21zM14.5 13.5L19 9h-4.5V6H7v2H3L7.5 13.5 3 18h4.5v2h9v-2H14.5z" },
    ],
  },
  'run': {
    viewBox: '0 0 24 24',
    shapes: [
      { kind: 'path', d: "M3.5 2.5v19l16.5-9.5z" },
    ],
  },
  'extensions': {
    viewBox: '0 0 24 24',
    shapes: [
      { kind: 'path', d: "M2 5.5v13l5 2.5.5-.5-4.5-2V6l4.5 1.5L12 6v12l-4.5-1.5L7 17.5l.5.5 5-2.5V5.5L7 4 2 5.5zm10 0v12l4.5-1.5L19 17.5l.5.5 5-2.5V5.5l-4.5 1.5L12 5.5v12l4.5-1.5L19 12.5l-.5-.5-5 2.5V5.5l4.5-1.5L12 5.5z" },
    ],
  },
  'case-sensitive': {
    viewBox: '0 0 16 16',
    shapes: [
      { kind: 'path', d: "M7.41 15.06V12H4.38l-.21.63-.33 1-.18.53-.25-.9L2.44 9.9H0v2.79l1 .88v1.49H.06v1h3V15h-.65v-1.06H4.1V15H3.4v1h3V15h-.65v-1.27l-1-.87V10l1.1 3.47.18.56.35-1.13.57-1.74L9.65 9.9v4.15l-1 .88V15H8v1h3V15h-.66v-1.27l-1-.88V10l1.1 3.47.18.56.35-1.13.57-1.74L14.1 9.9H12l-1.1 3.78-.18.56V12H7.41v3.06z" },
    ],
  },
  'whole-match': {
    viewBox: '0 0 16 16',
    shapes: [
      { kind: 'path', d: "M0 1.75C0 .784.784 0 1.75 0h12.5C15.217 0 16 .784 16 1.75v12.5A1.75 1.75 0 0 1 14.25 16H1.75A1.75 1.75 0 0 1 0 14.25V1.75zm1.75-.25a.25.25 0 0 0-.25.25v12.5c0 .138.112.25.25.25h12.5a.25.25 0 0 0 .25-.25V1.75a.25.25 0 0 0-.25-.25H1.75zM7.25 8V4H6v5h4V8H7.25z" },
    ],
  },
  'regex': {
    viewBox: '0 0 16 16',
    shapes: [
      { kind: 'path', d: "M9.094 2.688l-1.031 1.063L11.125 6.5H1v1.5h10.125L8.063 10.75l1.031 1.063 4-4z", evenOdd: true },
    ],
  },
  'git-branch': {
    viewBox: '0 0 16 16',
    shapes: [
      { kind: 'path', d: "M5 3.5a1.5 1.5 0 1 1-2 1.415V11.085a1.5 1.5 0 1 1-1 0V4.915A1.5 1.5 0 0 1 5 3.5zm6 8a1.5 1.5 0 1 1-2 1.415V8.5A2.5 2.5 0 0 0 6.5 6H4V5h2.5A3.5 3.5 0 0 1 10 8.5v4.415a1.5 1.5 0 0 1 1-.415z", evenOdd: true },
    ],
  },
  'discard': {
    viewBox: '0 0 16 16',
    shapes: [
      { kind: 'path', d: "M1.5 8a6.5 6.5 0 1 1 11.09 4.6l-.7-.7A5.5 5.5 0 1 0 2.5 8H5L2 11 0 8h1.5z", evenOdd: true },
    ],
  },
  'copy': {
    viewBox: '0 0 16 16',
    shapes: [
      { kind: 'path', d: "M4 4v8h8V4H4zm1 1h6v6H5V5zM2 2h8v1H3v8H2V2z" },
    ],
  },
  'play': {
    viewBox: '0 0 16 16',
    shapes: [
      { kind: 'path', d: "M4 2.5v11l9-5.5-9-5.5z" },
    ],
  },
  'stop': {
    viewBox: '0 0 16 16',
    shapes: [
      { kind: 'path', d: "M3 3h10v10H3z" },
    ],
  },
  'clear-all': {
    viewBox: '0 0 16 16',
    shapes: [
      { kind: 'path', d: "M2 3h12v1H2V3zm2 3h8v1H4V6zm2 3h4v1H6V9z" },
    ],
  },
}

/** Render one codicon by name (currentColor; inherits the text color). */
export const Codicon: FC<CodiconProps & { name: string }> = ({ name, size = 16 }) => {
  const icon = ICONS[name]
  if (icon === undefined) throw new Error(`unknown codicon: ${name}`)
  return (
    <svg
      width={size}
      height={size}
      viewBox={icon.viewBox}
      xmlns="http://www.w3.org/2000/svg"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      {icon.shapes.map((shape, index) => shape.kind === 'path'
        ? <path key={index} d={shape.d} {...(shape.evenOdd === true ? { fillRule: 'evenodd', clipRule: 'evenodd' } : {})} />
        : <rect key={index} x={shape.x} y={shape.y} width={shape.width} height={shape.height} />)}
    </svg>
  )
}

/** Activity-rail icons (24px in VS Code). */
export const IconFiles: FC<CodiconProps> = ({ size = 24 }) => <Codicon name="files" size={size} />
export const IconSearch: FC<CodiconProps> = ({ size = 24 }) => <Codicon name="search" size={size} />
export const IconSparkle: FC<CodiconProps> = ({ size = 24 }) => <Codicon name="sparkle" size={size} />
export const IconSettingsGear: FC<CodiconProps> = ({ size = 24 }) => <Codicon name="settings-gear" size={size} />
export const IconScm: FC<CodiconProps> = ({ size = 24 }) => <Codicon name="scm" size={size} />
export const IconRun: FC<CodiconProps> = ({ size = 24 }) => <Codicon name="run" size={size} />
export const IconExtensions: FC<CodiconProps> = ({ size = 24 }) => <Codicon name="extensions" size={size} />

/** 16px chrome icons. */
export const IconChevronRight: FC<CodiconProps> = ({ size = 16 }) => <Codicon name="chevron-right" size={size} />
export const IconChevronDown: FC<CodiconProps> = ({ size = 16 }) => <Codicon name="chevron-down" size={size} />
export const IconChevronUp: FC<CodiconProps> = ({ size = 16 }) => <Codicon name="chevron-up" size={size} />
export const IconClose: FC<CodiconProps> = ({ size = 16 }) => <Codicon name="close" size={size} />
export const IconRefresh: FC<CodiconProps> = ({ size = 16 }) => <Codicon name="refresh" size={size} />
export const IconEllipsis: FC<CodiconProps> = ({ size = 16 }) => <Codicon name="ellipsis" size={size} />
export const IconTerminal: FC<CodiconProps> = ({ size = 16 }) => <Codicon name="terminal" size={size} />
export const IconLayoutSidebarLeft: FC<CodiconProps> = ({ size = 16 }) => <Codicon name="layout-sidebar-left" size={size} />
export const IconLayoutSidebarRight: FC<CodiconProps> = ({ size = 16 }) => <Codicon name="layout-sidebar-right" size={size} />
export const IconAdd: FC<CodiconProps> = ({ size = 16 }) => <Codicon name="add" size={size} />
export const IconError: FC<CodiconProps> = ({ size = 16 }) => <Codicon name="error" size={size} />
export const IconCheck: FC<CodiconProps> = ({ size = 16 }) => <Codicon name="check" size={size} />
export const IconWarning: FC<CodiconProps> = ({ size = 16 }) => <Codicon name="warning" size={size} />
export const IconCommentDiscussion: FC<CodiconProps> = ({ size = 16 }) => <Codicon name="comment-discussion" size={size} />
export const IconCircleFilled: FC<CodiconProps> = ({ size = 16 }) => <Codicon name="circle-filled" size={size} />
export const IconNewFile: FC<CodiconProps> = ({ size = 16 }) => <Codicon name="new-file" size={size} />
export const IconNewFolder: FC<CodiconProps> = ({ size = 16 }) => <Codicon name="new-folder" size={size} />
export const IconFolder: FC<CodiconProps> = ({ size = 16 }) => <Codicon name="folder" size={size} />
export const IconFolderOpened: FC<CodiconProps> = ({ size = 16 }) => <Codicon name="folder-opened" size={size} />
export const IconFile: FC<CodiconProps> = ({ size = 16 }) => <Codicon name="file" size={size} />
export const IconFileCode: FC<CodiconProps> = ({ size = 16 }) => <Codicon name="file-code" size={size} />
export const IconFileMedia: FC<CodiconProps> = ({ size = 16 }) => <Codicon name="file-media" size={size} />
export const IconCaseSensitive: FC<CodiconProps> = ({ size = 16 }) => <Codicon name="case-sensitive" size={size} />
export const IconWholeMatch: FC<CodiconProps> = ({ size = 16 }) => <Codicon name="whole-match" size={size} />
export const IconRegex: FC<CodiconProps> = ({ size = 16 }) => <Codicon name="regex" size={size} />
export const IconGitBranch: FC<CodiconProps> = ({ size = 16 }) => <Codicon name="git-branch" size={size} />
export const IconDiscard: FC<CodiconProps> = ({ size = 16 }) => <Codicon name="discard" size={size} />
export const IconCopy: FC<CodiconProps> = ({ size = 16 }) => <Codicon name="copy" size={size} />
export const IconPlay: FC<CodiconProps> = ({ size = 16 }) => <Codicon name="play" size={size} />
export const IconStop: FC<CodiconProps> = ({ size = 16 }) => <Codicon name="stop" size={size} />
export const IconClearAll: FC<CodiconProps> = ({ size = 16 }) => <Codicon name="clear-all" size={size} />
