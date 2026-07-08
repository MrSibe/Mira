# Geist Design System — Mira Reference

Sourced from [Vercel Design](https://vercel.com/design.md) · [Dark Theme](https://vercel.com/design.dark.md)

This file documents the Geist tokens adopted by Mira. See the Vercel URLs above for the original full spec.

## Color Scale Intent

Each gray step encodes purpose, not just lightness:

| Step | Usage                     |
| ---- | ------------------------- |
| 100  | Surface / card background |
| 200  | Secondary surface (hover) |
| 300  | Active background         |
| 400  | Default border            |
| 500  | Hover border              |
| 600  | Active border             |
| 700  | Solid fill, high contrast |
| 800  | Solid fill hover          |
| 900  | Secondary text / icons    |
| 1000 | Primary text / icons      |

## Light Theme (CSS Variables)

```css
:root {
  --gray-100: #f2f2f2;
  --gray-200: #ebebeb;
  --gray-300: #e6e6e6;
  --gray-400: #eaeaea;
  --gray-500: #c9c9c9;
  --gray-600: #a8a8a8;
  --gray-700: #8f8f8f;
  --gray-800: #7d7d7d;
  --gray-900: #4d4d4d;
  --gray-1000: #171717;
  --bg-100: #ffffff;
  --bg-200: #fafafa;
  --red-800: #ea001d;
  --blue-700: #006bff;
}
```

## Dark Theme (CSS Variables)

```css
[data-theme="dark"] {
  --gray-100: #1a1a1a;
  --gray-200: #1f1f1f;
  --gray-300: #292929;
  --gray-400: #2e2e2e;
  --gray-500: #454545;
  --gray-600: #878787;
  --gray-700: #8f8f8f;
  --gray-800: #7d7d7d;
  --gray-900: #a0a0a0;
  --gray-1000: #ededed;
  --bg-100: #000000;
  --bg-200: #000000;
  --red-800: #e2162a;
  --blue-700: #006efe;
  --blue-900: #47a8ff;
}
```

## Radii

| Token | Value  | Usage                     |
| ----- | ------ | ------------------------- |
| sm    | 6px    | Controls, buttons, inputs |
| md    | 12px   | Menus, modals, cards      |
| lg    | 16px   | Full-screen surfaces      |
| full  | 9999px | Pills, avatars            |

## Shadows (Light)

| Level   | Value                                                                                             |
| ------- | ------------------------------------------------------------------------------------------------- |
| Raised  | `0 2px 2px rgba(0,0,0,0.04)`                                                                      |
| Popover | `0 1px 1px rgba(0,0,0,0.02), 0 4px 8px -4px rgba(0,0,0,0.04), 0 16px 24px -8px rgba(0,0,0,0.06)`  |
| Modal   | `0 1px 1px rgba(0,0,0,0.02), 0 8px 16px -4px rgba(0,0,0,0.04), 0 24px 32px -8px rgba(0,0,0,0.06)` |

## Shadows (Dark)

| Level   | Value                        |
| ------- | ---------------------------- |
| Raised  | `0 1px 2px rgba(0,0,0,0.16)` |
| Popover | same as light                |
| Modal   | same as light                |

## Typography

- UI text: Geist Sans (14px / 20px line-height, weight 400)
- Labels/small: Geist Sans (13px / 16px, weight 400)
- Buttons: Geist Sans (14px / 20px, weight 500)
- Mono: Geist Mono (14px / 20px, weight 400)
- Code blocks: Geist Mono, 14px

## Component Specs

- Button default: height 40px, radius 6px, px-2.5
- Button small: height 32px, radius 6px, px-1.5
- Input: height 40px, radius 6px, px-3
- Card: padding 24px, radius 12px

## Spacing Scale

Base: 4px. Rhythm: 8px inside group, 16px between groups, 32–40px between sections.
